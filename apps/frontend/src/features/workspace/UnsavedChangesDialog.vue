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
  background: rgba(7, 11, 28, 0.45);
  display: grid;
  place-items: center;
  backdrop-filter: blur(8px);
  z-index: 60;
}

.dialog-panel {
  width: min(440px, calc(100vw - 24px));
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

.dialog-actions button.primary {
  border-color: rgba(14, 165, 233, 0.75);
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.9), rgba(56, 189, 248, 0.84));
  color: #f8fafc;
}

.dialog-actions button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
