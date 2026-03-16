import { apiRequest } from './http'
import type { SearchSnippetsInput, SearchSnippetsResult } from '@/types/workspace'

function toSearchQueryString(input: SearchSnippetsInput) {
  const params = new URLSearchParams()

  const entries: Array<[string, string | number | undefined]> = [
    ['keyword', input.keyword],
    ['language', input.language],
    ['tag', input.tag],
    ['workspaceId', input.workspaceId],
    ['updatedFrom', input.updatedFrom],
    ['updatedTo', input.updatedTo],
    ['page', input.page],
    ['pageSize', input.pageSize],
  ]

  for (const [key, value] of entries) {
    if (value === undefined || value === '') {
      continue
    }

    params.set(key, String(value))
  }

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

export const searchApi = {
  searchSnippets(input: SearchSnippetsInput) {
    const queryString = toSearchQueryString(input)
    return apiRequest<SearchSnippetsResult>(`/search/snippets${queryString}`)
  },
}
