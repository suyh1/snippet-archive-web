import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import type { AuthUser } from '../common/auth/auth-user'
import { PermissionService } from '../permission/permission.service'
import { PrismaService } from '../prisma/prisma.service'

export type FavoritesQuery = {
  tag?: string
  type: 'all' | 'workspace' | 'file'
  page: number
  pageSize: number
}

type FavoriteItem = {
  type: 'workspace' | 'file'
  id: string
  workspaceId: string
  workspaceTitle: string
  title: string
  path: string | null
  language: string | null
  tags: string[]
  starredAt: string
}

@Injectable()
export class FavoritesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PermissionService)
    private readonly permissionService: PermissionService,
  ) {}

  async listFavorites(query: FavoritesQuery, actor?: AuthUser) {
    const items: FavoriteItem[] = []
    const workspaceVisibilityWhere = await this.buildWorkspaceVisibilityWhere(actor)
    const fileVisibilityWhere = await this.buildFileVisibilityWhere(actor)

    if (query.type === 'all' || query.type === 'workspace') {
      const workspaces = await this.prisma.workspace.findMany({
        where: {
          starred: true,
          ...workspaceVisibilityWhere,
          ...(query.tag ? { tags: { has: query.tag } } : {}),
        },
        orderBy: { updatedAt: 'desc' },
      })

      for (const workspace of workspaces) {
        items.push({
          type: 'workspace',
          id: workspace.id,
          workspaceId: workspace.id,
          workspaceTitle: workspace.title,
          title: workspace.title,
          path: null,
          language: null,
          tags: workspace.tags,
          starredAt: workspace.updatedAt.toISOString(),
        })
      }
    }

    if (query.type === 'all' || query.type === 'file') {
      const fileConditions: Prisma.WorkspaceFileWhereInput[] = [fileVisibilityWhere]

      if (query.tag) {
        fileConditions.push({
          OR: [
            { tags: { has: query.tag } },
            { workspace: { tags: { has: query.tag } } },
          ],
        })
      }

      const files = await this.prisma.workspaceFile.findMany({
        where: {
          kind: 'file',
          starred: true,
          AND: fileConditions,
        },
        include: {
          workspace: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      })

      for (const file of files) {
        items.push({
          type: 'file',
          id: file.id,
          workspaceId: file.workspace.id,
          workspaceTitle: file.workspace.title,
          title: file.name,
          path: file.path,
          language: file.language,
          tags: file.tags,
          starredAt: file.updatedAt.toISOString(),
        })
      }
    }

    items.sort((a, b) => b.starredAt.localeCompare(a.starredAt))

    const total = items.length
    const start = (query.page - 1) * query.pageSize
    const pagedItems = items.slice(start, start + query.pageSize)

    return {
      items: pagedItems,
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  private async buildWorkspaceVisibilityWhere(actor?: AuthUser) {
    if (!actor?.id) {
      throw new UnauthorizedException('Authorization token is required')
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

  private async buildFileVisibilityWhere(actor?: AuthUser) {
    if (!actor?.id) {
      throw new UnauthorizedException('Authorization token is required')
    }

    const organizationIds = await this.permissionService.listOrganizationIdsForUser(
      actor.id,
    )

    if (organizationIds.length === 0) {
      return {
        workspace: {
          ownerId: actor.id,
        },
      } as Prisma.WorkspaceFileWhereInput
    }

    return {
      OR: [
        {
          workspace: {
            ownerId: actor.id,
          },
        },
        {
          workspace: {
            organizationId: { in: organizationIds },
          },
        },
      ],
    } as Prisma.WorkspaceFileWhereInput
  }
}
