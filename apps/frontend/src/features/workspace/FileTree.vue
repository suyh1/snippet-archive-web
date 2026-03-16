<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { WorkspaceFile } from '@/types/workspace'
import { getParentPath, joinPath, normalizePath } from '@/utils/path'
import { validateRenameInput } from '@/utils/rename-validation'

type TreeRow = {
  id: string
  name: string
  kind: string
  path: string
  order: number
  depth: number
  draft?: boolean
}

type CreateDraft = {
  kind: 'file' | 'folder'
  parentPath: string
  name: string
}

type RenameDraft = {
  fileId: string
  parentPath: string
  originalName: string
  name: string
}

const props = defineProps<{
  files: WorkspaceFile[]
  loading?: boolean
  activeFileId?: string | null
}>()

const emit = defineEmits<{
  createFile: [payload: { parentPath: string; name: string }]
  createFolder: [payload: { parentPath: string; name: string }]
  moveFile: [payload: { fileId: string; targetParentPath: string }]
  'select-file': [fileId: string]
  'rename-file': [payload: { fileId: string; newName: string }]
  'delete-file': [fileId: string]
}>()

const draggingId = ref<string | null>(null)
const hoverTargetPath = ref<string | null>(null)
const invalidTargetPath = ref<string | null>(null)
const dropMessage = ref('')

const createDraft = ref<CreateDraft | null>(null)
const renameDraft = ref<RenameDraft | null>(null)

const createInputRef = ref<HTMLInputElement | HTMLInputElement[] | null>(null)
const renameInputRef = ref<HTMLInputElement | HTMLInputElement[] | null>(null)

const createValidationMessage = ref<string | null>(null)
const renameValidationMessage = ref<string | null>(null)
const expandedFolders = ref<Record<string, boolean>>({})
const visibleSegment = ref(1)
const pendingDeleteFileId = ref<string | null>(null)
let pendingDeleteTimer: number | null = null

const ROWS_PER_SEGMENT = 16

const baseRows = computed<TreeRow[]>(() => {
  const sorted = [...props.files].sort((a, b) => {
    const depthA = normalizePath(a.path).split('/').filter(Boolean).length
    const depthB = normalizePath(b.path).split('/').filter(Boolean).length

    if (depthA !== depthB) {
      return depthA - depthB
    }

    if (a.order !== b.order) {
      return a.order - b.order
    }

    return a.path.localeCompare(b.path)
  })

  return sorted.map((item) => ({
    id: item.id,
    name: item.name,
    kind: item.kind,
    path: item.path,
    order: item.order,
    depth: normalizePath(item.path).split('/').filter(Boolean).length - 1,
  }))
})

const rows = computed<TreeRow[]>(() => {
  const mapped = [...baseRows.value]

  if (!createDraft.value) {
    return mapped
  }

  const parentPath = normalizePath(createDraft.value.parentPath)
  const draftDepth = parentPath === '/' ? 0 : parentPath.split('/').filter(Boolean).length
  const previewPath = joinPath(parentPath, createDraft.value.name || 'new-item')

  const draftRow: TreeRow = {
    id: '__create_draft__',
    name: createDraft.value.name,
    kind: createDraft.value.kind,
    path: previewPath,
    order: Number.MAX_SAFE_INTEGER,
    depth: draftDepth,
    draft: true,
  }

  if (parentPath === '/') {
    mapped.unshift(draftRow)
    return mapped
  }

  const normalizedParent = normalizePath(parentPath)
  const descendantPrefix = `${normalizedParent}/`
  const parentIndex = mapped.findIndex((row) => normalizePath(row.path) === normalizedParent)

  if (parentIndex === -1) {
    mapped.push(draftRow)
    return mapped
  }

  let insertAt = parentIndex + 1
  while (
    insertAt < mapped.length &&
    normalizePath(mapped[insertAt].path).startsWith(descendantPrefix)
  ) {
    insertAt += 1
  }

  mapped.splice(insertAt, 0, draftRow)
  return mapped
})

