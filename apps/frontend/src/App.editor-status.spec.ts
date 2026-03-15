// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const editorCommandSpies = {
  openSearchPanel: vi.fn(() => true),
  openReplacePanel: vi.fn(() => true),
  undo: vi.fn(() => true),
  redo: vi.fn(() => true),
}

vi.mock('@/features/workspace/CodeEditor.vue', () => {
  return {
    default: defineComponent({
      name: 'CodeEditor',
      emits: [
        'update:modelValue',
        'save-shortcut',
        'history-availability',
        'status-change',
        'language-detected',
      ],
      setup(_props, { emit, expose }) {
        expose({
          openSearchPanel: editorCommandSpies.openSearchPanel,
          openReplacePanel: editorCommandSpies.openReplacePanel,
          undo: editorCommandSpies.undo,
          redo: editorCommandSpies.redo,
        })

        emit('history-availability', { canUndo: false, canRedo: false })
        emit('status-change', {
          lineCount: 1,
          cursorLine: 1,
          cursorColumn: 1,
          eol: 'LF',
        })

        return () => h('div', { 'data-testid': 'code-editor-mock' })
      },
    }),
  }
})

vi.mock('@/api/workspaces', () => {
  return {
    workspaceApi: {
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(),
      listFiles: vi.fn(),
      createFile: vi.fn(),
      moveFile: vi.fn(),
      updateFile: vi.fn(),
      deleteFile: vi.fn(),
    },
  }
})

import App from './App.vue'
import { workspaceApi } from '@/api/workspaces'
import { useWorkspaceStore } from '@/stores/workspace.store'

describe('App editor status bar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(workspaceApi.list).mockResolvedValue([])
  })

  it('shows language, lines, encoding and cursor status; language updates when paste detection fires', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(App, {
      global: {
        plugins: [pinia],
      },
    })

    const store = useWorkspaceStore()
    store.workspaces = [
      {
        id: 'w1',
        title: 'Workspace 1',
        description: '',
        tags: [],
        starred: false,
      },
    ]
    store.currentWorkspaceId = 'w1'
    store.files = [
      {
        id: 'f1',
        workspaceId: 'w1',
        name: 'notes.txt',
        path: '/notes.txt',
        language: 'plaintext',
        content: '',
        kind: 'file',
        order: 1,
      },
    ]
    store.activeFileId = 'f1'
    store.draftContent = ''

    await nextTick()

    expect(wrapper.get('[data-testid="editor-statusbar"]').text()).toContain('Plain Text')
    expect(wrapper.get('[data-testid="editor-status-encoding"]').text()).toContain('UTF-8')

    wrapper.findComponent({ name: 'CodeEditor' }).vm.$emit('status-change', {
      lineCount: 3,
      cursorLine: 2,
      cursorColumn: 5,
      eol: 'LF',
    })
    await nextTick()

    expect(wrapper.get('[data-testid="editor-status-lines"]').text()).toContain('3 行')
    expect(wrapper.get('[data-testid="editor-status-cursor"]').text()).toContain('Ln 2, Col 5')

    wrapper.findComponent({ name: 'CodeEditor' }).vm.$emit('language-detected', 'typescript')
    await nextTick()

    expect(wrapper.get('[data-testid="editor-status-language"]').text()).toContain('TypeScript')
  })
})
