export type AuthSession = {
  accessToken: string
  expiresAt?: string
  user: {
    id: string
    email: string
    name: string
  }
}

export type Workspace = {
  id: string
  title: string
  description: string
  tags: string[]
  starred: boolean
}

export type WorkspaceFile = {
  id: string
  name: string
  path: string
  language: string
  content: string
  tags: string[]
  starred: boolean
  kind: string
  order: number
}

export type SearchSnippet = {
  id: string
  workspaceId: string
  workspaceTitle: string
  name: string
  path: string
  language: string
  tags: string[]
  content: string
  updatedAt: string
}

export type SearchSnippetsResult = {
  items: SearchSnippet[]
  total: number
  page: number
  pageSize: number
}

export type SearchSnippetsInput = {
  keyword?: string
  language?: string
  tag?: string
  workspaceId?: string
  page?: number
  pageSize?: number
}

