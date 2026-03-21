import { buildSearchQueryString } from './search-query'
import type {
  AuthSession,
  CreateWorkspaceFileInput,
  SearchSnippetsInput,
  SearchSnippetsResult,
  SnippetArchiveApi,
  UpdateWorkspaceFileInput,
  Workspace,
  WorkspaceFile,
} from './types'

type ApiSuccess<T> = {
  data: T
}

type ApiError = {
  error?: {
    code?: string
    message?: string
  }
}

export class SnippetArchiveClientError extends Error {
  readonly status: number
  readonly code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'SnippetArchiveClientError'
    this.status = status
    this.code = code
  }
}

export class SnippetArchiveClient implements SnippetArchiveApi {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly accessToken?: string,
  ) {}

  async login(payload: { email: string; password: string }) {
    return this.request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    })
  }

  async listWorkspaces() {
    const result = await this.request<{ items: Workspace[] }>('/workspaces')
    return result.items
  }

  async listWorkspaceFiles(workspaceId: string) {
    const result = await this.request<{ items: WorkspaceFile[] }>(
      `/workspaces/${workspaceId}/files`,
    )
    return result.items
  }

  createWorkspaceFile(workspaceId: string, payload: CreateWorkspaceFileInput) {
    return this.request<WorkspaceFile>(`/workspaces/${workspaceId}/files`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  updateWorkspaceFile(
    workspaceId: string,
    fileId: string,
    payload: UpdateWorkspaceFileInput,
  ) {
    return this.request<WorkspaceFile>(`/workspaces/${workspaceId}/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  searchSnippets(input: SearchSnippetsInput): Promise<SearchSnippetsResult> {
    return this.request<SearchSnippetsResult>(
      `/search/snippets${buildSearchQueryString(input)}`,
    )
  }

  private async request<T>(
    path: string,
    options?: {
      method?: string
      body?: string
      skipAuth?: boolean
    },
  ): Promise<T> {
    const headers = new Headers()
    if (options?.body) {
      headers.set('Content-Type', 'application/json')
    }

    if (!options?.skipAuth && this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`)
    }

    const response = await fetch(`${normalizeBaseUrl(this.apiBaseUrl)}${path}`, {
      method: options?.method ?? 'GET',
      headers,
      body: options?.body,
    })

    const payload = (await response.json().catch(() => null)) as
      | ApiSuccess<T>
      | ApiError
      | null

    if (!response.ok) {
      const errorPayload = payload as ApiError | null
      throw new SnippetArchiveClientError(
        response.status,
        errorPayload?.error?.message ?? 'Request failed',
        errorPayload?.error?.code,
      )
    }

    return (payload as ApiSuccess<T>).data
  }
}

function normalizeBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim()
  if (!trimmed) {
    throw new Error('snippetArchive.apiBaseUrl is empty')
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}
