import { describe, expect, it } from 'vitest'
import { basename, getParentPath, joinPath, normalizePath } from './path'

describe('path utils', () => {
  it('normalizes repeated slashes and trims trailing slash', () => {
    expect(normalizePath('///a//b///')).toBe('/a/b')
  })

  it('joins parent path and child name', () => {
    expect(joinPath('/folder', 'main.ts')).toBe('/folder/main.ts')
    expect(joinPath('/', 'main.ts')).toBe('/main.ts')
  })

  it('returns parent path for nested paths', () => {
    expect(getParentPath('/folder/main.ts')).toBe('/folder')
    expect(getParentPath('/main.ts')).toBe('/')
  })

  it('returns basename from path', () => {
    expect(basename('/folder/main.ts')).toBe('main.ts')
  })
})
