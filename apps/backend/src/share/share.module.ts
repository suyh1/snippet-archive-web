import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { PermissionModule } from '../permission/permission.module'
import { PrismaModule } from '../prisma/prisma.module'
import { ShareAccessController } from './share-access.controller'
import { ShareService } from './share.service'
import { WorkspaceShareController } from './workspace-share.controller'

@Module({
  imports: [PrismaModule, AuthModule, PermissionModule, AuditModule],
  controllers: [WorkspaceShareController, ShareAccessController],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}
