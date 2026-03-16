# AGENTS.md

## 必读入口（新线程先看这里）

在开始任何需求前，按顺序阅读以下文档：

1. [TESTING.md](./TESTING.md)  
   说明统一测试与验证流程（交互流、几何断言、门禁命令、汇报要求）。
2. [2026-03-16-product-upgrade-execution-playbook.md](./docs/2026-03-16-product-upgrade-execution-playbook.md)  
   说明产品三阶段升级路线、技术改造重点、线程拆分顺序与里程碑指标。

## 本仓库约束

1. `AGENTS.md` 只保留仓库入口与补充约束，不重复 `TESTING.md` 的通用条款。
2. 凡是功能改动、交互改动、布局改动，验证标准与通过条件一律以 `TESTING.md` 为准。
3. 若 `AGENTS.md` 与 `TESTING.md` 存在冲突，执行更严格规则。

## 新线程执行建议

1. 先在升级方案文档中定位当前线程所属阶段与任务编号。
2. 按 `TESTING.md` 先写回归测试（先红后绿），再做实现。
3. 完成后提供证据化汇报：交互覆盖、回归测试、全量命令输出。
