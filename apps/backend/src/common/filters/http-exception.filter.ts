import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { FastifyReply } from 'fastify'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<FastifyReply>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const exceptionResponse = exception.getResponse()

      const normalized = this.normalizeHttpException(status, exceptionResponse)
      response.status(status).send({ error: normalized })
      return
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    })
  }

  private normalizeHttpException(status: number, exceptionResponse: unknown) {
    const code = this.getErrorCodeByStatus(status)

    if (typeof exceptionResponse === 'string') {
      return {
        code,
        message: exceptionResponse,
      }
    }

    if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
    ) {
      const message = (exceptionResponse as { message: unknown }).message

      if (Array.isArray(message)) {
        return {
          code: 'VALIDATION_ERROR' as const,
          message: 'Validation failed',
          details: message,
        }
      }

      if (typeof message === 'string') {
        return {
          code,
          message,
        }
      }
    }

    return {
      code,
      message: 'Request failed',
    }
  }

  private getErrorCodeByStatus(status: number) {
    if (status === HttpStatus.NOT_FOUND) {
      return 'NOT_FOUND' as const
    }

    if (status === HttpStatus.BAD_REQUEST) {
      return 'VALIDATION_ERROR' as const
    }

    if (status === HttpStatus.CONFLICT) {
      return 'CONFLICT' as const
    }

    return 'INTERNAL_ERROR' as const
  }
}
