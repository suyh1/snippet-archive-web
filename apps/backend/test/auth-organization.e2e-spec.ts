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
  expect(typeof registerRes.body.data.accessToken).toBe('string')
  expect(registerRes.body.data.user.email).toBe(email)

  const loginRes = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email,
      password,
    })

  expect(loginRes.status).toBe(201)
  expect(loginRes.body.data.user.email).toBe(email)

  return {
    accessToken: loginRes.body.data.accessToken as string,
    userId: loginRes.body.data.user.id as string,
    email,
  }
}

describe('Auth & organization API (e2e)', () => {
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

  it('supports register/login/me and organization creation flow', async () => {
    const owner = await registerAccount(app, uniqueEmail('owner'), 'Owner')

    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${owner.accessToken}`)

    expect(meRes.status).toBe(200)
    expect(meRes.body.data.id).toBe(owner.userId)
    expect(meRes.body.data.email).toBe(owner.email)

    const createOrgRes = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Team Alpha',
        slug: `team-alpha-${Date.now()}`,
      })

    expect(createOrgRes.status).toBe(201)
    expect(createOrgRes.body.data.name).toBe('Team Alpha')
    expect(createOrgRes.body.data.currentUserRole).toBe('OWNER')

    const orgId = createOrgRes.body.data.id as string

    const listOrgRes = await request(app.getHttpServer())
      .get('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)

    expect(listOrgRes.status).toBe(200)
    expect(listOrgRes.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: orgId,
          currentUserRole: 'OWNER',
        }),
      ]),
    )

    const createWorkspaceRes = await request(app.getHttpServer())
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        title: 'Team Workspace',
        organizationId: orgId,
      })

    expect(createWorkspaceRes.status).toBe(201)
    expect(createWorkspaceRes.body.data.organizationId).toBe(orgId)
  })

  it('enforces role matrix for organization workspace creation', async () => {
    const owner = await registerAccount(app, uniqueEmail('owner-role'), 'Owner Role')
    const viewer = await registerAccount(app, uniqueEmail('viewer-role'), 'Viewer Role')

    const createOrgRes = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Permissions Org',
        slug: `permissions-org-${Date.now()}`,
      })

    expect(createOrgRes.status).toBe(201)
    const orgId = createOrgRes.body.data.id as string

    const inviteRes = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        email: viewer.email,
        role: 'VIEWER',
      })

    expect(inviteRes.status).toBe(201)
    expect(inviteRes.body.data.role).toBe('VIEWER')

    const viewerCreateWorkspace = await request(app.getHttpServer())
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({
        title: 'Viewer Workspace',
        organizationId: orgId,
      })

    expect(viewerCreateWorkspace.status).toBe(403)
    expect(viewerCreateWorkspace.body.error.code).toBe('FORBIDDEN')
  })

  it('protects owner membership and rejects non-owner member management', async () => {
    const owner = await registerAccount(app, uniqueEmail('owner-mgmt'), 'Owner Mgmt')
    const editor = await registerAccount(app, uniqueEmail('editor-mgmt'), 'Editor Mgmt')
    const viewer = await registerAccount(app, uniqueEmail('viewer-mgmt'), 'Viewer Mgmt')

    const createOrgRes = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Member Mgmt Org',
        slug: `member-mgmt-org-${Date.now()}`,
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
    const editorMembershipId = inviteEditorRes.body.data.id as string

    const inviteViewerRes = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        email: viewer.email,
        role: 'VIEWER',
      })

    expect(inviteViewerRes.status).toBe(201)
    const viewerMembershipId = inviteViewerRes.body.data.id as string

    const listMembersRes = await request(app.getHttpServer())
      .get(`/api/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)

    expect(listMembersRes.status).toBe(200)

    const ownerMembership = (listMembersRes.body.data.items as Array<{ id: string; userId: string }>).find(
      (item) => item.userId === owner.userId,
    )

    expect(ownerMembership?.id).toBeTruthy()

    const viewerUpdateEditorRes = await request(app.getHttpServer())
      .patch(`/api/organizations/${orgId}/members/${editorMembershipId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({
        role: 'VIEWER',
      })

    expect(viewerUpdateEditorRes.status).toBe(403)
    expect(viewerUpdateEditorRes.body.error.code).toBe('FORBIDDEN')

    const editorRemoveViewerRes = await request(app.getHttpServer())
      .delete(`/api/organizations/${orgId}/members/${viewerMembershipId}`)
      .set('Authorization', `Bearer ${editor.accessToken}`)

    expect(editorRemoveViewerRes.status).toBe(403)
    expect(editorRemoveViewerRes.body.error.code).toBe('FORBIDDEN')

    const ownerDowngradeSelfRes = await request(app.getHttpServer())
      .patch(`/api/organizations/${orgId}/members/${ownerMembership!.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        role: 'EDITOR',
      })

    expect(ownerDowngradeSelfRes.status).toBe(409)
    expect(ownerDowngradeSelfRes.body.error.code).toBe('CONFLICT')

    const ownerRemoveSelfRes = await request(app.getHttpServer())
      .delete(`/api/organizations/${orgId}/members/${ownerMembership!.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)

    expect(ownerRemoveSelfRes.status).toBe(409)
    expect(ownerRemoveSelfRes.body.error.code).toBe('CONFLICT')

    const ownerUpgradeViewerRes = await request(app.getHttpServer())
      .patch(`/api/organizations/${orgId}/members/${viewerMembershipId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        role: 'EDITOR',
      })

    expect(ownerUpgradeViewerRes.status).toBe(200)
    expect(ownerUpgradeViewerRes.body.data.role).toBe('EDITOR')

    const ownerRemoveViewerRes = await request(app.getHttpServer())
      .delete(`/api/organizations/${orgId}/members/${viewerMembershipId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)

    expect(ownerRemoveViewerRes.status).toBe(200)
    expect(ownerRemoveViewerRes.body.data.id).toBe(viewerMembershipId)
  })

  it('allows owner to delete organization and rejects non-owner deletion', async () => {
    const owner = await registerAccount(app, uniqueEmail('owner-org-delete'), 'Owner Org Delete')
    const viewer = await registerAccount(app, uniqueEmail('viewer-org-delete'), 'Viewer Org Delete')

    const createOrgRes = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Delete Org',
        slug: `delete-org-${Date.now()}`,
      })

    expect(createOrgRes.status).toBe(201)
    const orgId = createOrgRes.body.data.id as string

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
        title: 'Org Delete Workspace',
        organizationId: orgId,
      })

    expect(createWorkspaceRes.status).toBe(201)
    const workspaceId = createWorkspaceRes.body.data.id as string

    const viewerDeleteRes = await request(app.getHttpServer())
      .delete(`/api/organizations/${orgId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)

    expect(viewerDeleteRes.status).toBe(403)
    expect(viewerDeleteRes.body.error.code).toBe('FORBIDDEN')

    const ownerDeleteRes = await request(app.getHttpServer())
      .delete(`/api/organizations/${orgId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)

    expect(ownerDeleteRes.status).toBe(200)
    expect(ownerDeleteRes.body.data.id).toBe(orgId)

    const listOwnerOrganizationsRes = await request(app.getHttpServer())
      .get('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)

    expect(listOwnerOrganizationsRes.status).toBe(200)
    expect(listOwnerOrganizationsRes.body.data.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: orgId })]),
    )

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, organizationId: true },
    })

    expect(workspace?.id).toBe(workspaceId)
    expect(workspace?.organizationId).toBeNull()
  })
})
