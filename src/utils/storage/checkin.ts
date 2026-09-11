import type { CheckinResult, CheckinStats } from '../../domain/checkin';
import { logger } from '../logger';
import { STORAGE_KEYS } from './keys';

interface LocalCheckinState {
  version: 1;
  totalPoints: number;
  totalCheckins: number;
  currentStreak: number;
  longestStreak: number;
  lastCheckinDate: string | null;
}

const LOCAL_USER_ID = 'local-user';
const CHECKIN_REWARD = 10;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function createEmptyState(): LocalCheckinState {
  return {
    version: 1,
    totalPoints: 0,
    totalCheckins: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastCheckinDate: null,
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isLocalCheckinState(value: unknown): value is LocalCheckinState {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<LocalCheckinState>;
  return (
    candidate.version === 1 &&
    isNonNegativeInteger(candidate.totalPoints) &&
    isNonNegativeInteger(candidate.totalCheckins) &&
    isNonNegativeInteger(candidate.currentStreak) &&
    isNonNegativeInteger(candidate.longestStreak) &&
    (candidate.lastCheckinDate === null ||
      (typeof candidate.lastCheckinDate === 'string' &&
        DATE_PATTERN.test(candidate.lastCheckinDate)))
  );
}

function readState(): LocalCheckinState {
  const raw = localStorage.getItem(STORAGE_KEYS.CHECKIN_STATE);
  if (!raw) return createEmptyState();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isLocalCheckinState(parsed)) return parsed;
  } catch {
    // 由下方统一记录无效数据并回退。
  }

  logger.warn('CHECKIN', '本地签到数据无效，已使用安全默认值');
  return createEmptyState();
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function previousLocalDate(date: Date): string {
  return formatLocalDate(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1),
  );
}

function toStats(state: LocalCheckinState, today: string): CheckinStats {
  return {
    user_id: LOCAL_USER_ID,
    total_points: state.totalPoints,
    total_checkins: state.totalCheckins,
    current_streak: state.currentStreak,
    longest_streak: state.longestStreak,
    last_checkin_date: state.lastCheckinDate,
    has_checked_in_today: state.lastCheckinDate === today,
  };
}

export function getLocalCheckinStats(now: Date = new Date()): CheckinStats {
  return toStats(readState(), formatLocalDate(now));
}

export function performLocalDailyCheckin(
  now: Date = new Date(),
): CheckinResult {
  const current = readState();
  const today = formatLocalDate(now);

  if (current.lastCheckinDate === today) {
    return {
      success: true,
      message: 'Already checked in today',
      already_checked_in: true,
      checkin_date: today,
      points_earned: 0,
      consecutive_days: current.currentStreak,
      total_points: current.totalPoints,
      checkin_id: `local-${today}`,
    };
  }

  const currentStreak =
    current.lastCheckinDate === previousLocalDate(now)
      ? current.currentStreak + 1
      : 1;
  const next: LocalCheckinState = {
    version: 1,
    totalPoints: current.totalPoints + CHECKIN_REWARD,
    totalCheckins: current.totalCheckins + 1,
    currentStreak,
    longestStreak: Math.max(current.longestStreak, currentStreak),
    lastCheckinDate: today,
  };

  localStorage.setItem(STORAGE_KEYS.CHECKIN_STATE, JSON.stringify(next));

  return {
    success: true,
    message: 'Check-in successful',
    already_checked_in: false,
    checkin_date: today,
    points_earned: CHECKIN_REWARD,
    consecutive_days: currentStreak,
    total_points: next.totalPoints,
    checkin_id: `local-${today}`,
  };
}
