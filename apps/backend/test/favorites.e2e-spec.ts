import { PrismaClient } from '@prisma/client'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import request from 'supertest'
import { registerAccount, uniqueEmail, withAuth } from './helpers/auth'
import { createTestApp } from './helpers/test-app'

describe('Favorites API (e2e)', () => {
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

  it('aggregates starred workspaces and files', async () => {
    const owner = await registerAccount(app, uniqueEmail('favorites-owner'), 'Favorites Owner')

    const workspaceA = await prisma.workspace.create({
      data: {
        title: 'Workspace A',
        description: '',
        tags: ['backend'],
        starred: true,
        ownerId: owner.userId,
      },
    })

    const workspaceB = await prisma.workspace.create({
      data: {
        title: 'Workspace B',
        description: '',
        tags: ['frontend'],
        starred: false,
        ownerId: owner.userId,
      },
    })

    await prisma.workspaceFile.create({
      data: {
        workspaceId: workspaceA.id,
        name: 'token.ts',
        path: '/src/token.ts',
        language: 'typescript',
        content: 'const token = process.env.API_TOKEN',
        tags: ['backend'],
        starred: true,
        kind: 'file',
        order: 1,
      } as never,
    })

    await prisma.workspaceFile.create({
      data: {
        workspaceId: workspaceB.id,
        name: 'ui.ts',
        path: '/src/ui.ts',
        language: 'typescript',
        content: 'export const ui = true',
        tags: ['frontend'],
        starred: false,
        kind: 'file',
        order: 2,
      } as never,
    })

    const res = await request(app.getHttpServer())
      .get('/api/favorites')
      .set(withAuth(owner.accessToken))
      .query({ page: 1, pageSize: 20 })

    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(2)
    expect(res.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'workspace', workspaceId: workspaceA.id }),
        expect.objectContaining({ type: 'file', workspaceId: workspaceA.id, path: '/src/token.ts' }),
      ]),
    )
  })

  it('rejects favorites query when authorization token is missing', async () => {
    const res = await request(app.getHttpServer()).get('/api/favorites')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('filters favorites by tag and type', async () => {
    const owner = await registerAccount(app, uniqueEmail('favorites-filter-owner'), 'Favorites Filter Owner')

    const workspaceA = await prisma.workspace.create({
      data: {
        title: 'Workspace A',
        description: '',
        tags: ['backend'],
        starred: true,
        ownerId: owner.userId,
      },
    })

    await prisma.workspaceFile.create({
      data: {
        workspaceId: workspaceA.id,
        name: 'token.ts',
        path: '/src/token.ts',
        language: 'typescript',
        content: 'const token = process.env.API_TOKEN',
        tags: ['backend'],
        starred: true,
        kind: 'file',
        order: 1,
      } as never,
    })

    const res = await request(app.getHttpServer())
      .get('/api/favorites')
      .set(withAuth(owner.accessToken))
      .query({ tag: 'backend', type: 'file', page: 1, pageSize: 20 })

    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(1)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.items[0]).toEqual(
      expect.objectContaining({
        type: 'file',
        workspaceId: workspaceA.id,
        tags: ['backend'],
      }),
    )
  })
})
