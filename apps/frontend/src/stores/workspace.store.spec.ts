import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/workspaces', () => {
  return {
    workspaceApi: {
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(),
      listFiles: vi.fn(),
      listFileRevisions: vi.fn(),
      createFile: vi.fn(),
      moveFile: vi.fn(),
      updateFile: vi.fn(),
      restoreFileRevision: vi.fn(),
      deleteFile: vi.fn(),
    },
  }
})

import { workspaceApi } from '@/api/workspaces'
import { ApiClientError } from '@/api/http'
import { useWorkspaceStore } from './workspace.store'

describe('workspace store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads workspace list from API', async () => {
    vi.mocked(workspaceApi.list).mockResolvedValue([
      {
        id: 'w1',
        title: 'Workspace 1',
        description: '',
        tags: [],
        starred: false,
      },
    ])

    const store = useWorkspaceStore()
    await store.loadWorkspaces()

    expect(store.workspaces).toHaveLength(1)
    expect(store.workspaces[0]?.id).toBe('w1')
  })

  it('creates workspace and opens it', async () => {
    vi.mocked(workspaceApi.create).mockResolvedValue({
      id: 'w-new',
      title: 'New Workspace',
      description: '',
      tags: [],
      starred: false,
    })

    vi.mocked(workspaceApi.listFiles).mockResolvedValue([])

    const store = useWorkspaceStore()
    await store.createWorkspace('New Workspace')

    expect(store.workspaces.some((item) => item.id === 'w-new')).toBe(true)
    expect(store.currentWorkspaceId).toBe('w-new')
  })

  it('deletes active workspace and falls back to library state', async () => {
    const store = useWorkspaceStore()
    store.workspaces = [
      {
        id: 'w1',
        title: 'Workspace 1',
        description: '',
        tags: [],
        starred: false,
      },
    ]
    store.currentWorkspaceId = 'w1'

    vi.mocked(workspaceApi.delete).mockResolvedValue({ id: 'w1' })

    await store.deleteWorkspace('w1')

    expect(store.workspaces).toHaveLength(0)
    expect(store.currentWorkspaceId).toBe(null)
  })

  it('saves current file content through updateFile api', async () => {
    const store = useWorkspaceStore()
    store.currentWorkspaceId = 'w1'
    store.files = [
      {
        id: 'f1',
        workspaceId: 'w1',
        name: 'main.ts',
        path: '/main.ts',
        language: 'typescript',
        content: 'console.log(1)',
        kind: 'file',
        order: 1,
      },
    ]
    store.activeFileId = 'f1'
    store.draftContent = 'console.log(2)'
    store.draftLanguage = 'typescript'
    store.dirty = true

    vi.mocked(workspaceApi.updateFile).mockResolvedValue({
      ...store.files[0],
      content: 'console.log(2)',
    })
    vi.mocked(workspaceApi.listFiles).mockResolvedValue([
      {
        ...store.files[0],
        content: 'console.log(2)',
      },
    ])

    await store.saveCurrentFile()

    expect(workspaceApi.updateFile).toHaveBeenCalledWith('w1', 'f1', {
      content: 'console.log(2)',
      language: 'typescript',
    })
    expect(store.dirty).toBe(false)
  })

  it('allows manual language override on files with known suffix', async () => {
    const store = useWorkspaceStore()
    store.currentWorkspaceId = 'w1'
    store.files = [
      {
        id: 'f1',
        workspaceId: 'w1',
        name: 'main.ts',
        path: '/main.ts',
        language: 'typescript',
        content: 'console.log(1)',
        kind: 'file',
        order: 1,
      },
    ]

    store.selectFile('f1')
    store.setDraftLanguage('html')

    expect(store.draftLanguage).toBe('html')
    expect(store.dirty).toBe(true)
  })

  it('renames active file suffix when manual language changes', async () => {
    const store = useWorkspaceStore()
    store.currentWorkspaceId = 'w1'
    store.files = [
      {
        id: 'f1',
        workspaceId: 'w1',
        name: 'main.ts',
        path: '/main.ts',
        language: 'typescript',
        content: 'console.log(1)',
        kind: 'file',
        order: 1,
      },
    ]
    store.activeFileId = 'f1'
    store.draftContent = 'console.log(1)'
    store.draftLanguage = 'typescript'

    vi.mocked(workspaceApi.moveFile).mockResolvedValue({
      ...store.files[0],
      name: 'main.html',
      path: '/main.html',
      language: 'html',
    })
    vi.mocked(workspaceApi.updateFile).mockResolvedValue({
      ...store.files[0],
      name: 'main.html',
      path: '/main.html',
      language: 'html',
    })
    vi.mocked(workspaceApi.listFiles).mockResolvedValue([
      {
        ...store.files[0],
        name: 'main.html',
        path: '/main.html',
        language: 'html',
      },
    ])

    await store.applyActiveFileLanguagePreference('html')

    expect(workspaceApi.moveFile).toHaveBeenCalledWith('w1', 'f1', {
      targetPath: '/main.html',
      targetOrder: 1,
    })
    expect(workspaceApi.updateFile).toHaveBeenCalledWith('w1', 'f1', {
      name: 'main.html',
      language: 'html',
    })
  })

  it('renames file by move api', async () => {
    const store = useWorkspaceStore()
    store.currentWorkspaceId = 'w1'
    store.files = [
      {
        id: 'f1',
        workspaceId: 'w1',
        name: 'main.ts',
        path: '/src/main.ts',
        language: 'typescript',
        content: '',
        kind: 'file',
        order: 1,
      },
    ]

    vi.mocked(workspaceApi.moveFile).mockResolvedValue({
      ...store.files[0],
      name: 'entry.ts',
      path: '/src/entry.ts',
    })
    vi.mocked(workspaceApi.updateFile).mockResolvedValue({
      ...store.files[0],
      name: 'entry.ts',
      path: '/src/entry.ts',
    })
    vi.mocked(workspaceApi.listFiles).mockResolvedValue([
      {
        ...store.files[0],
        name: 'entry.ts',
        path: '/src/entry.ts',
      },
    ])

    await store.renameFile('f1', 'entry.ts')

    expect(workspaceApi.moveFile).toHaveBeenCalledWith('w1', 'f1', {
      targetPath: '/src/entry.ts',
      targetOrder: 1,
    })
    expect(workspaceApi.updateFile).toHaveBeenCalledWith('w1', 'f1', {
      name: 'entry.ts',
      language: 'typescript',
    })
  })

  it('updates language by suffix when renaming to a known extension', async () => {
    const store = useWorkspaceStore()
    store.currentWorkspaceId = 'w1'
    store.files = [
      {
        id: 'f1',
        workspaceId: 'w1',
        name: 'scratch',
        path: '/scratch',
        language: 'plaintext',
        content: '',
        kind: 'file',
        order: 1,
      },
    ]

    vi.mocked(workspaceApi.moveFile).mockResolvedValue({
      ...store.files[0],
      name: 'notes.md',
      path: '/notes.md',
    })
    vi.mocked(workspaceApi.updateFile).mockResolvedValue({
      ...store.files[0],
      name: 'notes.md',
      path: '/notes.md',
      language: 'markdown',
    })
    vi.mocked(workspaceApi.listFiles).mockResolvedValue([
      {
        ...store.files[0],
        name: 'notes.md',
        path: '/notes.md',
        language: 'markdown',
      },
    ])

    await store.renameFile('f1', 'notes.md')

    expect(workspaceApi.updateFile).toHaveBeenCalledWith('w1', 'f1', {
      name: 'notes.md',
      language: 'markdown',
    })
  })

  it('deletes selected file and clears active selection', async () => {
    const store = useWorkspaceStore()
    store.currentWorkspaceId = 'w1'
    store.files = [
      {
        id: 'f1',
        workspaceId: 'w1',
        name: 'main.ts',
        path: '/main.ts',
        language: 'typescript',
        content: '',
        kind: 'file',
        order: 1,
      },
    ]
    store.activeFileId = 'f1'

    vi.mocked(workspaceApi.deleteFile).mockResolvedValue({ id: 'f1' })
    vi.mocked(workspaceApi.listFiles).mockResolvedValue([])

    await store.deleteFile('f1')

    expect(workspaceApi.deleteFile).toHaveBeenCalledWith('w1', 'f1')
    expect(store.activeFileId).toBe(null)
  })

  it('maps conflict error to friendly message when creating workspace', async () => {
    vi.mocked(workspaceApi.create).mockRejectedValue(
      new ApiClientError(409, 'Path already exists', 'CONFLICT'),
    )

    const store = useWorkspaceStore()
    await store.createWorkspace('Workspace 1')

    expect(store.errorMessage).toBe('名称或路径已存在，请修改后重试。')
  })

  it('loads active file revisions from api', async () => {
    const store = useWorkspaceStore()
    store.currentWorkspaceId = 'w1'
    store.files = [
      {
        id: 'f1',
        workspaceId: 'w1',
        name: 'main.ts',
        path: '/main.ts',
        language: 'typescript',
        content: 'const version = 3',
        kind: 'file',
        order: 1,
      },
    ]
    store.activeFileId = 'f1'

    vi.mocked(workspaceApi.listFileRevisions).mockResolvedValue([
      {
        id: 'r1',
        workspaceId: 'w1',
        fileId: 'f1',
        language: 'typescript',
        content: 'const version = 3',
        source: 'update',
        summary: 'Updated: const version = 3',
        createdAt: '2026-03-16T12:00:00.000Z',
      },
    ])

    const revisions = await store.listActiveFileRevisions()

    expect(workspaceApi.listFileRevisions).toHaveBeenCalledWith('w1', 'f1')
    expect(revisions).toHaveLength(1)
    expect(revisions[0]?.id).toBe('r1')
  })

  it('restores active file revision and syncs editor draft', async () => {
    const store = useWorkspaceStore()
    store.currentWorkspaceId = 'w1'
    store.files = [
      {
        id: 'f1',
        workspaceId: 'w1',
        name: 'main.ts',
        path: '/main.ts',
        language: 'javascript',
        content: 'const version = 3',
        kind: 'file',
        order: 1,
      },
    ]
    store.activeFileId = 'f1'
    store.draftContent = 'const version = 3'
    store.draftLanguage = 'javascript'
    store.dirty = true

    vi.mocked(workspaceApi.restoreFileRevision).mockResolvedValue({
      id: 'f1',
      workspaceId: 'w1',
      name: 'main.ts',
      path: '/main.ts',
      language: 'typescript',
      content: 'const version = 2',
      kind: 'file',
      order: 1,
    })

    const restored = await store.restoreActiveFileRevision('r2')

    expect(restored).toBe(true)
    expect(workspaceApi.restoreFileRevision).toHaveBeenCalledWith('w1', 'f1', 'r2')
    expect(store.files[0]?.content).toBe('const version = 2')
    expect(store.draftContent).toBe('const version = 2')
    expect(store.draftLanguage).toBe('typescript')
    expect(store.dirty).toBe(false)
  })
})
