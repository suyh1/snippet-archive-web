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
      createFile: vi.fn(),
      moveFile: vi.fn(),
      updateFile: vi.fn(),
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
})
