// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/auth', () => {
  return {
    authApi: {
      register: vi.fn(),
      login: vi.fn(),
      me: vi.fn(),
      logout: vi.fn(),
    },
  }
})

vi.mock('@/api/organization', () => {
  return {
    organizationApi: {
      listOrganizations: vi.fn(),
      createOrganization: vi.fn(),
      deleteOrganization: vi.fn(),
      listMembers: vi.fn(),
      addMember: vi.fn(),
      updateMemberRole: vi.fn(),
      removeMember: vi.fn(),
    },
  }
})

vi.mock('@/api/share', () => {
  return {
    shareApi: {
      listFileShareLinks: vi.fn(),
      createFileShareLink: vi.fn(),
      revokeFileShareLink: vi.fn(),
    },
  }
})

vi.mock('@/api/workspaces', () => {
  return {
    workspaceApi: {
      list: vi.fn(),
      listFiles: vi.fn(),
    },
  }
})

vi.mock('@/api/audit', () => {
  return {
    auditApi: {
      listOrganizationAuditLogs: vi.fn(),
    },
  }
})

import TeamPage from '@/pages/TeamPage.vue'
import { authApi } from '@/api/auth'
import { organizationApi } from '@/api/organization'
import { shareApi } from '@/api/share'
import { workspaceApi } from '@/api/workspaces'
import { auditApi } from '@/api/audit'

