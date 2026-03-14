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

## 2. 当前状态（截至 2026-03-14）

- 新项目目录已建立: `/Users/subeipo/Documents/code/utools/snippet-archive-web`
- 前端基础脚手架可构建
- 后端已切换到 NestJS（Fastify Adapter）模块化架构
- 已完成 `AppModule`、`WorkspaceModule`、`PrismaModule`
- `/health` 保留可用，API 前缀为 `/api`
- Workspace API v1 已完成（含 `WorkspaceFile` 子资源 CRUD）
- 校验策略已固定：`class-validator` + 全局 `ValidationPipe`
- 错误响应已统一：`{ error: { code, message, details? } }`
- 后端 e2e 已覆盖 health/workspace/workspace-file 主链路（6 个用例）
- PostgreSQL 容器已启动并可用
- Prisma Client 已生成，`db push` 已通过

## 3. 下一线程优先任务（按顺序）

### Task C: 前端接入真实后端（下一优先）
1. 新建 API client 层（按模块封装）。
2. Pinia store 从本地 seed 切换为 API 驱动。
3. 保留现有 UI 交互行为（Library / Workspace 双态）。
4. 先完成“列表、打开、新建、删除工作区”主路径。

### Task D: 编辑器与文件树主链路
1. 接入文件 CRUD API。
2. 接入文件夹与拖拽移动 API。
3. 保证顺序（order）和路径（path）规则一致。

### Task E: 质量与交付基线
1. 后端: 在现有 e2e 基础上补齐 service 单元测试
2. 前端: 关键组件测试
3. 补充 OpenAPI 文档（最少覆盖 v1 核心接口）

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
