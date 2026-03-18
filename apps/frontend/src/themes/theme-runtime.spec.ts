// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyBuiltinUiTheme,
  getActiveUiTheme,
  getBuiltinUiThemeCatalog,
  getBuiltinUiThemeFiles,
  getDefaultUiTheme,
  importUiThemeFile,
  initializeUiTheme,
  resetUiThemeToDefault,
} from './theme-runtime'

describe('theme runtime', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.style.cssText = ''
  })

  it('initializes and applies default glass theme tokens', () => {
    const theme = initializeUiTheme()
    expect(theme.meta.id).toBe('glass-gradient')
    expect(document.documentElement.style.getPropertyValue('--theme-layout-app-shell-background')).toContain(
      'linear-gradient',
    )
  })

  it('imports valid theme file and persists it', async () => {
    initializeUiTheme()

    const nextTheme = getDefaultUiTheme()
    nextTheme.meta.id = 'sunset-glass'
    nextTheme.meta.name = 'Sunset Glass'
    nextTheme.modules.layout.appShellBackground =
      'linear-gradient(170deg, #fff7ed 0%, #fed7aa 50%, #fdba74 100%)'

    const file = new File([JSON.stringify(nextTheme)], 'sunset-glass.json', {
      type: 'application/json',
    })
    const result = await importUiThemeFile(file)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.theme.meta.id).toBe('sunset-glass')
    expect(getActiveUiTheme().meta.id).toBe('sunset-glass')
    expect(document.documentElement.style.getPropertyValue('--theme-layout-app-shell-background')).toContain(
      '#fdba74',
    )

    const storedTheme = window.localStorage.getItem('ui-theme-file-v1')
    expect(storedTheme).toContain('"id": "sunset-glass"')
  })

  it('switches among builtin themes and keeps catalog complete', () => {
    initializeUiTheme()
    const catalog = getBuiltinUiThemeCatalog()
    expect(catalog.length).toBeGreaterThanOrEqual(17)
    expect(catalog.some((item) => item.id === 'ink-wash-zen')).toBe(true)

    const switched = applyBuiltinUiTheme('graphite-pro')
    expect(switched.ok).toBe(true)
    if (!switched.ok) {
      return
    }

    expect(switched.theme.meta.id).toBe('graphite-pro')
    expect(getActiveUiTheme().meta.id).toBe('graphite-pro')
    expect(document.documentElement.style.getPropertyValue('--theme-text-primary')).toBe('#e5e7eb')

    const invalidSwitch = applyBuiltinUiTheme('missing-theme')
    expect(invalidSwitch.ok).toBe(false)
  })

  it('ships preset-specific floating toolbar glass tokens', () => {
    const themes = getBuiltinUiThemeFiles()

    const toolbarBackgrounds = themes.map((theme) => theme.modules.surface.toolbarGlassBackground)
    const toolbarShadows = themes.map((theme) => theme.modules.surface.toolbarGlassShadow)

    expect(new Set(toolbarBackgrounds).size).toBe(themes.length)
    expect(new Set(toolbarShadows).size).toBe(themes.length)
  })

  it('keeps legacy preset typography visually diverse after theme refresh', () => {
    const themes = getBuiltinUiThemeFiles()
    const legacyPresetIds = [
      'glass-gradient',
      'nordic-fog',
      'graphite-pro',
      'tokyo-neon',
      'paper-ink',
      'forest-glass',
      'sunset-ui',
      'mono-minimal',
      'aurora-night',
    ]

    const legacyFonts = themes
      .filter((theme) => legacyPresetIds.includes(theme.meta.id))
      .map((theme) => theme.modules.layout.appFontFamily)

    expect(legacyFonts).toHaveLength(legacyPresetIds.length)
    expect(new Set(legacyFonts).size).toBeGreaterThanOrEqual(6)
  })

  it('rejects invalid theme file and keeps current theme', async () => {
    initializeUiTheme()
    const previousThemeId = getActiveUiTheme().meta.id
    const invalidFile = new File(['{"schemaVersion":1}'], 'broken-theme.json', {
      type: 'application/json',
    })

    const result = await importUiThemeFile(invalidFile)

    expect(result.ok).toBe(false)
    expect(getActiveUiTheme().meta.id).toBe(previousThemeId)
  })

  it('resets active theme back to default', async () => {
    initializeUiTheme()
    const nextTheme = getDefaultUiTheme()
    nextTheme.meta.id = 'temporary-theme'
    nextTheme.meta.name = 'Temporary Theme'
    nextTheme.modules.layout.appShellBackground =
      'linear-gradient(170deg, #f5f3ff 0%, #c4b5fd 52%, #a78bfa 100%)'
    const file = new File([JSON.stringify(nextTheme)], 'temporary-theme.json', {
      type: 'application/json',
    })
    await importUiThemeFile(file)

    const resetTheme = resetUiThemeToDefault()

    expect(resetTheme.meta.id).toBe('glass-gradient')
    expect(document.documentElement.style.getPropertyValue('--theme-layout-app-shell-background')).toContain(
      '#dbeafe',
    )
  })
})
