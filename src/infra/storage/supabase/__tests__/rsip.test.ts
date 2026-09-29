import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getRSIPNodes,
  saveRSIPNodes,
  getRSIPMeta,
  saveRSIPMeta,
  getRSIPGroups,
  getRSIPExecutionRecords,
  getRSIPPolicyLibrary,
  saveRSIPPolicyLibrary,
} from '../rsip';
import {
  createMockContext,
  createMockQueryBuilder,
  createSupabaseError,
} from './testHelpers';
import type { RSIPNode, RSIPMeta } from '../../../../types';

vi.mock('../../../../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    dbOperation: vi.fn(),
  },
}));

const createMockRSIPNodeRow = (
  overrides: Partial<Record<string, unknown>> = {},
) => ({
  id: 'rsip-1',
  parent_id: null,
  title: 'Morning Routine',
  rule: 'Wake up at 6am every day',
  sort_order: 1,
  created_at: '2024-01-01T00:00:00Z',
  use_timer: true,
  timer_minutes: 30,
  user_id: 'test-user-123',
  ...overrides,
});

const createMockRSIPMetaRow = (
  overrides: Partial<Record<string, unknown>> = {},
) => ({
  user_id: 'test-user-123',
  last_added_at: '2024-01-15T10:00:00Z',
  allow_multiple_per_day: false,
  ...overrides,
});

