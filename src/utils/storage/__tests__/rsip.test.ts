import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../keys';
import {
  appendRSIPExecutionRecord,
  appendRSIPRunRecord,
  getRSIPExecutionRecords,
  getRSIPGroups,
  getRSIPMeta,
  getRSIPNodes,
  getRSIPPolicyLibrary,
  getRSIPRunHistory,
  getRSIPTaskLinks,
  removeRSIPNodes,
  saveRSIPGroups,
  saveRSIPMeta,
  saveRSIPNodes,
  saveRSIPPolicyLibrary,
  saveRSIPRunHistory,
  saveRSIPTaskLinks,
  upsertRSIPLibraryEntry,
  upsertRSIPNode,
} from '../rsip';

describe('storage/rsip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty RSIP nodes when storage is empty', () => {
    expect(getRSIPNodes()).toEqual([]);
  });

  it('hydrates RSIP node createdAt as Date', () => {
    localStorage.setItem(
      STORAGE_KEYS.RSIP_NODES,
      JSON.stringify([
        {
          id: 'node-1',
          title: 'Rule',
          rule: 'Do it',
          sortOrder: 0,
          createdAt: '2026-02-01T00:00:00.000Z',
        },
      ]),
    );

    const [node] = getRSIPNodes();
    expect(node.id).toBe('node-1');
    expect(node.createdAt).toBeInstanceOf(Date);
  });

  it('defaults legacy nodes to daily and round-trips non-daily nodes', () => {
    localStorage.setItem(
      STORAGE_KEYS.RSIP_NODES,
      JSON.stringify([
        {
          id: 'legacy-node',
          title: 'Legacy',
          rule: 'Old data',
          sortOrder: 0,
          createdAt: '2026-02-01T00:00:00.000Z',
        },
      ]),
    );

    const [legacyNode] = getRSIPNodes();
    expect(legacyNode.requiresDailyExecution).toBe(true);

    saveRSIPNodes([
      {
        ...legacyNode,
        id: 'non-daily-node',
        requiresDailyExecution: false,
      },
    ]);

    expect(getRSIPNodes()[0]?.requiresDailyExecution).toBe(false);
  });

  it('hydrates optional RSIP node dates when stored as strings', () => {
    localStorage.setItem(
      STORAGE_KEYS.RSIP_NODES,
      JSON.stringify([
        {
          id: 'node-with-optional-dates',
          title: 'Rule',
          rule: 'Do it',
          sortOrder: 0,
          createdAt: '2026-02-01T00:00:00.000Z',
          phaseStartedAt: '2026-02-02T00:00:00.000Z',
          lastExecutedAt: '2026-02-03T00:00:00.000Z',
          lastViolatedAt: '2026-02-04T00:00:00.000Z',
        },
        {
          id: 'node-without-optional-dates',
          title: 'Fallback Rule',
          rule: 'Skip it',
          sortOrder: 1,
          createdAt: '2026-02-01T00:00:00.000Z',
          phaseStartedAt: 123,
          lastExecutedAt: null,
          lastViolatedAt: {},
        },
      ]),
    );

    const [node, fallbackNode] = getRSIPNodes();

    expect(node.phaseStartedAt).toEqual(new Date('2026-02-02T00:00:00.000Z'));
    expect(node.lastExecutedAt).toEqual(new Date('2026-02-03T00:00:00.000Z'));
    expect(node.lastViolatedAt).toEqual(new Date('2026-02-04T00:00:00.000Z'));
    expect(fallbackNode.phaseStartedAt).toBeUndefined();
    expect(fallbackNode.lastExecutedAt).toBeUndefined();
    expect(fallbackNode.lastViolatedAt).toBeUndefined();
  });

  it('saves RSIP nodes JSON', () => {
    saveRSIPNodes([
      {
        id: 'node-2',
        title: 'Saved',
        rule: 'Persist',
        sortOrder: 1,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    ]);

    expect(localStorage.getItem(STORAGE_KEYS.RSIP_NODES)).toContain('node-2');
  });

  it('inserts, updates, and removes RSIP nodes incrementally', () => {
    saveRSIPNodes([
      {
        id: 'node-1',
        title: 'Original',
        rule: 'Keep',
        sortOrder: 0,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      },
      {
        id: 'node-2',
        title: 'Second',
        rule: 'Remove me',
        sortOrder: 1,
        createdAt: new Date('2026-02-02T00:00:00.000Z'),
      },
    ]);

    upsertRSIPNode({
      id: 'node-1',
      title: 'Updated',
      rule: 'Keep updated',
      sortOrder: 0,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    upsertRSIPNode({
      id: 'node-3',
      title: 'Third',
      rule: 'Added',
      sortOrder: 2,
      createdAt: new Date('2026-02-03T00:00:00.000Z'),
    });
    removeRSIPNodes(['node-2']);

    expect(getRSIPNodes()).toEqual([
      expect.objectContaining({ id: 'node-1', title: 'Updated' }),
      expect.objectContaining({ id: 'node-3', title: 'Third' }),
    ]);
  });

  it('returns default empty meta when storage is missing', () => {
    expect(getRSIPMeta()).toEqual({});
  });

  it('hydrates meta lastAddedAt and strict/free mode flag', () => {
    localStorage.setItem(
      STORAGE_KEYS.RSIP_META,
      JSON.stringify({
        lastAddedAt: '2026-02-02T00:00:00.000Z',
        allowMultiplePerDay: true,
      }),
    );

    const meta = getRSIPMeta();
    expect(meta.lastAddedAt).toBeInstanceOf(Date);
    expect(meta.allowMultiplePerDay).toBe(true);
  });

  it('serializes meta dates with safe boolean fallback', () => {
    saveRSIPMeta({
      lastAddedAt: new Date('2026-02-03T00:00:00.000Z'),
      allowMultiplePerDay: undefined,
    });

    const raw = localStorage.getItem(STORAGE_KEYS.RSIP_META);
    expect(raw).toContain('2026-02-03T00:00:00.000Z');
    expect(raw).toContain('"allowMultiplePerDay":false');
  });

  it('returns empty arrays for RSIP group/library/history/link/execution storage when missing', () => {
    expect(getRSIPGroups()).toEqual([]);
    expect(getRSIPPolicyLibrary()).toEqual([]);
    expect(getRSIPRunHistory()).toEqual([]);
    expect(getRSIPTaskLinks()).toEqual([]);
    expect(getRSIPExecutionRecords()).toEqual([]);
  });

  it('hydrates and saves RSIP groups with createdAt fallback when date is invalid', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T09:30:00.000Z'));
    localStorage.setItem(
      STORAGE_KEYS.RSIP_GROUPS,
      JSON.stringify([
        {
          id: 'group-valid',
          title: 'Valid Group',
          faultTolerance: 2,
          createdAt: '2026-02-05T00:00:00.000Z',
        },
        {
          id: 'group-fallback',
          title: 'Fallback Group',
          faultTolerance: 0,
          createdAt: 'not-a-date',
        },
      ]),
    );

    const groups = getRSIPGroups();
    expect(groups[0]?.createdAt).toEqual(new Date('2026-02-05T00:00:00.000Z'));
    expect(groups[1]?.createdAt).toEqual(new Date('2026-03-07T09:30:00.000Z'));

    localStorage.removeItem(STORAGE_KEYS.RSIP_GROUPS);
    saveRSIPGroups(groups);
    expect(localStorage.getItem(STORAGE_KEYS.RSIP_GROUPS)).toContain(
      'group-valid',
    );
  });

  it('hydrates and saves RSIP policy library entries with lastActiveAt fallback', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T10:00:00.000Z'));
    localStorage.setItem(
      STORAGE_KEYS.RSIP_POLICY_LIBRARY,
      JSON.stringify([
        {
          id: 'library-valid',
          title: 'Library Entry',
          rule: 'Persist',
          cumulativeExecutionDays: 12,
          internalizationProgress: 20,
          lastActiveAt: '2026-02-06T00:00:00.000Z',
          timesUsed: 4,
        },
        {
          id: 'library-fallback',
          title: 'Fallback Entry',
          rule: 'Fallback',
          cumulativeExecutionDays: 1,
          internalizationProgress: 2,
          lastActiveAt: null,
          timesUsed: 1,
        },
        {
          id: 'library-non-daily',
          title: 'Non-daily Entry',
          rule: 'Persist',
          cumulativeExecutionDays: 3,
          internalizationProgress: 5,
          lastActiveAt: '2026-02-07T00:00:00.000Z',
          timesUsed: 1,
          requiresDailyExecution: false,
        },
      ]),
    );

    const entries = getRSIPPolicyLibrary();
    expect(entries[0]?.requiresDailyExecution).toBe(true);
    expect(entries[2]?.requiresDailyExecution).toBe(false);
    expect(entries[0]?.lastActiveAt).toEqual(
      new Date('2026-02-06T00:00:00.000Z'),
    );
    expect(entries[1]?.lastActiveAt).toEqual(
      new Date('2026-03-07T10:00:00.000Z'),
    );

    localStorage.removeItem(STORAGE_KEYS.RSIP_POLICY_LIBRARY);
    saveRSIPPolicyLibrary(entries);
    expect(localStorage.getItem(STORAGE_KEYS.RSIP_POLICY_LIBRARY)).toContain(
      'library-valid',
    );
  });

  it('inserts or updates RSIP policy library entries incrementally', () => {
    saveRSIPPolicyLibrary([
      {
        id: 'library-1',
        title: 'Original entry',
        rule: 'Original rule',
        cumulativeExecutionDays: 10,
        internalizationProgress: 16.67,
        lastActiveAt: new Date('2026-02-06T00:00:00.000Z'),
        timesUsed: 1,
      },
    ]);

    upsertRSIPLibraryEntry({
      id: 'library-1',
      title: 'Updated entry',
      rule: 'Updated rule',
      cumulativeExecutionDays: 12,
      internalizationProgress: 20,
      lastActiveAt: new Date('2026-03-07T10:00:00.000Z'),
      timesUsed: 2,
    });
    upsertRSIPLibraryEntry({
      id: 'library-2',
      title: 'Second entry',
      rule: 'Second rule',
      cumulativeExecutionDays: 4,
      internalizationProgress: 6.67,
      lastActiveAt: new Date('2026-03-07T11:00:00.000Z'),
      timesUsed: 1,
    });

    expect(getRSIPPolicyLibrary()).toEqual([
      expect.objectContaining({ id: 'library-1', title: 'Updated entry' }),
      expect.objectContaining({ id: 'library-2', title: 'Second entry' }),
    ]);
  });

  it('hydrates and saves RSIP run history with endedAt preserved and invalid startedAt fallback', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T11:00:00.000Z'));
    localStorage.setItem(
      STORAGE_KEYS.RSIP_RUN_HISTORY,
      JSON.stringify([
        {
          runNumber: 1,
          startedAt: '2026-02-01T00:00:00.000Z',
          endedAt: '2026-02-10T00:00:00.000Z',
          maxNodeCount: 5,
          durationDays: 9,
        },
        {
          runNumber: 2,
          startedAt: 'invalid-start',
          endedAt: 'invalid-end',
          maxNodeCount: 2,
          durationDays: 1,
        },
      ]),
    );

    const records = getRSIPRunHistory();
    expect(records[0]?.startedAt).toEqual(new Date('2026-02-01T00:00:00.000Z'));
    expect(records[0]?.endedAt).toEqual(new Date('2026-02-10T00:00:00.000Z'));
    expect(records[1]?.startedAt).toEqual(new Date('2026-03-07T11:00:00.000Z'));
    expect(records[1]?.endedAt).toBeUndefined();

    localStorage.removeItem(STORAGE_KEYS.RSIP_RUN_HISTORY);
    saveRSIPRunHistory(records);
    expect(localStorage.getItem(STORAGE_KEYS.RSIP_RUN_HISTORY)).toContain(
      '"runNumber":1',
    );
  });

  it('appends RSIP run records to the front of history', () => {
    saveRSIPRunHistory([
      {
        runNumber: 1,
        startedAt: new Date('2026-02-01T00:00:00.000Z'),
        endedAt: new Date('2026-02-02T00:00:00.000Z'),
        maxNodeCount: 3,
        durationDays: 1,
      },
    ]);

    appendRSIPRunRecord({
      runNumber: 2,
      startedAt: new Date('2026-03-07T12:00:00.000Z'),
      endedAt: new Date('2026-03-08T12:00:00.000Z'),
      maxNodeCount: 5,
      durationDays: 1,
    });

    expect(getRSIPRunHistory()).toEqual([
      expect.objectContaining({ runNumber: 2 }),
      expect.objectContaining({ runNumber: 1 }),
    ]);
  });

  it('hydrates and saves RSIP task links with updatedAt fallback', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T12:00:00.000Z'));
    localStorage.setItem(
      STORAGE_KEYS.RSIP_TASK_LINKS,
      JSON.stringify([
        {
          id: 'link-valid',
          rsipNodeId: 'node-1',
          chainId: 'chain-1',
          chainKind: 'unit',
          triggerEvent: 'task_completed',
          effect: 'mark_rsip_executed',
          automation: 'confirm',
          isActive: true,
          updatedAt: '2026-02-08T00:00:00.000Z',
        },
        {
          id: 'link-fallback',
          rsipNodeId: 'node-2',
          chainId: 'chain-2',
          chainKind: 'group',
          triggerEvent: 'group_cycle_completed',
          effect: 'mark_rsip_violated',
          automation: 'auto',
          isActive: false,
          updatedAt: {},
        },
      ]),
    );

    const links = getRSIPTaskLinks();
    expect(links[0]?.updatedAt).toEqual(new Date('2026-02-08T00:00:00.000Z'));
    expect(links[1]?.updatedAt).toEqual(new Date('2026-03-07T12:00:00.000Z'));

    localStorage.removeItem(STORAGE_KEYS.RSIP_TASK_LINKS);
    saveRSIPTaskLinks(links);
    expect(localStorage.getItem(STORAGE_KEYS.RSIP_TASK_LINKS)).toContain(
      'link-valid',
    );
  });

  it('hydrates execution records and appends a new record', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T13:00:00.000Z'));
    localStorage.setItem(
      STORAGE_KEYS.RSIP_EXECUTION_RECORDS,
      JSON.stringify([
        {
          id: 'record-valid',
          nodeId: 'node-1',
          executedAt: '2026-02-09T00:00:00.000Z',
          status: 'executed',
        },
        {
          id: 'record-fallback',
          nodeId: 'node-2',
          executedAt: [],
          status: 'violated',
        },
      ]),
    );

    const records = getRSIPExecutionRecords();
    expect(records[0]?.executedAt).toEqual(
      new Date('2026-02-09T00:00:00.000Z'),
    );
    expect(records[1]?.executedAt).toEqual(
      new Date('2026-03-07T13:00:00.000Z'),
    );

    appendRSIPExecutionRecord({
      id: 'record-appended',
      nodeId: 'node-3',
      executedAt: new Date('2026-03-07T13:30:00.000Z'),
      status: 'skipped',
    });

    const appended = getRSIPExecutionRecords();
    expect(appended).toHaveLength(3);
    expect(appended[2]).toMatchObject({
      id: 'record-appended',
      nodeId: 'node-3',
      status: 'skipped',
    });
    expect(appended[2]?.executedAt).toEqual(
      new Date('2026-03-07T13:30:00.000Z'),
    );
  });
});
