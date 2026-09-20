# RSIP 每日执行反馈 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保持现有自然日连续执行规则不变，同时明确展示连续与累计执行数据、阻止当天重复执行，并在漏日后重新执行前进行确认。

**Architecture:** 在现有 `dailyRules.ts` 中增加纯函数，统一判断本次执行是否会重置连续记录。`RSIPStrictModeCard` 负责当天按钮状态和重置确认交互，复用通用 `ConfirmationDialog`；`RSIPPhaseProgress` 只负责展示连续进度与累计天数，不修改领域持久化逻辑。

**Tech Stack:** React、TypeScript、Vitest、Testing Library、Tailwind CSS

---

### Task 1: 共享连续记录中断判断

**Files:**

- Modify: `src/hooks/domains/rsip/dailyRules.ts`
- Test: `src/components/rsip/__tests__/RSIPStrictModeCard.test.tsx`

- [x] **Step 1: 先在卡片测试中覆盖日期边界行为**

使用本地时间构造固定日期，覆盖今天、昨天、漏一天和首次执行，避免测试依赖 UTC 时区：

```tsx
const now = new Date(2026, 8, 7, 12);
vi.setSystemTime(now);

const missedDayNode = createNode({
  lastExecutedAt: new Date(2026, 8, 5, 12),
  consecutiveExecutions: 2,
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `npx vitest run --config vitest.config.ts src/components/rsip/__tests__/RSIPStrictModeCard.test.tsx`

Expected: FAIL，因为连续记录中断判断和确认交互尚未实现。

- [x] **Step 3: 增加纯判断函数**

在 `dailyRules.ts` 增加：

```ts
export function willResetExecutionStreak(
  node: RSIPNode,
  now = new Date(),
): boolean {
  if (!node.lastExecutedAt || (node.consecutiveExecutions ?? 0) <= 0) {
    return false;
  }

  const lastExecutionDate = node.lastExecutedAt.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  return (
    lastExecutionDate !== now.toDateString() &&
    lastExecutionDate !== yesterday.toDateString()
  );
}
```

该函数只复用现有本地自然日口径，不改变 `nextExecutionStreak()` 的行为。

### Task 2: 明确连续与累计执行信息

**Files:**

- Modify: `src/components/rsip/RSIPPhaseProgress.tsx`
- Modify: `src/components/rsip/RSIPStrictModeCard.tsx`
- Test: `src/components/rsip/__tests__/RSIPStrictModeCard.test.tsx`

- [x] **Step 1: 编写显示行为测试**

渲染 E0 与 E2 节点并断言：

```tsx
expect(screen.getByText('连续执行进度')).toBeInTheDocument();
expect(screen.getByText('连续 2 天 · 累计 8 天')).toBeInTheDocument();
```

E2 仍应显示连续与累计信息，同时保留“已内化”状态。

- [x] **Step 2: 扩展进度组件接口**

将接口调整为：

```ts
interface RSIPPhaseProgressProps {
  phase: RSIPStabilityPhase;
  consecutiveDays: number;
  cumulativeDays: number;
}
```

顶部明确显示“连续执行进度”，阶段目标显示在右侧；进度条下方增加：

```tsx
<p className="text-xs text-slate-500 dark:text-white/50">
  连续 {consecutiveDays} 天 · 累计 {cumulativeDays} 天
