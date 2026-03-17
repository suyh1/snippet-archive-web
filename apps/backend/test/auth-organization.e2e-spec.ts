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
})
