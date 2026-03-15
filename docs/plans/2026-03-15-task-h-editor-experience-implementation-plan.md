# Task H Editor Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 升级编辑器到 CodeMirror 6，补齐未保存切换保护与重命名即时校验，提升编辑体验完整度。

**Architecture:** 通过 `CodeEditor` 组件封装 CodeMirror 细节；通过 `useUnsavedGuard` 统一浏览器离开与应用内切换拦截；通过 `RenameDialog + rename-validation` 实现可视化输入与严格规则校验。

**Tech Stack:** Vue 3, TypeScript, Pinia, CodeMirror 6, Vitest

---

### Task 1: 重命名规则（TDD）

**Files:**
- Test: `apps/frontend/src/utils/rename-validation.spec.ts`
- Create: `apps/frontend/src/utils/rename-validation.ts`

**Step 1:** 编写失败测试（严格规则 + 冲突）

**Step 2:** 运行测试确认红灯

Run: `npm run test:run --workspace @snippet-archive/frontend -- src/utils/rename-validation.spec.ts`
Expected: FAIL

**Step 3:** 实现最小逻辑使测试转绿

**Step 4:** 再次运行测试

Run: `npm run test:run --workspace @snippet-archive/frontend -- src/utils/rename-validation.spec.ts`
Expected: PASS

### Task 2: 未保存保护交互（TDD）

**Files:**
- Test: `apps/frontend/src/App.unsaved.spec.ts`
- Create: `apps/frontend/src/composables/useUnsavedGuard.ts`
- Create: `apps/frontend/src/features/workspace/UnsavedChangesDialog.vue`
- Modify: `apps/frontend/src/App.vue`

**Step 1:** 编写失败测试（取消/放弃/保存并继续 + 切换文件）

**Step 2:** 运行测试确认红灯

Run: `npm run test:run --workspace @snippet-archive/frontend -- src/App.unsaved.spec.ts`
Expected: FAIL

**Step 3:** 实现 guard、弹窗与切换拦截

**Step 4:** 运行测试确认转绿

Run: `npm run test:run --workspace @snippet-archive/frontend -- src/App.unsaved.spec.ts`
Expected: PASS

### Task 3: 编辑器升级为 CodeMirror 6

**Files:**
- Modify: `apps/frontend/package.json`
- Create: `apps/frontend/src/features/workspace/CodeEditor.vue`
- Modify: `apps/frontend/src/App.vue`

**Step 1:** 引入所需语言扩展依赖

**Step 2:** 实现 `CodeEditor`（行号 + 语法高亮 + Mod-s）

**Step 3:** 替换 `textarea` 接入 `CodeEditor`

**Step 4:** 回归 `App` 现有测试

Run: `npm run test:run --workspace @snippet-archive/frontend -- src/App.spec.ts`
Expected: PASS

### Task 4: 重命名弹窗与即时校验接入

**Files:**
- Create: `apps/frontend/src/features/workspace/RenameDialog.vue`
- Modify: `apps/frontend/src/App.vue`
- Modify: `apps/frontend/src/stores/workspace.store.ts`

**Step 1:** 将 `window.prompt` 重命名改为对话框流

**Step 2:** 接入 `rename-validation` 与冲突禁用

**Step 3:** 保存成功后关闭弹窗，失败保留并展示错误

### Task 5: 全量回归与文档同步

**Files:**
- Modify: `docs/2026-03-14-next-thread-plan.md`
- Modify: `README.md`

**Step 1:** 运行回归

- `npm run test:run --workspace @snippet-archive/frontend`
- `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
- `npm run typecheck --workspace @snippet-archive/frontend`
- `npm run build`

**Step 2:** 更新 Task H 状态和运行说明
