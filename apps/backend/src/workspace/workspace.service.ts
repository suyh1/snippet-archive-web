import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateWorkspaceDto } from './dto/create-workspace.dto'
import { CreateWorkspaceFileDto } from './dto/create-workspace-file.dto'
import { MoveWorkspaceFileDto } from './dto/move-workspace-file.dto'
import { UpdateWorkspaceDto } from './dto/update-workspace.dto'
import { UpdateWorkspaceFileDto } from './dto/update-workspace-file.dto'

@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

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
      orderBy: [{ order: 'asc' }, { path: 'asc' }],
    })
  }

  async getWorkspaceFile(workspaceId: string, fileId: string) {
    const file = await this.findWorkspaceFile(workspaceId, fileId)

    if (!file) {
      throw new NotFoundException('Workspace file not found')
    }

    return file
  }

  async createWorkspaceFile(workspaceId: string, dto: CreateWorkspaceFileDto) {
    await this.getWorkspace(workspaceId)

    const normalizedPath = this.normalizePath(dto.path)
    this.assertPathNotRoot(normalizedPath)
    await this.assertPathUnique(workspaceId, normalizedPath)

    const created = await this.prisma.workspaceFile.create({
      data: {
        workspaceId,
        name: dto.name,
        path: normalizedPath,
        language: dto.language,
        content: dto.content ?? '',
        tags: dto.tags ?? [],
        starred: dto.starred ?? false,
        kind: dto.kind,
        order: dto.order,
      },
    })

    await this.normalizeWorkspaceOrders(workspaceId)
    return this.getWorkspaceFile(workspaceId, created.id)
  }

  async updateWorkspaceFile(
    workspaceId: string,
    fileId: string,
    dto: UpdateWorkspaceFileDto,
  ) {
    await this.getWorkspaceFile(workspaceId, fileId)

    const data: UpdateWorkspaceFileDto = { ...dto }

    if (dto.path !== undefined) {
      const normalizedPath = this.normalizePath(dto.path)
      this.assertPathNotRoot(normalizedPath)
      await this.assertPathUnique(workspaceId, normalizedPath, fileId)
      data.path = normalizedPath
    }

    await this.prisma.workspaceFile.update({
      where: { id: fileId },
      data,
    })

    await this.normalizeWorkspaceOrders(workspaceId)
    return this.getWorkspaceFile(workspaceId, fileId)
  }

  async moveWorkspaceFile(
    workspaceId: string,
    fileId: string,
    dto: MoveWorkspaceFileDto,
  ) {
    const file = await this.getWorkspaceFile(workspaceId, fileId)
    const targetPath = this.normalizePath(dto.targetPath)

    this.assertPathNotRoot(targetPath)

    if (file.kind === 'folder' && targetPath.startsWith(`${file.path}/`)) {
      throw new ConflictException('Cannot move folder into its own descendant')
    }

    if (targetPath === file.path && dto.targetOrder === undefined) {
      return file
    }

    if (file.kind === 'folder') {
      const descendants = await this.prisma.workspaceFile.findMany({
        where: {
          workspaceId,
          OR: [{ path: file.path }, { path: { startsWith: `${file.path}/` } }],
        },
      })

      const descendantIds = descendants.map((item) => item.id)
      const nextPaths = descendants.map((item) =>
        item.path === file.path
          ? targetPath
          : `${targetPath}${item.path.slice(file.path.length)}`,
      )

      await this.assertPathSetUnique(workspaceId, nextPaths, descendantIds)

      await this.prisma.$transaction(async (tx) => {
        for (const item of descendants) {
          const nextPath =
            item.path === file.path
              ? targetPath
              : `${targetPath}${item.path.slice(file.path.length)}`

          await tx.workspaceFile.update({
            where: { id: item.id },
            data: { path: nextPath },
          })
        }

        if (dto.targetOrder !== undefined) {
          await tx.workspaceFile.update({
            where: { id: fileId },
            data: { order: dto.targetOrder },
          })
        }
      })
    } else {
      await this.assertPathUnique(workspaceId, targetPath, fileId)

      await this.prisma.workspaceFile.update({
        where: { id: fileId },
        data: {
          path: targetPath,
          ...(dto.targetOrder !== undefined ? { order: dto.targetOrder } : {}),
        },
      })
    }

    await this.normalizeWorkspaceOrders(workspaceId)
    return this.getWorkspaceFile(workspaceId, fileId)
  }

  async deleteWorkspaceFile(workspaceId: string, fileId: string) {
    const file = await this.getWorkspaceFile(workspaceId, fileId)

    if (file.kind === 'folder') {
      await this.prisma.workspaceFile.deleteMany({
        where: {
          workspaceId,
          OR: [{ path: file.path }, { path: { startsWith: `${file.path}/` } }],
        },
      })
    } else {
      await this.prisma.workspaceFile.delete({ where: { id: fileId } })
    }

    await this.normalizeWorkspaceOrders(workspaceId)
    return { id: fileId }
  }

  private findWorkspaceFile(workspaceId: string, fileId: string) {
    return this.prisma.workspaceFile.findFirst({
      where: {
        id: fileId,
        workspaceId,
      },
    })
  }

  private normalizePath(path: string) {
    const trimmed = path.trim()

    if (!trimmed.startsWith('/')) {
      throw new BadRequestException('Path must start with /')
    }

    const segments = trimmed.split('/').filter(Boolean)

    if (segments.length === 0) {
      return '/'
    }

    return `/${segments.join('/')}`
  }

  private assertPathNotRoot(path: string) {
    if (path === '/') {
      throw new BadRequestException('Path cannot be root')
    }
  }

  private async assertPathUnique(
    workspaceId: string,
    path: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.workspaceFile.findFirst({
      where: {
        workspaceId,
        path,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    })

    if (existing) {
      throw new ConflictException(`Path already exists: ${path}`)
    }
  }

  private async assertPathSetUnique(
    workspaceId: string,
    paths: string[],
    excludeIds: string[],
  ) {
    const uniquePaths = [...new Set(paths)]

    if (uniquePaths.length !== paths.length) {
      throw new ConflictException('Target paths contain duplicates')
    }

    const conflicts = await this.prisma.workspaceFile.findMany({
      where: {
        workspaceId,
        path: { in: uniquePaths },
        ...(excludeIds.length > 0
          ? { NOT: { id: { in: excludeIds } } }
          : {}),
      },
      select: { id: true },
    })

    if (conflicts.length > 0) {
      throw new ConflictException('Target path conflicts with existing item')
    }
  }

  private getParentPath(path: string) {
    const normalized = this.normalizePath(path)

    if (normalized === '/') {
      return '/'
    }

    const lastSlash = normalized.lastIndexOf('/')
    if (lastSlash <= 0) {
      return '/'
    }

    return normalized.slice(0, lastSlash)
  }

  private async normalizeWorkspaceOrders(workspaceId: string) {
    const files = await this.prisma.workspaceFile.findMany({
      where: { workspaceId },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    })

    if (files.length === 0) {
      return
    }

    const groups = new Map<string, typeof files>()

    for (const file of files) {
      const parentPath = this.getParentPath(file.path)
      const current = groups.get(parentPath) ?? []
      current.push(file)
      groups.set(parentPath, current)
    }

    const updates: Prisma.PrismaPromise<unknown>[] = []

    for (const groupFiles of groups.values()) {
      groupFiles.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))

      groupFiles.forEach((file, index) => {
        const nextOrder = index + 1
        if (file.order !== nextOrder) {
          updates.push(
            this.prisma.workspaceFile.update({
              where: { id: file.id },
              data: { order: nextOrder },
            }),
          )
        }
      })
    }

    if (updates.length > 0) {
      await this.prisma.$transaction(updates)
    }
  }
}
