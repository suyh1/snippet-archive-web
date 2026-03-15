import { describe, expect, it } from 'vitest'
import { validateRenameInput } from './rename-validation'

describe('validateRenameInput', () => {
  it('rejects empty value', () => {
    expect(validateRenameInput('', [])) .toBe('名称不能为空。')
  })

  it('rejects leading or trailing whitespace', () => {
    expect(validateRenameInput(' main.ts', [])).toBe('名称不能包含首尾空格。')
    expect(validateRenameInput('main.ts ', [])).toBe('名称不能包含首尾空格。')
  })

  it('rejects slash and dot segments', () => {
    expect(validateRenameInput('a/b.ts', [])).toBe('名称不能包含 "/"。')
    expect(validateRenameInput('.', [])).toBe('名称不能为 "." 或 ".."。')
    expect(validateRenameInput('..', [])).toBe('名称不能为 "." 或 ".."。')
  })

  it('rejects names longer than 120 chars', () => {
    expect(validateRenameInput('a'.repeat(121), [])).toBe('名称长度不能超过 120 个字符。')
  })

  it('rejects sibling conflict', () => {
    expect(validateRenameInput('main.ts', ['main.ts', 'app.ts'])).toBe('同级目录下已存在同名项。')
  })

  it('accepts valid name', () => {
    expect(validateRenameInput('feature.ts', ['main.ts'])).toBeNull()
  })
})
