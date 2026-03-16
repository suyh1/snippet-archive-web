import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, WorkspaceFile } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateWorkspaceDto } from './dto/create-workspace.dto'
import { CreateWorkspaceFileDto } from './dto/create-workspace-file.dto'
import { MoveWorkspaceFileDto } from './dto/move-workspace-file.dto'
import { UpdateWorkspaceDto } from './dto/update-workspace.dto'
import { UpdateWorkspaceFileDto } from './dto/update-workspace-file.dto'

type RevisionSource = 'update' | 'restore'

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
    const currentFile = await this.getWorkspaceFile(workspaceId, fileId)

    const data: UpdateWorkspaceFileDto = { ...dto }
    const shouldTrackRevision = this.shouldTrackRevisionForUpdate(currentFile, dto)

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
    const updatedFile = await this.getWorkspaceFile(workspaceId, fileId)

    if (shouldTrackRevision) {
      await this.createRevisionSnapshot(this.prisma, updatedFile, 'update')
    }

    return updatedFile
  }

  async listWorkspaceFileRevisions(workspaceId: string, fileId: string) {
    await this.getWorkspaceFile(workspaceId, fileId)

    return this.prisma.workspaceFileRevision.findMany({
      where: {
        workspaceId,
        fileId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
  }

  async restoreWorkspaceFileRevision(
    workspaceId: string,
    fileId: string,
    revisionId: string,
  ) {
    await this.getWorkspaceFile(workspaceId, fileId)

    const revision = await this.prisma.workspaceFileRevision.findFirst({
      where: {
        id: revisionId,
        workspaceId,
        fileId,
      },
    })

    if (!revision) {
      throw new NotFoundException('Workspace file revision not found')
    }

    return this.prisma.$transaction(async (tx) => {
      const restoredFile = await tx.workspaceFile.update({
        where: { id: fileId },
        data: {
          content: revision.content,
          language: revision.language,
        },
      })

      await this.createRevisionSnapshot(tx, restoredFile, 'restore')
      return restoredFile
    })
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

  private shouldTrackRevisionForUpdate(
    file: WorkspaceFile,
    dto: UpdateWorkspaceFileDto,
  ) {
    if (file.kind !== 'file') {
      return false
    }

    const nextContent = dto.content ?? file.content
    const nextLanguage = dto.language ?? file.language

    return nextContent !== file.content || nextLanguage !== file.language
  }

  private async createRevisionSnapshot(
    client: PrismaService | Prisma.TransactionClient,
    file: Pick<WorkspaceFile, 'id' | 'workspaceId' | 'language' | 'content'>,
    source: RevisionSource,
  ) {
    await client.workspaceFileRevision.create({
      data: {
        workspaceId: file.workspaceId,
        fileId: file.id,
        language: file.language,
        content: file.content,
        source,
        summary: this.buildRevisionSummary(file.content, source),
      },
    })
  }

  private buildRevisionSummary(content: string, source: RevisionSource) {
    const firstLine = content.split('\n')[0]?.trim() || ''
    const preview = firstLine.slice(0, 80)

    if (preview.length === 0) {
      return source === 'restore' ? 'Restored empty content' : 'Updated empty content'
    }

    return source === 'restore'
      ? `Restored: ${preview}`
      : `Updated: ${preview}`
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
