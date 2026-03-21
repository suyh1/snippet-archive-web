import { describe, expect, it } from 'vitest'
import { BUNDLE_SCHEMA_VERSION, validateBundle } from '../core/bundle-schema'

describe('validateBundle', () => {
  it('accepts a valid v1 bundle', () => {
    const bundle = validateBundle({
      schemaVersion: BUNDLE_SCHEMA_VERSION,
      generatedAt: '2026-03-21T00:00:00.000Z',
      workspaces: [
        {
          title: 'Workspace A',
          description: 'demo',
          tags: ['demo'],
          starred: false,
          files: [
            {
              name: 'hello.ts',
              path: 'snippets/hello.ts',
              language: 'typescript',
              content: 'export const hello = "world"',
              tags: ['sample'],
              starred: false,
              kind: 'file',
              order: 0,
            },
          ],
        },
      ],
    })

    expect(bundle.workspaces[0].title).toBe('Workspace A')
  })

  it('throws when schema version mismatches', () => {
    expect(() =>
      validateBundle({
        schemaVersion: 'snippet-archive-bundle/v0',
        generatedAt: '2026-03-21T00:00:00.000Z',
        workspaces: [],
      }),
    ).toThrow('Unsupported bundle schemaVersion')
  })
})
