import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common'
import { CurrentUser } from '../common/auth/current-user.decorator'
import { RequiredAuthGuard } from '../common/auth/required-auth.guard'
import type { AuthUser } from '../common/auth/auth-user'
import { AuditService } from './audit.service'

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

@Controller('organizations/:organizationId/audit-logs')
@UseGuards(RequiredAuthGuard)
export class AuditController {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async listOrganizationAuditLogs(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @CurrentUser() currentUser: AuthUser | null,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const page = parsePositiveInt(pageRaw, 1, 'page')
    const pageSize = Math.min(parsePositiveInt(pageSizeRaw, 20, 'pageSize'), 100)

    const data = await this.auditService.listOrganizationAuditLogs(
      organizationId,
      currentUser!.id,
      {
        action: action?.trim() || undefined,
        actorId: actorId?.trim() || undefined,
        from: parseOptionalDate(from),
        to: parseOptionalDate(to),
        page,
        pageSize,
      },
    )

    return { data }
  }
}
