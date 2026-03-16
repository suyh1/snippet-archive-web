// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/search', () => {
  return {
    searchApi: {
      searchSnippets: vi.fn(),
    },
  }
})

import SearchPage from '@/pages/SearchPage.vue'
import { searchApi } from '@/api/search'

describe('SearchPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
  })

  it('supports click + keyboard search and reset flow', async () => {
    vi.mocked(searchApi.searchSnippets).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/search', component: SearchPage },
      ],
    })
    await router.push('/search')
    await router.isReady()

    const wrapper = mount(SearchPage, {
      global: {
        plugins: [createPinia(), router],
      },
    })

    await wrapper.get('[data-testid="search-keyword-input"]').setValue('token')
    await wrapper.get('[data-testid="search-keyword-input"]').trigger('keydown.enter')

    expect(searchApi.searchSnippets).toHaveBeenCalledTimes(1)

    await wrapper.get('[data-testid="search-clear"]').trigger('click')
    expect((wrapper.get('[data-testid="search-keyword-input"]').element as HTMLInputElement).value).toBe('')

    await wrapper.get('[data-testid="search-keyword-input"]').setValue('abc')
    await wrapper.get('[data-testid="search-keyword-input"]').trigger('keydown.esc')
    expect((wrapper.get('[data-testid="search-keyword-input"]').element as HTMLInputElement).value).toBe('')
  })

  it('navigates to workspace route when opening result item', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/search', component: SearchPage },
        { path: '/workspace', component: { template: '<div>workspace</div>' } },
      ],
    })

    await router.push('/search')
    await router.isReady()

    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(SearchPage, {
      global: {
        plugins: [pinia, router],
      },
    })

    const { useSearchStore } = await import('@/stores/search.store')
    const store = useSearchStore()
    store.items = [
      {
        id: 'f1',
        workspaceId: 'w1',
        workspaceTitle: 'Workspace 1',
        workspaceTags: ['backend'],
        workspaceStarred: false,
        name: 'token.ts',
        path: '/src/token.ts',
        language: 'typescript',
        tags: ['backend'],
        content: 'const token = process.env.API_TOKEN',
        updatedAt: '2026-03-16T00:00:00.000Z',
      },
    ]
    store.total = 1

    await vi.waitFor(() => {
      expect(wrapper.findAll('[data-testid="search-result-item"]')).toHaveLength(1)
    })
    await wrapper.get('[data-testid="search-result-open"]').trigger('click')

    await vi.waitFor(() => {
      expect(router.currentRoute.value.path).toBe('/workspace')
    })
    expect(router.currentRoute.value.query.workspaceId).toBe('w1')
    expect(router.currentRoute.value.query.fileId).toBe('f1')
  })
})
