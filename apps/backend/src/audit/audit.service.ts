import { Inject, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { PermissionService } from '../permission/permission.service'

export type AuditLogRecordInput = {
  organizationId: string
  actorId?: string | null
  action: string
  resourceType: string
  resourceId: string
  payload?: Prisma.JsonValue
}

export type ListAuditLogQuery = {
  action?: string
  actorId?: string
  from?: Date
  to?: Date
  page: number
  pageSize: number
}

@Injectable()
export class AuditService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PermissionService)
    private readonly permissionService: PermissionService,
  ) {}

  async record(input: AuditLogRecordInput) {
    const payload =
      input.payload === undefined
        ? undefined
        : input.payload === null
          ? Prisma.JsonNull
          : (input.payload as Prisma.InputJsonValue)

    await this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorId: input.actorId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        payload,
      },
    })
  }

  async listOrganizationAuditLogs(
    organizationId: string,
    currentUserId: string,
    query: ListAuditLogQuery,
  ) {
    await this.permissionService.requireMembership(
      organizationId,
      currentUserId,
      'OWNER',
    )

    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    }

    const skip = (query.page - 1) * query.pageSize

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ])

    return {
      items: items.map((item) => {
        return {
          id: item.id,
          organizationId: item.organizationId,
          actorId: item.actorId,
          action: item.action,
          resourceType: item.resourceType,
          resourceId: item.resourceId,
          payload: item.payload,
          createdAt: item.createdAt,
        }
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }
}
