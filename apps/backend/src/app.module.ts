import { Module } from '@nestjs/common'
import { HealthController } from './health/health.controller'
import { PrismaModule } from './prisma/prisma.module'
import { WorkspaceModule } from './workspace/workspace.module'

@Module({
  imports: [PrismaModule, WorkspaceModule],
  controllers: [HealthController],
})
export class AppModule {}
