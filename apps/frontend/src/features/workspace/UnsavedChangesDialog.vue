<script setup lang="ts">
defineProps<{
  open: boolean
  saving?: boolean
}>()

const emit = defineEmits<{
  save: []
  discard: []
  cancel: []
}>()
</script>

<template>
  <div v-if="open" class="dialog-mask" data-testid="unsaved-dialog">
    <section class="dialog-panel" role="dialog" aria-modal="true" aria-label="未保存修改提示">
      <h3>存在未保存的修改</h3>
      <p>当前文件有尚未保存的内容。你希望如何处理？</p>

      <div class="dialog-actions">
        <button
          type="button"
          class="primary"
          data-testid="unsaved-save"
          :disabled="saving"
          @click="emit('save')"
        >
          {{ saving ? '保存中...' : '保存并继续' }}
        </button>
        <button
          type="button"
          data-testid="unsaved-discard"
          :disabled="saving"
          @click="emit('discard')"
        >
          放弃修改
        </button>
        <button
          type="button"
          data-testid="unsaved-cancel"
          :disabled="saving"
          @click="emit('cancel')"
        >
          取消
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dialog-mask {
  position: fixed;
  inset: 0;
  background: var(--theme-surface-overlay-background);
  display: grid;
  place-items: center;
  backdrop-filter: var(--theme-surface-overlay-blur);
  z-index: 60;
}

.dialog-panel {
  width: min(440px, calc(100vw - 24px));
  background: var(--theme-surface-glass-card-background);
  border: 1px solid var(--theme-surface-glass-panel-border);
  border-radius: 18px;
  padding: 18px;
  display: grid;
  gap: 12px;
  box-shadow: var(--theme-surface-glass-panel-shadow);
}

.dialog-panel h3 {
  margin: 0;
  font-size: 18px;
  color: var(--theme-text-primary);
}

.dialog-panel p {
  margin: 0;
  color: var(--theme-text-tertiary);
  line-height: 1.6;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.dialog-actions button {
  border: 1px solid var(--theme-surface-neutral-button-border);
  background: var(--theme-surface-input-background);
  color: var(--theme-text-primary);
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
}

.dialog-actions button.primary {
  border-color: var(--theme-accent-primary-button-border);
  background: var(--theme-accent-primary-button-gradient);
  color: var(--theme-accent-primary-button-text);
}

.dialog-actions button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
