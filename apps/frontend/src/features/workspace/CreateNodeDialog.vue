<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  kind: 'file' | 'folder'
  value: string
  parentPath: string
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

const title = computed(() => {
  return props.kind === 'file' ? '新建文件' : '新建文件夹'
})

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
  if (props.submitting || props.confirmDisabled) {
    return
  }

  event.preventDefault()
  emit('confirm')
}
</script>

<template>
  <div v-if="open" class="dialog-mask" data-testid="create-node-dialog">
    <section class="dialog-panel" role="dialog" aria-modal="true" :aria-label="title">
      <h3>{{ title }}</h3>
      <p class="desc">父路径：{{ parentPath }}</p>

      <label class="field">
        <span>名称</span>
        <input
          ref="inputRef"
          data-testid="create-node-input"
          :value="value"
          :disabled="submitting"
          @input="emit('update:value', ($event.target as HTMLInputElement).value)"
          @keydown.enter="onEnter"
        >
      </label>

      <p v-if="errorMessage" class="error" data-testid="create-node-error">
        {{ errorMessage }}
      </p>

      <div class="dialog-actions">
        <button
          type="button"
          class="primary"
          data-testid="create-node-confirm"
          :disabled="submitting || confirmDisabled"
          @click="emit('confirm')"
        >
          {{ submitting ? '创建中...' : '确认创建' }}
        </button>
        <button
          type="button"
          data-testid="create-node-cancel"
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
  z-index: 80;
  display: grid;
  place-items: center;
  background: rgba(7, 11, 28, 0.45);
  backdrop-filter: blur(8px);
}

.dialog-panel {
  width: min(460px, calc(100vw - 24px));
  border-radius: 18px;
  padding: 18px;
  display: grid;
  gap: 12px;
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.7), rgba(226, 247, 255, 0.55));
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 22px 44px rgba(15, 23, 42, 0.2);
}

.dialog-panel h3 {
  margin: 0;
  font-size: 19px;
  color: #0f172a;
}

.desc {
  margin: 0;
  color: #334155;
  font-size: 13px;
}

.field {
  display: grid;
  gap: 6px;
}

.field span {
  color: #334155;
  font-size: 13px;
}

.field input {
  border: 1px solid rgba(148, 163, 184, 0.55);
  border-radius: 10px;
  padding: 9px 11px;
  background: rgba(255, 255, 255, 0.76);
  color: #0f172a;
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
  border: 1px solid rgba(148, 163, 184, 0.5);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.82);
  color: #0f172a;
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
