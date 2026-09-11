# Local Persistent Check-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing formal daily check-in feature persist locally without login or Supabase, using a fixed 10-point daily reward and the device's local calendar day.

**Architecture:** Add a focused local check-in repository under `src/utils/storage`, expose it through the existing storage aggregate, and connect the existing `localStorageAdapter` to the unchanged `CheckinGateway`. Mark local storage as check-in capable so the dashboard renders the existing formal `DailyCheckin` component. Keep Supabase behavior unchanged.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, browser `localStorage`, Vite PWA.

---

## File map

- Create `src/utils/storage/checkin.ts`: local date formatting, state validation, statistics loading, and one-write check-in transaction.
- Create `src/utils/storage/__tests__/checkin.test.ts`: deterministic local-calendar and persistence tests.
- Modify `src/utils/storage/keys.ts`: add the dedicated local check-in key.
- Modify `src/utils/storage/index.ts`: expose the local check-in repository through the existing utility aggregate.
- Modify `src/storage/ports.ts`: advertise local check-in capability.
- Modify `src/storage/localStorageAdapter.ts`: delegate check-in gateway methods to the local repository and convert storage exceptions to `AppError` results.
- Modify `src/storage/__tests__/ports.test.ts`: update the local capability contract.
- Modify `src/storage/__tests__/localStorageAdapter.test.ts`: replace the obsolete unsupported assertions with persistence/error assertions.
- Modify `src/hooks/domains/useCheckinDomain.ts`: update local-mode documentation and keep capability-based loading behavior.
- Modify `src/hooks/domains/__tests__/useCheckinDomain.test.ts`: prove local mode loads and refreshes through the same gateway as cloud mode.

### Task 1: Define the local repository contract with failing tests

**Files:**
- Create: `src/utils/storage/__tests__/checkin.test.ts`
- Modify: `src/utils/storage/keys.ts`

- [ ] **Step 1: Add the storage key**

Add this property to `STORAGE_KEYS`:

```ts
CHECKIN_STATE: 'momentum_checkin_state',
```

- [ ] **Step 2: Write failing zero-state and first-check-in tests**

Create tests that import the wished-for API before it exists:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../keys';
import { getLocalCheckinStats, performLocalDailyCheckin } from '../checkin';

describe('storage/checkin', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
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
});
```

- [ ] **Step 3: Run the tests and verify RED**

Run:

```powershell
npx vitest run --config vitest.config.ts src/utils/storage/__tests__/checkin.test.ts
```

Expected: FAIL because `../checkin` does not exist.

- [ ] **Step 4: Commit only after explicit user approval**

Do not commit yet; Task 1 intentionally remains red until Task 2 supplies the repository.

### Task 2: Implement local date and persistence behavior

**Files:**
- Create: `src/utils/storage/checkin.ts`
- Test: `src/utils/storage/__tests__/checkin.test.ts`

- [ ] **Step 1: Add failing edge-case tests**

Extend the test file with separate cases for duplicate same-day check-in, next-day continuation, broken streak, reload recovery, malformed state, and write failure. Use local constructors such as `new Date(2026, 8, 12, 0, 5)` rather than ISO strings so the tests exercise local calendar rules.

Representative assertions:

```ts
expect(performLocalDailyCheckin(dayOne).points_earned).toBe(10);
expect(performLocalDailyCheckin(dayOneLater)).toMatchObject({
  already_checked_in: true,
  points_earned: 0,
  total_points: 10,
});
expect(performLocalDailyCheckin(dayTwo).consecutive_days).toBe(2);
expect(performLocalDailyCheckin(dayFour).consecutive_days).toBe(1);
expect(getLocalCheckinStats(dayFour).longest_streak).toBe(2);
```

For malformed data:

```ts
localStorage.setItem(STORAGE_KEYS.CHECKIN_STATE, '{broken');
expect(getLocalCheckinStats(dayOne).total_checkins).toBe(0);
```

For write failure, spy on `Storage.prototype.setItem`, expect `performLocalDailyCheckin` to throw, and verify that no success result is returned.

- [ ] **Step 2: Run the tests and verify RED**

Run the Task 1 command again.

Expected: FAIL because the local repository behavior is not implemented.

- [ ] **Step 3: Implement the minimal repository**

Create `src/utils/storage/checkin.ts` with an internal versioned type and these public signatures:

```ts
export function getLocalCheckinStats(now: Date = new Date()): CheckinStats;
export function performLocalDailyCheckin(
  now: Date = new Date(),
): CheckinResult;
```

Use local date components:

```ts
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
```

Read and validate `version === 1`, finite non-negative integer counters, and a null or `YYYY-MM-DD` date. Invalid or unparseable values call `logger.warn('CHECKIN', '本地签到数据无效，已使用安全默认值')` and return a zero state. A successful new check-in builds one complete state object and calls `localStorage.setItem` exactly once before returning success.

- [ ] **Step 4: Run repository tests and verify GREEN**

Run the Task 1 command.

Expected: all `storage/checkin` tests PASS.

- [ ] **Step 5: Expose the repository from the storage aggregate**

In `src/utils/storage/index.ts`, import and add:

```ts
import { getLocalCheckinStats, performLocalDailyCheckin } from './checkin';

