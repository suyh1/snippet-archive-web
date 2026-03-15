import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export type UnsavedDecision = 'save' | 'discard' | 'cancel'

export function useUnsavedGuard(isDirty: Ref<boolean>) {
  const dialogOpen = ref(false)
  let resolver: ((decision: UnsavedDecision) => void) | null = null

  function requestDecision() {
    dialogOpen.value = true

    return new Promise<UnsavedDecision>((resolve) => {
      resolver = resolve
    })
  }

  function resolveDecision(decision: UnsavedDecision) {
    dialogOpen.value = false

    if (resolver) {
      resolver(decision)
      resolver = null
    }
  }

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!isDirty.value) {
      return
    }

    event.preventDefault()
    event.returnValue = ''
  }

  onMounted(() => {
    window.addEventListener('beforeunload', onBeforeUnload)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', onBeforeUnload)
  })

  return {
    dialogOpen,
    requestDecision,
    resolveDecision,
  }
}
