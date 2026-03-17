import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AuthenticatedRequest } from './auth-user'

export const CurrentAuthToken = createParamDecorator(
  (_: unknown, context: ExecutionContext): string | null => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    return request.authToken ?? null
  },
)
