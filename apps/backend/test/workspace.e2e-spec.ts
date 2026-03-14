import { PrismaClient } from '@prisma/client'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import request from 'supertest'
import { createTestApp } from './helpers/test-app'

describe('Workspace API (e2e)', () => {
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

  it('supports workspace CRUD', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/workspaces')
      .send({ title: 'Workspace A' })

    expect(created.status).toBe(201)
    expect(created.body.data.title).toBe('Workspace A')
    expect(created.body.data.description).toBe('')
    expect(created.body.data.tags).toEqual([])
    expect(created.body.data.starred).toBe(false)

    const workspaceId = created.body.data.id

    const listRes = await request(app.getHttpServer()).get('/api/workspaces')

    expect(listRes.status).toBe(200)
    expect(Array.isArray(listRes.body.data.items)).toBe(true)
    expect(listRes.body.data.items).toHaveLength(1)
    expect(listRes.body.data.items[0].id).toBe(workspaceId)

    const detailRes = await request(app.getHttpServer()).get(
      `/api/workspaces/${workspaceId}`,
    )

    expect(detailRes.status).toBe(200)
    expect(detailRes.body.data.id).toBe(workspaceId)

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspaceId}`)
      .send({
        title: 'Workspace A Updated',
        starred: true,
        tags: ['backend'],
      })

    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.title).toBe('Workspace A Updated')
    expect(patchRes.body.data.starred).toBe(true)
    expect(patchRes.body.data.tags).toEqual(['backend'])

    const deleteRes = await request(app.getHttpServer()).delete(
      `/api/workspaces/${workspaceId}`,
    )

    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body.data).toEqual({ id: workspaceId })

    const notFoundRes = await request(app.getHttpServer()).get(
      `/api/workspaces/${workspaceId}`,
    )

    expect(notFoundRes.status).toBe(404)
    expect(notFoundRes.body.error.code).toBe('NOT_FOUND')
  })

  it('validates payload for workspace creation', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/workspaces')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})
