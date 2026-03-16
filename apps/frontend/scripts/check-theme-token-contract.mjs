import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const frontendRoot = join(__filename, '..', '..')
const srcRoot = join(frontendRoot, 'src')
const themeSchemaPath = join(srcRoot, 'themes', 'glass-gradient.theme.json')

function toKebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .replace(/_/g, '-')
    .toLowerCase()
}

function resolveCssVarName(moduleName, tokenName) {
  return `--theme-${toKebabCase(moduleName)}-${toKebabCase(tokenName)}`
}

function walkFiles(rootDir, extensions) {
  const result = []
  const entries = readdirSync(rootDir)
  for (const entry of entries) {
    const fullPath = join(rootDir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      result.push(...walkFiles(fullPath, extensions))
      continue
    }

    if (!extensions.some((extension) => fullPath.endsWith(extension))) {
      continue
    }

    result.push(fullPath)
  }

  return result
}

const schema = JSON.parse(readFileSync(themeSchemaPath, 'utf-8'))
const definedTokens = new Set()
for (const [moduleName, tokens] of Object.entries(schema.modules)) {
  for (const tokenName of Object.keys(tokens)) {
    definedTokens.add(resolveCssVarName(moduleName, tokenName))
  }
}

const files = walkFiles(srcRoot, ['.vue', '.css', '.ts'])
const usagePattern = /--theme-[a-z0-9-]+/g
const unknownUsages = []
const usedTokens = new Set()

for (const filePath of files) {
  const content = readFileSync(filePath, 'utf-8')
  const matches = content.match(usagePattern)
  if (!matches) {
    continue
  }

  for (const token of matches) {
    usedTokens.add(token)
    if (!definedTokens.has(token)) {
      unknownUsages.push({
        file: relative(frontendRoot, filePath),
        token,
      })
    }
  }
}

if (unknownUsages.length > 0) {
  console.error('Theme token contract check failed. Unknown CSS vars were found:')
  for (const usage of unknownUsages) {
    console.error(`- ${usage.file}: ${usage.token}`)
  }
  process.exit(1)
}

console.log(
  `Theme token contract check passed. ${usedTokens.size} token usages, ${definedTokens.size} schema tokens.`,
)
