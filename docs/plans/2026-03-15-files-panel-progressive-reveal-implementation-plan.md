# Files Panel Progressive Reveal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make workspace layout fully viewport-contained and prevent document-level scrolling growth, while introducing collapsible tree + progressive reveal in Files panel.

**Architecture:** Constrain layout heights from `html/body/#app` down to `workspace-main` using explicit height and `min-height: 0` rules, then control rendered tree rows with derived `visibleRows` from collapse state and row-limit state.

**Tech Stack:** Vue 3 (`<script setup>`), Pinia store integration, Vitest + Vue Test Utils, Playwright.

---

### Task 1: Add failing regression tests for progressive reveal and folder collapse

**Files:**
- Modify: `apps/frontend/src/features/workspace/FileTree.spec.ts`

**Step 1: Write failing tests**

Add tests that assert:
1. large file list renders only initial visible subset and shows “显示更多”.
2. clicking “显示更多” increases rendered row count.
3. collapsing folder hides descendant rows, expanding restores them.

**Step 2: Run test to verify it fails**

Run: `npm run test --workspace @snippet-archive/frontend -- src/features/workspace/FileTree.spec.ts`
Expected: FAIL because current component has no collapse/reveal behavior.

**Step 3: Commit**

Deferred until implementation is complete.

### Task 2: Add failing regression test for workspace-level overflow containment behavior

**Files:**
- Create: `apps/frontend/src/App.layout.spec.ts`

**Step 1: Write failing test**

Mount `App`, force workspace mode with many files, and assert:
1. `.app-shell` uses fixed viewport height behavior.
2. workspace containers define shrinkable rows (`min-height: 0`) needed for containment.

**Step 2: Run test to verify it fails**

Run: `npm run test --workspace @snippet-archive/frontend -- src/App.layout.spec.ts`
Expected: FAIL because current layout classes/styles do not set required containment properties.

**Step 3: Commit**

Deferred until implementation is complete.

### Task 3: Implement minimal layout containment fix

**Files:**
- Modify: `apps/frontend/src/style.css`
- Modify: `apps/frontend/src/App.vue`
- Modify: `apps/frontend/src/features/workspace/FileTree.vue`

**Step 1: Implement height chain and shrink rules**

1. Add `height: 100%` to `html, body, #app`.
2. In `App.vue`, make app shell/workspace containers use explicit grid rows with `minmax(0, 1fr)` and `min-height: 0`.
3. Ensure `workspace-main`, `editor-panel`, and `file-tree` can fill and clip within available area.

**Step 2: Run layout regression tests**

Run: `npm run test --workspace @snippet-archive/frontend -- src/App.layout.spec.ts`
Expected: PASS.

### Task 4: Implement FileTree progressive reveal + collapse behavior

**Files:**
- Modify: `apps/frontend/src/features/workspace/FileTree.vue`
- Modify: `apps/frontend/src/features/workspace/FileTree.spec.ts`

**Step 1: Implement behavior**

1. Add folder expanded-state map.
2. Derive renderable rows by filtering descendants of collapsed folders.
3. Add `visibleLimit` with `loadMore/reset` controls.
4. Keep draft row visibility by reserving row when needed.
5. Add folder toggle UI affordance.

**Step 2: Run targeted tests**

Run: `npm run test --workspace @snippet-archive/frontend -- src/features/workspace/FileTree.spec.ts`
Expected: PASS.

### Task 5: Behavior-level E2E regression for interaction flow

**Files:**
- Create: `apps/frontend/e2e/files-panel-progressive-reveal.spec.ts`

**Step 1: Write e2e test**

Test must include:
1. click flow: create files/folders + show more
2. keyboard flow: typing, `Enter`, `Esc`
3. focus/blur flow on inline input
4. state transition checks: UI rows/panel content updates
5. containment assertion: no document-level overflow growth from many rows

**Step 2: Run targeted e2e test**

Run: `npm run test:e2e --workspace @snippet-archive/frontend -- e2e/files-panel-progressive-reveal.spec.ts`
Expected: PASS.

### Task 6: Run full required verification

**Files:**
- No code changes

**Step 1: Full frontend test suite**

Run: `npm run test --workspace @snippet-archive/frontend`
Expected: PASS.

**Step 2: Typecheck**

Run: `npm run typecheck --workspace @snippet-archive/frontend`
Expected: PASS.

**Step 3: Build**

Run: `npm run build --workspace @snippet-archive/frontend`
Expected: PASS.