const collapsedRows = computed<TreeRow[]>(() => {
  return rows.value.filter((row) => !isDescendantOfCollapsedFolder(row.path))
})

const totalSegments = computed(() => {
  if (collapsedRows.value.length === 0) {
    return 1
  }

  return Math.ceil(collapsedRows.value.length / ROWS_PER_SEGMENT)
})

const visibleRows = computed<TreeRow[]>(() => {
  const startIndex = (visibleSegment.value - 1) * ROWS_PER_SEGMENT
  return collapsedRows.value.slice(startIndex, startIndex + ROWS_PER_SEGMENT)
})

const hiddenAfterCount = computed(() => {
  const shown = visibleSegment.value * ROWS_PER_SEGMENT
  return Math.max(0, collapsedRows.value.length - shown)
})

function getCreateInputElement() {
  const input = createInputRef.value
  if (Array.isArray(input)) {
    return input[0] ?? null
  }

  return input
}

function getRenameInputElement() {
  const input = renameInputRef.value
  if (Array.isArray(input)) {
    return input[0] ?? null
  }

  return input
}

watch(
  () => createDraft.value,
  async (draft) => {
    if (!draft) {
      return
    }

    jumpToRow('__create_draft__')
    await nextTick()
    const input = getCreateInputElement()
    if (input && typeof input.focus === 'function') {
      input.focus()
    }
    if (input && typeof input.select === 'function') {
      input.select()
    }
  },
)

watch(
  () => renameDraft.value,
  async (draft) => {
    if (!draft) {
      return
    }

    await nextTick()
    const input = getRenameInputElement()
    if (input && typeof input.focus === 'function') {
      input.focus()
    }
    if (input && typeof input.select === 'function') {
      input.select()
    }
  },
)

watch(
  () => props.files,
  (files) => {
    const nextState: Record<string, boolean> = {}

    for (const item of files) {
      if (item.kind !== 'folder') {
        continue
      }

      const normalizedPath = normalizePath(item.path)
      nextState[normalizedPath] = expandedFolders.value[normalizedPath] ?? true
    }

    expandedFolders.value = nextState
  },
  { immediate: true, deep: true },
)

watch(
  () => collapsedRows.value.length,
  () => {
    if (visibleSegment.value > totalSegments.value) {
      visibleSegment.value = totalSegments.value
    }

    if (visibleSegment.value < 1) {
      visibleSegment.value = 1
    }
  },
)

function beginCreate(kind: 'file' | 'folder', parentPath: string) {
  cancelRenameDraft()
  cancelPendingFileDelete()
  ensureExpandedPath(parentPath)

  createDraft.value = {
    kind,
    parentPath: normalizePath(parentPath),
    name: kind === 'file' ? 'main.ts' : 'new-folder',
  }
  createValidationMessage.value = null
}

function getCreateSiblingNames() {
  if (!createDraft.value) {
    return []
  }

  const parentPath = normalizePath(createDraft.value.parentPath)
  return props.files
    .filter((item) => getParentPath(item.path) === parentPath)
    .map((item) => item.name)
}

function validateCreateDraftName() {
  if (!createDraft.value) {
    return null
  }

  const message = validateRenameInput(createDraft.value.name, getCreateSiblingNames())
  createValidationMessage.value = message
  return message
}

function cancelCreateDraft() {
  createDraft.value = null
  createValidationMessage.value = null
}

function submitCreateDraft() {
  if (!createDraft.value) {
    return
  }

  const message = validateCreateDraftName()
  if (message) {
    nextTick(() => {
      const input = getCreateInputElement()
      if (input && typeof input.focus === 'function') {
        input.focus()
      }
      if (input && typeof input.select === 'function') {
        input.select()
      }
    })
    return
  }

  const payload = {
    parentPath: createDraft.value.parentPath,
    name: createDraft.value.name.trim(),
  }

  const kind = createDraft.value.kind
  cancelCreateDraft()

  if (kind === 'file') {
    emit('createFile', payload)
    return
  }

  emit('createFolder', payload)
}

