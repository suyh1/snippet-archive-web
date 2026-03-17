import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/auth/current-user.decorator'
import { OptionalAuthGuard } from '../common/auth/optional-auth.guard'
import type { AuthUser } from '../common/auth/auth-user'
import { ShareService } from './share.service'

@Controller('share-links')
@UseGuards(OptionalAuthGuard)
export class ShareAccessController {
  constructor(
    @Inject(ShareService)
    private readonly shareService: ShareService,
  ) {}

  @Get(':token')
  async getSharedFile(
    @Param('token') token: string,
    @CurrentUser() currentUser: AuthUser | null,
  ) {
    const data = await this.shareService.resolveSharedFileByToken(
      token,
      currentUser?.id,
    )
    return { data }
  }
}
