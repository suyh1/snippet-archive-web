import { apiRequest } from './http'

export type OrganizationRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export type Organization = {
  id: string
  name: string
  slug: string
  ownerId: string
  currentUserRole: OrganizationRole
  createdAt: string
  updatedAt: string
}

export type OrganizationMember = {
  id: string
  organizationId: string
  userId: string
  role: OrganizationRole
  createdAt: string
  user: {
    id: string
    email: string
    name: string
  }
}

export const organizationApi = {
  listOrganizations() {
    return apiRequest<{ items: Organization[] }>('/organizations').then(
      (res) => res.items,
    )
  },
  createOrganization(payload: { name: string; slug: string }) {
    return apiRequest<Organization>('/organizations', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  deleteOrganization(organizationId: string) {
    return apiRequest<{ id: string }>(`/organizations/${organizationId}`, {
      method: 'DELETE',
    })
  },
  listMembers(organizationId: string) {
    return apiRequest<{ items: OrganizationMember[] }>(
      `/organizations/${organizationId}/members`,
    ).then((res) => res.items)
  },
  addMember(
    organizationId: string,
    payload: { email: string; role: OrganizationRole },
  ) {
    return apiRequest<OrganizationMember>(
      `/organizations/${organizationId}/members`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
  },
  updateMemberRole(
    organizationId: string,
    membershipId: string,
    payload: { role: OrganizationRole },
  ) {
    return apiRequest<OrganizationMember>(
      `/organizations/${organizationId}/members/${membershipId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    )
  },
  removeMember(organizationId: string, membershipId: string) {
    return apiRequest<{ id: string }>(
      `/organizations/${organizationId}/members/${membershipId}`,
      {
        method: 'DELETE',
      },
    )
  },
}
