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

const workspaceA = {
  id: 'w1',
  title: 'Workspace 1',
  description: '',
  tags: [],
  starred: false,
}

const workspaceB = {
  id: 'w2',
  title: 'Workspace 2',
  description: '',
  tags: [],
  starred: false,
}

const fileA = {
  id: 'f1',
  workspaceId: 'w1',
  name: 'main.ts',
  path: '/main.ts',
  language: 'typescript',
  content: 'console.log(1)',
  kind: 'file',
  order: 1,
}

const fileB = {
  id: 'f2',
  workspaceId: 'w1',
  name: 'utils.ts',
  path: '/utils.ts',
  language: 'typescript',
  content: 'export {}',
  kind: 'file',
  order: 2,
}

describe('App unsaved guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(workspaceApi.list).mockResolvedValue([])
  })

  async function mountWithDirtyState() {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(App, {
      global: {
        plugins: [pinia],
      },
    })

    const store = useWorkspaceStore()
    store.workspaces = [workspaceA, workspaceB]
    store.currentWorkspaceId = workspaceA.id
    store.files = [fileA, fileB]
    store.activeFileId = fileA.id
    store.draftContent = 'console.log(2)'
    store.dirty = true

    await nextTick()

    return { wrapper, store }
  }

  it('shows unsaved dialog and keeps context on cancel', async () => {
    const { wrapper, store } = await mountWithDirtyState()

    await wrapper.find('.library-button').trigger('click')

    expect(wrapper.find('[data-testid="unsaved-dialog"]').exists()).toBe(true)

    await wrapper.find('[data-testid="unsaved-cancel"]').trigger('click')

    expect(store.currentWorkspaceId).toBe('w1')
  })

  it('switches to library when choosing discard', async () => {
    const { wrapper, store } = await mountWithDirtyState()

    await wrapper.find('.library-button').trigger('click')
    await wrapper.find('[data-testid="unsaved-discard"]').trigger('click')

    expect(store.currentWorkspaceId).toBeNull()
    expect(store.activeFileId).toBeNull()
  })

  it('saves then continues when choosing save', async () => {
    const { wrapper, store } = await mountWithDirtyState()

    vi.mocked(workspaceApi.updateFile).mockResolvedValue({
      ...fileA,
      content: 'console.log(2)',
    })
    vi.mocked(workspaceApi.listFiles).mockResolvedValue([
      {
        ...fileA,
        content: 'console.log(2)',
      },
      fileB,
    ])

    await wrapper.find('.library-button').trigger('click')
    await wrapper.find('[data-testid="unsaved-save"]').trigger('click')

    await vi.waitFor(() => {
      expect(workspaceApi.updateFile).toHaveBeenCalledWith('w1', 'f1', {
        content: 'console.log(2)',
      })
    })

    await vi.waitFor(() => {
      expect(store.currentWorkspaceId).toBeNull()
    })
  })

  it('prompts when switching file and applies switch on discard', async () => {
    const { wrapper, store } = await mountWithDirtyState()

    const rows = wrapper.findAll('.row-main')
    await rows[1].trigger('click')

    expect(wrapper.find('[data-testid="unsaved-dialog"]').exists()).toBe(true)

    await wrapper.find('[data-testid="unsaved-discard"]').trigger('click')

    expect(store.activeFileId).toBe('f2')
  })
})
