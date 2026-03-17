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
      listMembers: vi.fn(),
      addMember: vi.fn(),
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
import { auditApi } from '@/api/audit'

describe('TeamPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
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

  it('supports share create via Enter and expiry blur normalization', async () => {
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
    })

    await wrapper.get('[data-testid="team-share-workspace-id"]').setValue(
      '00000000-0000-0000-0000-000000000001',
    )
    await wrapper.get('[data-testid="team-share-file-id"]').setValue(
      '00000000-0000-0000-0000-000000000002',
    )
    await wrapper.get('[data-testid="team-share-expiry"]').setValue('2026-03-18T18:30')
    await wrapper.get('[data-testid="team-share-expiry"]').trigger('blur')
    await wrapper.get('[data-testid="team-share-file-id"]').trigger('keydown.enter')

    expect(shareApi.createFileShareLink).toHaveBeenCalledTimes(1)
  })
})
