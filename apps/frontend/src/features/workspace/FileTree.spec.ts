// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FileTree from './FileTree.vue'

describe('FileTree', () => {
  it('emits moveFile when dropping file to root dropzone', async () => {
    const wrapper = mount(FileTree, {
      props: {
        files: [
          {
            id: 'file-1',
            workspaceId: 'w1',
            name: 'a.ts',
            path: '/a.ts',
            language: 'typescript',
            content: '',
            kind: 'file',
            order: 1,
          },
        ],
      },
    })

    const row = wrapper.find('.row')
    await row.trigger('dragstart')
    await wrapper.find('.root-dropzone').trigger('drop')

    expect(wrapper.emitted('moveFile')).toEqual([
      [{ fileId: 'file-1', targetParentPath: '/' }],
    ])
  })

  it('does not emit moveFile when folder dropped into its own descendant', async () => {
    const wrapper = mount(FileTree, {
      props: {
        files: [
          {
            id: 'folder-root',
            workspaceId: 'w1',
            name: 'src',
            path: '/src',
            language: 'plaintext',
            content: '',
            kind: 'folder',
            order: 1,
          },
          {
            id: 'folder-child',
            workspaceId: 'w1',
            name: 'child',
            path: '/src/child',
            language: 'plaintext',
            content: '',
            kind: 'folder',
            order: 1,
          },
        ],
      },
    })

    const rows = wrapper.findAll('.row')
    await rows[0].trigger('dragstart')
    await rows[1].trigger('drop')

    expect(wrapper.emitted('moveFile')).toBeUndefined()
  })
})
