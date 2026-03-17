import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common'
import { CurrentUser } from '../common/auth/current-user.decorator'
import { RequiredAuthGuard } from '../common/auth/required-auth.guard'
import type { AuthUser } from '../common/auth/auth-user'
import { CreateShareLinkDto } from './dto/create-share-link.dto'
import { ShareService } from './share.service'

@Controller('workspaces/:workspaceId/files/:fileId/share-links')
@UseGuards(RequiredAuthGuard)
export class WorkspaceShareController {
  constructor(
    @Inject(ShareService)
    private readonly shareService: ShareService,
  ) {}

  @Get()
  async listShareLinks(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @CurrentUser() currentUser: AuthUser | null,
  ) {
    const items = await this.shareService.listShareLinks(
      workspaceId,
      fileId,
      currentUser!.id,
    )

    return { data: { items } }
  }

  @Post()
  async createShareLink(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @CurrentUser() currentUser: AuthUser | null,
    @Body() dto: CreateShareLinkDto,
  ) {
    const shareLink = await this.shareService.createShareLink({
      workspaceId,
      fileId,
      actorId: currentUser!.id,
      visibility: dto.visibility,
      permission: dto.permission ?? 'READ',
      expiresAt: dto.expiresAt,
    })

    return { data: shareLink }
  }

  @Post(':shareLinkId/revoke')
  async revokeShareLink(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @Param('shareLinkId', new ParseUUIDPipe()) shareLinkId: string,
    @CurrentUser() currentUser: AuthUser | null,
  ) {
    const shareLink = await this.shareService.revokeShareLink(
      workspaceId,
      fileId,
      shareLinkId,
      currentUser!.id,
    )

    return { data: shareLink }
  }
}
