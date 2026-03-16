import { PrismaClient } from '@prisma/client'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import request from 'supertest'
import { createTestApp } from './helpers/test-app'

describe('Search API (e2e)', () => {
  const prisma = new PrismaClient()
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  beforeEach(async () => {
    await prisma.workspaceFile.deleteMany()
    await prisma.workspace.deleteMany()
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('searches snippets by keyword over title/path/content', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        title: 'Search Workspace',
        description: '',
        tags: ['searchable'],
        starred: false,
      },
    })

    await prisma.workspaceFile.create({
      data: {
        workspaceId: workspace.id,
        name: 'token.ts',
        path: '/src/token.ts',
        language: 'typescript',
        content: 'const token = process.env.API_TOKEN',
        kind: 'file',
        order: 1,
      },
    })

    await prisma.workspaceFile.create({
      data: {
        workspaceId: workspace.id,
        name: 'readme.md',
        path: '/docs/readme.md',
        language: 'markdown',
        content: 'hello world',
        kind: 'file',
        order: 2,
      },
    })

    const res = await request(app.getHttpServer())
      .get('/api/search/snippets')
      .query({ keyword: 'token', page: 1, pageSize: 10 })

    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(1)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.items[0]).toEqual(
      expect.objectContaining({
        name: 'token.ts',
        path: '/src/token.ts',
      }),
    )
  })

  it('supports language and tag filters with stable pagination', async () => {
    const backendWorkspace = await prisma.workspace.create({
      data: {
        title: 'Backend Snippets',
        description: '',
        tags: ['backend'],
        starred: false,
      },
    })

    const frontendWorkspace = await prisma.workspace.create({
      data: {
        title: 'Frontend Snippets',
        description: '',
        tags: ['frontend'],
        starred: false,
      },
    })

    await prisma.workspaceFile.create({
      data: {
        workspaceId: backendWorkspace.id,
        name: 'service.ts',
        path: '/src/service.ts',
        language: 'typescript',
        content: 'export class Service {}',
        kind: 'file',
        order: 1,
        tags: ['backend'],
      } as any,
    })

    await prisma.workspaceFile.create({
      data: {
        workspaceId: backendWorkspace.id,
        name: 'schema.sql',
        path: '/db/schema.sql',
        language: 'sql',
        content: 'select 1;',
        kind: 'file',
        order: 2,
        tags: ['backend'],
      } as any,
    })

    await prisma.workspaceFile.create({
      data: {
        workspaceId: frontendWorkspace.id,
        name: 'ui.ts',
        path: '/src/ui.ts',
        language: 'typescript',
        content: 'export const ui = true',
        kind: 'file',
        order: 3,
        tags: ['frontend'],
      } as any,
    })

    const page1 = await request(app.getHttpServer())
      .get('/api/search/snippets')
      .query({ language: 'typescript', tag: 'backend', page: 1, pageSize: 1 })

    expect(page1.status).toBe(200)
    expect(page1.body.data.total).toBe(1)
    expect(page1.body.data.items).toHaveLength(1)
    expect(page1.body.data.page).toBe(1)
    expect(page1.body.data.pageSize).toBe(1)
    expect(page1.body.data.items[0]).toEqual(
      expect.objectContaining({
        workspaceId: backendWorkspace.id,
        name: 'service.ts',
      }),
    )
  })
})
