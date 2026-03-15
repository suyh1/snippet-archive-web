<script setup lang="ts">
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { html } from '@codemirror/lang-html'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    language?: string
    readonly?: boolean
  }>(),
  {
    language: 'plaintext',
    readonly: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'save-shortcut': []
}>()

const editorRef = ref<HTMLElement | null>(null)
const languageCompartment = new Compartment()
const editableCompartment = new Compartment()
let view: EditorView | null = null

function resolveLanguageExtension(language: string) {
  if (language === 'typescript') {
    return javascript({ typescript: true })
  }

  if (language === 'javascript') {
    return javascript()
  }

  if (language === 'json') {
    return json()
  }

  if (language === 'markdown') {
    return markdown()
  }

  if (language === 'vue') {
    return html()
  }

  return []
}

onMounted(() => {
  if (!editorRef.value) {
    return
  }

  view = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        lineNumbers(),
        EditorView.lineWrapping,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        languageCompartment.of(resolveLanguageExtension(props.language)),
        editableCompartment.of(EditorView.editable.of(!props.readonly)),
        keymap.of([
          {
            key: 'Mod-s',
            preventDefault: true,
            run: () => {
              emit('save-shortcut')
              return true
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            emit('update:modelValue', update.state.doc.toString())
          }
        }),
      ],
    }),
    parent: editorRef.value,
  })
})

watch(
  () => props.modelValue,
  (nextValue) => {
    if (!view) {
      return
    }

    const currentValue = view.state.doc.toString()
    if (currentValue === nextValue) {
      return
    }

    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: nextValue,
      },
    })
  },
)

watch(
  () => props.language,
  (language) => {
    if (!view) {
      return
    }

    view.dispatch({
      effects: languageCompartment.reconfigure(resolveLanguageExtension(language)),
    })
  },
)

watch(
  () => props.readonly,
  (readonly) => {
    if (!view) {
      return
    }

    view.dispatch({
      effects: editableCompartment.reconfigure(EditorView.editable.of(!readonly)),
    })
  },
)

onBeforeUnmount(() => {
  view?.destroy()
})
</script>

<template>
  <div ref="editorRef" class="code-editor" data-testid="code-editor" />
</template>

<style scoped>
.code-editor {
  height: 100%;
  min-height: 340px;
  overflow: hidden;
  border-radius: 0 0 16px 16px;
}

:deep(.cm-editor) {
  height: 100%;
  background: #0f172a;
  color: #e2e8f0;
}

:deep(.cm-gutters) {
  background: #0b1220;
  color: #94a3b8;
  border-right: 1px solid #1e293b;
}

:deep(.cm-content) {
  font-family: 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
}

:deep(.cm-focused) {
  outline: none;
}
</style>
