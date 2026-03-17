import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { PermissionModule } from '../permission/permission.module'
import { AuditController } from './audit.controller'
import { AuditService } from './audit.service'

@Module({
  imports: [PrismaModule, AuthModule, PermissionModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
