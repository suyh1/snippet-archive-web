# Workspace API v1 (NestJS) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将后端从 Fastify 骨架升级为 NestJS + Fastify Adapter，并交付 Workspace 与 WorkspaceFile 的 v1 CRUD API（含统一校验和错误响应）。

**Architecture:** 使用 `AppModule + PrismaModule + WorkspaceModule` 的模块化结构；入口采用 Nest Fastify Adapter；通过全局 `ValidationPipe` 和全局异常过滤器统一输入与错误输出；Service 层封装 Prisma 访问并在 Controller 层暴露 REST 接口。

**Tech Stack:** NestJS, Fastify Adapter, Prisma, PostgreSQL, class-validator, Jest, Supertest, TypeScript

---

### Task 1: 引入 NestJS 运行骨架

**Files:**
- Modify: `apps/backend/package.json`
- Modify: `apps/backend/tsconfig.json`
- Create: `apps/backend/src/main.ts`
- Create: `apps/backend/src/app.module.ts`
- Create: `apps/backend/src/health/health.controller.ts`
- Modify: `apps/backend/src/index.ts`（删除旧入口或改为重导出）

**Step 1: 写失败的 e2e 测试（/health）**

```ts
// apps/backend/test/health.e2e-spec.ts
it('GET /health should return ok payload', async () => {
  const res = await request(app.getHttpServer()).get('/health')
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ status: 'ok' })
})
```

**Step 2: 运行测试确认失败**

Run: `npm run test:e2e --workspace @snippet-archive/backend`
Expected: FAIL，提示 Nest 启动入口或模块缺失。

**Step 3: 写最小 Nest 入口与 HealthController 实现**

```ts
@Controller()
export class HealthController {
  @Get('/health')
  health() {
    return { status: 'ok' }
  }
}
```

**Step 4: 重新运行测试确认通过**

Run: `npm run test:e2e --workspace @snippet-archive/backend -- health.e2e-spec.ts`
Expected: PASS。

**Step 5: 提交**

```bash
git add apps/backend/package.json apps/backend/tsconfig.json apps/backend/src/main.ts apps/backend/src/app.module.ts apps/backend/src/health/health.controller.ts apps/backend/src/index.ts apps/backend/test/health.e2e-spec.ts
git commit -m "feat(backend): bootstrap nest app with health endpoint"
```

### Task 2: 接入 PrismaModule 与统一响应/错误处理基础设施

**Files:**
- Create: `apps/backend/src/prisma/prisma.service.ts`
- Create: `apps/backend/src/prisma/prisma.module.ts`
- Create: `apps/backend/src/common/filters/http-exception.filter.ts`
- Create: `apps/backend/src/common/types/api-response.ts`
- Modify: `apps/backend/src/main.ts`
- Modify: `apps/backend/src/app.module.ts`

**Step 1: 写失败测试（未知路由返回统一错误结构）**

```ts
it('returns normalized not found error payload', async () => {
  const res = await request(app.getHttpServer()).get('/api/not-found')
  expect(res.status).toBe(404)
  expect(res.body.error.code).toBe('NOT_FOUND')
})
```

**Step 2: 运行测试确认失败**

Run: `npm run test:e2e --workspace @snippet-archive/backend -- health.e2e-spec.ts`
Expected: FAIL，返回体结构不匹配。

**Step 3: 实现最小异常过滤器与全局挂载**

```ts
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // map to { error: { code, message, details? } }
  }
}
```

**Step 4: 重新运行测试确认通过**

Run: `npm run test:e2e --workspace @snippet-archive/backend -- health.e2e-spec.ts`
Expected: PASS。

**Step 5: 提交**

```bash
git add apps/backend/src/prisma apps/backend/src/common apps/backend/src/main.ts apps/backend/src/app.module.ts apps/backend/test/health.e2e-spec.ts
git commit -m "feat(backend): add prisma module and global error normalization"
```

### Task 3: Workspace CRUD（TDD）

