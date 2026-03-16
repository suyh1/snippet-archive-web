// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WorkspaceSidebar from './WorkspaceSidebar.vue'

describe('WorkspaceSidebar', () => {
  it('emits create when submit new workspace title', async () => {
    const wrapper = mount(WorkspaceSidebar, {
      props: {
        workspaces: [],
        activeWorkspaceId: null,
      },
    })

    await wrapper.find('input').setValue('New Workspace')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('create')).toEqual([['New Workspace']])
  })

  it('emits open, toggleStar and delete for workspace actions', async () => {
    const wrapper = mount(WorkspaceSidebar, {
      props: {
        workspaces: [
          {
            id: 'w1',
            title: 'Workspace 1',
            description: '',
            tags: [],
            starred: false,
          },
        ],
        activeWorkspaceId: 'w1',
      },
    })

    await wrapper.find('.open-button').trigger('click')
    await wrapper.find('.star-button').trigger('click')
    await wrapper.find('.delete-button').trigger('click')

    expect(wrapper.emitted('open')).toEqual([['w1']])
    expect(wrapper.emitted('toggleStar')).toEqual([['w1']])
    expect(wrapper.emitted('delete')).toEqual([['w1']])
  })

  it('emits library when library button clicked', async () => {
    const wrapper = mount(WorkspaceSidebar, {
      props: {
        workspaces: [],
        activeWorkspaceId: null,
      },
    })

    await wrapper.find('.library-button').trigger('click')

    expect(wrapper.emitted('library')).toEqual([[]])
  })
})
