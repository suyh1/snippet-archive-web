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

describe('App empty states', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(workspaceApi.list).mockResolvedValue([])
  })

  it('shows guided library empty message', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(App, {
      global: {
        plugins: [pinia],
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain(
        '还没有任何工作区，先从左侧「新建」创建第一个工作区。',
      )
    })
  })

  it('shows guided editor empty message in workspace mode', async () => {
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
    store.activeFileId = null

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('先在左侧创建或选择文件，然后开始编辑。')
    })
  })
})
