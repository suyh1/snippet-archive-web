<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
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

function beginCreate(kind: 'file' | 'folder', parentPath: string) {
  cancelRenameDraft()

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

  renameDraft.value = {
    fileId: row.id,
    parentPath: getParentPath(row.path),
    originalName: row.name,
    name: row.name,
  }
  renameValidationMessage.value = null
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

    <ul v-else-if="rows.length > 0" class="rows">
      <li
        v-for="row in rows"
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
          <button
            type="button"
            class="row-main"
            :style="{ paddingLeft: `${row.depth * 16 + 8}px` }"
            @click="selectFile(row.id)"
          >
            <span class="kind">{{ row.kind === 'folder' ? '📁' : '📄' }}</span>
            <span class="name">{{ row.name }}</span>
            <span class="meta">{{ row.path }}</span>
          </button>

          <div class="row-actions">
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
              @click="deleteFile(row.id)"
            >
              删除
            </button>
          </div>
        </template>
      </li>
    </ul>

    <div v-if="createValidationMessage" class="create-error" data-testid="create-inline-error">
      {{ createValidationMessage }}
    </div>
    <div v-if="renameValidationMessage" class="create-error" data-testid="rename-inline-error">
      {{ renameValidationMessage }}
    </div>

    <p v-if="!loading && rows.length === 0" class="hint">当前工作区还没有文件，点击「新建文件」开始。</p>
  </section>
</template>

<style scoped>
.file-tree {
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 16px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.64), rgba(224, 242, 254, 0.4));
  backdrop-filter: blur(12px);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.09);
  overflow: hidden;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.28);
  background: linear-gradient(120deg, rgba(219, 234, 254, 0.58), rgba(186, 230, 253, 0.3));
}

.tree-header h3 {
  margin: 0;
  font-size: 16px;
  color: #0f172a;
}

.tree-actions {
  display: flex;
  gap: 8px;
}

.tree-actions button {
  border: 1px solid rgba(148, 163, 184, 0.48);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.74);
  padding: 6px 10px;
  cursor: pointer;
  color: #0f172a;
  font-weight: 600;
}

.root-dropzone {
  margin: 10px;
  border: 1px dashed rgba(14, 165, 233, 0.75);
  border-radius: 10px;
  color: #0c4a6e;
  font-size: 13px;
  padding: 8px;
  text-align: center;
  background: rgba(224, 242, 254, 0.45);
}

.root-dropzone.active {
  border-color: #0284c7;
  background: rgba(186, 230, 253, 0.6);
}

.root-dropzone.invalid {
  border-color: #ef4444;
  background: rgba(254, 226, 226, 0.66);
  color: #991b1b;
}

.drop-message {
  margin: 0 10px 8px;
  color: #991b1b;
  font-size: 12px;
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
  border-top: 1px solid rgba(226, 232, 240, 0.72);
  padding: 6px 10px;
}

.row.active {
  background: rgba(186, 230, 253, 0.55);
}

.row.draft {
  background: rgba(240, 249, 255, 0.82);
}

.row.rename-draft {
  background: rgba(236, 254, 255, 0.85);
}

.row.drop-active {
  background: rgba(191, 219, 254, 0.56);
}

.row.drop-invalid {
  background: rgba(254, 226, 226, 0.66);
}

.row-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.row-main.draft-main {
  cursor: text;
}

.draft-input {
  flex: 1;
  min-width: 120px;
  border: 1px solid rgba(14, 165, 233, 0.45);
  border-radius: 8px;
  padding: 5px 8px;
  background: rgba(255, 255, 255, 0.82);
  color: #0f172a;
  font-size: 13px;
}

.kind {
  width: 20px;
  text-align: center;
}

.name {
  font-weight: 600;
  color: #0f172a;
}

.meta {
  color: #475569;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  gap: 6px;
}

.row-actions button {
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(255, 255, 255, 0.72);
  color: #1e293b;
  border-radius: 8px;
  padding: 4px 8px;
  cursor: pointer;
}

.row-actions .cancel-button {
  border-color: rgba(248, 113, 113, 0.4);
  background: rgba(254, 226, 226, 0.8);
  color: #7f1d1d;
}

.create-error {
  margin: 0 10px 8px;
  color: #b91c1c;
  font-size: 12px;
}

.hint {
  margin: 0;
  padding: 14px;
  color: #334155;
  font-size: 13px;
}
</style>
