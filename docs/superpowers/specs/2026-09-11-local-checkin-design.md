# 本地持久化签到设计

## 背景与目标

当前首页在本地存储模式下显示 `DailyCheckinDemo`。演示数据只存在于组件内存中，页面刷新后会重置，并提示用户配置 Supabase。这与当前 PWA “无需登录、仅依赖本机数据”的目标不一致。

本次改造的目标是复用现有 `CheckinGateway → CheckinService → useCheckinDomain → DailyCheckin` 数据链路，为本地存储适配器补齐正式签到能力。云端 Supabase 签到行为保持不变。

## 范围

本次包含：

- 本地保存签到统计；
- 每天固定奖励 10 积分；
- 以手机当前本地时区的自然日为签到日，00:00 换日；
- 计算当前连续天数和最长连续天数；
- 防止同一天重复增加积分和次数；
- 刷新、关闭和重新打开 PWA 后恢复签到数据；
- 本地模式直接显示正式签到组件；
- 移除演示标识、Supabase 说明和演示重置入口。

本次不包含：

- 签到历史列表；
- 连续签到额外奖励；
- 跨设备同步；
- 将签到数据纳入导入导出；
- 修复既有 RSIP 原子创建测试与回滚后实现不一致的问题。

## 数据设计

新增独立的本地存储键 `momentum_checkin_state`，保存版本化状态：

```ts
interface LocalCheckinState {
  version: 1;
  totalPoints: number;
  totalCheckins: number;
  currentStreak: number;
  longestStreak: number;
  lastCheckinDate: string | null;
}
```

`lastCheckinDate` 使用本地日历日期字符串 `YYYY-MM-DD`。不使用 `toISOString()` 截取日期，避免 UTC 与手机本地日期跨日不一致。

首次使用或本地键不存在时返回零值。读取到结构损坏或不支持的版本时采用安全零值，并记录可诊断错误；不让无效数值进入页面。

## 签到规则

执行签到时，存储层重新读取最新状态并取得当前本地日期：

1. 若 `lastCheckinDate` 等于今天，返回“已签到”结果，不写入、不增加积分和次数。
2. 若 `lastCheckinDate` 等于昨天，`currentStreak + 1`。
3. 若没有历史记录或连续签到中断，`currentStreak = 1`。
4. `longestStreak` 取原值与新连续天数的较大值。
5. `totalPoints + 10`，`totalCheckins + 1`。
6. 将完整状态通过一次 `localStorage.setItem` 写入后，才返回成功。

单次完整状态写入避免将积分、次数和连续天数拆成多个键造成部分更新。在同一 PWA 页面内，现有 `isCheckingInRef` 防止重复点击并发请求。

## 架构与数据流

本地实现放在存储工具层，由 `localStorageAdapter` 的 `performDailyCheckin` 和 `getUserCheckinStats` 调用。React 组件不直接访问 `localStorage`。

```text
DailyCheckin
  → useCheckinDomain
  → MomentumStorage / CheckinGateway
  → localStorageAdapter
  → local check-in repository
  → momentum_checkin_state
```

本地适配器的 `capabilities.checkin` 改为 `true`。Dashboard 因此选择现有正式 `DailyCheckin`；Supabase 模式仍通过原有 RPC 实现。

## UI 行为

- 保留当前正式签到卡片的布局、积分、连续天数和总签到展示。
- 未签到时显示“每日签到 +10 积分”。
- 当天签到成功后显示成功反馈并切换为已签到状态。
- 页面刷新后根据本地状态继续显示已签到状态。
- 不显示“演示模式”、Supabase 配置说明或重置图标。
- 继续使用现有加载态和错误态，存储失败时不显示成功反馈。

## 错误处理

- `localStorage.setItem` 抛错时返回领域错误，内存 UI 不提交成功状态。
- 同日重复签到返回成功的幂等结果，其中 `already_checked_in = true`、`points_earned = 0`；统计数据保持不变。
- 损坏数据不导致页面崩溃；读取采用零值回退，并允许下一次成功签到覆盖为有效版本。
- 清除浏览器站点数据或卸载并清除 PWA 数据仍会删除签到记录，这是纯本地存储的固有限制，应在后续导入导出阶段补充备份能力。

## 测试设计

按测试驱动流程覆盖：

1. 本地能力声明支持签到，Dashboard 不再选择演示组件。
2. 无历史状态时返回零值统计。
3. 首次签到固定增加 10 积分，次数与连续天数为 1。
4. 同一本地自然日重复签到不重复计分。
5. 下一自然日签到延续 streak。
6. 间隔一天以上签到将 streak 重置为 1，并保留 longest streak。
7. 新适配器实例能够读取先前写入的数据，验证刷新恢复。
8. 损坏数据安全回退。
9. 写入失败时返回错误且不报告签到成功。
10. 现有 Supabase 签到测试继续通过。

完成实现后运行签到相关测试、Dashboard 测试、类型检查和生产构建。全量测试仍需单独报告既有 RSIP 原子创建陈旧测试的状态。

## 验收标准

- 本地模式首页只显示正式签到卡片；
- 手机点击签到后积分增加 10，连续天数和总签到正确更新；
- 同日再次打开或刷新页面不会重复签到；
- 模拟跨日后连续规则符合设计；
- 不需要登录、Supabase、域名或网络连接；
- 现有任务链、RSIP、云端签到和其他本地数据不受影响。
