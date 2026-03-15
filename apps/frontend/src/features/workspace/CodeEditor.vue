<script setup lang="ts">
import { Compartment, EditorState } from '@codemirror/state'
import {
  defaultKeymap,
  history,
  historyKeymap,
  redo as redoCommand,
  redoDepth,
  undo as undoCommand,
  undoDepth,
} from '@codemirror/commands'
import { openSearchPanel as openSearchPanelCommand, search, searchKeymap } from '@codemirror/search'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loadLanguageExtension } from '@/utils/language-detect'

export type CodeEditorTheme = 'glacier-night' | 'aqua-dusk' | 'pearl-light'
export type EditorStatusPayload = {
  lineCount: number
  cursorLine: number
  cursorColumn: number
  eol: 'LF' | 'CRLF'
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    language?: string
    readonly?: boolean
    theme?: CodeEditorTheme
  }>(),
  {
    language: 'plaintext',
    readonly: false,
    theme: 'glacier-night',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'save-shortcut': []
  'history-availability': [payload: { canUndo: boolean; canRedo: boolean }]
  'status-change': [payload: EditorStatusPayload]
}>()

const editorRef = ref<HTMLElement | null>(null)
const languageCompartment = new Compartment()
const editableCompartment = new Compartment()
const themeCompartment = new Compartment()
let view: EditorView | null = null
let languageLoadVersion = 0

function emitHistoryAvailability() {
  if (!view) {
    emit('history-availability', { canUndo: false, canRedo: false })
    return
  }

  emit('history-availability', {
    canUndo: undoDepth(view.state) > 0,
    canRedo: redoDepth(view.state) > 0,
  })
}

function resolveEol(text: string): 'LF' | 'CRLF' {
  return text.includes('\r\n') ? 'CRLF' : 'LF'
}

function emitEditorStatus() {
  if (!view) {
    emit('status-change', {
      lineCount: 1,
      cursorLine: 1,
      cursorColumn: 1,
      eol: 'LF',
    })
    return
  }

  const content = view.state.doc.toString()
  const cursorHead = view.state.selection.main.head
  const currentLine = view.state.doc.lineAt(cursorHead)

  emit('status-change', {
    lineCount: view.state.doc.lines,
    cursorLine: currentLine.number,
    cursorColumn: cursorHead - currentLine.from + 1,
    eol: resolveEol(content),
  })
}

function openSearchPanel() {
  if (!view) {
    return false
  }

  return openSearchPanelCommand(view)
}

function openReplacePanel() {
  if (!view) {
    return false
  }

  const opened = openSearchPanelCommand(view)
  if (!opened) {
    return false
  }

  globalThis.setTimeout(() => {
    const replaceInput = view?.dom.querySelector<HTMLInputElement>('.cm-search input[name="replace"]')
    replaceInput?.focus()
    replaceInput?.select()
  }, 0)

  return true
}

function undo() {
  if (!view) {
    return false
  }

  const applied = undoCommand(view)
  if (applied) {
    emitHistoryAvailability()
  }
  return applied
}

function redo() {
  if (!view) {
    return false
  }

  const applied = redoCommand(view)
  if (applied) {
    emitHistoryAvailability()
  }
  return applied
}

defineExpose({
  openSearchPanel,
  openReplacePanel,
  undo,
  redo,
})

async function applyLanguageExtension(language: string) {
  if (!view) {
    return
  }

  const currentVersion = ++languageLoadVersion
  const extension = await loadLanguageExtension(language)
  if (!view || currentVersion !== languageLoadVersion) {
    return
  }

  view.dispatch({
    effects: languageCompartment.reconfigure(extension),
  })
}

function resolveThemeExtension(theme: CodeEditorTheme) {
  if (theme === 'aqua-dusk') {
    return EditorView.theme(
      {
        '&': {
          backgroundColor: 'rgba(16, 24, 39, 0.8)',
          color: '#d5f5f6',
        },
        '.cm-content': {
          caretColor: '#34d399',
        },
        '.cm-cursor, .cm-dropCursor': {
          borderLeftColor: '#34d399',
        },
        '&.cm-focused .cm-selectionBackground, ::selection': {
          backgroundColor: 'rgba(52, 211, 153, 0.24)',
        },
        '.cm-activeLine': {
          backgroundColor: 'rgba(45, 212, 191, 0.11)',
        },
        '.cm-gutters': {
          backgroundColor: 'rgba(8, 47, 73, 0.56)',
          color: '#7dd3fc',
          borderRight: '1px solid rgba(125, 211, 252, 0.24)',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'rgba(45, 212, 191, 0.22)',
        },
      },
      { dark: true },
    )
  }

  if (theme === 'pearl-light') {
    return EditorView.theme(
      {
        '&': {
          backgroundColor: 'rgba(255, 255, 255, 0.74)',
          color: '#0f172a',
        },
        '.cm-content': {
          caretColor: '#0ea5e9',
        },
        '.cm-cursor, .cm-dropCursor': {
          borderLeftColor: '#0ea5e9',
        },
        '&.cm-focused .cm-selectionBackground, ::selection': {
          backgroundColor: 'rgba(14, 165, 233, 0.18)',
        },
        '.cm-activeLine': {
          backgroundColor: 'rgba(226, 232, 240, 0.72)',
        },
        '.cm-gutters': {
          backgroundColor: 'rgba(226, 232, 240, 0.72)',
          color: '#475569',
          borderRight: '1px solid rgba(148, 163, 184, 0.35)',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'rgba(186, 230, 253, 0.7)',
        },
      },
      { dark: false },
    )
  }

  return EditorView.theme(
    {
      '&': {
        backgroundColor: 'rgba(15, 23, 42, 0.84)',
        color: '#e2e8f0',
      },
      '.cm-content': {
        caretColor: '#67e8f9',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: '#67e8f9',
      },
      '&.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: 'rgba(56, 189, 248, 0.24)',
      },
      '.cm-activeLine': {
        backgroundColor: 'rgba(30, 41, 59, 0.52)',
      },
      '.cm-gutters': {
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        color: '#94a3b8',
        borderRight: '1px solid rgba(148, 163, 184, 0.2)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'rgba(30, 41, 59, 0.7)',
      },
    },
    { dark: true },
  )
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
        history(),
        search({ top: true }),
        EditorView.lineWrapping,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        languageCompartment.of([]),
        editableCompartment.of(EditorView.editable.of(!props.readonly)),
        themeCompartment.of(resolveThemeExtension(props.theme)),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
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
          emitHistoryAvailability()
          emitEditorStatus()
        }),
      ],
    }),
    parent: editorRef.value,
  })

  emitHistoryAvailability()
  emitEditorStatus()
  void applyLanguageExtension(props.language)
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
    void applyLanguageExtension(language)
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

watch(
  () => props.theme,
  (theme) => {
    if (!view) {
      return
    }

    view.dispatch({
      effects: themeCompartment.reconfigure(resolveThemeExtension(theme)),
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
}

:deep(.cm-gutters) {
  backdrop-filter: blur(8px);
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
