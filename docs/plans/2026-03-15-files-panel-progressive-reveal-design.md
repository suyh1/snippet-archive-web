# Files Panel Progressive Reveal Design

**Date:** 2026-03-15

## Goal

Fix workspace page layout so Files + Editor panels stretch to the viewport bottom without trailing blank space, and prevent the entire page from scrolling when file count grows. Replace always-growing file list behavior with a more elegant progressive reveal model (collapse + show-more) instead of a visible scrollbar in the Files area.

## Problems Observed

1. Main workspace section does not consume remaining viewport height, causing visible blank area at the bottom.
2. File list growth expands the overall document height, so the browser/body gets the scrollbar.
3. Current Files panel has no list-size control strategy (no collapse/pagination/progressive reveal/virtualization).

## Constraints

1. Keep existing create/rename/move/delete interactions intact.
2. Keep mobile behavior usable (current one-column fallback remains).
3. Preserve drag-and-drop behavior for visible rows.
4. Avoid introducing visible Files panel scrollbar as the primary browsing UX.

## Chosen Approach (Approved)

Use a **collapsed tree + progressive reveal** model:

1. Add expand/collapse state for folders in the Files tree.
2. Default: root starts expanded; folder children hidden until expanded.
3. Add progressive reveal cap for visible rows (e.g. first 80 visible rows), with a “显示更多” action to append additional rows in chunks (e.g. +80).
4. Keep Files panel content clipped to panel boundaries (`overflow: hidden`) and prevent document-level growth by constraining parent layout heights.

This keeps the interface elegant while avoiding a conventional visible scrollbar.

## Layout Design

1. Make viewport chain explicit: `html`, `body`, `#app` all `height: 100%`.
2. Set main shell to fixed viewport height (`height: 100vh`) and internal grid rows that can shrink (`minmax(0, 1fr)`).
3. Ensure every intermediate container in workspace mode uses `min-height: 0` so children can shrink without forcing document expansion.
4. Set workspace main area as a two-column grid with constrained height and `overflow: hidden`.
5. Set both FileTree and Editor panels to fill available height.

## FileTree Interaction Design

1. Folder row includes a chevron toggle button.
2. Folder collapsed: descendants omitted from visible rows.
3. Progressive reveal applies on already-filtered visible rows.
4. Footer action shown when hidden rows remain: “显示更多 (N)” and optional “收起到默认” reset.
5. If create/rename draft row exists, keep it visible even when row cap is exceeded.
6. Keyboard:
   - `Enter` on toggle button expands/collapses.
   - Existing `Enter/Esc` create/rename behavior remains unchanged.

## Testing Strategy

1. Regression unit test in `FileTree.spec.ts` for progressive reveal:
   - many rows -> initial cap applied
   - click show-more -> more rows rendered
   - toggle folder -> descendants hidden/shown
2. Regression behavior-level e2e test:
   - create many files via real input typing + Enter
   - verify document-level height remains viewport height (no body scrolling growth)
   - verify show-more interaction via click/keyboard path
   - verify rename/create `Enter/Esc` and blur still work
3. Run mandatory suite:
   - targeted regression tests
   - full frontend tests
   - frontend typecheck
   - frontend build

## Risks

1. Drag/drop on collapsed descendants is naturally unavailable until expanded.
2. Very large trees may still benefit from virtualization later; progressive reveal is phase-1 UX control.
3. Responsive one-column mode needs careful min-height settings to avoid clipped editor.

