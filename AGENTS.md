# AGENTS.md

## Mandatory Verification Workflow

These rules are mandatory for every functional change in this repository.

1. Do not rely on `build`/`typecheck`/unit pass as the only verification.
2. For every changed user interaction, run behavior-level verification by simulating real UI input.
3. Behavior-level verification must include, at minimum:
   - Click flow (`click`, focus switch, blur)
   - Keyboard flow (`Enter`, `Esc`, continuous typing)
   - State transition after interaction (UI text, list order, persisted result)
4. Every interaction bugfix must have a regression test that reproduces the original issue pattern.
5. A task is not considered complete until all of the following pass:
   - Targeted regression tests for changed behavior
   - Full frontend test suite
   - Typecheck
   - Build
6. If verification reveals mismatch between expected and actual interaction behavior, continue iterating until behavior matches product intent.

## Verification Reporting

When reporting completion, always include:
- Which interaction flows were manually/behaviorally validated
- Which regression tests were added/updated
- Command outputs for full suite/typecheck/build
