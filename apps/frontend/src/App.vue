<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import CodeEditor, { type CodeEditorTheme } from '@/features/workspace/CodeEditor.vue'
import CreateNodeDialog from '@/features/workspace/CreateNodeDialog.vue'
import FileTree from '@/features/workspace/FileTree.vue'
import RenameDialog from '@/features/workspace/RenameDialog.vue'
import UnsavedChangesDialog from '@/features/workspace/UnsavedChangesDialog.vue'
import WorkspaceSidebar from '@/features/workspace/WorkspaceSidebar.vue'
import { useUnsavedGuard } from '@/composables/useUnsavedGuard'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { getParentPath } from '@/utils/path'
import { validateRenameInput } from '@/utils/rename-validation'

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

const resolvingUnsavedSave = ref(false)
const {
  dialogOpen: unsavedDialogOpen,
  requestDecision,
  resolveDecision,
} = useUnsavedGuard(dirty)
const renameDialogOpen = ref(false)
const renameTargetId = ref<string | null>(null)
const renameDraftValue = ref('')
const renameSubmitting = ref(false)
const createDialogOpen = ref(false)
const createNodeKind = ref<'file' | 'folder'>('file')
const createParentPath = ref('/')
const createDraftValue = ref('')
const createSubmitting = ref(false)
const editorTheme = ref<CodeEditorTheme>('glacier-night')
const editorThemeOptions: Array<{ label: string; value: CodeEditorTheme }> = [
  { label: '冰川夜幕', value: 'glacier-night' },
  { label: '水雾暮色', value: 'aqua-dusk' },
  { label: '珍珠浅光', value: 'pearl-light' },
]

const renameTarget = computed(() => {
  if (!renameTargetId.value) {
    return null
  }

  return files.value.find((item) => item.id === renameTargetId.value) ?? null
})

const renameSiblingNames = computed(() => {
  if (!renameTarget.value) {
    return []
  }

  const parentPath = getParentPath(renameTarget.value.path)
  return files.value
    .filter(
      (item) =>
        item.id !== renameTarget.value?.id &&
        getParentPath(item.path) === parentPath,
    )
    .map((item) => item.name)
})

const renameErrorMessage = computed(() => {
  if (!renameDialogOpen.value) {
    return null
  }

  return validateRenameInput(renameDraftValue.value, renameSiblingNames.value)
})

const renameConfirmDisabled = computed(() => {
  return !renameTarget.value || !!renameErrorMessage.value || renameSubmitting.value
})

const createSiblingNames = computed(() => {
  const parentPath = createParentPath.value
  return files.value
    .filter((item) => getParentPath(item.path) === parentPath)
    .map((item) => item.name)
})

const createErrorMessage = computed(() => {
  if (!createDialogOpen.value) {
    return null
  }

  return validateRenameInput(createDraftValue.value, createSiblingNames.value)
})

const createConfirmDisabled = computed(() => {
  return createSubmitting.value || !!createErrorMessage.value
})

onMounted(async () => {
  const storedTheme = window.localStorage.getItem('editor-theme')
  if (
    storedTheme === 'glacier-night' ||
    storedTheme === 'aqua-dusk' ||
    storedTheme === 'pearl-light'
  ) {
    editorTheme.value = storedTheme
  }

  await workspaceStore.loadWorkspaces()
})

watch(editorTheme, (theme) => {
  window.localStorage.setItem('editor-theme', theme)
})

function resolveUnsavedChoice(decision: 'save' | 'discard' | 'cancel') {
  resolveDecision(decision)
}

async function runWithUnsavedGuard(action: () => void | Promise<void>) {
  if (!dirty.value) {
    await action()
    return
  }

  const decision = await requestDecision()
  if (decision === 'cancel') {
    return
  }

  if (decision === 'save') {
    resolvingUnsavedSave.value = true
    await workspaceStore.saveCurrentFile()
    resolvingUnsavedSave.value = false

    if (dirty.value) {
      return
    }
  }

  await action()
}

function openWorkspace(workspaceId: string) {
  if (workspaceId === currentWorkspaceId.value) {
    return
  }

  void runWithUnsavedGuard(async () => {
    await workspaceStore.openWorkspace(workspaceId)
  })
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
  if (libraryMode.value) {
    return
  }

  void runWithUnsavedGuard(() => {
    workspaceStore.currentWorkspaceId = null
    workspaceStore.files = []
    workspaceStore.resetEditor()
  })
}

function createFile(parentPath: string) {
  openCreateDialog(parentPath, 'file')
}

function createFolder(parentPath: string) {
  openCreateDialog(parentPath, 'folder')
}

function moveFile(payload: { fileId: string; targetParentPath: string }) {
  void workspaceStore.moveFileToParent(payload.fileId, payload.targetParentPath)
}

