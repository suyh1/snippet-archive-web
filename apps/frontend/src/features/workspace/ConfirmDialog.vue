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
  background: rgba(7, 11, 28, 0.45);
  display: grid;
  place-items: center;
  backdrop-filter: blur(8px);
  z-index: 61;
}

.dialog-panel {
  width: min(460px, calc(100vw - 24px));
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.7), rgba(226, 247, 255, 0.55));
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 18px;
  padding: 18px;
  display: grid;
  gap: 12px;
  box-shadow: 0 22px 44px rgba(15, 23, 42, 0.2);
}

.dialog-panel h3 {
  margin: 0;
  font-size: 18px;
  color: #0f172a;
}

.dialog-panel p {
  margin: 0;
  color: #475569;
  line-height: 1.6;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.dialog-actions button {
  border: 1px solid rgba(148, 163, 184, 0.5);
  background: rgba(255, 255, 255, 0.82);
  color: #0f172a;
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
}

.dialog-actions .confirm-button {
  border-color: rgba(14, 165, 233, 0.75);
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.9), rgba(56, 189, 248, 0.84));
  color: #f8fafc;
}

.dialog-actions .confirm-button.danger {
  border-color: rgba(248, 113, 113, 0.75);
  background: linear-gradient(135deg, rgba(220, 38, 38, 0.92), rgba(248, 113, 113, 0.86));
}

.dialog-actions button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
