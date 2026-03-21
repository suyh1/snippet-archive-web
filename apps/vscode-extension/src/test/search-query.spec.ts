import { describe, expect, it } from 'vitest'
import { buildSearchQueryString } from '../api/search-query'

describe('buildSearchQueryString', () => {
  it('includes only non-empty fields and URL encodes values', () => {
    const query = buildSearchQueryString({
      keyword: 'auth token',
      language: 'typescript',
      tag: 'quick tips',
      workspaceId: '',
      page: 2,
      pageSize: 20,
    })

    expect(query).toBe('?keyword=auth+token&language=typescript&tag=quick+tips&page=2&pageSize=20')
  })

  it('returns empty query when all fields are empty', () => {
    expect(buildSearchQueryString({})).toBe('')
  })
})
