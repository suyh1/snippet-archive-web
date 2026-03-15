import { describe, expect, it } from 'vitest'
import { detectLanguageFromSnippet } from './language-detect'

describe('detectLanguageFromSnippet', () => {
  it('detects typescript snippets with type syntax', () => {
    const snippet = `interface User {\n  id: number\n}\nconst user: User = { id: 1 }`
    expect(detectLanguageFromSnippet(snippet)).toBe('typescript')
  })

  it('detects json snippets', () => {
    const snippet = '{"name":"snippet","enabled":true}'
    expect(detectLanguageFromSnippet(snippet)).toBe('json')
  })

  it('detects markdown snippets', () => {
    const snippet = '# Title\n\n- item one\n- item two'
    expect(detectLanguageFromSnippet(snippet)).toBe('markdown')
  })

  it('detects html snippets', () => {
    const snippet = '<div class="card"><h1>Hello</h1></div>'
    expect(detectLanguageFromSnippet(snippet)).toBe('html')
  })

  it('returns null when language is unknown', () => {
    expect(detectLanguageFromSnippet('just plain words no code markers')).toBe(null)
  })
})
