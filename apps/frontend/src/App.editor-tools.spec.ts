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
      emits: ['update:modelValue', 'save-shortcut', 'history-availability'],
      setup(_props, { emit, expose }) {
        expose({
          openSearchPanel: editorCommandSpies.openSearchPanel,
          openReplacePanel: editorCommandSpies.openReplacePanel,
          undo: editorCommandSpies.undo,
          redo: editorCommandSpies.redo,
        })

        emit('history-availability', { canUndo: false, canRedo: false })
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

describe('App editor tools', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(workspaceApi.list).mockResolvedValue([])
    editorCommandSpies.openSearchPanel.mockClear()
    editorCommandSpies.openReplacePanel.mockClear()
    editorCommandSpies.undo.mockClear()
    editorCommandSpies.redo.mockClear()
  })

  it('invokes search/replace and undo/redo toolbar commands with history availability', async () => {
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
        name: 'main.ts',
        path: '/main.ts',
        language: 'typescript',
        content: 'const a = 1',
        kind: 'file',
        order: 1,
      },
    ]
    store.activeFileId = 'f1'
    store.draftContent = 'const a = 1'

    await nextTick()

    expect(wrapper.get('[data-testid="editor-undo"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="editor-redo"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="editor-search"]').trigger('click')
    await wrapper.get('[data-testid="editor-replace"]').trigger('click')
    expect(editorCommandSpies.openSearchPanel).toHaveBeenCalledTimes(1)
    expect(editorCommandSpies.openReplacePanel).toHaveBeenCalledTimes(1)

    wrapper.findComponent({ name: 'CodeEditor' }).vm.$emit('history-availability', {
      canUndo: true,
      canRedo: true,
    })
    await nextTick()

    expect(wrapper.get('[data-testid="editor-undo"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="editor-redo"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('[data-testid="editor-undo"]').trigger('click')
    await wrapper.get('[data-testid="editor-redo"]').trigger('click')

    expect(editorCommandSpies.undo).toHaveBeenCalledTimes(1)
    expect(editorCommandSpies.redo).toHaveBeenCalledTimes(1)
  })
})
