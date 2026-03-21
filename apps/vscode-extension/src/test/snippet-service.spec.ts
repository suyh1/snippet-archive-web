import { describe, expect, it, vi } from 'vitest'
import type { SnippetArchiveApi } from '../api/types'
import { upsertSnippetToWorkspace } from '../core/snippet-service'

function createApiMock(): SnippetArchiveApi {
  return {
    listWorkspaces: vi.fn(),
    listWorkspaceFiles: vi.fn(),
    createWorkspaceFile: vi.fn(),
    updateWorkspaceFile: vi.fn(),
    login: vi.fn(),
    searchSnippets: vi.fn(),
  }
}

describe('upsertSnippetToWorkspace', () => {
  it('creates file when target path does not exist in workspace', async () => {
    const api = createApiMock()

    vi.mocked(api.listWorkspaceFiles).mockResolvedValue([
      {
        id: 'file-1',
        name: 'old.ts',
        path: 'old.ts',
        language: 'typescript',
        content: 'const oldValue = 1',
        order: 3,
        kind: 'file',
      },
    ])

    await upsertSnippetToWorkspace(api, {
      workspaceId: 'workspace-1',
      name: 'new-snippet.ts',
      path: 'snippets/new-snippet.ts',
      language: 'typescript',
      content: 'export const answer = 42',
      tags: ['quick', 'api'],
    })

    expect(api.createWorkspaceFile).toHaveBeenCalledWith('workspace-1', {
      name: 'new-snippet.ts',
      path: 'snippets/new-snippet.ts',
      language: 'typescript',
      content: 'export const answer = 42',
      tags: ['quick', 'api'],
      starred: false,
      kind: 'file',
      order: 4,
    })
    expect(api.updateWorkspaceFile).not.toHaveBeenCalled()
  })

  it('updates file when target path already exists', async () => {
    const api = createApiMock()

    vi.mocked(api.listWorkspaceFiles).mockResolvedValue([
      {
        id: 'file-2',
        name: 'snippet.ts',
        path: 'snippets/existing.ts',
        language: 'typescript',
        content: 'const legacy = true',
        order: 2,
        kind: 'file',
      },
    ])

    await upsertSnippetToWorkspace(api, {
      workspaceId: 'workspace-2',
      name: 'existing.ts',
      path: 'snippets/existing.ts',
      language: 'typescript',
      content: 'export const stable = true',
      tags: ['stable'],
    })

    expect(api.updateWorkspaceFile).toHaveBeenCalledWith(
      'workspace-2',
      'file-2',
      {
        name: 'existing.ts',
        path: 'snippets/existing.ts',
        language: 'typescript',
        content: 'export const stable = true',
        tags: ['stable'],
      },
    )
    expect(api.createWorkspaceFile).not.toHaveBeenCalled()
  })
})
