# Task G 设计文档（交付完善）

## 1. 目标

完成三项交付完善工作：

1. 基于现有 OpenAPI YAML 提供可访问的 Swagger UI。
2. 增加前端端到端冒烟测试，覆盖关键路径：新建 workspace -> 新建文件 -> 拖拽移动。
3. 统一错误提示文案与空状态体验。

## 2. 方案对比

### 方案 A：只保留静态 OpenAPI 文件 + 文档说明
- 优点：改动小。
- 缺点：联调体验弱，无法直接在浏览器调试。

### 方案 B：后端挂载 Swagger UI + Playwright e2e + 前端文案层（推荐）
- 优点：交付闭环完整，开发联调效率高。
- 缺点：新增 Playwright 依赖和测试脚本。

### 方案 C：生成 SDK 代替 Swagger UI
- 优点：类型安全 API 调用。
- 缺点：当前项目已有手写 API 层，收益不如先把 UI 文档和冒烟测试补齐。

已选：**方案 B**。

## 3. 设计细节

### 3.1 Swagger UI 接入

- 后端使用 `@fastify/swagger` + `@fastify/swagger-ui`。
- 启动时读取 `docs/openapi/workspace-v1.yaml` 并注册到 Fastify。
- 文档入口：`/docs`。

### 3.2 前端冒烟 e2e

- 使用 Playwright。
- 新增 `apps/frontend/e2e/smoke.spec.ts`。
- 通过 API 预清理数据，UI 执行关键链路：
  - 创建工作区
  - 创建文件
  - 拖拽文件到文件夹
  - 验证路径变化可见

### 3.3 错误与空状态文案

- 新增前端错误文案映射：按后端 `error.code` 映射用户友好提示。
- Library / Workspace / Editor 空状态统一语气与引导动作。
- 拖拽非法目标提示保留且明确。

## 4. 验证策略

- 后端：`npm run test:e2e --workspace @snippet-archive/backend`
- 前端：
  - `npm run test:run --workspace @snippet-archive/frontend`
  - `npm run test:e2e:smoke --workspace @snippet-archive/frontend`（新增）
  - `npm run typecheck --workspace @snippet-archive/frontend`
- 全局：`npm run build`

## 5. 非目标

- 不改业务接口语义。
- 不做 SDK 自动生成与替换现有 API 客户端。
- 不做视觉大改，仅做交付级文案与可用性增强。
