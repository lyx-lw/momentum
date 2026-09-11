import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChainDetailHeader } from '../ChainDetailHeader';

describe('ChainDetailHeader mobile layout', () => {
  it('stacks the title and actions without compressing button labels', () => {
    render(
      <ChainDetailHeader
        chainName="1"
        tr={(zh) => zh}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    const header = screen.getByRole('banner');
    const editButton = screen.getByRole('button', { name: '编辑链条' });
    const deleteButton = screen.getByRole('button', { name: '删除' });
    const actions = editButton.parentElement;

    expect(header).toHaveClass('flex-col', 'sm:flex-row');
    expect(actions).toHaveClass('w-full', 'sm:w-auto');
    expect(editButton).toHaveClass('flex-1', 'whitespace-nowrap');
    expect(deleteButton).toHaveClass('flex-1', 'whitespace-nowrap');
  });
});
