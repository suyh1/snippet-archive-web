# Snippet Archive Web 产品升级执行方案

> 目标：把当前“可编辑的个人代码片段仓库”升级为“可沉淀、可检索、可协作、可扩展的工程化产品”。
> 适用方式：可直接按本文拆分新线程执行。

## 必须遵守：文档维护规则

> 强制要求：本节规则必须遵守。

1. 本文件作为“主路线图”，后续只增量更新，不拆散为大量历史计划。
2. 每个新线程完成后，在本文件追加“执行记录”小节（日期/目标/结果/待办）。
3. 所有已过时计划文档不再保留，避免上下文噪声。

## 必须遵守：执行与追踪规则

> 强制要求：本节规则必须遵守。

1. 计划细化统一维护在本文件中，不再拆分到独立计划文档；新线程的详细步骤直接追加到对应线程小节。
2. 每个功能/线程完成后，必须在本文件对应条目显式标记“已完成”（例如在线程清单中标注 `✅`）。
3. 标记完成的同一次提交中，必须追加执行记录（日期、目标、结果、验证命令与结论），保证“任务状态”与“证据”同步更新。

## 1. 现状与升级方向

### 1.1 当前能力（已具备）

1. 工作区与文件树管理（新建/删除/移动/重命名）。
2. CodeMirror 编辑能力（语言识别、状态栏、搜索替换、撤销重做）。
3. 自动保存、未保存保护、快照回滚。
4. 主题模块化与导入导出、预置主题即时切换。
5. 前后端联调与基础测试体系（Vitest + Playwright + Typecheck + Build）。

### 1.2 核心短板（待补齐）

1. 缺少“全局检索与知识发现”能力（仅有目录浏览，不适合大规模沉淀）。
2. 缺少账号、团队、权限、共享等协作基建。
3. 缺少“版本历史 + 审计”模型（当前快照偏本地编辑辅助，不是协作治理能力）。
4. 缺少 IDE/CLI/外部平台接入能力。
5. 前端核心文件体量过大，后续迭代风险升高。

### 1.3 产品定位建议（推荐）

采用“个人效率优先，团队协作预埋”的双阶段定位：

1. 阶段 1 先把个人效率做到显著领先（检索、标签、版本、捕获效率）。
2. 阶段 2 再引入团队协作与权限治理。
3. 阶段 3 扩展 IDE/CLI 生态，形成差异化护城河。

## 2. 三阶段路线图（可执行版）

## 2.1 阶段一（2-4 周）：个人效率升级

当前状态：✅ 全面完成（含收口项与性能验收证据）。

### 目标

让用户从“能管理片段”升级为“能快速找到、复用、追溯片段”。

### 范围与交付

1. 全局搜索中心（关键词 + 过滤器）。
2. 标签体系（工作区标签 + 文件标签）与收藏视图。
3. 历史版本 v1（持久化 revision + diff + 回滚）。
4. 快速捕获 v1（应用内快捷入口，减少路径成本）。

### 需求拆解

1. 全局搜索中心
   - 支持按标题、路径、内容、语言、标签、更新时间筛选。
   - 支持保存搜索条件（“视图预设”）。
2. 标签与收藏
   - `Workspace` 与 `WorkspaceFile` 都支持多标签。
   - 收藏项支持单独聚合页面。
3. 历史版本 v1
   - 每次保存创建 revision 记录（作者、时间、摘要、内容快照/差异）。
   - 提供版本列表与任意版本回滚。
4. 快速捕获 v1
   - 全局按钮 + 快捷键打开“新建片段弹窗”。
   - 可直接设置语言、标签、目标工作区。

### 技术改造（对应当前代码）

1. 前端
   - 将 `App.vue` 拆成路由级页面：`WorkspacePage`、`SettingsPage`、`SearchPage`。
   - 拆分 store：`workspaceStore`、`searchStore`、`themeStore`。
   - 新增 `RevisionPanel`、`SearchCenter`、`QuickCaptureDialog` 组件。
2. 后端
   - 新增搜索接口：`GET /api/search/snippets`。
   - 新增 revision 接口：
     - `GET /api/workspaces/:workspaceId/files/:fileId/revisions`
     - `POST /api/workspaces/:workspaceId/files/:fileId/revisions/:revisionId/restore`
3. 数据库（Prisma）
   - 新增 `WorkspaceFileRevision` 表。
   - 为 `WorkspaceFile.path/language/content` 增加检索索引策略。
   - 新增标签关联表（或数组字段 + 索引，建议关联表便于后续统计）。

### 验收标准（DoD）

1. 搜索 1k+ 片段时交互可用（响应 < 500ms，分页稳定）。
2. 任意文件可查看 revision 列表并成功回滚。
3. 标签过滤 + 收藏过滤均支持组合。
4. 回归测试全通过（targeted + full + typecheck + build）。

## 2.2 阶段二（4-8 周）：团队协作升级

当前状态：✅ 已完成（线程 F/G/H 全部验收通过）。

### 目标

把“个人工具”升级为“可团队治理的片段知识库”。

### 范围与交付

1. 账号体系（注册/登录/会话）。
2. 组织与角色权限（Owner/Editor/Viewer）。
3. 分享模型（私有链接/团队共享/公开只读）。
4. 审计日志（删除、回滚、共享、权限变更）。

### 需求拆解

1. 身份与权限
   - 工作区归属到组织；用户可加入多个组织。
   - 关键操作统一权限校验中间件。
2. 分享能力
   - 为文件生成分享链接（可设置失效时间与访问级别）。
3. 审计能力
   - 核心写操作必须落审计日志，支持管理端查询。

### 技术改造

1. 后端
   - 新增 `auth`、`organization`、`permission` 模块。
   - 在 `workspace` 模块引入资源权限检查器。
2. 数据库
   - 新增 `User`、`Organization`、`Membership`、`ShareLink`、`AuditLog`。
3. 前端
   - 新增组织切换、成员管理、分享管理 UI。
   - 所有操作错误提示明确区分“权限不足/资源不存在”。

### 验收标准

1. 角色权限矩阵覆盖核心操作。
2. 分享链接可控（可撤销/可过期/可权限级别）。
3. 审计日志可按时间、用户、操作类型检索。
4. 安全测试覆盖：未授权访问、越权访问、过期链接访问。

## 2.3 阶段三（8-12 周）：生态与差异化

### 目标

建立“跨工具复用”能力，形成高频入口与迁移壁垒。

### 范围与交付

1. VS Code 插件 v1（保存片段/搜索插入/跳转 Web）。
2. CLI 工具 v1（检索、导入、导出、批量操作）。
3. 外部平台集成（先做 Gist 导入导出）。
4. 智能辅助（可选，建议灰度）：自动标签、相似片段提示、敏感信息检测。

### 技术改造

1. 平台 API
   - 新增 PAT（Personal Access Token）与 token scope。
   - 新增 webhook 与 integration endpoint。
2. 协议
   - 规范导入导出格式（版本化 JSON schema）。
3. 可观测性
   - 指标：搜索成功率、复用率、活跃用户、分享转化率。

### 验收标准

1. IDE 插件能完成“保存-检索-插入”闭环。
2. CLI 支持 CI 场景下的批量同步。
3. 集成 token 可细粒度吊销与审计。

