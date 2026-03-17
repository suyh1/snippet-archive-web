import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AuthUser, AuthenticatedRequest } from './auth-user'

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthUser | null => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    return request.authUser ?? null
  },
)
