# Momentum 生产主线对齐完成记录

**对应计划：** `2026-09-29-production-mainline-reconciliation.md`
**记录日期：** 2026-09-29
**当前结论：** 生产主线切换、生产交接文档本地整理、Supabase 候选隔离和手机 PWA 运行验收均已完成。Supabase 候选已推送到远端归档分支；`main` 的文档变更仍未推送，稳定周期后的 tag 与清理尚未完成。

## 1. 当前生产结论

| 项目 | 当前值 | 状态 |
| --- | --- | --- |
| GitHub 仓库 | `lyx-lw/momentum` | 已核验 |
| GitHub 默认分支 | `main` | 已切换 |
| Netlify 站点 | `momentum-lyx` | 已核验 |
| Netlify production branch | `main` | 已切换 |
| 当前生产提交 | `7fdadaf77d9e6b301c198ea14e0e0bb2c6e6d6d0` | 已发布 |
| 当前生产 deploy | `6abb28fc1297987b85ed8974` | Published |
| 旧生产回滚点 | `5aa9b4a2b77abde97fdf39c58e652b8256ab4bf1` | 保留 |
| 旧生产 deploy | `6ab93de32ecf42000835f1a7` | 历史回滚证据 |
| 生产存储边界 | 本地存储 | 未引入 Supabase 生产迁移 |

线上只读冒烟检查确认：生产首页可加载，入口脚本、样式、`manifest.webmanifest` 和 `sw.js` 均正常加载；未执行签到、创建链、导入、导出或其他业务数据写入。

## 2. 原计划逐项完成情况

### Task 1：原样封存当前混合工作区 — 已完成

- 已创建本地归档分支 `archive/local-main-20260929`。
- 已创建归档提交：
  `ad4500077ebae867668dcc58f8563d39c8f0537a`，提交说明为
  `chore(archive): preserve mixed local workspace`。
- 提交前 `git write-tree` 与提交 tree 已核对一致：
  `6a15ec8c8362b57bb73e99a97d3cc1ba48d4a5b0`。
- 归档提交包含 58 个项目文件。
- 以下临时目录按计划保留，未提交、未删除：
  - `tmp_pwa_acceptance_20260927/`
  - `tmp_weekly_report_acceptance_20260923/`
- 生成本记录前，归档工作树除上述两个目录外无其他未跟踪或未提交内容。

偏差/补充：尚未生成独立的文件清单与逐文件哈希 manifest；当前使用 Git commit/tree SHA 作为归档完整性锚点。

### Task 2：从实时生产提交建立隔离的 `main` — 已完成

- 已以旧生产提交
  `5aa9b4a2b77abde97fdf39c58e652b8256ab4bf1`
  为基线创建 `main`。
- 已创建隔离工作树：
  `D:\Document\Codex\Momentum\momentum\.worktrees\mainline`。
- 创建时 `main` tree 与旧生产 tree 均为：
  `b495447d6662192d2d5a24eda4935e3668fd9d94`。
- 托管 worktree 能力当时不可用，因此使用原生 Git worktree；隔离结果符合计划目标。

后续 Task 3 增加了测试契约修正提交 `7fdadaf`，其 tree 为
`f5fc00a98136aca67c001c4e8fcbf9e205e3303f`。Task 5 又在本地增加了纯文档提交 `1b664f2`。线上生产仍停在 `7fdadaf`；本地 `main` 与线上生产 HEAD 的差异仅为尚未推送的交接文档提交。

### Task 3：执行 `main` 本地发布门禁 — 已完成

首次全量测试发现既有 B05 回归测试将持久化原始对象与读取后的规范化对象做严格深比较。存储解码会补齐默认值和可选字段，因此该断言与实际存储契约不一致。

处理结果：

- 仅修改
  `src/hooks/domains/__tests__/rsipComputerUseRegressions.test.ts`；
