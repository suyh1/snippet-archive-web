import { describe, expect, it } from 'vitest'
import {
  applyLanguageToFileName,
  getLanguageLabel,
  getPreferredExtensionForLanguage,
  hasExplicitFileExtension,
  inferLanguageFromFileName,
  MANUAL_LANGUAGE_OPTIONS,
  normalizeLanguage,
} from './language-detect'

describe('file suffix language strategy', () => {
  it('infers supported language from known extension', () => {
    expect(inferLanguageFromFileName('main.ts')).toBe('typescript')
    expect(inferLanguageFromFileName('main.js')).toBe('javascript')
    expect(inferLanguageFromFileName('script.py')).toBe('python')
    expect(inferLanguageFromFileName('data.json')).toBe('json')
    expect(inferLanguageFromFileName('README.md')).toBe('markdown')
    expect(inferLanguageFromFileName('view.html')).toBe('html')
    expect(inferLanguageFromFileName('App.vue')).toBe('vue')
  })

  it('returns null for unknown extension and extensionless names', () => {
    expect(inferLanguageFromFileName('notes.customlang')).toBe(null)
    expect(inferLanguageFromFileName('scratch')).toBe(null)
  })

  it('reports whether file has explicit extension', () => {
    expect(hasExplicitFileExtension('main.ts')).toBe(true)
    expect(hasExplicitFileExtension('notes.txt')).toBe(true)
    expect(hasExplicitFileExtension('scratch')).toBe(false)
  })
})

describe('normalizeLanguage', () => {
  it('normalizes known aliases and keeps broad language ids', () => {
    expect(normalizeLanguage('TypeScript')).toBe('typescript')
    expect(normalizeLanguage('python')).toBe('python')
    expect(normalizeLanguage('PY')).toBe('python')
    expect(normalizeLanguage('')).toBe('plaintext')
  })
})

describe('language label', () => {
  it('returns readable labels for known languages', () => {
    expect(getLanguageLabel('typescript')).toBe('TypeScript')
    expect(getLanguageLabel('python')).toBe('Python')
  })
})

describe('preferred language extension and file rename', () => {
  it('resolves preferred extension for common languages', () => {
    expect(getPreferredExtensionForLanguage('typescript')).toBe('ts')
    expect(getPreferredExtensionForLanguage('python')).toBe('py')
    expect(getPreferredExtensionForLanguage('plaintext')).toBe(null)
  })

  it('applies selected language suffix to file names', () => {
    expect(applyLanguageToFileName('main.ts', 'html')).toBe('main.html')
    expect(applyLanguageToFileName('scratch', 'python')).toBe('scratch.py')
    expect(applyLanguageToFileName('README.md', 'plaintext')).toBe('README.md')
  })
})

describe('manual language options', () => {
  it('contains plaintext, core code languages, and 100+ options', () => {
    const values = MANUAL_LANGUAGE_OPTIONS.map((item) => item.value)
    expect(MANUAL_LANGUAGE_OPTIONS.length).toBeGreaterThanOrEqual(100)
    expect(values).toContain('plaintext')
    expect(values).toContain('typescript')
    expect(values).toContain('javascript')
    expect(values).toContain('python')
    expect(values).toContain('json')
    expect(values).toContain('markdown')
    expect(values).toContain('html')
    expect(values).toContain('vue')
  })
})
