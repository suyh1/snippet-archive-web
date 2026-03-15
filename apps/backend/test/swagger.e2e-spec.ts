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
})