## 3. 技术改进重点（落地细化）

## 3.1 前端解耦重构（高优先）

### 问题

当前 `App.vue` 与主 store 体量过大，新增功能会快速增加耦合与回归风险。

### 方案

1. 路由拆分：`/workspace`、`/search`、`/settings`。
2. 状态拆分：领域内聚，避免全局状态膨胀。
3. UI 拆分：交互复杂区块（主题、revision、search）独立组件。

### 验收

1. `App.vue` 控制在 600 行以内。
2. 每个大模块都有独立测试文件与 e2e 覆盖。

## 3.2 搜索架构升级（高优先）

### 方案

1. PostgreSQL FTS + trigram 组合。
2. 支持关键词匹配、模糊匹配、过滤组合。
3. API 统一分页/排序协议。

### 验收

1. 搜索接口有 explain 验证和基准测试结果。
2. 大数据量下仍能满足交互性能目标。

## 3.3 版本与审计模型（高优先）

### 方案

1. `WorkspaceFileRevision`：保存内容快照/差异、创建人、来源操作。
2. `AuditLog`：记录高风险操作。
3. 回滚流程走统一服务层，保证数据一致性。

### 验收

1. 可按 revision 回放关键变更。
2. 任意回滚都有审计记录可追踪。

## 3.4 集成扩展层（中优先）

### 方案

1. token + scope + webhook 三件套。
2. 先做只读集成，再扩展写入权限。

### 验收

1. token 泄露场景支持即时吊销。
2. webhooks 可重复投递且幂等处理。

## 4. 数据模型演进草案（建议）

1. `Workspace`：增加 `ownerId`、`organizationId`。
2. `WorkspaceFile`：增加 `isArchived`、`lastEditedBy`。
3. `WorkspaceFileRevision`：`id/fileId/content/patch/createdBy/createdAt`。
4. `Tag` + 关联表：支持统计和多实体复用。
5. `AuditLog`：`actor/action/resourceType/resourceId/payload/createdAt`。
6. `ShareLink`：`token/resource/permission/expiredAt/isRevoked`。

## 5. 新线程执行模板（建议直接复用）

每个线程按以下结构执行：

1. 线程目标（单一能力点）。
2. TDD 回归测试（先红后绿）。
3. 最小实现改动。
4. 行为级验证（click/keyboard/focus-blur/state）。
5. 全量门禁（test/e2e/typecheck/build）。
6. 风险与回滚说明。

推荐线程切分顺序：

1. 线程 A：搜索中心与搜索 API（✅ 已完成）。
2. 线程 B：标签与收藏（✅ 已完成）。
3. 线程 C：revision 后端模型 + API（✅ 已完成）。
4. 线程 D：revision 前端面板 + 回滚（✅ 已完成）。
5. 线程 E：前端路由与 store 解耦（✅ 已完成）。
6. 阶段一收口：Quick Capture + revision diff + 搜索性能验收（✅ 已完成）。
7. 线程 F：账号与组织基础（✅ 已完成）。
8. 线程 G：权限与分享链接（✅ 已完成）。
9. 线程 H：审计日志与管理页面（✅ 已完成）。
10. 线程 I：VS Code 插件 PoC（未开始）。
11. 线程 J：CLI + 导入导出协议（未开始）。

## 6. 里程碑与指标

### 里程碑 M1（阶段一结束）

1. 日活用户片段检索次数提升。
2. 片段复用率提升（搜索后插入/复制占比）。
3. revision 回滚成功率 > 99%。

### 里程碑 M2（阶段二结束）

1. 团队工作区占比提升。
2. 分享链接使用量提升。
3. 权限相关事故为 0（越权写入）。

### 里程碑 M3（阶段三结束）

1. IDE/CLI 渠道占新增片段来源 > 30%。
2. 外部平台导入成功率 > 99%。

## 7. 风险与应对

1. 风险：功能扩张导致前端回归成本失控。
   - 应对：先做解耦，再上大功能。
2. 风险：搜索性能不足。
   - 应对：先索引与 explain，再开放复杂筛选。
3. 风险：权限模型过早复杂化。
   - 应对：先最小角色矩阵，逐步细化策略。
4. 风险：集成能力先于治理能力。
   - 应对：必须先完成 token 审计与吊销机制。

## 10. 阶段一执行细化（线程 A：搜索中心与搜索 API）

### 10.1 线程目标

1. 交付可用的搜索中心（关键词 + 过滤 + 分页 + 视图预设）。
2. 新增后端搜索接口 `GET /api/search/snippets`。
3. 前端入口升级为路由级页面：`/workspace`、`/search`、`/settings`。

### 10.2 线程 A 小功能点清单（逐项打标）

A0 文档治理：
- [x] A0-1：将升级执行文档文件名去日期化（`product-upgrade-execution-playbook.md`）。
- [x] A0-2：明确“计划细化只在本文件维护，不拆分独立计划文档”。
- [x] A0-3：线程状态改为“进行中/未开始/已完成”可追踪。

A1 后端搜索接口：
- [x] A1-1：新增搜索 e2e 回归测试（先红）。
- [x] A1-2：实现 `GET /api/search/snippets`（关键词、过滤、分页）。
- [x] A1-3：补充 OpenAPI 文档与必要单测/e2e。

A2 数据层搜索准备：
- [x] A2-1：`WorkspaceFile` 增加 `tags` 字段。
- [x] A2-2：`WorkspaceFile` 增加 `createdAt/updatedAt`。
- [x] A2-3：补充搜索相关索引策略。

A3 前端搜索中心：
- [x] A3-1：新增 `searchStore` 与搜索 API 客户端。
- [x] A3-2：新增 `SearchPage`（click/keyboard/focus-blur/state）。
- [x] A3-3：支持保存搜索条件（视图预设）。

A4 路由级页面落地：
- [x] A4-1：主入口切换到路由壳层。
- [x] A4-2：补齐 `/workspace`、`/search`、`/settings` 页面路由。

A5 验证门禁：
- [x] A5-1：targeted 回归（backend + frontend + e2e）通过。
- [x] A5-2：full gate（test/typecheck/build）通过。

A6 完成标记：
- [x] A6-1：线程清单将“线程 A”标记为已完成。
- [x] A6-2：追加执行记录并附完整命令结果结论。

### 10.3 线程 A 当前状态

1. 当前状态：✅ 已完成（线程 A 全部验收通过）。
2. 当前阻塞：无。

## 11. 执行记录

### 2026-03-16｜线程 A（阶段初始化）

1. 目标：统一执行文档入口与追踪机制，启动线程 A。
2. 结果：
   - 已完成 A0-1 / A0-2 / A0-3。
   - 后端搜索接口 RED 回归测试已新增（待 GREEN）。
3. 证据：
   - 文档文件已重命名为 `docs/product-upgrade-execution-playbook.md`。
   - `AGENTS.md` 已更新文档入口引用。
   - `apps/backend/test/search.e2e-spec.ts` 已创建并验证 RED。

### 2026-03-16｜线程 A（完成）

