import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RSIPMeta } from '../../../types';
import { RSIPView } from '../../RSIPView';
import { RSIPFilters } from '../RSIPFilters';
import { RSIPForm } from '../RSIPForm';

vi.mock('../hooks/useRSIPViewModel', () => ({
  useRSIPViewModel: () => ({
    tr: (zh: string) => zh,
    violationDialogNode: null,
  }),
}));

vi.mock('../RSIPTreeTab', () => ({
  RSIPTreeTab: () => <div>mock-tree</div>,
}));

const tr = (zh: string) => zh;

describe('RSIP mobile layout', () => {
  it('keeps tab labels on one line inside a horizontal scroller', () => {
    render(
      <RSIPView
        nodes={[]}
        meta={{} as RSIPMeta}
        onBack={vi.fn()}
        onSaveNodes={vi.fn()}
        onSaveMeta={vi.fn()}
      />,
    );

    const treeTab = screen.getByRole('button', { name: '国策树' });
    const tabs = treeTab.parentElement;

    expect(tabs).toHaveClass('overflow-x-auto');
    for (const name of ['国策树', '国策库', '轮次历史', '高级分析']) {
      expect(screen.getByRole('button', { name })).toHaveClass(
        'shrink-0',
        'whitespace-nowrap',
      );
    }
  });

  it('stacks the daily limit message above a full-width add button', () => {
    render(
      <RSIPForm
        tree={[]}
        meta={{ allowMultiplePerDay: false } as RSIPMeta}
        canAddToday={true}
        selectedParentId={undefined}
        setSelectedParentId={vi.fn()}
        title=""
        setTitle={vi.fn()}
        rule=""
        setRule={vi.fn()}
        createUseTimer={false}
        setCreateUseTimer={vi.fn()}
        createTimerMinutes={15}
        setCreateTimerMinutes={vi.fn()}
        createType="policy"
        setCreateType={vi.fn()}
        setCreateEmoji={vi.fn()}
        onCreateGroup={vi.fn()}
        onAdd={vi.fn()}
        language="zh"
        tr={tr}
      />,
    );

    const addButton = screen.getByRole('button', { name: '新增国策' });
    expect(addButton.parentElement).toHaveClass('flex-col', 'sm:flex-row');
    expect(addButton).toHaveClass(
      'w-full',
      'shrink-0',
      'whitespace-nowrap',
      'sm:w-auto',
    );

    const createGroupButton = screen.getByRole('button', { name: '新建组' });
    expect(createGroupButton.parentElement).toHaveClass(
      'flex-col',
      'sm:flex-row',
    );
    expect(createGroupButton).toHaveClass(
      'w-full',
      'shrink-0',
      'whitespace-nowrap',
      'sm:w-auto',
    );
  });

  it('places type badges in a non-compressing horizontal scroller', () => {
    render(
      <RSIPFilters
        filterType={null}
        onFilterTypeChange={vi.fn()}
        language="zh"
        tr={tr}
      />,
    );

    const filterLabel = screen.getByText('按类型筛选：');
    const controls = filterLabel.parentElement;
    const layout = controls?.parentElement;
    const habitBadge = screen
      .getAllByText('习惯')
      .find((element) => element.tagName === 'DIV');
    if (!habitBadge) throw new Error('Expected the habit type badge');
    const badges = habitBadge.parentElement;

    expect(layout).toHaveClass('flex-col', 'xl:flex-row');
    expect(controls).toHaveClass('flex-wrap');
    expect(badges).toHaveClass('overflow-x-auto');
    expect(habitBadge).toHaveClass('shrink-0', 'whitespace-nowrap');
  });
});
