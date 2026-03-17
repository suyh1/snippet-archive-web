import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { ShareLinkPermission, ShareLinkVisibility } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { PermissionService } from '../permission/permission.service'
import { AuditService } from '../audit/audit.service'

type CreateShareLinkInput = {
  workspaceId: string
  fileId: string
  actorId: string
  visibility: ShareLinkVisibility
  permission: ShareLinkPermission
  expiresAt?: string
}

@Injectable()
export class ShareService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PermissionService)
    private readonly permissionService: PermissionService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  async createShareLink(input: CreateShareLinkInput) {
    const { workspace } = await this.permissionService.requireWorkspaceRole(
      input.workspaceId,
      input.actorId,
      'EDITOR',
    )

    if (!workspace.organizationId) {
      throw new ForbiddenException('Only organization workspace supports share links')
    }

    const file = await this.prisma.workspaceFile.findFirst({
      where: {
        id: input.fileId,
        workspaceId: input.workspaceId,
        kind: 'file',
      },
      select: {
        id: true,
      },
    })

    if (!file) {
      throw new NotFoundException('Workspace file not found')
    }

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid share link expiry value')
    }

    const shareLink = await this.prisma.shareLink.create({
      data: {
        organizationId: workspace.organizationId,
        workspaceId: workspace.id,
        fileId: file.id,
        token: randomBytes(20).toString('hex'),
        visibility: input.visibility,
        permission: input.permission,
        createdById: input.actorId,
        expiresAt,
      },
    })

    await this.auditService.record({
      organizationId: workspace.organizationId,
      actorId: input.actorId,
      action: 'SHARE_LINK_CREATED',
      resourceType: 'share_link',
      resourceId: shareLink.id,
      payload: {
        visibility: shareLink.visibility,
        permission: shareLink.permission,
        expiresAt: shareLink.expiresAt?.toISOString() ?? null,
      },
    })

    return shareLink
  }

  async listShareLinks(workspaceId: string, fileId: string, actorId: string) {
    const { workspace } = await this.permissionService.requireWorkspaceRole(
      workspaceId,
      actorId,
      'EDITOR',
    )

    if (!workspace.organizationId) {
      return []
    }

    const file = await this.prisma.workspaceFile.findFirst({
      where: {
        id: fileId,
        workspaceId,
        kind: 'file',
      },
      select: { id: true },
    })

    if (!file) {
      throw new NotFoundException('Workspace file not found')
    }

    return this.prisma.shareLink.findMany({
      where: {
        workspaceId,
        fileId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
  }

  async revokeShareLink(
    workspaceId: string,
    fileId: string,
    shareLinkId: string,
    actorId: string,
  ) {
    const { workspace } = await this.permissionService.requireWorkspaceRole(
      workspaceId,
      actorId,
      'EDITOR',
    )

    if (!workspace.organizationId) {
      throw new ForbiddenException('Only organization workspace supports share links')
    }

    const shareLink = await this.prisma.shareLink.findFirst({
      where: {
        id: shareLinkId,
        workspaceId,
        fileId,
      },
    })

    if (!shareLink) {
      throw new NotFoundException('Share link not found')
    }

    const revoked =
      shareLink.revokedAt === null
        ? await this.prisma.shareLink.update({
            where: { id: shareLink.id },
            data: { revokedAt: new Date() },
          })
        : shareLink

    await this.auditService.record({
      organizationId: workspace.organizationId,
      actorId,
      action: 'SHARE_LINK_REVOKED',
      resourceType: 'share_link',
      resourceId: revoked.id,
      payload: null,
    })

    return revoked
  }

  async resolveSharedFileByToken(token: string, actorId?: string | null) {
    const shareLink = await this.prisma.shareLink.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            id: true,
            title: true,
            organizationId: true,
          },
        },
        file: {
          select: {
            id: true,
            workspaceId: true,
            name: true,
            path: true,
            language: true,
            content: true,
            tags: true,
            updatedAt: true,
          },
        },
      },
    })

    if (!shareLink) {
      throw new NotFoundException('Share link not found')
    }

    if (shareLink.revokedAt || this.isExpired(shareLink.expiresAt)) {
      throw new GoneException('Share link is no longer available')
    }

    if (shareLink.visibility === 'TEAM') {
      if (!actorId) {
        throw new UnauthorizedException('Authentication required for team share link')
      }

      await this.permissionService.requireMembership(
        shareLink.organizationId,
        actorId,
        'VIEWER',
      )
    }

    if (shareLink.visibility === 'PRIVATE') {
      if (!actorId) {
        throw new UnauthorizedException('Authentication required for private share link')
      }

      if (actorId !== shareLink.createdById) {
        throw new ForbiddenException('No access to private share link')
      }
    }

    return {
      id: shareLink.id,
      token: shareLink.token,
      visibility: shareLink.visibility,
      permission: shareLink.permission,
      expiresAt: shareLink.expiresAt,
      createdAt: shareLink.createdAt,
      file: shareLink.file,
      workspace: shareLink.workspace,
    }
  }

  private isExpired(expiresAt: Date | null) {
    if (!expiresAt) {
      return false
    }

    return expiresAt.getTime() <= Date.now()
  }
}
