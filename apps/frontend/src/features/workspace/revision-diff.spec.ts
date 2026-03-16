import { describe, expect, it } from 'vitest'
import { buildUnifiedLineDiff } from '@/utils/revision-diff'

describe('revision diff util', () => {
  it('builds line-level added and removed rows', () => {
    const rows = buildUnifiedLineDiff('const version = 2', 'const version = 3')

    expect(rows.some((row) => row.type === 'removed' && row.text === 'const version = 2')).toBe(true)
    expect(rows.some((row) => row.type === 'added' && row.text === 'const version = 3')).toBe(true)
  })
})
