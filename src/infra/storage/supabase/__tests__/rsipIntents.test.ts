import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendRSIPRunRecord,
  removeRSIPNodes,
  upsertRSIPLibraryEntry,
  upsertRSIPNode,
} from '../rsipIntents';
import { createMockContext, createSupabaseError } from './testHelpers';

describe('supabase/rsipIntents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts or updates a single RSIP node with onConflict id', async () => {
    const ctx = createMockContext();
    const upsert = vi.fn().mockReturnValue({ error: null });

    ctx.mockClient.from = vi.fn().mockReturnValue({ upsert });

    await upsertRSIPNode(ctx, {
      id: 'node-1',
      title: 'Node',
      rule: 'Rule',
      sortOrder: 0,
      createdAt: new Date('2026-03-07T00:00:00.000Z'),
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'node-1',
        title: 'Node',
        user_id: 'test-user-123',
      }),
      { onConflict: 'id' },
    );
  });

  it('surfaces missing migrated node columns without retrying', async () => {
    const ctx = createMockContext();
    const upsert = vi.fn().mockReturnValue({
      error: createSupabaseError(
        'PGRST204',
        "Could not find the 'consecutive_executions' column",
      ),
    });
    ctx.mockClient.from = vi.fn().mockReturnValue({ upsert });

    await expect(
      upsertRSIPNode(ctx, {
        id: 'node-1',
        title: 'Node',
        rule: 'Rule',
        sortOrder: 0,
        createdAt: new Date('2026-03-07T00:00:00.000Z'),
      }),
    ).rejects.toThrow('Failed to upsert RSIP node');

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0]?.[0]).toHaveProperty('consecutive_executions');
    expect(ctx.markSchemaCapabilityMissing).not.toHaveBeenCalled();
  });

  it('removes multiple RSIP nodes in one delete call', async () => {
    const ctx = createMockContext();
    const eq = vi.fn().mockResolvedValue({ error: null });
    const inMock = vi.fn().mockReturnValue({ eq });
    const deleteMock = vi.fn().mockReturnValue({ in: inMock });

    ctx.mockClient.from = vi.fn().mockReturnValue({ delete: deleteMock });

    await removeRSIPNodes(ctx, ['node-1', 'node-2']);

    expect(inMock).toHaveBeenCalledWith('id', ['node-1', 'node-2']);
    expect(eq).toHaveBeenCalledWith('user_id', 'test-user-123');
  });

  it('inserts or updates RSIP library entries against the composite key', async () => {
    const ctx = createMockContext();
    const upsert = vi.fn().mockReturnValue({ error: null });

    ctx.mockClient.from = vi.fn().mockReturnValue({ upsert });

    await upsertRSIPLibraryEntry(ctx, {
      id: 'library-1',
      title: 'Library',
      rule: 'Rule',
      cumulativeExecutionDays: 1,
      internalizationProgress: 1,
      lastActiveAt: new Date('2026-03-07T00:00:00.000Z'),
      timesUsed: 1,
      requiresDailyExecution: false,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'library-1',
        title: 'Library',
        user_id: 'test-user-123',
        requires_daily_execution: false,
      }),
      { onConflict: 'user_id,id' },
    );
  });

  it('appends RSIP run records and surfaces insert failures', async () => {
    const ctx = createMockContext();
    const insert = vi
      .fn()
      .mockReturnValueOnce({
        error: createSupabaseError('UNKNOWN', 'insert failed'),
      })
      .mockReturnValueOnce({ error: null });

    ctx.mockClient.from = vi.fn().mockReturnValue({ insert });

    await expect(
      appendRSIPRunRecord(ctx, {
        runNumber: 1,
        startedAt: new Date('2026-03-07T00:00:00.000Z'),
        maxNodeCount: 1,
        durationDays: 1,
      }),
    ).rejects.toThrow('Failed to append rsip run history record');

    await expect(
      appendRSIPRunRecord(ctx, {
        runNumber: 2,
        startedAt: new Date('2026-03-08T00:00:00.000Z'),
        maxNodeCount: 2,
        durationDays: 1,
      }),
    ).resolves.toBeUndefined();
  });
});