function updateCreateDraftName(value: string) {
  if (!createDraft.value) {
    return
  }

  createDraft.value.name = value
  validateCreateDraftName()
}

function onCreateDraftBlur() {
  submitCreateDraft()
}

function onCreateDraftEnter(event: KeyboardEvent) {
  event.preventDefault()
  submitCreateDraft()
}

function onCreateDraftEscape(event: KeyboardEvent) {
  event.preventDefault()
  cancelCreateDraft()
}

function beginRename(row: TreeRow) {
  cancelCreateDraft()
  cancelPendingFileDelete()

  renameDraft.value = {
    fileId: row.id,
    parentPath: getParentPath(row.path),
    originalName: row.name,
    name: row.name,
  }
  renameValidationMessage.value = null
}

function isFolderExpanded(path: string) {
  const normalizedPath = normalizePath(path)
  return expandedFolders.value[normalizedPath] ?? true
}

function toggleFolder(path: string) {
  const normalizedPath = normalizePath(path)
  expandedFolders.value = {
    ...expandedFolders.value,
    [normalizedPath]: !isFolderExpanded(normalizedPath),
  }
}

function isDescendantOfCollapsedFolder(path: string) {
  const normalizedPath = normalizePath(path)
  const segments = normalizedPath.split('/').filter(Boolean)

  if (segments.length <= 1) {
    return false
  }

  let currentPath = ''
  for (let index = 0; index < segments.length - 1; index += 1) {
    currentPath += `/${segments[index]}`
    if (!isFolderExpanded(currentPath)) {
      return true
    }
  }

  return false
}

function ensureExpandedPath(path: string) {
  const normalizedPath = normalizePath(path)
  const segments = normalizedPath.split('/').filter(Boolean)

  if (segments.length === 0) {
    return
  }

  const nextState = { ...expandedFolders.value }
  let currentPath = ''
  for (const segment of segments) {
    currentPath += `/${segment}`
    nextState[currentPath] = true
  }

  expandedFolders.value = nextState
}

function jumpToRow(rowId: string) {
  const index = collapsedRows.value.findIndex((row) => row.id === rowId)
  if (index < 0) {
    visibleSegment.value = 1
    return
  }

  visibleSegment.value = Math.floor(index / ROWS_PER_SEGMENT) + 1
}

function showNextSegment() {
  if (visibleSegment.value >= totalSegments.value) {
    return
  }

  visibleSegment.value += 1
}

function showPreviousSegment() {
  if (visibleSegment.value <= 1) {
    return
  }

  visibleSegment.value -= 1
}

function getRenameSiblingNames() {
  if (!renameDraft.value) {
    return []
  }

  return props.files
    .filter(
      (item) =>
        item.id !== renameDraft.value?.fileId &&
        getParentPath(item.path) === renameDraft.value?.parentPath,
    )
    .map((item) => item.name)
}

function validateRenameDraftName() {
  if (!renameDraft.value) {
    return null
  }

  const message = validateRenameInput(renameDraft.value.name, getRenameSiblingNames())
  renameValidationMessage.value = message
  return message
}

function cancelRenameDraft() {
  renameDraft.value = null
  renameValidationMessage.value = null
}

function submitRenameDraft() {
  if (!renameDraft.value) {
    return
  }

  const nextName = renameDraft.value.name
  if (nextName === renameDraft.value.originalName) {
    cancelRenameDraft()
    return
  }

  const message = validateRenameDraftName()
  if (message) {
    nextTick(() => {
      const input = getRenameInputElement()
      if (input && typeof input.focus === 'function') {
        input.focus()
      }
      if (input && typeof input.select === 'function') {
        input.select()
      }
    })
    return
  }

  emit('rename-file', {
    fileId: renameDraft.value.fileId,
    newName: renameDraft.value.name.trim(),
  })
  cancelRenameDraft()
}

