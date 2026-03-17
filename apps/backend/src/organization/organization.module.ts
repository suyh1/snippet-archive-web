import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { PermissionModule } from '../permission/permission.module'
import { OrganizationController } from './organization.controller'
import { OrganizationService } from './organization.service'

@Module({
  imports: [PrismaModule, AuthModule, PermissionModule, AuditModule],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
