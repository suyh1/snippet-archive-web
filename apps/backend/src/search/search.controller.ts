import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
} from '@nestjs/common'
import { SearchService } from './search.service'

function parseOptionalDate(value?: string): Date | undefined {
  if (!value) {
    return undefined
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Invalid date parameter')
  }

  return parsed
}

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

@Controller('search')
export class SearchController {
  constructor(
    @Inject(SearchService)
    private readonly searchService: SearchService,
  ) {}

  @Get('snippets')
  async searchSnippets(
    @Query('keyword') keyword?: string,
    @Query('language') language?: string,
    @Query('tag') tag?: string,
    @Query('workspaceId') workspaceId?: string,
    @Query('updatedFrom') updatedFrom?: string,
    @Query('updatedTo') updatedTo?: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const page = parsePositiveInt(pageRaw, 1, 'page')
    const pageSize = Math.min(parsePositiveInt(pageSizeRaw, 20, 'pageSize'), 100)

    const data = await this.searchService.searchSnippets({
      keyword: keyword?.trim() || undefined,
      language: language?.trim() || undefined,
      tag: tag?.trim() || undefined,
      workspaceId: workspaceId?.trim() || undefined,
      updatedFrom: parseOptionalDate(updatedFrom),
      updatedTo: parseOptionalDate(updatedTo),
      page,
      pageSize,
    })

    return { data }
  }
}
