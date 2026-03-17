import { Module } from '@nestjs/common'
import { OptionalAuthGuard } from '../common/auth/optional-auth.guard'
import { RequiredAuthGuard } from '../common/auth/required-auth.guard'
import { PrismaModule } from '../prisma/prisma.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, OptionalAuthGuard, RequiredAuthGuard],
  exports: [AuthService, OptionalAuthGuard, RequiredAuthGuard],
})
export class AuthModule {}
