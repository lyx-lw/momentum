import { describe, expect, it } from 'vitest';
import { rsipMetaRowSchema, rsipNodeRowSchema } from '../rsipRowSchema';

const validNodeRow = {
  id: 'node-1',
  parent_id: null,
  title: '晨间冥想',
  rule: '每天起床后坐 10 分钟冥想',
  sort_order: 100,
  created_at: '2026-01-01T00:00:00Z',
  use_timer: true,
  timer_minutes: 10,
  requires_daily_execution: false,
  stability_phase: 'E1',
  phase_started_at: '2026-01-01T00:00:00Z',
  last_executed_at: '2026-07-07T08:00:00Z',
  last_violated_at: null,
  consecutive_executions: 5,
  consecutive_violations: 0,
  total_executions: 30,
  total_violations: 2,
  user_id: 'user-1',
};

describe('rsipNodeRowSchema', () => {
  it('accepts a valid RSIP node row', () => {
    const result = rsipNodeRowSchema.safeParse(validNodeRow);
    expect(result.success).toBe(true);
    expect(result.data?.requires_daily_execution).toBe(false);
  });

  it('accepts a minimal node row (only required fields)', () => {
    const result = rsipNodeRowSchema.safeParse({
      id: 'node-2',
      parent_id: null,
      title: '跑步',
      rule: '每天跑 3 公里',
      sort_order: 200,
      created_at: null,
      phase_started_at: null,
      last_executed_at: null,
      last_violated_at: null,
      user_id: 'user-1',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a nullable execution frequency column for legacy rows', () => {
    const result = rsipNodeRowSchema.safeParse({
      ...validNodeRow,
      requires_daily_execution: null,
    });
    expect(result.success).toBe(true);
    expect(result.data?.requires_daily_execution).toBeNull();
  });

  it('rejects a row missing user_id', () => {
    const { user_id: _uid, ...withoutUserId } = validNodeRow;
    expect(rsipNodeRowSchema.safeParse(withoutUserId).success).toBe(false);
  });

  it('rejects a row where sort_order is a string', () => {
    const result = rsipNodeRowSchema.safeParse({
      ...validNodeRow,
      sort_order: 'top',
    });
    expect(result.success).toBe(false);
  });
});

describe('rsipMetaRowSchema', () => {
  it('accepts a valid RSIP meta row', () => {
    const result = rsipMetaRowSchema.safeParse({
      user_id: 'user-1',
      last_added_at: '2026-07-01T00:00:00Z',
      allow_multiple_per_day: false,
      tree_open_streak: 3,
      daily_tree_open_required: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a row missing allow_multiple_per_day', () => {
    const result = rsipMetaRowSchema.safeParse({
      user_id: 'user-1',
      last_added_at: null,
    });
    expect(result.success).toBe(false);
  });
});
