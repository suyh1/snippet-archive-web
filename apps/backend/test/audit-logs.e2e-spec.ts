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

describe('Audit logs API (e2e)', () => {
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

  it('records write operations and supports owner-only queries with filters', async () => {
    const owner = await registerAccount(app, uniqueEmail('owner-audit'), 'Owner Audit')
    const viewer = await registerAccount(app, uniqueEmail('viewer-audit'), 'Viewer Audit')

    const createOrgRes = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Audit Org',
        slug: `audit-org-${Date.now()}`,
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
        title: 'Audit Workspace',
        organizationId: orgId,
      })

    expect(createWorkspaceRes.status).toBe(201)
    const workspaceId = createWorkspaceRes.body.data.id as string

    const createFileRes = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/files`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'audit.ts',
        path: '/audit.ts',
        language: 'typescript',
        content: 'export const v = 1',
        kind: 'file',
        order: 1,
      })

    expect(createFileRes.status).toBe(201)
    const fileId = createFileRes.body.data.id as string

    const updateFileRes = await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspaceId}/files/${fileId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        content: 'export const v = 2',
      })

    expect(updateFileRes.status).toBe(200)

    const createShareLinkRes = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/files/${fileId}/share-links`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        visibility: 'PUBLIC',
        permission: 'READ',
      })

    expect(createShareLinkRes.status).toBe(201)

    const ownerAuditRes = await request(app.getHttpServer())
      .get(`/api/organizations/${orgId}/audit-logs`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .query({
        action: 'WORKSPACE_FILE_UPDATED',
      })

    expect(ownerAuditRes.status).toBe(200)
    expect(Array.isArray(ownerAuditRes.body.data.items)).toBe(true)
    expect(ownerAuditRes.body.data.items.length).toBeGreaterThanOrEqual(1)
    expect(ownerAuditRes.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'WORKSPACE_FILE_UPDATED',
          actorId: owner.userId,
          organizationId: orgId,
        }),
      ]),
    )

    const targetLog = ownerAuditRes.body.data.items.find((item: { action: string }) => {
      return item.action === 'WORKSPACE_FILE_UPDATED'
    }) as { createdAt: string } | undefined
    expect(targetLog).toBeDefined()

    const targetCreatedAt = new Date(targetLog!.createdAt)
    const fromIso = new Date(targetCreatedAt.getTime() - 60_000).toISOString()
    const toIso = new Date(targetCreatedAt.getTime() + 60_000).toISOString()

    const comboFilterRes = await request(app.getHttpServer())
      .get(`/api/organizations/${orgId}/audit-logs`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .query({
        action: 'WORKSPACE_FILE_UPDATED',
        actorId: owner.userId,
        from: fromIso,
        to: toIso,
      })

    expect(comboFilterRes.status).toBe(200)
    expect(comboFilterRes.body.data.items.length).toBeGreaterThanOrEqual(1)
    expect(comboFilterRes.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'WORKSPACE_FILE_UPDATED',
          actorId: owner.userId,
        }),
      ]),
    )

    const emptyComboFilterRes = await request(app.getHttpServer())
      .get(`/api/organizations/${orgId}/audit-logs`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .query({
        action: 'WORKSPACE_FILE_UPDATED',
        actorId: viewer.userId,
        from: fromIso,
        to: toIso,
      })

    expect(emptyComboFilterRes.status).toBe(200)
    expect(emptyComboFilterRes.body.data.items).toEqual([])
    expect(emptyComboFilterRes.body.data.total).toBe(0)

    const viewerAuditRes = await request(app.getHttpServer())
      .get(`/api/organizations/${orgId}/audit-logs`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)

    expect(viewerAuditRes.status).toBe(403)
    expect(viewerAuditRes.body.error.code).toBe('FORBIDDEN')
  })
})
