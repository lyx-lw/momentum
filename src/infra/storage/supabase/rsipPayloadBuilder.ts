import type { RSIPNode, RSIPStabilityPhase } from '../../../types';

type RSIPNodeBasePayload = {
  id: string;
  parent_id: string | null;
  title: string;
  rule: string;
  sort_order: number;
  created_at: string;
  use_timer: boolean;
  timer_minutes: number | null;
  user_id: string;
};

type RSIPNodePayload = RSIPNodeBasePayload & {
  emoji: string | null;
  type: string | null;
  group_id: string | null;
  reinforcement_level: number;
  max_reinforcement_level: number;
  cumulative_execution_days: number;
  is_passive: boolean;
  requires_daily_execution: boolean;
  split_from_goal: string | null;
  stability_phase: RSIPStabilityPhase;
  phase_started_at: string | null;
  last_executed_at: string | null;
  last_violated_at: string | null;
  consecutive_executions: number;
  consecutive_violations: number;
  total_executions: number;
  total_violations: number;
};

function buildBaseNodePayload(
  node: RSIPNode,
  userId: string,
): RSIPNodeBasePayload {
  return {
    id: node.id,
    parent_id: node.parentId || null,
    title: node.title,
    rule: node.rule,
    sort_order: node.sortOrder,
    created_at: node.createdAt.toISOString(),
    use_timer: node.useTimer ?? false,
    timer_minutes: node.timerMinutes ?? null,
    user_id: userId,
  };
}

function buildStrictNodePayload(
  node: RSIPNode,
  userId: string,
): RSIPNodePayload {
  return {
    ...buildBaseNodePayload(node, userId),
    emoji: node.emoji ?? null,
    type: node.type ?? null,
    group_id: node.groupId ?? null,
    reinforcement_level: node.reinforcementLevel ?? 0,
    max_reinforcement_level: node.maxReinforcementLevel ?? 0,
    cumulative_execution_days: node.cumulativeExecutionDays ?? 0,
    is_passive: node.isPassive ?? false,
    requires_daily_execution: node.requiresDailyExecution !== false,
    split_from_goal: node.splitFromGoal ?? null,
    stability_phase: node.stabilityPhase ?? 'E0',
    phase_started_at: node.phaseStartedAt?.toISOString() ?? null,
    last_executed_at: node.lastExecutedAt?.toISOString() ?? null,
    last_violated_at: node.lastViolatedAt?.toISOString() ?? null,
    consecutive_executions: node.consecutiveExecutions ?? 0,
    consecutive_violations: node.consecutiveViolations ?? 0,
    total_executions: node.totalExecutions ?? 0,
    total_violations: node.totalViolations ?? 0,
  };
}

export function buildRSIPNodeRows(
  nodes: RSIPNode[],
  userId: string,
): RSIPNodePayload[] {
  return nodes.map((node) => buildStrictNodePayload(node, userId));
}
