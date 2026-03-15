# Editor Core Capabilities Design

**Date:** 2026-03-15

## Goal

For a snippet-archive product where code editing and saving is the primary value, evolve the editor from “basic editable area” into a reliable, extensible core focused on data safety, edit efficiency, and future IDE-like growth.

## Product Priorities (confirmed)

1. Auto-save
2. Crash/session-reopen draft recovery
3. Search/replace
4. Undo/redo experience hardening
5. Paste-time language auto-detection
6. Editor status bar (language, line count, encoding; recommended extra: EOL, cursor)
7. One-click formatting
8. Snapshot/history rollback

## Library Strategy

Keep CodeMirror 6 for now.

Reasoning:
1. Existing integration is stable and typed.
2. All confirmed capabilities are feasible with CodeMirror ecosystem.
3. Migration to Monaco now would increase bundle/runtime complexity without immediate payoff.

Re-evaluate library choice only when deeper IDE demands appear (full LSP parity, advanced diff/merge workflows, collaborative editing conflict model, etc.).

## Phased Architecture

### Phase 1 (implement now): Auto-save + Draft Recovery

Scope:
1. Debounced auto-save for dirty active file.
2. Local draft cache keyed by `workspaceId + fileId`.
3. Restore local draft when reopening/reselecting file.
4. Clear draft cache after successful save.

Data flow:
1. User edits -> store `draftContent/dirty` updates.
2. Dirty update persists local snapshot.
3. App-level debounce timer triggers save API.
4. Save success reloads server file + clears local snapshot.
5. On next file selection/load, if snapshot exists and differs from server content, restore snapshot as current draft.

Extensibility:
1. Draft cache helpers centralized in store (reusable by future snapshots/history).
2. Auto-save scheduling isolated in app orchestration layer (can later add per-file cadence/priority).

### Phase 2: Search/Replace + Undo/Redo UX

Add editor panels/keymaps and visible affordances. Keep command wiring isolated from store.

### Phase 3: Language Detection + Status Bar

Add paste heuristics service and read-only status metadata strip under editor.

### Phase 4: Formatting + Snapshot Rollback

Introduce formatter adapter layer and snapshot persistence interface.

## Testing Strategy

Phase 1 required tests:
1. Store-level local draft persistence and restore behavior.
2. Store-level draft cleanup after save.
3. App-level debounce auto-save trigger.
4. Existing full regression gates remain mandatory.

Behavior checks include click, keyboard, focus/blur, and state transitions, plus persistence-level assertions.

## Risks and Mitigations

1. Save frequency too high: debounce + dirty/saving guards.
2. Stale local drafts: prune cache when files disappear.
3. Node test env without browser storage: storage helpers must no-op safely when unavailable.

