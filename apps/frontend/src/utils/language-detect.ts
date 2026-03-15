import type { Extension } from '@codemirror/state'
import { LanguageDescription, type LanguageSupport } from '@codemirror/language'
import { languages as codeMirrorLanguages } from '@codemirror/language-data'

export type SupportedEditorLanguage = string

type EditorLanguageDescriptor = {
  id: string
  label: string
  description: LanguageDescription
}

const PLAINTEXT_LANGUAGE_ID = 'plaintext'
const PLAINTEXT_LABEL = 'Plain Text'
const PLAINTEXT_LANGUAGE_ALIASES = new Set(['plaintext', 'plain-text', 'plain text', 'text'])
const LANGUAGE_EXTENSION_OVERRIDES: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
  markdown: 'md',
  python: 'py',
  'c++': 'cpp',
  'c#': 'cs',
  'f#': 'fs',
}

function normalizeIdentifier(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
}

function getBaseName(name: string) {
  return name.trim().split('/').pop() ?? name.trim()
}

const languageDescriptors: EditorLanguageDescriptor[] = codeMirrorLanguages
  .map((description) => {
    return {
      id: normalizeIdentifier(description.name),
      label: description.name,
      description,
    }
  })
  .sort((a, b) => a.label.localeCompare(b.label, 'en'))

const descriptorById = new Map(languageDescriptors.map((item) => [item.id, item]))
const descriptorByAlias = new Map<string, EditorLanguageDescriptor>()

for (const descriptor of languageDescriptors) {
  descriptorByAlias.set(descriptor.id, descriptor)
  descriptorByAlias.set(normalizeIdentifier(descriptor.label), descriptor)

  for (const alias of descriptor.description.alias) {
    descriptorByAlias.set(normalizeIdentifier(alias), descriptor)
  }
}

function resolveDescriptorByValue(rawLanguage: string) {
  const normalized = normalizeIdentifier(rawLanguage)
  if (!normalized || PLAINTEXT_LANGUAGE_ALIASES.has(normalized)) {
    return null
  }

  const direct = descriptorByAlias.get(normalized)
  if (direct) {
    return direct
  }

  const byName = LanguageDescription.matchLanguageName(codeMirrorLanguages, rawLanguage, true)
  if (byName) {
    return descriptorById.get(normalizeIdentifier(byName.name)) ?? null
  }

  const byExtension = LanguageDescription.matchFilename(codeMirrorLanguages, `x.${normalized}`)
  if (byExtension) {
    return descriptorById.get(normalizeIdentifier(byExtension.name)) ?? null
  }

  return null
}

export const MANUAL_LANGUAGE_OPTIONS: Array<{ value: SupportedEditorLanguage; label: string }> = [
  { value: PLAINTEXT_LANGUAGE_ID, label: PLAINTEXT_LABEL },
  ...languageDescriptors.map((descriptor) => ({
    value: descriptor.id,
    label: descriptor.label,
  })),
]

const languageSupportCache = new Map<string, Promise<LanguageSupport | null>>()

export function hasExplicitFileExtension(name: string) {
  const base = getBaseName(name)
  const dotIndex = base.lastIndexOf('.')
  return dotIndex > 0 && dotIndex < base.length - 1
}

export function inferLanguageFromFileName(name: string): SupportedEditorLanguage | null {
  const baseName = getBaseName(name)
  if (!baseName) {
    return null
  }

  const matched = LanguageDescription.matchFilename(codeMirrorLanguages, baseName)
  if (!matched) {
    return null
  }

  return normalizeIdentifier(matched.name)
}

export function normalizeLanguage(language: string): SupportedEditorLanguage {
  if (!language?.trim()) {
    return PLAINTEXT_LANGUAGE_ID
  }

  const descriptor = resolveDescriptorByValue(language)
  return descriptor?.id ?? PLAINTEXT_LANGUAGE_ID
}

export function getLanguageLabel(language: string) {
  const normalized = normalizeLanguage(language)
  if (normalized === PLAINTEXT_LANGUAGE_ID) {
    return PLAINTEXT_LABEL
  }

  const descriptor = descriptorById.get(normalized)
  return descriptor?.label ?? PLAINTEXT_LABEL
}

export function getPreferredExtensionForLanguage(language: string): string | null {
  const normalized = normalizeLanguage(language)
  if (normalized === PLAINTEXT_LANGUAGE_ID) {
    return null
  }

  const overridden = LANGUAGE_EXTENSION_OVERRIDES[normalized]
  if (overridden) {
    return overridden
  }

  const descriptor = descriptorById.get(normalized)
  if (!descriptor) {
    return null
  }

  const extensionCandidates = descriptor.description.extensions
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .filter((raw) => raw === raw.toLowerCase())
    .filter((raw) => /^[a-z0-9][a-z0-9+-]*$/.test(raw))
    .filter((raw) => raw.length <= 12)

  if (extensionCandidates.length === 0) {
    return null
  }

  const ranked = [...extensionCandidates].sort((left, right) => {
    const leftScore =
      (left.length >= 2 && left.length <= 4 ? 30 : 0) +
      (left.length === 1 ? -50 : 0) +
      (left.includes('+') ? -10 : 0) +
      (left === normalized ? 10 : 0)
    const rightScore =
      (right.length >= 2 && right.length <= 4 ? 30 : 0) +
      (right.length === 1 ? -50 : 0) +
      (right.includes('+') ? -10 : 0) +
      (right === normalized ? 10 : 0)

    if (leftScore !== rightScore) {
      return rightScore - leftScore
    }

    if (left.length !== right.length) {
      return left.length - right.length
    }

    return left.localeCompare(right, 'en')
  })

  return ranked[0] ?? null
}

export function applyLanguageToFileName(name: string, language: string) {
  const preferredExtension = getPreferredExtensionForLanguage(language)
  if (!preferredExtension) {
    return name
  }

  const trimmed = name.trim()
  if (!trimmed) {
    return name
  }

  const dotIndex = trimmed.lastIndexOf('.')
  if (dotIndex > 0 && dotIndex < trimmed.length - 1) {
    return `${trimmed.slice(0, dotIndex)}.${preferredExtension}`
  }

  return `${trimmed}.${preferredExtension}`
}

export async function loadLanguageExtension(language: string): Promise<Extension> {
  const normalized = normalizeLanguage(language)
  if (normalized === PLAINTEXT_LANGUAGE_ID) {
    return []
  }

  const descriptor = descriptorById.get(normalized)
  if (!descriptor) {
    return []
  }

  const cached = languageSupportCache.get(normalized)
  if (cached) {
    const support = await cached
    return support ?? []
  }

  const loadingPromise = descriptor.description
    .load()
    .then((support) => support)
    .catch(() => null)

  languageSupportCache.set(normalized, loadingPromise)
  const support = await loadingPromise
  return support ?? []
}
