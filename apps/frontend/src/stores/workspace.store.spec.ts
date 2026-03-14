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
    },
  }
})

import { workspaceApi } from '@/api/workspaces'
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
})
