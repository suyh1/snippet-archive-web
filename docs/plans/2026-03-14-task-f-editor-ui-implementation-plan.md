# Task F Editor & Interaction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成文件编辑保存、重命名/删除入口、拖拽反馈增强三项能力。

**Architecture:** 扩展前端 API client 与 Pinia store 管理编辑状态；FileTree 组件负责交互事件与反馈展示；App 负责命令交互与布局编排。

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, Vue Test Utils

---

### Task 1: Store 测试红灯

**Files:**
- Modify: `apps/frontend/src/stores/workspace.store.spec.ts`

**Step 1: 添加失败用例**
- `saveCurrentFile` 调用 `updateFile`。
- `renameFile` 调用 `moveFile`。
- `deleteFile` 清理 active selection。

**Step 2: 运行确认失败**
Run: `npm run test:run --workspace @snippet-archive/frontend`
Expected: FAIL。

### Task 2: FileTree 组件测试红灯

**Files:**
- Modify: `apps/frontend/src/features/workspace/FileTree.spec.ts`

**Step 1: 添加失败用例**
- 点击行触发 `select-file`。
- 点击按钮触发 `rename-file`/`delete-file`。
- 非法拖拽显示反馈消息。

**Step 2: 运行确认失败**
Run: `npm run test:run --workspace @snippet-archive/frontend`
Expected: FAIL。

### Task 3: 实现 API + Store

**Files:**
- Modify: `apps/frontend/src/api/workspaces.ts`
- Modify: `apps/frontend/src/stores/workspace.store.ts`

**Step 1: API 新增 updateFile**
**Step 2: Store 新增编辑/重命名/删除能力**

**Step 3: 运行测试**
Run: `npm run test:run --workspace @snippet-archive/frontend`
Expected: 部分转绿，组件测试可能仍失败。

### Task 4: 实现 FileTree 交互与反馈

**Files:**
- Modify: `apps/frontend/src/features/workspace/FileTree.vue`
- Modify: `apps/frontend/src/features/workspace/FileTree.spec.ts`

**Step 1: 新增 select/rename/delete 事件和 UI 按钮**
**Step 2: 新增拖拽有效/无效高亮与错误提示**

**Step 3: 运行测试转绿**
Run: `npm run test:run --workspace @snippet-archive/frontend`
Expected: PASS。

### Task 5: App 视图整合编辑器

**Files:**
- Modify: `apps/frontend/src/App.vue`

**Step 1: 加入编辑面板与保存按钮**
**Step 2: 接入 select/rename/delete/move/save 交互**

**Step 3: 前端检查**
Run: `npm run typecheck --workspace @snippet-archive/frontend`
Run: `npm run build --workspace @snippet-archive/frontend`
Expected: PASS。

### Task 6: 最终验证与文档同步

**Files:**
- Modify: `docs/2026-03-14-next-thread-plan.md`

**Step 1: 全量验证**
Run: `npm run test:run --workspace @snippet-archive/frontend`
Run: `npm run typecheck --workspace @snippet-archive/frontend`
Run: `npm run build`
Expected: PASS。

**Step 2: 更新 next-thread 状态**
- 标注 Task F 完成。
- 给出 Task G 下一步。
