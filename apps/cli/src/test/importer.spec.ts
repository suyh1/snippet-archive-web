import { describe, expect, it, vi } from 'vitest'
import type { SnippetArchiveApiForSync } from '../core/importer'
import { BUNDLE_SCHEMA_VERSION } from '../core/bundle-schema'
import { syncBundleToServer } from '../core/importer'

function createApiMock(): SnippetArchiveApiForSync {
  return {
    listWorkspaces: vi.fn(),
    createWorkspace: vi.fn(),
    updateWorkspace: vi.fn(),
    listWorkspaceFiles: vi.fn(),
    createWorkspaceFile: vi.fn(),
    updateWorkspaceFile: vi.fn(),
  }
}

describe('syncBundleToServer', () => {
  it('upserts workspace and files by title/path', async () => {
    const api = createApiMock()

    vi.mocked(api.listWorkspaces).mockResolvedValue([
      {
        id: 'ws-existing',
        title: 'Existing Workspace',
        description: 'old',
        tags: [],
        starred: false,
      },
    ])

    vi.mocked(api.listWorkspaceFiles).mockResolvedValue([
      {
        id: 'file-1',
        name: 'legacy.ts',
        path: 'snippets/legacy.ts',
        language: 'typescript',
        content: 'old',
        tags: [],
        starred: false,
        kind: 'file',
        order: 0,
      },
    ])

    vi.mocked(api.createWorkspace).mockResolvedValue({
      id: 'ws-new',
      title: 'New Workspace',
      description: 'new',
      tags: ['new'],
      starred: false,
    })

    const result = await syncBundleToServer(api, {
      schemaVersion: BUNDLE_SCHEMA_VERSION,
      generatedAt: '2026-03-21T00:00:00.000Z',
      workspaces: [
        {
          title: 'Existing Workspace',
          description: 'updated',
          tags: ['team'],
          starred: true,
          files: [
            {
              name: 'legacy.ts',
              path: 'snippets/legacy.ts',
              language: 'typescript',
              content: 'new content',
              tags: ['core'],
              starred: true,
              kind: 'file',
              order: 0,
            },
            {
              name: 'added.ts',
              path: 'snippets/added.ts',
              language: 'typescript',
              content: 'added',
              tags: [],
              starred: false,
              kind: 'file',
              order: 1,
            },
          ],
        },
        {
          title: 'New Workspace',
          description: 'new',
          tags: ['new'],
          starred: false,
          files: [],
        },
      ],
    })

    expect(api.updateWorkspace).toHaveBeenCalledWith('ws-existing', {
      description: 'updated',
      tags: ['team'],
      starred: true,
    })
    expect(api.updateWorkspaceFile).toHaveBeenCalledWith('ws-existing', 'file-1', {
      name: 'legacy.ts',
      path: 'snippets/legacy.ts',
      language: 'typescript',
      content: 'new content',
      tags: ['core'],
      starred: true,
      kind: 'file',
      order: 0,
    })
    expect(api.createWorkspaceFile).toHaveBeenCalledWith('ws-existing', {
      name: 'added.ts',
      path: 'snippets/added.ts',
      language: 'typescript',
      content: 'added',
      tags: [],
      starred: false,
      kind: 'file',
      order: 1,
    })
    expect(api.createWorkspace).toHaveBeenCalledWith({
      title: 'New Workspace',
      description: 'new',
      tags: ['new'],
      starred: false,
    })
    expect(result).toEqual({
      workspacesCreated: 1,
      workspacesUpdated: 1,
      filesCreated: 1,
      filesUpdated: 1,
    })
  })
})
