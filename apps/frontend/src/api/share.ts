import { apiRequest } from './http'

export type ShareVisibility = 'PRIVATE' | 'TEAM' | 'PUBLIC'
export type SharePermission = 'READ'

export type ShareLink = {
  id: string
  token: string
  visibility: ShareVisibility
  permission: SharePermission
  createdAt: string
  expiresAt: string | null
  revokedAt?: string | null
}

export const shareApi = {
  listFileShareLinks(workspaceId: string, fileId: string) {
    return apiRequest<{ items: ShareLink[] }>(
      `/workspaces/${workspaceId}/files/${fileId}/share-links`,
    ).then((res) => res.items)
  },
  createFileShareLink(
    workspaceId: string,
    fileId: string,
    payload: {
      visibility: ShareVisibility
      permission?: SharePermission
      expiresAt?: string
    },
  ) {
    return apiRequest<ShareLink>(
      `/workspaces/${workspaceId}/files/${fileId}/share-links`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
  },
  revokeFileShareLink(workspaceId: string, fileId: string, shareLinkId: string) {
    return apiRequest<ShareLink>(
      `/workspaces/${workspaceId}/files/${fileId}/share-links/${shareLinkId}/revoke`,
      {
        method: 'POST',
      },
    )
  },
}
