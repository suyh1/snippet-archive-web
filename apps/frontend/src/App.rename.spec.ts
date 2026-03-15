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

describe('App inline rename', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(workspaceApi.list).mockResolvedValue([])
  })

  async function mountWithFiles() {
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
        id: 'f1',
        workspaceId: 'w1',
        name: 'main.ts',
        path: '/main.ts',
        language: 'typescript',
        content: '',
        kind: 'file',
        order: 1,
      },
      {
        id: 'f2',
        workspaceId: 'w1',
        name: 'utils.ts',
        path: '/utils.ts',
        language: 'typescript',
        content: '',
        kind: 'file',
        order: 2,
      },
    ]

    await nextTick()

    return { wrapper, store }
  }

  it('shows sibling conflict validation and blocks submit', async () => {
    const { wrapper } = await mountWithFiles()

    await wrapper.findAll('[data-testid="rename-item"]')[0].trigger('click')

    const input = wrapper.find('[data-testid="rename-inline-input"]')
    await input.setValue('utils.ts')
    await input.trigger('blur')

    expect(wrapper.find('[data-testid="rename-inline-error"]').text()).toContain(
      '同级目录下已存在同名项。',
    )
    expect(workspaceApi.moveFile).not.toHaveBeenCalled()
  })

  it('submits valid rename through move api', async () => {
    const { wrapper } = await mountWithFiles()

    vi.mocked(workspaceApi.moveFile).mockResolvedValue({
      id: 'f1',
      workspaceId: 'w1',
      name: 'feature.ts',
      path: '/feature.ts',
      language: 'typescript',
      content: '',
      kind: 'file',
      order: 1,
    })
    vi.mocked(workspaceApi.updateFile).mockResolvedValue({
      id: 'f1',
      workspaceId: 'w1',
      name: 'feature.ts',
      path: '/feature.ts',
      language: 'typescript',
      content: '',
      kind: 'file',
      order: 1,
    })

    vi.mocked(workspaceApi.listFiles).mockResolvedValue([
      {
        id: 'f1',
        workspaceId: 'w1',
        name: 'feature.ts',
        path: '/feature.ts',
        language: 'typescript',
        content: '',
        kind: 'file',
        order: 1,
      },
      {
        id: 'f2',
        workspaceId: 'w1',
        name: 'utils.ts',
        path: '/utils.ts',
        language: 'typescript',
        content: '',
        kind: 'file',
        order: 2,
      },
    ])

    await wrapper.findAll('[data-testid="rename-item"]')[0].trigger('click')

    const input = wrapper.find('[data-testid="rename-inline-input"]')
    await input.setValue('feature.ts')
    await input.trigger('blur')

    await vi.waitFor(() => {
      expect(workspaceApi.moveFile).toHaveBeenCalledWith('w1', 'f1', {
        targetPath: '/feature.ts',
        targetOrder: 1,
      })
      expect(workspaceApi.updateFile).toHaveBeenCalledWith('w1', 'f1', {
        name: 'feature.ts',
      })
    })

    await vi.waitFor(() => {
      expect(wrapper.findAll('.name')[0]?.text()).toBe('feature.ts')
    })
  })
})
