import { PrismaClient } from '@prisma/client'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import request from 'supertest'
import { registerAccount, uniqueEmail, withAuth } from './helpers/auth'
import { createTestApp } from './helpers/test-app'

jest.setTimeout(20_000)

describe('Workspace file revisions API (e2e)', () => {
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

  it('lists revisions and restores an older revision', async () => {
    const owner = await registerAccount(app, uniqueEmail('revision-owner'), 'Revision Owner')

    const workspace = await prisma.workspace.create({
      data: {
        title: 'Revision Workspace',
        description: '',
        tags: [],
        starred: false,
        ownerId: owner.userId,
      },
    })

    const created = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspace.id}/files`)
      .set(withAuth(owner.accessToken))
      .send({
        name: 'main.ts',
        path: '/main.ts',
        language: 'typescript',
        content: 'const version = 1',
        kind: 'file',
        order: 1,
      })

    expect(created.status).toBe(201)
    const fileId = created.body.data.id as string

    const patchV2 = await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspace.id}/files/${fileId}`)
      .set(withAuth(owner.accessToken))
      .send({ content: 'const version = 2' })

    expect(patchV2.status).toBe(200)

    const patchV3 = await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspace.id}/files/${fileId}`)
      .set(withAuth(owner.accessToken))
      .send({ content: 'const version = 3', language: 'javascript' })

    expect(patchV3.status).toBe(200)

    const listRes = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspace.id}/files/${fileId}/revisions`)
      .set(withAuth(owner.accessToken))

    expect(listRes.status).toBe(200)
    expect(listRes.body.data.items).toHaveLength(2)
    expect(listRes.body.data.items[0]).toMatchObject({
      workspaceId: workspace.id,
      fileId,
      content: 'const version = 3',
      language: 'javascript',
      source: 'update',
    })
    expect(listRes.body.data.items[1]).toMatchObject({
      workspaceId: workspace.id,
      fileId,
      content: 'const version = 2',
      language: 'typescript',
      source: 'update',
    })

    const revisionToRestore = listRes.body.data.items[1].id as string
    const restoreRes = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspace.id}/files/${fileId}/revisions/${revisionToRestore}/restore`)
      .set(withAuth(owner.accessToken))

    expect(restoreRes.status).toBe(201)
    expect(restoreRes.body.data.content).toBe('const version = 2')
    expect(restoreRes.body.data.language).toBe('typescript')

    const fileRes = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspace.id}/files/${fileId}`)
      .set(withAuth(owner.accessToken))

    expect(fileRes.status).toBe(200)
    expect(fileRes.body.data.content).toBe('const version = 2')
    expect(fileRes.body.data.language).toBe('typescript')

    const afterRestoreList = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspace.id}/files/${fileId}/revisions`)
      .set(withAuth(owner.accessToken))

    expect(afterRestoreList.status).toBe(200)
    expect(afterRestoreList.body.data.items[0]).toMatchObject({
      content: 'const version = 2',
      language: 'typescript',
      source: 'restore',
    })
    expect(afterRestoreList.body.data.items).toHaveLength(3)
  })

  it('returns 404 when revision does not belong to target workspace file', async () => {
    const owner = await registerAccount(app, uniqueEmail('revision-not-found'), 'Revision Not Found')

    const workspaceA = await prisma.workspace.create({
      data: {
        title: 'Workspace A',
        description: '',
        tags: [],
        starred: false,
        ownerId: owner.userId,
      },
    })

    const workspaceB = await prisma.workspace.create({
      data: {
        title: 'Workspace B',
        description: '',
        tags: [],
        starred: false,
        ownerId: owner.userId,
      },
    })

    const fileA = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceA.id}/files`)
      .set(withAuth(owner.accessToken))
      .send({
        name: 'a.ts',
        path: '/a.ts',
        language: 'typescript',
        content: 'const a = 1',
        kind: 'file',
        order: 1,
      })

    expect(fileA.status).toBe(201)

    const updateA = await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspaceA.id}/files/${fileA.body.data.id}`)
      .set(withAuth(owner.accessToken))
      .send({ content: 'const a = 2' })

    expect(updateA.status).toBe(200)

    const revisionsA = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceA.id}/files/${fileA.body.data.id}/revisions`)
      .set(withAuth(owner.accessToken))

    expect(revisionsA.status).toBe(200)
    const revisionId = revisionsA.body.data.items[0].id as string

    const fileB = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceB.id}/files`)
      .set(withAuth(owner.accessToken))
      .send({
        name: 'b.ts',
        path: '/b.ts',
        language: 'typescript',
        content: 'const b = 1',
        kind: 'file',
        order: 1,
      })

    expect(fileB.status).toBe(201)

    const restoreRes = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceB.id}/files/${fileB.body.data.id}/revisions/${revisionId}/restore`)
      .set(withAuth(owner.accessToken))

    expect(restoreRes.status).toBe(404)
    expect(restoreRes.body.error.code).toBe('NOT_FOUND')
  })
})
