import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PermissionModule } from '../permission/permission.module'
import { FavoritesController } from './favorites.controller'
import { FavoritesService } from './favorites.service'

@Module({
  imports: [AuthModule, PermissionModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
