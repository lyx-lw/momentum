import { describe, expect, it } from 'vitest';
import type { CompletionHistory, UnitChain } from '../../../types';
import type { WeeklyDateRange } from '../dateRange';
import { buildWeeklyExport } from '../buildWeeklyExport';

const range: WeeklyDateRange = {
  start: new Date(2026, 8, 21),
  endExclusive: new Date(2026, 8, 28),
  isPartialPeriod: true,
};

function makeChain(overrides: Partial<UnitChain> = {}): UnitChain {
  return {
    id: 'chain-1',
    type: 'unit',
    sortOrder: 0,
    name: '任务链',
    trigger: '开始行动',
    duration: 30,
    description: '任务链描述',
    currentStreak: 0,
    auxiliaryStreak: 0,
    totalCompletions: 0,
    totalFailures: 0,
    auxiliaryFailures: 0,
    exceptions: [],
    auxiliaryExceptions: [],
    auxiliarySignal: '',
    auxiliaryDuration: 0,
    auxiliaryCompletionTrigger: '',
    timeLimitExceptions: [],
    createdAt: new Date(2026, 0, 1),
    ...overrides,
  };
}

function makeRecord(
  chainId: string,
  completedAt: Date,
  overrides: Partial<CompletionHistory> = {},
): CompletionHistory {
  return {
    chainId,
    completedAt,
    duration: 30,
    wasSuccessful: true,
    ...overrides,
  };
}

function build(
  chains: UnitChain[],
  history: CompletionHistory[],
) {
  return buildWeeklyExport({
    chains,
    history,
    range,
    now: new Date(2026, 8, 23, 12),
    timezone: 'Asia/Shanghai',
  });
}

describe('buildWeeklyExport', () => {
  it('uses a left-closed, right-open interval', () => {
    const chain = makeChain();
    const result = build(
      [chain],
      [
        makeRecord(chain.id, new Date(range.start)),
        makeRecord(chain.id, new Date(range.endExclusive)),
      ],
    );

    expect(result).toMatchObject({ ok: true, chainCount: 1, recordCount: 1 });
    if (!result.ok) throw new Error('expected weekly export data');
    expect(result.data.chains[0].records).toHaveLength(1);
    expect(result.data.period).toEqual({
      start: range.start.toISOString(),
      endExclusive: range.endExclusive.toISOString(),
    });
  });

  it('preserves successful and interrupted record details', () => {
    const chain = makeChain();
    const result = build(
      [chain],
      [
        makeRecord(chain.id, new Date(2026, 8, 22, 8), {
          description: '完成实现',
          notes: '保留备注',
          actualDuration: 25,
          isForwardTimed: false,
        }),
        makeRecord(chain.id, new Date(2026, 8, 22, 9), {
          wasSuccessful: false,
          reasonForFailure: '用户主动中断',
        }),
      ],
    );

    if (!result.ok) throw new Error('expected weekly export data');
    expect(result.data.chains[0].records).toEqual([
      expect.objectContaining({
        description: '完成实现',
        notes: '保留备注',
        actualDuration: 25,
        isForwardTimed: false,
      }),
      expect.objectContaining({
        wasSuccessful: false,
        reasonForFailure: '用户主动中断',
      }),
    ]);
  });

  it('groups only active chains and supplies a root-to-current path', () => {
    const parent = makeChain({ id: 'parent', name: '总目标' });
    const child = makeChain({
      id: 'child',
      parentId: parent.id,
      name: '本周工作',
    });
    const inactive = makeChain({ id: 'inactive', name: '无记录任务' });
    const result = build(
      [parent, child, inactive],
      [makeRecord(child.id, new Date(2026, 8, 22))],
    );

    if (!result.ok) throw new Error('expected weekly export data');
    expect(result.data.chains).toHaveLength(1);
    expect(result.data.chains[0].chain.id).toBe(child.id);
    expect(result.data.chains[0].chainPath).toEqual([
      { id: parent.id, name: parent.name },
      { id: child.id, name: child.name },
    ]);
  });

  it('marks soft-deleted chains and preserves their records', () => {
    const deleted = makeChain({
      id: 'deleted',
      deletedAt: new Date(2026, 8, 23),
    });
    const result = build(
      [deleted],
      [makeRecord(deleted.id, new Date(2026, 8, 22))],
    );

    if (!result.ok) throw new Error('expected weekly export data');
    expect(result.data.chains[0].chainState).toBe('deleted');
  });

  it('exports records whose chains were permanently deleted as unresolved', () => {
    const record = makeRecord('missing', new Date(2026, 8, 22));
    const result = build([], [record]);

    if (!result.ok) throw new Error('expected weekly export data');
    expect(result.data.chains).toEqual([]);
    expect(result.data.unresolvedRecords).toEqual([
      expect.objectContaining({ chainId: 'missing' }),
    ]);
    expect(result.recordCount).toBe(1);
  });

  it('terminates cyclic parent paths and emits a warning', () => {
    const first = makeChain({ id: 'first', parentId: 'second' });
    const second = makeChain({ id: 'second', parentId: 'first' });
    const result = build(
      [first, second],
      [makeRecord(first.id, new Date(2026, 8, 22))],
    );

    if (!result.ok) throw new Error('expected weekly export data');
    expect(result.data.chains[0].chainPath).toHaveLength(2);
    expect(result.data.warnings).toEqual([
      { code: 'CHAIN_PATH_CYCLE', chainId: first.id },
    ]);
  });

  it('rejects invalid history timestamps', () => {
    const chain = makeChain();

    expect(build([chain], [makeRecord(chain.id, new Date(Number.NaN))])).toEqual(
      { ok: false, reason: 'invalid-date' },
    );
  });

  it('returns empty when the period has no execution records', () => {
    const chain = makeChain();

    expect(
      build([chain], [makeRecord(chain.id, new Date(2026, 8, 20, 23, 59))]),
    ).toEqual({ ok: false, reason: 'empty' });
  });

  it('sorts groups and their records deterministically', () => {
    const first = makeChain({ id: 'a' });
    const second = makeChain({ id: 'b' });
    const result = build(
      [second, first],
      [
        makeRecord(second.id, new Date(2026, 8, 23, 9)),
        makeRecord(first.id, new Date(2026, 8, 23, 8)),
        makeRecord(first.id, new Date(2026, 8, 22, 8)),
      ],
    );

    if (!result.ok) throw new Error('expected weekly export data');
    expect(result.data.chains.map((group) => group.chain.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(
      result.data.chains[0].records.map((record) => record.completedAt),
    ).toEqual([
      new Date(2026, 8, 22, 8).toISOString(),
      new Date(2026, 8, 23, 8).toISOString(),
    ]);
  });
});
