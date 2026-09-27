import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RSIPForm } from '../RSIPForm';

function renderForm(canConfigureExecutionFrequency: boolean) {
  render(
    <RSIPForm
      tree={[]}
      meta={{ allowMultiplePerDay: true }}
      canAddToday={true}
      selectedParentId={undefined}
      setSelectedParentId={vi.fn()}
      title="Policy"
      setTitle={vi.fn()}
      rule="Rule"
      setRule={vi.fn()}
      createUseTimer={false}
      setCreateUseTimer={vi.fn()}
      createTimerMinutes={15}
      setCreateTimerMinutes={vi.fn()}
      createType="policy"
      setCreateType={vi.fn()}
      setCreateEmoji={vi.fn()}
      createRequiresDailyExecution={true}
      setCreateRequiresDailyExecution={vi.fn()}
      canConfigureExecutionFrequency={canConfigureExecutionFrequency}
      onAdd={vi.fn()}
      language="zh-CN"
      tr={(zh) => zh}
    />,
  );
}

describe('RSIPForm execution frequency capability', () => {
  it('shows the setting for local storage', () => {
    renderForm(true);

    expect(
      screen.getByRole('checkbox', { name: '需要每日执行' }),
    ).toBeInTheDocument();
  });

  it('hides the setting when the storage cannot persist it', () => {
    renderForm(false);

    expect(
      screen.queryByRole('checkbox', { name: '需要每日执行' }),
    ).not.toBeInTheDocument();
  });
});
