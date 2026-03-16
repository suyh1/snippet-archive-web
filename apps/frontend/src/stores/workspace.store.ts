import { defineStore } from 'pinia'
import { workspaceApi } from '@/api/workspaces'
import type {
  CreateWorkspaceFileInput,
  EditorSnapshot,
  EditorSnapshotSource,
  Workspace,
  WorkspaceFile,
  WorkspaceFileRevision,
} from '@/types/workspace'
import { basename, getParentPath, joinPath, normalizePath } from '@/utils/path'
import { resolveWorkspaceErrorMessage } from '@/utils/error-message'
import {
  applyLanguageToFileName,
  inferLanguageFromFileName,
  normalizeLanguage,
} from '@/utils/language-detect'

const DRAFT_CACHE_STORAGE_KEY = 'workspace-draft-cache-v1'
const SNAPSHOT_CACHE_STORAGE_KEY = 'workspace-snapshot-cache-v1'
const MAX_SNAPSHOTS_PER_FILE = 30

type DraftCacheEntry = {
  workspaceId: string
  fileId: string
  content: string
  language?: string
  updatedAt: number
}

type DraftCacheRecord = Record<string, DraftCacheEntry>
type SnapshotCacheRecord = Record<string, EditorSnapshot[]>

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

function readSnapshotCacheFromStorage(): SnapshotCacheRecord {
  const storage = getBrowserStorage()
  if (!storage) {
    return {}
  }

  const raw = storage.getItem(SNAPSHOT_CACHE_STORAGE_KEY)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    return parsed as SnapshotCacheRecord
  } catch {
    return {}
  }
}

function writeSnapshotCacheToStorage(cache: SnapshotCacheRecord) {
  const storage = getBrowserStorage()
  if (!storage) {
    return
  }

  const keys = Object.keys(cache)
  if (keys.length === 0) {
    storage.removeItem(SNAPSHOT_CACHE_STORAGE_KEY)
    return
  }

  storage.setItem(SNAPSHOT_CACHE_STORAGE_KEY, JSON.stringify(cache))
}

function inferLanguage(name: string) {
  return inferLanguageFromFileName(name) ?? 'plaintext'
}

