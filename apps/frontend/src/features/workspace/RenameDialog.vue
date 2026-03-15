<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  value: string
  errorMessage: string | null
  submitting?: boolean
  confirmDisabled?: boolean
}>()

const emit = defineEmits<{
  'update:value': [value: string]
  confirm: []
  cancel: []
}>()

const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      return
    }

    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  },
)

function onEnter(event: KeyboardEvent) {
  if (props.confirmDisabled || props.submitting) {
    return
  }

  event.preventDefault()
  emit('confirm')
}
</script>

<template>
  <div v-if="open" class="dialog-mask" data-testid="rename-dialog">
    <section class="dialog-panel" role="dialog" aria-modal="true" aria-label="重命名">
      <h3>重命名</h3>

      <label class="field">
        <span>名称</span>
        <input
          ref="inputRef"
          data-testid="rename-input"
          :value="value"
          :disabled="submitting"
          @input="emit('update:value', ($event.target as HTMLInputElement).value)"
          @keydown.enter="onEnter"
        >
      </label>

      <p v-if="errorMessage" class="error" data-testid="rename-error">
        {{ errorMessage }}
      </p>

      <div class="dialog-actions">
        <button
          type="button"
          data-testid="rename-confirm"
          class="primary"
          :disabled="submitting || confirmDisabled"
          @click="emit('confirm')"
        >
          {{ submitting ? '提交中...' : '确认' }}
        </button>
        <button
          type="button"
          data-testid="rename-cancel"
          :disabled="submitting"
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
  z-index: 70;
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

.field {
  display: grid;
  gap: 6px;
}

.field span {
  color: #475569;
  font-size: 13px;
}

.field input {
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  padding: 8px 10px;
  font-size: 14px;
}

.error {
  margin: 0;
  color: #b91c1c;
  font-size: 12px;
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
