<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import CodeEditor, {
  type CodeEditorTheme,
  type EditorStatusPayload,
} from '@/features/workspace/CodeEditor.vue'
import ConfirmDialog from '@/features/workspace/ConfirmDialog.vue'
import FileTree from '@/features/workspace/FileTree.vue'
import SnapshotDialog from '@/features/workspace/SnapshotDialog.vue'
import UnsavedChangesDialog from '@/features/workspace/UnsavedChangesDialog.vue'
import WorkspaceSidebar from '@/features/workspace/WorkspaceSidebar.vue'
import { useUnsavedGuard } from '@/composables/useUnsavedGuard'
import { useWorkspaceStore } from '@/stores/workspace.store'
import type { EditorSnapshot, WorkspaceFile } from '@/types/workspace'
import { formatSnippetContent } from '@/utils/formatter'
import {
  getLanguageLabel,
  MANUAL_LANGUAGE_OPTIONS,
  normalizeLanguage,
  type SupportedEditorLanguage,
} from '@/utils/language-detect'

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
  draftLanguage,
  dirty,
} = storeToRefs(workspaceStore)

const canSave = computed(() => {
  return !!activeFile.value && activeFile.value.kind === 'file' && dirty.value && !saving.value
})
const canUseEditorTools = computed(() => {
  return !!activeFile.value && activeFile.value.kind === 'file' && !saving.value
})
const canFormat = computed(() => {
  return canUseEditorTools.value && !formatting.value
})

const resolvingUnsavedSave = ref(false)
const deleteConfirm = ref<{
  kind: 'workspace' | 'folder'
  id: string
  title: string
  message: string
  confirmText: string
} | null>(null)
const deleteConfirmLoading = ref(false)

