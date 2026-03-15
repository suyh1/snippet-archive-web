# Editor Phase-4 Format + Snapshot Design

**Date:** 2026-03-15

## Goal

Deliver the remaining core editor capabilities in one milestone:
1. One-click formatting
2. Snapshot/history rollback

## Scope

### Formatting
1. Add formatter adapter with language-aware parser routing.
2. Support current editor languages: `typescript`, `javascript`, `json`, `markdown`, `html`, `vue`.
3. Keep unsupported language behavior safe (no destructive changes).

### Snapshot Rollback
1. Persist per-file snapshots in browser local storage.
2. Provide manual snapshot creation and list/recover interactions.
3. Automatically create a pre-format snapshot before applying formatted output.
4. Cap snapshot count per file to avoid unbounded growth.

## Architecture

1. Add `utils/formatter` adapter to isolate formatting engine and parser mapping.
2. Extend workspace store with snapshot persistence helpers and active-file snapshot actions.
3. Keep editor orchestration in `App.vue`:
   - trigger formatting
   - open snapshot dialog
   - restore selected snapshot
4. Keep UI style consistent with existing custom components; no browser-native dialogs.

## Data Model

Snapshot entry:
- `id`
- `workspaceId`
- `fileId`
- `content`
- `language`
- `source` (`manual` | `format`)
- `createdAt`

Storage:
- localStorage key with record grouped by `workspaceId:fileId`
- prune on workspace/file lifecycle events

## UX

1. Add editor toolbar buttons:
   - `格式化`
   - `快照`
2. Add snapshot history dialog:
   - list snapshots (latest first)
   - one-click restore
   - optional manual snapshot creation button
3. Status bar remains visible and updates after rollback/format.

## Testing Strategy

1. Utility unit tests for formatter language routing.
2. Store unit tests for snapshot create/list/restore/prune behavior.
3. App/unit tests for toolbar flows and status transitions.
4. E2E behavior tests for real typing + format + snapshot rollback.
5. Mandatory full gates: full unit, full e2e smoke, typecheck, build.
