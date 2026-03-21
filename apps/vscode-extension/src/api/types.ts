export type AuthUser = {
  id: string
  email: string
  name: string
}

export type AuthSession = {
  accessToken: string
  expiresAt?: string
  user: AuthUser
}

export type Workspace = {
  id: string
  title: string
  description?: string
  tags: string[]
  starred: boolean
}

export type WorkspaceFile = {
  id: string
  name: string
  path: string
  language: string
  content: string
  tags?: string[]
  starred?: boolean
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

export type SearchSnippetsInput = {
  keyword?: string
  language?: string
  tag?: string
  workspaceId?: string
  updatedFrom?: string
  updatedTo?: string
  page?: number
  pageSize?: number
}

export type SearchSnippetsResult = {
  items: SearchSnippet[]
  total: number
  page: number
  pageSize: number
}

export type CreateWorkspaceFileInput = {
  name: string
  path: string
  language: string
  content: string
  tags?: string[]
  starred?: boolean
  kind: string
  order: number
}

export type UpdateWorkspaceFileInput = Partial<
  Pick<WorkspaceFile, 'name' | 'path' | 'language' | 'content' | 'tags' | 'starred' | 'kind' | 'order'>
>

export interface SnippetArchiveApi {
  login(payload: { email: string; password: string }): Promise<AuthSession>
  listWorkspaces(): Promise<Workspace[]>
  listWorkspaceFiles(workspaceId: string): Promise<WorkspaceFile[]>
  createWorkspaceFile(workspaceId: string, payload: CreateWorkspaceFileInput): Promise<WorkspaceFile>
  updateWorkspaceFile(
    workspaceId: string,
    fileId: string,
    payload: UpdateWorkspaceFileInput,
  ): Promise<WorkspaceFile>
  searchSnippets(input: SearchSnippetsInput): Promise<SearchSnippetsResult>
}
