# Snippet Archive Web

Snippet Archive 的 Web 版本，当前已完成阶段二（团队协作升级）能力：

1. 账号与会话（注册、登录、登出、`me`）。
2. 组织与成员角色（`OWNER` / `EDITOR` / `VIEWER`）。
3. 受控分享（`PRIVATE` / `TEAM` / `PUBLIC`，支持过期与撤销）。
4. 审计日志（按组织、操作、用户、时间检索）。
5. 工作区/文件管理、全局搜索、收藏、历史版本回滚。

## 仓库结构

- `apps/frontend`: Vue 3 + Vite 前端应用
- `apps/backend`: NestJS + Prisma 后端 API
- `docs/openapi/workspace-v1.yaml`: 当前 API 契约文档（阶段二对齐）
- `docs/product-upgrade-execution-playbook.md`: 升级主路线图与执行记录
- `TESTING.md`: 统一测试与验证门禁

## 技术栈

- 前端：Vue 3、TypeScript、Pinia、Vue Router、CodeMirror 6、Tailwind CSS v4
- 后端：NestJS（Fastify Adapter）、TypeScript、Prisma
- 数据库：PostgreSQL

## 快速开始

### 1) 安装依赖

```bash
cd /Users/subeipo/Documents/code/utools/snippet-archive-web
npm install
```

### 2) 启动数据库并准备 Schema

```bash
docker compose up -d
cp apps/backend/.env.example apps/backend/.env
npm run prisma:generate --workspace @snippet-archive/backend
npx prisma db push --schema apps/backend/prisma/schema.prisma
```

### 3) 启动开发环境

```bash
npm run dev:backend
npm run dev:frontend
```

默认地址：

- 前端：`http://localhost:5173`（如端口被占用，以 Vite 输出为准）
- 后端：`http://localhost:3001`

### 4) 登录入口与鉴权

- 项目入口为登录页：`/login`。
- 完成登录后才可访问业务页面（工作区/搜索/收藏/团队/设置）。
- API 鉴权方式：`Authorization: Bearer <accessToken>`。

## API 文档（Swagger/OpenAPI）

- OpenAPI 文件：`docs/openapi/workspace-v1.yaml`
- Swagger UI：`http://localhost:3001/docs`
- OpenAPI JSON：`http://localhost:3001/docs/json`

当前文档覆盖以下接口分组：

1. `auth`：注册、登录、会话、登出。
2. `organizations`：组织与成员管理。
3. `workspaces/files/revisions`：工作区、文件、版本回滚。
4. `share-links`：分享链接创建/查询/撤销/访问。
5. `audit-logs`：组织审计日志查询。
6. `search`、`favorites`：检索与收藏聚合。

## 测试与验证

按 `TESTING.md` 执行，常用命令如下：

```bash
# backend
npm run test --workspace @snippet-archive/backend
npm run test:e2e --workspace @snippet-archive/backend

# frontend
npm run test:run --workspace @snippet-archive/frontend
npm run test:e2e:smoke --workspace @snippet-archive/frontend
npm run typecheck --workspace @snippet-archive/frontend

# build
npm run build
```

## 文档维护约定

1. API 变更后，必须同步更新 `docs/openapi/workspace-v1.yaml`。
2. 能力与流程变化后，必须同步更新本 README。
3. 阶段推进与执行证据统一追加到 `docs/product-upgrade-execution-playbook.md`。
