<script setup lang="ts">
import { computed } from 'vue'
import type { EditorSnapshot } from '@/types/workspace'

const props = withDefaults(
  defineProps<{
    open: boolean
    fileName?: string
    snapshots?: EditorSnapshot[]
    restoring?: boolean
  }>(),
  {
    fileName: '',
    snapshots: () => [],
    restoring: false,
  },
)

const emit = defineEmits<{
  close: []
  create: []
  restore: [snapshotId: string]
}>()

const sortedSnapshots = computed(() => {
  return [...props.snapshots].sort((a, b) => b.createdAt - a.createdAt)
})

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    hour12: false,
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="snapshot-overlay"
      data-testid="snapshot-dialog"
      @click.self="emit('close')"
    >
      <section class="snapshot-card" role="dialog" aria-modal="true" aria-label="快照历史">
        <header class="snapshot-head">
          <div>
            <h3>快照历史</h3>
            <p>文件：{{ fileName || '当前文件' }}</p>
          </div>

          <div class="snapshot-actions">
            <button
              type="button"
              class="primary"
              data-testid="snapshot-create"
              @click="emit('create')"
            >
              新建快照
            </button>
            <button type="button" class="ghost" @click="emit('close')">
              关闭
            </button>
          </div>
        </header>

        <ul v-if="sortedSnapshots.length > 0" class="snapshot-list">
          <li
            v-for="item in sortedSnapshots"
            :key="item.id"
            class="snapshot-item"
          >
            <div class="meta">
              <strong>{{ formatTime(item.createdAt) }}</strong>
              <span>{{ item.language }} · {{ item.source === 'format' ? '格式化前' : '手动' }}</span>
            </div>
            <button
              type="button"
              data-testid="snapshot-restore"
              :disabled="restoring"
              @click="emit('restore', item.id)"
            >
              {{ restoring ? '恢复中...' : '恢复到此快照' }}
            </button>
          </li>
        </ul>

        <p
          v-else
          class="snapshot-empty"
          data-testid="snapshot-empty"
        >
          还没有快照，点击「新建快照」开始记录。
        </p>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.snapshot-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(4px);
}

.snapshot-card {
  width: min(720px, calc(100vw - 32px));
  max-height: min(76vh, 640px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.65);
  background: linear-gradient(140deg, rgba(255, 255, 255, 0.9), rgba(226, 232, 240, 0.84));
  box-shadow: 0 26px 54px rgba(15, 23, 42, 0.25);
  overflow: hidden;
}

.snapshot-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.32);
}

.snapshot-head h3 {
  margin: 0;
  font-size: 18px;
  color: #0f172a;
}

.snapshot-head p {
  margin: 4px 0 0;
  color: #475569;
  font-size: 12px;
}

.snapshot-actions {
  display: inline-flex;
  gap: 8px;
}

.snapshot-actions button {
  border-radius: 8px;
  padding: 6px 10px;
  font-weight: 600;
  cursor: pointer;
}

.snapshot-actions .primary {
  border: 1px solid rgba(14, 165, 233, 0.52);
  background: linear-gradient(130deg, rgba(14, 165, 233, 0.88), rgba(56, 189, 248, 0.78));
  color: #f8fafc;
}

.snapshot-actions .ghost {
  border: 1px solid rgba(148, 163, 184, 0.55);
  background: rgba(248, 250, 252, 0.72);
  color: #0f172a;
}

.snapshot-list {
  list-style: none;
  margin: 0;
  padding: 12px 16px 16px;
  display: grid;
  gap: 10px;
  overflow: auto;
}

.snapshot-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(248, 250, 252, 0.7);
}

.snapshot-item .meta {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.snapshot-item strong {
  font-size: 13px;
  color: #0f172a;
}

.snapshot-item span {
  font-size: 12px;
  color: #475569;
}

.snapshot-item button {
  border: 1px solid rgba(56, 189, 248, 0.58);
  background: rgba(14, 165, 233, 0.16);
  color: #0f172a;
  border-radius: 8px;
  padding: 6px 10px;
  font-weight: 600;
  cursor: pointer;
}

.snapshot-item button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.snapshot-empty {
  margin: 0;
  padding: 20px 16px;
  color: #475569;
  font-size: 13px;
}
</style>