- 将严格对象相等调整为对规范化结果使用 `objectContaining`；
- 提交：`7fdadaf77d9e6b301c198ea14e0e0bb2c6e6d6d0`
  (`test: match normalized RSIP nodes`)；
- `npm test`：265 个测试文件、1982 个测试通过；
- `npm run typecheck`：通过；
- `npm run lint`：通过；
- `npm run build`：通过；
- `git diff --check`：通过。

构建存在非阻塞提示：Browserslist 的 `caniuse-lite` 数据较旧，并生成空的 `vendor-supabase` chunk；本次未升级依赖或调整打包配置。

### Task 4：推送 `main` 并分阶段切换生产 — 已完成

- `fork/main` 已推送并设置为本地 `main` 的 upstream。
- 执行生产切换时，`main` 与 `fork/main` 均指向
  `7fdadaf77d9e6b301c198ea14e0e0bb2c6e6d6d0`。
- GitHub 默认分支已从 `new-feature-branch` 切换为 `main`。
- Netlify production branch 已从 `fix/mobile-focus-pwa` 切换为 `main`。
- 新生产部署：`6abb28fc1297987b85ed8974`。
- Netlify 显示：`Production: main@7fdadaf`、Published，构建和部署耗时 26 秒。
- 线上只读冒烟检查通过。

手机 PWA 人工运行验收：联网状态下完全关闭后重开通过；断网状态下完全关闭后重开通过；最新功能界面可见，离线缓存可用。由于 `7fdadaf` 只修改测试代码，构建产物与旧生产相同，无法从 UI 证明设备缓存与 deploy `6abb28fc1297987b85ed8974` 的精确绑定，也不应据此声称 Service Worker 下载了新资源。

### Task 5：更新生产交接文档 — 已完成本地整理，未推送

- 已更新外层 `D:\Document\Codex\Momentum\PROJECT_STATUS.md`；该文件不属于 Git 仓库，单独保留。
- 已在 `main` 更新 `AGENTS.md`。
- 原计划中的 `docs/guides/NETLIFY_PWA_HANDOFF.md` 在生产基线中不存在；已从归档历史提取有效信息，并在 `main` 新建当前交接文档。
- 本地提交：`1b664f23f90e4a0dd434781c387e76ef248bbe18`
  (`docs: record mainline production handoff`)。
- 本次两个文档的定向 Markdown 检查：2 个文件、0 个错误。
- 已单独审查既有文件
  `docs/superpowers/plans/2026-09-20-rsip-daily-execution-feedback.md`
  的 MD001：文档从一级标题直接跳到四个三级 Task 标题；已将四个 Task 标题统一校正为二级，未改动正文。
- 手机联网/离线重开验收完成后，已在 handoff 中补写准确口径，并单独提交为
  `e31a985` (`docs: record mobile PWA runtime acceptance`)。
- `main` 的应用代码仍与线上生产 `7fdadaf` 一致；其后变更均为尚未 push 的文档收口内容，因此尚未触发新的 Netlify 部署。

### Task 6：隔离 Supabase 候选实现 — 已完成并推送归档分支

- 已从 `fork/main@7fdadaf` 创建隔离分支和工作树：
  `archive/supabase-rsip-frequency`。
- 已从 `archive/local-main-20260929` 精确提取 12 个文件：Supabase RSIP 适配器、数据库类型、迁移和 5 个直接相关测试；未混入 UI、周报副本或其他归档差异。
- 候选提交：`e870b9d`
  (`chore(archive): isolate Supabase RSIP frequency candidate`)。
- 干净基线 `npm test`：265 个测试文件、1982 个测试通过。
- 候选定向测试：5 个测试文件、50 个测试通过。
- `npm run typecheck`：通过；`git diff --check`：通过。
- 安装依赖时 npm 报告现有依赖树包含 40 个漏洞（3 low、13 moderate、21 high、3 critical）；未执行自动修复或依赖升级。
- 候选 SQL 为 607 行，除新增字段外还重建两个原子 RPC；未连接真实数据库，未执行迁移，未验证生产 schema、RLS/RPC、登录或迁移行为。
- 候选分支已推送为 `fork/archive/supabase-rsip-frequency`；本地 HEAD 与远端跟踪分支均为 `e870b9d3e8825d466c670b7f9173fa4d318a847d`。
- 未创建 PR，未合并到 `main`，未部署，也未执行数据库迁移。

