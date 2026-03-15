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
  align-content: start;
  gap: 10px;
  padding: 14px 12px;
  background:
    radial-gradient(circle at 14% 12%, rgba(125, 211, 252, 0.24), transparent 45%),
    radial-gradient(circle at 80% 100%, rgba(20, 184, 166, 0.2), transparent 40%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.9));
  color: #e2e8f0;
  border-right: 1px solid rgba(148, 163, 184, 0.28);
}

.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

h1 {
  margin: 0;
  font-size: 17px;
  letter-spacing: 0.04em;
}

.library-button {
  background: rgba(255, 255, 255, 0.12);
  color: #dbeafe;
  border: 1px solid rgba(186, 230, 253, 0.36);
  border-radius: 10px;
  padding: 6px 11px;
  cursor: pointer;
  backdrop-filter: blur(8px);
}

.create-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
}

.create-form input {
  border: 1px solid rgba(148, 163, 184, 0.42);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.56);
  color: #f8fafc;
  padding: 8px 10px;
}

.create-form button {
  border: 1px solid rgba(56, 189, 248, 0.55);
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.95), rgba(45, 212, 191, 0.86));
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
  gap: 6px;
  align-content: start;
}

.workspace-item {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 11px;
  background: linear-gradient(145deg, rgba(15, 23, 42, 0.5), rgba(15, 23, 42, 0.32));
  padding: 4px;
  backdrop-filter: blur(8px);
  transition: border-color 160ms ease, transform 160ms ease;
}

.workspace-item:hover {
  border-color: rgba(125, 211, 252, 0.55);
  transform: translateX(1px);
}

.workspace-item.active {
  border-color: rgba(56, 189, 248, 0.85);
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.35) inset;
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
  border: 1px solid rgba(248, 113, 113, 0.38);
  background: rgba(127, 29, 29, 0.42);
  color: #fee2e2;
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