function normalizeTags(tags: string[]) {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const raw of tags) {
    const value = raw.trim()
    if (!value || seen.has(value)) {
      continue
    }

    seen.add(value)
    normalized.push(value)
  }

  return normalized.slice(0, 50)
}

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    workspaces: [] as Workspace[],
    files: [] as WorkspaceFile[],
    currentWorkspaceId: null as string | null,
    activeFileId: null as string | null,
    draftContent: '',
    draftLanguage: 'plaintext',
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
    resolveLanguageForFile(file: WorkspaceFile) {
      return normalizeLanguage(file.language)
    },

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
      const serverLanguage = this.resolveLanguageForFile(file)
      const entryLanguage = normalizeLanguage(entry.language ?? serverLanguage)

      if (entry.content === serverContent && entryLanguage === serverLanguage) {
        this.removeDraftCacheEntry(workspaceId, file.id)
        return false
      }

      this.draftContent = entry.content
      this.draftLanguage = entryLanguage
      this.dirty = true
      return true
    },

    buildSnapshotCacheKey(workspaceId: string, fileId: string) {
      return `${workspaceId}:${fileId}`
    },

    listSnapshotsForFile(workspaceId: string, fileId: string) {
      const cache = readSnapshotCacheFromStorage()
      const key = this.buildSnapshotCacheKey(workspaceId, fileId)
      return cache[key] ?? []
    },

    setSnapshotsForFile(workspaceId: string, fileId: string, snapshots: EditorSnapshot[]) {
      const cache = readSnapshotCacheFromStorage()
      const key = this.buildSnapshotCacheKey(workspaceId, fileId)
      if (snapshots.length === 0) {
        delete cache[key]
      } else {
        cache[key] = snapshots
      }
      writeSnapshotCacheToStorage(cache)
    },

    getActiveFileSnapshots() {
      const workspaceId = this.currentWorkspaceId
      const fileId = this.activeFileId
      if (!workspaceId || !fileId) {
        return []
      }

      return this.listSnapshotsForFile(workspaceId, fileId)
    },

    createSnapshotForActiveFile(source: EditorSnapshotSource = 'manual') {
      const workspaceId = this.currentWorkspaceId
      const active = this.files.find((item) => item.id === this.activeFileId)
      if (!workspaceId || !active || active.kind !== 'file') {
        return null
      }

      const existing = this.listSnapshotsForFile(workspaceId, active.id)
      const normalizedLanguage = normalizeLanguage(this.draftLanguage)
      const latest = existing[0]
      if (
        latest &&
        latest.content === this.draftContent &&
        normalizeLanguage(latest.language) === normalizedLanguage
      ) {
        return latest
      }

      const snapshot: EditorSnapshot = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        workspaceId,
        fileId: active.id,
        content: this.draftContent,
        language: normalizedLanguage,
        source,
        createdAt: Date.now(),
      }

      const next = [snapshot, ...existing].slice(0, MAX_SNAPSHOTS_PER_FILE)
      this.setSnapshotsForFile(workspaceId, active.id, next)
      return snapshot
    },

    restoreSnapshotForActiveFile(snapshotId: string) {
      const workspaceId = this.currentWorkspaceId
      const active = this.files.find((item) => item.id === this.activeFileId)
      if (!workspaceId || !active || active.kind !== 'file') {
        return false
      }

      const snapshots = this.listSnapshotsForFile(workspaceId, active.id)
      const target = snapshots.find((item) => item.id === snapshotId)
      if (!target) {
        return false
      }

      this.setDraftLanguage(target.language)
      this.setDraftContent(target.content)
      return true
    },

    pruneWorkspaceSnapshots(workspaceId: string, currentFiles: WorkspaceFile[]) {
      const cache = readSnapshotCacheFromStorage()
      const currentFileIds = new Set(
        currentFiles
          .filter((file) => file.kind === 'file')
          .map((file) => file.id),
      )
      let changed = false

      for (const [key, snapshots] of Object.entries(cache)) {
        if (!Array.isArray(snapshots) || snapshots.length === 0) {
          delete cache[key]
          changed = true
          continue
        }

        const filtered = snapshots.filter((snapshot) => {
          if (snapshot.workspaceId !== workspaceId) {
            return true
          }

          return currentFileIds.has(snapshot.fileId)
        })

        if (filtered.length !== snapshots.length) {
          changed = true
        }

        if (filtered.length === 0) {
          delete cache[key]
        } else if (filtered.length !== snapshots.length) {
          cache[key] = filtered
        }
      }

      if (changed) {
        writeSnapshotCacheToStorage(cache)
      }
    },

    clearError() {
      this.errorMessage = null
    },

    resetEditor() {
      this.activeFileId = null
      this.draftContent = ''
      this.draftLanguage = 'plaintext'
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
        this.draftLanguage = this.resolveLanguageForFile(selected)
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
        this.pruneWorkspaceSnapshots(workspaceId, this.files)
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

    async updateWorkspaceMeta(
      workspaceId: string,
      payload: Partial<Pick<Workspace, 'tags' | 'starred'>>,
    ) {
      this.saving = true
      this.errorMessage = null

      try {
        const updated = await workspaceApi.update(workspaceId, {
          ...payload,
          ...(payload.tags ? { tags: normalizeTags(payload.tags) } : {}),
        })

        const index = this.workspaces.findIndex((item) => item.id === workspaceId)
        if (index >= 0) {
          this.workspaces[index] = updated
        } else {
          this.workspaces = [updated, ...this.workspaces]
        }
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '更新工作区信息失败，请稍后重试。',
        )
      } finally {
        this.saving = false
      }
    },

    async toggleWorkspaceStar(workspaceId: string) {
      const target = this.workspaces.find((item) => item.id === workspaceId)
      if (!target) {
        return
      }

      await this.updateWorkspaceMeta(workspaceId, {
        starred: !target.starred,
      })
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

          const snapshotCache = readSnapshotCacheFromStorage()
          let snapshotChanged = false
          for (const [key, snapshots] of Object.entries(snapshotCache)) {
            const filtered = snapshots.filter((snapshot) => snapshot.workspaceId !== workspaceId)
            if (filtered.length !== snapshots.length) {
              snapshotChanged = true
            }

            if (filtered.length === 0) {
              delete snapshotCache[key]
            } else if (filtered.length !== snapshots.length) {
              snapshotCache[key] = filtered
            }
          }
          if (snapshotChanged) {
            writeSnapshotCacheToStorage(snapshotCache)
          }

          this.currentWorkspaceId = next
          if (next) {
            this.files = await workspaceApi.listFiles(next)
            this.pruneWorkspaceDraftCache(next, this.files)
            this.pruneWorkspaceSnapshots(next, this.files)
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
        this.pruneWorkspaceSnapshots(this.currentWorkspaceId, this.files)
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
      this.draftLanguage = this.resolveLanguageForFile(file)
      this.dirty = false
    },

    setDraftContent(content: string) {
      this.draftContent = content

      const active = this.files.find((item) => item.id === this.activeFileId)
      if (!active || active.kind !== 'file') {
        this.dirty = false
        return
      }

      const expectedLanguage = this.resolveLanguageForFile(active)
      this.dirty =
        content !== (active.content ?? '') ||
        this.draftLanguage !== expectedLanguage

      if (!this.currentWorkspaceId) {
        return
      }

      if (this.dirty) {
        this.setDraftCacheEntry({
          workspaceId: this.currentWorkspaceId,
          fileId: active.id,
          content,
          language: this.draftLanguage,
          updatedAt: Date.now(),
        })
        return
      }

      this.removeDraftCacheEntry(this.currentWorkspaceId, active.id)
    },

    setDraftLanguage(language: string) {
      const active = this.files.find((item) => item.id === this.activeFileId)
      if (!active || active.kind !== 'file') {
        this.draftLanguage = normalizeLanguage(language)
        this.dirty = false
        return
      }

      this.draftLanguage = normalizeLanguage(language)

      const expectedLanguage = this.resolveLanguageForFile(active)
      this.dirty =
        this.draftContent !== (active.content ?? '') ||
        this.draftLanguage !== expectedLanguage

      if (!this.currentWorkspaceId) {
        return
      }

      if (this.dirty) {
        this.setDraftCacheEntry({
          workspaceId: this.currentWorkspaceId,
          fileId: active.id,
          content: this.draftContent,
          language: this.draftLanguage,
          updatedAt: Date.now(),
        })
        return
      }

      this.removeDraftCacheEntry(this.currentWorkspaceId, active.id)
    },

    async applyActiveFileLanguagePreference(language: string) {
      const active = this.files.find((item) => item.id === this.activeFileId)
      if (!active || active.kind !== 'file') {
        this.setDraftLanguage(language)
        return
      }

      const normalizedLanguage = normalizeLanguage(language)
      const nextName = applyLanguageToFileName(active.name, normalizedLanguage)

      this.setDraftLanguage(normalizedLanguage)

      if (nextName === active.name) {
        return
      }

      await this.renameFile(active.id, nextName, normalizedLanguage)

      const refreshed = this.files.find((item) => item.id === active.id)
      if (!refreshed || refreshed.kind !== 'file') {
        return
      }

      const expectedLanguage = this.resolveLanguageForFile(refreshed)
      this.dirty =
        this.draftContent !== (refreshed.content ?? '') ||
        this.draftLanguage !== expectedLanguage

      if (!this.currentWorkspaceId) {
        return
      }

      if (this.dirty) {
        this.setDraftCacheEntry({
          workspaceId: this.currentWorkspaceId,
          fileId: refreshed.id,
          content: this.draftContent,
          language: this.draftLanguage,
          updatedAt: Date.now(),
        })
        return
      }

      this.removeDraftCacheEntry(this.currentWorkspaceId, refreshed.id)
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
          language: this.draftLanguage,
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

    async listActiveFileRevisions() {
      const workspaceId = this.currentWorkspaceId
      const active = this.files.find((item) => item.id === this.activeFileId)

      if (!workspaceId || !active || active.kind !== 'file') {
        return [] as WorkspaceFileRevision[]
      }

      this.errorMessage = null

      try {
        return await workspaceApi.listFileRevisions(workspaceId, active.id)
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '加载版本历史失败，请稍后重试。',
        )
        return [] as WorkspaceFileRevision[]
      }
    },

    async restoreActiveFileRevision(revisionId: string) {
      const workspaceId = this.currentWorkspaceId
      const active = this.files.find((item) => item.id === this.activeFileId)

      if (!workspaceId || !active || active.kind !== 'file') {
        return false
      }

      this.saving = true
      this.errorMessage = null

      try {
        const restored = await workspaceApi.restoreFileRevision(
          workspaceId,
          active.id,
          revisionId,
        )

        this.files = this.files.map((item) => (item.id === restored.id ? restored : item))

        if (this.activeFileId === restored.id && restored.kind === 'file') {
          this.draftContent = restored.content ?? ''
          this.draftLanguage = this.resolveLanguageForFile(restored)
          this.dirty = false
          this.removeDraftCacheEntry(workspaceId, restored.id)
        }

        return true
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '回滚版本失败，请稍后重试。',
        )
        return false
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

    async renameFile(fileId: string, newName: string, languageOverride?: string) {
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
      const targetLanguage = normalizeLanguage(
        languageOverride ?? inferLanguageFromFileName(trimmed) ?? file.language,
      )

      this.errorMessage = null

      try {
        await workspaceApi.moveFile(workspaceId, fileId, {
          targetPath,
          targetOrder: file.order,
        })

        await workspaceApi.updateFile(workspaceId, fileId, {
          name: trimmed,
          language: targetLanguage,
        })

        await this.loadWorkspaceFiles()
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '重命名失败，请稍后重试。',
        )
      }
    },

    async updateFileMeta(
      fileId: string,
      payload: Partial<Pick<WorkspaceFile, 'tags' | 'starred'>>,
    ) {
      const workspaceId = this.currentWorkspaceId
      if (!workspaceId) {
        return
      }

      const target = this.files.find((item) => item.id === fileId)
      if (!target || target.kind !== 'file') {
        return
      }

      this.errorMessage = null

      try {
        const updated = await workspaceApi.updateFile(workspaceId, fileId, {
          ...payload,
          ...(payload.tags ? { tags: normalizeTags(payload.tags) } : {}),
        })

        this.files = this.files.map((item) => (item.id === fileId ? updated : item))
      } catch (error) {
        this.errorMessage = resolveWorkspaceErrorMessage(
          error,
          '更新文件信息失败，请稍后重试。',
        )
      }
    },

    async toggleActiveFileStar() {
      const active = this.files.find((item) => item.id === this.activeFileId)
      if (!active || active.kind !== 'file') {
        return
      }

      await this.updateFileMeta(active.id, {
        starred: !(active.starred ?? false),
      })
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
        this.setSnapshotsForFile(workspaceId, fileId, [])
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