### Task 7：稳定后退役已合并分支和旧工作树 — 等待中

- 稳定周期从 2026-09-29 的生产切换和手机验收开始，计划连续观察 7 天；核心路径无故障时，最早于 2026-10-06 进入 tag 和清理阶段。
- 观察覆盖联网启动、离线冷启动、本地数据读取、签到、RSIP 执行与跨日状态、周报导出；核心故障会中断周期，纯文案或非阻塞样式问题只记录、不重新计时。
- 产物不变的纯文档部署不重置稳定周期。
- 尚未建立生产切换前后 release tag。
- 尚未重新证明所有候选旧分支均被 `main` 完整包含。
- 未删除任何远端分支、工作树或临时目录。
- `feat/rsip-policy-editing` 按既定边界继续保留，未整合到本次生产主线。

## 3. 当前本地状态

| 工作树/分支 | HEAD | 说明 |
| --- | --- | --- |
| `archive/local-main-20260929` | `ad45000` | 混合工作区归档；完成记录和两个 `tmp_*` 目录未跟踪 |
| `main` | `7fdadaf`（生产代码基准） | 应用代码与生产一致；其后仅有尚未 push 的文档收口变更 |
| `archive/supabase-rsip-frequency` | `e870b9d` | 非生产候选；已推送远端归档，本地已验证，未合并、未迁移 |
| `feat/rsip-policy-editing` | `0884ad8` | 独立待验收产品线，继续保留 |
| `fix/mobile-focus-pwa` | `ef56862` | 本地旧工作树落后远端历史生产提交 |
| `feat/rsip-local-execution-frequency` | `6f24ef1` | 已合并功能分支，待稳定周期后清理评估 |
| `feat/weekly-ai-export-production` | `1422fdd` | 已合并功能分支，待稳定周期后清理评估 |
| `deploy/rsip-daily-progress` | `ee3e82b` | 旧部署工作树，待稳定周期后清理评估 |

## 4. 下一步待完成内容

按优先级建议如下：

1. **P1：提交并推送文档收口变更。**
   保留已有提交历史，为 MD001 修复和本完成记录分别形成独立提交，再一次性 push；接受 Netlify 的纯文档构建，并在部署后核对 commit、deploy、静态资源哈希和线上核心路径。任一项异常即停止后续工作并诊断。
2. **P1：补充归档清单。**
   如需要逐文件审计，在独立 `tmp_inventory_20260929/` 中生成文件列表和哈希，核对后再决定是否纳入文档；不得污染项目根目录。
3. **P2：完成稳定周期并建立 tag。**
   在外层 `PROJECT_STATUS.md` 持续记录观察结果；周期通过后，为 `5aa9b4a` 和 `7fdadaf` 分别建立 annotated tag `production/pre-mainline-20260929` 与 `production/mainline-20260929`。
4. **P2：清理前复核。**
   证明已合并分支内容被 `main` 包含，盘点旧工作树和两个 `tmp_*` 目录；获得单独删除授权后，才可删除远端分支、工作树或临时目录。

## 5. 禁止误判

- “GitHub 默认分支已是 `main`”不等于旧分支可以立即删除。
- 手机 PWA 联网/离线重开通过，证明运行与离线缓存可用；在构建产物相同的情况下，不等于已证明设备缓存绑定到某个特定 deploy。
- Supabase 候选已形成提交并推送远端归档，不等于云端 schema、RLS、RPC、登录或迁移已验收。
- 本次完成的是生产主线对齐，不包含 `feat/rsip-policy-editing` 产品验收。
- 文档 push、生产 tag 和后续远端清理仍需分别获得授权。
