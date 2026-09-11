import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localStorageAdapter } from '../localStorageAdapter';

describe('localStorageAdapter capabilities', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 11, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns NOT_SUPPORTED for cloud-only operations', async () => {
    const results = await Promise.all([
      localStorageAdapter.signIn('user@example.com', 'password'),
      localStorageAdapter.signUp('user@example.com', 'password'),
      localStorageAdapter.signOut(),
      localStorageAdapter.getGamblingSettings(),
      localStorageAdapter.toggleGamblingMode(),
      localStorageAdapter.createBettingSession('chain-1', 1200),
      localStorageAdapter.deleteBettingSession('session-1'),
      localStorageAdapter.completeTaskWithBetting('session-1'),
      localStorageAdapter.placeBet({
        session_id: 'session-1',
        bet_amount: 1,
      }),
      localStorageAdapter.getUserAvailablePoints(),
      localStorageAdapter.getTodayBetAmount(),
    ]);

    expect(results).toHaveLength(11);
    for (const result of results) {
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'NOT_SUPPORTED' },
      });
    }
  });

  it('reports unauthenticated local-mode defaults', async () => {
    const listener = vi.fn();
    const subscriptionResult = localStorageAdapter.onAuthStateChange(listener);

    await expect(localStorageAdapter.getCurrentUser()).resolves.toEqual({
      ok: true,
      value: null,
    });
    await expect(localStorageAdapter.isUserAuthenticated()).resolves.toEqual({
      ok: true,
      value: false,
    });
    await expect(localStorageAdapter.waitForAuthentication()).resolves.toEqual({
      ok: true,
      value: { user: null, isAuthenticated: false },
    });
    await expect(localStorageAdapter.isGamblingModeEnabled()).resolves.toEqual({
      ok: true,
      value: false,
    });
    expect(subscriptionResult).toEqual({
      ok: true,
      value: expect.any(Function),
    });

    if (subscriptionResult.ok) subscriptionResult.value();
    expect(listener).not.toHaveBeenCalled();
  });

  it('persists check-in through the local gateway', async () => {
    const first = await localStorageAdapter.performDailyCheckin();
    const stats = await localStorageAdapter.getUserCheckinStats();

    expect(first).toMatchObject({
      ok: true,
      value: {
        points_earned: 10,
        already_checked_in: false,
        checkin_date: '2026-09-11',
      },
    });
    expect(stats).toMatchObject({
      ok: true,
      value: {
        total_points: 10,
        total_checkins: 1,
        has_checked_in_today: true,
      },
    });
  });

  it('returns a storage error when local check-in cannot be saved', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    await expect(localStorageAdapter.performDailyCheckin()).resolves.toEqual({
      ok: false,
      error: {
        code: 'STORAGE',
        message: 'Failed to save local daily check-in',
        cause: expect.any(DOMException),
      },
    });
  });
});
