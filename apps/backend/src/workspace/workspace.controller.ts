import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { CurrentUser } from '../common/auth/current-user.decorator'
import { RequiredAuthGuard } from '../common/auth/required-auth.guard'
import type { AuthUser } from '../common/auth/auth-user'
import { CreateWorkspaceDto } from './dto/create-workspace.dto'
import { CreateWorkspaceFileDto } from './dto/create-workspace-file.dto'
import { MoveWorkspaceFileDto } from './dto/move-workspace-file.dto'
import { UpdateWorkspaceDto } from './dto/update-workspace.dto'
import { UpdateWorkspaceFileDto } from './dto/update-workspace-file.dto'
import { WorkspaceService } from './workspace.service'

@Controller('workspaces')
@UseGuards(RequiredAuthGuard)
export class WorkspaceController {
  constructor(
    @Inject(WorkspaceService)
    private readonly workspaceService: WorkspaceService,
  ) {}

  @Get()
  async listWorkspaces(@CurrentUser() currentUser: AuthUser | null) {
    const items = await this.workspaceService.listWorkspaces(currentUser ?? undefined)
    return { data: { items } }
  }

  @Get(':id')
  async getWorkspace(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthUser | null,
  ) {
    const workspace = await this.workspaceService.getWorkspace(
      id,
      currentUser ?? undefined,
    )
    return { data: workspace }
  }

  @Post()
  async createWorkspace(
    @Body() dto: CreateWorkspaceDto,
    @CurrentUser() currentUser: AuthUser | null,
  ) {
    const workspace = await this.workspaceService.createWorkspace(
      dto,
      currentUser ?? undefined,
    )
    return { data: workspace }
  }

  @Patch(':id')
  async updateWorkspace(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateWorkspaceDto,
    @CurrentUser() currentUser: AuthUser | null,
  ) {
    const workspace = await this.workspaceService.updateWorkspace(
      id,
      dto,
      currentUser ?? undefined,
    )
    return { data: workspace }
  }

  @Delete(':id')
  async deleteWorkspace(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthUser | null,
  ) {
    const deleted = await this.workspaceService.deleteWorkspace(
      id,
      currentUser ?? undefined,
    )
    return { data: deleted }
  }

  @Get(':workspaceId/files')
  async listWorkspaceFiles(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @CurrentUser() currentUser: AuthUser | null,
  ) {
    const items = await this.workspaceService.listWorkspaceFiles(
      workspaceId,
      currentUser ?? undefined,
    )
    return { data: { items } }
  }

  @Get(':workspaceId/files/:fileId')
  async getWorkspaceFile(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @CurrentUser() currentUser: AuthUser | null,
  ) {
    const file = await this.workspaceService.getWorkspaceFile(
      workspaceId,
      fileId,
      currentUser ?? undefined,
    )
    return { data: file }
  }

  @Post(':workspaceId/files')
  async createWorkspaceFile(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Body() dto: CreateWorkspaceFileDto,
    @CurrentUser() currentUser: AuthUser | null,
  ) {
    const file = await this.workspaceService.createWorkspaceFile(
      workspaceId,
      dto,
      currentUser ?? undefined,
    )
    return { data: file }
  }

  @Patch(':workspaceId/files/:fileId')
  async updateWorkspaceFile(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @Body() dto: UpdateWorkspaceFileDto,
    @CurrentUser() currentUser: AuthUser | null,
  ) {
    const file = await this.workspaceService.updateWorkspaceFile(
      workspaceId,
      fileId,
      dto,
      currentUser ?? undefined,
    )

    return { data: file }
  }

  @Get(':workspaceId/files/:fileId/revisions')
  async listWorkspaceFileRevisions(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @CurrentUser() currentUser: AuthUser | null,
  ) {
    const items = await this.workspaceService.listWorkspaceFileRevisions(
      workspaceId,
      fileId,
      currentUser ?? undefined,
    )

    return { data: { items } }
  }

  @Post(':workspaceId/files/:fileId/revisions/:revisionId/restore')
  async restoreWorkspaceFileRevision(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @Param('revisionId', new ParseUUIDPipe()) revisionId: string,
    @CurrentUser() currentUser: AuthUser | null,
  ) {
    const file = await this.workspaceService.restoreWorkspaceFileRevision(
      workspaceId,
      fileId,
      revisionId,
      currentUser ?? undefined,
    )

    return { data: file }
  }

  @Patch(':workspaceId/files/:fileId/move')
  async moveWorkspaceFile(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @Body() dto: MoveWorkspaceFileDto,
    @CurrentUser() currentUser: AuthUser | null,
  ) {
    const file = await this.workspaceService.moveWorkspaceFile(
      workspaceId,
      fileId,
      dto,
      currentUser ?? undefined,
    )

    return { data: file }
  }

  @Delete(':workspaceId/files/:fileId')
  async deleteWorkspaceFile(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @CurrentUser() currentUser: AuthUser | null,
  ) {
    const deleted = await this.workspaceService.deleteWorkspaceFile(
      workspaceId,
      fileId,
      currentUser ?? undefined,
    )

    return { data: deleted }
  }
}
