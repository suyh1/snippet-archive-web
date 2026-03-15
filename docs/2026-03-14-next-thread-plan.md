# Snippet Archive Web - Next Thread Plan

## 1. 已确认技术栈

### 前端（固定）
- Vue 3
- TypeScript
- Pinia
- Vite
- Reka UI
- Tailwind CSS v4
- Motion for Vue (`motion-v`)
- CodeMirror 6

### 后端（固定）
- NestJS（HTTP Adapter 使用 Fastify）
- TypeScript
- Prisma
- PostgreSQL

### 数据库（固定）
- PostgreSQL 16（Docker）
- 连接: `postgresql://snippet:snippet@localhost:54329/snippet_archive`

## 2. 当前状态（截至 2026-03-15，Task H 完成）

- 新项目目录已建立: `/Users/subeipo/Documents/code/utools/snippet-archive-web`
- 前端基础脚手架可构建
- 后端已切换到 NestJS（Fastify Adapter）模块化架构
- 已完成 `AppModule`、`WorkspaceModule`、`PrismaModule`
- `/health` 保留可用，API 前缀为 `/api`
- Workspace API v1 已完成（含 `WorkspaceFile` 子资源 CRUD）
- 文件移动 API 已完成：`PATCH /api/workspaces/:workspaceId/files/:fileId/move`
- 已实现路径与顺序一致性规则（path 规范化、同级 order 连续化）
- 校验策略已固定：`class-validator` + 全局 `ValidationPipe`
- 错误响应已统一：`{ error: { code, message, details? } }`
- 后端 e2e 已覆盖 health/workspace/workspace-file 主链路（9 个用例）
- 前端已完成 API Client + Pinia Store 接入真实后端
- 前端已完成 Library / Workspace 双态
- 前端已完成文件树展示、新建文件/文件夹、拖拽移动主链路
- 前端已完成文件编辑主链路（选择文件 -> 编辑 -> 保存）
- 前端已完成文件/文件夹重命名与删除入口（删除文件夹走后端级联）
- 前端已完成拖拽反馈增强（有效目标高亮、非法目标提示）
- 前端已引入 Vitest，并覆盖 path/store 关键单测（7 个用例）
- 后端已补充 WorkspaceService 单元测试（5 个用例）
- 前端已补充关键组件测试：`WorkspaceSidebar`、`FileTree`（5 个用例）
- 前端测试已扩展到 store + 关键组件（17 个用例）
- OpenAPI 文档已补充：`docs/openapi/workspace-v1.yaml`
- Swagger UI 已接入：`/docs`
- 前端 Playwright 冒烟 e2e 已补充（新建 workspace -> 新建文件 -> 拖拽移动）
- 前端错误提示文案已统一为用户友好提示（按 error.code 映射）
- Library / Workspace / Editor 关键空状态提示已优化
- 编辑器已升级为 CodeMirror 6（行号 + 语法高亮）
- 已支持 Cmd/Ctrl + S 快捷保存
- 已支持未保存保护：浏览器离开提示 + 应用内切换三分支弹窗（保存并继续/放弃/取消）
- 重命名交互已升级为弹窗输入，支持严格即时校验与同级冲突提示
- PostgreSQL 容器已启动并可用
- Prisma Client 已生成，`db push` 已通过

## 3. 下一线程优先任务（按顺序）

### Task G: 交付完善（已完成）
1. 基于 `docs/openapi/workspace-v1.yaml` 接入 Swagger UI 或生成 SDK
2. 增加前端端到端冒烟测试（关键路径：新建 workspace -> 新建文件 -> 拖拽移动）
3. 梳理错误提示文案与空状态体验

### Task H: 编辑器体验增强（已完成）
1. 将当前 `textarea` 编辑器升级为 CodeMirror 6（语法高亮 + 行号）
2. 增加保存快捷键（`Cmd/Ctrl + S`）与离开页面未保存提示
3. 增加重命名输入校验与冲突提示（前端即时反馈）

## 4. 启动命令（下次可直接复制）

```bash
cd /Users/subeipo/Documents/code/utools/snippet-archive-web

docker compose up -d
npm run dev:backend
npm run dev:frontend
```

## 5. 约束说明

- 所有工作限定在:
  - `/Users/subeipo/Documents/code/utools/snippet-archive-web`
  - `/Users/subeipo/Documents/code/utools`
- 不回写 `snippet-archive-utools` 旧项目代码。
