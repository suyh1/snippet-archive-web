# Snippet Archive Web

这是从 `snippet-archive-utools` 迁移出来的非 uTools 版本项目。

## 目录结构

- `apps/frontend`: Web 前端（与原项目同技术栈）
- `apps/backend`: Web API 服务

## 前端技术栈

- Vue 3
- TypeScript
- Pinia
- Vite
- Reka UI
- Tailwind CSS v4
- Motion for Vue (`motion-v`)
- CodeMirror 6

## 后端与数据库技术栈

- 后端: NestJS + Fastify Adapter + TypeScript + Prisma
- 数据库: PostgreSQL

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
