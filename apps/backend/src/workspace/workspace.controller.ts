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
} from '@nestjs/common'
import { CreateWorkspaceDto } from './dto/create-workspace.dto'
import { CreateWorkspaceFileDto } from './dto/create-workspace-file.dto'
import { MoveWorkspaceFileDto } from './dto/move-workspace-file.dto'
import { UpdateWorkspaceDto } from './dto/update-workspace.dto'
import { UpdateWorkspaceFileDto } from './dto/update-workspace-file.dto'
import { WorkspaceService } from './workspace.service'

@Controller('workspaces')
export class WorkspaceController {
  constructor(
    @Inject(WorkspaceService)
    private readonly workspaceService: WorkspaceService,
  ) {}

  @Get()
  async listWorkspaces() {
    const items = await this.workspaceService.listWorkspaces()
    return { data: { items } }
  }

  @Get(':id')
  async getWorkspace(@Param('id', new ParseUUIDPipe()) id: string) {
    const workspace = await this.workspaceService.getWorkspace(id)
    return { data: workspace }
  }

  @Post()
  async createWorkspace(@Body() dto: CreateWorkspaceDto) {
    const workspace = await this.workspaceService.createWorkspace(dto)
    return { data: workspace }
  }

  @Patch(':id')
  async updateWorkspace(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    const workspace = await this.workspaceService.updateWorkspace(id, dto)
    return { data: workspace }
  }

  @Delete(':id')
  async deleteWorkspace(@Param('id', new ParseUUIDPipe()) id: string) {
    const deleted = await this.workspaceService.deleteWorkspace(id)
    return { data: deleted }
  }

  @Get(':workspaceId/files')
  async listWorkspaceFiles(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
  ) {
    const items = await this.workspaceService.listWorkspaceFiles(workspaceId)
    return { data: { items } }
  }

  @Get(':workspaceId/files/:fileId')
  async getWorkspaceFile(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
  ) {
    const file = await this.workspaceService.getWorkspaceFile(workspaceId, fileId)
    return { data: file }
  }

  @Post(':workspaceId/files')
  async createWorkspaceFile(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Body() dto: CreateWorkspaceFileDto,
  ) {
    const file = await this.workspaceService.createWorkspaceFile(workspaceId, dto)
    return { data: file }
  }

  @Patch(':workspaceId/files/:fileId')
  async updateWorkspaceFile(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @Body() dto: UpdateWorkspaceFileDto,
  ) {
    const file = await this.workspaceService.updateWorkspaceFile(
      workspaceId,
      fileId,
      dto,
    )

    return { data: file }
  }

  @Get(':workspaceId/files/:fileId/revisions')
  async listWorkspaceFileRevisions(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
  ) {
    const items = await this.workspaceService.listWorkspaceFileRevisions(
      workspaceId,
      fileId,
    )

    return { data: { items } }
  }

  @Post(':workspaceId/files/:fileId/revisions/:revisionId/restore')
  async restoreWorkspaceFileRevision(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @Param('revisionId', new ParseUUIDPipe()) revisionId: string,
  ) {
    const file = await this.workspaceService.restoreWorkspaceFileRevision(
      workspaceId,
      fileId,
      revisionId,
    )

    return { data: file }
  }

  @Patch(':workspaceId/files/:fileId/move')
  async moveWorkspaceFile(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @Body() dto: MoveWorkspaceFileDto,
  ) {
    const file = await this.workspaceService.moveWorkspaceFile(
      workspaceId,
      fileId,
      dto,
    )

    return { data: file }
  }

  @Delete(':workspaceId/files/:fileId')
  async deleteWorkspaceFile(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
  ) {
    const deleted = await this.workspaceService.deleteWorkspaceFile(
      workspaceId,
      fileId,
    )

    return { data: deleted }
  }
}
