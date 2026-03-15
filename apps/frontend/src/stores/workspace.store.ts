import { defineStore } from 'pinia'
import { workspaceApi } from '@/api/workspaces'
import type {
  CreateWorkspaceFileInput,
  Workspace,
  WorkspaceFile,
} from '@/types/workspace'
import { basename, getParentPath, joinPath, normalizePath } from '@/utils/path'
import { resolveWorkspaceErrorMessage } from '@/utils/error-message'

const DRAFT_CACHE_STORAGE_KEY = 'workspace-draft-cache-v1'

type DraftCacheEntry = {
  workspaceId: string
  fileId: string
  content: string
  updatedAt: number
}

type DraftCacheRecord = Record<string, DraftCacheEntry>

function getBrowserStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readDraftCacheFromStorage(): DraftCacheRecord {
  const storage = getBrowserStorage()
  if (!storage) {
    return {}
  }

  const raw = storage.getItem(DRAFT_CACHE_STORAGE_KEY)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    return parsed as DraftCacheRecord
  } catch {
    return {}
  }
}

function writeDraftCacheToStorage(cache: DraftCacheRecord) {
  const storage = getBrowserStorage()
  if (!storage) {
    return
  }

  const keys = Object.keys(cache)
  if (keys.length === 0) {
    storage.removeItem(DRAFT_CACHE_STORAGE_KEY)
    return
  }

  storage.setItem(DRAFT_CACHE_STORAGE_KEY, JSON.stringify(cache))
}