</p>
```

- [x] **Step 3: 从卡片传入累计天数**

使用 `node.cumulativeExecutionDays ?? 0`，不把 `totalExecutions` 当作累计天数回退值，避免混淆“执行次数”和“执行天数”。

### Task 3: 当天禁用与漏日确认

**Files:**

- Modify: `src/components/rsip/RSIPStrictModeCard.tsx`
- Test: `src/components/rsip/__tests__/RSIPStrictModeCard.test.tsx`

- [x] **Step 1: 编写交互测试**

覆盖以下真实行为：

```text
今天已执行 -> 按钮禁用，文案为“今日已执行”
昨天执行 -> 直接调用 onMarkExecuted
漏一天 -> 打开确认弹窗，尚未调用 onMarkExecuted
取消确认 -> 关闭弹窗且不执行
确认执行 -> 关闭弹窗并且只调用一次 onMarkExecuted
首次执行 -> 不弹窗，直接执行
```

- [x] **Step 2: 实现按钮状态**

通过 `hasExecutedToday(node)` 计算状态，原生设置 `disabled`，并使用禁用样式：

```tsx
disabled = { executedToday };
onClick = { handleExecutionClick };
```

按钮文案为 `executedToday ? '今日已执行' : '已执行'`，禁用状态不得触发回调。

- [x] **Step 3: 复用通用确认弹窗**

卡片内部维护确认弹窗开关，并在 `willResetExecutionStreak(node)` 为真时先显示：

```tsx
<ConfirmationDialog
  isOpen={showResetConfirmation}
  title="连续执行已中断"
  message="距上次执行已间隔至少一个自然日，本次将从第 1 天重新开始；累计执行天数不受影响。是否确认执行？"
  confirmText="确认执行"
  cancelText="取消"
  confirmButtonClass="bg-emerald-600 hover:bg-emerald-700"
  onConfirm={handleConfirmExecution}
  onCancel={() => setShowResetConfirmation(false)}
/>
```

取消不得写入；确认时先关闭弹窗，再调用现有 `onMarkExecuted`。本次不增加跨午夜自动刷新计时器。

### Task 4: 针对性验证与原子提交

**Files:**

- Test: `src/components/rsip/__tests__/RSIPStrictModeCard.test.tsx`
- Verify: `src/hooks/domains/rsip/dailyRules.ts`
- Verify: `src/components/rsip/RSIPPhaseProgress.tsx`
- Verify: `src/components/rsip/RSIPStrictModeCard.tsx`
- Include: `docs/superpowers/plans/2026-09-20-rsip-daily-execution-feedback.md`

- [x] **Step 1: 运行直接组件测试**

Run: `npx vitest run --config vitest.config.ts src/components/rsip/__tests__/RSIPStrictModeCard.test.tsx`

Expected: 新增用例全部 PASS。

- [x] **Step 2: 运行相邻 RSIP 测试**

Run: `npx vitest run --config vitest.config.ts src/components/rsip/__tests__/RSIPTreeTab.test.tsx src/hooks/domains/rsip/__tests__/viewInteractionRules.test.ts`

Expected: 相邻组件和领域回归全部 PASS。

- [x] **Step 3: 执行静态验证**

Run: `npm run typecheck`

Expected: TypeScript 检查通过。

Run: `npx eslint src/hooks/domains/rsip/dailyRules.ts src/components/rsip/RSIPPhaseProgress.tsx src/components/rsip/RSIPStrictModeCard.tsx src/components/rsip/__tests__/RSIPStrictModeCard.test.tsx`

Expected: ESLint 检查通过。

Run: `npx prettier --check docs/superpowers/plans/2026-09-20-rsip-daily-execution-feedback.md src/hooks/domains/rsip/dailyRules.ts src/components/rsip/RSIPPhaseProgress.tsx src/components/rsip/RSIPStrictModeCard.tsx src/components/rsip/__tests__/RSIPStrictModeCard.test.tsx`

Expected: Prettier 检查通过。

- [x] **Step 4: 检查并创建原子提交**

先运行 `git status --short` 和 `git diff --check`。仅暂存以下文件，不包含用户已有的 `docs/README.md` 和 `docs/guides/RSIP_POLICY_GROUP_DESIGN_GUIDE.md`：

```text
docs/superpowers/plans/2026-09-20-rsip-daily-execution-feedback.md
src/hooks/domains/rsip/dailyRules.ts
src/components/rsip/RSIPPhaseProgress.tsx
src/components/rsip/RSIPStrictModeCard.tsx
src/components/rsip/__tests__/RSIPStrictModeCard.test.tsx
```

Run: `git commit -m "fix(rsip): clarify daily execution progress"`

Expected: 生成一个只包含本任务文件的提交，不执行 push。
