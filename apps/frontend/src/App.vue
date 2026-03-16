<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import CodeEditor, {
  type CodeEditorTheme,
  type EditorStatusPayload,
} from '@/features/workspace/CodeEditor.vue'
import ConfirmDialog from '@/features/workspace/ConfirmDialog.vue'
import FileTree from '@/features/workspace/FileTree.vue'
import RevisionDialog from '@/features/workspace/RevisionDialog.vue'
import SnapshotDialog from '@/features/workspace/SnapshotDialog.vue'
import UnsavedChangesDialog from '@/features/workspace/UnsavedChangesDialog.vue'
import WorkspaceSidebar from '@/features/workspace/WorkspaceSidebar.vue'
import { useUnsavedGuard } from '@/composables/useUnsavedGuard'
import { useWorkspaceStore } from '@/stores/workspace.store'
import type {
  EditorSnapshot,
  WorkspaceFile,
  WorkspaceFileRevision,
} from '@/types/workspace'
import { formatSnippetContent } from '@/utils/formatter'
import {
  getLanguageLabel,
  MANUAL_LANGUAGE_OPTIONS,
  normalizeLanguage,
  type SupportedEditorLanguage,
} from '@/utils/language-detect'
import {
  applyBuiltinUiTheme,
  buildThemeExportFileName,
  buildThemeExportPayload,
  getActiveUiTheme,
  getBuiltinUiThemeCatalog,
  importUiThemeFile,
  initializeUiTheme,
  isBuiltinThemeId,
  resetUiThemeToDefault,
} from '@/themes/theme-runtime'
import { normalizeThemeExportFileName, type UiThemeFile } from '@/themes/theme-schema'

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
const revisionDialogOpen = ref(false)
const revisionLoading = ref(false)
const revisionRestoring = ref(false)
const revisionItems = ref<WorkspaceFileRevision[]>([])
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
type SettingsTab = 'general' | 'themes' | 'languages'
const props = withDefaults(
  defineProps<{
    initialView?: AppView
  }>(),
  {
    initialView: 'workspace',
  },
)
const currentView = ref<AppView>(props.initialView)
const settingsTab = ref<SettingsTab>('languages')
const languageSearchQuery = ref('')
const workspaceTagsInput = ref('')
const fileTagsInput = ref('')
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
const themeImportInputRef = ref<HTMLInputElement | null>(null)
const themeFeedbackMessage = ref('')
const activeUiTheme = ref<UiThemeFile>(getActiveUiTheme())
const builtinThemeOptions = getBuiltinUiThemeCatalog()
const selectedBuiltinThemeId = ref(builtinThemeOptions[0]?.id ?? 'glass-gradient')
const themeExportName = ref(normalizeThemeExportFileName(activeUiTheme.value.meta.id))
const themeTutorialJsonTemplate = `{
  "schemaVersion": 1,
  "meta": {
    "id": "your-theme-id",
    "name": "Your Theme Name",
    "version": "1.0.0",
    "author": "Your Name",
    "description": "Theme description"
  },
  "modules": {
    "layout": {},
    "text": {},
    "surface": {},
    "accent": {},
    "danger": {}
  }
}`
const themeTutorialModules = [
  {
    id: 'layout',
    description: '页面级背景与布局外观（应用背景、侧栏背景等）。',
    tokenExample: 'layout.appShellBackground',
  },
  {
    id: 'text',
    description: '文本颜色体系（主文本、次文本、强调、危险文本）。',
    tokenExample: 'text.primary / text.secondary',
  },
  {
    id: 'surface',
    description: '面板、卡片、输入框、标签等表面层样式。',
    tokenExample: 'surface.glassPanelBackground',
  },
  {
    id: 'accent',
    description: '主操作按钮、选中态、焦点态等品牌强调色。',
    tokenExample: 'accent.primaryButtonGradient',
  },
  {
    id: 'danger',
    description: '删除和错误提醒等高风险操作的颜色。',
    tokenExample: 'danger.strongGradient',
  },
]
const themeTutorialSteps = [
  '先在本页导出当前主题文件，作为模板起点。',
  '复制模板后仅修改 meta.id / meta.name，先保证文件可导入。',
  '优先小步调整 layout 与 accent，便于快速看到全局变化。',
  '完成后导入 JSON，系统会立刻应用并写入全局主题。',
]
const themeTutorialRules = [
  'schemaVersion 必须是 1。',
  'meta.id 与 meta.name 必填，modules 下五个分组必须齐全。',
  '每个 token 值都应为非空字符串，推荐使用 #hex / rgba / gradient。',
]

