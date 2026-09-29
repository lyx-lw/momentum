import type { RSIPLibraryEntry, RSIPNode, RSIPRunRecord } from '../../../types';
import { buildRSIPNodeRows } from './rsipPayloadBuilder';
import type { SupabaseStorageContext } from './types';
import {
  isSchemaMissing,
  RSIP_NODES_TABLE,
  type SupabaseLikeError,
} from './rsipNodeCapabilities';

type UpsertClient = {
  from: (tableName: string) => {
    upsert: (
      payload: Record<string, unknown> | Record<string, unknown>[],
      options?: { onConflict?: string },
    ) => Promise<{ error: SupabaseLikeError | null }>;
    delete: () => {
      in: (
        column: string,
        values: string[],
      ) => {
        eq: (
          column: string,
          value: string,
        ) => Promise<{ error: SupabaseLikeError | null }>;
      };
    };
    insert: (
      payload: Record<string, unknown>,
    ) => Promise<{ error: SupabaseLikeError | null }>;
  };
};

export async function upsertRSIPNode(
  ctx: SupabaseStorageContext,
  node: RSIPNode,
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) {
    return;
  }

  const client = ctx.getClient() as unknown as UpsertClient;
  const row = buildRSIPNodeRows([node], user.id)[0];

  const { error } = await client
    .from(RSIP_NODES_TABLE)
    .upsert(row, { onConflict: 'id' });
  if (error) {
    throw new Error(`Failed to upsert RSIP node: ${error.message}`);
  }
}

export async function removeRSIPNodes(
  ctx: SupabaseStorageContext,
  nodeIds: string[],
): Promise<void> {
  if (nodeIds.length === 0) {
    return;
  }

  const user = await ctx.getCurrentUser();
  if (!user) {
    return;
  }

  const client = ctx.getClient() as unknown as UpsertClient;
  const { error } = await client
    .from(RSIP_NODES_TABLE)
    .delete()
    .in('id', nodeIds)
    .eq('user_id', user.id);

  if (error) {
    if (isSchemaMissing(error)) {
      return;
    }
    throw new Error(`Failed to remove RSIP nodes: ${error.message}`);
  }
}

export async function upsertRSIPLibraryEntry(
  ctx: SupabaseStorageContext,
  entry: RSIPLibraryEntry,
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) {
    return;
  }

  const client = ctx.getClient() as unknown as UpsertClient;
  const { error } = await client.from('rsip_policy_library').upsert(
    {
      id: entry.id,
      user_id: user.id,
      title: entry.title,
      rule: entry.rule,
      type: entry.type ?? null,
      emoji: entry.emoji ?? null,
      cumulative_execution_days: entry.cumulativeExecutionDays,
      internalization_progress: entry.internalizationProgress,
      last_active_at: entry.lastActiveAt.toISOString(),
      times_used: entry.timesUsed,
      use_timer: entry.useTimer ?? false,
      timer_minutes: entry.timerMinutes ?? null,
      is_passive: entry.isPassive ?? false,
      requires_daily_execution: entry.requiresDailyExecution !== false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,id' },
  );

  if (error) {
    if (isSchemaMissing(error)) {
      return;
    }
    throw new Error(`Failed to upsert RSIP library entry: ${error.message}`);
  }
}

export async function appendRSIPRunRecord(
  ctx: SupabaseStorageContext,
  record: RSIPRunRecord,
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) {
    return;
  }

  const client = ctx.getClient() as unknown as UpsertClient;
  const { error } = await client.from('rsip_run_history').insert({
    user_id: user.id,
    run_number: record.runNumber,
    started_at: record.startedAt.toISOString(),
    ended_at: record.endedAt?.toISOString() ?? null,
    max_node_count: record.maxNodeCount,
    duration_days: record.durationDays,
    collapse_reason: record.collapseReason ?? null,
    collapse_node_title: record.collapseNodeTitle ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    if (isSchemaMissing(error)) {
      return;
    }
    throw new Error(
      `Failed to append rsip run history record: ${error.message}`,
    );
  }
}