function updateRenameDraftName(value: string) {
  if (!renameDraft.value) {
    return
  }

  renameDraft.value.name = value
  validateRenameDraftName()
}

function onRenameDraftBlur() {
  submitRenameDraft()
}

function onRenameDraftEnter(event: KeyboardEvent) {
  event.preventDefault()
  submitRenameDraft()
}

function onRenameDraftEscape(event: KeyboardEvent) {
  event.preventDefault()
  cancelRenameDraft()
}

function dragStart(fileId: string) {
  draggingId.value = fileId
  hoverTargetPath.value = null
  invalidTargetPath.value = null
  dropMessage.value = ''
}

function dragEnd() {
  draggingId.value = null
  hoverTargetPath.value = null
  invalidTargetPath.value = null
}

function isInvalidDropTarget(draggingPath: string, draggingKind: string, targetParentPath: string) {
  if (draggingKind !== 'folder') {
    return false
  }

  return (
    targetParentPath === draggingPath ||
    targetParentPath.startsWith(`${draggingPath}/`)
  )
}

function handleDropTarget(targetParentPath: string) {
  if (!draggingId.value) {
    return
  }

  const draggingRow = baseRows.value.find((row) => row.id === draggingId.value)
  if (!draggingRow) {
    draggingId.value = null
    return
  }

  const normalizedTargetParent = normalizePath(targetParentPath)
  const normalizedDraggingPath = normalizePath(draggingRow.path)

  if (isInvalidDropTarget(normalizedDraggingPath, draggingRow.kind, normalizedTargetParent)) {
    invalidTargetPath.value = normalizedTargetParent
    dropMessage.value = '不能移动到自身子目录'
    draggingId.value = null
    return
  }

  emit('moveFile', {
    fileId: draggingId.value,
    targetParentPath: normalizedTargetParent,
  })

  dropMessage.value = ''
  invalidTargetPath.value = null
  hoverTargetPath.value = null
  draggingId.value = null
}

function handleDragOverTarget(targetParentPath: string) {
  if (!draggingId.value) {
    return
  }

  const draggingRow = baseRows.value.find((row) => row.id === draggingId.value)
  if (!draggingRow) {
    return
  }

  const normalizedTargetParent = normalizePath(targetParentPath)
  const normalizedDraggingPath = normalizePath(draggingRow.path)

  if (isInvalidDropTarget(normalizedDraggingPath, draggingRow.kind, normalizedTargetParent)) {
    invalidTargetPath.value = normalizedTargetParent
    hoverTargetPath.value = null
    dropMessage.value = '不能移动到自身子目录'
    return
  }

  invalidTargetPath.value = null
  hoverTargetPath.value = normalizedTargetParent
  dropMessage.value = ''
}

function dropOnRow(row: TreeRow) {
  if (row.draft || renameDraft.value?.fileId === row.id) {
    return
  }

  if (row.kind === 'folder') {
    handleDropTarget(row.path)
    return
  }

  handleDropTarget(getParentPath(row.path))
}

function dragOverRow(row: TreeRow) {
  if (row.draft || renameDraft.value?.fileId === row.id) {
    return
  }

  if (row.kind === 'folder') {
    handleDragOverTarget(row.path)
    return
  }

  handleDragOverTarget(getParentPath(row.path))
}

function selectFile(fileId: string) {
  emit('select-file', fileId)
}

function deleteFile(fileId: string) {
  emit('delete-file', fileId)
}

function clearPendingDeleteTimer() {
  if (pendingDeleteTimer !== null) {
    window.clearTimeout(pendingDeleteTimer)
    pendingDeleteTimer = null
  }
}

function schedulePendingDeleteReset() {
  clearPendingDeleteTimer()
  pendingDeleteTimer = window.setTimeout(() => {
    pendingDeleteFileId.value = null
    pendingDeleteTimer = null
  }, 5000)
}

function startFileDeleteConfirm(fileId: string) {
  pendingDeleteFileId.value = fileId
  schedulePendingDeleteReset()
}

