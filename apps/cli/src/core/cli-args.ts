export type CliOptionValue = string | boolean | string[]

export type ParsedCliArgs = {
  command: string | null
  options: Record<string, CliOptionValue>
  positionals: string[]
}

const BOOLEAN_FLAGS = new Set(['dry-run', 'json', 'help'])

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const options: Record<string, CliOptionValue> = {}
  const positionals: string[] = []
  let command: string | null = null

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]

    if (token.startsWith('--')) {
      const key = token.slice(2)
      const next = argv[i + 1]
      const hasValue =
        !BOOLEAN_FLAGS.has(key) &&
        next !== undefined &&
        !next.startsWith('--')
      const value: CliOptionValue = hasValue ? next : true

      if (hasValue) {
        i += 1
      }

      const existing = options[key]
      if (existing === undefined) {
        options[key] = value
      } else if (Array.isArray(existing)) {
        existing.push(String(value))
      } else {
        options[key] = [String(existing), String(value)]
      }
      continue
    }

    if (command === null) {
      command = token
      continue
    }

    positionals.push(token)
  }

  return {
    command,
    options,
    positionals,
  }
}
