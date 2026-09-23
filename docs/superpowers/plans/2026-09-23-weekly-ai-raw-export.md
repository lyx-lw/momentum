# Weekly AI Raw Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only JSON export that packages the current or previous natural week's task completion and interruption records for an external AI.

**Architecture:** Keep the full-backup export unchanged. Add a pure module for local-week calculation, validation, grouping, hierarchy context, and serialization; a React hook orchestrates storage reads, file saving, logging, and Toast feedback; the existing import/export modal exposes the controls.

**Tech Stack:** React 18, TypeScript 5.9, Vitest 4, Testing Library, `MomentumStorage`, platform file capability, logger, and Toast.

**Constraint:** Do not commit, push, deploy, change database schemas, install dependencies, or touch unrelated user changes.

---

## File map

Create:

- `src/services/weekly-export/types.ts`
- `src/services/weekly-export/dateRange.ts`
- `src/services/weekly-export/buildWeeklyExport.ts`
- `src/services/weekly-export/__tests__/dateRange.test.ts`
- `src/services/weekly-export/__tests__/buildWeeklyExport.test.ts`
- `src/components/import-export-modal/useWeeklyExportWorkflow.ts`
- `src/components/import-export-modal/__tests__/useWeeklyExportWorkflow.test.tsx`

Modify:

- `src/components/ImportExportModalContainer.tsx`
- `src/components/ImportExportModalView.tsx`
- `src/components/import-export-modal/ExportTab.tsx`
- `src/components/__tests__/ImportExportModalView.test.tsx`
- `src/components/__tests__/ImportExportModalContainer.test.tsx`

No production file is moved or renamed.

---

### Task 1: Local natural-week boundaries

**Files:**

- Create: `src/services/weekly-export/__tests__/dateRange.test.ts`
- Create: `src/services/weekly-export/dateRange.ts`

- [ ] **Step 1: Write failing date-range tests**

Create tests for current week, previous week, year rollover, partial-period metadata, and local filename formatting:

```ts
import { describe, expect, it } from 'vitest';
import { formatLocalDate, getWeeklyDateRange } from '../dateRange';

describe('getWeeklyDateRange', () => {
  it('returns Monday-to-Monday boundaries for the current local week', () => {
    const range = getWeeklyDateRange('current', new Date(2026, 8, 23, 10, 30));
    expect(range.start).toEqual(new Date(2026, 8, 21, 0, 0, 0, 0));
    expect(range.endExclusive).toEqual(new Date(2026, 8, 28, 0, 0, 0, 0));
    expect(range.isPartialPeriod).toBe(true);
  });

  it('returns the complete previous local week', () => {
    const range = getWeeklyDateRange('previous', new Date(2026, 8, 23, 10, 30));
    expect(range.start).toEqual(new Date(2026, 8, 14, 0, 0, 0, 0));
    expect(range.endExclusive).toEqual(new Date(2026, 8, 21, 0, 0, 0, 0));
    expect(range.isPartialPeriod).toBe(false);
  });

  it('crosses a year boundary with local calendar arithmetic', () => {
    const range = getWeeklyDateRange('current', new Date(2027, 0, 1, 8));
    expect(range.start).toEqual(new Date(2026, 11, 28));
    expect(range.endExclusive).toEqual(new Date(2027, 0, 4));
  });
});

describe('formatLocalDate', () => {
  it('formats local components without UTC slicing', () => {
    expect(formatLocalDate(new Date(2026, 0, 2, 0, 30))).toBe('2026-01-02');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx vitest run src/services/weekly-export/__tests__/dateRange.test.ts --config vitest.config.ts
```

Expected: FAIL because `../dateRange` does not exist.

- [ ] **Step 3: Implement the minimum date utilities**

```ts
export type WeeklyPeriodPreset = 'current' | 'previous';

export interface WeeklyDateRange {
  start: Date;
  endExclusive: Date;
  isPartialPeriod: boolean;
}

function startOfLocalWeek(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export function getWeeklyDateRange(
  preset: WeeklyPeriodPreset,
  now = new Date(),
): WeeklyDateRange {
  const start = startOfLocalWeek(now);
  if (preset === 'previous') start.setDate(start.getDate() - 7);
  const endExclusive = new Date(start);
  endExclusive.setDate(endExclusive.getDate() + 7);
  return {
    start,
    endExclusive,
    isPartialPeriod: preset === 'current' && now < endExclusive,
  };
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

- [ ] **Step 4: Run Step 2 again and verify GREEN**

Expected: the date-range test file passes without warnings.

---

### Task 2: Versioned contract and pure payload builder

**Files:**

- Create: `src/services/weekly-export/types.ts`
- Create: `src/services/weekly-export/__tests__/buildWeeklyExport.test.ts`
- Create: `src/services/weekly-export/buildWeeklyExport.ts`

- [ ] **Step 1: Define the exact output types**

```ts
import type { ChainType } from '../../types';

export interface WeeklyChainContext {
  id: string;
  parentId?: string;
  name: string;
  description: string;
  type: ChainType;
  trigger: string;
  createdAt: string;
}

