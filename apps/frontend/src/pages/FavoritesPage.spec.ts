// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/favorites', () => {
  return {
    favoritesApi: {
      list: vi.fn(),
    },
  }
})

import FavoritesPage from '@/pages/FavoritesPage.vue'
import { favoritesApi } from '@/api/favorites'

describe('FavoritesPage', () => {
  beforeEach(() => {
    vi.mocked(favoritesApi.list).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })
  })

  it('supports tag filter keyboard flow', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/favorites', component: FavoritesPage }],
    })

    await router.push('/favorites')
    await router.isReady()

    const wrapper = mount(FavoritesPage, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.get('[data-testid="favorites-tag-input"]').setValue('backend')
    await wrapper.get('[data-testid="favorites-tag-input"]').trigger('keydown', { key: 'Enter' })

    await vi.waitFor(() => {
      expect(vi.mocked(favoritesApi.list).mock.calls).toEqual(
        expect.arrayContaining([
          [
            expect.objectContaining({
              tag: 'backend',
            }),
          ],
        ]),
      )
    })

    await wrapper.get('[data-testid="favorites-tag-input"]').setValue('abc')
    await wrapper.get('[data-testid="favorites-tag-input"]').trigger('keydown', { key: 'Escape' })
    expect((wrapper.get('[data-testid="favorites-tag-input"]').element as HTMLInputElement).value).toBe('')
  })

  it('opens favorite item to workspace route', async () => {
    vi.mocked(favoritesApi.list).mockResolvedValue({
      items: [
        {
          type: 'file',
          id: 'f1',
          workspaceId: 'w1',
          workspaceTitle: 'Workspace 1',
          title: 'token.ts',
          path: '/src/token.ts',
          language: 'typescript',
          tags: ['backend'],
          starredAt: '2026-03-16T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/favorites', component: FavoritesPage },
        { path: '/workspace', component: { template: '<div>workspace</div>' } },
      ],
    })

    await router.push('/favorites')
    await router.isReady()

    const wrapper = mount(FavoritesPage, {
      global: {
        plugins: [router],
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.findAll('[data-testid="favorites-item"]')).toHaveLength(1)
    })

    await wrapper.get('[data-testid="favorites-open"]').trigger('click')

    await vi.waitFor(() => {
      expect(router.currentRoute.value.path).toBe('/workspace')
    })
    expect(router.currentRoute.value.query.workspaceId).toBe('w1')
    expect(router.currentRoute.value.query.fileId).toBe('f1')
  })
})
