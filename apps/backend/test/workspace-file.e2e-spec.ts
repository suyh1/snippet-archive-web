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
    expect(patchRes.body.data.order).toBe(1)

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

  it('updates file tags and starred state', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        title: 'Meta Workspace',
        description: '',
        tags: ['backend'],
        starred: false,
      },
    })

    const created = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspace.id}/files`)
      .send({
        name: 'token.ts',
        path: '/src/token.ts',
        language: 'typescript',
        content: 'const token = 1',
        kind: 'file',
        order: 1,
      })

    expect(created.status).toBe(201)

    const fileId = created.body.data.id
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspace.id}/files/${fileId}`)
      .send({
        tags: ['backend', 'security'],
        starred: true,
      })

    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.tags).toEqual(['backend', 'security'])
    expect(patchRes.body.data.starred).toBe(true)
  })

  it('moves a file into another folder and keeps sibling order normalized', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        title: 'Move Workspace',
        description: '',
        tags: [],
        starred: false,
      },
    })

    const targetFolder = await prisma.workspaceFile.create({
      data: {
        workspaceId: workspace.id,
        name: 'dst',
        path: '/dst',
        language: 'plaintext',
        content: '',
        kind: 'folder',
        order: 1,
      },
    })

    const file = await prisma.workspaceFile.create({
      data: {
        workspaceId: workspace.id,
        name: 'a.ts',
        path: '/a.ts',
        language: 'typescript',
        content: '',
        kind: 'file',
        order: 2,
      },
    })

    const moveRes = await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspace.id}/files/${file.id}/move`)
      .send({
        targetPath: `${targetFolder.path}/a.ts`,
        targetOrder: 1,
      })

    expect(moveRes.status).toBe(200)
    expect(moveRes.body.data.path).toBe('/dst/a.ts')
    expect(moveRes.body.data.order).toBe(1)

    const listRes = await request(app.getHttpServer()).get(
      `/api/workspaces/${workspace.id}/files`,
    )

    expect(listRes.status).toBe(200)
    expect(listRes.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/dst', order: 1 }),
        expect.objectContaining({ path: '/dst/a.ts', order: 1 }),
      ]),
    )
  })

  it('moves folder recursively and updates descendant paths', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        title: 'Recursive Move',
        description: '',
        tags: [],
        starred: false,
      },
    })

    const folder = await prisma.workspaceFile.create({
      data: {
        workspaceId: workspace.id,
        name: 'src',
        path: '/src',
        language: 'plaintext',
        content: '',
        kind: 'folder',
        order: 1,
      },
    })

    await prisma.workspaceFile.create({
      data: {
        workspaceId: workspace.id,
        name: 'main.ts',
        path: '/src/main.ts',
        language: 'typescript',
        content: '',
        kind: 'file',
        order: 1,
      },
    })

    const moveRes = await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspace.id}/files/${folder.id}/move`)
      .send({
        targetPath: '/archived/src',
      })

    expect(moveRes.status).toBe(200)
    expect(moveRes.body.data.path).toBe('/archived/src')

    const listRes = await request(app.getHttpServer()).get(
      `/api/workspaces/${workspace.id}/files`,
    )

    expect(listRes.status).toBe(200)
    expect(listRes.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/archived/src' }),
        expect.objectContaining({ path: '/archived/src/main.ts' }),
      ]),
    )
  })

  it('rejects moving folder into its own descendant', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        title: 'Invalid Move',
        description: '',
        tags: [],
        starred: false,
      },
    })

    const folder = await prisma.workspaceFile.create({
      data: {
        workspaceId: workspace.id,
        name: 'src',
        path: '/src',
        language: 'plaintext',
        content: '',
        kind: 'folder',
        order: 1,
      },
    })

    const moveRes = await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspace.id}/files/${folder.id}/move`)
      .send({
        targetPath: '/src/child/src',
      })

    expect(moveRes.status).toBe(409)
    expect(moveRes.body.error.code).toBe('CONFLICT')
  })
})
