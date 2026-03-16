import { Inject, Injectable } from '@nestjs/common'
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
  ) {}

  async listFavorites(query: FavoritesQuery) {
    const items: FavoriteItem[] = []

    if (query.type === 'all' || query.type === 'workspace') {
      const workspaces = await this.prisma.workspace.findMany({
        where: {
          starred: true,
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
      const files = await this.prisma.workspaceFile.findMany({
        where: {
          kind: 'file',
          starred: true,
          ...(query.tag
            ? {
                OR: [
                  { tags: { has: query.tag } },
                  { workspace: { tags: { has: query.tag } } },
                ],
              }
            : {}),
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
}
