# AGENTS.md

## 必读：项目通用测试方案

在开始任何需求前，先阅读仓库根目录的 [TESTING.md](./TESTING.md)。  
`TESTING.md` 提供跨项目通用测试检查方法；本文件提供本仓库的强制约束。若有差异，执行更严格规则。

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

## Layout Verification (Viewport/Fill Cases)

These checks are mandatory for layout changes involving full-height panels, split views, or overflow behavior.

1. Do not rely on visual alignment between sibling panels only.
2. Add behavior-level geometry assertions in e2e using `getBoundingClientRect()`:
   - Container-to-viewport (`app shell`/page root vs `window.innerHeight`)
   - Child-to-parent bottom alignment (panel bottom vs parent content-box bottom)
   - Document overflow (`documentElement.scrollHeight` and `body.scrollHeight` vs viewport)
3. Validate at least two states:
   - Sparse/empty state (few or zero rows)
   - Dense state (many rows/items)
4. If layout uses segmented/paginated rendering, verify both initial segment and after segment transitions (`click` and keyboard trigger).
5. Keep tolerance explicit in assertions (e.g. ≤2px for alignment, ≤4px for viewport-height comparisons) and document it in test code.

## Verification Reporting

When reporting completion, always include:
- Which interaction flows were manually/behaviorally validated
- Which regression tests were added/updated
- Command outputs for full suite/typecheck/build
