export type Workspace = {
  id: string
  title: string
  description: string
  tags: string[]
  starred: boolean
  createdAt?: string
  updatedAt?: string
  lastOpenedAt?: string | null
}

export type WorkspaceFile = {
  id: string
  workspaceId: string
  name: string
  path: string
  language: string
  content: string
  tags?: string[]
  starred?: boolean
  kind: string
  order: number
  createdAt?: string
  updatedAt?: string
}

export type WorkspaceFileRevisionSource = 'update' | 'restore'

export type WorkspaceFileRevision = {
  id: string
  workspaceId: string
  fileId: string
  language: string
  content: string
  source: WorkspaceFileRevisionSource
  summary: string
  createdAt: string
}

export type CreateWorkspaceInput = {
  title: string
  description?: string
  tags?: string[]
  starred?: boolean
}

export type CreateWorkspaceFileInput = {
  name: string
  path: string
  language: string
  content?: string
  tags?: string[]
  starred?: boolean
  kind: string
  order: number
}

export type MoveWorkspaceFileInput = {
  targetPath: string
  targetOrder?: number
}

export type SearchSnippet = {
  id: string
  workspaceId: string
  workspaceTitle: string
  workspaceTags: string[]
  workspaceStarred: boolean
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

export type FavoriteItem = {
  type: 'workspace' | 'file'
  id: string
  workspaceId: string
  workspaceTitle: string
  title: string
  path: string | null
  language: string | null
  tags: string[]
  starredAt: string
}

export type FavoritesResult = {
  items: FavoriteItem[]
  total: number
  page: number
  pageSize: number
}

export type EditorSnapshotSource = 'manual' | 'format'

export type EditorSnapshot = {
  id: string
  workspaceId: string
  fileId: string
  content: string
  language: string
  source: EditorSnapshotSource
  createdAt: number
}
