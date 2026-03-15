<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import FileTree from '@/features/workspace/FileTree.vue'
import WorkspaceSidebar from '@/features/workspace/WorkspaceSidebar.vue'
import { useWorkspaceStore } from '@/stores/workspace.store'

const workspaceStore = useWorkspaceStore()

const {
  workspaces,
  currentWorkspaceId,
  currentWorkspace,
  files,
  activeFile,
  loading,
  loadingFiles,
  saving,
  libraryMode,
  errorMessage,
  draftContent,
  dirty,
} = storeToRefs(workspaceStore)

const canSave = computed(() => {
  return !!activeFile.value && activeFile.value.kind === 'file' && dirty.value && !saving.value
})

onMounted(async () => {
  await workspaceStore.loadWorkspaces()
})

function openWorkspace(workspaceId: string) {
  void workspaceStore.openWorkspace(workspaceId)
}

function createWorkspace(title: string) {
  void workspaceStore.createWorkspace(title)
}

function deleteWorkspace(workspaceId: string) {
  const target = workspaces.value.find((item) => item.id === workspaceId)
  const confirmed = window.confirm(`确认删除工作区「${target?.title ?? workspaceId}」？`)

  if (!confirmed) {
    return
  }

  void workspaceStore.deleteWorkspace(workspaceId)
}

function backToLibrary() {
  workspaceStore.currentWorkspaceId = null
  workspaceStore.files = []
  workspaceStore.resetEditor()
}

function createFile(parentPath: string) {
  const name = window.prompt('新文件名（例如 main.ts）', 'main.ts')?.trim()

  if (!name) {
    return
  }

  void workspaceStore.createFile(parentPath, name)
}

function createFolder(parentPath: string) {
  const name = window.prompt('新文件夹名', 'new-folder')?.trim()

  if (!name) {
    return
  }

  void workspaceStore.createFolder(parentPath, name)
}

function moveFile(payload: { fileId: string; targetParentPath: string }) {
  void workspaceStore.moveFileToParent(payload.fileId, payload.targetParentPath)
}

function selectFile(fileId: string) {
  workspaceStore.selectFile(fileId)
}

function renameFile(fileId: string) {
  const target = files.value.find((item) => item.id === fileId)
  if (!target) {
    return
  }

  const nextName = window.prompt('输入新名称', target.name)?.trim()
  if (!nextName || nextName === target.name) {
    return
  }

  void workspaceStore.renameFile(fileId, nextName)
}

function deleteFile(fileId: string) {
  const target = files.value.find((item) => item.id === fileId)
  const confirmed = window.confirm(`确认删除「${target?.name ?? fileId}」？`)

  if (!confirmed) {
    return
  }

  void workspaceStore.deleteFile(fileId)
}

function onDraftInput(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  workspaceStore.setDraftContent(value)
}

function saveFile() {
  void workspaceStore.saveCurrentFile()
}
</script>

