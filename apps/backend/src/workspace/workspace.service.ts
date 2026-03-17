import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common'
import { type OrganizationRole, Prisma, Workspace, WorkspaceFile } from '@prisma/client'
import type { AuthUser } from '../common/auth/auth-user'
import { PrismaService } from '../prisma/prisma.service'
import { PermissionService } from '../permission/permission.service'
import { AuditService } from '../audit/audit.service'
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
    @Optional()
    @Inject(PermissionService)
    private readonly permissionService?: PermissionService,
    @Optional()
    @Inject(AuditService)
    private readonly auditService?: AuditService,
  ) {}

  async listWorkspaces(actor?: AuthUser) {
    const where = await this.buildWorkspaceVisibilityWhere(actor)

    return this.prisma.workspace.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    })
  }

  async getWorkspace(id: string, actor?: AuthUser) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id } })

    if (!workspace) {
      throw new NotFoundException('Workspace not found')
    }

    await this.ensureWorkspaceRole(workspace, actor, 'VIEWER')
    return workspace
  }

  async createWorkspace(dto: CreateWorkspaceDto, actor?: AuthUser) {
    if (!actor?.id) {
      throw new UnauthorizedException('Authorization token is required')
    }

    if (dto.organizationId) {
      await this.requireOrganizationRole(dto.organizationId, actor, 'EDITOR')
    }

    const workspace = await this.prisma.workspace.create({
      data: {
        title: dto.title,
        description: dto.description ?? '',
        tags: dto.tags ?? [],
        starred: dto.starred ?? false,
        ownerId: actor.id,
        organizationId: dto.organizationId ?? null,
      },
    })

    await this.recordWorkspaceAudit(
      workspace,
      actor?.id,
      'WORKSPACE_CREATED',
      'workspace',
      workspace.id,
      {
        title: workspace.title,
      },
    )

    return workspace
  }

  async updateWorkspace(id: string, dto: UpdateWorkspaceDto, actor?: AuthUser) {
    const workspace = await this.getWorkspace(id, actor)
    await this.ensureWorkspaceRole(workspace, actor, 'EDITOR')

    const updated = await this.prisma.workspace.update({
      where: { id },
      data: dto,
    })

    await this.recordWorkspaceAudit(
      workspace,
      actor?.id,
      'WORKSPACE_UPDATED',
      'workspace',
      workspace.id,
      dto as Prisma.JsonObject,
    )

    return updated
  }

  async deleteWorkspace(id: string, actor?: AuthUser) {
    const workspace = await this.getWorkspace(id, actor)
    await this.ensureWorkspaceRole(workspace, actor, 'OWNER')

    await this.prisma.workspace.delete({ where: { id } })

    await this.recordWorkspaceAudit(
      workspace,
      actor?.id,
      'WORKSPACE_DELETED',
      'workspace',
      workspace.id,
      null,
    )

    return { id }
  }

  async listWorkspaceFiles(workspaceId: string, actor?: AuthUser) {
    await this.getWorkspace(workspaceId, actor)

    return this.prisma.workspaceFile.findMany({
      where: { workspaceId },
      orderBy: [{ order: 'asc' }, { path: 'asc' }],
    })
  }

  async getWorkspaceFile(workspaceId: string, fileId: string, actor?: AuthUser) {
    await this.getWorkspace(workspaceId, actor)
    const file = await this.findWorkspaceFile(workspaceId, fileId)

    if (!file) {
      throw new NotFoundException('Workspace file not found')
    }

    return file
  }

  async createWorkspaceFile(
    workspaceId: string,
    dto: CreateWorkspaceFileDto,
    actor?: AuthUser,
  ) {
    const workspace = await this.getWorkspace(workspaceId, actor)
    await this.ensureWorkspaceRole(workspace, actor, 'EDITOR')

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
        lastEditedById: actor?.id ?? null,
      },
    })

    await this.normalizeWorkspaceOrders(workspaceId)

    await this.recordWorkspaceAudit(
      workspace,
      actor?.id,
      'WORKSPACE_FILE_CREATED',
      'workspace_file',
      created.id,
      {
        path: created.path,
      },
    )

    return this.getWorkspaceFile(workspaceId, created.id, actor)
  }

  async updateWorkspaceFile(
    workspaceId: string,
    fileId: string,
    dto: UpdateWorkspaceFileDto,
    actor?: AuthUser,
  ) {
    const workspace = await this.getWorkspace(workspaceId, actor)
    await this.ensureWorkspaceRole(workspace, actor, 'EDITOR')

    const currentFile = await this.getWorkspaceFile(workspaceId, fileId, actor)

    const data: UpdateWorkspaceFileDto & { lastEditedById?: string | null } = {
      ...dto,
      lastEditedById: actor?.id ?? null,
    }
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
    const updatedFile = await this.getWorkspaceFile(workspaceId, fileId, actor)

    if (shouldTrackRevision) {
      await this.createRevisionSnapshot(
        this.prisma,
        updatedFile,
        'update',
        actor?.id,
      )
    }

    await this.recordWorkspaceAudit(
      workspace,
      actor?.id,
      'WORKSPACE_FILE_UPDATED',
      'workspace_file',
      fileId,
      dto as Prisma.JsonObject,
    )

    return updatedFile
  }

  async listWorkspaceFileRevisions(
    workspaceId: string,
    fileId: string,
    actor?: AuthUser,
  ) {
    await this.getWorkspaceFile(workspaceId, fileId, actor)

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
    actor?: AuthUser,
  ) {
    const workspace = await this.getWorkspace(workspaceId, actor)
    await this.ensureWorkspaceRole(workspace, actor, 'EDITOR')
    await this.getWorkspaceFile(workspaceId, fileId, actor)

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

    const restoredFile = await this.prisma.$transaction(async (tx) => {
      const file = await tx.workspaceFile.update({
        where: { id: fileId },
        data: {
          content: revision.content,
          language: revision.language,
          lastEditedById: actor?.id ?? null,
        },
      })

      await this.createRevisionSnapshot(tx, file, 'restore', actor?.id)
      return file
    })

    await this.recordWorkspaceAudit(
      workspace,
      actor?.id,
      'WORKSPACE_FILE_RESTORED',
      'workspace_file',
      fileId,
      {
        revisionId,
      },
    )

    return restoredFile
  }

  async moveWorkspaceFile(
    workspaceId: string,
    fileId: string,
    dto: MoveWorkspaceFileDto,
    actor?: AuthUser,
  ) {
    const workspace = await this.getWorkspace(workspaceId, actor)
    await this.ensureWorkspaceRole(workspace, actor, 'EDITOR')

    const file = await this.getWorkspaceFile(workspaceId, fileId, actor)
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
            data: {
              path: nextPath,
              lastEditedById: actor?.id ?? null,
            },
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
          lastEditedById: actor?.id ?? null,
        },
      })
    }

    await this.normalizeWorkspaceOrders(workspaceId)

    await this.recordWorkspaceAudit(
      workspace,
      actor?.id,
      'WORKSPACE_FILE_MOVED',
      'workspace_file',
      fileId,
      {
        targetPath,
        targetOrder: dto.targetOrder ?? null,
      },
    )

    return this.getWorkspaceFile(workspaceId, fileId, actor)
  }

  async deleteWorkspaceFile(workspaceId: string, fileId: string, actor?: AuthUser) {
    const workspace = await this.getWorkspace(workspaceId, actor)
    await this.ensureWorkspaceRole(workspace, actor, 'EDITOR')
    const file = await this.getWorkspaceFile(workspaceId, fileId, actor)

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

    await this.recordWorkspaceAudit(
      workspace,
      actor?.id,
      'WORKSPACE_FILE_DELETED',
      'workspace_file',
      fileId,
      {
        path: file.path,
        kind: file.kind,
      },
    )

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
    actorId?: string,
  ) {
    await client.workspaceFileRevision.create({
      data: {
        workspaceId: file.workspaceId,
        fileId: file.id,
        language: file.language,
        content: file.content,
        source,
        summary: this.buildRevisionSummary(file.content, source),
        createdById: actorId ?? null,
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

  private async buildWorkspaceVisibilityWhere(actor?: AuthUser) {
    if (!actor?.id) {
      throw new UnauthorizedException('Authorization token is required')
    }

    if (!this.permissionService) {
      return { ownerId: actor.id } as Prisma.WorkspaceWhereInput
    }

    const organizationIds = await this.permissionService.listOrganizationIdsForUser(
      actor.id,
    )

    if (organizationIds.length === 0) {
      return { ownerId: actor.id } as Prisma.WorkspaceWhereInput
    }

    return {
      OR: [
        { ownerId: actor.id },
        { organizationId: { in: organizationIds } },
      ],
    } as Prisma.WorkspaceWhereInput
  }

  private async requireOrganizationRole(
    organizationId: string,
    actor: AuthUser | undefined,
    minRole: OrganizationRole,
  ) {
    if (!this.permissionService) {
      throw new UnauthorizedException('Permission service is not available')
    }

    await this.permissionService.requireMembership(
      organizationId,
      actor?.id,
      minRole,
    )
  }

  private async ensureWorkspaceRole(
    workspace: Workspace,
    actor: AuthUser | undefined,
    minRole: OrganizationRole,
  ) {
    if (!workspace.organizationId) {
      if (!workspace.ownerId) {
        if (!actor?.id) {
          throw new UnauthorizedException('Authorization token is required')
        }
        return
      }

      if (!actor?.id) {
        throw new UnauthorizedException('Authorization token is required')
      }

      if (workspace.ownerId !== actor.id) {
        throw new ForbiddenException('Workspace access denied')
      }

      return
    }

    await this.requireOrganizationRole(workspace.organizationId, actor, minRole)
  }

  private async recordWorkspaceAudit(
    workspace: Workspace,
    actorId: string | undefined,
    action: string,
    resourceType: string,
    resourceId: string,
    payload: Prisma.JsonValue,
  ) {
    if (!workspace.organizationId || !this.auditService) {
      return
    }

    await this.auditService.record({
      organizationId: workspace.organizationId,
      actorId: actorId ?? null,
      action,
      resourceType,
      resourceId,
      payload,
    })
  }
}