describe('rsip.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRSIPNodes', () => {
    it('should return empty array when user is not authenticated', async () => {
      const ctx = createMockContext({ user: null });

      const result = await getRSIPNodes(ctx);

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      const queryBuilder = createMockQueryBuilder({
        data: null,
        error: createSupabaseError('UNKNOWN', 'Database error'),
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPNodes(ctx);

      expect(result).toEqual([]);
    });

    it('should return mapped RSIP nodes on success', async () => {
      const mockData = [createMockRSIPNodeRow()];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPNodes(ctx);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('rsip-1');
      expect(result[0].title).toBe('Morning Routine');
      expect(result[0].rule).toBe('Wake up at 6am every day');
      expect(result[0].sortOrder).toBe(1);
      expect(result[0].useTimer).toBe(true);
      expect(result[0].timerMinutes).toBe(30);
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });

    it('should handle nodes with parent relationships', async () => {
      const mockData = [
        createMockRSIPNodeRow({ id: 'parent', parent_id: null }),
        createMockRSIPNodeRow({ id: 'child', parent_id: 'parent' }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPNodes(ctx);

      expect(result).toHaveLength(2);
      expect(result[0].parentId).toBeUndefined();
      expect(result[1].parentId).toBe('parent');
    });

    it('should handle nodes without timer settings', async () => {
      const mockData = [
        createMockRSIPNodeRow({
          use_timer: null,
          timer_minutes: null,
        }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPNodes(ctx);

      expect(result[0].useTimer).toBe(false);
      expect(result[0].timerMinutes).toBeUndefined();
    });

    it('should handle empty parent_id string as undefined', async () => {
      const mockData = [createMockRSIPNodeRow({ parent_id: '' })];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPNodes(ctx);

      expect(result[0].parentId).toBeUndefined();
    });

    it('defaults missing or null execution frequency to daily', async () => {
      const queryBuilder = createMockQueryBuilder({
        data: [
          createMockRSIPNodeRow({ id: 'missing-frequency' }),
          createMockRSIPNodeRow({
            id: 'null-frequency',
            requires_daily_execution: null,
          }),
          createMockRSIPNodeRow({
            id: 'non-daily',
            requires_daily_execution: false,
          }),
        ],
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPNodes(ctx);

      expect(result.map((node) => node.requiresDailyExecution)).toEqual([
        true,
        true,
        false,
      ]);
    });
  });

  describe('getRSIPPolicyLibrary', () => {
    it('defaults legacy entries to daily and preserves explicit false', async () => {
      const queryBuilder = createMockQueryBuilder({
        data: [
          {
            id: 'legacy',
            title: 'Legacy',
            rule: 'Rule',
            cumulative_execution_days: 1,
            internalization_progress: 1,
            last_active_at: '2026-01-01T00:00:00Z',
            times_used: 1,
          },
          {
            id: 'non-daily',
            title: 'Non-daily',
            rule: 'Rule',
            cumulative_execution_days: 1,
            internalization_progress: 1,
            last_active_at: '2026-01-01T00:00:00Z',
            times_used: 1,
            requires_daily_execution: false,
          },
        ],
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const entries = await getRSIPPolicyLibrary(ctx);

      expect(entries.map((entry) => entry.requiresDailyExecution)).toEqual([
        true,
        false,
      ]);
    });
  });

  describe('saveRSIPPolicyLibrary', () => {
    it('persists explicit non-daily frequency', async () => {
      const ctx = createMockContext();
      const insert = vi.fn().mockResolvedValue({ error: null });
      ctx.mockClient.from = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        insert,
      });

      await saveRSIPPolicyLibrary(ctx, [
        {
          id: 'non-daily',
          title: 'Non-daily',
          rule: 'Rule',
          cumulativeExecutionDays: 1,
          internalizationProgress: 1,
          lastActiveAt: new Date('2026-01-01T00:00:00Z'),
          timesUsed: 1,
          requiresDailyExecution: false,
        },
      ]);

      expect(insert).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'non-daily',
          requires_daily_execution: false,
        }),
      ]);
    });
  });

  describe('saveRSIPNodes', () => {
    it('should return early when user is not authenticated', async () => {
      const ctx = createMockContext({ user: null });
      const nodes: RSIPNode[] = [
        {
          id: 'rsip-1',
          title: 'Test',
          rule: 'Test rule',
          sortOrder: 1,
          createdAt: new Date(),
        },
      ];

      await saveRSIPNodes(ctx, nodes);

      expect(ctx.mockClient.from).not.toHaveBeenCalled();
    });

    it('should upsert nodes and delete removed ones', async () => {
      const existingNodes = [{ id: 'rsip-1' }, { id: 'rsip-2' }];
      const ctx = createMockContext();
      let deleteCalled = false;
      let upsertCalled = false;

      ctx.mockClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: existingNodes,
            error: null,
          }),
        }),
        delete: vi.fn().mockImplementation(() => {
          deleteCalled = true;
          return {
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                error: null,
              }),
            }),
          };
        }),
        upsert: vi.fn().mockImplementation(() => {
          upsertCalled = true;
          return { error: null };
        }),
      });

      const nodes: RSIPNode[] = [
        {
          id: 'rsip-1',
          title: 'Test',
          rule: 'Test rule',
          sortOrder: 1,
          createdAt: new Date(),
        },
      ];

      await saveRSIPNodes(ctx, nodes);

      expect(deleteCalled).toBe(true);
      expect(upsertCalled).toBe(true);
    });

    it('should throw error when query fails', async () => {
      const ctx = createMockContext();
      ctx.mockClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: null,
            error: createSupabaseError('UNKNOWN', 'Query failed'),
          }),
        }),
      });

      const nodes: RSIPNode[] = [
        {
          id: 'rsip-1',
          title: 'Test',
          rule: 'Test rule',
          sortOrder: 1,
          createdAt: new Date(),
        },
      ];

      await expect(saveRSIPNodes(ctx, nodes)).rejects.toThrow(
        'Failed to query RSIP nodes',
      );
    });

    it('should throw error when delete fails', async () => {
      const ctx = createMockContext();
      ctx.mockClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: [{ id: 'rsip-old' }],
            error: null,
          }),
        }),
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              error: createSupabaseError('UNKNOWN', 'Delete failed'),
            }),
          }),
        }),
      });

      const nodes: RSIPNode[] = [
        {
          id: 'rsip-new',
          title: 'Test',
          rule: 'Test rule',
          sortOrder: 1,
          createdAt: new Date(),
        },
      ];

      await expect(saveRSIPNodes(ctx, nodes)).rejects.toThrow(
        'Failed to delete removed RSIP nodes',
      );
    });

    it('should throw error when upsert fails', async () => {
      const ctx = createMockContext();
      ctx.mockClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: [],
            error: null,
          }),
        }),
        upsert: vi.fn().mockReturnValue({
          error: createSupabaseError('UNKNOWN', 'Upsert failed'),
        }),
      });

      const nodes: RSIPNode[] = [
        {
          id: 'rsip-1',
          title: 'Test',
          rule: 'Test rule',
          sortOrder: 1,
          createdAt: new Date(),
        },
      ];

      await expect(saveRSIPNodes(ctx, nodes)).rejects.toThrow(
        'Failed to save RSIP nodes',
      );
    });

    it('should surface missing migrated columns without retrying a reduced payload', async () => {
      const ctx = createMockContext();
      const upsert = vi.fn().mockReturnValue({
        error: createSupabaseError(
          'PGRST204',
          "Could not find the 'consecutive_executions' column of 'rsip_nodes' in the schema cache",
        ),
      });

      ctx.mockClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: [],
            error: null,
          }),
        }),
        upsert,
      });

      const nodes: RSIPNode[] = [
        {
          id: 'rsip-1',
          title: 'Test',
          rule: 'Test rule',
          sortOrder: 1,
          createdAt: new Date(),
        },
      ];

      await expect(saveRSIPNodes(ctx, nodes)).rejects.toThrow(
        'Failed to save RSIP nodes',
      );
      expect(upsert).toHaveBeenCalledTimes(1);
      expect(ctx.markSchemaCapabilityMissing).not.toHaveBeenCalled();
    });

    it('should always write complete node columns on subsequent saves', async () => {
      const ctx = createMockContext();
      const upsert = vi.fn().mockReturnValue({ error: null });

      ctx.mockClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: [],
            error: null,
          }),
        }),
        upsert,
      });

      const nodes: RSIPNode[] = [
        {
          id: 'rsip-1',
          title: 'Test',
          rule: 'Test rule',
          sortOrder: 1,
          createdAt: new Date(),
        },
      ];

      await saveRSIPNodes(ctx, nodes);
      await saveRSIPNodes(ctx, nodes);

      expect(upsert).toHaveBeenCalledTimes(2);
      for (const [payload] of upsert.mock.calls) {
        expect(payload[0]).toHaveProperty('consecutive_executions');
      }
      expect(ctx.isSchemaCapabilityMissing).not.toHaveBeenCalled();
    });

    it('should map all fields correctly for upsert', async () => {
      const ctx = createMockContext();
      let upsertData: unknown[] = [];

      ctx.mockClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: [],
            error: null,
          }),
        }),
        upsert: vi.fn().mockImplementation((data: unknown[]) => {
          upsertData = data;
          return { error: null };
        }),
      });

      const nodes: RSIPNode[] = [
        {
          id: 'rsip-1',
          parentId: 'parent-1',
          title: 'Morning Routine',
          rule: 'Wake up at 6am',
          sortOrder: 1,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          useTimer: true,
          timerMinutes: 30,
        },
      ];

      await saveRSIPNodes(ctx, nodes);

      expect(upsertData).toHaveLength(1);
      const record = upsertData[0] as Record<string, unknown>;
      expect(record.id).toBe('rsip-1');
      expect(record.parent_id).toBe('parent-1');
      expect(record.title).toBe('Morning Routine');
      expect(record.rule).toBe('Wake up at 6am');
      expect(record.sort_order).toBe(1);
      expect(record.use_timer).toBe(true);
      expect(record.timer_minutes).toBe(30);
      expect(record.user_id).toBe('test-user-123');
    });

    it('should handle nodes without optional fields', async () => {
      const ctx = createMockContext();
      let upsertData: unknown[] = [];

      ctx.mockClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: [],
            error: null,
          }),
        }),
        upsert: vi.fn().mockImplementation((data: unknown[]) => {
          upsertData = data;
          return { error: null };
        }),
      });

      const nodes: RSIPNode[] = [
        {
          id: 'rsip-1',
          title: 'Test',
          rule: 'Test rule',
          sortOrder: 1,
          createdAt: new Date(),
        },
      ];

      await saveRSIPNodes(ctx, nodes);

      const record = upsertData[0] as Record<string, unknown>;
      expect(record.parent_id).toBeNull();
      expect(record.use_timer).toBe(false);
      expect(record.timer_minutes).toBeNull();
    });

    it('should not delete when no nodes removed', async () => {
      const ctx = createMockContext();
      let deleteCalled = false;

      ctx.mockClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: [{ id: 'rsip-1' }],
            error: null,
          }),
        }),
        delete: vi.fn().mockImplementation(() => {
          deleteCalled = true;
          return {
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                error: null,
              }),
            }),
          };
        }),
        upsert: vi.fn().mockReturnValue({ error: null }),
      });

      const nodes: RSIPNode[] = [
        {
          id: 'rsip-1',
          title: 'Test',
          rule: 'Test rule',
          sortOrder: 1,
          createdAt: new Date(),
        },
      ];

      await saveRSIPNodes(ctx, nodes);

      expect(deleteCalled).toBe(false);
    });
  });

  describe('getRSIPMeta', () => {
    it('should return empty object when user is not authenticated', async () => {
      const ctx = createMockContext({ user: null });

      const result = await getRSIPMeta(ctx);

      expect(result).toEqual({});
    });

    it('should return empty object on error', async () => {
      const queryBuilder = createMockQueryBuilder({
        data: null,
        error: createSupabaseError('UNKNOWN', 'Database error'),
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPMeta(ctx);

      expect(result).toEqual({});
    });

    it('should return empty object when no data exists', async () => {
      const queryBuilder = createMockQueryBuilder({ data: [], error: null });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPMeta(ctx);

      expect(result).toEqual({});
    });

    it('should return mapped RSIP meta on success', async () => {
      const mockData = [createMockRSIPMetaRow()];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPMeta(ctx);

      expect(result.lastAddedAt).toBeInstanceOf(Date);
      expect(result.allowMultiplePerDay).toBe(false);
    });

    it('should handle meta with allowMultiplePerDay true', async () => {
      const mockData = [
        createMockRSIPMetaRow({ allow_multiple_per_day: true }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPMeta(ctx);

      expect(result.allowMultiplePerDay).toBe(true);
    });

    it('should handle meta with null last_added_at', async () => {
      const mockData = [createMockRSIPMetaRow({ last_added_at: null })];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPMeta(ctx);

      expect(result.lastAddedAt).toBeUndefined();
    });
  });

  describe('saveRSIPMeta', () => {
    it('should return early when user is not authenticated', async () => {
      const ctx = createMockContext({ user: null });
      const meta: RSIPMeta = {
        lastAddedAt: new Date(),
        allowMultiplePerDay: true,
      };

      await saveRSIPMeta(ctx, meta);

      expect(ctx.mockClient.from).not.toHaveBeenCalled();
    });

    it('should upsert meta successfully', async () => {
      const ctx = createMockContext();
      let upsertData: Record<string, unknown> = {};

      ctx.mockClient.from = vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          upsertData = data;
          return { error: null };
        }),
      });

      const meta: RSIPMeta = {
        lastAddedAt: new Date('2024-01-15T10:00:00Z'),
        allowMultiplePerDay: true,
      };

      await saveRSIPMeta(ctx, meta);

      expect(upsertData.user_id).toBe('test-user-123');
      expect(upsertData.last_added_at).toBe('2024-01-15T10:00:00.000Z');
      expect(upsertData.allow_multiple_per_day).toBe(true);
    });

    it('should surface missing migrated meta columns without retrying', async () => {
      const ctx = createMockContext();
      const upsert = vi.fn().mockReturnValue({
        error: createSupabaseError(
          'PGRST204',
          "Could not find the 'last_tree_opened_at' column of 'rsip_meta'",
        ),
      });

      ctx.mockClient.from = vi.fn().mockReturnValue({ upsert });

      const meta: RSIPMeta = {
        lastAddedAt: new Date('2024-01-15T10:00:00Z'),
        allowMultiplePerDay: true,
        lastTreeOpenedAt: new Date('2024-01-15T11:00:00Z'),
        dailyTreeOpenRequired: true,
        treeOpenStreak: 3,
      };

      await expect(saveRSIPMeta(ctx, meta)).rejects.toThrow(
        'Failed to save RSIP meta',
      );
      expect(upsert).toHaveBeenCalledTimes(1);
      expect(upsert.mock.calls[0]?.[0]).toHaveProperty('last_tree_opened_at');
      expect(ctx.markSchemaCapabilityMissing).not.toHaveBeenCalled();
    });

    it('should throw error when upsert fails', async () => {
      const ctx = createMockContext();
      ctx.mockClient.from = vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          error: createSupabaseError('UNKNOWN', 'Upsert failed'),
        }),
      });

      const meta: RSIPMeta = {
        lastAddedAt: new Date(),
        allowMultiplePerDay: true,
      };

      await expect(saveRSIPMeta(ctx, meta)).rejects.toThrow(
        'Failed to save RSIP meta',
      );
    });

    it('should handle empty meta', async () => {
      const ctx = createMockContext();
      let upsertData: Record<string, unknown> = {};

      ctx.mockClient.from = vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          upsertData = data;
          return { error: null };
        }),
      });

      const meta: RSIPMeta = {};

      await saveRSIPMeta(ctx, meta);

      expect(upsertData.last_added_at).toBeNull();
      expect(upsertData.allow_multiple_per_day).toBe(false);
    });

    it('should handle meta with only allowMultiplePerDay', async () => {
      const ctx = createMockContext();
      let upsertData: Record<string, unknown> = {};

      ctx.mockClient.from = vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          upsertData = data;
          return { error: null };
        }),
      });

      const meta: RSIPMeta = {
        allowMultiplePerDay: false,
      };

      await saveRSIPMeta(ctx, meta);

      expect(upsertData.last_added_at).toBeNull();
      expect(upsertData.allow_multiple_per_day).toBe(false);
    });
  });

  describe('getRSIPGroups', () => {
    it('should return mapped groups on success', async () => {
      const queryBuilder = createMockQueryBuilder({
        data: [
          {
            id: 'group-1',
            title: 'Group A',
            fault_tolerance: 2,
            emoji: '🧭',
            created_at: '2024-02-01T00:00:00Z',
          },
        ],
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPGroups(ctx);

      expect(result).toEqual([
        {
          id: 'group-1',
          title: 'Group A',
          faultTolerance: 2,
          emoji: '🧭',
          createdAt: new Date('2024-02-01T00:00:00Z'),
        },
      ]);
    });
  });

  describe('getRSIPExecutionRecords', () => {
    it('should return mapped execution records on success', async () => {
      const queryBuilder = createMockQueryBuilder({
        data: [
          {
            id: 'record-1',
            node_id: 'node-1',
            executed_at: '2024-03-01T09:00:00Z',
            status: 'completed',
            notes: 'done',
            reason_code: 'ok',
            repair_hint: 'none',
            source_chain_id: 'chain-1',
            source_event: 'manual',
          },
        ],
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPExecutionRecords(ctx);

      expect(result).toEqual([
        {
          id: 'record-1',
          userId: 'test-user-123',
          nodeId: 'node-1',
          executedAt: new Date('2024-03-01T09:00:00Z'),
          status: 'completed',
          notes: 'done',
          reasonCode: 'ok',
          repairHint: 'none',
          sourceChainId: 'chain-1',
          sourceEvent: 'manual',
        },
      ]);
    });
  });
});
