import { Injectable, NotFoundException } from '@nestjs/common'
import { WorkspaceFile } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateWorkspaceDto } from './dto/create-workspace.dto'
import { CreateWorkspaceFileDto } from './dto/create-workspace-file.dto'
import { UpdateWorkspaceDto } from './dto/update-workspace.dto'
import { UpdateWorkspaceFileDto } from './dto/update-workspace-file.dto'

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async listWorkspaces() {
    return this.prisma.workspace.findMany({
      orderBy: { updatedAt: 'desc' },
    })
  }

  async getWorkspace(id: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id } })

    if (!workspace) {
      throw new NotFoundException('Workspace not found')
    }

    return workspace
  }

  async createWorkspace(dto: CreateWorkspaceDto) {
    return this.prisma.workspace.create({
      data: {
        title: dto.title,
        description: dto.description ?? '',
        tags: dto.tags ?? [],
        starred: dto.starred ?? false,
      },
    })
  }

  async updateWorkspace(id: string, dto: UpdateWorkspaceDto) {
    await this.getWorkspace(id)

    return this.prisma.workspace.update({
      where: { id },
      data: dto,
    })
  }

  async deleteWorkspace(id: string) {
    await this.getWorkspace(id)
    await this.prisma.workspace.delete({ where: { id } })

    return { id }
  }

  async listWorkspaceFiles(workspaceId: string) {
    await this.getWorkspace(workspaceId)

    return this.prisma.workspaceFile.findMany({
      where: { workspaceId },
      orderBy: { order: 'asc' },
    })
  }

  async getWorkspaceFile(workspaceId: string, fileId: string) {
    const file = await this.findWorkspaceFile(workspaceId, fileId)

    if (!file) {
      throw new NotFoundException('Workspace file not found')
    }

    return file
  }

  async createWorkspaceFile(
    workspaceId: string,
    dto: CreateWorkspaceFileDto,
  ) {
    await this.getWorkspace(workspaceId)

    return this.prisma.workspaceFile.create({
      data: {
        workspaceId,
        name: dto.name,
        path: dto.path,
        language: dto.language,
        content: dto.content ?? '',
        kind: dto.kind,
        order: dto.order,
      },
    })
  }

  async updateWorkspaceFile(
    workspaceId: string,
    fileId: string,
    dto: UpdateWorkspaceFileDto,
  ) {
    await this.getWorkspaceFile(workspaceId, fileId)

    return this.prisma.workspaceFile.update({
      where: { id: fileId },
      data: dto,
    })
  }

  async deleteWorkspaceFile(workspaceId: string, fileId: string) {
    await this.getWorkspaceFile(workspaceId, fileId)
    await this.prisma.workspaceFile.delete({ where: { id: fileId } })

    return { id: fileId }
  }

  private findWorkspaceFile(workspaceId: string, fileId: string): Promise<WorkspaceFile | null> {
    return this.prisma.workspaceFile.findFirst({
      where: {
        id: fileId,
        workspaceId,
      },
    })
  }
}