1. 目标：完成“搜索中心 + 搜索 API + 路由级页面入口”并通过门禁。
2. 结果：
   - 后端：新增搜索模块与接口，支持关键词/过滤/分页。
   - 数据层：`WorkspaceFile` 新增 `tags`、`createdAt`、`updatedAt` 与索引。
   - 前端：新增 `SearchPage`、`searchStore`、路由壳层与三页面路由。
   - 文档：OpenAPI 与升级执行文档状态同步更新。
3. 验证命令（均通过）：
   - `npm run test --workspace @snippet-archive/backend`
   - `npm run test:e2e --workspace @snippet-archive/backend`
   - `npm run test:run --workspace @snippet-archive/frontend`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
   - `npm run typecheck --workspace @snippet-archive/frontend`
   - `npm run build`

### 2026-03-16｜线程 B（完成）

1. 目标：完成“标签体系 + 收藏聚合视图”并通过门禁。
2. 结果：
   - 后端：`WorkspaceFile` 增加 `starred` 字段；新增 `GET /api/favorites` 聚合接口。
   - 前端：工作区/文件支持收藏切换；工作区/文件支持标签编辑（Enter/blur 提交、Esc 取消）；新增收藏页 `/favorites`。
   - 文档：OpenAPI 同步收藏接口与 starred 字段。
3. 验证命令（均通过）：
   - `npm run test --workspace @snippet-archive/backend`
   - `npm run test:e2e --workspace @snippet-archive/backend`
   - `npm run test:run --workspace @snippet-archive/frontend`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
   - `npm run typecheck --workspace @snippet-archive/frontend`
   - `npm run build`

### 2026-03-16｜线程 C（完成）

1. 目标：完成“revision 后端模型 + API（列表/回滚）”并通过门禁。
2. 结果：
   - 数据层：新增 `WorkspaceFileRevision` 模型，建立 `WorkspaceFile` 关联与索引（`fileId + createdAt`、`workspaceId + fileId + createdAt`）。
   - 后端：新增 revision 列表接口与回滚接口；文件保存时（content/language 变化）自动写入 revision；回滚后追加 `restore` 来源 revision。
   - 文档：OpenAPI 同步 revision 路由、参数与 schema。
3. 验证命令（均通过）：
   - `npm run test --workspace @snippet-archive/backend`
   - `npm run test:e2e --workspace @snippet-archive/backend`
   - `npm run test:run --workspace @snippet-archive/frontend`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
   - `npm run typecheck --workspace @snippet-archive/frontend`
   - `npm run build`

### 2026-03-16｜线程 D（完成）

1. 目标：完成“revision 前端面板 + 回滚链路”并通过门禁。
2. 结果：
   - 前端 API：`workspaceApi` 新增 revision 列表与回滚调用。
   - 状态层：`workspaceStore` 新增 `listActiveFileRevisions`、`restoreActiveFileRevision`，回滚后同步编辑器内容、语言、dirty 状态与草稿缓存。
   - UI：新增 `RevisionDialog` 组件；编辑器工具区新增“版本”入口，支持查看版本列表与一键回滚。
   - 测试：新增 revision store 单测与 e2e 回归，覆盖“打开面板 -> 查看列表 -> 回滚旧版本”完整链路。
3. 验证命令（均通过）：
   - `npm run test --workspace @snippet-archive/backend`
   - `npm run test:e2e --workspace @snippet-archive/backend`
   - `npm run test:run --workspace @snippet-archive/frontend`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
   - `npm run typecheck --workspace @snippet-archive/frontend`
   - `npm run build`

### 2026-03-16｜线程 E（完成）

1. 目标：完成“前端路由与 store 解耦”并通过门禁。
2. 结果：
   - 设置页解耦：`/settings` 路由不再触发工作区数据加载，避免对 `workspaceStore` 的非必要依赖。
   - 路由收敛：工作台“设置”与设置页“返回工作台”统一走真实路由跳转（`/settings` 与 `/workspace`），不再依赖 hash 视图切换。
   - 回归增强：新增 `SettingsPage` 解耦单测；更新设置页 e2e 覆盖路由断言与 reload 场景；修复 revision e2e 保存节奏稳定性。
3. 验证命令（均通过）：
   - `npm run test --workspace @snippet-archive/backend`
   - `npm run test:e2e --workspace @snippet-archive/backend`
   - `npm run test:run --workspace @snippet-archive/frontend`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
   - `npm run typecheck --workspace @snippet-archive/frontend`
   - `npm run build`

### 2026-03-16｜阶段一收口（完成）

1. 目标：补齐阶段一剩余能力（Quick Capture、revision diff、搜索性能验收证据）并完成闭环。
2. 结果：
   - Quick Capture：新增全局按钮与快捷键（Ctrl/Cmd + Shift + K），支持在弹窗中选择工作区/语言/标签并创建片段后跳转到目标上下文。
   - Revision diff：revision 面板支持选择历史版本并展示与当前草稿的行级差异预览，同时保持回滚链路可用。
   - 搜索性能：新增可重复基准脚本 `npm run benchmark:search --workspace @snippet-archive/backend`，在 1200 条数据集下实测 `p95=11.50ms`（<500ms）。
3. 验证命令（均通过）：
   - `npm run benchmark:search --workspace @snippet-archive/backend`
   - `npm run test --workspace @snippet-archive/backend`
   - `npm run test:e2e --workspace @snippet-archive/backend`
   - `npm run test:run --workspace @snippet-archive/frontend`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
   - `npm run typecheck --workspace @snippet-archive/frontend`
   - `npm run build`

### 2026-03-16｜阶段一补充（快速捕捉悬浮栏 + 设置快捷键页）

1. 目标：补充阶段一交互细节，优化快速捕捉入口形态并完善设置页快捷键信息展示。
2. 结果：
   - 浮动工具栏：原右下角“工作区/搜索/收藏/快速捕捉”工作栏改为默认隐藏的中上方悬浮工具栏，支持 `Ctrl/Cmd + Shift + K` 与右上角图标唤出，`Esc` 收起。
   - 快速捕捉：保留弹层表单能力，改为通过浮动工具栏中的“快速捕捉”入口打开。
   - 设置入口：工作台右上角“设置/返回”按钮改为图标形式。
   - 设置页：新增“快捷键”Tab，集中展示当前项目已接入的快捷键与作用范围。
   - 主题能力：浮动工具栏玻璃样式完成 token 化，新增 `surface.toolbar*` 相关 token，并同步到 9 套内置主题；e2e 增加“切换主题时工具栏样式跟随变化”断言。
   - 回归：补充 quick capture、favorites 与 settings 的单测/E2E 断言，覆盖点击、快捷键、几何定位与 tab 切换。