const currentThemeMetaText = computed(() => {
  const versionLabel = activeUiTheme.value.meta.version ? ` v${activeUiTheme.value.meta.version}` : ''
  return `${activeUiTheme.value.meta.name}${versionLabel}`
})

function syncThemeExportName() {
  themeExportName.value = normalizeThemeExportFileName(activeUiTheme.value.meta.id)
}

function syncBuiltinThemeSelection() {
  if (!isBuiltinThemeId(activeUiTheme.value.meta.id)) {
    return
  }

  selectedBuiltinThemeId.value = activeUiTheme.value.meta.id
}

function applyBuiltinThemeById(themeId: string) {
  const result = applyBuiltinUiTheme(themeId)
  if (!result.ok) {
    themeFeedbackMessage.value = `切换失败：${result.error}`
    syncBuiltinThemeSelection()
    return
  }

  selectedBuiltinThemeId.value = result.theme.meta.id
  activeUiTheme.value = result.theme
  syncThemeExportName()
  themeFeedbackMessage.value = `已切换系统主题：${result.theme.meta.name}`
}

function handleBuiltinThemeChange(event: Event) {
  const target = event.target as HTMLSelectElement | null
  if (!target) {
    return
  }

  selectedBuiltinThemeId.value = target.value
  applyBuiltinThemeById(target.value)
}

function handleThemeExportNameBlur() {
  themeExportName.value = normalizeThemeExportFileName(themeExportName.value)
}

function exportCurrentThemeFile() {
  const fileName = buildThemeExportFileName(themeExportName.value || activeUiTheme.value.meta.id)
  const exportText = buildThemeExportPayload(activeUiTheme.value)
  const blob = new Blob([exportText], { type: 'application/json' })
  const blobUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(blobUrl)
  themeFeedbackMessage.value = `主题已导出：${fileName}`
}

function handleThemeExportNameKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    syncThemeExportName()
    return
  }

  if (event.key !== 'Enter') {
    return
  }

  event.preventDefault()
  handleThemeExportNameBlur()
  exportCurrentThemeFile()
}

function openThemeImportPicker() {
  themeImportInputRef.value?.click()
}

async function handleThemeImport(event: Event) {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]
  if (!file) {
    return
  }

  const result = await importUiThemeFile(file)
  if (!result.ok) {
    themeFeedbackMessage.value = `导入失败：${result.error}`
    if (target) {
      target.value = ''
    }
    return
  }

  activeUiTheme.value = result.theme
  syncBuiltinThemeSelection()
  syncThemeExportName()
  themeFeedbackMessage.value = `主题已导入并应用：${result.theme.meta.name}`
  if (target) {
    target.value = ''
  }
}

function restoreDefaultTheme() {
  activeUiTheme.value = resetUiThemeToDefault()
  syncBuiltinThemeSelection()
  syncThemeExportName()
  themeFeedbackMessage.value = '已恢复默认玻璃主题。'
}

