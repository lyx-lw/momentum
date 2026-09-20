import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RSIPNode } from '../../../types';
import { RSIPStrictModeCard } from '../RSIPStrictModeCard';

function createNode(overrides: Partial<RSIPNode> = {}): RSIPNode {
  return {
    id: 'node-1',
    title: '晨间阅读',
    rule: '每天阅读十分钟',
    sortOrder: 1,
    createdAt: new Date(2026, 8, 1, 8),
    stabilityPhase: 'E0',
    consecutiveExecutions: 2,
    cumulativeExecutionDays: 8,
    ...overrides,
  };
}

function renderCard(
  node: RSIPNode,
  onMarkExecuted = vi.fn(),
  onMarkViolated = vi.fn(),
) {
  render(
    <RSIPStrictModeCard
      node={node}
      descendantCount={0}
      failureCost={1}
      onMarkExecuted={onMarkExecuted}
      onMarkViolated={onMarkViolated}
    />,
  );

  return { onMarkExecuted, onMarkViolated };
}

describe('RSIPStrictModeCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 7, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['E0', '→ E1'],
    ['E2', '已内化'],
  ] as const)('在 %s 阶段展示连续与累计执行数据', (phase, status) => {
    renderCard(createNode({ stabilityPhase: phase }));

    expect(screen.getByText('连续执行进度')).toBeInTheDocument();
    expect(screen.getByText('连续 2 天 · 累计 8 天')).toBeInTheDocument();
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it('当天已经执行时禁用按钮并显示今日状态', () => {
    const onMarkExecuted = vi.fn();
    renderCard(
      createNode({ lastExecutedAt: new Date(2026, 8, 7, 8) }),
      onMarkExecuted,
    );

    const button = screen.getByRole('button', { name: '今日已执行' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onMarkExecuted).not.toHaveBeenCalled();
  });

  it('上次执行是昨天时直接记录本次执行', () => {
    const onMarkExecuted = vi.fn();
    renderCard(
      createNode({ lastExecutedAt: new Date(2026, 8, 6, 8) }),
      onMarkExecuted,
    );

    fireEvent.click(screen.getByRole('button', { name: '已执行' }));

    expect(onMarkExecuted).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('dialog', { name: '连续执行已中断' }),
    ).not.toBeInTheDocument();
  });

  it('首次执行时不弹出中断确认', () => {
    const onMarkExecuted = vi.fn();
    renderCard(
      createNode({ lastExecutedAt: undefined, consecutiveExecutions: 0 }),
      onMarkExecuted,
    );

    fireEvent.click(screen.getByRole('button', { name: '已执行' }));

    expect(onMarkExecuted).toHaveBeenCalledOnce();
    expect(screen.queryByText('连续执行已中断')).not.toBeInTheDocument();
  });

  it('漏日后先确认，取消不执行，确认后只执行一次', () => {
    const onMarkExecuted = vi.fn();
    renderCard(
      createNode({ lastExecutedAt: new Date(2026, 8, 5, 8) }),
      onMarkExecuted,
    );

    fireEvent.click(screen.getByRole('button', { name: '已执行' }));

    expect(
      screen.getByRole('dialog', { name: '连续执行已中断' }),
    ).toBeInTheDocument();
    expect(onMarkExecuted).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByText('连续执行已中断')).not.toBeInTheDocument();
    expect(onMarkExecuted).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '已执行' }));
    fireEvent.click(screen.getByRole('button', { name: '确认执行' }));

    expect(screen.queryByText('连续执行已中断')).not.toBeInTheDocument();
    expect(onMarkExecuted).toHaveBeenCalledOnce();
  });
});