function cancelPendingFileDelete() {
  pendingDeleteFileId.value = null
  clearPendingDeleteTimer()
}

function confirmFileDelete(fileId: string) {
  if (pendingDeleteFileId.value !== fileId) {
    return
  }

  cancelPendingFileDelete()
  emit('delete-file', fileId)
}

function onRowClick(row: TreeRow, event: MouseEvent) {
  if (row.draft || renameDraft.value?.fileId === row.id) {
    return
  }

  const target = event.target as HTMLElement | null
  if (!target) {
    selectFile(row.id)
    return
  }

  if (
    target.closest('.row-actions') ||
    target.closest('.folder-toggle')
  ) {
    return
  }

  selectFile(row.id)
}

onBeforeUnmount(() => {
  clearPendingDeleteTimer()
})
</script>

<template>
  <section class="file-tree">
    <header class="tree-header">
      <h3>Files</h3>
      <div class="tree-actions">
        <button type="button" data-testid="create-file-root" @click="beginCreate('file', '/')">
          新建文件
        </button>
        <button type="button" data-testid="create-folder-root" @click="beginCreate('folder', '/')">
          新建文件夹
        </button>
      </div>
    </header>

    <div
      :class="['root-dropzone', { active: hoverTargetPath === '/', invalid: invalidTargetPath === '/' }]"
      @dragover.prevent="handleDragOverTarget('/')"
      @drop.prevent="handleDropTarget('/')"
    >
      拖拽到这里可移动到根目录
    </div>

    <p v-if="dropMessage" class="drop-message">
      {{ dropMessage }}
    </p>

    <p v-if="loading" class="hint">文件加载中...</p>

    <ul v-else-if="collapsedRows.length > 0" class="rows">
      <li
        v-for="row in visibleRows"
        :key="row.id"
        data-testid="tree-row"
        :class="[
          'row',
          { active: row.id === props.activeFileId },
          { draft: row.draft },
          { 'rename-draft': renameDraft?.fileId === row.id },
          { 'drop-active': !row.draft && renameDraft?.fileId !== row.id && hoverTargetPath === (row.kind === 'folder' ? row.path : getParentPath(row.path)) },
          { 'drop-invalid': !row.draft && renameDraft?.fileId !== row.id && invalidTargetPath === (row.kind === 'folder' ? row.path : getParentPath(row.path)) },
        ]"
        :draggable="!row.draft && renameDraft?.fileId !== row.id"
        @click="onRowClick(row, $event)"
        @dragstart="dragStart(row.id)"
        @dragend="dragEnd"
        @dragover.prevent="dragOverRow(row)"
        @drop.prevent="dropOnRow(row)"
      >
        <template v-if="row.draft">
          <div class="row-main draft-main" :style="{ paddingLeft: `${row.depth * 16 + 8}px` }">
            <span class="kind">{{ row.kind === 'folder' ? '📁' : '📄' }}</span>
            <input
              ref="createInputRef"
              data-testid="create-inline-input"
              class="draft-input"
              :value="createDraft?.name ?? ''"
              @input="updateCreateDraftName(($event.target as HTMLInputElement).value)"
              @blur="onCreateDraftBlur"
              @keydown.enter="onCreateDraftEnter"
              @keydown.esc="onCreateDraftEscape"
            >
            <span class="meta">{{ row.path }}</span>
          </div>

          <div class="row-actions">
            <button
              type="button"
              class="cancel-button"
              @mousedown.prevent
              @click="cancelCreateDraft"
            >
              取消
            </button>
          </div>
        </template>

        <template v-else-if="renameDraft?.fileId === row.id">
          <div class="row-main draft-main" :style="{ paddingLeft: `${row.depth * 16 + 8}px` }">
            <span class="kind">{{ row.kind === 'folder' ? '📁' : '📄' }}</span>
            <input
              ref="renameInputRef"
              data-testid="rename-inline-input"
              class="draft-input"
              :value="renameDraft.name"
              @input="updateRenameDraftName(($event.target as HTMLInputElement).value)"
              @blur="onRenameDraftBlur"
              @keydown.enter="onRenameDraftEnter"
              @keydown.esc="onRenameDraftEscape"
            >
            <span class="meta">{{ joinPath(renameDraft.parentPath, renameDraft.name || renameDraft.originalName) }}</span>
          </div>

          <div class="row-actions">
            <button
              type="button"
              class="cancel-button"
              @mousedown.prevent
              @click="cancelRenameDraft"
            >
              取消
            </button>
          </div>
        </template>

        <template v-else>
          <div
            class="row-main"
            :style="{ paddingLeft: `${row.depth * 16 + 8}px` }"
          >
            <button
              v-if="row.kind === 'folder'"
              type="button"
              class="folder-toggle"
              :data-testid="`toggle-folder-${row.id}`"
              :aria-label="isFolderExpanded(row.path) ? '折叠文件夹' : '展开文件夹'"
              @click="toggleFolder(row.path)"
            >
              {{ isFolderExpanded(row.path) ? '▾' : '▸' }}
            </button>
            <span v-else class="folder-toggle-placeholder" aria-hidden="true" />

            <button
              type="button"
              class="row-select"
              @click.stop="selectFile(row.id)"
            >
              <span class="kind">{{ row.kind === 'folder' ? '📁' : '📄' }}</span>
              <span class="name">{{ row.name }}</span>
              <span class="meta">{{ row.path }}</span>
            </button>
          </div>

          <div class="row-actions">
            <template v-if="row.kind === 'file' && pendingDeleteFileId === row.id">
              <button
                type="button"
                class="danger-action"
                data-testid="confirm-delete-file"
                @click="confirmFileDelete(row.id)"
              >
                确认删除
              </button>
              <button
                type="button"
                data-testid="cancel-delete-file"
                @click="cancelPendingFileDelete"
              >
                取消
              </button>
            </template>

            <template v-else>
              <button
                v-if="row.kind === 'folder'"
                type="button"
                @click="beginCreate('file', row.path)"
              >
                +文件
              </button>
              <button
                v-if="row.kind === 'folder'"
                type="button"
                @click="beginCreate('folder', row.path)"
              >
                +文件夹
              </button>
              <button
                type="button"
                data-testid="rename-item"
                @click="beginRename(row)"
              >
                重命名
              </button>
              <button
                type="button"
                data-testid="delete-item"
                @click="row.kind === 'file' ? startFileDeleteConfirm(row.id) : deleteFile(row.id)"
              >
                删除
              </button>
            </template>
          </div>
        </template>
      </li>
    </ul>

    <div v-if="!loading && collapsedRows.length > 0" class="rows-footer">
      <button
        v-if="visibleSegment > 1"
        type="button"
        data-testid="show-previous-rows"
        @click="showPreviousSegment"
      >
        上一组
      </button>
      <p class="rows-indicator" data-testid="rows-segment-indicator">
        {{ visibleSegment }} / {{ totalSegments }}
      </p>
      <button
        v-if="hiddenAfterCount > 0"
        type="button"
        data-testid="show-more-rows"
        @click="showNextSegment"
      >
        显示更多（剩余 {{ hiddenAfterCount }} 项）
      </button>
    </div>

    <div v-if="createValidationMessage" class="create-error" data-testid="create-inline-error">
      {{ createValidationMessage }}
    </div>
    <div v-if="renameValidationMessage" class="create-error" data-testid="rename-inline-error">
      {{ renameValidationMessage }}
    </div>

    <p v-if="!loading && collapsedRows.length === 0" class="hint">当前工作区还没有文件，点击「新建文件」开始。</p>
  </section>