onMounted(async () => {
  activeUiTheme.value = initializeUiTheme()
  syncBuiltinThemeSelection()
  syncThemeExportName()

  const storedTheme = window.localStorage.getItem('editor-theme')
  if (
    storedTheme === 'glacier-night' ||
    storedTheme === 'aqua-dusk' ||
    storedTheme === 'pearl-light'
  ) {
    editorTheme.value = storedTheme
  }

  await workspaceStore.loadWorkspaces()

  const params = new URLSearchParams(window.location.search)
  const workspaceId = params.get('workspaceId')
  const fileId = params.get('fileId')

  if (workspaceId) {
    await workspaceStore.openWorkspace(workspaceId)
  }

  if (fileId && workspaceStore.files.some((item) => item.id === fileId)) {
    workspaceStore.selectFile(fileId)
  }

  syncWorkspaceTagsInput()
  syncFileTagsInput()
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

function normalizeTagsInput(value: string) {
  const seen = new Set<string>()
  const tags: string[] = []

  for (const raw of value.split(',')) {
    const trimmed = raw.trim()
    if (!trimmed || seen.has(trimmed)) {
      continue
    }

    seen.add(trimmed)
    tags.push(trimmed)
  }

  return tags
}

function tagsToInputValue(tags: string[] | undefined) {
  return (tags ?? []).join(', ')
}

function syncWorkspaceTagsInput() {
  workspaceTagsInput.value = tagsToInputValue(currentWorkspace.value?.tags)
}

function syncFileTagsInput() {
  const active = activeFile.value
  if (!active || active.kind !== 'file') {
    fileTagsInput.value = ''
    return
  }

  fileTagsInput.value = tagsToInputValue(active.tags)
}

async function commitWorkspaceTags() {
  if (!currentWorkspace.value) {
    return
  }

  const nextTags = normalizeTagsInput(workspaceTagsInput.value)
  const currentTags = currentWorkspace.value.tags ?? []
  if (JSON.stringify(nextTags) === JSON.stringify(currentTags)) {
    workspaceTagsInput.value = tagsToInputValue(currentTags)
    return
  }

  await workspaceStore.updateWorkspaceMeta(currentWorkspace.value.id, {
    tags: nextTags,
  })
  syncWorkspaceTagsInput()
}

async function commitFileTags() {
  const active = activeFile.value
  if (!active || active.kind !== 'file') {
    return
  }

  const nextTags = normalizeTagsInput(fileTagsInput.value)
  const currentTags = active.tags ?? []
  if (JSON.stringify(nextTags) === JSON.stringify(currentTags)) {
    fileTagsInput.value = tagsToInputValue(currentTags)
    return
  }

  await workspaceStore.updateFileMeta(active.id, {
    tags: nextTags,
  })
  syncFileTagsInput()
}

function onWorkspaceTagsKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    syncWorkspaceTagsInput()
    return
  }

  if (event.key !== 'Enter') {
    return
  }

  event.preventDefault()
  void commitWorkspaceTags()
}

function onFileTagsKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    syncFileTagsInput()
    return
  }

  if (event.key !== 'Enter') {
    return
  }

  event.preventDefault()
  void commitFileTags()
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