**Files:**
- Create: `apps/backend/src/workspace/workspace.module.ts`
- Create: `apps/backend/src/workspace/workspace.controller.ts`
- Create: `apps/backend/src/workspace/workspace.service.ts`
- Create: `apps/backend/src/workspace/dto/create-workspace.dto.ts`
- Create: `apps/backend/src/workspace/dto/update-workspace.dto.ts`
- Modify: `apps/backend/src/app.module.ts`
- Create: `apps/backend/test/workspace.e2e-spec.ts`

**Step 1: 写失败 e2e（列表、创建、详情、更新、删除）**

```ts
it('supports workspace CRUD', async () => {
  const created = await request(server).post('/api/workspaces').send({ title: 'A' })
  expect(created.status).toBe(201)

  const listed = await request(server).get('/api/workspaces')
  expect(listed.status).toBe(200)
  expect(listed.body.data.items.length).toBeGreaterThan(0)
})
```

**Step 2: 运行测试确认失败**

Run: `npm run test:e2e --workspace @snippet-archive/backend -- workspace.e2e-spec.ts`
Expected: FAIL，路由缺失。

**Step 3: 实现最小控制器/服务/DTO 使测试通过**

```ts
@Post()
create(@Body() dto: CreateWorkspaceDto) {
  return this.workspaceService.create(dto)
}
```

**Step 4: 重新运行测试确认通过**

Run: `npm run test:e2e --workspace @snippet-archive/backend -- workspace.e2e-spec.ts`
Expected: PASS。

**Step 5: 提交**

```bash
git add apps/backend/src/workspace apps/backend/src/app.module.ts apps/backend/test/workspace.e2e-spec.ts
git commit -m "feat(backend): implement workspace v1 crud endpoints"
```

### Task 4: WorkspaceFile 子资源 CRUD（TDD）

**Files:**
- Create: `apps/backend/src/workspace/dto/create-workspace-file.dto.ts`
- Create: `apps/backend/src/workspace/dto/update-workspace-file.dto.ts`
- Modify: `apps/backend/src/workspace/workspace.controller.ts`
- Modify: `apps/backend/src/workspace/workspace.service.ts`
- Create: `apps/backend/test/workspace-file.e2e-spec.ts`

**Step 1: 写失败 e2e（文件创建、查询、更新、删除）**

```ts
it('supports workspace file CRUD scoped by workspace', async () => {
  // create workspace then file
  const createFile = await request(server)
    .post(`/api/workspaces/${workspaceId}/files`)
    .send({ name: 'a.ts', path: '/a.ts', language: 'ts', kind: 'file', order: 1 })
  expect(createFile.status).toBe(201)
})
```

**Step 2: 运行测试确认失败**

Run: `npm run test:e2e --workspace @snippet-archive/backend -- workspace-file.e2e-spec.ts`
Expected: FAIL，子资源路由缺失。

**Step 3: 实现最小路由与服务（workspaceId + fileId 归属校验）**

```ts
const file = await this.prisma.workspaceFile.findFirst({
  where: { id: fileId, workspaceId },
})
if (!file) throw new NotFoundException('Workspace file not found')
```

**Step 4: 重新运行测试确认通过**

Run: `npm run test:e2e --workspace @snippet-archive/backend -- workspace-file.e2e-spec.ts`
Expected: PASS。

**Step 5: 提交**

```bash
git add apps/backend/src/workspace apps/backend/test/workspace-file.e2e-spec.ts
git commit -m "feat(backend): implement workspace file v1 crud endpoints"
```

### Task 5: 统一回归验证与文档同步

**Files:**
- Modify: `README.md`
- Modify: `docs/2026-03-14-next-thread-plan.md`（更新状态）

**Step 1: 运行全部后端测试**

Run: `npm run test --workspace @snippet-archive/backend`
Expected: PASS。

**Step 2: 运行全项目构建**

Run: `npm run build`
Expected: PASS。

**Step 3: 更新文档中的后端状态**

- 标注后端已切换 NestJS。
- 标注 Workspace API v1 已完成范围。

**Step 4: 最终验证**

Run: `git status --short`
Expected: 仅包含预期改动。

**Step 5: 提交**

```bash
git add README.md docs/2026-03-14-next-thread-plan.md
git commit -m "docs: update backend status after nest and workspace api v1"
```
