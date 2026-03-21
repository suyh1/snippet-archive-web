import type { SnippetArchiveApi, WorkspaceFile } from '../api/types'

export type UpsertSnippetInput = {
  workspaceId: string
  name: string
  path: string
  language: string
  content: string
  tags?: string[]
}

function normalizeTags(tags?: string[]) {
  if (!tags || tags.length === 0) {
    return undefined
  }

  const unique = new Set<string>()
  for (const tag of tags) {
    const normalized = tag.trim()
    if (normalized.length > 0) {
      unique.add(normalized)
    }
  }

  const items = Array.from(unique)
  return items.length > 0 ? items : undefined
}

function getNextOrder(files: WorkspaceFile[]) {
  if (files.length === 0) {
    return 0
  }

  let maxOrder = 0
  for (const file of files) {
    if (Number.isFinite(file.order) && file.order > maxOrder) {
      maxOrder = file.order
    }
  }

  return maxOrder + 1
}

export async function upsertSnippetToWorkspace(
  api: SnippetArchiveApi,
  input: UpsertSnippetInput,
) {
  const files = await api.listWorkspaceFiles(input.workspaceId)
  const matched = files.find((file) => file.path === input.path)
  const tags = normalizeTags(input.tags)

  if (matched) {
    return api.updateWorkspaceFile(input.workspaceId, matched.id, {
      name: input.name,
      path: input.path,
      language: input.language,
      content: input.content,
      tags,
    })
  }

  return api.createWorkspaceFile(input.workspaceId, {
    name: input.name,
    path: input.path,
    language: input.language,
    content: input.content,
    tags,
    starred: false,
    kind: 'file',
    order: getNextOrder(files),
  })
}
