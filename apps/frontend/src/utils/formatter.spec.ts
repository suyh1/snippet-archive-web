import { describe, expect, it } from 'vitest'
import { formatSnippetContent } from './formatter'

describe('formatSnippetContent', () => {
  it('formats typescript snippets', async () => {
    const result = await formatSnippetContent({
      language: 'typescript',
      content: 'const add=(a:number,b:number)=>{return a+b}',
    })

    expect(result.ok).toBe(true)
    expect(result.content).toContain('const add = (a: number, b: number) => {')
    expect(result.content).toContain('return a + b')
  })

  it('formats json snippets', async () => {
    const result = await formatSnippetContent({
      language: 'json',
      content: '{"name":"snippet","enabled":true}',
    })

    expect(result.ok).toBe(true)
    expect(result.content).toContain('"name": "snippet"')
    expect(result.content).toContain('\n')
  })

  it('keeps plaintext unchanged as unsupported language', async () => {
    const result = await formatSnippetContent({
      language: 'plaintext',
      content: 'raw text',
    })

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unsupported')
    expect(result.content).toBe('raw text')
  })
})
