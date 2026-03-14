import { Test } from '@nestjs/testing'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from '../../src/app.module'
import { setupApp } from '../../src/app.setup'

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  )

  setupApp(app)

  await app.init()
  await app.getHttpAdapter().getInstance().ready()

  return app
}
