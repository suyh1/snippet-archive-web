import { PrismaClient } from '@prisma/client'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import request from 'supertest'
import { createTestApp } from './helpers/test-app'

describe('Workspace file API (e2e)', () => {
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

  it('supports workspace file CRUD scoped by workspace', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        title: 'Workspace For Files',
        description: '',
        tags: [],
        starred: false,
      },
    })

    const createRes = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspace.id}/files`)
      .send({
        name: 'main.ts',
        path: '/main.ts',
        language: 'typescript',
        content: 'console.log(1)',
        kind: 'file',
        order: 1,
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.data.workspaceId).toBe(workspace.id)
    expect(createRes.body.data.name).toBe('main.ts')

    const fileId = createRes.body.data.id

    const listRes = await request(app.getHttpServer()).get(
      `/api/workspaces/${workspace.id}/files`,
    )

    expect(listRes.status).toBe(200)
    expect(listRes.body.data.items).toHaveLength(1)
    expect(listRes.body.data.items[0].id).toBe(fileId)

    const detailRes = await request(app.getHttpServer()).get(
      `/api/workspaces/${workspace.id}/files/${fileId}`,
    )

    expect(detailRes.status).toBe(200)
    expect(detailRes.body.data.id).toBe(fileId)

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspace.id}/files/${fileId}`)
      .send({ content: 'console.log(2)', order: 2 })

    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.content).toBe('console.log(2)')
    expect(patchRes.body.data.order).toBe(2)

    const deleteRes = await request(app.getHttpServer()).delete(
      `/api/workspaces/${workspace.id}/files/${fileId}`,
    )

    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body.data).toEqual({ id: fileId })

    const notFoundRes = await request(app.getHttpServer()).get(
      `/api/workspaces/${workspace.id}/files/${fileId}`,
    )

    expect(notFoundRes.status).toBe(404)
    expect(notFoundRes.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 404 when file does not belong to workspace', async () => {
    const workspaceA = await prisma.workspace.create({
      data: {
        title: 'Workspace A',
        description: '',
        tags: [],
        starred: false,
      },
    })

    const workspaceB = await prisma.workspace.create({
      data: {
        title: 'Workspace B',
        description: '',
        tags: [],
        starred: false,
      },
    })

    const file = await prisma.workspaceFile.create({
      data: {
        workspaceId: workspaceA.id,
        name: 'orphan.ts',
        path: '/orphan.ts',
        language: 'typescript',
        content: '',
        kind: 'file',
        order: 1,
      },
    })

    const res = await request(app.getHttpServer()).get(
      `/api/workspaces/${workspaceB.id}/files/${file.id}`,
    )

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
