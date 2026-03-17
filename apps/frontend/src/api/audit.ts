import { apiRequest } from './http'

export type AuditLogItem = {
  id: string
  organizationId: string
  actorId: string | null
  action: string
  resourceType: string
  resourceId: string
  payload: unknown
  createdAt: string
}

export type AuditLogResult = {
  items: AuditLogItem[]
  total: number
  page: number
  pageSize: number
}

export const auditApi = {
  listOrganizationAuditLogs(
    organizationId: string,
    query?: {
      action?: string
      actorId?: string
      from?: string
      to?: string
      page?: number
      pageSize?: number
    },
  ) {
    const params = new URLSearchParams()

    if (query?.action) {
      params.set('action', query.action)
    }
    if (query?.actorId) {
      params.set('actorId', query.actorId)
    }
    if (query?.from) {
      params.set('from', query.from)
    }
    if (query?.to) {
      params.set('to', query.to)
    }
    if (query?.page) {
      params.set('page', String(query.page))
    }
    if (query?.pageSize) {
      params.set('pageSize', String(query.pageSize))
    }

    const queryString = params.toString()
    const path = queryString
      ? `/organizations/${organizationId}/audit-logs?${queryString}`
      : `/organizations/${organizationId}/audit-logs`

    return apiRequest<AuditLogResult>(path)
  },
}
