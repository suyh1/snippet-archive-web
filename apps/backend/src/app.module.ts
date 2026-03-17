import { Module } from '@nestjs/common'
import { AuditModule } from './audit/audit.module'
import { AuthModule } from './auth/auth.module'
import { FavoritesModule } from './favorites/favorites.module'
import { HealthController } from './health/health.controller'
import { OrganizationModule } from './organization/organization.module'
import { PermissionModule } from './permission/permission.module'
import { PrismaModule } from './prisma/prisma.module'
import { SearchModule } from './search/search.module'
import { ShareModule } from './share/share.module'
import { WorkspaceModule } from './workspace/workspace.module'

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PermissionModule,
    AuditModule,
    OrganizationModule,
    ShareModule,
    WorkspaceModule,
    SearchModule,
    FavoritesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
