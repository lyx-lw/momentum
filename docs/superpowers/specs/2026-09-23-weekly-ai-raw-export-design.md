# AI 周报原始数据导出设计

## 目标

Momentum PWA 负责按自然周导出结构化的原始业务数据，外部 AI 负责根据该数据生成 Markdown 周报。PWA 不调用 AI、不上传数据、不生成周报文本。

## 范围

第一版在现有“数据管理 → 导出数据”界面增加“AI 周报原始数据”区块：

- 周期仅支持“本周”和“上周”；
- 输出格式仅为 JSON 文件；
- 复用现有文件保存能力；
- 不增加定时任务、系统分享、云同步、AI API 或提示词；
- 不修改现有完整备份的 `3.0` 格式和导入流程；
- 不修改数据库、本地存储结构或任务执行记录的写入流程。

## 数据口径

### 活动定义

第一版只把完成历史中的成功完成和中断记录视为本周活动。任务链的名称、描述和层级只作为上下文，不把任务创建、改名或描述修改声称为本周成果。

所有周期内记录均导出：

- 成功记录保留完成描述和备注；
- 中断记录保留失败原因；
- 没有周期内记录的任务链不输出。

### 自然周

使用设备本地日期组件计算周界，周一为一周开始，筛选区间为左闭右开 `[start, endExclusive)`：

- 本周：本周一 00:00 至下周一 00:00；
- 上周：上周一 00:00 至本周一 00:00。

`dataThrough` 表示实际导出时刻。导出本周且尚未到下周一时，`isPartialPeriod` 为 `true`；完整的上周为 `false`。时间序列化使用 ISO 8601，同时记录 `Intl.DateTimeFormat().resolvedOptions().timeZone` 返回的 IANA 时区。

## 数据读取与关联

导出动作发生时，通过正式 `MomentumStorage` 接口读取全部任务链，以同时覆盖活动任务链和回收箱中的软删除任务链。完成历史使用弹窗已经接收的应用状态快照。

任务链关联规则：

- 找到活动任务链：`chainState` 为 `active`；
- 找到软删除任务链：`chainState` 为 `deleted`；
- 永久删除后无法关联：记录进入顶层 `unresolvedRecords`；
- 子任务有活动但父任务没有活动：父任务只进入 `chainPath`，不生成独立活动组；
- 父链关系发生循环：使用已访问 ID 集合终止遍历，保留可解析路径并写入 `warnings`。

## JSON 契约

周报源文件是独立、不可导回 Momentum 的格式：

```json
{
  "format": "momentum-weekly-activity",
  "schemaVersion": 1,
  "exportedAt": "2026-09-23T12:00:00.000Z",
  "timezone": "Asia/Shanghai",
  "period": {
    "start": "2026-09-20T16:00:00.000Z",
    "endExclusive": "2026-09-27T16:00:00.000Z"
  },
  "dataThrough": "2026-09-23T12:00:00.000Z",
  "isPartialPeriod": true,
  "chains": [],
  "unresolvedRecords": [],
  "warnings": []
}
```

### 任务链组

```ts
interface WeeklyChainGroup {
  chain: {
    id: string;
    parentId?: string;
    name: string;
    description: string;
    type: ChainType;
    trigger: string;
    createdAt: string;
  };
  chainPath: Array<{ id: string; name: string }>;
  chainState: 'active' | 'deleted';
  records: WeeklyActivityRecord[];
}
```

### 执行记录

```ts
interface WeeklyActivityRecord {
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
```

任务链组按组内第一条记录时间升序排列；组内记录也按 `completedAt` 升序排列。不得去重或合并历史记录。

`unresolvedRecords` 使用同一个 `WeeklyActivityRecord` 结构。`warnings` 是结构化警告数组，至少包含可稳定识别的警告代码和相关任务链 ID，不包含设备或账号信息。

## 组件与职责

新增纯业务模块：

```text
src/services/weekly-export/
  types.ts
  dateRange.ts
  buildWeeklyExport.ts
```

- `types.ts`：定义周报源格式及构造结果类型；
- `dateRange.ts`：根据本地时间计算本周/上周边界和文件名日期；
- `buildWeeklyExport.ts`：筛选、分组、构造层级路径、排序、验证并生成 JSON 对象，不依赖 React 或浏览器下载 API。

新增专用 UI Hook，负责：

1. 从 `useStorage()` 获取正式存储实例；
2. 点击导出时调用 `storage.getChains()` 获取活动及软删除任务链；
3. 调用纯构造器；
4. 使用现有平台文件能力保存格式化 JSON；
5. 显示成功、空数据、异常数据或保存失败 Toast；
6. 使用现有 `logger` 记录技术错误。

现有 `ImportExportModalContainer` 负责组合该 Hook，`ExportTab` 负责展示周期选择和两个互不影响的导出区块。所有新增用户可见文案使用现有 `tr(中文, English)` 模式。

## 用户界面

“导出数据”页签保留原有“导出全部数据”区块，并增加：

- 标题：`AI 周报原始数据`；
- 说明：仅导出所选自然周的任务执行记录、任务描述与备注；文件只有在用户主动交给外部 AI 后才离开设备；
- 两项周期选择：`本周`、`上周`；
- 按钮：`导出 AI 周报原始数据`。

文件名格式：

```text
momentum-weekly-YYYY-MM-DD_YYYY-MM-DD.json
```

其中结束日期为该自然周的周日日期，而 JSON 内仍使用精确的 `endExclusive`。

## 反馈与错误处理

- 所选周期无记录：不创建文件，提示“所选自然周没有完成或中断记录，无需导出”；
- 无效 `completedAt`：阻止导出并提示数据异常，避免不可信的时间筛选；
- 父链循环：继续导出，在 `warnings` 中记录；
- 永久删除链条：记录进入 `unresolvedRecords`；
- 保存能力不可用或保存失败：显示错误 Toast 并记录日志；
- 保存成功：提示导出的任务链组数和执行记录总数。

## 测试与验收

采用 TDD，先编写失败测试，再实现行为。

纯业务测试覆盖：

- 周一开始的本周和上周边界；
- 月末、年末及本地时区边界；
- 左闭右开筛选；
- 成功和中断记录完整保留；
- 没有活动的任务链不输出；
- 父链仅作为路径上下文；
- 软删除链条分组；
- 永久删除链条进入 `unresolvedRecords`；
- 父链循环产生警告且不会无限遍历；
- 无效日期阻止导出；
- 任务链组和记录的稳定排序。

组件及 Hook 测试覆盖：

- 本周/上周选择；
- 点击后读取全部任务链并保存正确文件；
- 空数据不保存且显示提示；
- 保存失败显示错误；
- 成功反馈包含任务链组数和记录数；
- 原有完整备份按钮行为不回归。

实现后的验证命令需再次获得用户确认，计划运行相关 Vitest 文件、`npm run typecheck`、`npm run lint` 和 `npm run build`。不运行完整覆盖率、集成套件或变异测试。

## 非目标

- 自动定时导出；
- PWA 后台执行；
- Web Share API；
- AI API 或内置提示词；
- Markdown 周报生成；
- 周报历史管理；
- 自定义日期范围；
- 任务编辑审计日志；
- 数据脱敏编辑器；
- Git 提交、推送或部署。
