// @vitest-environment happy-dom
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
import { useWorkspaceStore } from './workspace.store'

describe('workspace store draft cache', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
  })

  it('restores cached draft content when selecting file again', () => {
    const store = useWorkspaceStore()
    store.currentWorkspaceId = 'w1'
    store.files = [
      {
        id: 'f1',
        workspaceId: 'w1',
        name: 'main.ts',
        path: '/main.ts',
        language: 'typescript',
        content: 'const a = 1',
        kind: 'file',
        order: 1,
      },
    ]

    store.selectFile('f1')
    store.setDraftContent('const a = 2')

    expect(store.dirty).toBe(true)

    const storeReloaded = useWorkspaceStore()
    storeReloaded.currentWorkspaceId = 'w1'
    storeReloaded.files = [
      {
        id: 'f1',
        workspaceId: 'w1',
        name: 'main.ts',
        path: '/main.ts',
        language: 'typescript',
        content: 'const a = 1',
        kind: 'file',
        order: 1,
      },
    ]

    storeReloaded.selectFile('f1')

    expect(storeReloaded.draftContent).toBe('const a = 2')
    expect(storeReloaded.dirty).toBe(true)
  })

  it('clears cached draft after successful save', async () => {
    const store = useWorkspaceStore()
    store.currentWorkspaceId = 'w1'
    store.files = [
      {
        id: 'f1',
        workspaceId: 'w1',
        name: 'main.ts',
        path: '/main.ts',
        language: 'typescript',
        content: 'const a = 1',
        kind: 'file',
        order: 1,
      },
    ]

    store.selectFile('f1')
    store.setDraftContent('const a = 2')

    vi.mocked(workspaceApi.updateFile).mockResolvedValue({
      ...store.files[0],
      content: 'const a = 2',
    })
    vi.mocked(workspaceApi.listFiles).mockResolvedValue([
      {
        ...store.files[0],
        content: 'const a = 2',
      },
    ])

    await store.saveCurrentFile()

    const storeReloaded = useWorkspaceStore()
    storeReloaded.currentWorkspaceId = 'w1'
    storeReloaded.files = [
      {
        id: 'f1',
        workspaceId: 'w1',
        name: 'main.ts',
        path: '/main.ts',
        language: 'typescript',
        content: 'const a = 2',
        kind: 'file',
        order: 1,
      },
    ]

    storeReloaded.selectFile('f1')

    expect(storeReloaded.dirty).toBe(false)
    expect(storeReloaded.draftContent).toBe('const a = 2')
  })
})
