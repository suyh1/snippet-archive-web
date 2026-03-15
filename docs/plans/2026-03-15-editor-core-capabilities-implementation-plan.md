# Editor Core Capabilities Phase-1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver phase-1 editor reliability: debounced auto-save and local draft recovery.

**Architecture:** Keep editing source-of-truth in Pinia store, add storage-safe draft cache helpers there, and add app-level debounce orchestration for auto-save.

**Tech Stack:** Vue 3, Pinia, CodeMirror 6, Vitest, Playwright.

---

### Task 1: Add failing tests for store draft persistence/recovery

**Files:**
- Create: `apps/frontend/src/stores/workspace.store.draft.spec.ts`

**Steps:**
1. Add happy-dom tests for local draft persistence and restore.
2. Add test for cache clear after successful save.
3. Run targeted test and confirm initial FAIL.

### Task 2: Add failing test for app debounce auto-save

**Files:**
- Create: `apps/frontend/src/App.autosave.spec.ts`

**Steps:**
1. Add fake-timer test that dirty draft triggers delayed `updateFile`.
2. Run targeted test and confirm initial FAIL.

### Task 3: Implement store draft cache helpers

**Files:**
- Modify: `apps/frontend/src/stores/workspace.store.ts`

**Steps:**
1. Add storage-safe cache read/write helpers.
2. Persist drafts in `setDraftContent` when dirty.
3. Restore draft on select/sync flows.
4. Clear cache on successful save.
5. Prune stale cache entries on file load.

### Task 4: Implement app-level debounced auto-save

**Files:**
- Modify: `apps/frontend/src/App.vue`

**Steps:**
1. Add watch-based debounce for dirty active file.
2. Trigger `saveCurrentFile` with guard conditions.
3. Ensure timer cleanup on unmount and dependency change.

### Task 5: Verify targeted regressions

**Steps:**
1. Run `workspace.store.draft.spec.ts`.
2. Run `App.autosave.spec.ts`.
3. Run existing editor-related tests (`App.unsaved.spec.ts`, etc.).

### Task 6: Run mandatory full gates

**Steps:**
1. `npm run test:run --workspace @snippet-archive/frontend`
2. `npm run test:e2e:smoke --workspace @snippet-archive/frontend`
3. `npm run typecheck --workspace @snippet-archive/frontend`
4. `npm run build --workspace @snippet-archive/frontend`