function toggleWorkspaceStar(workspaceId: string) {
  void workspaceStore.toggleWorkspaceStar(workspaceId)
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

function toggleActiveFileStar() {
  void workspaceStore.toggleActiveFileStar()
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

async function loadRevisionItemsForActiveFile() {
  const activeId = activeFile.value?.id
  if (!activeId) {
    revisionItems.value = []
    return
  }

  revisionLoading.value = true
  try {
    const items = await workspaceStore.listActiveFileRevisions()
    if (activeFile.value?.id !== activeId) {
      return
    }

    revisionItems.value = items
  } finally {
    if (activeFile.value?.id === activeId) {
      revisionLoading.value = false
    }
  }
}

function openRevisionDialog() {
  if (!canUseEditorTools.value) {
    return
  }

  revisionDialogOpen.value = true
  void loadRevisionItemsForActiveFile()
}

function closeRevisionDialog() {
  if (revisionRestoring.value) {
    return
  }

  revisionDialogOpen.value = false
}

function refreshRevisionDialog() {
  void loadRevisionItemsForActiveFile()
}

async function restoreRevision(revisionId: string) {
  if (revisionRestoring.value) {
    return
  }

  revisionRestoring.value = true
  const restored = await workspaceStore.restoreActiveFileRevision(revisionId)
  revisionRestoring.value = false

  if (!restored) {
    return
  }

  revisionDialogOpen.value = false
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
    syncWorkspaceTagsInput()
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
    revisionDialogOpen.value = false
    revisionLoading.value = false
    revisionRestoring.value = false
    revisionItems.value = []
    editorStatus.value = {
      lineCount: 1,
      cursorLine: 1,
      cursorColumn: 1,
      eol: 'LF',
    }
    syncFileTagsInput()
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
      @toggle-star="toggleWorkspaceStar"
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
              data-testid="settings-tab-themes"
              :aria-selected="settingsTab === 'themes'"
              @click="switchSettingsTab('themes')"
            >
              主题
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
            <p>更多基础设置项会在后续版本补充。</p>
          </section>

          <section
            v-else-if="settingsTab === 'themes'"
            class="settings-tab-panel settings-theme-tab-panel"
            data-testid="settings-panel-themes"
          >
            <p>管理全局主题文件。你可以导出当前主题、导入 JSON 主题并实时应用。</p>

            <article class="theme-settings" data-testid="settings-theme-panel">
              <header class="theme-settings-head">
                <div>
                  <h4>全局玻璃主题</h4>
                  <p data-testid="settings-theme-current-name">
                    {{ currentThemeMetaText }}
                  </p>
                </div>
                <code data-testid="settings-theme-current-id">
                  {{ activeUiTheme.meta.id }}
                </code>
              </header>

              <label class="theme-preset-selector">
                <span>系统预置主题（9 套）</span>
                <div class="theme-preset-actions">
                  <select
                    :value="selectedBuiltinThemeId"
                    data-testid="settings-theme-preset-select"
                    @change="handleBuiltinThemeChange"
                  >
                    <option
                      v-for="theme in builtinThemeOptions"
                      :key="theme.id"
                      :value="theme.id"
                    >
                      {{ theme.name }}
                    </option>
                  </select>
                </div>
              </label>

              <label class="theme-export-name">
                <span>导出文件名</span>
                <input
                  v-model="themeExportName"
                  data-testid="settings-theme-export-name"
                  type="text"
                  placeholder="glass-gradient"
                  @blur="handleThemeExportNameBlur"
                  @keydown="handleThemeExportNameKeydown"
                >
              </label>

              <div class="theme-actions">
                <button
                  type="button"
                  class="theme-action primary"
                  data-testid="settings-theme-export"
                  @click="exportCurrentThemeFile"
                >
                  导出主题文件
                </button>
                <button
                  type="button"
                  class="theme-action"
                  data-testid="settings-theme-import-trigger"
                  @click="openThemeImportPicker"
                >
                  导入主题文件
                </button>
                <button
                  type="button"
                  class="theme-action"
                  data-testid="settings-theme-reset"
                  @click="restoreDefaultTheme"
                >
                  恢复默认主题
                </button>
                <input
                  ref="themeImportInputRef"
                  data-testid="settings-theme-import-input"
                  type="file"
                  class="theme-import-input"
                  accept=".json,application/json"
                  @change="handleThemeImport"
                >
              </div>

              <section class="theme-tutorial" data-testid="settings-theme-tutorial">
                <h5>主题编写教程</h5>
                <p>主题文件采用模块化结构：`schemaVersion + meta + modules`。</p>

                <div class="theme-tutorial-section">
                  <h6>文件结构模板</h6>
                  <pre class="theme-tutorial-code"><code>{{ themeTutorialJsonTemplate }}</code></pre>
                </div>

                <div class="theme-tutorial-section">
                  <h6>模块职责</h6>
                  <ul class="theme-tutorial-list">
                    <li
                      v-for="item in themeTutorialModules"
                      :key="item.id"
                    >
                      <strong>{{ item.id }}</strong>
                      <span>{{ item.description }}</span>
                      <code>{{ item.tokenExample }}</code>
                    </li>
                  </ul>
                </div>

                <div class="theme-tutorial-section">
                  <h6>推荐编写步骤</h6>
                  <ol class="theme-tutorial-steps">
                    <li
                      v-for="step in themeTutorialSteps"
                      :key="step"
                    >
                      {{ step }}
                    </li>
                  </ol>
                </div>

                <div class="theme-tutorial-section">
                  <h6>编写约束</h6>
                  <ul class="theme-tutorial-list">
                    <li
                      v-for="rule in themeTutorialRules"
                      :key="rule"
                    >
                      {{ rule }}
                    </li>
                  </ul>
                </div>
              </section>

              <p
                v-if="themeFeedbackMessage"
                class="theme-feedback"
                data-testid="settings-theme-import-message"
              >
                {{ themeFeedbackMessage }}
              </p>
            </article>
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
          <div class="meta-edit-row">
            <button
              type="button"
              class="meta-action-button"
              data-testid="workspace-star-toggle"
              :disabled="!currentWorkspace || saving"
              @click="currentWorkspace && toggleWorkspaceStar(currentWorkspace.id)"
            >
              {{ currentWorkspace?.starred ? '取消收藏工作区' : '收藏工作区' }}
            </button>
            <label class="meta-tag-editor">
              <span>工作区标签</span>
              <input
                v-model="workspaceTagsInput"
                data-testid="workspace-tags-input"
                type="text"
                placeholder="以逗号分隔，例如 backend, api"
                :disabled="!currentWorkspace || saving"
                @blur="commitWorkspaceTags"
                @keydown="onWorkspaceTagsKeydown"
              >
            </label>
          </div>
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
                  <button
                    type="button"
                    class="editor-tool-button"
                    data-testid="editor-revisions"
                    :disabled="!canUseEditorTools"
                    @click="openRevisionDialog"
                  >
                    版本
                  </button>
                </div>
                <button
                  type="button"
                  class="editor-tool-button"
                  data-testid="file-star-toggle"
                  :disabled="!canUseEditorTools"
                  @click="toggleActiveFileStar"
                >
                  {{ activeFile?.starred ? '取消收藏文件' : '收藏文件' }}
                </button>
                <label class="file-tag-editor">
                  <span>文件标签</span>
                  <input
                    v-model="fileTagsInput"
                    data-testid="file-tags-input"
                    type="text"
                    placeholder="以逗号分隔"
                    :disabled="!canUseEditorTools"
                    @blur="commitFileTags"
                    @keydown="onFileTagsKeydown"
                  >
                </label>
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

    <RevisionDialog
      :open="revisionDialogOpen"
      :file-name="activeFile?.name ?? ''"
      :revisions="revisionItems"
      :loading="revisionLoading"
      :restoring="revisionRestoring"
      @close="closeRevisionDialog"
      @refresh="refreshRevisionDialog"
      @restore="restoreRevision"
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
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  font-family: var(--theme-layout-app-font-family);
  overflow: hidden;
  background: var(--theme-layout-app-shell-background);
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
  color: var(--theme-text-accent);
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.09em;
  font-weight: 700;
}

h2 {
  margin: 2px 0 0;
  font-size: 26px;
  line-height: 1.1;
  color: var(--theme-text-primary);
}

.meta {
  margin: 0;
  color: var(--theme-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.head-action-button {
  border: 1px solid var(--theme-accent-primary-button-border);
  background: var(--theme-surface-ghost-button-background);
  color: var(--theme-text-primary);
  border-radius: 9px;
  padding: 7px 10px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.error-banner {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--theme-danger-soft-border);
  background: var(--theme-danger-soft-background);
  backdrop-filter: var(--theme-surface-overlay-blur);
  color: var(--theme-danger-soft-text);
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
  background: var(--theme-surface-glass-panel-background);
  border: 1px solid var(--theme-surface-glass-panel-border);
  border-radius: 16px;
  backdrop-filter: var(--theme-surface-overlay-blur);
  box-shadow: var(--theme-surface-glass-panel-shadow);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
}

.settings-tabs {
  display: inline-flex;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--theme-surface-statusbar-border);
}

.settings-tab-button {
  border: 1px solid var(--theme-accent-action-button-border);
  border-radius: 9px;
  background: var(--theme-accent-action-button-background);
  color: var(--theme-accent-action-button-text);
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.settings-tab-button[aria-selected='true'] {
  border-color: var(--theme-accent-selected-border);
  background: var(--theme-accent-selected-background);
  color: var(--theme-accent-selected-text);
}

.settings-tab-panel {
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  padding: 12px;
  gap: 10px;
}

.settings-theme-tab-panel {
  overflow: hidden;
}

.settings-tab-panel p {
  margin: 0;
  color: var(--theme-text-secondary);
  font-size: 13px;
}

.theme-settings {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  border: 1px solid var(--theme-surface-glass-panel-border);
  border-radius: 12px;
  padding: 10px;
  background: var(--theme-surface-glass-card-background);
  box-shadow: var(--theme-surface-glass-panel-shadow);
}

.theme-settings-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.theme-settings-head h4 {
  margin: 0;
  color: var(--theme-text-primary);
  font-size: 15px;
}

.theme-settings-head p {
  margin: 2px 0 0;
  color: var(--theme-text-tertiary);
  font-size: 12px;
}

.theme-settings-head code {
  color: var(--theme-text-primary);
  background: var(--theme-surface-code-tag-background);
  border-radius: 7px;
  padding: 3px 7px;
  font-size: 12px;
}

.theme-export-name {
  display: grid;
  gap: 6px;
}

.theme-preset-selector {
  display: grid;
  gap: 6px;
}

.theme-preset-selector span {
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.theme-preset-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}

.theme-preset-actions select {
  border: 1px solid var(--theme-surface-input-border);
  background: var(--theme-surface-input-background);
  color: var(--theme-text-primary);
  border-radius: 8px;
  padding: 7px 9px;
  font-size: 13px;
  min-width: 0;
}

.theme-export-name span {
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.theme-export-name input {
  border: 1px solid var(--theme-surface-input-border);
  background: var(--theme-surface-input-background);
  color: var(--theme-text-primary);
  border-radius: 8px;
  padding: 7px 9px;
  font-size: 13px;
}

.theme-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.theme-action {
  border: 1px solid var(--theme-accent-action-button-border);
  background: var(--theme-surface-neutral-button-background);
  color: var(--theme-text-primary);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.theme-action.primary {
  border-color: var(--theme-accent-primary-button-border);
  background: var(--theme-accent-primary-button-gradient);
  color: var(--theme-accent-primary-button-text);
}

.theme-import-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.theme-tutorial {
  border: 1px solid var(--theme-surface-input-border);
  border-radius: 10px;
  background: var(--theme-surface-glass-card-background);
  padding: 10px;
  display: grid;
  gap: 10px;
  min-height: 0;
  overflow: auto;
  flex: 1 1 auto;
}

.theme-tutorial h5,
.theme-tutorial h6 {
  margin: 0;
  color: var(--theme-text-primary);
}

.theme-tutorial h5 {
  font-size: 13px;
}

.theme-tutorial h6 {
  font-size: 12px;
}

.theme-tutorial p {
  margin: 0;
  color: var(--theme-text-secondary);
  font-size: 12px;
}

.theme-tutorial-section {
  display: grid;
  gap: 6px;
}

.theme-tutorial-code {
  margin: 0;
  border-radius: 8px;
  border: 1px solid var(--theme-surface-input-border);
  background: var(--theme-surface-code-tag-background);
  padding: 8px;
  overflow: auto;
}

.theme-tutorial-code code {
  display: block;
  color: var(--theme-text-primary);
  font-size: 11px;
  line-height: 1.45;
  white-space: pre;
}

.theme-tutorial-list,
.theme-tutorial-steps {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
}

.theme-tutorial-list li,
.theme-tutorial-steps li {
  color: var(--theme-text-secondary);
  font-size: 12px;
}

.theme-tutorial-list li {
  display: grid;
  gap: 2px;
}

.theme-tutorial-list li strong {
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 600;
}

.theme-tutorial-list li code {
  background: var(--theme-surface-code-tag-background);
  color: var(--theme-text-primary);
  border-radius: 6px;
  padding: 2px 5px;
  width: fit-content;
  font-size: 11px;
}

.theme-feedback {
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.language-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.language-panel-head input {
  width: min(440px, 100%);
  border: 1px solid var(--theme-surface-input-border);
  background: var(--theme-surface-input-background);
  border-radius: 9px;
  padding: 7px 10px;
  font-size: 13px;
  color: var(--theme-text-primary);
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
  border: 1px solid var(--theme-surface-input-border);
  border-radius: 10px;
  background: var(--theme-surface-glass-card-background);
  padding: 8px 10px;
  display: grid;
  align-content: start;
  align-self: start;
  gap: 3px;
}

.language-item strong {
  color: var(--theme-text-primary);
  font-size: 13px;
}

.language-item code {
  color: var(--theme-text-primary);
  font-size: 12px;
  background: var(--theme-surface-code-tag-background);
  border-radius: 6px;
  width: fit-content;
  padding: 2px 6px;
}

.summary-card {
  background: var(--theme-surface-glass-card-background);
  border: 1px solid var(--theme-surface-glass-panel-border);
  border-radius: 14px;
  backdrop-filter: var(--theme-surface-overlay-blur);
  box-shadow: var(--theme-surface-glass-panel-shadow);
  padding: 12px 14px;
}

.summary-card h3 {
  margin: 0 0 6px;
  font-size: 18px;
  color: var(--theme-text-primary);
}

.summary-card p {
  margin: 0;
  color: var(--theme-text-secondary);
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

.meta-edit-row {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.meta-action-button {
  border: 1px solid var(--theme-accent-row-action-border);
  background: var(--theme-accent-row-action-background);
  color: var(--theme-accent-row-action-text);
  border-radius: 9px;
  padding: 6px 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
}

.meta-tag-editor {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.meta-tag-editor input,
.file-tag-editor input {
  border: 1px solid var(--theme-surface-input-border);
  background: var(--theme-surface-input-background);
  color: var(--theme-text-primary);
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 12px;
  min-width: 180px;
}

.workspace-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 700px;
}

.workspace-tile {
  border: 1px solid var(--theme-surface-glass-tile-border);
  background: var(--theme-surface-glass-tile-background);
  border-radius: 12px;
  padding: 10px 12px;
  text-align: left;
  display: grid;
  gap: 4px;
  cursor: pointer;
  backdrop-filter: var(--theme-surface-overlay-blur);
  box-shadow: var(--theme-surface-glass-panel-shadow);
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.workspace-tile:hover {
  transform: translateY(-1px);
  border-color: var(--theme-accent-row-action-border);
  box-shadow: var(--theme-surface-toast-shadow);
}

.workspace-tile strong {
  font-size: 14px;
  color: var(--theme-text-primary);
}

.workspace-tile span {
  color: var(--theme-text-tertiary);
  font-size: 12px;
}

.empty-note {
  margin: 0;
  color: var(--theme-text-secondary);
  font-size: 13px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px dashed var(--theme-surface-input-border);
  background: var(--theme-surface-empty-state-background);
  backdrop-filter: var(--theme-surface-overlay-soft-blur);
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
  background: var(--theme-surface-glass-panel-background);
  border: 1px solid var(--theme-surface-glass-panel-border);
  border-radius: 16px;
  backdrop-filter: var(--theme-surface-overlay-blur);
  box-shadow: var(--theme-surface-glass-panel-shadow);
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
  border-bottom: 1px solid var(--theme-surface-statusbar-border);
  background: var(--theme-surface-glass-header-background);
}

.editor-title {
  min-width: 0;
}

.editor-head h3 {
  margin: 0;
  font-size: 16px;
  color: var(--theme-text-primary);
}

.editor-path {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--theme-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.theme-picker select {
  border: 1px solid var(--theme-surface-input-border);
  background: var(--theme-surface-input-background);
  color: var(--theme-text-primary);
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 12px;
}

.language-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.language-picker select {
  border: 1px solid var(--theme-surface-input-border);
  background: var(--theme-surface-input-background);
  color: var(--theme-text-primary);
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 12px;
}

.file-tag-editor {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.editor-tool-button {
  border: 1px solid var(--theme-surface-neutral-button-border);
  background: var(--theme-surface-neutral-button-background);
  color: var(--theme-text-primary);
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
  border: 1px solid var(--theme-accent-primary-button-border);
  background: var(--theme-accent-primary-button-gradient);
  color: var(--theme-accent-primary-button-text);
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
  color: var(--theme-text-secondary);
  font-size: 14px;
  padding: 16px;
}

.editor-statusbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 7px 12px;
  border-top: 1px solid var(--theme-surface-statusbar-border);
  background: var(--theme-surface-statusbar-background);
  font-size: 12px;
  color: var(--theme-text-secondary);
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
  border: 1px solid var(--theme-surface-toast-border);
  border-radius: 12px;
  padding: 10px 12px;
  background: var(--theme-surface-toast-background);
  color: var(--theme-layout-sidebar-text);
  box-shadow: var(--theme-surface-toast-shadow);
  backdrop-filter: var(--theme-surface-overlay-blur);
}

.undo-toast p {
  margin: 0;
  font-size: 13px;
}

.undo-toast button {
  border: 1px solid var(--theme-accent-row-action-border);
  border-radius: 9px;
  background: var(--theme-accent-row-action-background);
  color: var(--theme-accent-primary-button-text);
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

  .theme-preset-actions {
    grid-template-columns: 1fr;
  }
}
</style>
