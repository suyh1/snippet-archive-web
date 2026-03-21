import type { SnippetBundleV1 } from './bundle-schema'

export type WorkspaceSummary = {
  id: string
  title: string
  description: string
  tags: string[]
  starred: boolean
}

export type WorkspaceFileSummary = {
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

export interface SnippetArchiveApiForSync {
  listWorkspaces(): Promise<WorkspaceSummary[]>
  createWorkspace(payload: {
    title: string
    description: string
    tags: string[]
    starred: boolean
  }): Promise<WorkspaceSummary>
  updateWorkspace(
    workspaceId: string,
    payload: {
      description: string
      tags: string[]
      starred: boolean
    },
  ): Promise<WorkspaceSummary>
  listWorkspaceFiles(workspaceId: string): Promise<WorkspaceFileSummary[]>
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
  ): Promise<WorkspaceFileSummary>
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
  ): Promise<WorkspaceFileSummary>
}

export type SyncSummary = {
  workspacesCreated: number
  workspacesUpdated: number
  filesCreated: number
  filesUpdated: number
}

export async function syncBundleToServer(
  api: SnippetArchiveApiForSync,
  bundle: SnippetBundleV1,
): Promise<SyncSummary> {
  const summary: SyncSummary = {
    workspacesCreated: 0,
    workspacesUpdated: 0,
    filesCreated: 0,
    filesUpdated: 0,
  }

  const existingWorkspaces = await api.listWorkspaces()
  const workspaceByTitle = new Map(existingWorkspaces.map((item) => [item.title, item]))

  for (const workspace of bundle.workspaces) {
    let workspaceRecord = workspaceByTitle.get(workspace.title)

    if (!workspaceRecord) {
      workspaceRecord = await api.createWorkspace({
        title: workspace.title,
        description: workspace.description,
        tags: workspace.tags,
        starred: workspace.starred,
      })
      workspaceByTitle.set(workspaceRecord.title, workspaceRecord)
      summary.workspacesCreated += 1
    } else {
      await api.updateWorkspace(workspaceRecord.id, {
        description: workspace.description,
        tags: workspace.tags,
        starred: workspace.starred,
      })
      summary.workspacesUpdated += 1
    }

    const currentFiles = await api.listWorkspaceFiles(workspaceRecord.id)
    const fileByPath = new Map(currentFiles.map((item) => [item.path, item]))

    for (const file of workspace.files) {
      const existingFile = fileByPath.get(file.path)
      if (existingFile) {
        await api.updateWorkspaceFile(workspaceRecord.id, existingFile.id, {
          name: file.name,
          path: file.path,
          language: file.language,
          content: file.content,
          tags: file.tags,
          starred: file.starred,
          kind: file.kind,
          order: file.order,
        })
        summary.filesUpdated += 1
      } else {
        await api.createWorkspaceFile(workspaceRecord.id, {
          name: file.name,
          path: file.path,
          language: file.language,
          content: file.content,
          tags: file.tags,
          starred: file.starred,
          kind: file.kind,
          order: file.order,
        })
        summary.filesCreated += 1
      }
    }
  }

  return summary
}
