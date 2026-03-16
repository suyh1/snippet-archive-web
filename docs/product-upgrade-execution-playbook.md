# Snippet Archive Web 产品升级执行方案

> 目标：把当前“可编辑的个人代码片段仓库”升级为“可沉淀、可检索、可协作、可扩展的工程化产品”。
> 适用方式：可直接按本文拆分新线程执行。

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
6. 线程 F：账号与组织基础（未开始）。
7. 线程 G：权限与分享链接（未开始）。
8. 线程 H：审计日志与管理页面（未开始）。
9. 线程 I：VS Code 插件 PoC（未开始）。
10. 线程 J：CLI + 导入导出协议（未开始）。

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

## 8. 文档维护规则

1. 本文件作为“主路线图”，后续只增量更新，不拆散为大量历史计划。
2. 每个新线程完成后，在本文件追加“执行记录”小节（日期/目标/结果/待办）。
3. 所有已过时计划文档不再保留，避免上下文噪声。

## 9. 执行与追踪规则（新增）

1. 计划细化统一维护在本文件中，不再拆分到独立计划文档；新线程的详细步骤直接追加到对应线程小节。
2. 每个功能/线程完成后，必须在本文件对应条目显式标记“已完成”（例如在线程清单中标注 `✅`）。
3. 标记完成的同一次提交中，必须追加执行记录（日期、目标、结果、验证命令与结论），保证“任务状态”与“证据”同步更新。

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
