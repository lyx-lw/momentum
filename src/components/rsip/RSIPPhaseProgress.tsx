import type { RSIPStabilityPhase } from '../../types';

interface RSIPPhaseProgressProps {
  phase: RSIPStabilityPhase;
  consecutiveDays: number;
  cumulativeDays: number;
}

const PHASE_THRESHOLDS: Record<RSIPStabilityPhase, number> = {
  E0: 7,
  E1: 21,
  E2: 0,
};

const PHASE_GRADIENT_CLASS: Record<RSIPStabilityPhase, string> = {
  E0: 'bg-gradient-to-r from-slate-400 to-blue-500',
  E1: 'bg-gradient-to-r from-blue-500 to-emerald-500',
  E2: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
};

export function RSIPPhaseProgress({
  phase,
  consecutiveDays,
  cumulativeDays,
}: RSIPPhaseProgressProps) {
  const threshold = PHASE_THRESHOLDS[phase];
  const isMaxPhase = phase === 'E2';
  const progress = isMaxPhase
    ? 100
    : Math.min((consecutiveDays / threshold) * 100, 100);

  const gradientClass = PHASE_GRADIENT_CLASS[phase];

  let phaseStatusText: string;
  if (isMaxPhase) {
    phaseStatusText = '已内化';
  } else if (phase === 'E0') {
    phaseStatusText = '→ E1';
  } else {
    phaseStatusText = '→ E2';
  }

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600 dark:text-white/50">连续执行进度</span>
        <span className="flex gap-1 font-medium text-slate-800 dark:text-white/70">
          <span>{phaseStatusText}</span>
          <span>
            {isMaxPhase ? '完成' : `${consecutiveDays}/${threshold} 天`}
          </span>
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${gradientClass}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-xs text-slate-500 dark:text-white/50">
        连续 {consecutiveDays} 天 · 累计 {cumulativeDays} 天
      </p>
    </div>
  );
}
