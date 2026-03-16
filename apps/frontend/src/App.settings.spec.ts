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
    window.localStorage.clear()
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

    await wrapper.get('[data-testid="settings-tab-themes"]').trigger('click')
    expect(wrapper.find('[data-testid="settings-panel-themes"]').exists()).toBe(true)

    await wrapper.get('[data-testid="settings-tab-languages"]').trigger('click')
    expect(wrapper.find('[data-testid="settings-panel-languages"]').exists()).toBe(true)

    await wrapper.get('[data-testid="back-to-workspace"]').trigger('click')
    expect(wrapper.find('[data-testid="settings-view"]').exists()).toBe(false)
  })

  it('imports and exports theme files in themes tab', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:theme-export')
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(App, {
      global: {
        plugins: [pinia],
      },
    })

    await wrapper.get('[data-testid="open-settings"]').trigger('click')
    await wrapper.get('[data-testid="settings-tab-themes"]').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="settings-theme-panel"]').exists()).toBe(true)
    })

    const presetSelect = wrapper.get('[data-testid="settings-theme-preset-select"]')
    expect((presetSelect.element as HTMLSelectElement).options.length).toBeGreaterThanOrEqual(9)
    await presetSelect.setValue('graphite-pro')
    expect(wrapper.get('[data-testid="settings-theme-current-id"]').text()).toBe('graphite-pro')

    const fileNameInput = wrapper.get('[data-testid="settings-theme-export-name"]')
    await fileNameInput.setValue('  custom-glass  ')
    await fileNameInput.trigger('blur')
    expect((fileNameInput.element as HTMLInputElement).value).toBe('custom-glass')

    await fileNameInput.setValue('temporary-value')
    await fileNameInput.trigger('keydown', { key: 'Escape' })
    expect((fileNameInput.element as HTMLInputElement).value).toBe('graphite-pro')

    await wrapper.get('[data-testid="settings-theme-export"]').trigger('click')
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1)
    expect(anchorClickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:theme-export')

    const exportBlob = createObjectUrlSpy.mock.calls[0][0] as Blob
    const exportedTheme = JSON.parse(await exportBlob.text()) as {
      modules: {
        layout: {
          appShellBackground: string
        }
      }
    }
    exportedTheme.modules.layout.appShellBackground =
      'linear-gradient(160deg, #fee2e2 0%, #fecaca 52%, #fda4af 100%)'

    const input = wrapper.get('[data-testid="settings-theme-import-input"]')
    const file = new File([JSON.stringify(exportedTheme, null, 2)], 'custom-glass.json', {
      type: 'application/json',
    })
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [file],
    })
    await input.trigger('change')

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="settings-theme-import-message"]').text()).toContain(
        '主题已导入并应用',
      )
    })

    expect(document.documentElement.style.getPropertyValue('--theme-layout-app-shell-background')).toBe(
      'linear-gradient(160deg, #fee2e2 0%, #fecaca 52%, #fda4af 100%)',
    )
  })
})
