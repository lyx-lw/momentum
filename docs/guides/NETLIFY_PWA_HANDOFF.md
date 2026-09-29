# Netlify PWA 生产主线交接

更新时间：2026-09-29（Asia/Shanghai）

> 本文件是带日期的生产交接快照。涉及发布、回滚、分支整合或清理前，必须重新核对 GitHub、Netlify 和本地工作树，不得只根据本文执行远端操作。

## 当前生产事实

- Netlify 项目：`momentum-lyx`
- 正式站点：<https://momentum-lyx.netlify.app/>
- GitHub 仓库：<https://github.com/lyx-lw/momentum.git>
- GitHub 默认分支：`main`
- Netlify production branch：`main`
- 当前生产提交：

  ```text
  7fdadaf77d9e6b301c198ea14e0e0bb2c6e6d6d0
  7fdadaf test: match normalized RSIP nodes
  ```

- Netlify production deploy：`6abb28fc1297987b85ed8974`
- Netlify 状态：Published
- 构建时间：2026-09-29 10:57（Asia/Shanghai），构建与部署耗时 26 秒
- 旧生产回滚提交：`5aa9b4a2b77abde97fdf39c58e652b8256ab4bf1`
- 旧生产 deploy：`6ab93de32ecf42000835f1a7`
- 旧 production branch：`fix/mobile-focus-pwa`，继续保留用于审计和回滚判断

## 生产提交关系

```text
7fdadaf test: match normalized RSIP nodes                 ← 当前 main / Netlify
└─ 5aa9b4a Merge pull request #2 ...                     ← 旧生产回滚点
   └─ 6f24ef1 feat(rsip): support local execution frequency
      └─ 6d08ff9 Merge pull request #1 ...               ← 周报导出生产合并
```

`7fdadaf` 仅调整 B05 回归测试对存储规范化结果的断言：读取层会补齐默认值和可选字段，因此测试改为验证对象包含关系。该提交没有新增生产业务逻辑。

## 当前生产能力与数据边界

### AI 周报原始数据导出

- 入口：`数据管理 → 导出数据 → AI 周报原始数据`；
- 支持本周和上周的完成/中断记录；
- 导出结构化 JSON，不调用 AI、不上传数据、不生成 Markdown；
- 保留完整备份导入导出流程。

### RSIP 执行频率

- 本地存储模式可选择是否要求每日执行；
- 缺失或旧数据默认按每日执行处理；
- 显式 `false` 可跨自然日保留进度，但不改变同日去重、违规或崩塌语义；
- 该能力只在 `storage.kind === 'local'` 时开放；
- 生产未加入 Supabase schema、mapper、generated types 或 migration 变更。

### 存储模式

- 当前生产使用本地存储，无需账号登录；
- 仓库保留 Supabase 适配器，但本地与云端是不同数据源，不会自动迁移、合并或双写；
- 归档中的 Supabase RSIP-frequency 候选尚未隔离、测试或部署；
- 未执行 `20260924000000_add_rsip_execution_frequency.sql`，未完成真实数据库、RLS、RPC 或登录验收。

## 验证证据与边界

基于 `main@7fdadaf` 的本地发布门禁：

- `npm test`：265 个测试文件、1982 个测试通过；
- `npm run typecheck`：通过；
- `npm run lint`：通过；
- `npm run build`：通过；
- `git diff --check`：通过。

构建提示但不阻塞发布：

- Browserslist 的 `caniuse-lite` 数据较旧；
- 构建会产生空的 `vendor-supabase` chunk。

生产部署只读检查：

- Netlify 显示 `Production: main@7fdadaf` 且 Published；
- 首页标题为 `Momentum - 心理学驱动的专注力应用`；
- 入口资源包括 `assets/index-DX4hNyzq.js` 和 `assets/index-DUH8qe0g.css`；
- `manifest.webmanifest`、`registerSW.js` 和 `sw.js` 正常加载；
- Service Worker 激活脚本为正式域 `/sw.js`；
- 未点击签到、创建链、导入、导出或其他会写入业务数据的功能。

尚未完成的验收：在实体手机上完全关闭已安装 PWA 后重新打开，确认 Service Worker 和离线入口已切换到当前版本。

## 当前工作树与分支边界

| 工作树/分支 | HEAD | 状态与用途 |
| --- | --- | --- |
| `momentum\.worktrees\mainline` / `main` | `7fdadaf` | 当前生产主线；未来生产工作从此处开始 |
| `momentum` / `archive/local-main-20260929` | `ad45000` | 混合工作区归档；禁止整体合并到 `main` |
| `.worktrees\rsip-policy-editing` / `feat/rsip-policy-editing` | `0884ad8` | 独立待验收产品线；本轮不整合 |
| `momentum\.worktrees\mobile-pwa` / `fix/mobile-focus-pwa` | `ef56862` | 本地旧生产工作树；不代表当前线上版本 |
| `momentum\.worktrees\rsip-local-execution-frequency` | `6f24ef1` | 已合并功能分支；等待稳定周期后再评估清理 |
| `momentum\.worktrees\weekly-ai-export-production` | `1422fdd` | 已合并功能分支；不要重复 merge 或 cherry-pick |
| `momentum\.worktrees\rsip-pwa-deploy` | `ee3e82b` | 旧部署工作树；不再代表生产基线 |

归档工作区保留以下未跟踪目录：

- `tmp_pwa_acceptance_20260927/`
- `tmp_weekly_report_acceptance_20260923/`

未经明确授权，不得删除分支、工作树、归档提交或上述临时目录。

## Supabase 候选后续边界

计划从 `main` 创建非生产分支 `archive/supabase-rsip-frequency`，只选择性提取：

- `src/infra/storage/supabase/**`
- `src/lib/database.types.ts`
- `supabase/migrations/20260924000000_add_rsip_execution_frequency.sql`
- 直接相关的 Supabase contract tests

归档分支同时包含旧 UI、周报副本和其他测试差异，因此不得整体 merge 或整体 cherry-pick。候选分支完成本地验证后仍保持不合并、不部署、不执行迁移，直到数据库、RLS/RPC、登录和迁移方案分别获批并验收。

## 回滚基线

若 `main@7fdadaf` 出现生产问题，首选审计点为：

```text
5aa9b4a2b77abde97fdf39c58e652b8256ab4bf1
```

对应历史生产 deploy：

```text
6ab93de32ecf42000835f1a7
```

回滚前必须先确认故障范围、数据影响和 Netlify 当前状态；不得仅凭本文直接修改 production branch 或发布旧 deploy。

## 后续发布检查清单

1. 阅读本文件和外层 `PROJECT_STATUS.md`；
2. 获得联网和 Git 操作授权；
3. fetch 并核对 `fork/main` 的实时 HEAD；
4. 确认本地工作树干净且从实时 `main` 开始；
5. 分别执行测试、typecheck、lint、build 和 `git diff --check`；
6. 推送后核对 GitHub 分支 SHA；
7. 发布后核对 Netlify deploy ID、branch、commit SHA 和状态；
8. 对首页、manifest、Service Worker 和静态资源执行无业务写入检查；
9. 更新本文件中的生产提交、deploy ID、回滚点和工作树状态；
10. 分支、工作树和临时目录清理必须另行获得明确授权。
