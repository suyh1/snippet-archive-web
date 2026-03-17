import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { AuthUser } from '../common/auth/auth-user'
import { PermissionService } from '../permission/permission.service'
import { PrismaService } from '../prisma/prisma.service'

export type SearchSnippetsQuery = {
  keyword?: string
  language?: string
  tag?: string
  workspaceId?: string
  updatedFrom?: Date
  updatedTo?: Date
  page: number
  pageSize: number
}

@Injectable()
export class SearchService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PermissionService)
    private readonly permissionService: PermissionService,
  ) {}

  async searchSnippets(query: SearchSnippetsQuery, actor?: AuthUser) {
    const where = await this.buildWhere(query, actor)
    const skip = (query.page - 1) * query.pageSize

    const [items, total] = await this.prisma.$transaction([
      this.prisma.workspaceFile.findMany({
        where,
        include: {
          workspace: {
            select: {
              id: true,
              title: true,
              tags: true,
              starred: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { path: 'asc' }],
        skip,
        take: query.pageSize,
      }),
      this.prisma.workspaceFile.count({ where }),
    ])

    return {
      items: items.map((item) => {
        return {
          id: item.id,
          workspaceId: item.workspaceId,
          workspaceTitle: item.workspace.title,
          workspaceTags: item.workspace.tags,
          workspaceStarred: item.workspace.starred,
          name: item.name,
          path: item.path,
          language: item.language,
          tags: item.tags,
          content: item.content,
          updatedAt: item.updatedAt.toISOString(),
        }
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  private async buildWhere(
    query: SearchSnippetsQuery,
    actor?: AuthUser,
  ): Promise<Prisma.WorkspaceFileWhereInput> {
    const andConditions: Prisma.WorkspaceFileWhereInput[] = []

    const visibilityFilter = await this.buildVisibilityFilter(actor)
    andConditions.push(visibilityFilter)

    if (query.workspaceId) {
      andConditions.push({ workspaceId: query.workspaceId })
    }

    if (query.language) {
      andConditions.push({ language: query.language })
    }

    if (query.tag) {
      andConditions.push({
        OR: [
          { tags: { has: query.tag } },
          { workspace: { tags: { has: query.tag } } },
        ],
      })
    }

    if (query.keyword) {
      andConditions.push({
        OR: [
          { name: { contains: query.keyword, mode: 'insensitive' } },
          { path: { contains: query.keyword, mode: 'insensitive' } },
          { content: { contains: query.keyword, mode: 'insensitive' } },
          { workspace: { title: { contains: query.keyword, mode: 'insensitive' } } },
        ],
      })
    }

    if (query.updatedFrom || query.updatedTo) {
      andConditions.push({
        updatedAt: {
          ...(query.updatedFrom ? { gte: query.updatedFrom } : {}),
          ...(query.updatedTo ? { lte: query.updatedTo } : {}),
        },
      })
    }

    return {
      kind: 'file',
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    }
  }

  private async buildVisibilityFilter(
    actor?: AuthUser,
  ): Promise<Prisma.WorkspaceFileWhereInput> {
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
      }
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
            organizationId: {
              in: organizationIds,
            },
          },
        },
      ],
    }
  }
}
