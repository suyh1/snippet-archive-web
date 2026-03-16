<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  loading?: boolean
  danger?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div v-if="open" class="dialog-mask" data-testid="confirm-dialog">
    <section class="dialog-panel" role="dialog" aria-modal="true" :aria-label="title">
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>

      <div class="dialog-actions">
        <button
          type="button"
          data-testid="confirm-dialog-cancel"
          :disabled="loading"
          @click="emit('cancel')"
        >
          {{ cancelText ?? '取消' }}
        </button>
        <button
          type="button"
          :class="['confirm-button', { danger }]"
          data-testid="confirm-dialog-confirm"
          :disabled="loading"
          @click="emit('confirm')"
        >
          {{ loading ? '处理中...' : (confirmText ?? '确认') }}
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
  z-index: 61;
}

.dialog-panel {
  width: min(460px, calc(100vw - 24px));
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

.dialog-actions .confirm-button {
  border-color: var(--theme-accent-primary-button-border);
  background: var(--theme-accent-primary-button-gradient);
  color: var(--theme-accent-primary-button-text);
}

.dialog-actions .confirm-button.danger {
  border-color: var(--theme-danger-strong-border);
  background: var(--theme-danger-strong-gradient);
}

.dialog-actions button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
