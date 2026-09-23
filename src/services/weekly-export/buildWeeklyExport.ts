import type { Chain, CompletionHistory } from '../../types';
import type { WeeklyDateRange } from './dateRange';
import type {
  BuildWeeklyExportResult,
  WeeklyActivityRecord,
  WeeklyChainContext,
  WeeklyChainGroup,
  WeeklyExportWarning,
} from './types';

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}
function serializeRecord(record: CompletionHistory): WeeklyActivityRecord {
  return {
    chainId: record.chainId,
    completedAt: record.completedAt.toISOString(),
    wasSuccessful: record.wasSuccessful,
    description: record.description,
    notes: record.notes,
    reasonForFailure: record.reasonForFailure,
    duration: record.duration,
    actualDuration: record.actualDuration,
    isForwardTimed: record.isForwardTimed,
  };
}

function serializeChain(chain: Chain): WeeklyChainContext {
  return {
    id: chain.id,
    parentId: chain.parentId,
    name: chain.name,
    description: chain.description,
    type: chain.type,
    trigger: chain.trigger,
    createdAt: chain.createdAt.toISOString(),
  };
}

function buildChainPath(
  chain: Chain,
  chainsById: ReadonlyMap<string, Chain>,
): {
  path: Array<{ id: string; name: string }>;
  hasCycle: boolean;
} {
  const reversedPath: Array<{ id: string; name: string }> = [];
  const visited = new Set<string>();
  let current: Chain | undefined = chain;

  while (current) {
    if (visited.has(current.id)) {
      return { path: reversedPath.reverse(), hasCycle: true };
    }
    visited.add(current.id);
    reversedPath.push({ id: current.id, name: current.name });
    current = current.parentId ? chainsById.get(current.parentId) : undefined;
  }

  return { path: reversedPath.reverse(), hasCycle: false };
}

function compareRecords(
  left: WeeklyActivityRecord,
  right: WeeklyActivityRecord,
): number {
  const byTime = left.completedAt.localeCompare(right.completedAt);
  return byTime || left.chainId.localeCompare(right.chainId);
}

function compareGroups(left: WeeklyChainGroup, right: WeeklyChainGroup): number {
  const byTime = left.records[0].completedAt.localeCompare(
    right.records[0].completedAt,
  );
  return byTime || left.chain.id.localeCompare(right.chain.id);
}

function hasInvalidDates(params: {
  chains: Chain[];
  history: CompletionHistory[];
  range: WeeklyDateRange;
  now: Date;
}): boolean {
  return (
    !isValidDate(params.now) ||
    !isValidDate(params.range.start) ||
    !isValidDate(params.range.endExclusive) ||
    params.chains.some((chain) => !isValidDate(chain.createdAt)) ||
    params.history.some((record) => !isValidDate(record.completedAt))
  );
}

export function buildWeeklyExport(params: {
  chains: Chain[];
  history: CompletionHistory[];
  range: WeeklyDateRange;
  now?: Date;
  timezone?: string;
}): BuildWeeklyExportResult {
  const now = params.now ?? new Date();
  if (hasInvalidDates({ ...params, now })) {
    return { ok: false, reason: 'invalid-date' };
  }

  const startTime = params.range.start.getTime();
  const endTime = params.range.endExclusive.getTime();
  const filtered = params.history.filter((record) => {
    const completedTime = record.completedAt.getTime();
    return completedTime >= startTime && completedTime < endTime;
  });
  if (filtered.length === 0) return { ok: false, reason: 'empty' };

  const chainsById = new Map(params.chains.map((chain) => [chain.id, chain]));
  const recordsByChain = new Map<string, WeeklyActivityRecord[]>();
  const unresolvedRecords: WeeklyActivityRecord[] = [];

  for (const historyRecord of filtered) {
    const record = serializeRecord(historyRecord);
    if (!chainsById.has(record.chainId)) {
      unresolvedRecords.push(record);
      continue;
    }
    const records = recordsByChain.get(record.chainId) ?? [];
    records.push(record);
    recordsByChain.set(record.chainId, records);
  }

  const warnings: WeeklyExportWarning[] = [];
  const groups: WeeklyChainGroup[] = [];
  for (const [chainId, records] of recordsByChain) {
    const chain = chainsById.get(chainId);
    if (!chain) continue;

    records.sort(compareRecords);
    const pathResult = buildChainPath(chain, chainsById);
    if (pathResult.hasCycle) {
      warnings.push({ code: 'CHAIN_PATH_CYCLE', chainId });
    }
    groups.push({
      chain: serializeChain(chain),
      chainPath: pathResult.path,
      chainState: chain.deletedAt == null ? 'active' : 'deleted',
      records,
    });
  }

  groups.sort(compareGroups);
  unresolvedRecords.sort(compareRecords);
  warnings.sort((left, right) => left.chainId.localeCompare(right.chainId));

  return {
    ok: true,
    data: {
      format: 'momentum-weekly-activity',
      schemaVersion: 1,
      exportedAt: now.toISOString(),
      timezone: params.timezone ?? 'UTC',
      period: {
        start: params.range.start.toISOString(),
        endExclusive: params.range.endExclusive.toISOString(),
      },
      dataThrough: now.toISOString(),
      isPartialPeriod: params.range.isPartialPeriod,
      chains: groups,
      unresolvedRecords,
      warnings,
    },
    chainCount: groups.length,
    recordCount: filtered.length,
  };
}