const deletedFileToast = ref<WorkspaceFile | null>(null)
const undoingFileDelete = ref(false)
let deletedFileToastTimer: number | null = null
let autoSaveTimer: number | null = null
const AUTO_SAVE_DEBOUNCE_MS = 1800
type CodeEditorHandle = {
  openSearchPanel: () => boolean
  openReplacePanel: () => boolean
  undo: () => boolean
  redo: () => boolean
}
const codeEditorRef = ref<CodeEditorHandle | null>(null)
const historyAvailability = ref({
  canUndo: false,
  canRedo: false,
})
const snapshotDialogOpen = ref(false)
const snapshotRestoring = ref(false)
const snapshotItems = ref<EditorSnapshot[]>([])
const formatting = ref(false)
const editorStatus = ref<EditorStatusPayload>({
  lineCount: 1,
  cursorLine: 1,
  cursorColumn: 1,
  eol: 'LF',
})
const STATUS_ENCODING = 'UTF-8'
const {
  dialogOpen: unsavedDialogOpen,
  requestDecision,
  resolveDecision,
} = useUnsavedGuard(dirty)
const editorTheme = ref<CodeEditorTheme>('glacier-night')
const editorThemeOptions: Array<{ label: string; value: CodeEditorTheme }> = [
  { label: '冰川夜幕', value: 'glacier-night' },
  { label: '水雾暮色', value: 'aqua-dusk' },
  { label: '珍珠浅光', value: 'pearl-light' },
]
const statusLanguageLabel = computed(() => {
  const language = normalizeLanguage(
    draftLanguage.value || activeFile.value?.language || 'plaintext',
  )
  return getLanguageLabel(language)
})
type AppView = 'workspace' | 'settings'
type SettingsTab = 'general' | 'languages'
const currentView = ref<AppView>('workspace')
const settingsTab = ref<SettingsTab>('languages')
const languageSearchQuery = ref('')
const isSettingsView = computed(() => currentView.value === 'settings')
const pageTitle = computed(() => {
  if (isSettingsView.value) {
    return 'Settings'
  }

  return libraryMode.value
    ? 'Library View'
    : currentWorkspace.value?.title ?? 'Workspace'
})
const headerMetaText = computed(() => {
  if (isSettingsView.value) {
    return `${MANUAL_LANGUAGE_OPTIONS.length} supported languages`
  }

  return `${workspaces.value.length} workspaces · ${files.value.length} files`
})
const filteredLanguageOptions = computed(() => {
  const keyword = languageSearchQuery.value.trim().toLowerCase()
  if (!keyword) {
    return MANUAL_LANGUAGE_OPTIONS
  }

  return MANUAL_LANGUAGE_OPTIONS.filter((item) => {
    return (
      item.label.toLowerCase().includes(keyword) ||
      item.value.toLowerCase().includes(keyword)
    )
  })
})
const visibleLanguageCountText = computed(() => {
  return `${filteredLanguageOptions.value.length} / ${MANUAL_LANGUAGE_OPTIONS.length}`
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

function updateHashForView(view: AppView) {
  const targetHash = view === 'settings' ? '#/settings' : '#/'
  if (window.location.hash === targetHash) {
    return
  }

  window.location.hash = targetHash
}

function openSettings() {
  void runWithUnsavedGuard(() => {
    currentView.value = 'settings'
    settingsTab.value = 'languages'
    updateHashForView('settings')
  })
}

function backToWorkspaceView() {
  currentView.value = 'workspace'
  updateHashForView('workspace')
}

function switchSettingsTab(tab: SettingsTab) {
  settingsTab.value = tab
}

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
  deleteConfirm.value = {
    kind: 'workspace',
    id: workspaceId,
    title: '确认删除工作区',
    message: `删除「${target?.title ?? workspaceId}」后将不可恢复。`,
    confirmText: '确认删除',
  }
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

function createFile(payload: { parentPath: string; name: string }) {
  void workspaceStore.createFile(payload.parentPath, payload.name)
}

function createFolder(payload: { parentPath: string; name: string }) {
  void workspaceStore.createFolder(payload.parentPath, payload.name)
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

function renameFile(payload: { fileId: string; newName: string }) {
  void workspaceStore.renameFile(payload.fileId, payload.newName)
}

function deleteFile(fileId: string) {
  const target = files.value.find((item) => item.id === fileId)
  if (!target) {
    return
  }

  if (target.kind === 'folder') {
    deleteConfirm.value = {
      kind: 'folder',
      id: fileId,
      title: '确认删除文件夹',
      message: `删除「${target.name}」及其所有子项后将不可恢复。`,
      confirmText: '确认删除',
    }
    return
  }

  void deleteFileWithUndo(fileId)
}

function saveFile() {
  void workspaceStore.saveCurrentFile()
}

function openEditorSearch() {
  if (!canUseEditorTools.value) {
    return
  }

  codeEditorRef.value?.openSearchPanel()
}

function openEditorReplace() {
  if (!canUseEditorTools.value) {
    return
  }

  codeEditorRef.value?.openReplacePanel()
}

function undoEditorChange() {
  if (!canUseEditorTools.value) {
    return
  }

  codeEditorRef.value?.undo()
}

function redoEditorChange() {
  if (!canUseEditorTools.value) {
    return
  }

  codeEditorRef.value?.redo()
}

function updateHistoryAvailability(payload: { canUndo: boolean; canRedo: boolean }) {
  historyAvailability.value = payload
}

async function formatEditorContent() {
  if (!activeFile.value || activeFile.value.kind !== 'file' || !canFormat.value) {
    return
  }

  formatting.value = true
  const result = await formatSnippetContent({
    language: draftLanguage.value,
    content: draftContent.value,
  })

  if (!result.ok) {
    workspaceStore.errorMessage =
      result.reason === 'unsupported'
        ? '当前语言暂不支持格式化。'
        : result.errorMessage ?? '格式化失败，请稍后重试。'
    formatting.value = false
    return
  }

  if (result.content !== draftContent.value) {
    workspaceStore.createSnapshotForActiveFile('format')
    workspaceStore.setDraftContent(result.content)
    if (snapshotDialogOpen.value) {
      snapshotItems.value = workspaceStore.getActiveFileSnapshots()
    }
  }

  formatting.value = false
}

function openSnapshotDialog() {
  snapshotItems.value = workspaceStore.getActiveFileSnapshots()
  snapshotDialogOpen.value = true
}

function closeSnapshotDialog() {
  if (snapshotRestoring.value) {
    return
  }

  snapshotDialogOpen.value = false
}

function createManualSnapshot() {
  workspaceStore.createSnapshotForActiveFile('manual')
  snapshotItems.value = workspaceStore.getActiveFileSnapshots()
}

function restoreSnapshot(snapshotId: string) {
  snapshotRestoring.value = true
  const restored = workspaceStore.restoreSnapshotForActiveFile(snapshotId)
  snapshotRestoring.value = false
  if (!restored) {
    return
  }

  snapshotItems.value = workspaceStore.getActiveFileSnapshots()
  snapshotDialogOpen.value = false
}

function updateEditorStatus(payload: EditorStatusPayload) {
  editorStatus.value = payload
}

async function updateLanguagePreference(event: Event) {
  const target = event.target as HTMLSelectElement | null
  if (!target) {
    return
  }

  await workspaceStore.applyActiveFileLanguagePreference(target.value as SupportedEditorLanguage)
}

function clearDeletedFileToastTimer() {
  if (deletedFileToastTimer !== null) {
    window.clearTimeout(deletedFileToastTimer)
    deletedFileToastTimer = null
  }
}

function clearAutoSaveTimer() {
  if (autoSaveTimer !== null) {
    window.clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
}

function hideDeletedFileToast() {
  deletedFileToast.value = null
  undoingFileDelete.value = false
  clearDeletedFileToastTimer()
}

function showDeletedFileToast(file: WorkspaceFile) {
  deletedFileToast.value = { ...file }
  undoingFileDelete.value = false
  clearDeletedFileToastTimer()
  deletedFileToastTimer = window.setTimeout(() => {
    hideDeletedFileToast()
  }, 6000)
}

async function deleteFileWithUndo(fileId: string) {
  const target = files.value.find((item) => item.id === fileId)
  if (!target || target.kind !== 'file') {
    return
  }

  const snapshot = { ...target }
  const deleted = await workspaceStore.deleteFile(fileId)
  if (!deleted) {
    return
  }

  showDeletedFileToast(snapshot)
}

async function undoDeletedFile() {
  if (!deletedFileToast.value) {
    return
  }

  undoingFileDelete.value = true
  const restored = await workspaceStore.restoreDeletedFile(deletedFileToast.value)
  undoingFileDelete.value = false

  if (restored) {
    hideDeletedFileToast()
  }
}

function cancelDeleteConfirm() {
  if (deleteConfirmLoading.value) {
    return
  }

  deleteConfirm.value = null
}

async function confirmDelete() {
  if (!deleteConfirm.value) {
    return
  }

  deleteConfirmLoading.value = true

  if (deleteConfirm.value.kind === 'workspace') {
    await workspaceStore.deleteWorkspace(deleteConfirm.value.id)
  } else {
    await workspaceStore.deleteFile(deleteConfirm.value.id)
  }

  deleteConfirmLoading.value = false
  deleteConfirm.value = null
}

watch(
  () => currentWorkspaceId.value,
  () => {
    hideDeletedFileToast()
    clearAutoSaveTimer()
    historyAvailability.value = { canUndo: false, canRedo: false }
  },
)

watch(
  [
    () => dirty.value,
    () => activeFile.value?.id,
    () => activeFile.value?.kind,
    () => draftContent.value,
    () => draftLanguage.value,
    () => saving.value,
  ],
  ([isDirty, activeId, activeKind, _draft, _draftLanguage, isSaving]) => {
    if (!isDirty || !activeId || activeKind !== 'file' || isSaving) {
      clearAutoSaveTimer()
      return
    }

    clearAutoSaveTimer()
    autoSaveTimer = window.setTimeout(() => {
      void workspaceStore.saveCurrentFile()
    }, AUTO_SAVE_DEBOUNCE_MS)
  },
)

watch(
  () => activeFile.value?.id,
  () => {
    historyAvailability.value = { canUndo: false, canRedo: false }
    snapshotDialogOpen.value = false
    snapshotItems.value = []
    editorStatus.value = {
      lineCount: 1,
      cursorLine: 1,
      cursorColumn: 1,
      eol: 'LF',
    }
  },
)

onBeforeUnmount(() => {
  clearDeletedFileToastTimer()
  clearAutoSaveTimer()
})
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
          <h2>{{ pageTitle }}</h2>
        </div>

        <div class="content-head-actions">
          <p class="meta">
            {{ headerMetaText }}
          </p>
          <button
            v-if="isSettingsView"
            type="button"
            class="head-action-button"
            data-testid="back-to-workspace"
            @click="backToWorkspaceView"
          >
            返回工作台
          </button>
          <button
            v-else
            type="button"
            class="head-action-button"
            data-testid="open-settings"
            @click="openSettings"
          >
            设置
          </button>
        </div>
      </header>

      <p v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </p>

      <section
        v-if="isSettingsView"
        class="settings-view"
        data-testid="settings-view"
      >
        <article class="summary-card summary-compact">
          <h3>设置中心</h3>
          <p>管理编辑器能力与展示信息。你可以在这里查看当前支持的全部语言。</p>
        </article>

        <section class="settings-panel">
          <div class="settings-tabs" role="tablist" aria-label="设置选项卡">
            <button
              type="button"
              class="settings-tab-button"
              data-testid="settings-tab-general"
              :aria-selected="settingsTab === 'general'"
              @click="switchSettingsTab('general')"
            >
              常规
            </button>
            <button
              type="button"
              class="settings-tab-button"
              data-testid="settings-tab-languages"
              :aria-selected="settingsTab === 'languages'"
              @click="switchSettingsTab('languages')"
            >
              支持语言
            </button>
          </div>

          <section
            v-if="settingsTab === 'general'"
            class="settings-tab-panel"
            data-testid="settings-panel-general"
          >
            <p>更多设置项会在后续版本补充，当前可在“支持语言”中查看编辑器语言清单。</p>
          </section>

          <section
            v-else
            class="settings-tab-panel"
            data-testid="settings-panel-languages"
          >
            <header class="language-panel-head">
              <p data-testid="settings-language-count">
                当前显示 {{ visibleLanguageCountText }} 种语言
              </p>
              <input
                v-model="languageSearchQuery"
                data-testid="settings-language-search"
                type="search"
                placeholder="搜索语言名称或ID，如 python / typescript"
              >
            </header>

            <ul class="language-list" data-testid="settings-language-list">
              <li
                v-for="item in filteredLanguageOptions"
                :key="item.value"
                class="language-item"
                data-testid="settings-language-item"
              >
                <strong>{{ item.label }}</strong>
                <code>{{ item.value }}</code>
              </li>
            </ul>
          </section>
        </section>
      </section>

      <section v-else-if="libraryMode" class="library-view">
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
            @rename-file="renameFile"
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
                <div class="editor-tools" role="group" aria-label="编辑器工具">
                  <button
                    type="button"
                    class="editor-tool-button"
                    data-testid="editor-undo"
                    :disabled="!canUseEditorTools || !historyAvailability.canUndo"
                    @click="undoEditorChange"
                  >
                    撤销
                  </button>
                  <button
                    type="button"
                    class="editor-tool-button"
                    data-testid="editor-redo"
                    :disabled="!canUseEditorTools || !historyAvailability.canRedo"
                    @click="redoEditorChange"
                  >
                    重做
                  </button>
                  <button
                    type="button"
                    class="editor-tool-button"
                    data-testid="editor-search"
                    :disabled="!canUseEditorTools"
                    @click="openEditorSearch"
                  >
                    查找
                  </button>
                  <button
                    type="button"
                    class="editor-tool-button"
                    data-testid="editor-replace"
                    :disabled="!canUseEditorTools"
                    @click="openEditorReplace"
                  >
                    替换
                  </button>
                  <button
                    type="button"
                    class="editor-tool-button"
                    data-testid="editor-format"
                    :disabled="!canFormat"
                    @click="formatEditorContent"
                  >
                    {{ formatting ? '格式化中...' : '格式化' }}
                  </button>
                  <button
                    type="button"
                    class="editor-tool-button"
                    data-testid="editor-snapshots"
                    :disabled="!canUseEditorTools"
                    @click="openSnapshotDialog"
                  >
                    快照
                  </button>
                </div>
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
                <label class="language-picker">
                  <span>语言</span>
                  <select
                    data-testid="editor-language-select"
                    :value="draftLanguage"
                    :disabled="!canUseEditorTools"
                    @change="updateLanguagePreference"
                  >
                    <option
                      v-for="option in MANUAL_LANGUAGE_OPTIONS"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </label>
                <button
                  type="button"
                  class="save-button"
                  :disabled="!canSave"
                  @click="saveFile"
                >
                  {{ saving ? '保存中...' : dirty ? '保存' : '已保存' }}
                </button>
              </div>
            </header>

            <CodeEditor
              v-if="activeFile"
              ref="codeEditorRef"
              :model-value="draftContent"
              :language="draftLanguage"
              :readonly="saving"
              :theme="editorTheme"
              @update:model-value="workspaceStore.setDraftContent"
              @save-shortcut="saveFile"
              @history-availability="updateHistoryAvailability"
              @status-change="updateEditorStatus"
            />

            <footer
              v-if="activeFile"
              class="editor-statusbar"
              data-testid="editor-statusbar"
            >
              <span data-testid="editor-status-language">语言: {{ statusLanguageLabel }}</span>
              <span data-testid="editor-status-lines">{{ editorStatus.lineCount }} 行</span>
              <span data-testid="editor-status-cursor">
                Ln {{ editorStatus.cursorLine }}, Col {{ editorStatus.cursorColumn }}
              </span>
              <span data-testid="editor-status-encoding">{{ STATUS_ENCODING }}</span>
              <span data-testid="editor-status-eol">{{ editorStatus.eol }}</span>
            </footer>

            <p v-else class="editor-empty">
              先在左侧创建或选择文件，然后开始编辑。
            </p>
          </section>
        </div>
      </section>
    </section>

    <div
      v-if="deletedFileToast"
      class="undo-toast"
      data-testid="file-delete-toast"
      role="status"
      aria-live="polite"
    >
      <p>已删除文件「{{ deletedFileToast.name }}」。</p>
      <button
        type="button"
        data-testid="undo-delete-file"
        :disabled="undoingFileDelete"
        @click="undoDeletedFile"
      >
        {{ undoingFileDelete ? '恢复中...' : '撤销' }}
      </button>
    </div>

    <ConfirmDialog
      :open="!!deleteConfirm"
      :title="deleteConfirm?.title ?? ''"
      :message="deleteConfirm?.message ?? ''"
      :confirm-text="deleteConfirm?.confirmText"
      :loading="deleteConfirmLoading"
      danger
      @confirm="confirmDelete"
      @cancel="cancelDeleteConfirm"
    />

    <SnapshotDialog
      :open="snapshotDialogOpen"
      :file-name="activeFile?.name ?? ''"
      :snapshots="snapshotItems"
      :restoring="snapshotRestoring"
      @close="closeSnapshotDialog"
      @create="createManualSnapshot"
      @restore="restoreSnapshot"
    />

    <UnsavedChangesDialog
      :open="unsavedDialogOpen"
      :saving="resolvingUnsavedSave"
      @save="resolveUnsavedChoice('save')"
      @discard="resolveUnsavedChoice('discard')"
      @cancel="resolveUnsavedChoice('cancel')"
    />
  </main>
</template>

<style scoped>
.app-shell {
  height: 100vh;
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  font-family: 'Manrope', 'Plus Jakarta Sans', 'Avenir Next', sans-serif;
  overflow: hidden;
  background:
    radial-gradient(circle at 12% 8%, rgba(56, 189, 248, 0.26), transparent 40%),
    radial-gradient(circle at 88% 0%, rgba(20, 184, 166, 0.24), transparent 36%),
    radial-gradient(circle at 45% 100%, rgba(99, 102, 241, 0.2), transparent 45%),
    linear-gradient(160deg, #e0f2fe 0%, #e2e8f0 52%, #dbeafe 100%);
}

.content {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: hidden;
}

.content-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.content-head-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
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

.head-action-button {
  border: 1px solid rgba(14, 165, 233, 0.46);
  background: rgba(255, 255, 255, 0.76);
  color: #0f172a;
  border-radius: 9px;
  padding: 7px 10px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
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
.workspace-view,
.settings-view {
  min-height: 0;
}

.library-view {
  display: grid;
  gap: 10px;
  align-content: start;
  flex: 1 1 auto;
  overflow: auto;
}

.workspace-view {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.settings-view {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.settings-panel {
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.62), rgba(219, 234, 254, 0.36));
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 16px;
  backdrop-filter: blur(12px);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.1);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
}

.settings-tabs {
  display: inline-flex;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.28);
}

.settings-tab-button {
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 9px;
  background: rgba(241, 245, 249, 0.7);
  color: #334155;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.settings-tab-button[aria-selected='true'] {
  border-color: rgba(14, 165, 233, 0.5);
  background: rgba(14, 165, 233, 0.15);
  color: #075985;
}

.settings-tab-panel {
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  padding: 12px;
  gap: 10px;
}

.settings-tab-panel p {
  margin: 0;
  color: #334155;
  font-size: 13px;
}

.language-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.language-panel-head input {
  width: min(440px, 100%);
  border: 1px solid rgba(148, 163, 184, 0.55);
  background: rgba(255, 255, 255, 0.84);
  border-radius: 9px;
  padding: 7px 10px;
  font-size: 13px;
}

.language-list {
  list-style: none;
  margin: 0;
  padding: 0;
  min-height: 0;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  grid-auto-rows: max-content;
  align-content: start;
  align-items: start;
  gap: 8px;
}

.language-item {
  border: 1px solid rgba(148, 163, 184, 0.36);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.65);
  padding: 8px 10px;
  display: grid;
  align-content: start;
  align-self: start;
  gap: 3px;
}

.language-item strong {
  color: #0f172a;
  font-size: 13px;
}

.language-item code {
  color: #0f172a;
  font-size: 12px;
  background: rgba(148, 163, 184, 0.18);
  border-radius: 6px;
  width: fit-content;
  padding: 2px 6px;
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
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.editor-panel {
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.62), rgba(219, 234, 254, 0.36));
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 16px;
  backdrop-filter: blur(12px);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.1);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 0;
  height: 100%;
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

.editor-tools {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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

.language-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
}

.language-picker select {
  border: 1px solid rgba(148, 163, 184, 0.55);
  background: rgba(255, 255, 255, 0.78);
  color: #0f172a;
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 12px;
}

.editor-tool-button {
  border: 1px solid rgba(148, 163, 184, 0.58);
  background: rgba(248, 250, 252, 0.74);
  color: #0f172a;
  border-radius: 8px;
  padding: 6px 9px;
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
}

.editor-tool-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-button {
  border: 1px solid rgba(14, 165, 233, 0.5);
  background: linear-gradient(130deg, rgba(14, 165, 233, 0.9), rgba(56, 189, 248, 0.82));
  color: #f8fafc;
  border-radius: 9px;
  padding: 7px 12px;
  cursor: pointer;
  font-weight: 700;
}

.save-button:disabled {
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

.editor-statusbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 7px 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(248, 250, 252, 0.66);
  font-size: 12px;
  color: #334155;
  white-space: nowrap;
  overflow: auto;
}

.undo-toast {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 62;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 12px;
  padding: 10px 12px;
  background: linear-gradient(145deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.85));
  color: #e2e8f0;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.28);
  backdrop-filter: blur(8px);
}

.undo-toast p {
  margin: 0;
  font-size: 13px;
}

.undo-toast button {
  border: 1px solid rgba(56, 189, 248, 0.6);
  border-radius: 9px;
  background: rgba(14, 165, 233, 0.2);
  color: #e0f2fe;
  padding: 6px 10px;
  cursor: pointer;
  font-weight: 600;
}

.undo-toast button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 1200px) {
  .workspace-main {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(260px, 1fr) minmax(320px, 1fr);
  }
}

@media (max-width: 960px) {
  .app-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .content-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .content-head-actions {
    width: 100%;
    justify-content: space-between;
  }

  .editor-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .language-panel-head {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
