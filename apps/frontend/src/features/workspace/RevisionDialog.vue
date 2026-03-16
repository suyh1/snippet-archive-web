<script setup lang="ts">
import { computed } from 'vue'
import type { WorkspaceFileRevision } from '@/types/workspace'

const props = withDefaults(
  defineProps<{
    open: boolean
    fileName?: string
    revisions?: WorkspaceFileRevision[]
    loading?: boolean
    restoring?: boolean
  }>(),
  {
    fileName: '',
    revisions: () => [],
    loading: false,
    restoring: false,
  },
)

const emit = defineEmits<{
  close: []
  refresh: []
  restore: [revisionId: string]
}>()

const sortedRevisions = computed(() => {
  return [...props.revisions].sort((a, b) => {
    const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    if (timeDiff !== 0) {
      return timeDiff
    }

    return b.id.localeCompare(a.id)
  })
})

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
  })
}

function formatSource(source: WorkspaceFileRevision['source']) {
  return source === 'restore' ? '回滚操作' : '保存更新'
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="revision-overlay"
      data-testid="revision-dialog"
      @click.self="emit('close')"
    >
      <section class="revision-card" role="dialog" aria-modal="true" aria-label="版本历史">
        <header class="revision-head">
          <div>
            <h3>版本历史</h3>
            <p>文件：{{ fileName || '当前文件' }}</p>
          </div>

          <div class="revision-actions">
            <button
              type="button"
              class="ghost"
              data-testid="revision-refresh"
              :disabled="loading || restoring"
              @click="emit('refresh')"
            >
              刷新
            </button>
            <button type="button" class="ghost" @click="emit('close')">
              关闭
            </button>
          </div>
        </header>

        <p v-if="loading" class="revision-loading" data-testid="revision-loading">
          版本加载中...
        </p>

        <ul v-else-if="sortedRevisions.length > 0" class="revision-list">
          <li
            v-for="item in sortedRevisions"
            :key="item.id"
            class="revision-item"
            data-testid="revision-item"
          >
            <div class="meta">
              <strong>{{ formatTime(item.createdAt) }}</strong>
              <span>{{ item.language }} · {{ formatSource(item.source) }}</span>
              <span class="summary">{{ item.summary }}</span>
            </div>
            <button
              type="button"
              data-testid="revision-restore"
              :disabled="restoring"
              @click="emit('restore', item.id)"
            >
              {{ restoring ? '回滚中...' : '回滚到此版本' }}
            </button>
          </li>
        </ul>

        <p
          v-else
          class="revision-empty"
          data-testid="revision-empty"
        >
          暂无版本记录，请先保存文件。
        </p>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.revision-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  background: var(--theme-surface-overlay-strong-background);
  backdrop-filter: var(--theme-surface-overlay-soft-blur);
}

.revision-card {
  width: min(760px, calc(100vw - 32px));
  max-height: min(76vh, 640px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border-radius: 16px;
  border: 1px solid var(--theme-surface-glass-panel-border);
  background: var(--theme-surface-glass-card-background);
  box-shadow: var(--theme-surface-glass-panel-shadow);
  overflow: hidden;
}

.revision-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--theme-surface-statusbar-border);
}

.revision-head h3 {
  margin: 0;
  font-size: 18px;
  color: var(--theme-text-primary);
}

.revision-head p {
  margin: 4px 0 0;
  color: var(--theme-text-tertiary);
  font-size: 12px;
}

.revision-actions {
  display: inline-flex;
  gap: 8px;
}

.revision-actions .ghost {
  border: 1px solid var(--theme-surface-neutral-button-border);
  background: var(--theme-surface-neutral-button-background);
  color: var(--theme-text-primary);
  border-radius: 8px;
  padding: 6px 10px;
  font-weight: 600;
  cursor: pointer;
}

.revision-list {
  list-style: none;
  margin: 0;
  padding: 12px 16px 16px;
  display: grid;
  gap: 10px;
  overflow: auto;
}

.revision-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--theme-surface-neutral-button-border);
  background: var(--theme-surface-neutral-button-background);
}

.revision-item .meta {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.revision-item strong {
  font-size: 13px;
  color: var(--theme-text-primary);
}

.revision-item span {
  font-size: 12px;
  color: var(--theme-text-tertiary);
}

.revision-item .summary {
  color: var(--theme-text-secondary);
}

.revision-item button {
  border: 1px solid var(--theme-accent-row-action-border);
  background: var(--theme-accent-row-action-background);
  color: var(--theme-accent-row-action-text);
  border-radius: 8px;
  padding: 6px 10px;
  font-weight: 600;
  cursor: pointer;
}

.revision-item button:disabled,
.revision-actions .ghost:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.revision-loading,
.revision-empty {
  margin: 0;
  padding: 20px 16px;
  color: var(--theme-text-tertiary);
  font-size: 13px;
}
</style>
