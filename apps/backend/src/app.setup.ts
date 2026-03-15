import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { resolve } from 'node:path'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'

export async function setupApp(app: INestApplication) {
  app.enableCors({ origin: true })

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  })

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )

  app.useGlobalFilters(new HttpExceptionFilter())

  const fastifyApp = app as NestFastifyApplication
  await fastifyApp.register(swagger as never, {
    mode: 'static',
    specification: {
      path: resolve(process.cwd(), '../../docs/openapi/workspace-v1.yaml'),
    },
  })

  await fastifyApp.register(swaggerUi as never, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  })
}
