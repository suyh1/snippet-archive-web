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

describe('App delete interactions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(workspaceApi.list).mockResolvedValue([])
  })

  it('uses custom confirm dialog for folder/workspace delete and never uses native confirm', async () => {
    const confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockImplementation(() => true)

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
    store.files = [
      {
        id: 'd1',
        workspaceId: 'w1',
        name: 'docs',
        path: '/docs',
        language: 'plaintext',
        content: '',
        kind: 'folder',
        order: 1,
      },
    ]

    vi.mocked(workspaceApi.deleteFile).mockResolvedValue({ id: 'd1' })
    vi.mocked(workspaceApi.listFiles).mockResolvedValue([])
    vi.mocked(workspaceApi.delete).mockResolvedValue({ id: 'w1' })

    await nextTick()

    await wrapper.find('[data-testid="delete-item"]').trigger('click')
    expect(wrapper.find('[data-testid="confirm-dialog"]').exists()).toBe(true)

    await wrapper.find('[data-testid="confirm-dialog-confirm"]').trigger('click')

    await vi.waitFor(() => {
      expect(workspaceApi.deleteFile).toHaveBeenCalledWith('w1', 'd1')
    })
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="confirm-dialog"]').exists()).toBe(false)
    })

    store.workspaces = [
      {
        id: 'w2',
        title: 'Workspace 2',
        description: '',
        tags: [],
        starred: false,
      },
    ]
    store.currentWorkspaceId = 'w2'
    await nextTick()

    await wrapper.find('.workspace-sidebar .delete-button').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="confirm-dialog"]').exists()).toBe(true)

    await wrapper.find('[data-testid="confirm-dialog-cancel"]').trigger('click')

    expect(confirmSpy).not.toHaveBeenCalled()
  })
})