export interface WeeklyActivityRecord {
  chainId: string;
  completedAt: string;
  wasSuccessful: boolean;
  description?: string;
  notes?: string;
  reasonForFailure?: string;
  duration: number;
  actualDuration?: number;
  isForwardTimed?: boolean;
}

export interface WeeklyExportWarning {
  code: 'CHAIN_PATH_CYCLE';
  chainId: string;
}

export interface WeeklyChainGroup {
  chain: WeeklyChainContext;
  chainPath: Array<{ id: string; name: string }>;
  chainState: 'active' | 'deleted';
  records: WeeklyActivityRecord[];
}

export interface WeeklyExportData {
  format: 'momentum-weekly-activity';
  schemaVersion: 1;
  exportedAt: string;
  timezone: string;
  period: { start: string; endExclusive: string };
  dataThrough: string;
  isPartialPeriod: boolean;
  chains: WeeklyChainGroup[];
  unresolvedRecords: WeeklyActivityRecord[];
  warnings: WeeklyExportWarning[];
}

export type BuildWeeklyExportResult =
  | { ok: true; data: WeeklyExportData; chainCount: number; recordCount: number }
  | { ok: false; reason: 'empty' | 'invalid-date' };
```

- [ ] **Step 2: Write failing builder tests**

Use a complete `Chain` factory. Add separate tests proving:

- `start` is included and `endExclusive` is excluded;
- success descriptions/notes and interruption reasons survive;
- inactive groups are absent;
- `chainPath` is root-to-current and parents are not extra activity groups;
- soft-deleted chains have `chainState: 'deleted'`;
- missing-chain records enter `unresolvedRecords`;
- cycles emit `CHAIN_PATH_CYCLE` and terminate;
- invalid `completedAt` returns `invalid-date`;
- group and record ordering is stable.

The primary assertion exercises the public API:

```ts
const result = buildWeeklyExport({
  chains: [parent, activeChild, deletedChain],
  history,
  range: {
    start: new Date(2026, 8, 21),
    endExclusive: new Date(2026, 8, 28),
    isPartialPeriod: true,
  },
  now: new Date(2026, 8, 23, 12),
  timezone: 'Asia/Shanghai',
});

expect(result).toMatchObject({ ok: true, chainCount: 2, recordCount: 3 });
if (!result.ok) throw new Error('expected weekly export data');
expect(result.data.chains[0].chainPath).toEqual([
  { id: parent.id, name: parent.name },
  { id: activeChild.id, name: activeChild.name },
]);
```

- [ ] **Step 3: Run builder tests and verify RED**

```powershell
npx vitest run src/services/weekly-export/__tests__/buildWeeklyExport.test.ts --config vitest.config.ts
```

Expected: FAIL because `buildWeeklyExport` does not exist.

- [ ] **Step 4: Implement the pure builder**

Implement:

```ts
export function buildWeeklyExport(params: {
  chains: Chain[];
  history: CompletionHistory[];
  range: WeeklyDateRange;
  now?: Date;
  timezone?: string;
}): BuildWeeklyExportResult;
```

Required algorithm:

1. Validate `now`, both boundaries, chain `createdAt`, and every history `completedAt` before filtering.
2. Filter with `time >= start && time < endExclusive`.
3. Return `empty` only when the filtered history is empty.
4. Map all active and soft-deleted chains by ID.
5. Preserve records without deduplication and serialize every approved field.
6. Build root-to-current paths with a per-path visited set.
7. Emit one deterministic cycle warning per affected group.
8. Put missing-chain records in `unresolvedRecords`.
9. Sort records by timestamp and groups by first record timestamp, with chain ID as tie-breaker.
10. Count grouped plus unresolved records in `recordCount`.

Use private helpers `isValidDate`, `serializeRecord`, `serializeChain`, and `buildChainPath`. Do not access React, storage, DOM, or file APIs.

- [ ] **Step 5: Run both pure tests and verify GREEN**

```powershell
npx vitest run src/services/weekly-export/__tests__/dateRange.test.ts src/services/weekly-export/__tests__/buildWeeklyExport.test.ts --config vitest.config.ts
```

Expected: both files pass with zero failures.

---

### Task 3: Weekly export workflow hook

**Files:**

- Create: `src/components/import-export-modal/__tests__/useWeeklyExportWorkflow.test.tsx`
- Create: `src/components/import-export-modal/useWeeklyExportWorkflow.ts`

- [ ] **Step 1: Write failing hook tests**

Mock only `useStorage`, file capability, Toast, and logger. Cover storage read at click time, pretty JSON, inclusive Sunday filename, empty/invalid/save-failure Toasts, success counts, and normalized unexpected errors. Exercise:

```ts
const { result } = renderHook(() =>
  useWeeklyExportWorkflow({ history: [record] }),
);

await act(async () => {
  await result.current('current');
});

