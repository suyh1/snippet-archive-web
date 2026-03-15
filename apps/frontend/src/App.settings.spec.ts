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

describe('App settings page', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.location.hash = '#/'
    vi.mocked(workspaceApi.list).mockResolvedValue([])
  })

  it('opens settings page and shows supported languages tab', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(App, {
      global: {
        plugins: [pinia],
      },
    })

    await wrapper.get('[data-testid="open-settings"]').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="settings-view"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="settings-panel-languages"]').exists()).toBe(true)
    })

    expect(wrapper.findAll('[data-testid="settings-language-item"]').length).toBeGreaterThanOrEqual(100)

    await wrapper.get('[data-testid="settings-language-search"]').setValue('python')
    expect(wrapper.text()).toContain('Python')

    await wrapper.get('[data-testid="settings-tab-general"]').trigger('click')
    expect(wrapper.find('[data-testid="settings-panel-general"]').exists()).toBe(true)

    await wrapper.get('[data-testid="settings-tab-languages"]').trigger('click')
    expect(wrapper.find('[data-testid="settings-panel-languages"]').exists()).toBe(true)

    await wrapper.get('[data-testid="back-to-workspace"]').trigger('click')
    expect(wrapper.find('[data-testid="settings-view"]').exists()).toBe(false)
  })
})
