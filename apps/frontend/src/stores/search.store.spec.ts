// @vitest-environment happy-dom
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/search', () => {
  return {
    searchApi: {
      searchSnippets: vi.fn(),
    },
  }
})

import { searchApi } from '@/api/search'
import { useSearchStore } from '@/stores/search.store'

describe('search.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
  })

  it('runs snippet search with keyword and updates result state', async () => {
    vi.mocked(searchApi.searchSnippets).mockResolvedValue({
      items: [
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
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    })

    const store = useSearchStore()
    store.keyword = 'token'

    await store.runSearch()

    expect(searchApi.searchSnippets).toHaveBeenCalledWith({
      keyword: 'token',
      language: '',
      tag: '',
      workspaceId: '',
      updatedFrom: '',
      updatedTo: '',
      page: 1,
      pageSize: 20,
    })
    expect(store.total).toBe(1)
    expect(store.items).toHaveLength(1)
    expect(store.items[0].name).toBe('token.ts')
  })

  it('saves and re-applies query preset', () => {
    const store = useSearchStore()
    store.keyword = 'auth'
    store.language = 'typescript'
    store.tag = 'backend'

    store.savePreset('backend-auth')

    expect(store.presets).toHaveLength(1)
    expect(store.presets[0].name).toBe('backend-auth')

    store.keyword = ''
    store.language = ''
    store.tag = ''

    store.applyPreset(store.presets[0].id)

    expect(store.keyword).toBe('auth')
    expect(store.language).toBe('typescript')
    expect(store.tag).toBe('backend')
  })
})