3. 验证命令（均通过）：
   - `npm run test:run --workspace @snippet-archive/frontend -- src/ShellApp.quick-capture.spec.ts src/App.settings.spec.ts`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend -- e2e/quick-capture.spec.ts e2e/settings-languages.spec.ts`
   - `npm run test --workspace @snippet-archive/backend`
   - `npm run test:e2e --workspace @snippet-archive/backend`
   - `npm run test:run --workspace @snippet-archive/frontend`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
   - `npm run typecheck --workspace @snippet-archive/frontend`
   - `npm run build`

### 2026-03-17｜阶段一补充（工具栏主题独立调参与教程更新）

1. 目标：让浮动工具栏玻璃样式在每套内置主题下具备独立参数，并确保该能力在主题导入/导出教程中可被正确使用。
2. 结果：
   - 主题参数：9 套内置主题的 `surface.toolbarGlass*`、`surface.toolbarLink*`、`surface.toolbarCapture*` 调整为按主题独立调参，不再共享同一套玻璃参数。
   - 可验证性：新增 `theme-runtime` 回归断言，要求所有内置主题的 `toolbarGlassBackground` 与 `toolbarGlassShadow` 都是主题专属值。
   - 教程更新：设置页“主题编写教程”新增“浮动工具栏关键 token（支持导入/导出）”区块，补充 `surface.toolbarGlassBackground`、`surface.toolbarGlassHighlightArc` 等关键字段及导入/导出约束说明。
3. 验证命令（均通过）：
   - `npm run test:run --workspace @snippet-archive/frontend -- src/App.settings.spec.ts src/themes/theme-runtime.spec.ts`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend -- e2e/settings-languages.spec.ts e2e/quick-capture.spec.ts`
   - `npm run check:theme-contract --workspace @snippet-archive/frontend`

### 2026-03-17｜阶段一补充（主题导入错误提示优化）

1. 目标：让主题导入失败时的错误提示可直接指导修复，尤其是浮动工具栏 token 缺失场景。
2. 结果：
   - 导入提示：在设置页导入流程中，对 `surface.toolbar*` 缺失/空值错误给出专属可操作提示，明确缺失字段并提示应补齐的 token 组。
   - 导入提示：当 `modules.surface` 整体缺失时，提示用户基于“导出主题文件”模板保留完整模块结构后再导入。
   - 回归覆盖：新增设置页单测，验证缺失 `surface.toolbarGlassBackground` 时会出现“缺少浮动工具栏 token”提示；E2E 增加缺少 `surface` 模块的导入失败提示断言。
3. 验证命令（均通过）：
   - `npm run test:run --workspace @snippet-archive/frontend -- src/App.settings.spec.ts`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend -- e2e/settings-languages.spec.ts`
   - `npm run check:theme-contract --workspace @snippet-archive/frontend`
   - `npm run test --workspace @snippet-archive/backend`
   - `npm run test:e2e --workspace @snippet-archive/backend`
   - `npm run test:run --workspace @snippet-archive/frontend`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
   - `npm run typecheck --workspace @snippet-archive/frontend`
   - `npm run build`

### 2026-03-17｜阶段一补充（右上角图标冲突修复 + 测试方法补洞）

1. 目标：修复右上角入口图标重复渲染与头部文案遮挡问题，并将该类风险纳入 `TESTING.md` 的强制检查项。
2. 结果：
   - 冲突修复：统一右上角入口归属到 `ShellApp`（设置/返回 + 工具栏），移除 `App.vue` 页面层重复入口，避免同语义按钮双层渲染。
   - 布局修复：`App.vue` 头部操作区为右上角固定图标组预留安全空间，消除 `meta` 文案与图标重叠。
   - 回归补齐：`settings-languages` E2E 新增“入口唯一性 + 头部不重叠 + 同排 centerY + 断点覆盖”几何断言。
   - 方法补洞：在 `TESTING.md` 增加“全局固定图标与页面头部冲突检查”专项条款与经验教训。
3. 验证命令（均通过）：
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend -- e2e/settings-languages.spec.ts -g "settings page shows language list and supports tab switching"`
   - `npm run test:run --workspace @snippet-archive/frontend -- src/ShellApp.quick-capture.spec.ts src/App.settings.spec.ts`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend -- e2e/settings-languages.spec.ts`
   - `npm run check:theme-contract --workspace @snippet-archive/frontend`
   - `npm run test --workspace @snippet-archive/backend`
   - `npm run test:e2e --workspace @snippet-archive/backend`
   - `npm run test:run --workspace @snippet-archive/frontend`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
   - `npm run typecheck --workspace @snippet-archive/frontend`
   - `npm run build`

### 2026-03-17｜线程 F（完成）

1. 目标：完成“账号体系 + 组织基础 + 成员管理基础 UI”，为阶段二后续权限与审计能力提供底座。
2. 结果：
   - 数据层：新增 `User`、`Session`、`Organization`、`Membership` 及 `Workspace.organizationId/ownerId` 关联。
   - 后端：新增 `auth` 与 `organization` 模块（注册/登录/会话、组织创建、成员列表与邀请）。
   - 前端：新增 `/team` 页面，支持注册/登录、组织切换、成员管理基础交互。
   - 回归：新增 `auth-organization.e2e-spec.ts` 与 `TeamPage.spec.ts`。
3. 验证命令（均通过）：
   - `npm run test:e2e --workspace @snippet-archive/backend -- auth-organization.e2e-spec.ts`
   - `npm run test:run --workspace @snippet-archive/frontend -- src/pages/TeamPage.spec.ts`

### 2026-03-17｜线程 G（完成）

1. 目标：完成“资源权限矩阵 + 分享链接模型 + 分享管理 UI”，实现团队协作中的可控访问链路。
2. 结果：
   - 后端：新增 `permission` 与 `share` 模块；`workspace/search/favorites` 接入组织可见性与角色权限校验。
   - 分享能力：支持 `PRIVATE/TEAM/PUBLIC` 三类可见性，支持过期与撤销。
   - 前端：团队页新增分享管理区域，支持创建/查看/撤销分享链接。
   - 回归：新增 `permissions-share.e2e-spec.ts` 与 `team-collaboration.spec.ts`（覆盖 click/keyboard/focus-blur/state）。
3. 验证命令（均通过）：
   - `npm run test:e2e --workspace @snippet-archive/backend -- permissions-share.e2e-spec.ts`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend -- e2e/team-collaboration.spec.ts`

### 2026-03-17｜线程 H（完成）

1. 目标：完成“审计日志模型 + 管理查询 API + 前端审计查看”，闭环阶段二治理能力。
2. 结果：
   - 数据层：新增 `AuditLog` 模型，核心写操作统一记录审计事件。
   - 后端：新增审计查询接口（按组织、用户、操作、时间过滤），仅 Owner 可访问。
   - 前端：团队页新增审计查询区域，支持 action 过滤与列表展示。
   - 错误语义：前端统一区分 `UNAUTHORIZED/FORBIDDEN/NOT_FOUND/GONE`。
   - 回归：新增 `audit-logs.e2e-spec.ts`，覆盖未授权/越权/过期链接安全场景。
3. 验证命令（均通过）：
   - `npm run test:e2e --workspace @snippet-archive/backend -- audit-logs.e2e-spec.ts`
   - `npm run test --workspace @snippet-archive/backend`
   - `npm run test:e2e --workspace @snippet-archive/backend`
   - `npm run test:run --workspace @snippet-archive/frontend`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
   - `npm run typecheck --workspace @snippet-archive/frontend`
   - `npm run build`

## 12. 阶段一执行细化（线程 B：标签与收藏）

### 12.1 线程目标

1. 补齐工作区标签、文件标签、收藏能力的可见交互入口。
2. 提供收藏聚合视图（独立页面）并支持标签过滤。
3. 确保标签过滤可与收藏过滤组合使用。

### 12.2 线程 B 小功能点清单（逐项打标）

