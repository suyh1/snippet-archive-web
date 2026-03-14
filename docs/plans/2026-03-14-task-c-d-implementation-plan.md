# Task C + Task D Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成前端 API 驱动主链路（工作区列表/打开/新建/删除）与文件树拖拽移动链路（含后端 move API 与顺序/路径一致性）。

**Architecture:** 前端采用 API Client + Pinia + 视图组件分层；后端在 WorkspaceFile 资源上新增 move 接口并在 service 层统一处理路径替换与顺序归一化；测试按 TDD 先写失败用例再实现最小代码。

**Tech Stack:** Vue 3, Pinia, TypeScript, NestJS, Prisma, Vitest, Jest e2e, Vite

---

### Task 1: 后端 move API 的失败用例（e2e）

**Files:**
- Modify: `apps/backend/test/workspace-file.e2e-spec.ts`

**Step 1: 写失败测试（文件移动 + 文件夹递归移动 + 非法移动）**

```ts
it('moves a file to another folder and updates path', async () => {
  const res = await request(server)
    .patch(`/api/workspaces/${workspaceId}/files/${fileId}/move`)
    .send({ targetPath: '/dst/main.ts', targetOrder: 1 })
  expect(res.status).toBe(200)
})
```

**Step 2: 运行测试确认失败**

Run: `npm run test:e2e --workspace @snippet-archive/backend -- workspace-file.e2e-spec.ts`
Expected: FAIL（404 或 move 逻辑缺失）。

**Step 3: 提交测试红灯基线**

```bash
git add apps/backend/test/workspace-file.e2e-spec.ts
git commit -m "test(backend): add failing move e2e scenarios"
```

### Task 2: 后端 move API 最小实现

**Files:**
- Create: `apps/backend/src/workspace/dto/move-workspace-file.dto.ts`
- Modify: `apps/backend/src/workspace/workspace.controller.ts`
- Modify: `apps/backend/src/workspace/workspace.service.ts`

**Step 1: 增加 DTO 与路由**

```ts
@Patch(':workspaceId/files/:fileId/move')
moveWorkspaceFile(...) {
  return this.workspaceService.moveWorkspaceFile(...)
}
```

**Step 2: 实现 service 逻辑**

- 校验目标路径。
- 文件移动：更新单节点 path/order。
- 文件夹移动：连带更新后代路径前缀。
- 调用归一化函数确保同级 `order` 连续。

**Step 3: 运行测试转绿**

Run: `npm run test:e2e --workspace @snippet-archive/backend -- workspace-file.e2e-spec.ts`
Expected: PASS。

**Step 4: 提交**

```bash
git add apps/backend/src/workspace/dto/move-workspace-file.dto.ts apps/backend/src/workspace/workspace.controller.ts apps/backend/src/workspace/workspace.service.ts
git commit -m "feat(backend): add workspace file move api with order normalization"
```

### Task 3: 前端测试与工程基础（先红灯）

**Files:**
- Modify: `apps/frontend/package.json`
- Create: `apps/frontend/vitest.config.ts`
- Create: `apps/frontend/src/test/setup.ts`
- Create: `apps/frontend/src/utils/path.spec.ts`
- Create: `apps/frontend/src/stores/workspace.store.spec.ts`

**Step 1: 引入 Vitest 与测试脚本**

- `test`, `test:run` 脚本。
- `vitest` + `happy-dom` 运行环境。

**Step 2: 写失败单测**

- 路径拼接/父目录计算。
- workspace store 的列表加载/新建/删除行为（mock API）。

**Step 3: 运行测试确认失败**

Run: `npm run test:run --workspace @snippet-archive/frontend`
Expected: FAIL（实现缺失）。

### Task 4: 前端 API Client + Store 最小实现

**Files:**
- Create: `apps/frontend/src/api/http.ts`
- Create: `apps/frontend/src/api/workspaces.ts`
- Create: `apps/frontend/src/types/workspace.ts`
- Create: `apps/frontend/src/stores/workspace.store.ts`
- Create: `apps/frontend/src/utils/path.ts`

**Step 1: 实现 API Client**

- 统一请求/错误处理。
- workspace 与 workspace-file API 方法封装。

**Step 2: 实现 store**

- `loadWorkspaces/openWorkspace/createWorkspace/deleteWorkspace`
- `loadWorkspaceFiles/createFile/createFolder/moveItem`

**Step 3: 运行前端单测转绿**

Run: `npm run test:run --workspace @snippet-archive/frontend`
Expected: PASS。

### Task 5: 前端视图实现（Library/Workspace 双态 + 文件树拖拽）

**Files:**
- Modify: `apps/frontend/src/App.vue`
- Modify: `apps/frontend/src/style.css`
- Create: `apps/frontend/src/features/workspace/FileTree.vue`
- Create: `apps/frontend/src/features/workspace/WorkspaceSidebar.vue`

**Step 1: 建立双态布局**

- 侧栏工作区列表。
- 主区 Library / Workspace 双态切换。

**Step 2: 接入主链路交互**

- 打开、新建、删除工作区。
- 显示文件树。
- 新建文件/文件夹。
- 拖拽触发 move API。

**Step 3: 运行前端类型检查与构建**

Run: `npm run typecheck --workspace @snippet-archive/frontend`
Run: `npm run build --workspace @snippet-archive/frontend`
Expected: PASS。

### Task 6: 最终回归与文档同步

**Files:**
- Modify: `README.md`
- Modify: `docs/2026-03-14-next-thread-plan.md`

**Step 1: 后端回归**

Run: `npm run test:e2e --workspace @snippet-archive/backend`
Expected: PASS。

**Step 2: 前端回归**

Run: `npm run test:run --workspace @snippet-archive/frontend`
Run: `npm run typecheck --workspace @snippet-archive/frontend`
Expected: PASS。

**Step 3: 全项目构建**

Run: `npm run build`
Expected: PASS。

**Step 4: 提交**

```bash
git add README.md docs/2026-03-14-next-thread-plan.md apps/backend apps/frontend package-lock.json
git commit -m "feat: finish task c d frontend integration and file tree move workflow"
```
