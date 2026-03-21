import type {
  AuthSession,
  SearchSnippetsInput,
  SearchSnippetsResult,
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

export class CliApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'CliApiError'
    this.status = status
    this.code = code
  }
}

export type CliClientOptions = {
  apiBaseUrl: string
  accessToken?: string
}

export class SnippetArchiveCliClient {
  private readonly apiBaseUrl: string
  private readonly accessToken?: string

  constructor(options: CliClientOptions) {
    this.apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl)
    this.accessToken = options.accessToken
  }

  login(payload: { email: string; password: string }) {
    return this.request<AuthSession>('/auth/login', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    })
  }

  async listWorkspaces() {
    const result = await this.request<{ items: Workspace[] }>('/workspaces')
    return result.items
  }

  createWorkspace(payload: {
    title: string
    description: string
    tags: string[]
    starred: boolean
  }) {
    return this.request<Workspace>('/workspaces', {
      method: 'POST',
      body: payload,
    })
  }

  updateWorkspace(
    workspaceId: string,
    payload: {
      description: string
      tags: string[]
      starred: boolean
    },
  ) {
    return this.request<Workspace>(`/workspaces/${workspaceId}`, {
      method: 'PATCH',
      body: payload,
    })
  }

  async listWorkspaceFiles(workspaceId: string) {
    const result = await this.request<{ items: WorkspaceFile[] }>(
      `/workspaces/${workspaceId}/files`,
    )
    return result.items
  }

  createWorkspaceFile(
    workspaceId: string,
    payload: {
      name: string
      path: string
      language: string
      content: string
      tags: string[]
      starred: boolean
      kind: string
      order: number
    },
  ) {
    return this.request<WorkspaceFile>(`/workspaces/${workspaceId}/files`, {
      method: 'POST',
      body: payload,
    })
  }

  updateWorkspaceFile(
    workspaceId: string,
    fileId: string,
    payload: {
      name: string
      path: string
      language: string
      content: string
      tags: string[]
      starred: boolean
      kind: string
      order: number
    },
  ) {
    return this.request<WorkspaceFile>(`/workspaces/${workspaceId}/files/${fileId}`, {
      method: 'PATCH',
      body: payload,
    })
  }

  searchSnippets(input: SearchSnippetsInput) {
    const query = toSearchQuery(input)
    return this.request<SearchSnippetsResult>(`/search/snippets${query}`)
  }

  private async request<T>(
    path: string,
    options?: {
      method?: string
      body?: unknown
      skipAuth?: boolean
    },
  ): Promise<T> {
    const headers = new Headers()

    if (!options?.skipAuth) {
      if (!this.accessToken || this.accessToken.trim().length === 0) {
        throw new Error('Missing access token. Use --token or SNIPPET_ARCHIVE_TOKEN.')
      }
      headers.set('Authorization', `Bearer ${this.accessToken}`)
    }

    if (options?.body !== undefined) {
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: options?.method ?? 'GET',
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    })

    const payload = (await response.json().catch(() => null)) as
      | ApiSuccess<T>
      | ApiError
      | null

    if (!response.ok) {
      const errorPayload = payload as ApiError | null
      throw new CliApiError(
        response.status,
        errorPayload?.error?.message ?? 'Request failed',
        errorPayload?.error?.code,
      )
    }

    return (payload as ApiSuccess<T>).data
  }
}

function normalizeBaseUrl(input: string) {
  const value = input.trim()
  if (!value) {
    throw new Error('Missing API base URL')
  }
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function toSearchQuery(input: SearchSnippetsInput) {
  const params = new URLSearchParams()
  const entries: Array<[string, string | number | undefined]> = [
    ['keyword', input.keyword],
    ['language', input.language],
    ['tag', input.tag],
    ['workspaceId', input.workspaceId],
    ['page', input.page],
    ['pageSize', input.pageSize],
  ]

  for (const [key, value] of entries) {
    if (value === undefined || value === '') {
      continue
    }
    params.set(key, String(value))
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}

