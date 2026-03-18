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

function normalizeQueryValue(value?: string) {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : undefined
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
    const action = normalizeQueryValue(query?.action)
    const actorId = normalizeQueryValue(query?.actorId)
    const from = normalizeQueryValue(query?.from)
    const to = normalizeQueryValue(query?.to)

    if (action) {
      params.set('action', action)
    }
    if (actorId) {
      params.set('actorId', actorId)
    }
    if (from) {
      params.set('from', from)
    }
    if (to) {
      params.set('to', to)
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
