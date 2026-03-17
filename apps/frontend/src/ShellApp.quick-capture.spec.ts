// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/workspaces', () => {
  return {
    workspaceApi: {
      list: vi.fn(),
      createFile: vi.fn(),
    },
  }
})

import ShellApp from './ShellApp.vue'
import { workspaceApi } from '@/api/workspaces'

const WorkspaceView = defineComponent({
  name: 'WorkspaceView',
  setup() {
    return () => h('div', { 'data-testid': 'workspace-view-stub' }, 'workspace')
  },
})

const SearchView = defineComponent({
  name: 'SearchView',
  setup() {
    return () => h('div', { 'data-testid': 'search-view-stub' }, 'search')
  },
})

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/workspace', component: WorkspaceView },
      { path: '/search', component: SearchView },
      { path: '/favorites', component: SearchView },
      { path: '/team', component: SearchView },
      { path: '/settings', component: SearchView },
      { path: '/', redirect: '/workspace' },
    ],
  })
}

describe('Shell quick capture', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('stays hidden by default and can be opened from icon action', async () => {
    vi.mocked(workspaceApi.list).mockResolvedValue([
      {
        id: 'w1',
        title: 'Quick Capture WS',
        description: '',
        tags: [],
        starred: false,
      },
    ])

    const router = createTestRouter()
    await router.push('/workspace')
    await router.isReady()

    const wrapper = mount(ShellApp, {
      global: {
        plugins: [createPinia(), router],
        stubs: {
          teleport: true,
        },
      },
    })

    expect(wrapper.find('[data-testid="floating-toolbar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="quick-capture-dialog"]').exists()).toBe(false)

    await wrapper.get('[data-testid="toolbar-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="floating-toolbar"]').exists()).toBe(true)

    await wrapper.get('[data-testid="quick-capture-open"]').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="quick-capture-dialog"]').exists()).toBe(true)
    })

    await wrapper.get('[data-testid="quick-capture-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="quick-capture-dialog"]').exists()).toBe(false)

    await wrapper.get('[data-testid="toolbar-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="floating-toolbar"]').exists()).toBe(true)
    window.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="floating-toolbar"]').exists()).toBe(false)
    })
  })

  it('opens toolbar by shortcut and creates snippet then navigates to workspace context', async () => {
    vi.mocked(workspaceApi.list).mockResolvedValue([
      {
        id: 'w1',
        title: 'Quick Capture WS',
        description: '',
        tags: [],
        starred: false,
      },
    ])

    vi.mocked(workspaceApi.createFile).mockResolvedValue({
      id: 'f1',
      workspaceId: 'w1',
      name: 'quick-capture.ts',
      path: '/quick-capture.ts',
      language: 'typescript',
      content: 'const quick = 1',
      tags: ['quick', 'capture'],
      kind: 'file',
      order: 9999,
    })

    const router = createTestRouter()
    await router.push('/search')
    await router.isReady()

    const wrapper = mount(ShellApp, {
      global: {
        plugins: [createPinia(), router],
        stubs: {
          teleport: true,
        },
      },
    })

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'K',
        ctrlKey: true,
        shiftKey: true,
      }),
    )

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="floating-toolbar"]').exists()).toBe(true)
    })
    await wrapper.get('[data-testid="quick-capture-open"]').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="quick-capture-dialog"]').exists()).toBe(true)
    })

    await wrapper.get('[data-testid="quick-capture-name"]').setValue('quick-capture')
    await wrapper.get('[data-testid="quick-capture-language"]').setValue('typescript')
    await wrapper.get('[data-testid="quick-capture-tags"]').setValue('quick, capture')
    await wrapper.get('[data-testid="quick-capture-content"]').setValue('const quick = 1')

    await wrapper.get('[data-testid="quick-capture-submit"]').trigger('click')

    await vi.waitFor(() => {
      expect(workspaceApi.createFile).toHaveBeenCalledWith('w1', {
        name: 'quick-capture.ts',
        path: '/quick-capture.ts',
        language: 'typescript',
        content: 'const quick = 1',
        tags: ['quick', 'capture'],
        kind: 'file',
        order: 9999,
      })
    })

    await vi.waitFor(() => {
      expect(router.currentRoute.value.path).toBe('/workspace')
    })
    expect(router.currentRoute.value.query).toMatchObject({
      workspaceId: 'w1',
      fileId: 'f1',
    })
  })
})