describe('TeamPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
    vi.mocked(workspaceApi.list).mockResolvedValue([])
    vi.mocked(workspaceApi.listFiles).mockResolvedValue([])
  })

  it('supports register click flow and organization create keyboard flow', async () => {
    vi.mocked(authApi.register).mockResolvedValue({
      accessToken: 'token-1',
      user: {
        id: 'u1',
        email: 'owner@example.com',
        name: 'Owner',
      },
    })

    vi.mocked(organizationApi.listOrganizations).mockResolvedValue([])
    vi.mocked(organizationApi.createOrganization).mockResolvedValue({
      id: 'org-1',
      name: 'Team Alpha',
      slug: 'team-alpha',
      ownerId: 'u1',
      currentUserRole: 'OWNER',
      createdAt: '2026-03-17T10:00:00.000Z',
      updatedAt: '2026-03-17T10:00:00.000Z',
    })

    vi.mocked(organizationApi.listMembers).mockResolvedValue([])
    vi.mocked(auditApi.listOrganizationAuditLogs).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })

    const wrapper = mount(TeamPage)
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="team-auth-name"]').exists()).toBe(true)
    })

    await wrapper.get('[data-testid="team-auth-name"]').setValue('Owner')
    await wrapper.get('[data-testid="team-auth-email"]').setValue('owner@example.com')
    await wrapper.get('[data-testid="team-auth-password"]').setValue('Passw0rd!pass')
    await wrapper.get('[data-testid="team-register"]').trigger('click')

    expect(authApi.register).toHaveBeenCalledTimes(1)
    expect(organizationApi.listOrganizations).toHaveBeenCalledTimes(1)

    await wrapper.get('[data-testid="team-org-name"]').setValue('Team Alpha')
    await wrapper.get('[data-testid="team-org-slug"]').setValue('team-alpha')
    await wrapper.get('[data-testid="team-org-slug"]').trigger('keydown.enter')

    expect(organizationApi.createOrganization).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="team-org-select"]').element).toBeTruthy()
  })

  it('supports organization delete with confirm dialog flow', async () => {
    window.localStorage.setItem('snippet-auth-token-v1', 'token-existing')

    vi.mocked(authApi.me).mockResolvedValue({
      id: 'u1',
      email: 'owner@example.com',
      name: 'Owner',
    })

    vi.mocked(organizationApi.listOrganizations)
      .mockResolvedValueOnce([
        {
          id: 'org-1',
          name: 'Team Alpha',
          slug: 'team-alpha',
          ownerId: 'u1',
          currentUserRole: 'OWNER',
          createdAt: '2026-03-17T10:00:00.000Z',
          updatedAt: '2026-03-17T10:00:00.000Z',
        },
        {
          id: 'org-2',
          name: 'Team Beta',
          slug: 'team-beta',
          ownerId: 'u2',
          currentUserRole: 'OWNER',
          createdAt: '2026-03-17T11:00:00.000Z',
          updatedAt: '2026-03-17T11:00:00.000Z',
        },
      ])
      .mockResolvedValue([
        {
          id: 'org-2',
          name: 'Team Beta',
          slug: 'team-beta',
          ownerId: 'u2',
          currentUserRole: 'OWNER',
          createdAt: '2026-03-17T11:00:00.000Z',
          updatedAt: '2026-03-17T11:00:00.000Z',
        },
      ])

    vi.mocked(organizationApi.listMembers).mockResolvedValue([])
    vi.mocked(organizationApi.deleteOrganization).mockResolvedValue({ id: 'org-1' })
    vi.mocked(auditApi.listOrganizationAuditLogs).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })
    vi.mocked(shareApi.listFileShareLinks).mockResolvedValue([])

    const wrapper = mount(TeamPage)
    await vi.waitFor(() => {
      expect(organizationApi.listOrganizations).toHaveBeenCalled()
    })

    expect(
      (wrapper.get('[data-testid="team-org-select"]').element as HTMLSelectElement).value,
    ).toBe('org-1')

    await wrapper.get('[data-testid="team-org-delete"]').trigger('click')
    expect(wrapper.find('[data-testid="confirm-dialog"]').exists()).toBe(true)
    await wrapper.get('[data-testid="confirm-dialog-cancel"]').trigger('click')
    expect(organizationApi.deleteOrganization).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="team-org-delete"]').trigger('click')
    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')

    await vi.waitFor(() => {
      expect(organizationApi.deleteOrganization).toHaveBeenCalledWith('org-1')
    })
    await vi.waitFor(() => {
      expect(
        (wrapper.get('[data-testid="team-org-select"]').element as HTMLSelectElement).value,
      ).toBe('org-2')
    })
  })

  it('supports share create via workspace/file selectors and manual id fallback', async () => {
    window.localStorage.setItem('snippet-auth-token-v1', 'token-existing')

    vi.mocked(authApi.me).mockResolvedValue({
      id: 'u1',
      email: 'owner@example.com',
      name: 'Owner',
    })

    vi.mocked(organizationApi.listOrganizations).mockResolvedValue([
      {
        id: 'org-1',
        name: 'Team Alpha',
        slug: 'team-alpha',
        ownerId: 'u1',
        currentUserRole: 'OWNER',
        createdAt: '2026-03-17T10:00:00.000Z',
        updatedAt: '2026-03-17T10:00:00.000Z',
      },
    ])
    vi.mocked(organizationApi.listMembers).mockResolvedValue([])
    vi.mocked(workspaceApi.list).mockResolvedValue([
      {
        id: '00000000-0000-0000-0000-000000000001',
        organizationId: 'org-1',
        title: 'Playwright Team Workspace',
        description: '',
        tags: [],
        starred: false,
      },
      {
        id: '00000000-0000-0000-0000-000000000100',
        organizationId: 'org-other',
        title: 'Other Org Workspace',
        description: '',
        tags: [],
        starred: false,
      },
    ])
    vi.mocked(workspaceApi.listFiles).mockResolvedValue([
      {
        id: 'folder-1',
        workspaceId: '00000000-0000-0000-0000-000000000001',
        name: 'src',
        path: '/src',
        language: 'plaintext',
        content: '',
        kind: 'folder',
        order: 1,
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        workspaceId: '00000000-0000-0000-0000-000000000001',
        name: 'shared.ts',
        path: '/shared.ts',
        language: 'typescript',
        content: 'export const shared = true',
        kind: 'file',
        order: 2,
      },
    ])
    vi.mocked(shareApi.listFileShareLinks).mockResolvedValue([])
    vi.mocked(shareApi.createFileShareLink).mockResolvedValue({
      id: 'share-1',
      token: 'token-share-1',
      visibility: 'PUBLIC',
      permission: 'READ',
      createdAt: '2026-03-17T10:00:00.000Z',
      expiresAt: null,
    })
    vi.mocked(auditApi.listOrganizationAuditLogs).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })

    const wrapper = mount(TeamPage)
    await vi.waitFor(() => {
      expect(organizationApi.listOrganizations).toHaveBeenCalled()
      expect(workspaceApi.list).toHaveBeenCalled()
    })

    const workspaceSelect = wrapper.get('[data-testid="team-share-workspace-select"]')
    expect(workspaceSelect.text()).toContain('Playwright Team Workspace')
    expect(workspaceSelect.text()).not.toContain('Other Org Workspace')

    await workspaceSelect.setValue(
      '00000000-0000-0000-0000-000000000001',
    )
    await vi.waitFor(() => {
      expect(workspaceApi.listFiles).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
      )
    })

    await wrapper.get('[data-testid="team-share-file-select"]').setValue(
      '00000000-0000-0000-0000-000000000002',
    )
    await wrapper.get('[data-testid="team-share-permission"]').setValue('READ_METADATA')
    await wrapper.get('[data-testid="team-share-expiry"]').setValue('2026-03-18T18:30')
    await wrapper.get('[data-testid="team-share-expiry"]').trigger('blur')
    await wrapper.get('[data-testid="team-share-file-select"]').trigger('keydown.enter')

    expect(shareApi.createFileShareLink).toHaveBeenCalledTimes(1)
    expect(shareApi.createFileShareLink).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      expect.objectContaining({
        permission: 'READ_METADATA',
      }),
    )

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="team-message"]').text()).toContain('分享链接已创建')
    })
    await wrapper.get('[data-testid="team-share-toggle-manual"]').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="team-share-workspace-id"]').exists()).toBe(true)
    })
    await wrapper.get('[data-testid="team-share-workspace-id"]').setValue(
      ' 00000000-0000-0000-0000-0000000000aa ',
    )
    await wrapper.get('[data-testid="team-share-workspace-id"]').trigger('blur')
    await wrapper.get('[data-testid="team-share-file-id"]').setValue(
      ' 00000000-0000-0000-0000-0000000000bb ',
    )
    await wrapper.get('[data-testid="team-share-file-id"]').trigger('blur')
    await wrapper.get('[data-testid="team-share-file-id"]').trigger('keydown.enter')

    expect(shareApi.createFileShareLink).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-0000000000aa',
      '00000000-0000-0000-0000-0000000000bb',
      expect.objectContaining({
        permission: 'READ_METADATA',
      }),
    )
  })

  it('supports member role update and remove with custom confirm flow', async () => {
    window.localStorage.setItem('snippet-auth-token-v1', 'token-existing')

    const confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockImplementation(() => true)

    vi.mocked(authApi.me).mockResolvedValue({
      id: 'u1',
      email: 'owner@example.com',
      name: 'Owner',
    })

    vi.mocked(organizationApi.listOrganizations).mockResolvedValue([
      {
        id: 'org-1',
        name: 'Team Alpha',
        slug: 'team-alpha',
        ownerId: 'u1',
        currentUserRole: 'OWNER',
        createdAt: '2026-03-17T10:00:00.000Z',
        updatedAt: '2026-03-17T10:00:00.000Z',
      },
    ])

    vi.mocked(organizationApi.listMembers).mockResolvedValue([
      {
        id: 'm-owner',
        organizationId: 'org-1',
        userId: 'u1',
        role: 'OWNER',
        createdAt: '2026-03-17T10:00:00.000Z',
        user: {
          id: 'u1',
          email: 'owner@example.com',
          name: 'Owner',
        },
      },
      {
        id: 'm-viewer',
        organizationId: 'org-1',
        userId: 'u2',
        role: 'VIEWER',
        createdAt: '2026-03-17T10:00:00.000Z',
        user: {
          id: 'u2',
          email: 'viewer@example.com',
          name: 'Viewer',
        },
      },
    ])

    vi.mocked(organizationApi.updateMemberRole).mockResolvedValue({
      id: 'm-viewer',
      organizationId: 'org-1',
      userId: 'u2',
      role: 'EDITOR',
      createdAt: '2026-03-17T10:00:00.000Z',
      user: {
        id: 'u2',
        email: 'viewer@example.com',
        name: 'Viewer',
      },
    })

    vi.mocked(organizationApi.removeMember).mockResolvedValue({
      id: 'm-viewer',
    })

    vi.mocked(auditApi.listOrganizationAuditLogs).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })

    vi.mocked(shareApi.listFileShareLinks).mockResolvedValue([])

    const wrapper = mount(TeamPage)
    await vi.waitFor(() => {
      expect(organizationApi.listOrganizations).toHaveBeenCalled()
    })

    const memberRows = wrapper.findAll('[data-testid="team-member-item"]')
    const viewerRow = memberRows.find((row) => row.text().includes('viewer@example.com'))
    expect(viewerRow).toBeTruthy()

    await viewerRow!.get('[data-testid="team-member-role-select"]').setValue('EDITOR')
    await viewerRow!.get('[data-testid="team-member-role-save"]').trigger('click')

    expect(organizationApi.updateMemberRole).toHaveBeenCalledWith('org-1', 'm-viewer', {
      role: 'EDITOR',
    })
    await vi.waitFor(() => {
      expect(viewerRow!.text()).toContain('EDITOR')
    })

    await viewerRow!.get('[data-testid="team-member-remove"]').trigger('click')
    expect(wrapper.find('[data-testid="confirm-dialog"]').exists()).toBe(true)
    await wrapper.find('[data-testid="confirm-dialog-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="confirm-dialog"]').exists()).toBe(false)
    expect(organizationApi.removeMember).not.toHaveBeenCalled()

    await viewerRow!.get('[data-testid="team-member-remove"]').trigger('click')
    await wrapper.find('[data-testid="confirm-dialog-confirm"]').trigger('click')
    expect(organizationApi.removeMember).toHaveBeenCalledWith('org-1', 'm-viewer')

    await vi.waitFor(() => {
      expect(
        wrapper
          .findAll('[data-testid="team-member-item"]')
          .some((row) => row.text().includes('viewer@example.com')),
      ).toBe(false)
    })

    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('supports audit combo filters with keyboard + blur and shows empty state', async () => {
    window.localStorage.setItem('snippet-auth-token-v1', 'token-existing')

    vi.mocked(authApi.me).mockResolvedValue({
      id: 'u1',
      email: 'owner@example.com',
      name: 'Owner',
    })

    vi.mocked(organizationApi.listOrganizations).mockResolvedValue([
      {
        id: 'org-1',
        name: 'Team Alpha',
        slug: 'team-alpha',
        ownerId: 'u1',
        currentUserRole: 'OWNER',
        createdAt: '2026-03-17T10:00:00.000Z',
        updatedAt: '2026-03-17T10:00:00.000Z',
      },
    ])

    vi.mocked(organizationApi.listMembers).mockResolvedValue([])
    vi.mocked(shareApi.listFileShareLinks).mockResolvedValue([])
    vi.mocked(auditApi.listOrganizationAuditLogs).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })

    const wrapper = mount(TeamPage)
    await vi.waitFor(() => {
      expect(organizationApi.listOrganizations).toHaveBeenCalled()
    })

    vi.mocked(auditApi.listOrganizationAuditLogs).mockClear()

    const fromInputValue = '2026-03-18T08:15'
    const toInputValue = '2026-03-18T10:45'

    await wrapper.get('[data-testid="team-audit-action"]').setValue('  SHARE_LINK_CREATED  ')
    await wrapper.get('[data-testid="team-audit-actor"]').setValue(' u1 ')
    await wrapper.get('[data-testid="team-audit-from"]').setValue(fromInputValue)
    await wrapper.get('[data-testid="team-audit-to"]').setValue(toInputValue)
    await wrapper.get('[data-testid="team-audit-from"]').trigger('blur')
    await wrapper.get('[data-testid="team-audit-to"]').trigger('blur')

    vi.mocked(auditApi.listOrganizationAuditLogs).mockResolvedValueOnce({
      items: [
        {
          id: 'audit-1',
          organizationId: 'org-1',
          actorId: 'u1',
          action: 'SHARE_LINK_CREATED',
          resourceType: 'SHARE_LINK',
          resourceId: 'share-1',
          payload: {},
          createdAt: '2026-03-18T08:25:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    })

    await wrapper.get('[data-testid="team-audit-to"]').trigger('keydown.enter')

    expect(auditApi.listOrganizationAuditLogs).toHaveBeenCalledWith('org-1', {
      action: 'SHARE_LINK_CREATED',
      actorId: 'u1',
      from: new Date(fromInputValue).toISOString(),
      to: new Date(toInputValue).toISOString(),
      page: 1,
      pageSize: 20,
    })

    await vi.waitFor(() => {
      expect(wrapper.findAll('[data-testid="team-audit-item"]').length).toBe(1)
    })

    vi.mocked(auditApi.listOrganizationAuditLogs).mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })
    await wrapper.get('[data-testid="team-audit-actor"]').setValue('u-not-found')
    await wrapper.get('[data-testid="team-audit-query"]').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.findAll('[data-testid="team-audit-item"]').length).toBe(0)
      expect(wrapper.get('[data-testid="team-audit-empty"]').text()).toContain('暂无匹配')
    })
  })

  it('shows explicit error feedback when audit query fails', async () => {
    window.localStorage.setItem('snippet-auth-token-v1', 'token-existing')

    vi.mocked(authApi.me).mockResolvedValue({
      id: 'u1',
      email: 'owner@example.com',
      name: 'Owner',
    })

    vi.mocked(organizationApi.listOrganizations).mockResolvedValue([
      {
        id: 'org-1',
        name: 'Team Alpha',
        slug: 'team-alpha',
        ownerId: 'u1',
        currentUserRole: 'OWNER',
        createdAt: '2026-03-17T10:00:00.000Z',
        updatedAt: '2026-03-17T10:00:00.000Z',
      },
    ])

    vi.mocked(organizationApi.listMembers).mockResolvedValue([])
    vi.mocked(shareApi.listFileShareLinks).mockResolvedValue([])
    vi.mocked(auditApi.listOrganizationAuditLogs).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })

    const wrapper = mount(TeamPage)
    await vi.waitFor(() => {
      expect(organizationApi.listOrganizations).toHaveBeenCalled()
    })

    vi.mocked(auditApi.listOrganizationAuditLogs).mockClear()
    vi.mocked(auditApi.listOrganizationAuditLogs).mockRejectedValueOnce(
      new Error('network down'),
    )
    await wrapper.get('[data-testid="team-audit-query"]').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="team-error"]').text()).toContain('加载审计日志失败')
    })
  })
})
