# Editor Phase-4 Format + Snapshot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete remaining editor core capabilities: one-click formatting and snapshot rollback.

**Architecture:** Add formatter adapter + snapshot persistence in store, wire toolbar/dialog interactions in App, and validate through unit + e2e behavior tests.

**Tech Stack:** Vue 3, Pinia, CodeMirror 6, Prettier, Vitest, Playwright.

---

### Task 1: Add failing tests for language formatting and snapshot behavior

**Files:**
- Create: `apps/frontend/src/utils/formatter.spec.ts`
- Create: `apps/frontend/src/stores/workspace.store.snapshot.spec.ts`
- Create: `apps/frontend/e2e/editor-format-snapshot.spec.ts`

**Steps:**
1. Add formatter unit tests by language and unsupported fallback.
2. Add store tests for snapshot create/list/restore.
3. Add e2e flow for format then rollback.
4. Run targeted tests and confirm initial FAIL.

### Task 2: Implement formatter adapter and snapshot data model

**Files:**
- Create: `apps/frontend/src/utils/formatter.ts`
- Modify: `apps/frontend/src/types/workspace.ts`
- Modify: `apps/frontend/src/stores/workspace.store.ts`

**Steps:**
1. Add language-to-parser adapter and safe error handling.
2. Add snapshot types and localStorage helpers.
3. Add snapshot create/list/restore/prune actions.
4. Ensure workspace/file lifecycle paths prune stale snapshots.

### Task 3: Add App interactions and UI for formatting + rollback

**Files:**
- Modify: `apps/frontend/src/App.vue`
- Create: `apps/frontend/src/features/workspace/SnapshotDialog.vue`

**Steps:**
1. Add toolbar actions (`format`, `snapshot`).
2. Add snapshot dialog with restore flow.
3. Create pre-format snapshot before applying format.
4. Keep status bar and dirty/save logic consistent.

### Task 4: Green targeted regressions

**Steps:**
1. Run new formatter and snapshot unit tests.
2. Run new e2e scenario.
3. Run related editor tests (autosave, tools, status).

### Task 5: Run mandatory full gates

**Steps:**
1. `npm run test:run --workspace @snippet-archive/frontend`
2. `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
3. `npm run typecheck --workspace @snippet-archive/frontend`
4. `npm run build --workspace @snippet-archive/frontend`
