import {
  cloneTheme,
  DEFAULT_UI_THEME,
  normalizeThemeExportFileName,
  resolveCssVarName,
  serializeUiTheme,
  type UiThemeFile,
  validateUiTheme,
} from './theme-schema'
import {
  getBuiltinUiThemeById,
  getBuiltinUiThemeOptions,
  getBuiltinUiThemes,
  isBuiltinUiThemeId,
  type BuiltinUiThemeOption,
} from './builtin-themes'

const THEME_STORAGE_KEY = 'ui-theme-file-v1'

let activeTheme: UiThemeFile = cloneTheme(DEFAULT_UI_THEME)

function canUseDom() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function persistTheme(theme: UiThemeFile) {
  if (!canUseDom()) {
    return
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, serializeUiTheme(theme))
}

function readThemeFromStorage() {
  if (!canUseDom()) {
    return null
  }

  const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    const validation = validateUiTheme(parsed)
    if (!validation.ok) {
      return null
    }

    return validation.theme
  } catch {
    return null
  }
}

function applyThemeToDocument(theme: UiThemeFile) {
  if (!canUseDom()) {
    return
  }

  const root = document.documentElement
  for (const [moduleName, tokens] of Object.entries(theme.modules)) {
    for (const [tokenName, tokenValue] of Object.entries(tokens)) {
      root.style.setProperty(resolveCssVarName(moduleName, tokenName), tokenValue)
    }
  }

  root.dataset.uiThemeId = theme.meta.id
}

function setActiveTheme(theme: UiThemeFile, options?: { persist?: boolean }) {
  const nextTheme = cloneTheme(theme)
  applyThemeToDocument(nextTheme)
  activeTheme = nextTheme

  if (options?.persist ?? true) {
    persistTheme(nextTheme)
  }
}

export function initializeUiTheme() {
  const storedTheme = readThemeFromStorage()
  if (storedTheme) {
    setActiveTheme(storedTheme, { persist: false })
    return cloneTheme(storedTheme)
  }

  setActiveTheme(DEFAULT_UI_THEME, { persist: false })
  return cloneTheme(DEFAULT_UI_THEME)
}

export function getActiveUiTheme() {
  return cloneTheme(activeTheme)
}

export function getDefaultUiTheme() {
  return cloneTheme(DEFAULT_UI_THEME)
}

export function applyUiTheme(theme: UiThemeFile) {
  setActiveTheme(theme, { persist: true })
  return getActiveUiTheme()
}

export function applyBuiltinUiTheme(themeId: string) {
  const builtinTheme = getBuiltinUiThemeById(themeId)
  if (!builtinTheme) {
    return { ok: false as const, error: `未找到系统预置主题：${themeId}` }
  }

  return { ok: true as const, theme: applyUiTheme(builtinTheme) }
}

export function getBuiltinUiThemeCatalog(): BuiltinUiThemeOption[] {
  return getBuiltinUiThemeOptions()
}

export function getBuiltinUiThemeFiles() {
  return getBuiltinUiThemes()
}

export function isBuiltinThemeId(themeId: string) {
  return isBuiltinUiThemeId(themeId)
}

export function resetUiThemeToDefault() {
  setActiveTheme(DEFAULT_UI_THEME, { persist: true })
  return getActiveUiTheme()
}

export async function importUiThemeFile(file: File) {
  const rawText = await file.text()
  let parsedJson: unknown

  try {
    parsedJson = JSON.parse(rawText) as unknown
  } catch {
    return { ok: false as const, error: '文件不是合法 JSON。' }
  }

  const validation = validateUiTheme(parsedJson)
  if (!validation.ok) {
    return { ok: false as const, error: validation.error }
  }

  const importedTheme = applyUiTheme(validation.theme)
  return { ok: true as const, theme: importedTheme }
}

export function buildThemeExportPayload(theme: UiThemeFile = activeTheme) {
  return serializeUiTheme(theme)
}

export function buildThemeExportFileName(baseName: string) {
  return `${normalizeThemeExportFileName(baseName)}.json`
}
