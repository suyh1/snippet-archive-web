<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WorkspaceFileRevision } from '@/types/workspace'
import { buildUnifiedLineDiff } from '@/utils/revision-diff'

const props = withDefaults(
  defineProps<{
    open: boolean
    fileName?: string
    revisions?: WorkspaceFileRevision[]
    currentContent?: string
    currentLanguage?: string
    loading?: boolean
    restoring?: boolean
  }>(),
  {
    fileName: '',
    revisions: () => [],
    currentContent: '',
    currentLanguage: 'plaintext',
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

const selectedRevisionId = ref<string | null>(null)

watch(
  [() => props.open, () => sortedRevisions.value],
  ([open, revisions]) => {
    if (!open) {
      selectedRevisionId.value = null
      return
    }

    if (revisions.length === 0) {
      selectedRevisionId.value = null
      return
    }

    if (!selectedRevisionId.value) {
      selectedRevisionId.value = revisions[0]?.id ?? null
      return
    }

    const exists = revisions.some((item) => item.id === selectedRevisionId.value)
    if (!exists) {
      selectedRevisionId.value = revisions[0]?.id ?? null
    }
  },
  { immediate: true },
)

const selectedRevision = computed(() => {
  if (!selectedRevisionId.value) {
    return null
  }

  return sortedRevisions.value.find((item) => item.id === selectedRevisionId.value) ?? null
})

const diffRows = computed(() => {
  if (!selectedRevision.value) {
    return []
  }

  return buildUnifiedLineDiff(selectedRevision.value.content, props.currentContent)
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

function diffPrefix(type: 'context' | 'removed' | 'added') {
  if (type === 'removed') {
    return '-'
  }

  if (type === 'added') {
    return '+'
  }

  return ' '
}

function selectRevision(revisionId: string) {
  selectedRevisionId.value = revisionId
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
            :class="{ selected: selectedRevisionId === item.id }"
            @click="selectRevision(item.id)"
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

        <section v-if="selectedRevision" class="revision-diff" data-testid="revision-diff">
          <header>
            <h4>差异预览</h4>
            <p>
              {{ selectedRevision.language }} -> {{ currentLanguage }}
            </p>
          </header>
          <pre class="revision-diff-code">
<code
  v-for="(row, index) in diffRows"
  :key="`${index}-${row.type}-${row.oldLine ?? 'n'}-${row.newLine ?? 'n'}`"
  class="revision-diff-line"
  :class="row.type"
  data-testid="revision-diff-line"
>{{ diffPrefix(row.type) }} {{ row.text }}</code>
          </pre>
        </section>
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

.revision-item.selected {
  border-color: var(--theme-accent-selected-border);
  background: var(--theme-surface-row-active-background);
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

.revision-diff {
  border-top: 1px solid var(--theme-surface-statusbar-border);
  padding: 12px 16px 16px;
  display: grid;
  gap: 8px;
  min-height: 0;
}

.revision-diff h4 {
  margin: 0;
  color: var(--theme-text-primary);
  font-size: 14px;
}

.revision-diff p {
  margin: 2px 0 0;
  color: var(--theme-text-tertiary);
  font-size: 12px;
}

.revision-diff-code {
  margin: 0;
  max-height: 180px;
  overflow: auto;
  border-radius: 10px;
  border: 1px solid var(--theme-surface-input-border);
  background: var(--theme-surface-input-background);
  padding: 8px 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
  font-size: 12px;
  line-height: 1.45;
}

.revision-diff-line {
  display: block;
  color: var(--theme-text-secondary);
}

.revision-diff-line.removed {
  color: var(--theme-text-danger-strong);
}

.revision-diff-line.added {
  color: var(--theme-accent-selected-text);
}
</style>
