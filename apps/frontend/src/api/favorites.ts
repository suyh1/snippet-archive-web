import { apiRequest } from './http'
import type { FavoritesResult } from '@/types/workspace'

export type FavoritesQuery = {
  tag?: string
  type?: 'all' | 'workspace' | 'file'
  page?: number
  pageSize?: number
}

function toQueryString(query: FavoritesQuery) {
  const params = new URLSearchParams()

  if (query.tag) {
    params.set('tag', query.tag)
  }

  if (query.type) {
    params.set('type', query.type)
  }

  if (query.page) {
    params.set('page', String(query.page))
  }

  if (query.pageSize) {
    params.set('pageSize', String(query.pageSize))
  }

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

export const favoritesApi = {
  list(query: FavoritesQuery) {
    return apiRequest<FavoritesResult>(`/favorites${toQueryString(query)}`)
  },
}
