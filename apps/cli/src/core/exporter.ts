import { BUNDLE_SCHEMA_VERSION, type SnippetBundleV1 } from './bundle-schema'
import type { Workspace, WorkspaceFile } from '../api/types'

export interface SnippetArchiveApiForExport {
  listWorkspaces(): Promise<Workspace[]>
  listWorkspaceFiles(workspaceId: string): Promise<WorkspaceFile[]>
}

export async function buildBundleFromServer(
  api: SnippetArchiveApiForExport,
  options?: {
    workspaceIds?: string[]
  },
): Promise<SnippetBundleV1> {
  const workspaceIdSet = new Set(options?.workspaceIds ?? [])

  const workspaces = await api.listWorkspaces()
  const selected = workspaces.filter((workspace) =>
    workspaceIdSet.size === 0 ? true : workspaceIdSet.has(workspace.id),
  )

  const bundleWorkspaces = []
  for (const workspace of selected) {
    const files = await api.listWorkspaceFiles(workspace.id)
    bundleWorkspaces.push({
      title: workspace.title,
      description: workspace.description ?? '',
      tags: normalizeTags(workspace.tags),
      starred: Boolean(workspace.starred),
      files: files
        .map((file) => normalizeFile(file))
        .sort((left, right) => left.path.localeCompare(right.path)),
    })
  }

  bundleWorkspaces.sort((left, right) => left.title.localeCompare(right.title))

  return {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    workspaces: bundleWorkspaces,
  }
}

function normalizeFile(file: WorkspaceFile) {
  return {
    name: file.name,
    path: file.path,
    language: file.language,
    content: file.content,
    tags: normalizeTags(file.tags),
    starred: Boolean(file.starred),
    kind: file.kind,
    order: Number.isFinite(file.order) ? file.order : 0,
  }
}

function normalizeTags(tags: unknown) {
  if (!Array.isArray(tags)) {
    return []
  }

  return tags
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