<template>
  <main class="app-shell">
    <WorkspaceSidebar
      :workspaces="workspaces"
      :active-workspace-id="currentWorkspaceId"
      :loading="loading"
      :saving="saving"
      @open="openWorkspace"
      @create="createWorkspace"
      @delete="deleteWorkspace"
      @library="backToLibrary"
    />

    <section class="content">
      <header class="content-head">
        <div>
          <p class="eyebrow">Workspace Console</p>
          <h2>
            {{
              libraryMode
                ? 'Library View'
                : currentWorkspace?.title ?? 'Workspace'
            }}
          </h2>
        </div>

        <p class="meta">
          {{ workspaces.length }} workspaces · {{ files.length }} files
        </p>
      </header>

      <p v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </p>

      <section v-if="libraryMode" class="library-view">
        <article class="summary-card">
          <h3>准备好开始了吗？</h3>
          <p>
            你可以从左侧创建工作区，或直接打开已有工作区进入文件树模式。
            当前已接入真实后端 API。
          </p>
        </article>

        <div class="workspace-grid">
          <button
            v-for="item in workspaces"
            :key="item.id"
            type="button"
            class="workspace-tile"
            @click="openWorkspace(item.id)"
          >
            <strong>{{ item.title }}</strong>
            <span>{{ item.description || '无描述' }}</span>
          </button>

          <p v-if="workspaces.length === 0" class="empty-note">
            还没有任何工作区，先从左侧「新建」创建第一个工作区。
          </p>
        </div>
      </section>

      <section v-else class="workspace-view">
        <article class="summary-card">
          <h3>{{ currentWorkspace?.title }}</h3>
          <p>
            支持文件编辑保存、重命名与删除。拖拽文件/文件夹时会提示合法与非法目标。
          </p>
        </article>

        <div class="workspace-main">
          <FileTree
            :files="files"
            :loading="loadingFiles"
            :active-file-id="activeFile?.id ?? null"
            @create-file="createFile"
            @create-folder="createFolder"
            @move-file="moveFile"
            @select-file="selectFile"
            @rename-file="renameFile"
            @delete-file="deleteFile"
          />

          <section class="editor-panel">
            <header class="editor-head">
              <h3>{{ activeFile?.name ?? 'Editor' }}</h3>
              <button
                type="button"
                :disabled="!canSave"
                @click="saveFile"
              >
                {{ saving ? '保存中...' : dirty ? '保存' : '已保存' }}
              </button>
            </header>

            <textarea
              v-if="activeFile"
              class="editor-textarea"
              :value="draftContent"
              @input="onDraftInput"
            />

            <p v-else class="editor-empty">
              先在左侧创建或选择文件，然后开始编辑。
            </p>
          </section>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  background:
    radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.16), transparent 38%),
    radial-gradient(circle at 80% 0%, rgba(16, 185, 129, 0.14), transparent 34%),
    #f8fafc;
}

.content {
  padding: 22px;
  display: grid;
  gap: 14px;
}

.content-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0;
  color: #0f766e;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.07em;
  font-weight: 700;
}

h2 {
  margin: 4px 0 0;
  font-size: 30px;
  line-height: 1.1;
}

.meta {
  margin: 0;
  color: #334155;
  font-size: 13px;
}

.error-banner {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
  border-radius: 10px;
}

.library-view,
.workspace-view {
  display: grid;
  gap: 14px;
}

.summary-card {
  background: #ffffff;
  border: 1px solid #dbeafe;
  border-radius: 16px;
  padding: 16px;
}

.summary-card h3 {
  margin: 0 0 8px;
  font-size: 20px;
}

.summary-card p {
  margin: 0;
  color: #334155;
  line-height: 1.6;
}

.workspace-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.workspace-tile {
  border: 1px solid #dbeafe;
  background: white;
  border-radius: 12px;
  padding: 12px;
  text-align: left;
  display: grid;
  gap: 6px;
  cursor: pointer;
}

.workspace-tile strong {
  font-size: 15px;
}

.workspace-tile span {
  color: #64748b;
  font-size: 13px;
}

.empty-note {
  margin: 0;
  color: #64748b;
}

.workspace-main {
  display: grid;
  grid-template-columns: minmax(360px, 1fr) minmax(320px, 1fr);
  gap: 14px;
}

.editor-panel {
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 16px;
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 420px;
}

.editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.editor-head h3 {
  margin: 0;
  font-size: 16px;
}

.editor-head button {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
}

.editor-head button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.editor-textarea {
  width: 100%;
  height: 100%;
  border: none;
  padding: 12px;
  resize: none;
  outline: none;
  font-family: 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 0 0 16px 16px;
}

.editor-empty {
  margin: 0;
  display: grid;
  place-items: center;
  color: #64748b;
}

@media (max-width: 1200px) {
  .workspace-main {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .app-shell {
    grid-template-columns: 1fr;
  }
}
</style>