function selectFile(fileId: string) {
  if (fileId === activeFile.value?.id) {
    return
  }

  void runWithUnsavedGuard(() => {
    workspaceStore.selectFile(fileId)
  })
}

function openRenameDialog(fileId: string) {
  const target = files.value.find((item) => item.id === fileId)
  if (!target) {
    return
  }

  renameTargetId.value = fileId
  renameDraftValue.value = target.name
  renameDialogOpen.value = true
}

function closeRenameDialog() {
  renameDialogOpen.value = false
  renameTargetId.value = null
  renameDraftValue.value = ''
  renameSubmitting.value = false
}

async function confirmRename() {
  if (!renameTarget.value) {
    return
  }

  const nextName = renameDraftValue.value
  if (nextName === renameTarget.value.name) {
    closeRenameDialog()
    return
  }

  if (validateRenameInput(nextName, renameSiblingNames.value)) {
    return
  }

  renameSubmitting.value = true
  await workspaceStore.renameFile(renameTarget.value.id, nextName)
  renameSubmitting.value = false

  if (!workspaceStore.errorMessage) {
    closeRenameDialog()
  }
}

function deleteFile(fileId: string) {
  const target = files.value.find((item) => item.id === fileId)
  const confirmed = window.confirm(`确认删除「${target?.name ?? fileId}」？`)

  if (!confirmed) {
    return
  }

  void workspaceStore.deleteFile(fileId)
}

function saveFile() {
  void workspaceStore.saveCurrentFile()
}

function openCreateDialog(parentPath: string, kind: 'file' | 'folder') {
  createDialogOpen.value = true
  createNodeKind.value = kind
  createParentPath.value = parentPath
  createDraftValue.value = kind === 'file' ? 'main.ts' : 'new-folder'
}

function closeCreateDialog() {
  createDialogOpen.value = false
  createSubmitting.value = false
  createParentPath.value = '/'
  createDraftValue.value = ''
}

async function confirmCreateNode() {
  if (validateRenameInput(createDraftValue.value, createSiblingNames.value)) {
    return
  }

  createSubmitting.value = true
  if (createNodeKind.value === 'file') {
    await workspaceStore.createFile(createParentPath.value, createDraftValue.value)
  } else {
    await workspaceStore.createFolder(createParentPath.value, createDraftValue.value)
  }

  createSubmitting.value = false
  if (!workspaceStore.errorMessage) {
    closeCreateDialog()
  }
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
        <article class="summary-card summary-compact">
          <h3>{{ currentWorkspace?.title }}</h3>
          <p>
            文件树与代码区支持玻璃主题，拖拽、重命名与保存联动。
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
            @rename-file="openRenameDialog"
            @delete-file="deleteFile"
          />

          <section class="editor-panel">
            <header class="editor-head">
              <div class="editor-title">
                <h3>{{ activeFile?.name ?? 'Editor' }}</h3>
                <p class="editor-path">
                  {{ activeFile?.path ?? '选择文件后可编辑' }}
                </p>
              </div>

              <div class="editor-controls">
                <label class="theme-picker">
                  <span>主题</span>
                  <select v-model="editorTheme">
                    <option
                      v-for="theme in editorThemeOptions"
                      :key="theme.value"
                      :value="theme.value"
                    >
                      {{ theme.label }}
                    </option>
                  </select>
                </label>
                <button
                  type="button"
                  :disabled="!canSave"
                  @click="saveFile"
                >
                  {{ saving ? '保存中...' : dirty ? '保存' : '已保存' }}
                </button>
              </div>
            </header>

            <CodeEditor
              v-if="activeFile"
              :model-value="draftContent"
              :language="activeFile.language"
              :readonly="saving"
              :theme="editorTheme"
              @update:model-value="workspaceStore.setDraftContent"
              @save-shortcut="saveFile"
            />

            <p v-else class="editor-empty">
              先在左侧创建或选择文件，然后开始编辑。
            </p>
          </section>
        </div>
      </section>
    </section>

    <UnsavedChangesDialog
      :open="unsavedDialogOpen"
      :saving="resolvingUnsavedSave"
      @save="resolveUnsavedChoice('save')"
      @discard="resolveUnsavedChoice('discard')"
      @cancel="resolveUnsavedChoice('cancel')"
    />

    <RenameDialog
      :open="renameDialogOpen"
      :value="renameDraftValue"
      :error-message="renameErrorMessage"
      :submitting="renameSubmitting"
      :confirm-disabled="renameConfirmDisabled"
      @update:value="renameDraftValue = $event"
      @confirm="confirmRename"
      @cancel="closeRenameDialog"
    />

    <CreateNodeDialog
      :open="createDialogOpen"
      :kind="createNodeKind"
      :value="createDraftValue"
      :parent-path="createParentPath"
      :error-message="createErrorMessage"
      :submitting="createSubmitting"
      :confirm-disabled="createConfirmDisabled"
      @update:value="createDraftValue = $event"
      @confirm="confirmCreateNode"
      @cancel="closeCreateDialog"
    />
  </main>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  font-family: 'Manrope', 'Plus Jakarta Sans', 'Avenir Next', sans-serif;
  background:
    radial-gradient(circle at 12% 8%, rgba(56, 189, 248, 0.26), transparent 40%),
    radial-gradient(circle at 88% 0%, rgba(20, 184, 166, 0.24), transparent 36%),
    radial-gradient(circle at 45% 100%, rgba(99, 102, 241, 0.2), transparent 45%),
    linear-gradient(160deg, #e0f2fe 0%, #e2e8f0 52%, #dbeafe 100%);
}

.content {
  padding: 16px 18px;
  display: grid;
  gap: 10px;
  align-content: start;
}

.content-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  margin: 0;
  color: #0369a1;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.09em;
  font-weight: 700;
}

