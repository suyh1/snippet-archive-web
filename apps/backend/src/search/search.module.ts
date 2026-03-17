import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PermissionModule } from '../permission/permission.module'
import { SearchController } from './search.controller'
import { SearchService } from './search.service'

@Module({
  imports: [AuthModule, PermissionModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
