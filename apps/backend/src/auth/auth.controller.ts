import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { RequiredAuthGuard } from '../common/auth/required-auth.guard'
import { CurrentUser } from '../common/auth/current-user.decorator'
import { CurrentAuthToken } from '../common/auth/current-auth-token.decorator'
import type { AuthUser } from '../common/auth/auth-user'

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.register(dto.email, dto.name, dto.password)
    return { data }
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto.email, dto.password)
    return { data }
  }

  @Get('me')
  @UseGuards(RequiredAuthGuard)
  async me(@CurrentUser() currentUser: AuthUser | null) {
    return { data: currentUser }
  }

  @Post('logout')
  @UseGuards(RequiredAuthGuard)
  async logout(@CurrentAuthToken() token: string | null) {
    if (token) {
      await this.authService.logout(token)
    }

    return { data: { success: true } }
  }
}
