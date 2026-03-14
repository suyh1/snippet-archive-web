import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from './app.module'
import { setupApp } from './app.setup'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  )

  setupApp(app)

  const port = Number(process.env.PORT ?? 3001)
  await app.listen(port, '0.0.0.0')
}

void bootstrap()
