import { defineStore } from 'pinia'
import { searchApi } from '@/api/search'
import type { SearchSnippet } from '@/types/workspace'

const SEARCH_PRESETS_STORAGE_KEY = 'search-presets-v1'

export type SearchPreset = {
  id: string
  name: string
  query: {
    keyword: string
    language: string
    tag: string
    workspaceId: string
    updatedFrom: string
    updatedTo: string
    pageSize: number
  }
}

function readPresetsFromStorage(): SearchPreset[] {
  if (typeof window === 'undefined') {
    return []
  }

  const raw = window.localStorage.getItem(SEARCH_PRESETS_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed as SearchPreset[]
  } catch {
    return []
  }
}

function writePresetsToStorage(presets: SearchPreset[]) {
  if (typeof window === 'undefined') {
    return
  }

  if (presets.length === 0) {
    window.localStorage.removeItem(SEARCH_PRESETS_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(SEARCH_PRESETS_STORAGE_KEY, JSON.stringify(presets))
}

function makePresetId() {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useSearchStore = defineStore('search', {
  state: () => ({
    keyword: '',
    language: '',
    tag: '',
    workspaceId: '',
    updatedFrom: '',
    updatedTo: '',
    page: 1,
    pageSize: 20,
    total: 0,
    items: [] as SearchSnippet[],
    loading: false,
    errorMessage: null as string | null,
    presets: readPresetsFromStorage() as SearchPreset[],
  }),
  getters: {
    totalPages(state) {
      if (state.total === 0) {
        return 1
      }

      return Math.max(1, Math.ceil(state.total / state.pageSize))
    },
  },
  actions: {
    async runSearch(options?: { resetPage?: boolean }) {
      if (options?.resetPage ?? false) {
        this.page = 1
      }

      this.loading = true
      this.errorMessage = null

      try {
        const result = await searchApi.searchSnippets({
          keyword: this.keyword,
          language: this.language,
          tag: this.tag,
          workspaceId: this.workspaceId,
          updatedFrom: this.updatedFrom,
          updatedTo: this.updatedTo,
          page: this.page,
          pageSize: this.pageSize,
        })

        this.items = result.items
        this.total = result.total
        this.page = result.page
        this.pageSize = result.pageSize
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : '搜索失败，请稍后重试。'
      } finally {
        this.loading = false
      }
    },

    clearFilters() {
      this.keyword = ''
      this.language = ''
      this.tag = ''
      this.workspaceId = ''
      this.updatedFrom = ''
      this.updatedTo = ''
      this.page = 1
    },

    setPage(page: number) {
      this.page = Math.max(1, page)
    },

    savePreset(name: string) {
      const trimmedName = name.trim()
      if (!trimmedName) {
        return
      }

      const preset: SearchPreset = {
        id: makePresetId(),
        name: trimmedName,
        query: {
          keyword: this.keyword,
          language: this.language,
          tag: this.tag,
          workspaceId: this.workspaceId,
          updatedFrom: this.updatedFrom,
          updatedTo: this.updatedTo,
          pageSize: this.pageSize,
        },
      }

      this.presets = [preset, ...this.presets].slice(0, 20)
      writePresetsToStorage(this.presets)
    },

    applyPreset(presetId: string) {
      const preset = this.presets.find((item) => item.id === presetId)
      if (!preset) {
        return
      }

      this.keyword = preset.query.keyword
      this.language = preset.query.language
      this.tag = preset.query.tag
      this.workspaceId = preset.query.workspaceId
      this.updatedFrom = preset.query.updatedFrom
      this.updatedTo = preset.query.updatedTo
      this.pageSize = preset.query.pageSize
      this.page = 1
    },

    deletePreset(presetId: string) {
      this.presets = this.presets.filter((item) => item.id !== presetId)
      writePresetsToStorage(this.presets)
    },
  },
})
