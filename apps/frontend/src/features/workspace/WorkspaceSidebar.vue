<script setup lang="ts">
import { ref } from 'vue'
import type { Workspace } from '@/types/workspace'

const props = defineProps<{
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  loading?: boolean
  saving?: boolean
}>()

const emit = defineEmits<{
  open: [workspaceId: string]
  delete: [workspaceId: string]
  create: [title: string]
  library: []
}>()

const titleInput = ref('')

function submitCreate() {
  const value = titleInput.value.trim()
  if (!value) {
    return
  }

  emit('create', value)
  titleInput.value = ''
}
</script>

<template>
  <aside class="workspace-sidebar">
    <div class="sidebar-head">
      <h1>Snippet Archive</h1>
      <button type="button" class="library-button" @click="emit('library')">
        Library
      </button>
    </div>

    <form class="create-form" @submit.prevent="submitCreate">
      <input
        v-model="titleInput"
        type="text"
        placeholder="新建工作区名称"
        :disabled="saving"
      >
      <button type="submit" :disabled="saving || !titleInput.trim()">
        新建
      </button>
    </form>

    <p v-if="loading" class="hint">加载中...</p>

    <ul v-else-if="props.workspaces.length > 0" class="workspace-list">
      <li
        v-for="item in props.workspaces"
        :key="item.id"
        :class="['workspace-item', { active: item.id === props.activeWorkspaceId }]"
      >
        <button
          type="button"
          class="open-button"
          @click="emit('open', item.id)"
        >
          <span class="title">{{ item.title }}</span>
        </button>

        <button
          type="button"
          class="delete-button"
          title="删除工作区"
          @click="emit('delete', item.id)"
        >
          删除
        </button>
      </li>
    </ul>

    <p v-else class="hint">还没有工作区，先创建一个吧。</p>
  </aside>
</template>

<style scoped>
.workspace-sidebar {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
  color: #e2e8f0;
  border-right: 1px solid #334155;
}

.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

h1 {
  margin: 0;
  font-size: 18px;
  letter-spacing: 0.03em;
}

.library-button {
  background: transparent;
  color: #cbd5e1;
  border: 1px solid #64748b;
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
}

.create-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

.create-form input {
  border: 1px solid #475569;
  border-radius: 10px;
  background: #0b1220;
  color: #f8fafc;
  padding: 8px 10px;
}

.create-form button {
  border: none;
  border-radius: 10px;
  background: #38bdf8;
  color: #082f49;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 700;
}

.workspace-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.workspace-item {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
  border: 1px solid #334155;
  border-radius: 10px;
  background: #0b1220;
  padding: 4px;
}

.workspace-item.active {
  border-color: #38bdf8;
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.25) inset;
}

.open-button {
  border: none;
  background: transparent;
  text-align: left;
  color: #e2e8f0;
  padding: 8px;
  cursor: pointer;
}

.title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-button {
  border: none;
  background: #451a1a;
  color: #fecaca;
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
}

.hint {
  margin: 0;
  color: #94a3b8;
  font-size: 13px;
}
</style>
