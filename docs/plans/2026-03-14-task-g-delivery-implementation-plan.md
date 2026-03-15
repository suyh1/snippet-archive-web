# Task G Delivery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 接入 Swagger UI、增加前端冒烟 e2e、统一错误与空状态文案，完善项目交付能力。

**Architecture:** 后端通过 Fastify swagger 插件加载现有 OpenAPI YAML；前端通过 Playwright 执行关键链路冒烟测试；API 层增加错误码到用户提示映射并由 Store/UI 统一消费。

**Tech Stack:** NestJS + Fastify, @fastify/swagger, Playwright, Vue 3, Pinia, TypeScript

---

### Task 1: Swagger UI 红灯验证

**Files:**
- Modify: `apps/backend/src/main.ts`
- Modify: `apps/backend/package.json`
- Create: `apps/backend/test/swagger.e2e-spec.ts`

**Step 1:** 写 e2e 测试（`GET /docs` 返回 200）

**Step 2:** 运行确认失败

Run: `npm run test:e2e --workspace @snippet-archive/backend -- swagger.e2e-spec.ts`
Expected: FAIL（路由不存在）

### Task 2: Swagger UI 实现

**Files:**
- Modify: `apps/backend/src/main.ts`
- Modify: `apps/backend/test/helpers/test-app.ts`（确保测试环境也注册 docs）
- Modify: `apps/backend/package.json`

**Step 1:** 安装并注册 swagger 插件

**Step 2:** 运行 `swagger.e2e` 转绿

### Task 3: 前端冒烟 e2e 红灯

**Files:**
- Modify: `apps/frontend/package.json`
- Create: `apps/frontend/playwright.config.ts`
- Create: `apps/frontend/e2e/smoke.spec.ts`

**Step 1:** 编写关键路径测试

**Step 2:** 运行确认失败

Run: `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
Expected: FAIL（实现或依赖缺失）

### Task 4: 冒烟 e2e 绿灯

**Files:**
- Modify: `apps/frontend/e2e/smoke.spec.ts`
- Modify: `apps/frontend/src/App.vue` / `FileTree.vue`（必要 test id）

**Step 1:** 最小增强选择器稳定性

**Step 2:** 运行冒烟测试转绿

### Task 5: 错误文案与空状态优化

**Files:**
- Create: `apps/frontend/src/utils/error-message.ts`
- Modify: `apps/frontend/src/api/http.ts`
- Modify: `apps/frontend/src/stores/workspace.store.ts`
- Modify: `apps/frontend/src/App.vue`

**Step 1:** 建立 `error.code -> UI 文案` 映射

**Step 2:** Store 与 UI 统一使用友好文案

**Step 3:** 优化 Library/Editor 空状态提示

### Task 6: 最终验证与文档同步

**Files:**
- Modify: `README.md`
- Modify: `docs/2026-03-14-next-thread-plan.md`

**Step 1:** 运行回归
- `npm run test:e2e --workspace @snippet-archive/backend`
- `npm run test:run --workspace @snippet-archive/frontend`
- `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
- `npm run typecheck --workspace @snippet-archive/frontend`
- `npm run build`

**Step 2:** 更新文档状态
