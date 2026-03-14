# Task E Quality Baseline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 补齐后端单元测试、前端关键组件测试与 OpenAPI 文档，形成可持续迭代的质量基线。

**Architecture:** 后端使用 Jest + mocked PrismaService 覆盖 WorkspaceService 核心分支；前端使用 Vitest + Vue Test Utils 覆盖组件交互行为；OpenAPI 以静态 YAML 描述 v1 核心接口与统一响应结构。

**Tech Stack:** NestJS, Jest, Prisma, Vue 3, Vitest, Vue Test Utils, OpenAPI 3.0 YAML

---

### Task 1: 后端 service 单测红灯

**Files:**
- Create: `apps/backend/src/workspace/workspace.service.spec.ts`

**Step 1: 写失败单测**

- `moveWorkspaceFile` 的冲突分支。
- `createWorkspaceFile` 的路径校验分支。
- `moveWorkspaceFile` 成功分支。

**Step 2: 运行测试确认失败**

Run: `npm run test --workspace @snippet-archive/backend -- workspace.service.spec.ts`
Expected: FAIL（测试文件与 mock 尚未完整）。

### Task 2: 后端 service 单测转绿

**Files:**
- Modify: `apps/backend/src/workspace/workspace.service.spec.ts`

**Step 1: 补齐 Prisma mock 与断言**

- 校验调用参数。
- 校验异常类型。

**Step 2: 运行测试确认通过**

Run: `npm run test --workspace @snippet-archive/backend -- workspace.service.spec.ts`
Expected: PASS。

### Task 3: 前端组件测试红灯

**Files:**
- Modify: `apps/frontend/package.json`
- Create: `apps/frontend/src/features/workspace/WorkspaceSidebar.spec.ts`
- Create: `apps/frontend/src/features/workspace/FileTree.spec.ts`

**Step 1: 引入 Vue Test Utils（如缺失）并写失败测试**

- 侧栏 create/open/delete 事件。
- 文件树拖拽触发 move 与非法路径拦截。

**Step 2: 运行测试确认失败**

Run: `npm run test:run --workspace @snippet-archive/frontend`
Expected: FAIL（初始断言/环境缺口）。

### Task 4: 前端组件测试转绿

**Files:**
- Modify: `apps/frontend/src/test/setup.ts`
- Modify: `apps/frontend/src/features/workspace/WorkspaceSidebar.vue`（如需测试定位标记）
- Modify: `apps/frontend/src/features/workspace/FileTree.vue`（如需测试定位标记）
- Modify: `apps/frontend/src/features/workspace/WorkspaceSidebar.spec.ts`
- Modify: `apps/frontend/src/features/workspace/FileTree.spec.ts`

**Step 1: 最小改动使测试稳定**

- 仅添加必要 test id 与稳定选择器。
- 不改业务行为。

**Step 2: 运行测试确认通过**

Run: `npm run test:run --workspace @snippet-archive/frontend`
Expected: PASS。

### Task 5: OpenAPI 文档补齐

**Files:**
- Create: `docs/openapi/workspace-v1.yaml`
- Modify: `README.md`

**Step 1: 新增 OpenAPI 文件**

覆盖：
- Workspace CRUD
- WorkspaceFile CRUD
- Move API
- `ApiSuccess` / `ApiError` schemas

**Step 2: README 增加文档入口**

### Task 6: 最终验证与状态同步

**Files:**
- Modify: `docs/2026-03-14-next-thread-plan.md`

**Step 1: 全量验证**

Run: `npm run test --workspace @snippet-archive/backend`
Run: `npm run test:e2e --workspace @snippet-archive/backend`
Run: `npm run test:run --workspace @snippet-archive/frontend`
Run: `npm run typecheck --workspace @snippet-archive/frontend`
Run: `npm run build`
Expected: PASS。

**Step 2: 更新 next-thread 状态**

- 标注 Task E 已完成项。
- 给出下一阶段建议任务。
