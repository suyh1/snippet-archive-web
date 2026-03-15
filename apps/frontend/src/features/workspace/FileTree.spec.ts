// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import FileTree from './FileTree.vue'

describe('FileTree', () => {
  it('creates inline draft row and emits createFile on blur', async () => {
    const wrapper = mount(FileTree, {
      props: {
        files: [],
      },
    })

    await wrapper.find('[data-testid="create-file-root"]').trigger('click')

    const input = wrapper.find('[data-testid="create-inline-input"]')
    expect(input.exists()).toBe(true)

    await input.setValue('main.ts')
    await input.trigger('blur')

    expect(wrapper.emitted('createFile')).toEqual([
      [{ parentPath: '/', name: 'main.ts' }],
    ])
  })

  it('shows guided empty state when no files exist', () => {
    const wrapper = mount(FileTree, {
      props: {
        files: [],
      },
    })

    expect(wrapper.text()).toContain('当前工作区还没有文件，点击「新建文件」开始。')
  })

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

  it('emits select-file and delete-file actions', async () => {
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

    await wrapper.find('.row-main').trigger('click')
    await wrapper.find('[data-testid="delete-item"]').trigger('click')

    expect(wrapper.emitted('select-file')).toEqual([['file-1']])
    expect(wrapper.emitted('delete-file')).toEqual([['file-1']])
  })

  it('renames item through inline input and emits payload on blur', async () => {
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

    await wrapper.find('[data-testid="rename-item"]').trigger('click')
    const input = wrapper.find('[data-testid="rename-inline-input"]')
    expect(input.exists()).toBe(true)

    await input.setValue('entry.ts')
    await input.trigger('blur')

    expect(wrapper.emitted('rename-file')).toEqual([
      [{ fileId: 'file-1', newName: 'entry.ts' }],
    ])
  })

  it('keeps inline rename input text while typing multiple chars', async () => {
    const focusSpy = vi
      .spyOn(HTMLInputElement.prototype, 'focus')
      .mockImplementation(() => undefined)
    const selectSpy = vi
      .spyOn(HTMLInputElement.prototype, 'select')
      .mockImplementation(() => undefined)

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

    await wrapper.find('[data-testid="rename-item"]').trigger('click')
    const input = wrapper.find('[data-testid="rename-inline-input"]')

    await input.setValue('a')
    await input.setValue('ab')

    expect((input.element as HTMLInputElement).value).toBe('ab')
    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(selectSpy).toHaveBeenCalledTimes(1)
  })

  it('shows invalid drop feedback message for folder descendant target', async () => {
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

    expect(wrapper.text()).toContain('不能移动到自身子目录')
  })
})
