import { NestFastifyApplication } from '@nestjs/platform-fastify'
import request from 'supertest'

export type AuthAccount = {
  accessToken: string
  userId: string
  email: string
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

export async function registerAccount(
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

export function withAuth(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  }
}