B0 文档与状态：
- [x] B0-1：在线程总览中将线程 B 状态标记为“进行中”。
- [x] B0-2：在本文件追加线程 B 细化清单与执行记录。

B1 后端数据与接口：
- [x] B1-1：`WorkspaceFile` 增加 `starred` 字段并默认 `false`。
- [x] B1-2：工作区/文件的更新接口支持标签与收藏字段更新。
- [x] B1-3：新增收藏聚合接口（独立于搜索页接口）。
- [x] B1-4：补充 OpenAPI 与后端 e2e 回归测试（先红后绿）。

B2 前端标签交互：
- [x] B2-1：工作区支持标签编辑（至少覆盖 Enter/blur 提交与 Esc 取消）。
- [x] B2-2：文件支持标签编辑（至少覆盖 Enter/blur 提交与 Esc 取消）。
- [x] B2-3：标签改动后 UI 与持久化状态一致。

B3 前端收藏交互与视图：
- [x] B3-1：工作区支持收藏/取消收藏切换。
- [x] B3-2：文件支持收藏/取消收藏切换。
- [x] B3-3：新增收藏聚合页面并支持标签过滤。
- [x] B3-4：收藏项可跳转回工作区与文件上下文。

B4 验证门禁：
- [x] B4-1：targeted 回归（backend + frontend + e2e）通过。
- [x] B4-2：full gate（test/typecheck/build）通过。

B5 完成标记：
- [x] B5-1：线程清单将“线程 B”标记为已完成。
- [x] B5-2：追加线程 B 完成执行记录与命令证据。

### 12.3 线程 B 当前状态

1. 当前状态：✅ 已完成（线程 B 全部验收通过）。
2. 当前阻塞：无。

## 13. 阶段一执行细化（线程 C：revision 后端模型 + API）

### 13.1 线程目标

1. 引入持久化 revision 数据模型，建立文件历史版本基础能力。
2. 提供 revision 列表接口与指定版本回滚接口。
3. 保证文件保存后会产生可追溯 revision 记录。

### 13.2 线程 C 小功能点清单（逐项打标）

C0 文档与状态：
- [x] C0-1：在线程总览中将线程 C 状态标记为“进行中”。
- [x] C0-2：在本文件追加线程 C 细化清单与执行记录。

C1 数据模型与索引：
- [x] C1-1：新增 `WorkspaceFileRevision` 数据模型（关联 `WorkspaceFile`）。
- [x] C1-2：为 revision 列表查询补充索引（`fileId + createdAt`）。

C2 后端 API 与服务：
- [x] C2-1：新增 revision 列表接口 `GET /api/workspaces/:workspaceId/files/:fileId/revisions`。
- [x] C2-2：新增 revision 回滚接口 `POST /api/workspaces/:workspaceId/files/:fileId/revisions/:revisionId/restore`。
- [x] C2-3：在文件保存链路中创建 revision 记录（至少覆盖 content/language 变更）。

C3 测试与文档：
- [x] C3-1：新增后端 e2e 回归测试并执行 RED->GREEN。
- [x] C3-2：更新 OpenAPI（revision 路由 + schema）。

C4 验证门禁：
- [x] C4-1：targeted 回归（backend test + e2e）通过。
- [x] C4-2：full gate（frontend/backend test、typecheck、build）通过。

C5 完成标记：
- [x] C5-1：线程清单将“线程 C”标记为已完成。
- [x] C5-2：追加线程 C 完成执行记录与命令证据。

### 13.3 线程 C 当前状态

1. 当前状态：✅ 已完成（线程 C 全部验收通过）。
2. 当前阻塞：无。

## 14. 阶段一执行细化（线程 D：revision 前端面板 + 回滚）

### 14.1 线程目标

1. 在工作台提供 revision 历史面板入口，支持查看版本列表。
2. 支持在前端触发指定版本回滚，并将编辑器内容同步到回滚结果。
3. 补齐 click/keyboard/focus-blur/state 相关回归测试与端到端验证。

### 14.2 线程 D 小功能点清单（逐项打标）

D0 文档与状态：
- [x] D0-1：在线程总览中将线程 D 状态标记为“进行中”。
- [x] D0-2：在本文件追加线程 D 细化清单与执行记录。

D1 API 与状态接线：
- [x] D1-1：前端 `workspaceApi` 新增 revision 列表/回滚调用。
- [x] D1-2：`workspaceStore` 新增 revision 列表读取与回滚 action。

D2 UI 与交互：
- [x] D2-1：新增 `RevisionDialog` 组件展示版本列表。
- [x] D2-2：在编辑器工具区新增 revision 入口按钮。
- [x] D2-3：回滚后编辑器内容、语言与保存状态同步正确。

D3 测试与验证：
- [x] D3-1：新增/更新前端单测（先红后绿）。
- [x] D3-2：新增/更新前端 e2e（先红后绿，覆盖回滚链路）。

D4 验证门禁：
- [x] D4-1：targeted 回归（frontend unit + e2e）通过。
- [x] D4-2：full gate（backend/frontend test、typecheck、build）通过。

D5 完成标记：
- [x] D5-1：线程清单将“线程 D”标记为已完成。
- [x] D5-2：追加线程 D 完成执行记录与命令证据。

### 14.3 线程 D 当前状态

1. 当前状态：✅ 已完成（线程 D 全部验收通过）。
2. 当前阻塞：无。

## 15. 阶段一执行细化（线程 E：前端路由与 store 解耦）

### 15.1 线程目标

1. 将设置页从工作台数据流中解耦，避免进入设置路由时触发工作区加载。
2. 统一设置入口为真实路由跳转，消除 hash 视图切换耦合。
3. 通过回归测试覆盖“解耦 + 路由跳转 + reload”关键链路。

### 15.2 线程 E 小功能点清单（逐项打标）

E0 文档与状态：
- [x] E0-1：在线程总览中将线程 E 状态标记为“进行中/已完成”。
- [x] E0-2：在本文件追加线程 E 细化清单与执行记录。

E1 路由与页面解耦：
- [x] E1-1：`/settings` 页面不再触发 `workspaceApi.list`。
- [x] E1-2：工作台“设置”入口改为 `/settings` 路由跳转。
- [x] E1-3：设置页“返回工作台”改为 `/workspace` 路由跳转。

E2 回归测试：
- [x] E2-1：新增设置页解耦单测（先红后绿）。
- [x] E2-2：更新设置页 e2e 路由断言与 reload 场景（先红后绿）。
- [x] E2-3：修复 revision e2e 稳定性回归（保存节奏同步）。

E3 验证门禁：
- [x] E3-1：targeted 回归（新增 unit + e2e）通过。
- [x] E3-2：full gate（backend/frontend test、typecheck、build）通过。

E4 完成标记：
- [x] E4-1：线程清单将“线程 E”标记为已完成。
- [x] E4-2：追加线程 E 完成执行记录与命令证据。

### 15.3 线程 E 当前状态

1. 当前状态：✅ 已完成（线程 E 全部验收通过）。
2. 当前阻塞：无。

## 16. 阶段一收口执行细化（Quick Capture + revision diff + 搜索性能验收）

### 16.1 收口目标

