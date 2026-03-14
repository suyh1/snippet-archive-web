# Workspace API v1 设计文档（NestJS + Prisma）

## 1. 目标

在现有 `apps/backend` Fastify 轻量骨架基础上，完成以下两项：

1. 切换到 NestJS（Fastify Adapter）并保留 `/health` 探活接口。
2. 交付 Workspace API v1（含 `WorkspaceFile` 子资源 CRUD）并统一输入校验与错误响应格式。

## 2. 架构设计

### 2.1 模块划分

- `AppModule`: 应用根模块。
- `PrismaModule`: 提供 `PrismaService`，统一连接生命周期管理。
- `WorkspaceModule`: 承载 `workspace` 与 `workspace-file` 控制器、服务、DTO。

### 2.2 启动与路由

- 使用 NestJS + Fastify Adapter 启动服务。
- 全局 API 前缀：`/api`。
- `GET /health` 保持在无前缀路径，便于探活与运维检查。

## 3. API 设计（v1）

### 3.1 Workspace 资源

- `GET /api/workspaces`：列表
- `GET /api/workspaces/:id`：详情
- `POST /api/workspaces`：创建
- `PATCH /api/workspaces/:id`：更新
- `DELETE /api/workspaces/:id`：删除

### 3.2 WorkspaceFile 子资源

- `GET /api/workspaces/:workspaceId/files`：文件列表
- `GET /api/workspaces/:workspaceId/files/:fileId`：文件详情
- `POST /api/workspaces/:workspaceId/files`：创建文件
- `PATCH /api/workspaces/:workspaceId/files/:fileId`：更新文件
- `DELETE /api/workspaces/:workspaceId/files/:fileId`：删除文件

## 4. 输入校验策略

统一采用 `class-validator` + `ValidationPipe`：

- DTO 与 Nest 生态一致，便于后续 OpenAPI 与测试扩展。
- 创建与更新 DTO 分离，更新接口使用可选字段。
- UUID 参数在控制器层做参数校验。

## 5. 响应与错误规范

### 5.1 成功响应

- 统一封装：`{ data: ... }`

### 5.2 失败响应

- 统一封装：

```json
{
  "error": {
    "code": "VALIDATION_ERROR | NOT_FOUND | CONFLICT | INTERNAL_ERROR",
    "message": "...",
    "details": {}
  }
}
```

- 使用全局异常过滤器进行错误归一化，避免控制器内重复处理。

## 6. 数据与约束

沿用现有 Prisma schema：

- `Workspace`
- `WorkspaceFile`

关键约束：

- `WorkspaceFile` 必须属于对应 `workspaceId`。
- 文件查询/更新/删除需同时校验 `workspaceId + fileId` 归属，防止跨工作区误操作。

## 7. 测试策略

按 TDD 执行：

1. 先写 e2e 失败用例（health、workspace CRUD、file CRUD）。
2. 实现最小代码使测试通过。
3. 根据需要补充 service 层单测（关键异常分支）。

## 8. 非目标（本轮不做）

- OpenAPI 文档完善（放到后续质量任务）。
- 前端 API 接入改造（后续 Task C）。
- 文件夹与拖拽移动能力（后续 Task D）。
