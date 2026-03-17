import { PrismaClient } from '@prisma/client'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import request from 'supertest'
import { createTestApp } from './helpers/test-app'

type AuthAccount = {
  accessToken: string
  userId: string
  email: string
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

async function registerAccount(
  app: NestFastifyApplication,
  email: string,
  name: string,
): Promise<AuthAccount> {
  const password = 'Passw0rd!pass'

  const registerRes = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({
      email,
      name,
      password,
    })

  expect(registerRes.status).toBe(201)

  const loginRes = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email,
      password,
    })

  expect(loginRes.status).toBe(201)

  return {
    accessToken: loginRes.body.data.accessToken as string,
    userId: loginRes.body.data.user.id as string,
    email,
  }
}

describe('Permissions & share links API (e2e)', () => {
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

  it('enforces workspace write permissions by role', async () => {
    const owner = await registerAccount(app, uniqueEmail('owner-pm'), 'Owner PM')
    const editor = await registerAccount(app, uniqueEmail('editor-pm'), 'Editor PM')
    const viewer = await registerAccount(app, uniqueEmail('viewer-pm'), 'Viewer PM')

    const createOrgRes = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Share Matrix Org',
        slug: `share-matrix-${Date.now()}`,
      })

    expect(createOrgRes.status).toBe(201)
    const orgId = createOrgRes.body.data.id as string

    const inviteEditorRes = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        email: editor.email,
        role: 'EDITOR',
      })

    expect(inviteEditorRes.status).toBe(201)

    const inviteViewerRes = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        email: viewer.email,
        role: 'VIEWER',
      })

    expect(inviteViewerRes.status).toBe(201)

    const createWorkspaceRes = await request(app.getHttpServer())
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        title: 'Team Snippets',
        organizationId: orgId,
      })

    expect(createWorkspaceRes.status).toBe(201)
    const workspaceId = createWorkspaceRes.body.data.id as string

    const createFileRes = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/files`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'token.ts',
        path: '/token.ts',
        language: 'typescript',
        content: 'const token = "a"',
        kind: 'file',
        order: 1,
      })

    expect(createFileRes.status).toBe(201)
    const fileId = createFileRes.body.data.id as string

    const viewerPatchRes = await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspaceId}/files/${fileId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({
        content: 'const token = "viewer"',
      })

    expect(viewerPatchRes.status).toBe(403)
    expect(viewerPatchRes.body.error.code).toBe('FORBIDDEN')

    const editorPatchRes = await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspaceId}/files/${fileId}`)
      .set('Authorization', `Bearer ${editor.accessToken}`)
      .send({
        content: 'const token = "editor"',
      })

    expect(editorPatchRes.status).toBe(200)
    expect(editorPatchRes.body.data.content).toContain('"editor"')
  })

  it('supports public/team/private share link access and expired protection', async () => {
    const owner = await registerAccount(app, uniqueEmail('owner-link'), 'Owner Link')
    const member = await registerAccount(app, uniqueEmail('member-link'), 'Member Link')
    const outsider = await registerAccount(app, uniqueEmail('outsider-link'), 'Outsider Link')

    const createOrgRes = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Share Org',
        slug: `share-org-${Date.now()}`,
      })

    expect(createOrgRes.status).toBe(201)
    const orgId = createOrgRes.body.data.id as string

    const inviteMemberRes = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        email: member.email,
        role: 'VIEWER',
      })

    expect(inviteMemberRes.status).toBe(201)

    const createWorkspaceRes = await request(app.getHttpServer())
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        title: 'Shared Workspace',
        organizationId: orgId,
      })

    expect(createWorkspaceRes.status).toBe(201)
    const workspaceId = createWorkspaceRes.body.data.id as string

    const createFileRes = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/files`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'shared.ts',
        path: '/shared.ts',
        language: 'typescript',
        content: 'export const shared = true',
        kind: 'file',
        order: 1,
      })

    expect(createFileRes.status).toBe(201)
    const fileId = createFileRes.body.data.id as string

    const createPublicRes = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/files/${fileId}/share-links`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        visibility: 'PUBLIC',
        permission: 'READ',
      })

    expect(createPublicRes.status).toBe(201)
    const publicToken = createPublicRes.body.data.token as string

    const publicAccessRes = await request(app.getHttpServer()).get(
      `/api/share-links/${publicToken}`,
    )

    expect(publicAccessRes.status).toBe(200)
    expect(publicAccessRes.body.data.file.id).toBe(fileId)

    const createTeamRes = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/files/${fileId}/share-links`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        visibility: 'TEAM',
        permission: 'READ',
      })

    expect(createTeamRes.status).toBe(201)
    const teamToken = createTeamRes.body.data.token as string

    const teamNoAuthRes = await request(app.getHttpServer()).get(
      `/api/share-links/${teamToken}`,
    )

    expect(teamNoAuthRes.status).toBe(401)
    expect(teamNoAuthRes.body.error.code).toBe('UNAUTHORIZED')

    const teamMemberRes = await request(app.getHttpServer())
      .get(`/api/share-links/${teamToken}`)
      .set('Authorization', `Bearer ${member.accessToken}`)

    expect(teamMemberRes.status).toBe(200)

    const teamOutsiderRes = await request(app.getHttpServer())
      .get(`/api/share-links/${teamToken}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)

    expect(teamOutsiderRes.status).toBe(403)
    expect(teamOutsiderRes.body.error.code).toBe('FORBIDDEN')

    const createPrivateRes = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/files/${fileId}/share-links`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        visibility: 'PRIVATE',
        permission: 'READ',
      })

    expect(createPrivateRes.status).toBe(201)
    const privateToken = createPrivateRes.body.data.token as string
    const privateMemberRes = await request(app.getHttpServer())
      .get(`/api/share-links/${privateToken}`)
      .set('Authorization', `Bearer ${member.accessToken}`)

    expect(privateMemberRes.status).toBe(403)

    const createExpiredRes = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/files/${fileId}/share-links`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        visibility: 'PUBLIC',
        permission: 'READ',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      })

    expect(createExpiredRes.status).toBe(201)
    const expiredToken = createExpiredRes.body.data.token as string

    const expiredAccessRes = await request(app.getHttpServer()).get(
      `/api/share-links/${expiredToken}`,
    )

    expect(expiredAccessRes.status).toBe(410)
  })
})