1. 补齐 `Quick Capture v1`（全局按钮 + 快捷键 + 新建片段弹窗）。
2. 补齐 `revision diff` 可视化能力（在版本面板中可查看与当前草稿差异）。
3. 提供 `1k+` 片段搜索性能证据（响应 `< 500ms`）并固化到执行文档。

### 16.2 小功能点清单（逐项打标）

S0 文档与状态：
- [x] S0-1：在线程总览新增“阶段一收口”并标记为进行中。
- [x] S0-2：在本文件追加收口执行记录与最终完成标记。

S1 Quick Capture v1：
- [x] S1-1：提供全局入口按钮打开“新建片段弹窗”。
- [x] S1-2：支持快捷键打开弹窗（全局可触达）。
- [x] S1-3：弹窗支持选择目标工作区、语言、标签并创建文件。
- [x] S1-4：创建成功后跳转并定位到目标工作区/文件上下文。

S2 Revision diff：
- [x] S2-1：在 revision 面板展示所选版本与当前草稿差异。
- [x] S2-2：支持切换版本项时实时更新 diff 结果。
- [x] S2-3：保持回滚链路与 diff 展示共同可用。

S3 性能验收（搜索）：
- [x] S3-1：构建 1k+ 片段的可重复基准数据。
- [x] S3-2：产出搜索接口响应耗时证据并记录 `< 500ms` 结论。

S4 测试与门禁：
- [x] S4-1：新增/更新前端回归（unit + e2e）并完成 RED->GREEN。
- [x] S4-2：full gate（backend/frontend test、typecheck、build）通过。

S5 完成标记：
- [x] S5-1：线程总览将“阶段一收口”标记为已完成。
- [x] S5-2：追加收口执行记录（命令与结论）。

### 16.3 当前状态

1. 当前状态：✅ 已完成（阶段一收口全部验收通过）。
2. 当前阻塞：无。

## 17. 阶段二执行细化（线程 F：账号与组织基础）

### 17.1 线程目标

1. 建立账号体系（注册/登录/会话）并提供 `me/logout` 基础能力。
2. 建立组织与成员模型（Owner/Editor/Viewer）并支持组织创建与成员管理。
3. 将工作区升级为“可归属组织”的资源模型（`organizationId` + `ownerId`）。

### 17.2 线程 F 小功能点清单（逐项打标）

F0 文档与状态：
- [x] F0-1：线程总览将线程 F 标记为“进行中”。
- [x] F0-2：在主执行文档追加线程 F 细化清单与执行记录。

F1 数据模型：
- [x] F1-1：新增 `User`、`Session`、`Organization`、`Membership` 模型与索引。
- [x] F1-2：`Workspace` 新增 `organizationId`、`ownerId`。
- [x] F1-3：同步 Prisma client 生成与数据库结构推送。

F2 后端账号与组织接口：
- [x] F2-1：新增 `POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me`、`POST /api/auth/logout`。
- [x] F2-2：新增 `GET /api/organizations`、`POST /api/organizations`、`GET /api/organizations/:id/members`、`POST /api/organizations/:id/members`。
- [x] F2-3：组织成员管理默认 Owner 权限收敛（添加/调权/移除）。

F3 前端基础协作入口：
- [x] F3-1：新增 `/team` 路由与团队协作页面。
- [x] F3-2：支持注册/登录、组织创建与成员添加交互。
- [x] F3-3：团队入口接入壳层导航（工具栏）。

F4 测试与门禁：
- [x] F4-1：新增回归 `apps/backend/test/auth-organization.e2e-spec.ts`（先红后绿）。
- [x] F4-2：新增回归 `apps/frontend/src/pages/TeamPage.spec.ts`（先红后绿）。
- [x] F4-3：targeted + full gate 通过。

F5 完成标记：
- [x] F5-1：线程总览将“线程 F”标记为已完成。
- [x] F5-2：追加线程 F 执行记录与命令证据。

### 17.3 当前状态

1. 当前状态：✅ 已完成（线程 F 全部验收通过）。
2. 当前阻塞：无。

## 18. 阶段二执行细化（线程 G：权限与分享链接）

### 18.1 线程目标

1. 建立组织角色权限矩阵并接入核心资源操作。
2. 建立分享链接模型（私有/团队/公开只读）与撤销/过期治理。
3. 前端提供可操作的分享管理 UI。

### 18.2 线程 G 小功能点清单（逐项打标）

G0 文档与状态：
- [x] G0-1：线程总览将线程 G 标记为“进行中”。
- [x] G0-2：在主执行文档追加线程 G 细化清单与执行记录。

G1 权限中间层：
- [x] G1-1：新增 `permission` 服务并实现 Owner/Editor/Viewer 角色校验。
- [x] G1-2：`workspace` 写操作接入权限校验。
- [x] G1-3：`search/favorites` 接入组织可见性过滤，避免越权读取。

G2 分享能力：
- [x] G2-1：新增 `ShareLink` 模型与 token、过期、撤销字段。
- [x] G2-2：新增文件级分享管理接口（创建/查询/撤销）。
- [x] G2-3：新增公开访问接口 `GET /api/share-links/:token`，按可见性执行权限判断。

G3 前端分享管理：
- [x] G3-1：团队页支持输入 `workspaceId/fileId` 创建分享链接。
- [x] G3-2：支持列表展示与撤销操作。
- [x] G3-3：覆盖 Enter 快捷提交与失焦标准化（focus/blur）行为。

G4 安全回归：
- [x] G4-1：新增 `apps/backend/test/permissions-share.e2e-spec.ts`（未授权/越权/过期场景先红后绿）。
- [x] G4-2：新增 `apps/frontend/e2e/team-collaboration.spec.ts`，覆盖分享创建链路。

G5 完成标记：
- [x] G5-1：线程总览将“线程 G”标记为已完成。
- [x] G5-2：追加线程 G 执行记录与命令证据。

### 18.3 当前状态

1. 当前状态：✅ 已完成（线程 G 全部验收通过）。
2. 当前阻塞：无。

## 19. 阶段二执行细化（线程 H：审计日志与管理页面）

### 19.1 线程目标

1. 建立审计日志模型并覆盖核心写操作事件落库。
2. 提供管理端查询能力（按时间、用户、操作类型过滤）。
3. 在前端协作页提供审计日志查询视图。

### 19.2 线程 H 小功能点清单（逐项打标）

H0 文档与状态：
- [x] H0-1：线程总览将线程 H 标记为“进行中”。
- [x] H0-2：在主执行文档追加线程 H 细化清单与执行记录。

H1 审计模型与服务：
- [x] H1-1：新增 `AuditLog` 模型与索引。
- [x] H1-2：新增 `audit` 模块与统一记录服务。
- [x] H1-3：工作区、分享、组织成员写操作接入审计记录。

H2 管理查询接口：
- [x] H2-1：新增 `GET /api/organizations/:organizationId/audit-logs`。
- [x] H2-2：支持 `action/actorId/from/to/page/pageSize` 过滤参数。
- [x] H2-3：接口访问权限限制为组织 Owner。

H3 前端审计页面能力：
- [x] H3-1：团队页新增审计查询输入与结果列表。
- [x] H3-2：支持按 action 过滤并回显查询结果。
- [x] H3-3：错误提示显式区分 `UNAUTHORIZED/FORBIDDEN/NOT_FOUND/GONE`。

