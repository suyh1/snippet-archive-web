import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'

export function setupApp(app: INestApplication) {
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
}
