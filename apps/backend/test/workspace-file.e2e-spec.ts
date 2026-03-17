import { PrismaClient } from '@prisma/client'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import request from 'supertest'
import { registerAccount, uniqueEmail, withAuth } from './helpers/auth'
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
    const owner = await registerAccount(app, uniqueEmail('workspace-file-owner'), 'Workspace File Owner')

    const workspace = await prisma.workspace.create({
      data: {
        title: 'Workspace For Files',
        description: '',
        tags: [],
        starred: false,
        ownerId: owner.userId,
      },
    })

    const createRes = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspace.id}/files`)
      .set(withAuth(owner.accessToken))
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

    const listRes = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspace.id}/files`)
      .set(withAuth(owner.accessToken))

    expect(listRes.status).toBe(200)
    expect(listRes.body.data.items).toHaveLength(1)
    expect(listRes.body.data.items[0].id).toBe(fileId)

    const detailRes = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspace.id}/files/${fileId}`)
      .set(withAuth(owner.accessToken))

    expect(detailRes.status).toBe(200)
    expect(detailRes.body.data.id).toBe(fileId)

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspace.id}/files/${fileId}`)
      .set(withAuth(owner.accessToken))
      .send({ content: 'console.log(2)', order: 2 })

    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.content).toBe('console.log(2)')
    expect(patchRes.body.data.order).toBe(1)

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/workspaces/${workspace.id}/files/${fileId}`)
      .set(withAuth(owner.accessToken))

    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body.data).toEqual({ id: fileId })

    const notFoundRes = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspace.id}/files/${fileId}`)
      .set(withAuth(owner.accessToken))

    expect(notFoundRes.status).toBe(404)
    expect(notFoundRes.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 404 when file does not belong to workspace', async () => {
    const owner = await registerAccount(app, uniqueEmail('workspace-file-not-belong'), 'Workspace File Not Belong')

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

    const res = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceB.id}/files/${file.id}`)
      .set(withAuth(owner.accessToken))

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('updates file tags and starred state', async () => {
    const owner = await registerAccount(app, uniqueEmail('workspace-file-tags'), 'Workspace File Tags')

    const workspace = await prisma.workspace.create({
      data: {
        title: 'Meta Workspace',
        description: '',
        tags: ['backend'],
        starred: false,
        ownerId: owner.userId,
      },
    })

    const created = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspace.id}/files`)
      .set(withAuth(owner.accessToken))
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
      .set(withAuth(owner.accessToken))
      .send({
        tags: ['backend', 'security'],
        starred: true,
      })

    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.tags).toEqual(['backend', 'security'])
    expect(patchRes.body.data.starred).toBe(true)
  })

  it('moves a file into another folder and keeps sibling order normalized', async () => {
    const owner = await registerAccount(app, uniqueEmail('workspace-file-move'), 'Workspace File Move')

    const workspace = await prisma.workspace.create({
      data: {
        title: 'Move Workspace',
        description: '',
        tags: [],
        starred: false,
        ownerId: owner.userId,
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
      .set(withAuth(owner.accessToken))
      .send({
        targetPath: `${targetFolder.path}/a.ts`,
        targetOrder: 1,
      })

    expect(moveRes.status).toBe(200)
    expect(moveRes.body.data.path).toBe('/dst/a.ts')
    expect(moveRes.body.data.order).toBe(1)

    const listRes = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspace.id}/files`)
      .set(withAuth(owner.accessToken))

    expect(listRes.status).toBe(200)
    expect(listRes.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/dst', order: 1 }),
        expect.objectContaining({ path: '/dst/a.ts', order: 1 }),
      ]),
    )
  })

  it('moves folder recursively and updates descendant paths', async () => {
    const owner = await registerAccount(app, uniqueEmail('workspace-file-recursive'), 'Workspace File Recursive')

    const workspace = await prisma.workspace.create({
      data: {
        title: 'Recursive Move',
        description: '',
        tags: [],
        starred: false,
        ownerId: owner.userId,
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
      .set(withAuth(owner.accessToken))
      .send({
        targetPath: '/archived/src',
      })

    expect(moveRes.status).toBe(200)
    expect(moveRes.body.data.path).toBe('/archived/src')

    const listRes = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspace.id}/files`)
      .set(withAuth(owner.accessToken))

    expect(listRes.status).toBe(200)
    expect(listRes.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/archived/src' }),
        expect.objectContaining({ path: '/archived/src/main.ts' }),
      ]),
    )
  })

  it('rejects moving folder into its own descendant', async () => {
    const owner = await registerAccount(app, uniqueEmail('workspace-file-invalid-move'), 'Workspace File Invalid Move')

    const workspace = await prisma.workspace.create({
      data: {
        title: 'Invalid Move',
        description: '',
        tags: [],
        starred: false,
        ownerId: owner.userId,
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
      .set(withAuth(owner.accessToken))
      .send({
        targetPath: '/src/child/src',
      })

    expect(moveRes.status).toBe(409)
    expect(moveRes.body.error.code).toBe('CONFLICT')
  })
})