H4 回归与门禁：
- [x] H4-1：新增 `apps/backend/test/audit-logs.e2e-spec.ts`（先红后绿）。
- [x] H4-2：通过 full gate（backend/frontend test + e2e + typecheck + build）。

H5 完成标记：
- [x] H5-1：线程总览将“线程 H”标记为已完成。
- [x] H5-2：追加线程 H 执行记录与命令证据。

### 19.3 当前状态

1. 当前状态：✅ 已完成（线程 H 全部验收通过）。
2. 当前阻塞：无。

## 20. 阶段二执行细化（线程 F/G/H 加固：登录入口与鉴权收敛）

### 20.1 线程目标

1. 将前端项目入口收敛为登录页，未鉴权用户不可直接访问业务页面。
2. 保证登录后仅能访问当前用户可见的数据范围（个人工作区按 owner 隔离，组织数据按成员关系隔离）。
3. 工具栏仅作为快捷入口，提供可持续可见的常规页面导航入口。

### 20.2 线程小功能点清单（逐项打标）

Z0 入口与登录页：
- [x] Z0-1：新增 `/login` 路由并将 `/` 默认入口重定向到登录页。
- [x] Z0-2：新增 `LoginPage`，补齐登录/注册交互与回跳能力。
- [x] Z0-3：登录页补齐 keyboard 行为（密码框 `Enter` 提交）与校验反馈。

Z1 路由鉴权与导航：
- [x] Z1-1：路由守卫接入 `auth/me` 会话校验，未登录统一重定向 `/login?redirect=...`。
- [x] Z1-2：Shell 增加常规主导航（工作区/搜索/收藏/团队/设置），不再依赖工具栏作为唯一入口。
- [x] Z1-3：工具栏保留快捷定位属性（默认隐藏、快捷键/图标唤出）。

Z2 后端权限收敛：
- [x] Z2-1：`workspaces/search/favorites` 统一改为必需鉴权守卫。
- [x] Z2-2：个人工作区可见性收敛为 `ownerId=当前用户`；组织空间按成员组织过滤。
- [x] Z2-3：`WorkspaceService` 单测与 e2e 同步到“带 actor 上下文”的新权限模型。

Z3 回归与门禁：
- [x] Z3-1：新增前端回归 `apps/frontend/src/pages/LoginPage.spec.ts`（先红后绿）。
- [x] Z3-2：新增前端 e2e 回归 `apps/frontend/e2e/auth-entry-navigation.spec.ts`（先红后绿）。
- [x] Z3-3：新增后端未鉴权回归断言（`workspace/search/favorites`）并通过 full gate。

Z4 布局一致性与导航几何收口：
- [x] Z4-1：修复主导航与页面内容重叠，补“左上导航与页面头部不重叠”几何回归（工作区 + 团队页，含断点覆盖）。
- [x] Z4-2：团队页容器与收藏页对齐（宽度、内边距、居中策略、滚动容器）并补稀疏/稠密几何断言。
- [x] Z4-3：保持既有高优先几何门禁（`files-panel-progressive-reveal`、`settings-languages`）稳定通过。

Z5 全局会话出口收口：
- [x] Z5-1：在壳层右上角新增全局“退出登录”入口，不再依赖团队页内局部出口。
- [x] Z5-2：退出后清理本地 token 并回到 `/login`，访问业务页会按守卫重定向。
- [x] Z5-3：新增 e2e 回归覆盖全局退出链路（点击退出 -> 登录页 -> token 清空 -> 受保护路由拦截）。

### 20.3 当前状态

1. 当前状态：✅ 已完成（阶段二登录与鉴权收敛加固已验收通过）。
2. 当前阻塞：无。

### 2026-03-18｜线程 F/G/H 加固（登录入口与鉴权收敛）

1. 目标：落实阶段二“账号与权限治理”的收口要求，修复入口未登录直达、路由未鉴权、工具栏承担主导航等问题。
2. 结果：
   - 前端：新增登录页与路由守卫，`/` 入口统一到 `/login`，业务路由需通过会话校验后访问。
   - 导航：新增常规主导航并保留工具栏快捷属性，页面间跳转不再依赖浮动工具栏。
   - 后端：`workspaces/search/favorites` 切换为必需鉴权，个人数据按 `ownerId` 隔离，避免跨用户可见。
   - 测试：新增登录回归与入口鉴权 e2e，现有 e2e 基座接入鉴权 fixture，阶段二回归链路完整通过。
3. 验证命令（均通过）：
   - `npm run test:run --workspace @snippet-archive/frontend`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
   - `npm run test --workspace @snippet-archive/backend`
   - `npm run test:e2e --workspace @snippet-archive/backend`
   - `npm run typecheck --workspace @snippet-archive/frontend`
   - `npm run build`

### 2026-03-18｜线程 F/G/H 加固后续（导航安全区 + 团队页版式一致性）

1. 目标：修复左上主导航与页面内容重叠、统一团队页与其他页面版式，并按 `TESTING.md` 落实几何断言回归。
2. 结果：
   - 导航安全区：`ShellApp` 引入动态顶部安全区变量（基于主导航/右上操作组实时计算），并将偏移应用到各路由页面根容器，避免固定导航遮挡业务内容。
   - 团队页统一：`TeamPage` 对齐 `Favorites/Search` 的容器基线（宽度、居中、内边距、卡片样式、滚动策略），消除版式差异。
   - 回归补齐：新增并通过以下 e2e 断言
     - `auth-entry-navigation`：主导航与 `workspace sidebar/team header` 不重叠（含 2048 与 900 宽度断点）。
     - `team-collaboration`：团队页与收藏页容器基线一致；团队页壳层几何（稀疏/稠密）持续满足视口约束。
   - 稳定性回归：`files-panel-progressive-reveal` 与 `settings-languages` 既有几何门禁在新布局下保持通过。
3. 验证命令（均通过）：
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend -- e2e/auth-entry-navigation.spec.ts e2e/team-collaboration.spec.ts`（先红后绿）
   - `npm run test:run --workspace @snippet-archive/frontend -- src/ShellApp.quick-capture.spec.ts src/pages/TeamPage.spec.ts`
   - `npm run test:run --workspace @snippet-archive/frontend`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
   - `npm run typecheck --workspace @snippet-archive/frontend`
   - `npm run check:theme-contract --workspace @snippet-archive/frontend`
   - `npm run test --workspace @snippet-archive/backend`
   - `npm run test:e2e --workspace @snippet-archive/backend`
   - `npm run build`

### 2026-03-18｜线程 F/G/H 加固后续（全局退出登录入口）

1. 目标：提供全局可见的退出登录入口，避免“仅团队页可退出”的路径隐蔽问题。
2. 结果：
   - 壳层能力：`ShellApp` 右上角新增全局退出按钮（非登录页显示），调用 `/auth/logout` 后统一清理 token 并跳转 `/login`。
   - 交互一致性：调整 `App.vue` 头部右侧预留空间，确保“设置/返回 + 退出 + 工具栏”在断点下仍满足不重叠几何约束。
   - 回归补齐：`auth-entry-navigation` 新增“全局退出链路”用例并先红后绿通过。
3. 验证命令（均通过）：
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend -- e2e/auth-entry-navigation.spec.ts -g "authenticated user can logout from global top actions and is redirected to login"`（先红后绿）
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend -- e2e/settings-languages.spec.ts -g "top-right icon group keeps one-row geometry across routes and breakpoints"`
   - `npm run test:run --workspace @snippet-archive/frontend -- src/ShellApp.quick-capture.spec.ts`
   - `npm run test:run --workspace @snippet-archive/frontend`
   - `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
   - `npm run typecheck --workspace @snippet-archive/frontend`
   - `npm run build --workspace @snippet-archive/frontend`

