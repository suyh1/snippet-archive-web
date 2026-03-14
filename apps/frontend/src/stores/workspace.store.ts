import { defineStore } from 'pinia'
import { workspaceApi } from '@/api/workspaces'
import type {
  CreateWorkspaceFileInput,
  Workspace,
  WorkspaceFile,
} from '@/types/workspace'
import { basename, joinPath, normalizePath } from '@/utils/path'

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

  return 'plaintext'
}

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    workspaces: [] as Workspace[],
    files: [] as WorkspaceFile[],
    currentWorkspaceId: null as string | null,
    loading: false,
    loadingFiles: false,
    saving: false,
    errorMessage: null as string | null,
  }),
  getters: {
    currentWorkspace(state) {
      return state.workspaces.find((item) => item.id === state.currentWorkspaceId) ?? null
    },
    libraryMode(state) {
      return state.currentWorkspaceId === null
    },
  },
  actions: {
    clearError() {
      this.errorMessage = null
    },

    async loadWorkspaces() {
      this.loading = true
      this.errorMessage = null

      try {
        this.workspaces = await workspaceApi.list()
      } catch (error) {
        this.errorMessage =
          error instanceof Error ? error.message : 'Failed to load workspaces'
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
        this.files = await workspaceApi.listFiles(workspaceId)
      } catch (error) {
        this.errorMessage =
          error instanceof Error ? error.message : 'Failed to open workspace'
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
        this.files = await workspaceApi.listFiles(created.id)
      } catch (error) {
        this.errorMessage =
          error instanceof Error ? error.message : 'Failed to create workspace'
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
          this.currentWorkspaceId = next
          if (next) {
            this.files = await workspaceApi.listFiles(next)
          } else {
            this.files = []
          }
        }
      } catch (error) {
        this.errorMessage =
          error instanceof Error ? error.message : 'Failed to delete workspace'
      } finally {
        this.saving = false
      }
    },

    async loadWorkspaceFiles() {
      if (!this.currentWorkspaceId) {
        this.files = []
        return
      }

      this.loadingFiles = true
      this.errorMessage = null

      try {
        this.files = await workspaceApi.listFiles(this.currentWorkspaceId)
      } catch (error) {
        this.errorMessage =
          error instanceof Error ? error.message : 'Failed to load files'
      } finally {
        this.loadingFiles = false
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

      await workspaceApi.createFile(workspaceId, payload)
      await this.loadWorkspaceFiles()
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

      await workspaceApi.createFile(workspaceId, payload)
      await this.loadWorkspaceFiles()
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

      await workspaceApi.moveFile(workspaceId, fileId, {
        targetPath: nextPath,
        targetOrder: 9999,
      })

      await this.loadWorkspaceFiles()
    },
  },
})
