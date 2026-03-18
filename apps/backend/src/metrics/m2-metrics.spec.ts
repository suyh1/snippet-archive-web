import { describe, expect, it } from '@jest/globals'
import { OrganizationRole } from '@prisma/client'
import {
  buildM2MetricsReport,
  M2_WRITE_ACTION_ROLE_REQUIREMENTS,
  type M2MetricsRawData,
  type M2Window,
} from './m2-metrics'

function createWindow(): M2Window {
  return {
    asOf: new Date('2026-03-19T08:00:00.000Z'),
    from: new Date('2026-02-17T08:00:00.000Z'),
    to: new Date('2026-03-19T08:00:00.000Z'),
    windowDays: 30,
  }
}

describe('m2 metrics', () => {
  it('builds report with stable schema and ratio values', () => {
    const raw: M2MetricsRawData = {
      totalWorkspacesInWindow: 8,
      teamWorkspacesInWindow: 6,
      shareLinksCreatedInWindow: 5,
      writeAuditLogsInWindow: [],
      membershipSnapshots: [],
    }

    const report = buildM2MetricsReport(raw, createWindow())
    expect(report.window.windowDays).toBe(30)
    expect(report.metrics.teamWorkspaceRatio.numerator).toBe(6)
    expect(report.metrics.teamWorkspaceRatio.denominator).toBe(8)
    expect(report.metrics.teamWorkspaceRatio.ratio).toBe(0.75)
    expect(report.metrics.teamWorkspaceRatio.percentage).toBe(75)
    expect(report.metrics.shareLinkUsage.createdCount).toBe(5)
    expect(report.metrics.permissionIncidents.incidentCount).toBe(0)
  })

  it('detects permission incidents only when violation is provable', () => {
    const raw: M2MetricsRawData = {
      totalWorkspacesInWindow: 0,
      teamWorkspacesInWindow: 0,
      shareLinksCreatedInWindow: 0,
      writeAuditLogsInWindow: [
        {
          id: 'l1',
          organizationId: 'org-1',
          actorId: 'u-viewer',
          action: 'WORKSPACE_FILE_UPDATED',
          createdAt: new Date('2026-03-18T01:00:00.000Z'),
        },
        {
          id: 'l2',
          organizationId: 'org-1',
          actorId: null,
          action: 'WORKSPACE_FILE_UPDATED',
          createdAt: new Date('2026-03-18T02:00:00.000Z'),
        },
        {
          id: 'l3',
          organizationId: 'org-1',
          actorId: 'u-editor',
          action: 'WORKSPACE_FILE_UPDATED',
          createdAt: new Date('2026-03-18T03:00:00.000Z'),
        },
        {
          id: 'l4',
          organizationId: 'org-1',
          actorId: 'u-owner',
          action: 'ORGANIZATION_MEMBER_REMOVED',
          createdAt: new Date('2026-03-18T04:00:00.000Z'),
        },
        {
          id: 'l5',
          organizationId: 'org-1',
          actorId: 'u-unknown',
          action: 'WORKSPACE_FILE_UPDATED',
          createdAt: new Date('2026-03-18T05:00:00.000Z'),
        },
        {
          id: 'l6',
          organizationId: 'org-1',
          actorId: 'u-editor-downgraded-later',
          action: 'WORKSPACE_FILE_UPDATED',
          createdAt: new Date('2026-03-18T06:00:00.000Z'),
        },
      ],
      membershipSnapshots: [
        {
          organizationId: 'org-1',
          userId: 'u-viewer',
          role: OrganizationRole.VIEWER,
          updatedAt: new Date('2026-03-01T00:00:00.000Z'),
        },
        {
          organizationId: 'org-1',
          userId: 'u-editor',
          role: OrganizationRole.EDITOR,
          updatedAt: new Date('2026-03-01T00:00:00.000Z'),
        },
        {
          organizationId: 'org-1',
          userId: 'u-owner',
          role: OrganizationRole.OWNER,
          updatedAt: new Date('2026-03-01T00:00:00.000Z'),
        },
        {
          organizationId: 'org-1',
          userId: 'u-editor-downgraded-later',
          role: OrganizationRole.VIEWER,
          updatedAt: new Date('2026-03-18T07:00:00.000Z'),
        },
      ],
    }

    const report = buildM2MetricsReport(raw, createWindow())
    expect(report.metrics.permissionIncidents.incidentCount).toBe(2)
    expect(report.metrics.permissionIncidents.unknownCount).toBe(2)
    expect(report.metrics.permissionIncidents.evaluatedCount).toBe(4)
    expect(report.metrics.permissionIncidents.sampleActions).toEqual([
      'WORKSPACE_FILE_UPDATED',
      'ORGANIZATION_MEMBER_REMOVED',
    ])
  })

  it('keeps owner/editor requirements mapping explicit', () => {
    expect(M2_WRITE_ACTION_ROLE_REQUIREMENTS.WORKSPACE_FILE_UPDATED).toBe(
      OrganizationRole.EDITOR,
    )
    expect(M2_WRITE_ACTION_ROLE_REQUIREMENTS.ORGANIZATION_MEMBER_REMOVED).toBe(
      OrganizationRole.OWNER,
    )
  })
})
