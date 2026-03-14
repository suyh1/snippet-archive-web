# Task E 质量与交付基线设计文档

## 1. 目标

在 Task A~D 已完成的基础上，补齐质量基线，保证后续迭代可持续：

1. 后端补充 service 单元测试，覆盖 path/order 关键分支。
2. 前端补充关键组件测试，覆盖工作区侧栏与文件树拖拽行为。
3. 补充 OpenAPI 文档，覆盖 workspace/file 核心接口（含 move）。

## 2. 方案对比

### 方案 A：仅补 e2e（不加单测）
- 优点：速度快。
- 缺点：定位失败成本高，边界分支不可控。

### 方案 B：后端单测 + 前端组件测 + OpenAPI（推荐）
- 优点：单测负责细粒度逻辑，e2e 负责端到端，文档与实现同步。
- 缺点：一次性改动较多。

### 方案 C：先写 OpenAPI，再慢慢补测试
- 优点：文档优先，外部联调更友好。
- 缺点：文档可能先于真实行为漂移。

已选：**方案 B**。

## 3. 设计要点

### 3.1 后端单元测试范围

测试目标：`WorkspaceService`。

重点覆盖：

- `moveWorkspaceFile`：
  - 文件移动到新路径。
  - 文件夹禁止移动到自身子孙路径（Conflict）。
- `createWorkspaceFile`：路径规范化与根路径拦截。
- `normalizeWorkspaceOrders`：同级顺序连续化。

策略：Mock PrismaService，避免依赖数据库，保持单测快速稳定。

### 3.2 前端组件测试范围

- `WorkspaceSidebar`：
  - 新建触发 `create` 事件。
  - 点击条目触发 `open`。
  - 点击删除触发 `delete`。
- `FileTree`：
  - 根目录 drop 触发 `moveFile`。
  - 非法 folder 自嵌套移动不触发 `moveFile`。

策略：使用 Vitest + Vue Test Utils，覆盖关键交互而非视觉细节。

### 3.3 OpenAPI 文档

新增文档文件：`docs/openapi/workspace-v1.yaml`。

覆盖接口：

- Workspace CRUD
- WorkspaceFile CRUD
- Move API
- 统一响应结构（`data` / `error`）

## 4. 验证策略

- 后端：`npm run test --workspace @snippet-archive/backend` + `npm run test:e2e --workspace @snippet-archive/backend`
- 前端：`npm run test:run --workspace @snippet-archive/frontend` + `npm run typecheck --workspace @snippet-archive/frontend`
- 全局：`npm run build`

## 5. 非目标

- 不新增业务功能。
- 不改动现有 API 行为（除修复明确缺陷）。
- 不引入额外大型测试框架。
