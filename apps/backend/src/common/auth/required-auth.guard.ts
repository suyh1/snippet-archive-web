import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { AuthService } from '../../auth/auth.service'
import { parseBearerToken } from './bearer-token'
import type { AuthenticatedRequest } from './auth-user'

@Injectable()
export class RequiredAuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()

    const authorization = request.headers.authorization
    const rawAuthorization =
      typeof authorization === 'string' ? authorization : authorization?.[0]

    const token = parseBearerToken(rawAuthorization)
    if (!token) {
      throw new UnauthorizedException('Authorization token is required')
    }

    const user = await this.authService.resolveUserByAccessToken(token)
    if (!user) {
      throw new UnauthorizedException('Invalid or expired session')
    }

    request.authToken = token
    request.authUser = user
    return true
  }
}
