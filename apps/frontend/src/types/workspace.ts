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
  kind: string
  order: number
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
  kind: string
  order: number
}

export type MoveWorkspaceFileInput = {
  targetPath: string
  targetOrder?: number
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
