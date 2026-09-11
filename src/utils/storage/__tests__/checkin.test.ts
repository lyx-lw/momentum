import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../logger';
import { STORAGE_KEYS } from '../keys';
import {
  getLocalCheckinStats,
  performLocalDailyCheckin,
} from '../checkin';

describe('storage/checkin', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns zero statistics when no local state exists', () => {
    expect(getLocalCheckinStats(new Date(2026, 8, 11, 12))).toEqual({
      user_id: 'local-user',
      total_points: 0,
      total_checkins: 0,
      current_streak: 0,
      longest_streak: 0,
      last_checkin_date: null,
      has_checked_in_today: false,
    });
  });

  it('persists the first local check-in with a fixed ten-point reward', () => {
    const result = performLocalDailyCheckin(new Date(2026, 8, 11, 12));

    expect(result).toMatchObject({
      success: true,
      already_checked_in: false,
      checkin_date: '2026-09-11',
      points_earned: 10,
      consecutive_days: 1,
      total_points: 10,
    });
    expect(localStorage.getItem(STORAGE_KEYS.CHECKIN_STATE)).not.toBeNull();
  });

  it('does not award points twice on the same local calendar day', () => {
    const morning = new Date(2026, 8, 11, 0, 5);
    const evening = new Date(2026, 8, 11, 23, 55);

    performLocalDailyCheckin(morning);
    const duplicate = performLocalDailyCheckin(evening);

    expect(duplicate).toMatchObject({
      success: true,
      already_checked_in: true,
      checkin_date: '2026-09-11',
      points_earned: 0,
      consecutive_days: 1,
      total_points: 10,
    });
    expect(getLocalCheckinStats(evening)).toMatchObject({
      total_points: 10,
      total_checkins: 1,
      has_checked_in_today: true,
    });
  });

  it('continues a streak on the next local calendar day', () => {
    performLocalDailyCheckin(new Date(2026, 8, 11, 23, 55));
    const nextDay = performLocalDailyCheckin(new Date(2026, 8, 12, 0, 5));

    expect(nextDay).toMatchObject({
      consecutive_days: 2,
      total_points: 20,
    });
    expect(getLocalCheckinStats(new Date(2026, 8, 12, 12))).toMatchObject({
      current_streak: 2,
      longest_streak: 2,
      total_checkins: 2,
    });
  });

  it('resets a broken streak while preserving the longest streak', () => {
    performLocalDailyCheckin(new Date(2026, 8, 10, 12));
    performLocalDailyCheckin(new Date(2026, 8, 11, 12));
    const afterGap = performLocalDailyCheckin(new Date(2026, 8, 13, 12));

    expect(afterGap.consecutive_days).toBe(1);
    expect(getLocalCheckinStats(new Date(2026, 8, 13, 12))).toMatchObject({
      current_streak: 1,
      longest_streak: 2,
      total_checkins: 3,
      total_points: 30,
    });
  });

  it('recovers persisted statistics on a later read', () => {
    performLocalDailyCheckin(new Date(2026, 8, 11, 12));

    expect(getLocalCheckinStats(new Date(2026, 8, 11, 18))).toMatchObject({
      total_points: 10,
      total_checkins: 1,
      current_streak: 1,
      longest_streak: 1,
      last_checkin_date: '2026-09-11',
      has_checked_in_today: true,
    });
  });

  it('falls back safely and logs when persisted data is malformed', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    localStorage.setItem(STORAGE_KEYS.CHECKIN_STATE, '{broken');

    expect(getLocalCheckinStats(new Date(2026, 8, 11, 12))).toMatchObject({
      total_points: 0,
      total_checkins: 0,
      current_streak: 0,
      longest_streak: 0,
      last_checkin_date: null,
      has_checked_in_today: false,
    });
    expect(warn).toHaveBeenCalledWith(
      'CHECKIN',
      '本地签到数据无效，已使用安全默认值',
    );
  });

  it('does not report success when persistence fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(() =>
      performLocalDailyCheckin(new Date(2026, 8, 11, 12)),
    ).toThrow('Quota exceeded');
  });
});