expect(storageGetChainsMock).toHaveBeenCalledOnce();
expect(saveFileMock).toHaveBeenCalledWith(
  expect.stringContaining('"format": "momentum-weekly-activity"'),
  'momentum-weekly-2026-09-21_2026-09-27.json',
);
```

Use fake system time and restore real timers in cleanup.

- [ ] **Step 2: Run the hook test and verify RED**

```powershell
npx vitest run src/components/import-export-modal/__tests__/useWeeklyExportWorkflow.test.tsx --config vitest.config.ts
```

Expected: FAIL because the hook module does not exist.

- [ ] **Step 3: Implement the hook**

```ts
export function useWeeklyExportWorkflow(params: {
  history: CompletionHistory[];
}): (preset: WeeklyPeriodPreset) => Promise<void>;
```

The callback captures one `now`, computes the range, awaits `storage.getChains()`, resolves the IANA timezone with an `'UTC'` fallback, calls the builder, maps result failures to bilingual Toasts, formats the Sunday filename using local calendar arithmetic, and calls `saveFile(JSON.stringify(data, null, 2), filename)`. Show success only when saving returns `true`. Normalize and log unexpected failures under `IMPORT_EXPORT` before showing an error Toast.

- [ ] **Step 4: Run Step 2 again and verify GREEN**

Expected: the hook test passes without leaked timers or unhandled promises.

---

### Task 4: Existing export-modal integration

**Files:**

- Modify: `src/components/import-export-modal/ExportTab.tsx`
- Modify: `src/components/ImportExportModalView.tsx`
- Modify: `src/components/ImportExportModalContainer.tsx`
- Modify: `src/components/__tests__/ImportExportModalView.test.tsx`
- Modify: `src/components/__tests__/ImportExportModalContainer.test.tsx`

- [ ] **Step 1: Extend view tests first**

Add these default props:

```ts
weeklyPeriod: 'current' as const,
onWeeklyPeriodChange: vi.fn(),
onWeeklyExport: vi.fn(),
```

Assert that both export buttons render, privacy copy mentions descriptions and notes, selecting “Previous week” calls `onWeeklyPeriodChange('previous')`, and clicking “Export AI weekly raw data” calls `onWeeklyExport()`.

- [ ] **Step 2: Add failing container wiring tests**

Mock `useWeeklyExportWorkflow` with a hoisted callback. Assert it receives `history`, the default period is `current`, period changes reach view state, the weekly button invokes the callback with the selected period, and the existing full-export test remains unchanged.

- [ ] **Step 3: Run both modal tests and verify RED**

```powershell
npx vitest run src/components/__tests__/ImportExportModalView.test.tsx src/components/__tests__/ImportExportModalContainer.test.tsx --config vitest.config.ts
```

Expected: FAIL because weekly props and controls are absent.

- [ ] **Step 4: Implement the minimal wiring and UI**

In the container:

```ts
const [weeklyPeriod, setWeeklyPeriod] =
  useState<WeeklyPeriodPreset>('current');
const handleWeeklyExport = useWeeklyExportWorkflow({
  history: props.history ?? [],
});
```

Pass `weeklyPeriod`, `onWeeklyPeriodChange`, and `onWeeklyExport={() => handleWeeklyExport(weeklyPeriod)}` through the View to `ExportTab`.

Retain the full-backup section unchanged. Add a separate section with bilingual heading/privacy copy, an accessible current/previous radio group, and a distinct download button. Do not add preview, sharing, custom dates, or AI instructions.

- [ ] **Step 5: Run Step 3 again and verify GREEN**

Expected: both modal tests pass, including existing backup-export assertions.

---

### Task 5: Focused regression and static verification

- [ ] **Step 1: Run all new and affected tests**

```powershell
npx vitest run src/services/weekly-export/__tests__/dateRange.test.ts src/services/weekly-export/__tests__/buildWeeklyExport.test.ts src/components/import-export-modal/__tests__/useWeeklyExportWorkflow.test.tsx src/components/__tests__/ImportExportModalView.test.tsx src/components/__tests__/ImportExportModalContainer.test.tsx --config vitest.config.ts
```

Expected: zero failed tests.

- [ ] **Step 2: Run TypeScript checking**

```powershell
npm run typecheck
```

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 3: Run lint**

```powershell
npm run lint
```

Expected: exit code 0. Report unrelated baseline findings separately and do not fix unrelated files.

- [ ] **Step 4: Run the production build**

```powershell
npm run build
```

Expected: exit code 0. Do not deploy generated assets.

- [ ] **Step 5: Inspect the scoped diff**

```powershell
git status --short
git diff -- src/services/weekly-export src/components/import-export-modal src/components/ImportExportModalContainer.tsx src/components/ImportExportModalView.tsx src/components/__tests__/ImportExportModalView.test.tsx src/components/__tests__/ImportExportModalContainer.test.tsx docs/superpowers/specs/2026-09-23-weekly-ai-raw-export-design.md docs/superpowers/plans/2026-09-23-weekly-ai-raw-export.md
```

Expected: only approved weekly-export files and the new design/plan documents appear in the scoped diff; unrelated changes remain untouched.

- [ ] **Step 6: Report evidence without committing**

Report implemented behavior, exact verification results, any baseline or unverified items, changed files, and confirmation that no commit, push, deployment, dependency installation, database change, or external network access occurred.
