import { describe, expect, it } from 'vitest';
import type { RSIPNode } from '../../../../types';
import {
  hasExecutedToday,
  nextExecutionStreak,
  willResetExecutionStreak,
} from '../dailyRules';

function createNode(overrides: Partial<RSIPNode> = {}): RSIPNode {
  return {
    id: 'node-1',
    title: 'Policy',
    rule: 'Rule',
    sortOrder: 1,
    createdAt: new Date(2026, 8, 1, 12),
    ...overrides,
  };
}

describe('RSIP execution frequency rules', () => {
  it('keeps a non-daily policy progress after a missed calendar day', () => {
    const now = new Date(2026, 8, 3, 12);
    const node = createNode({
      requiresDailyExecution: false,
      lastExecutedAt: new Date(2026, 8, 1, 12),
      consecutiveExecutions: 4,
    });

    expect(nextExecutionStreak(node, now)).toBe(5);
    expect(willResetExecutionStreak(node, now)).toBe(false);
  });

  it('keeps daily policy reset behavior after a missed calendar day', () => {
    const node = createNode({
      requiresDailyExecution: true,
      lastExecutedAt: new Date(2026, 8, 1, 12),
      consecutiveExecutions: 4,
    });

    expect(nextExecutionStreak(node, new Date(2026, 8, 3, 12))).toBe(1);
    expect(willResetExecutionStreak(node, new Date(2026, 8, 3, 12))).toBe(
      true,
    );
  });

  it('treats a missing frequency as daily and still prevents same-day repeats', () => {
    const today = new Date(2026, 8, 3, 12);
    const legacyNode = createNode({
      lastExecutedAt: new Date(2026, 8, 1, 12),
      consecutiveExecutions: 4,
    });

    expect(nextExecutionStreak(legacyNode, today)).toBe(1);
    expect(willResetExecutionStreak(legacyNode, today)).toBe(true);
    expect(hasExecutedToday({ ...legacyNode, lastExecutedAt: today }, today)).toBe(
      true,
    );
  });
});

