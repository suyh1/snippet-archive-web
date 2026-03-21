#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { SnippetArchiveCliClient, CliApiError } from './api/client'
import { parseCliArgs } from './core/cli-args'
import { validateBundle } from './core/bundle-schema'
import { readCliLocalConfig, writeCliLocalConfig } from './core/config-store'
import { buildBundleFromServer } from './core/exporter'
import { syncBundleToServer } from './core/importer'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3001/api'

type AppContext = {
  apiBaseUrl: string
  token?: string
}

async function main() {
  const parsed = parseCliArgs(process.argv)
  const localConfig = await readCliLocalConfig()

  const context: AppContext = {
    apiBaseUrl:
      getSingleOption(parsed.options['api-base-url']) ??
      process.env.SNIPPET_ARCHIVE_API_BASE_URL ??
      localConfig.apiBaseUrl ??
      DEFAULT_API_BASE_URL,
    token:
      getSingleOption(parsed.options.token) ??
      process.env.SNIPPET_ARCHIVE_TOKEN ??
      localConfig.accessToken,
  }

  switch (parsed.command) {
    case 'login':
      await runLoginCommand(parsed.options, context, localConfig)
      return
    case 'search':
      await runSearchCommand(parsed.options, context)
      return
    case 'export':
      await runExportCommand(parsed.options, context)
      return
    case 'import':
    case 'sync':
      await runImportCommand(parsed.options, context)
      return
    case 'help':
    case null:
      printHelp()
      return
    default:
      throw new Error(`Unsupported command "${parsed.command}".`)
  }
}

async function runLoginCommand(
  options: Record<string, string | boolean | string[]>,
  context: AppContext,
  localConfig: { accessToken?: string; apiBaseUrl?: string },
) {
  const email = getSingleOption(options.email) ?? process.env.SNIPPET_ARCHIVE_EMAIL
  const password =
    getSingleOption(options.password) ?? process.env.SNIPPET_ARCHIVE_PASSWORD

  if (!email || !password) {
    throw new Error('login requires --email and --password')
  }

  const client = new SnippetArchiveCliClient({
    apiBaseUrl: context.apiBaseUrl,
  })

  const session = await client.login({ email, password })
  await writeCliLocalConfig({
    ...localConfig,
    apiBaseUrl: context.apiBaseUrl,
    accessToken: session.accessToken,
  })

  const payload = {
    user: session.user,
    expiresAt: session.expiresAt ?? null,
    tokenStored: true,
    ...(hasBooleanFlag(options['print-token'])
      ? { accessToken: session.accessToken }
      : {}),
  }
  printJson(payload)
}

async function runSearchCommand(
  options: Record<string, string | boolean | string[]>,
  context: AppContext,
) {
  const client = createAuthedClient(context)

  const page = parseNumberOption(options.page, 1)
  const pageSize = parseNumberOption(options['page-size'], 20)

  const result = await client.searchSnippets({
    keyword: getSingleOption(options.keyword),
    language: getSingleOption(options.language),
    tag: getSingleOption(options.tag),
    workspaceId: getSingleOption(options['workspace-id']),
    page,
    pageSize,
  })

  if (hasBooleanFlag(options.json)) {
    printJson(result)
    return
  }

  if (result.items.length === 0) {
    console.log('No snippets found.')
    return
  }

  for (const item of result.items) {
    console.log(
      `[${item.workspaceTitle}] ${item.path} (${item.language}) :: ${inline(item.content)}`,
    )
  }
  console.log(`Total: ${result.total}`)
}

async function runExportCommand(
  options: Record<string, string | boolean | string[]>,
  context: AppContext,
) {
  const client = createAuthedClient(context)
  const workspaceIds = getMultiOption(options['workspace-id'])

  const bundle = await buildBundleFromServer(client, {
    workspaceIds: workspaceIds.length > 0 ? workspaceIds : undefined,
  })

  const output = getSingleOption(options.output)
  if (!output) {
    printJson(bundle)
    return
  }

  const outputPath = resolve(process.cwd(), output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify(bundle, null, 2), 'utf8')

  printJson({
    output: outputPath,
    workspaceCount: bundle.workspaces.length,
    fileCount: bundle.workspaces.reduce(
      (sum: number, item) => sum + item.files.length,
      0,
    ),
  })
}

async function runImportCommand(
  options: Record<string, string | boolean | string[]>,
  context: AppContext,
) {
  const input = getSingleOption(options.input)
  if (!input) {
    throw new Error('import requires --input <bundle.json>')
  }

  const inputPath = resolve(process.cwd(), input)
  const content = await readFile(inputPath, 'utf8')
  const bundle = validateBundle(JSON.parse(content))

  if (hasBooleanFlag(options['dry-run'])) {
    printJson({
      dryRun: true,
      plannedWorkspaces: bundle.workspaces.length,
      plannedFiles: bundle.workspaces.reduce(
        (sum: number, item) => sum + item.files.length,
        0,
      ),
    })
    return
  }

  const client = createAuthedClient(context)
  const summary = await syncBundleToServer(client, bundle)
  printJson(summary)
}

function createAuthedClient(context: AppContext) {
  if (!context.token || context.token.trim().length === 0) {
    throw new Error('Missing token. Use --token or SNIPPET_ARCHIVE_TOKEN, or run login.')
  }

  return new SnippetArchiveCliClient({
    apiBaseUrl: context.apiBaseUrl,
    accessToken: context.token,
  })
}

function getSingleOption(value: string | boolean | string[] | undefined) {
  if (value === undefined) {
    return undefined
  }

  if (Array.isArray(value)) {
    const item = value.at(-1)
    return item ? item : undefined
  }

  if (typeof value === 'boolean') {
    return undefined
  }

  return value
}

function getMultiOption(value: string | boolean | string[] | undefined) {
  if (value === undefined) {
    return []
  }
  if (Array.isArray(value)) {
    return value
  }
  if (typeof value === 'boolean') {
    return []
  }
  return [value]
}

function hasBooleanFlag(value: string | boolean | string[] | undefined) {
  return value === true
}

function parseNumberOption(value: string | boolean | string[] | undefined, fallback: number) {
  const input = getSingleOption(value)
  if (!input) {
    return fallback
  }
  const parsed = Number.parseInt(input, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function inline(content: string) {
  return content.replace(/\s+/g, ' ').trim().slice(0, 80)
}

function printJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function printHelp() {
  const lines = [
    'Snippet Archive CLI',
    '',
    'Commands:',
    '  login --email <email> --password <password> [--print-token]',
    '  search [--keyword <kw>] [--language <lang>] [--tag <tag>] [--workspace-id <id>] [--json]',
    '  export [--workspace-id <id>]... [--output <file>]',
    '  import --input <file> [--dry-run]',
    '  sync --input <file> [--dry-run]  (alias of import)',
    '',
    'Global options:',
    '  --api-base-url <url>   default: http://127.0.0.1:3001/api',
    '  --token <token>        or env SNIPPET_ARCHIVE_TOKEN',
  ]

  process.stdout.write(`${lines.join('\n')}\n`)
}

void main().catch((error: unknown) => {
  if (error instanceof CliApiError) {
    process.stderr.write(
      `CLI API error: ${error.message} (status=${error.status}${
        error.code ? `, code=${error.code}` : ''
      })\n`,
    )
    process.exitCode = 1
    return
  }

  if (error instanceof Error) {
    process.stderr.write(`CLI error: ${error.message}\n`)
    process.exitCode = 1
    return
  }

  process.stderr.write('CLI error: unknown error\n')
  process.exitCode = 1
})