</template>

<style scoped>
.file-tree {
  border: 1px solid var(--theme-surface-glass-panel-border);
  border-radius: 16px;
  background: var(--theme-surface-glass-card-background);
  backdrop-filter: var(--theme-surface-overlay-blur);
  box-shadow: var(--theme-surface-glass-panel-shadow);
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--theme-surface-statusbar-border);
  background: var(--theme-surface-glass-header-background);
}

.tree-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--theme-text-primary);
}

.tree-actions {
  display: flex;
  gap: 8px;
}

.tree-actions button {
  border: 1px solid var(--theme-accent-action-button-border);
  border-radius: 9px;
  background: var(--theme-surface-neutral-button-background);
  padding: 6px 10px;
  cursor: pointer;
  color: var(--theme-text-primary);
  font-weight: 600;
}

.root-dropzone {
  margin: 10px;
  border: 1px dashed var(--theme-accent-primary-button-border);
  border-radius: 10px;
  color: var(--theme-accent-selected-text);
  font-size: 13px;
  padding: 8px;
  text-align: center;
  background: var(--theme-surface-root-dropzone-background);
}

.root-dropzone.active {
  border-color: var(--theme-accent-selected-border);
  background: var(--theme-surface-root-dropzone-active-background);
}

.root-dropzone.invalid {
  border-color: var(--theme-danger-strong-border);
  background: var(--theme-surface-root-dropzone-invalid-background);
  color: var(--theme-danger-soft-text);
}

