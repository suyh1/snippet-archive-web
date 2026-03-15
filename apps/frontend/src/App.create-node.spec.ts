// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
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

describe('App create node dialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(workspaceApi.list).mockResolvedValue([])
  })

  it('creates file through custom dialog flow', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(App, {
      global: {
        plugins: [pinia],
      },
    })

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
    store.files = []

    vi.mocked(workspaceApi.createFile).mockResolvedValue({
      id: 'f1',
      workspaceId: 'w1',
      name: 'main.ts',
      path: '/main.ts',
      language: 'typescript',
      content: '',
      kind: 'file',
      order: 1,
    })
    vi.mocked(workspaceApi.listFiles).mockResolvedValue([
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
    ])

    await nextTick()

    await wrapper.find('[data-testid="create-file-root"]').trigger('click')
    expect(wrapper.find('[data-testid="create-node-dialog"]').exists()).toBe(true)

    await wrapper.find('[data-testid="create-node-input"]').setValue('main.ts')
    await wrapper.find('[data-testid="create-node-confirm"]').trigger('click')

    await vi.waitFor(() => {
      expect(workspaceApi.createFile).toHaveBeenCalled()
    })
  })
})
