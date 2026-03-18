import { NestFastifyApplication } from '@nestjs/platform-fastify'
import request from 'supertest'
import { createTestApp } from './helpers/test-app'

describe('Swagger (e2e)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /docs should serve swagger ui page', async () => {
    const res = await request(app.getHttpServer()).get('/docs')

    expect(res.status).toBe(200)
    expect(res.text).toContain('Swagger UI')
  })

  it('GET /docs/json should expose stage-2 API paths', async () => {
    const res = await request(app.getHttpServer()).get('/docs/json')

    expect(res.status).toBe(200)
    expect(res.body?.openapi).toBe('3.0.3')

    const paths = res.body?.paths as Record<string, unknown>
    expect(paths).toBeDefined()

    expect(paths['/api/auth/login']).toBeDefined()
    expect(paths['/api/auth/me']).toBeDefined()
    expect(paths['/api/organizations']).toBeDefined()
    expect(paths['/api/organizations/{organizationId}']).toBeDefined()
    expect(paths['/api/organizations/{organizationId}/audit-logs']).toBeDefined()
    expect(paths['/api/workspaces/{workspaceId}/files/{fileId}/share-links']).toBeDefined()
    expect(paths['/api/share-links/{token}']).toBeDefined()

    const sharePermissionEnum = res.body?.components?.schemas?.ShareLinkPermission?.enum
    expect(Array.isArray(sharePermissionEnum)).toBe(true)
    expect(sharePermissionEnum).toEqual(
      expect.arrayContaining(['READ', 'READ_METADATA']),
    )
  })
})