### 2026-03-18｜阶段二文档补齐（README + OpenAPI）

1. 目标：同步阶段二接口与能力说明，补齐 README 与 Swagger/OpenAPI 文档缺口，并加回归守护防止文档再次滞后。
2. 结果：
   - OpenAPI：`docs/openapi/workspace-v1.yaml` 对齐当前阶段二接口，补充 token 约束、审计 payload 与错误详情 schema 表达。
   - README：重写为阶段二现状说明，补齐登录入口/鉴权约束、API 文档入口、验证命令与文档维护约定。
   - 回归：`apps/backend/test/swagger.e2e-spec.ts` 新增 `/docs/json` 断言，确保关键阶段二路径（auth/org/share/audit）存在。
3. 验证命令（均通过）：
   - `npm run test:e2e --workspace @snippet-archive/backend -- swagger.e2e-spec.ts`

### 2026-03-18｜前端主题重设计（UI/UX Pro Max + Frontend Design）

1. 目标：解决“主题平庸、页面辨识度不足、交互反馈偏弱”问题；重做多套主题并同步升级设置页与壳层视觉交互。
2. 结果：
   - 主题体系：新增 4 套预置主题并接入系统目录，形成 13 套可切换主题。
     - `editorial-noir`（编辑感黑金玫红）
     - `brutal-signal`（高对比原始信号风）
     - `biome-light`（有机浅色薄荷珊瑚）
     - `deco-circuit`（装饰艺术暗色电路）
   - 页面改版：设置页“主题”升级为 Theme Lab 卡片化预览（字体标签、色带、描述、键盘/点击快速应用），并保留导入导出链路。
   - 交互优化：壳层导航与快速捕获面板补齐 hover/active/focus-visible 反馈与 reduced-motion 兼容，提升可用性与一致性。
   - 回归策略：按 `TESTING.md` 先红后绿执行，新增/更新主题相关单测与 e2e 断言后完成实现收口。
3. 验证命令：
   - 先红（已触发失败）：
     - `npm run --workspace @snippet-archive/frontend test:run -- src/App.settings.spec.ts src/themes/theme-runtime.spec.ts`
   - 目标回归（通过）：
     - `npm run --workspace @snippet-archive/frontend test:run -- src/App.settings.spec.ts src/themes/theme-runtime.spec.ts`
     - `npm run --workspace @snippet-archive/frontend test:e2e:smoke -- e2e/settings-languages.spec.ts`
   - 全量门禁（通过）：
     - `npm run --workspace @snippet-archive/frontend test:run`
     - `npm run --workspace @snippet-archive/frontend test:e2e:smoke`
     - `npm run --workspace @snippet-archive/frontend typecheck`
     - `npm run build`
   - 额外检查（存在历史遗留失败，未在本次改动中引入新失败项）：
   - `npm run --workspace @snippet-archive/frontend check:theme-guards`
   - 失败来源：`src/pages/LoginPage.vue`、`src/pages/TeamPage.vue` 既有硬编码颜色规则。

### 2026-03-18｜主题实验室可视区修复 + 原有主题视觉升级

1. 目标：
   - 修复“全局主题实验室高度过低，难以浏览完整主题卡片”的可用性问题。
   - 对原有主题进行 1.1 视觉升级，降低同质化并提升层次表现。
2. 结果：
   - 主题实验室：
     - 主题卡片区最小可视高度提升（默认可浏览区显著增大）。
     - 主题教程改为“默认折叠、按需展开”，将首屏空间优先给主题浏览与切换。
     - 展开后教程仍保持独立滚动，支持继续导入/导出与快速应用流程。
   - 原有主题（9 套）升级：
     - `meta.version` 升级至 `1.1.0`，描述文案更新。
     - 每套主题更新 `layout.appFontFamily`，提高字体风格区分度。
     - 每套主题更新 `layout.appShellBackground`、`surface.toolbarGlassBackground`、`accent.primaryButtonGradient`，增强空间层次与品牌辨识度。
3. 验证命令：
   - 先红（已触发失败）：
     - `npm run --workspace @snippet-archive/frontend test:run -- src/themes/theme-runtime.spec.ts`
     - `npm run --workspace @snippet-archive/frontend test:e2e:smoke -- e2e/settings-languages.spec.ts -g "settings themes tutorial stays contained and is scrollable"`
   - 目标回归（通过）：
     - `npm run --workspace @snippet-archive/frontend test:run -- src/App.settings.spec.ts src/themes/theme-runtime.spec.ts`
     - `npm run --workspace @snippet-archive/frontend test:e2e:smoke -- e2e/settings-languages.spec.ts -g "settings themes tutorial stays contained and is scrollable"`
   - 全量门禁（通过）：
     - `npm run --workspace @snippet-archive/frontend test:run`
     - `npm run --workspace @snippet-archive/frontend test:e2e:smoke`
     - `npm run --workspace @snippet-archive/frontend typecheck`
     - `npm run build`

### 2026-03-18｜第二轮主题强化（3 套差异化 + 1 套水墨）与 Theme Lab 中文化

1. 目标：
   - 在现有主题体系基础上继续强化视觉差异，新增 3 套更大胆方向并补 1 套水墨风格主题。
   - 主题设置中移除“系统预置主题下拉框”，统一使用全局主题实验室卡片切换。
   - 将全局主题实验室介绍文案统一为中文。
2. 结果：
   - 新增 4 套主题并接入系统内置目录（总量提升至 17 套）：
     - `acid-rush`（酸性霓虹）
     - `lava-forge`（熔岩锻造）
     - `cobalt-flux`（钴蓝高能）
     - `ink-wash-zen`（水墨留白）
   - 交互改造：
     - 删除设置页“系统预置主题”下拉框及其逻辑，保留并强化卡片式快速切换（点击 + 键盘）。
   - 文案与信息层：
     - Theme Lab 顶部介绍、主题模板示例字段说明改为中文表达。
     - 内置主题描述统一改为中文，保证主题实验室“介绍信息”一致中文化。
   - 测试同步：
     - 单测与 e2e 从“下拉框切换断言”迁移为“卡片切换断言”，并扩展到 17 套主题循环切换。
3. 验证命令（均通过）：
   - 目标回归：
     - `npm run --workspace @snippet-archive/frontend test:run -- src/App.settings.spec.ts src/themes/theme-runtime.spec.ts`
     - `npm run --workspace @snippet-archive/frontend test:e2e:smoke -- e2e/settings-languages.spec.ts`
   - 全量门禁：
     - `npm run --workspace @snippet-archive/frontend test:run`
     - `npm run --workspace @snippet-archive/frontend test:e2e:smoke`
     - `npm run --workspace @snippet-archive/frontend typecheck`
     - `npm run build`