function inferLanguage(name: string) {
  if (name.endsWith('.ts')) {
    return 'typescript'
  }

  if (name.endsWith('.js')) {
    return 'javascript'
  }

  if (name.endsWith('.vue')) {
    return 'vue'
  }

  if (name.endsWith('.json')) {
    return 'json'
  }

  if (name.endsWith('.md')) {
    return 'markdown'
  }

  return 'plaintext'
}

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    workspaces: [] as Workspace[],
    files: [] as WorkspaceFile[],
    currentWorkspaceId: null as string | null,
    activeFileId: null as string | null,
    draftContent: '',
    dirty: false,
    loading: false,
    loadingFiles: false,
    saving: false,
    errorMessage: null as string | null,
  }),
  getters: {
    currentWorkspace(state) {
      return state.workspaces.find((item) => item.id === state.currentWorkspaceId) ?? null
    },
    activeFile(state) {
      return state.files.find((item) => item.id === state.activeFileId) ?? null
    },
    libraryMode(state) {
      return state.currentWorkspaceId === null
    },
  },
  actions: {
    buildDraftCacheKey(workspaceId: string, fileId: string) {
      return `${workspaceId}:${fileId}`
    },

    getDraftCacheEntry(workspaceId: string, fileId: string) {
      const cache = readDraftCacheFromStorage()
      return cache[this.buildDraftCacheKey(workspaceId, fileId)] ?? null
    },

    setDraftCacheEntry(entry: DraftCacheEntry) {
      const cache = readDraftCacheFromStorage()
      cache[this.buildDraftCacheKey(entry.workspaceId, entry.fileId)] = entry
      writeDraftCacheToStorage(cache)
    },

    removeDraftCacheEntry(workspaceId: string, fileId: string) {
      const cache = readDraftCacheFromStorage()
      const key = this.buildDraftCacheKey(workspaceId, fileId)

      if (!(key in cache)) {
        return
      }

      delete cache[key]
      writeDraftCacheToStorage(cache)
    },

    pruneWorkspaceDraftCache(workspaceId: string, currentFiles: WorkspaceFile[]) {
      const cache = readDraftCacheFromStorage()
      const currentFileIds = new Set(currentFiles.map((file) => file.id))
      let changed = false

      for (const [key, entry] of Object.entries(cache)) {
        if (entry.workspaceId !== workspaceId) {
          continue
        }

        if (!currentFileIds.has(entry.fileId)) {
          delete cache[key]
          changed = true
        }
      }

      if (changed) {
        writeDraftCacheToStorage(cache)
      }
    },

    tryRestoreDraftForFile(file: WorkspaceFile) {
      if (file.kind !== 'file') {
        return false
      }

      const workspaceId = this.currentWorkspaceId
      if (!workspaceId) {
        return false
      }

      const entry = this.getDraftCacheEntry(workspaceId, file.id)
      if (!entry) {
        return false
      }

      const serverContent = file.content ?? ''
      if (entry.content === serverContent) {
        this.removeDraftCacheEntry(workspaceId, file.id)
        return false
      }

      this.draftContent = entry.content
      this.dirty = true
      return true
    },

    clearError() {
      this.errorMessage = null
    },

    resetEditor() {
      this.activeFileId = null
      this.draftContent = ''
      this.dirty = false
    },

    syncEditorWithFiles() {
      if (!this.activeFileId) {
        return
      }

      const selected = this.files.find((item) => item.id === this.activeFileId)
      if (!selected || selected.kind !== 'file') {
        this.resetEditor()
        return
      }

      if (this.tryRestoreDraftForFile(selected)) {
        return
      }

      if (!this.dirty) {
        this.draftContent = selected.content ?? ''
      }
    },

    async loadWorkspaces() {
      this.loading = true
      this.errorMessage = null

      try {
        this.workspaces = await workspaceApi.list()
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '加载工作区失败，请稍后重试。',
        )
      } finally {
        this.loading = false
      }
    },

    async openWorkspace(workspaceId: string) {
      this.loadingFiles = true
      this.errorMessage = null

      try {
        const detail = await workspaceApi.get(workspaceId)
        const existedIndex = this.workspaces.findIndex((item) => item.id === workspaceId)

        if (existedIndex >= 0) {
          this.workspaces[existedIndex] = detail
        } else {
          this.workspaces = [detail, ...this.workspaces]
        }

        this.currentWorkspaceId = workspaceId
        this.resetEditor()
        this.files = await workspaceApi.listFiles(workspaceId)
        this.pruneWorkspaceDraftCache(workspaceId, this.files)
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '打开工作区失败，请稍后重试。',
        )
      } finally {
        this.loadingFiles = false
      }
    },

    async createWorkspace(title: string) {
      const trimmedTitle = title.trim()
      if (!trimmedTitle) {
        return
      }

      this.saving = true
      this.errorMessage = null

      try {
        const created = await workspaceApi.create({ title: trimmedTitle })
        this.workspaces = [created, ...this.workspaces]
        this.currentWorkspaceId = created.id
        this.resetEditor()
        this.files = await workspaceApi.listFiles(created.id)
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '创建工作区失败，请稍后重试。',
        )
      } finally {
        this.saving = false
      }
    },

    async deleteWorkspace(workspaceId: string) {
      this.saving = true
      this.errorMessage = null

      try {
        await workspaceApi.delete(workspaceId)
        this.workspaces = this.workspaces.filter((item) => item.id !== workspaceId)

        if (this.currentWorkspaceId === workspaceId) {
          const next = this.workspaces[0]?.id ?? null
          const cache = readDraftCacheFromStorage()
          let changed = false
          for (const [key, entry] of Object.entries(cache)) {
            if (entry.workspaceId === workspaceId) {
              delete cache[key]
              changed = true
            }
          }
          if (changed) {
            writeDraftCacheToStorage(cache)
          }

          this.currentWorkspaceId = next
          if (next) {
            this.files = await workspaceApi.listFiles(next)
            this.pruneWorkspaceDraftCache(next, this.files)
          } else {
            this.files = []
          }
          this.resetEditor()
        }
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '删除工作区失败，请稍后重试。',
        )
      } finally {
        this.saving = false
      }
    },

    async loadWorkspaceFiles() {
      if (!this.currentWorkspaceId) {
        this.files = []
        this.resetEditor()
        return
      }

      this.loadingFiles = true
      this.errorMessage = null

      try {
        this.files = await workspaceApi.listFiles(this.currentWorkspaceId)
        this.pruneWorkspaceDraftCache(this.currentWorkspaceId, this.files)
        this.syncEditorWithFiles()
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '加载文件列表失败，请稍后重试。',
        )
      } finally {
        this.loadingFiles = false
      }
    },

    selectFile(fileId: string) {
      const file = this.files.find((item) => item.id === fileId)
      if (!file || file.kind !== 'file') {
        return
      }

      this.activeFileId = file.id
      if (this.tryRestoreDraftForFile(file)) {
        return
      }

      this.draftContent = file.content ?? ''
      this.dirty = false
    },

    setDraftContent(content: string) {
      this.draftContent = content

      const active = this.files.find((item) => item.id === this.activeFileId)
      if (!active || active.kind !== 'file') {
        this.dirty = false
        return
      }

      this.dirty = content !== (active.content ?? '')

      if (!this.currentWorkspaceId) {
        return
      }

      if (this.dirty) {
        this.setDraftCacheEntry({
          workspaceId: this.currentWorkspaceId,
          fileId: active.id,
          content,
          updatedAt: Date.now(),
        })
        return
      }

      this.removeDraftCacheEntry(this.currentWorkspaceId, active.id)
    },

    async saveCurrentFile() {
      const workspaceId = this.currentWorkspaceId
      const fileId = this.activeFileId

      if (!workspaceId || !fileId || !this.dirty) {
        return
      }

      this.saving = true
      this.errorMessage = null

      try {
        await workspaceApi.updateFile(workspaceId, fileId, {
          content: this.draftContent,
        })

        this.removeDraftCacheEntry(workspaceId, fileId)
        await this.loadWorkspaceFiles()
        this.dirty = false
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '保存文件失败，请稍后重试。',
        )
      } finally {
        this.saving = false
      }
    },

    async createFile(parentPath: string, name: string) {
      const workspaceId = this.currentWorkspaceId
      if (!workspaceId) {
        return
      }

      const payload: CreateWorkspaceFileInput = {
        name,
        path: joinPath(parentPath, name),
        language: inferLanguage(name),
        content: '',
        kind: 'file',
        order: 9999,
      }

      this.errorMessage = null

      try {
        await workspaceApi.createFile(workspaceId, payload)
        await this.loadWorkspaceFiles()
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '新建文件失败，请稍后重试。',
        )
      }
    },

    async createFolder(parentPath: string, name: string) {
      const workspaceId = this.currentWorkspaceId
      if (!workspaceId) {
        return
      }

      const payload: CreateWorkspaceFileInput = {
        name,
        path: joinPath(parentPath, name),
        language: 'plaintext',
        content: '',
        kind: 'folder',
        order: 9999,
      }

      this.errorMessage = null

      try {
        await workspaceApi.createFile(workspaceId, payload)
        await this.loadWorkspaceFiles()
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '新建文件夹失败，请稍后重试。',
        )
      }
    },

    async moveFileToParent(fileId: string, targetParentPath: string) {
      const workspaceId = this.currentWorkspaceId
      if (!workspaceId) {
        return
      }

      const file = this.files.find((item) => item.id === fileId)
      if (!file) {
        return
      }

      const nextPath = normalizePath(joinPath(targetParentPath, basename(file.path)))
      if (nextPath === normalizePath(file.path)) {
        return
      }

      this.errorMessage = null

      try {
        await workspaceApi.moveFile(workspaceId, fileId, {
          targetPath: nextPath,
          targetOrder: 9999,
        })

        await this.loadWorkspaceFiles()
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '移动文件失败，请稍后重试。',
        )
      }
    },

    async renameFile(fileId: string, newName: string) {
      const workspaceId = this.currentWorkspaceId
      if (!workspaceId) {
        return
      }

      const trimmed = newName.trim()
      if (!trimmed) {
        return
      }

      const file = this.files.find((item) => item.id === fileId)
      if (!file) {
        return
      }

      const targetPath = normalizePath(joinPath(getParentPath(file.path), trimmed))

      this.errorMessage = null

      try {
        await workspaceApi.moveFile(workspaceId, fileId, {
          targetPath,
          targetOrder: file.order,
        })

        await workspaceApi.updateFile(workspaceId, fileId, {
          name: trimmed,
        })

        await this.loadWorkspaceFiles()
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '重命名失败，请稍后重试。',
        )
      }
    },

    async deleteFile(fileId: string) {
      const workspaceId = this.currentWorkspaceId
      if (!workspaceId) {
        return false
      }

      this.errorMessage = null
      const target = this.files.find((item) => item.id === fileId)

      try {
        await workspaceApi.deleteFile(workspaceId, fileId)
        this.removeDraftCacheEntry(workspaceId, fileId)
        await this.loadWorkspaceFiles()
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '删除失败，请稍后重试。',
        )
        return false
      }

      if (!target) {
        return true
      }

      if (this.activeFileId === fileId) {
        this.resetEditor()
        return true
      }

      const active = this.files.find((item) => item.id === this.activeFileId)
      if (!active) {
        this.resetEditor()
        return true
      }

      if (target.kind === 'folder') {
        const normalizedTargetPath = normalizePath(target.path)
        const normalizedActivePath = normalizePath(active.path)

        if (
          normalizedActivePath === normalizedTargetPath ||
          normalizedActivePath.startsWith(`${normalizedTargetPath}/`)
        ) {
          this.resetEditor()
        }
      }

      return true
    },

    async restoreDeletedFile(snapshot: WorkspaceFile) {
      const workspaceId = this.currentWorkspaceId
      if (!workspaceId || snapshot.workspaceId !== workspaceId) {
        return false
      }

      this.errorMessage = null

      try {
        await workspaceApi.createFile(workspaceId, {
          name: snapshot.name,
          path: snapshot.path,
          language: snapshot.language,
          content: snapshot.content,
          kind: snapshot.kind,
          order: snapshot.order,
        })

        await this.loadWorkspaceFiles()
        return true
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '撤销删除失败，请稍后重试。',
        )
        return false
      }
    },
  },
})
