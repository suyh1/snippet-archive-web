import { OrganizationRole } from '@prisma/client'

const ROLE_LEVEL: Record<OrganizationRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
}

export const M2_WRITE_ACTION_ROLE_REQUIREMENTS = {
  WORKSPACE_CREATED: OrganizationRole.EDITOR,
  WORKSPACE_UPDATED: OrganizationRole.EDITOR,
  WORKSPACE_DELETED: OrganizationRole.OWNER,
  WORKSPACE_FILE_CREATED: OrganizationRole.EDITOR,
  WORKSPACE_FILE_UPDATED: OrganizationRole.EDITOR,
  WORKSPACE_FILE_RESTORED: OrganizationRole.EDITOR,
  WORKSPACE_FILE_MOVED: OrganizationRole.EDITOR,
  WORKSPACE_FILE_DELETED: OrganizationRole.EDITOR,
  SHARE_LINK_CREATED: OrganizationRole.EDITOR,
  SHARE_LINK_REVOKED: OrganizationRole.EDITOR,
  ORGANIZATION_MEMBER_UPSERTED: OrganizationRole.OWNER,
  ORGANIZATION_MEMBER_ROLE_UPDATED: OrganizationRole.OWNER,
  ORGANIZATION_MEMBER_REMOVED: OrganizationRole.OWNER,
} as const satisfies Record<string, OrganizationRole>

const M2_WRITE_ACTION_ROLE_REQUIREMENTS_MAP: Record<string, OrganizationRole> =
  M2_WRITE_ACTION_ROLE_REQUIREMENTS

export type M2Window = {
  asOf: Date
  from: Date
  to: Date
  windowDays: number
}

export type M2WriteAuditLog = {
  id: string
  organizationId: string
  actorId: string | null
  action: string
  createdAt: Date
}

export type M2MembershipSnapshot = {
  organizationId: string
  userId: string
  role: OrganizationRole
  updatedAt: Date
}

export type M2MetricsRawData = {
  totalWorkspacesInWindow: number
  teamWorkspacesInWindow: number
  shareLinksCreatedInWindow: number
  writeAuditLogsInWindow: M2WriteAuditLog[]
  membershipSnapshots: M2MembershipSnapshot[]
}

export type M2MetricsReport = {
  generatedAt: string
  window: {
    asOf: string
    from: string
    to: string
    windowDays: number
  }
  metrics: {
    teamWorkspaceRatio: {
      definition: string
      numerator: number
      denominator: number
      ratio: number
      percentage: number
    }
    shareLinkUsage: {
      definition: string
      createdCount: number
    }
    permissionIncidents: {
      definition: string
      incidentCount: number
      unknownCount: number
      evaluatedCount: number
      sampleActions: string[]
    }
  }
}

function hasRoleAtLeast(role: OrganizationRole, minRole: OrganizationRole) {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[minRole]
}

function buildMembershipKey(organizationId: string, userId: string) {
  return `${organizationId}::${userId}`
}

export function createRollingWindow(asOf: Date, windowDays = 30): M2Window {
  if (!Number.isFinite(windowDays) || windowDays < 1) {
    throw new Error('windowDays must be >= 1')
  }

  const to = new Date(asOf)
  const from = new Date(to.getTime() - windowDays * 24 * 60 * 60 * 1000)

  return {
    asOf: to,
    from,
    to,
    windowDays,
  }
}

export function buildM2MetricsReport(
  raw: M2MetricsRawData,
  window: M2Window,
): M2MetricsReport {
  const denominator = raw.totalWorkspacesInWindow
  const ratioRaw =
    denominator > 0 ? raw.teamWorkspacesInWindow / denominator : 0
  const ratio = Number(ratioRaw.toFixed(4))
  const percentage = Number((ratioRaw * 100).toFixed(2))

  const memberships = new Map<string, M2MembershipSnapshot>()
  for (const membership of raw.membershipSnapshots) {
    memberships.set(
      buildMembershipKey(membership.organizationId, membership.userId),
      membership,
    )
  }

  let incidentCount = 0
  let unknownCount = 0
  let evaluatedCount = 0
  const sampleActions: string[] = []
  const sampleActionSet = new Set<string>()

  for (const log of raw.writeAuditLogsInWindow) {
    const minRole = M2_WRITE_ACTION_ROLE_REQUIREMENTS_MAP[log.action]
    if (!minRole) {
      continue
    }

    if (!sampleActionSet.has(log.action)) {
      sampleActionSet.add(log.action)
      sampleActions.push(log.action)
    }

    if (!log.actorId) {
      evaluatedCount += 1
      incidentCount += 1
      continue
    }

    const membership = memberships.get(
      buildMembershipKey(log.organizationId, log.actorId),
    )

    if (!membership) {
      unknownCount += 1
      continue
    }

    if (membership.updatedAt.getTime() > log.createdAt.getTime()) {
      unknownCount += 1
      continue
    }

    evaluatedCount += 1

    if (!hasRoleAtLeast(membership.role, minRole)) {
      incidentCount += 1
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    window: {
      asOf: window.asOf.toISOString(),
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      windowDays: window.windowDays,
    },
    metrics: {
      teamWorkspaceRatio: {
        definition:
          '团队工作区占比 = 统计周期内 organizationId 非空的工作区数 / 同周期内工作区总数',
        numerator: raw.teamWorkspacesInWindow,
        denominator,
        ratio,
        percentage,
      },
      shareLinkUsage: {
        definition: '分享链接使用量 = 统计周期内创建的分享链接数量',
        createdCount: raw.shareLinksCreatedInWindow,
      },
      permissionIncidents: {
        definition:
          '权限事故数 = 统计周期内可验证的越权写入事件数（含 actor 缺失；对角色变更后的历史事件记为 unknown，不计入事故）',
        incidentCount,
        unknownCount,
        evaluatedCount,
        sampleActions,
      },
    },
  }
}
