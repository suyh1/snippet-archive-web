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

import { useWorkspaceStore } from './workspace.store'

describe('workspace store snapshots', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
  })

  function createReadyStore() {
    const store = useWorkspaceStore()
    store.currentWorkspaceId = 'w1'
    store.files = [
      {
        id: 'f1',
        workspaceId: 'w1',
        name: 'main.ts',
        path: '/main.ts',
        language: 'typescript',
        content: 'const value = 1',
        kind: 'file',
        order: 1,
      },
    ]
    store.selectFile('f1')
    return store
  }

  it('creates snapshots and lists active file snapshots', () => {
    const store = createReadyStore()

    store.setDraftContent('const value = 2')
    const snapshot = store.createSnapshotForActiveFile('manual')

    expect(snapshot).toBeTruthy()

    const snapshots = store.getActiveFileSnapshots()
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.content).toBe('const value = 2')
    expect(snapshots[0]?.source).toBe('manual')
  })

  it('restores snapshot content and language', () => {
    const store = createReadyStore()

    store.setDraftContent('const value = 2')
    store.setDraftLanguage('typescript')
    const created = store.createSnapshotForActiveFile('manual')

    store.setDraftContent('{"x":1}')
    store.setDraftLanguage('json')

    const restored = store.restoreSnapshotForActiveFile(created!.id)

    expect(restored).toBe(true)
    expect(store.draftContent).toBe('const value = 2')
    expect(store.draftLanguage).toBe('typescript')
  })
})
