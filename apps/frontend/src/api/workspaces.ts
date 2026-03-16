import { apiRequest } from './http'
import type {
  CreateWorkspaceFileInput,
  CreateWorkspaceInput,
  MoveWorkspaceFileInput,
  Workspace,
  WorkspaceFile,
} from '@/types/workspace'

export const workspaceApi = {
  list() {
    return apiRequest<{ items: Workspace[] }>('/workspaces').then((res) => res.items)
  },
  get(workspaceId: string) {
    return apiRequest<Workspace>(`/workspaces/${workspaceId}`)
  },
  create(payload: CreateWorkspaceInput) {
    return apiRequest<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  update(workspaceId: string, payload: Partial<CreateWorkspaceInput>) {
    return apiRequest<Workspace>(`/workspaces/${workspaceId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
  delete(workspaceId: string) {
    return apiRequest<{ id: string }>(`/workspaces/${workspaceId}`, {
      method: 'DELETE',
    })
  },
  listFiles(workspaceId: string) {
    return apiRequest<{ items: WorkspaceFile[] }>(
      `/workspaces/${workspaceId}/files`,
    ).then((res) => res.items)
  },
  createFile(workspaceId: string, payload: CreateWorkspaceFileInput) {
    return apiRequest<WorkspaceFile>(`/workspaces/${workspaceId}/files`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  updateFile(
    workspaceId: string,
    fileId: string,
    payload: Partial<Pick<WorkspaceFile, 'name' | 'path' | 'language' | 'content' | 'tags' | 'starred' | 'kind' | 'order'>>,
  ) {
    return apiRequest<WorkspaceFile>(`/workspaces/${workspaceId}/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
  moveFile(
    workspaceId: string,
    fileId: string,
    payload: MoveWorkspaceFileInput,
  ) {
    return apiRequest<WorkspaceFile>(
      `/workspaces/${workspaceId}/files/${fileId}/move`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    )
  },
  deleteFile(workspaceId: string, fileId: string) {
    return apiRequest<{ id: string }>(`/workspaces/${workspaceId}/files/${fileId}`, {
      method: 'DELETE',
    })
  },
}
