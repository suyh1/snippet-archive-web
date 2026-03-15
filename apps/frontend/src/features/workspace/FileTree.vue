<script setup lang="ts">
import { computed, ref } from 'vue'
import type { WorkspaceFile } from '@/types/workspace'
import { getParentPath, normalizePath } from '@/utils/path'

type TreeRow = {
  id: string
  name: string
  kind: string
  path: string
  order: number
  depth: number
}

const props = defineProps<{
  files: WorkspaceFile[]
  loading?: boolean
  activeFileId?: string | null
}>()

const emit = defineEmits<{
  createFile: [parentPath: string]
  createFolder: [parentPath: string]
  moveFile: [payload: { fileId: string; targetParentPath: string }]
  'select-file': [fileId: string]
  'rename-file': [fileId: string]
  'delete-file': [fileId: string]
}>()

const draggingId = ref<string | null>(null)
const hoverTargetPath = ref<string | null>(null)
const invalidTargetPath = ref<string | null>(null)
const dropMessage = ref('')

const rows = computed<TreeRow[]>(() => {
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

function createFileAt(parentPath: string) {
  emit('createFile', parentPath)
}

function createFolderAt(parentPath: string) {
  emit('createFolder', parentPath)
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

  const draggingRow = rows.value.find((row) => row.id === draggingId.value)
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

  const draggingRow = rows.value.find((row) => row.id === draggingId.value)
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
  if (row.kind === 'folder') {
    handleDropTarget(row.path)
    return
  }

  handleDropTarget(getParentPath(row.path))
}

function dragOverRow(row: TreeRow) {
  if (row.kind === 'folder') {
    handleDragOverTarget(row.path)
    return
  }

  handleDragOverTarget(getParentPath(row.path))
}

function selectFile(fileId: string) {
  emit('select-file', fileId)
}

function renameFile(fileId: string) {
  emit('rename-file', fileId)
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
        <button type="button" data-testid="create-file-root" @click="createFileAt('/')">
          新建文件
        </button>
        <button type="button" data-testid="create-folder-root" @click="createFolderAt('/')">
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
          { 'drop-active': hoverTargetPath === (row.kind === 'folder' ? row.path : getParentPath(row.path)) },
          { 'drop-invalid': invalidTargetPath === (row.kind === 'folder' ? row.path : getParentPath(row.path)) },
        ]"
        :draggable="true"
        @dragstart="dragStart(row.id)"
        @dragend="dragEnd"
        @dragover.prevent="dragOverRow(row)"
        @drop.prevent="dropOnRow(row)"
      >
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
            @click="createFileAt(row.path)"
          >
            +文件
          </button>
          <button
            v-if="row.kind === 'folder'"
            type="button"
            @click="createFolderAt(row.path)"
          >
            +文件夹
          </button>
          <button
            type="button"
            data-testid="rename-item"
            @click="renameFile(row.id)"
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
      </li>
    </ul>

    <p v-else class="hint">当前工作区还没有文件，点击「新建文件」开始。</p>
  </section>
</template>

<style scoped>
.file-tree {
  border: 1px solid #d1d5db;
  border-radius: 16px;
  background: #ffffff;
  overflow: hidden;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.tree-header h3 {
  margin: 0;
  font-size: 16px;
}

.tree-actions {
  display: flex;
  gap: 8px;
}

.tree-actions button {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: white;
  padding: 6px 8px;
  cursor: pointer;
}

.root-dropzone {
  margin: 10px;
  border: 1px dashed #93c5fd;
  border-radius: 10px;
  color: #1d4ed8;
  font-size: 13px;
  padding: 8px;
  text-align: center;
}

.root-dropzone.active {
  border-color: #2563eb;
  background: #eff6ff;
}

.root-dropzone.invalid {
  border-color: #ef4444;
  background: #fef2f2;
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
  border-top: 1px solid #f1f5f9;
  padding: 6px 10px;
}

.row.active {
  background: #ecfeff;
}

.row.drop-active {
  background: #eff6ff;
}

.row.drop-invalid {
  background: #fef2f2;
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

.kind {
  width: 20px;
  text-align: center;
}

.name {
  font-weight: 600;
}

.meta {
  color: #64748b;
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
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #1e40af;
  border-radius: 8px;
  padding: 4px 8px;
  cursor: pointer;
}

.hint {
  margin: 0;
  padding: 16px;
  color: #64748b;
}
</style>