.drop-message {
  margin: 0 10px 8px;
  color: var(--theme-danger-soft-text);
  font-size: 12px;
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--theme-surface-row-border);
  padding: 6px 10px;
}

.row.active {
  background: var(--theme-surface-row-active-background);
}

.row.draft {
  background: var(--theme-surface-row-draft-background);
}

.row.rename-draft {
  background: var(--theme-surface-row-rename-background);
}

.row.drop-active {
  background: var(--theme-surface-row-drop-active-background);
}

.row.drop-invalid {
  background: var(--theme-surface-row-drop-invalid-background);
}

.row-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.row-main.draft-main {
  cursor: text;
}

.folder-toggle {
  width: 24px;
  height: 24px;
  border: 1px solid var(--theme-surface-neutral-button-border);
  border-radius: 7px;
  background: var(--theme-surface-neutral-button-background);
  color: var(--theme-text-primary);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.folder-toggle-placeholder {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.row-select {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  padding: 0;
  color: inherit;
  flex: 1;
}

.draft-input {
  flex: 1;
  min-width: 120px;
  border: 1px solid var(--theme-accent-primary-button-border);
  border-radius: 8px;
  padding: 5px 8px;
  background: var(--theme-surface-input-background);
  color: var(--theme-text-primary);
  font-size: 13px;
}

.kind {
  width: 20px;
  text-align: center;
}

.name {
  font-weight: 600;
  color: var(--theme-text-primary);
}

.meta {
  color: var(--theme-text-tertiary);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.row-actions button {
  border: 1px solid var(--theme-surface-neutral-button-border);
  background: var(--theme-surface-neutral-button-background);
  color: var(--theme-text-primary);
  border-radius: 8px;
  padding: 4px 8px;
  cursor: pointer;
}

.row-actions .cancel-button {
  border-color: var(--theme-danger-soft-border);
  background: var(--theme-danger-soft-background);
  color: var(--theme-text-danger-strong);
}

.row-actions .danger-action {
  border-color: var(--theme-danger-strong-border);
  background: var(--theme-danger-strong-background);
  color: var(--theme-danger-strong-text);
}

.create-error {
  margin: 0 10px 8px;
  color: var(--theme-danger-subtle-text);
  font-size: 12px;
}

.rows-footer {
  margin: 0 10px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.rows-footer button {
  border: 1px solid var(--theme-surface-neutral-button-border);
  background: var(--theme-surface-input-background);
  color: var(--theme-text-primary);
  border-radius: 8px;
  padding: 5px 9px;
  font-size: 12px;
  cursor: pointer;
}

.rows-indicator {
  margin: 0;
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.hint {
  margin: 0;
  padding: 14px;
  color: var(--theme-text-secondary);
  font-size: 13px;
}
</style>
