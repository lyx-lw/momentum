import { CheckCircle, Clock, Flame, Hourglass } from 'lucide-react';
import type { ActiveSession, Chain } from '../../types';
import {
  formatDuration,
  formatElapsedTime,
  formatLastCompletionReference,
  formatTimeDescriptionByLanguage,
} from '../../utils/time';
import { TimerRing } from './TimerRing';

interface FocusTimerPanelProps {
  session: ActiveSession;
  chain: Chain;
  isDurationless: boolean;
  timeRemaining: number;
  elapsedSeconds: number;
  progress: number;
  lastCompletionTime: number | null;
  hasReachedMinimum: boolean;
  minimumCountdown: number;
  language: 'zh' | 'en';
  tr: (zh: string, en: string) => string;
}

export function FocusTimerPanel({
  session,
  chain,
  isDurationless,
  timeRemaining,
  elapsedSeconds,
  progress,
  lastCompletionTime,
  hasReachedMinimum,
  minimumCountdown,
  language,
  tr: translate,
}: FocusTimerPanelProps) {
  const elapsedMinutes = Math.ceil(elapsedSeconds / 60);
  const elapsedWholeMinutes = Math.floor(
    (session.duration * 60 - timeRemaining) / 60,
  );
  const minimumConfigured =
    isDurationless &&
    Boolean(chain.minimumDuration && chain.minimumDuration > 0);

  return (
    <section className="mb-12 text-center sm:mb-16" aria-live="polite">
      <div
        className="relative mx-auto mb-6 flex h-[min(300px,72vw,42dvh)] w-[min(300px,72vw,42dvh)] items-center justify-center sm:mb-8"
        data-focus-timer-frame
      >
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <TimerRing
            progress={progress}
            isDurationless={isDurationless}
            isPaused={session.isPaused}
            className="h-full w-full"
          />
        </div>
        <div className="focus-timer-value relative z-10 px-4 font-mono text-[clamp(3.25rem,15vw,9rem)] font-light leading-none tracking-tight text-gray-950 dark:text-white">
          {isDurationless
            ? formatElapsedTime(elapsedSeconds)
            : formatDuration(timeRemaining)}
        </div>
      </div>
      <div className="mx-auto mb-6 h-1.5 w-full max-w-2xl overflow-hidden rounded-full bg-gray-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-primary-600 transition-[width] duration-1000 ease-out dark:bg-primary-400"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center space-x-2">
          <Clock className="text-primary-500" size={16} aria-hidden="true" />
          <span className="font-mono">
            {isDurationless
              ? `${translate('已用时 ', 'Elapsed: ')}${formatTimeDescriptionByLanguage(elapsedMinutes, language)}`
              : translate(
                  `${elapsedWholeMinutes}分钟 / ${session.duration}分钟`,
                  `${elapsedWholeMinutes} min / ${session.duration} min`,
                )}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Flame className="text-primary-500" size={16} aria-hidden="true" />
          <span className="font-mono">#{chain.currentStreak}</span>
        </div>
      </div>
      {isDurationless && lastCompletionTime !== null && (
        <div className="mt-4 font-chinese text-sm text-gray-500 dark:text-gray-400">
          {formatLastCompletionReference(lastCompletionTime, language)}
        </div>
      )}
      {minimumConfigured && !hasReachedMinimum && (
        <div className="mt-4 flex items-center justify-center space-x-2 font-chinese text-lg text-indigo-600 dark:text-indigo-400">
          <Hourglass className="text-indigo-500" size={16} aria-hidden="true" />
          <span>
            {translate(
              `还需 ${Math.floor(minimumCountdown / 60)}分${minimumCountdown % 60}秒 达到最小时长`,
              `Need ${Math.floor(minimumCountdown / 60)}m ${minimumCountdown % 60}s to reach the minimum duration`,
            )}
          </span>
        </div>
      )}
      {minimumConfigured && hasReachedMinimum && (
        <div className="mt-4 flex items-center justify-center space-x-2 font-chinese text-lg text-green-600 dark:text-green-400">
          <CheckCircle
            className="text-green-500"
            size={16}
            aria-hidden="true"
          />
          <span>
            {translate(
              `已达到最小时长 ${chain.minimumDuration} 分钟，可以完成任务`,
              `Minimum duration reached (${chain.minimumDuration} min). You can complete the task.`,
            )}
          </span>
        </div>
      )}
    </section>
  );
}
