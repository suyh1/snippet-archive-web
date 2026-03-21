import { describe, expect, it } from 'vitest'
import { parseCliArgs } from '../core/cli-args'

describe('parseCliArgs', () => {
  it('parses command, string options, repeated options and boolean flags', () => {
    const parsed = parseCliArgs([
      'node',
      'cli.js',
      'export',
      '--output',
      'bundle.json',
      '--workspace-id',
      'ws-1',
      '--workspace-id',
      'ws-2',
      '--dry-run',
      'notes.md',
    ])

    expect(parsed.command).toBe('export')
    expect(parsed.options.output).toBe('bundle.json')
    expect(parsed.options['workspace-id']).toEqual(['ws-1', 'ws-2'])
    expect(parsed.options['dry-run']).toBe(true)
    expect(parsed.positionals).toEqual(['notes.md'])
  })
})
