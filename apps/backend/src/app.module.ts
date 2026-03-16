import { Module } from '@nestjs/common'
import { FavoritesModule } from './favorites/favorites.module'
import { HealthController } from './health/health.controller'
import { PrismaModule } from './prisma/prisma.module'
import { SearchModule } from './search/search.module'
import { WorkspaceModule } from './workspace/workspace.module'

@Module({
  imports: [PrismaModule, WorkspaceModule, SearchModule, FavoritesModule],
  controllers: [HealthController],
})
export class AppModule {}
