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
  background: rgba(15, 23, 42, 0.35);
  display: grid;
  place-items: center;
  z-index: 60;
}

.dialog-panel {
  width: min(440px, calc(100vw - 24px));
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px;
  display: grid;
  gap: 12px;
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.18);
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
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  border-radius: 9px;
  padding: 7px 12px;
  cursor: pointer;
}

.dialog-actions button.primary {
  border-color: #0ea5e9;
  background: #0ea5e9;
  color: #f8fafc;
}

.dialog-actions button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
