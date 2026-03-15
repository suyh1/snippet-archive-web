# Snippet Archive Web

这是从 `snippet-archive-utools` 迁移出来的非 uTools 版本项目，放在同级目录，便于独立开发和部署。

## 目录结构

- `apps/frontend`: Web 前端（与原项目同技术栈）
- `apps/backend`: Web API 服务

## 前端技术栈（与原项目一致）

- Vue 3
- TypeScript
- Pinia
- Vite
- Reka UI
- Tailwind CSS v4
- Motion for Vue (`motion-v`)
- CodeMirror 6

## 后端与数据库技术栈（已确认）

- 后端（目标架构）: NestJS + Fastify Adapter + TypeScript + Prisma
- 数据库: PostgreSQL

说明:

- `apps/backend` 已切换为 NestJS（Fastify Adapter）模块化架构。
- 已实现 Workspace API v1（含 `WorkspaceFile` 子资源 CRUD）。
- 已实现 `PATCH /api/workspaces/:workspaceId/files/:fileId/move`（支持文件夹递归移动）。
- 已接入 `class-validator` + 全局异常过滤器，统一校验与错误响应。
- 前端已接入真实后端，完成 Library / Workspace 双态与文件树拖拽移动主链路。
- 前端已接入文件编辑保存、重命名/删除入口与拖拽反馈增强。
- 编辑器已升级为 CodeMirror 6（行号 + 语法高亮）。
- 已支持 Cmd/Ctrl + S 快捷保存。
- 已补充未保存切换保护（浏览器离开 + 应用内切换三分支弹窗）。
- 重命名已升级为输入弹窗，并支持严格即时校验与同级冲突提示。
- 已接入 Swagger UI，文档入口为 `/docs`。
- 已增加 Playwright 冒烟 e2e（新建 workspace -> 新建文件 -> 拖拽移动）。
- 已统一错误提示文案与关键空状态提示。

## 快速开始

### 1. 安装依赖

```bash
cd /Users/subeipo/Documents/code/utools/snippet-archive-web
npm install
```

### 2. 准备数据库（PostgreSQL）

```bash
docker compose up -d
cp apps/backend/.env.example apps/backend/.env
npm run prisma:generate --workspace @snippet-archive/backend
npx prisma db push --schema apps/backend/prisma/schema.prisma
```

数据库状态（2026-03-14 已验证）:

- Docker Engine: 可用
- PostgreSQL 容器: `snippet_archive_postgres`
- 端口: `localhost:54329`
- `pg_isready`: 通过
- Prisma `db push`: 通过

### 3. 启动开发

```bash
npm run dev:frontend
npm run dev:backend
```

### 4. 构建

```bash
npm run build
```

### 5. 后端 e2e 测试

```bash
npm run test:e2e --workspace @snippet-archive/backend
```

### 6. 前端测试、类型检查与冒烟 e2e

```bash
npm run test:run --workspace @snippet-archive/frontend
npm run typecheck --workspace @snippet-archive/frontend
npm run test:e2e:smoke --workspace @snippet-archive/frontend
```

### 7. OpenAPI 与 Swagger 文档

- `docs/openapi/workspace-v1.yaml`
- `http://localhost:3001/docs`

## 下一步开发说明

下一次开启 Codex 线程时，请优先读取:

- `docs/2026-03-14-next-thread-plan.md`
- `docs/webstorm-fullstack-run-config.md`

该文档包含:

- 已确认技术栈
- 当前完成状态
- 下一阶段按优先级拆分的可执行任务
- WebStorm 全栈运行配置（可直接照着创建 Run Configurations）
