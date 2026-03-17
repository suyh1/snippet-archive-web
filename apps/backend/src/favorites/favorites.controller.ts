import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common'
import { UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/auth/current-user.decorator'
import { RequiredAuthGuard } from '../common/auth/required-auth.guard'
import type { AuthUser } from '../common/auth/auth-user'
import { FavoritesService } from './favorites.service'

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  field: string,
): number {
  if (value === undefined) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new BadRequestException(`${field} must be a positive integer`)
  }

  return parsed
}

function parseFavoritesType(value?: string): 'all' | 'workspace' | 'file' {
  if (!value || value === 'all') {
    return 'all'
  }

  if (value === 'workspace' || value === 'file') {
    return value
  }

  throw new BadRequestException('type must be one of: all, workspace, file')
}

@Controller('favorites')
@UseGuards(RequiredAuthGuard)
export class FavoritesController {
  constructor(
    @Inject(FavoritesService)
    private readonly favoritesService: FavoritesService,
  ) {}

  @Get()
  async listFavorites(
    @CurrentUser() currentUser: AuthUser | null,
    @Query('tag') tag?: string,
    @Query('type') type?: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const page = parsePositiveInt(pageRaw, 1, 'page')
    const pageSize = Math.min(parsePositiveInt(pageSizeRaw, 20, 'pageSize'), 100)

    const data = await this.favoritesService.listFavorites({
      tag: tag?.trim() || undefined,
      type: parseFavoritesType(type),
      page,
      pageSize,
    }, currentUser ?? undefined)

    return { data }
  }
}
