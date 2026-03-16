import defaultThemeJson from './glass-gradient.theme.json'

export const UI_THEME_SCHEMA_VERSION = 1

export type ThemeTokenModule = Record<string, string>

export type UiThemeFile = {
  schemaVersion: number
  meta: {
    id: string
    name: string
    version?: string
    author?: string
    description?: string
  }
  modules: Record<string, ThemeTokenModule>
}

type ThemeValidationResult =
  | { ok: true; theme: UiThemeFile }
  | { ok: false; error: string }

export const DEFAULT_UI_THEME: UiThemeFile = cloneTheme(defaultThemeJson as UiThemeFile)

const requiredModuleTokens = Object.fromEntries(
  Object.entries(DEFAULT_UI_THEME.modules).map(([moduleName, tokens]) => [
    moduleName,
    Object.keys(tokens),
  ]),
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function hasNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

export function cloneTheme(theme: UiThemeFile): UiThemeFile {
  return JSON.parse(JSON.stringify(theme)) as UiThemeFile
}

export function normalizeThemeExportFileName(name: string) {
  const compactName = name.trim().toLowerCase()
  const normalized = compactName
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || 'theme'
}

export function resolveCssVarName(moduleName: string, tokenName: string) {
  const toKebabCase = (value: string) => {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/\s+/g, '-')
      .replace(/_/g, '-')
      .toLowerCase()
  }

  return `--theme-${toKebabCase(moduleName)}-${toKebabCase(tokenName)}`
}

export function validateUiTheme(candidate: unknown): ThemeValidationResult {
  if (!isRecord(candidate)) {
    return { ok: false, error: '主题文件必须是 JSON 对象。' }
  }

  if (candidate.schemaVersion !== UI_THEME_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `主题版本不匹配，期望 schemaVersion=${UI_THEME_SCHEMA_VERSION}。`,
    }
  }

  if (!isRecord(candidate.meta)) {
    return { ok: false, error: '主题 meta 字段缺失。' }
  }
  if (!hasNonEmptyString(candidate.meta.id) || !hasNonEmptyString(candidate.meta.name)) {
    return { ok: false, error: '主题 meta.id 与 meta.name 必须为非空字符串。' }
  }

  if (!isRecord(candidate.modules)) {
    return { ok: false, error: '主题 modules 字段缺失。' }
  }

  for (const [moduleName, requiredTokens] of Object.entries(requiredModuleTokens)) {
    const moduleValue = candidate.modules[moduleName]
    if (!isRecord(moduleValue)) {
      return {
        ok: false,
        error: `缺少模块：modules.${moduleName}。`,
      }
    }

    for (const tokenName of requiredTokens) {
      const tokenValue = moduleValue[tokenName]
      if (!hasNonEmptyString(tokenValue)) {
        return {
          ok: false,
          error: `缺少 token：modules.${moduleName}.${tokenName}。`,
        }
      }
    }

    for (const [tokenName, tokenValue] of Object.entries(moduleValue)) {
      if (!hasNonEmptyString(tokenValue)) {
        return {
          ok: false,
          error: `token 必须为非空字符串：modules.${moduleName}.${tokenName}。`,
        }
      }
    }
  }

  const meta = candidate.meta as Record<string, unknown>
  const modules = candidate.modules as Record<string, Record<string, unknown>>
  const normalizedTheme: UiThemeFile = {
    schemaVersion: UI_THEME_SCHEMA_VERSION,
    meta: {
      id: String(meta.id).trim(),
      name: String(meta.name).trim(),
      version: hasNonEmptyString(meta.version) ? String(meta.version).trim() : undefined,
      author: hasNonEmptyString(meta.author) ? String(meta.author).trim() : undefined,
      description: hasNonEmptyString(meta.description) ? String(meta.description).trim() : undefined,
    },
    modules: {},
  }

  for (const [moduleName, moduleTokens] of Object.entries(modules)) {
    if (!isRecord(moduleTokens)) {
      continue
    }

    normalizedTheme.modules[moduleName] = {}
    for (const [tokenName, tokenValue] of Object.entries(moduleTokens)) {
      if (!hasNonEmptyString(tokenValue)) {
        continue
      }
      normalizedTheme.modules[moduleName][tokenName] = String(tokenValue).trim()
    }
  }

  return { ok: true, theme: normalizedTheme }
}

export function serializeUiTheme(theme: UiThemeFile) {
  return JSON.stringify(theme, null, 2)
}
