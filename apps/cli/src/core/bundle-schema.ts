export const BUNDLE_SCHEMA_VERSION = 'snippet-archive-bundle/v1'

export type SnippetBundleFile = {
  name: string
  path: string
  language: string
  content: string
  tags: string[]
  starred: boolean
  kind: string
  order: number
}

export type SnippetBundleWorkspace = {
  title: string
  description: string
  tags: string[]
  starred: boolean
  files: SnippetBundleFile[]
}

export type SnippetBundleV1 = {
  schemaVersion: typeof BUNDLE_SCHEMA_VERSION
  generatedAt: string
  workspaces: SnippetBundleWorkspace[]
}

export function validateBundle(input: unknown): SnippetBundleV1 {
  if (!input || typeof input !== 'object') {
    throw new Error('Bundle must be an object')
  }

  const raw = input as Record<string, unknown>

  if (raw.schemaVersion !== BUNDLE_SCHEMA_VERSION) {
    throw new Error('Unsupported bundle schemaVersion')
  }

  if (!isNonEmptyString(raw.generatedAt)) {
    throw new Error('Bundle generatedAt is required')
  }

  if (!Array.isArray(raw.workspaces)) {
    throw new Error('Bundle workspaces must be an array')
  }

  const workspaces = raw.workspaces.map((workspace, index) =>
    validateWorkspace(workspace, index),
  )

  return {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    generatedAt: raw.generatedAt,
    workspaces,
  }
}

function validateWorkspace(input: unknown, index: number): SnippetBundleWorkspace {
  if (!input || typeof input !== 'object') {
    throw new Error(`Workspace at index ${index} must be an object`)
  }

  const raw = input as Record<string, unknown>

  if (!isNonEmptyString(raw.title)) {
    throw new Error(`Workspace at index ${index} requires title`)
  }

  if (!Array.isArray(raw.files)) {
    throw new Error(`Workspace ${raw.title} requires files array`)
  }

  const title = raw.title

  return {
    title,
    description: typeof raw.description === 'string' ? raw.description : '',
    tags: normalizeStringArray(raw.tags),
    starred: Boolean(raw.starred),
    files: raw.files.map((file, fileIndex) => validateFile(file, title, fileIndex)),
  }
}

function validateFile(
  input: unknown,
  workspaceTitle: string,
  index: number,
): SnippetBundleFile {
  if (!input || typeof input !== 'object') {
    throw new Error(`File at ${workspaceTitle}[${index}] must be an object`)
  }

  const raw = input as Record<string, unknown>

  for (const field of ['name', 'path', 'language', 'content', 'kind'] as const) {
    if (!isNonEmptyString(raw[field])) {
      throw new Error(`File at ${workspaceTitle}[${index}] requires ${field}`)
    }
  }

  const order = typeof raw.order === 'number' && Number.isFinite(raw.order)
    ? raw.order
    : 0

  const name = raw.name as string
  const path = raw.path as string
  const language = raw.language as string
  const content = raw.content as string
  const kind = raw.kind as string

  return {
    name,
    path,
    language,
    content,
    tags: normalizeStringArray(raw.tags),
    starred: Boolean(raw.starred),
    kind,
    order,
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  return Array.from(new Set(normalized))
}
