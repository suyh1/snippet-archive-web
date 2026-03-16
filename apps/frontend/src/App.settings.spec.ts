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

import SettingsPage from '@/pages/SettingsPage.vue'
import { workspaceApi } from '@/api/workspaces'
import { getDefaultUiTheme } from '@/themes/theme-runtime'

describe('Settings page', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.location.hash = '#/'
    window.localStorage.clear()
    vi.mocked(workspaceApi.list).mockResolvedValue([])
  })

  it('shows supported languages tab and can switch tabs', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(SettingsPage, {
      global: {
        plugins: [pinia],
      },
    })

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
    const themeTutorial = wrapper.get('[data-testid="settings-theme-tutorial"]')
    expect(themeTutorial.text()).toContain('schemaVersion')
    expect(themeTutorial.text()).toContain('modules')
    expect(themeTutorial.text()).toContain('surface.toolbarGlassBackground')
    expect(themeTutorial.text()).toContain('surface.toolbarGlassHighlightArc')
    expect(themeTutorial.text()).toContain('推荐编写步骤')

    await wrapper.get('[data-testid="settings-tab-shortcuts"]').trigger('click')
    expect(wrapper.find('[data-testid="settings-panel-shortcuts"]').exists()).toBe(true)
    const shortcutPanel = wrapper.get('[data-testid="settings-panel-shortcuts"]')
    expect(shortcutPanel.text()).toContain('Ctrl/Cmd + Shift + K')
    expect(shortcutPanel.text()).toContain('Ctrl/Cmd + S')

    await wrapper.get('[data-testid="settings-tab-languages"]').trigger('click')
    expect(wrapper.find('[data-testid="settings-panel-languages"]').exists()).toBe(true)
  })

  it('imports and exports theme files in themes tab', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:theme-export')
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(SettingsPage, {
      global: {
        plugins: [pinia],
      },
    })

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

  it('shows actionable error when toolbar theme tokens are missing on import', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(SettingsPage, {
      global: {
        plugins: [pinia],
      },
    })

    await wrapper.get('[data-testid="settings-tab-themes"]').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="settings-theme-panel"]').exists()).toBe(true)
    })

    const invalidTheme = getDefaultUiTheme()
    invalidTheme.meta.id = 'broken-toolbar-theme'
    invalidTheme.meta.name = 'Broken Toolbar Theme'
    delete (invalidTheme.modules.surface as Record<string, string>).toolbarGlassBackground

    const input = wrapper.get('[data-testid="settings-theme-import-input"]')
    const file = new File([JSON.stringify(invalidTheme, null, 2)], 'broken-toolbar-theme.json', {
      type: 'application/json',
    })
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [file],
    })
    await input.trigger('change')

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="settings-theme-import-message"]').text()).toContain(
        '缺少浮动工具栏 token',
      )
    })

    const message = wrapper.get('[data-testid="settings-theme-import-message"]').text()
    expect(message).toContain('surface.toolbarGlassBackground')
    expect(message).toContain('surface.toolbarGlass* / surface.toolbarLink* / surface.toolbarCapture*')
  })
})
