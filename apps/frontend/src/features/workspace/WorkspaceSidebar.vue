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
  toggleStar: [workspaceId: string]
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
          class="star-button"
          :title="item.starred ? '取消收藏工作区' : '收藏工作区'"
          data-testid="workspace-sidebar-star-toggle"
          @click.stop="emit('toggleStar', item.id)"
        >
          {{ item.starred ? '已收藏' : '收藏' }}
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
  background: var(--theme-layout-sidebar-background);
  color: var(--theme-layout-sidebar-text);
  border-right: 1px solid var(--theme-layout-sidebar-border);
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
  background: var(--theme-accent-sidebar-ghost-background);
  color: var(--theme-accent-sidebar-ghost-text);
  border: 1px solid var(--theme-accent-sidebar-ghost-border);
  border-radius: 10px;
  padding: 6px 11px;
  cursor: pointer;
  backdrop-filter: var(--theme-surface-overlay-blur);
}

.create-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
}

.create-form input {
  border: 1px solid var(--theme-surface-input-border);
  border-radius: 10px;
  background: var(--theme-surface-overlay-strong-background);
  color: var(--theme-text-inverse);
  padding: 8px 10px;
}

.create-form button {
  border: 1px solid var(--theme-accent-sidebar-primary-border);
  border-radius: 10px;
  background: var(--theme-accent-sidebar-primary-gradient);
  color: var(--theme-accent-sidebar-primary-text);
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
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--theme-surface-statusbar-border);
  border-radius: 11px;
  background: var(--theme-surface-overlay-strong-background);
  padding: 4px;
  backdrop-filter: var(--theme-surface-overlay-blur);
  transition: border-color 160ms ease, transform 160ms ease;
}

.workspace-item:hover {
  border-color: var(--theme-accent-sidebar-primary-border);
  transform: translateX(1px);
}

.workspace-item.active {
  border-color: var(--theme-accent-focus-border);
  box-shadow: 0 0 0 1px var(--theme-accent-focus-ring) inset;
}

.open-button {
  border: none;
  background: transparent;
  text-align: left;
  color: var(--theme-layout-sidebar-text);
  padding: 8px;
  cursor: pointer;
}

.title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-button {
  border: 1px solid var(--theme-danger-soft-border);
  background: var(--theme-danger-soft-background);
  color: var(--theme-danger-soft-text);
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
}

.star-button {
  border: 1px solid var(--theme-accent-row-action-border);
  background: var(--theme-accent-row-action-background);
  color: var(--theme-accent-row-action-text);
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
}

.hint {
  margin: 0;
  color: var(--theme-text-muted);
  font-size: 13px;
}
</style>
