import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const frontendRoot = join(__filename, '..', '..')
const srcRoot = join(frontendRoot, 'src')

const styleBlockPattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
const colorPatterns = [
  /#[0-9a-fA-F]{3,8}\b/,
  /\brgba?\s*\(/,
  /\bhsla?\s*\(/,
  /\b(?:linear|radial|conic)-gradient\s*\(/,
]

function walkVueFiles(rootDir) {
  const result = []
  const entries = readdirSync(rootDir)
  for (const entry of entries) {
    const fullPath = join(rootDir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      result.push(...walkVueFiles(fullPath))
      continue
    }

    if (!fullPath.endsWith('.vue')) {
      continue
    }

    result.push(fullPath)
  }

  return result
}

const violations = []

for (const filePath of walkVueFiles(srcRoot)) {
  const source = readFileSync(filePath, 'utf-8')
  const styleBlocks = source.matchAll(styleBlockPattern)

  for (const styleBlockMatch of styleBlocks) {
    const styleContent = styleBlockMatch[1] ?? ''
    const lines = styleContent.split('\n')

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      if (line.includes('theme-hardcoded-allow')) {
        continue
      }

      const hasHardcodedColor = colorPatterns.some((pattern) => pattern.test(line))
      if (!hasHardcodedColor) {
        continue
      }

      violations.push({
        file: relative(frontendRoot, filePath),
        line: index + 1,
        code: line.trim(),
      })
    }
  }
}

if (violations.length > 0) {
  console.error(
    'Hardcoded color check failed. Please use theme CSS variables in Vue component <style> blocks:',
  )
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} ${violation.code}`)
  }
  process.exit(1)
}

console.log('Hardcoded color check passed. No color literals in Vue component style blocks.')