h2 {
  margin: 2px 0 0;
  font-size: 26px;
  line-height: 1.1;
  color: #0f172a;
}

.meta {
  margin: 0;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}

.error-banner {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(248, 113, 113, 0.35);
  background: rgba(254, 226, 226, 0.78);
  backdrop-filter: blur(8px);
  color: #991b1b;
  border-radius: 12px;
}

.library-view,
.workspace-view {
  display: grid;
  gap: 10px;
  align-content: start;
}

.summary-card {
  background: linear-gradient(140deg, rgba(255, 255, 255, 0.72), rgba(224, 242, 254, 0.52));
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 14px;
  backdrop-filter: blur(12px);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.1);
  padding: 12px 14px;
}

.summary-card h3 {
  margin: 0 0 6px;
  font-size: 18px;
  color: #0f172a;
}

.summary-card p {
  margin: 0;
  color: #334155;
  line-height: 1.45;
  font-size: 13px;
}

.summary-card.summary-compact {
  padding: 8px 12px;
}

.summary-card.summary-compact h3 {
  margin-bottom: 4px;
  font-size: 16px;
}

.summary-card.summary-compact p {
  font-size: 12px;
}

.workspace-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 700px;
}

.workspace-tile {
  border: 1px solid rgba(255, 255, 255, 0.65);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.74), rgba(224, 242, 254, 0.45));
  border-radius: 12px;
  padding: 10px 12px;
  text-align: left;
  display: grid;
  gap: 4px;
  cursor: pointer;
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.workspace-tile:hover {
  transform: translateY(-1px);
  border-color: rgba(56, 189, 248, 0.6);
  box-shadow: 0 14px 28px rgba(14, 116, 144, 0.16);
}

.workspace-tile strong {
  font-size: 14px;
  color: #0f172a;
}

.workspace-tile span {
  color: #475569;
  font-size: 12px;
}

.empty-note {
  margin: 0;
  color: #334155;
  font-size: 13px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px dashed rgba(148, 163, 184, 0.55);
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(6px);
}

.workspace-main {
  display: grid;
  grid-template-columns: minmax(330px, 42%) minmax(0, 58%);
  gap: 10px;
  align-items: stretch;
}

.editor-panel {
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.62), rgba(219, 234, 254, 0.36));
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 16px;
  backdrop-filter: blur(12px);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.1);
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 520px;
}

.editor-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.3);
  background: linear-gradient(120deg, rgba(219, 234, 254, 0.55), rgba(186, 230, 253, 0.28));
}

.editor-title {
  min-width: 0;
}

.editor-head h3 {
  margin: 0;
  font-size: 16px;
  color: #0f172a;
}

.editor-path {
  margin: 2px 0 0;
  font-size: 12px;
  color: #475569;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
}

.theme-picker select {
  border: 1px solid rgba(148, 163, 184, 0.55);
  background: rgba(255, 255, 255, 0.78);
  color: #0f172a;
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 12px;
}

.editor-head button {
  border: 1px solid rgba(14, 165, 233, 0.5);
  background: linear-gradient(130deg, rgba(14, 165, 233, 0.9), rgba(56, 189, 248, 0.82));
  color: #f8fafc;
  border-radius: 9px;
  padding: 7px 12px;
  cursor: pointer;
  font-weight: 700;
}

.editor-head button:disabled {
  opacity: 0.52;
  cursor: not-allowed;
}

.editor-empty {
  margin: 0;
  display: grid;
  place-items: center;
  color: #334155;
  font-size: 14px;
  padding: 16px;
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

  .content-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .editor-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