// Inside storage:
getLocalCheckinStats,
performLocalDailyCheckin,
```

- [ ] **Step 6: Re-run repository tests**

Expected: PASS with no new failures.

### Task 3: Enable the existing gateway in local mode

**Files:**
- Modify: `src/storage/ports.ts`
- Modify: `src/storage/localStorageAdapter.ts`
- Modify: `src/storage/__tests__/ports.test.ts`
- Modify: `src/storage/__tests__/localStorageAdapter.test.ts`

- [ ] **Step 1: Write failing capability and adapter tests**

Change the local capability expectation to:

```ts
expect(hasStorageCapability(storage, 'checkin')).toBe(true);
```

Remove check-in calls from the cloud-only `NOT_SUPPORTED` list and add a local behavior test:

```ts
it('persists check-in through the local gateway', async () => {
  const first = await localStorageAdapter.performDailyCheckin();
  const stats = await localStorageAdapter.getUserCheckinStats();

  expect(first).toMatchObject({
    ok: true,
    value: { points_earned: 10, already_checked_in: false },
  });
  expect(stats).toMatchObject({
    ok: true,
    value: { total_points: 10, total_checkins: 1 },
  });
});
```

Add a `setItem` failure test expecting `{ ok: false, error: { code: 'STORAGE' } }`.

- [ ] **Step 2: Run adapter tests and verify RED**

Run:

```powershell
npx vitest run --config vitest.config.ts src/storage/__tests__/ports.test.ts src/storage/__tests__/localStorageAdapter.test.ts
```

Expected: FAIL because local capability is false and adapter methods return `NOT_SUPPORTED`.

- [ ] **Step 3: Implement the minimal adapter changes**

Set `LOCAL_STORAGE_CAPABILITIES.checkin` to `true`. Replace the unsupported methods with guarded delegates:

```ts
performDailyCheckin: async () => {
  try {
    return ok(localStorageUtils.performLocalDailyCheckin());
  } catch (cause) {
    return err({
      code: 'STORAGE',
      message: 'Failed to save local daily check-in',
      cause,
    });
  }
},
getUserCheckinStats: async () => {
  try {
    return ok(localStorageUtils.getLocalCheckinStats());
  } catch (cause) {
    return err({
      code: 'STORAGE',
      message: 'Failed to load local daily check-in',
      cause,
    });
  }
},
```

Delete only the now-unused `DAILY_CHECKIN_NOT_SUPPORTED_MESSAGE` constant; retain all unrelated unsupported capabilities.

- [ ] **Step 4: Run adapter tests and verify GREEN**

Run the Task 3 command.

Expected: both test files PASS.

### Task 4: Make the formal check-in domain work in local mode

**Files:**
- Modify: `src/hooks/domains/useCheckinDomain.ts`
- Modify: `src/hooks/domains/__tests__/useCheckinDomain.test.ts`

- [ ] **Step 1: Replace obsolete local-mode tests**

Replace the tests expecting a login-required error and no event listener with tests using a local storage mock whose capability is true:

```ts
it('loads check-in stats in local mode', async () => {
  const getUserCheckinStats = vi.fn(async () => ok(baseStats));
  const storage = createLocalStorageMock({ getUserCheckinStats });
  const { result } = renderHookWithProviders(() => useCheckinDomain(), {
    storage,
  });

  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.stats).toEqual(baseStats);
  expect(result.current.error).toBeNull();
});
```

Verify local mode attaches and removes the existing `POINTS_CHANGED_EVENT` listener because check-in is now supported.

- [ ] **Step 2: Run the domain tests after enabling the gateway**

Run:

```powershell
npx vitest run --config vitest.config.ts src/hooks/domains/__tests__/useCheckinDomain.test.ts
```

Expected: PASS after Task 3 because the existing domain hook already routes every capable storage provider through `CheckinGateway`. The RED evidence for enabling local mode is captured by the capability and adapter tests in Task 3.

- [ ] **Step 3: Update production documentation only**

Change the module comment from “仅在 Supabase 模式下生效” to:

```ts
本地模式使用浏览器本地持久化，Supabase 模式使用云端原子签到。
```

Keep the capability guard as defensive handling for custom or legacy storage providers.

- [ ] **Step 4: Run domain and component tests**

Run:

```powershell
npx vitest run --config vitest.config.ts src/hooks/domains/__tests__/useCheckinDomain.test.ts src/components/__tests__/DailyCheckinDemo.test.tsx src/components/__tests__/Dashboard.test.tsx src/components/dashboard/__tests__/Dashboard.sections.test.tsx
```

Expected: all selected tests PASS. The demo component may remain in source for backward compatibility, but normal local and Supabase capabilities both select `DailyCheckin`, so no demo badge, reset control, or Supabase notice appears in the formal app.

### Task 5: Verify the integrated PWA behavior

**Files:**
- No production changes expected.

- [ ] **Step 1: Run all check-in and storage regression tests**

Run:

```powershell
npx vitest run --config vitest.config.ts src/utils/storage/__tests__/checkin.test.ts src/storage/__tests__/ports.test.ts src/storage/__tests__/localStorageAdapter.test.ts src/storage/__tests__/MomentumStorage.contract.test.ts src/services/__tests__/CheckinService.test.ts src/hooks/domains/__tests__/useCheckinDomain.test.ts src/components/__tests__/Dashboard.test.tsx src/components/dashboard/__tests__/Dashboard.sections.test.tsx
```

Expected: all selected files PASS.

- [ ] **Step 2: Run static verification**

Run:

```powershell
npm run typecheck
npm run build
git diff --check
```

Expected: all commands exit 0; Vite reports a successful PWA build.

- [ ] **Step 3: Run the full test suite and report the known baseline separately**

Run:

```powershell
npm test -- --run
```

Expected: no new failures. If `useRSIPViewCreationActions.domain-chain.test.ts` remains the sole failure, report it as the pre-existing rollback mismatch documented in the design rather than attributing it to local check-in.

- [ ] **Step 4: Prepare phone verification**

Rebuild the existing production preview and preserve the current origin `http://localhost:52433` so existing local data remains available. Verify manually:

1. The homepage shows no demo badge, reset icon, or Supabase explanation.
2. First tap awards exactly 10 points.
3. A second tap is unavailable or idempotent.
4. Closing and reopening the PWA preserves the signed-in-today state and statistics.
5. Existing task chains and RSIP data remain unchanged.

- [ ] **Step 5: Commit only after explicit user approval**

Stage only the files listed in this plan and use:

```powershell
git -c user.name='ChanganLI' -c user.email='942972269@qq.com' commit -m "feat: persist daily check-in locally"
```

Do not push or merge.
