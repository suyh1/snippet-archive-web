// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import App from './App.vue'
import { workspaceApi } from '@/api/workspaces'
import { useWorkspaceStore } from '@/stores/workspace.store'

describe('App auto-save', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    vi.mocked(workspaceApi.list).mockResolvedValue([])
  })

  it('auto-saves dirty active file after debounce', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    mount(App, {
      global: {
        plugins: [pinia],
      },
    })

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

    store.selectFile('f1')
    store.setDraftContent('const a = 2')

    await vi.advanceTimersByTimeAsync(2500)

    expect(workspaceApi.updateFile).toHaveBeenCalledWith('w1', 'f1', {
      content: 'const a = 2',
    })
  })
})
