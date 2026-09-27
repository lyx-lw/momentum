import { describe, expect, it, vi } from 'vitest';
import {
  decodeRSIPExecutionRecord,
  decodeRSIPLibraryEntry,
  decodeRSIPMeta,
  decodeRSIPNode,
  decodeRSIPNodeGroup,
  decodeRSIPRunRecord,
  decodeRSIPTaskLink,
} from '../rsip';

describe('serialization/rsip', () => {
  it('decodes rsip nodes with optional dates', () => {
    const node = decodeRSIPNode({
      id: 'node-1',
      title: 'Rule',
      rule: 'Do it',
      sortOrder: 1,
      createdAt: '2026-02-01T00:00:00.000Z',
      phaseStartedAt: '2026-02-02T00:00:00.000Z',
      lastExecutedAt: '2026-02-03T00:00:00.000Z',
      lastViolatedAt: '2026-02-04T00:00:00.000Z',
    });

    expect(node.createdAt).toBeInstanceOf(Date);
    expect(node.phaseStartedAt).toBeInstanceOf(Date);
    expect(node.lastExecutedAt).toBeInstanceOf(Date);
    expect(node.lastViolatedAt).toBeInstanceOf(Date);
  });

  it('defaults execution frequency to daily and preserves explicit false', () => {
    const baseNode = {
      id: 'node-1',
      title: 'Rule',
      rule: 'Do it',
      sortOrder: 1,
      createdAt: '2026-02-01T00:00:00.000Z',
    };

    expect(decodeRSIPNode(baseNode)).toMatchObject({
      requiresDailyExecution: true,
    });
    expect(
      decodeRSIPNode({ ...baseNode, requiresDailyExecution: false }),
    ).toMatchObject({ requiresDailyExecution: false });

    const baseEntry = {
      id: 'entry-1',
      title: 'Entry',
      rule: 'Rule',
      cumulativeExecutionDays: 1,
      internalizationProgress: 2,
      lastActiveAt: '2026-02-01T00:00:00.000Z',
      timesUsed: 1,
    };

    expect(decodeRSIPLibraryEntry(baseEntry)).toMatchObject({
      requiresDailyExecution: true,
    });
    expect(
      decodeRSIPLibraryEntry({ ...baseEntry, requiresDailyExecution: false }),
    ).toMatchObject({ requiresDailyExecution: false });
  });

  it('falls back for invalid rsip dates that require now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-08T08:00:00.000Z'));

    expect(
      decodeRSIPNodeGroup({
        id: 'group-1',
        title: 'Group',
        faultTolerance: 1,
        createdAt: 'bad-date',
      }).createdAt.toISOString(),
    ).toBe('2026-03-08T08:00:00.000Z');

    expect(
      decodeRSIPLibraryEntry({
        id: 'entry-1',
        title: 'Entry',
        rule: 'Rule',
        cumulativeExecutionDays: 1,
        internalizationProgress: 2,
        lastActiveAt: null,
        timesUsed: 1,
      }).lastActiveAt.toISOString(),
    ).toBe('2026-03-08T08:00:00.000Z');

    expect(
      decodeRSIPRunRecord({
        runNumber: 1,
        startedAt: 'bad-date',
        endedAt: 'still-bad',
        maxNodeCount: 1,
        durationDays: 1,
      }).startedAt.toISOString(),
    ).toBe('2026-03-08T08:00:00.000Z');
  });

  it('decodes meta, task links, and execution records', () => {
    const meta = decodeRSIPMeta({
      lastAddedAt: '2026-02-01T00:00:00.000Z',
      allowMultiplePerDay: true,
      currentRunStartedAt: '2026-02-02T00:00:00.000Z',
    });
    const link = decodeRSIPTaskLink({
      id: 'link-1',
      rsipNodeId: 'node-1',
      chainId: 'chain-1',
      chainKind: 'unit',
      triggerEvent: 'task_completed',
      effect: 'mark_rsip_executed',
      automation: 'confirm',
      isActive: true,
      updatedAt: '2026-02-03T00:00:00.000Z',
    });
    const record = decodeRSIPExecutionRecord({
      id: 'record-1',
      nodeId: 'node-1',
      executedAt: '2026-02-04T00:00:00.000Z',
      status: 'executed',
    });

    expect(meta.lastAddedAt).toBeInstanceOf(Date);
    expect(meta.currentRunStartedAt).toBeInstanceOf(Date);
    expect(link.updatedAt).toBeInstanceOf(Date);
    expect(record.executedAt).toBeInstanceOf(Date);
  });
});
