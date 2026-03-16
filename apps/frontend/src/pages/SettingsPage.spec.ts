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
      listFileRevisions: vi.fn(),
      createFile: vi.fn(),
      moveFile: vi.fn(),
      updateFile: vi.fn(),
      restoreFileRevision: vi.fn(),
      deleteFile: vi.fn(),
    },
  }
})

import SettingsPage from './SettingsPage.vue'
import { workspaceApi } from '@/api/workspaces'

describe('SettingsPage decoupling', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
    vi.mocked(workspaceApi.list).mockResolvedValue([])
  })

  it('does not request workspace list when opening settings route', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(SettingsPage, {
      global: {
        plugins: [pinia],
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="settings-view"]').exists()).toBe(true)
    })

    expect(workspaceApi.list).not.toHaveBeenCalled()
  })
})
