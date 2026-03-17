// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/auth', () => {
  return {
    authApi: {
      register: vi.fn(),
      login: vi.fn(),
    },
  }
})

import LoginPage from '@/pages/LoginPage.vue'
import { authApi } from '@/api/auth'

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/login',
        component: LoginPage,
      },
      {
        path: '/workspace',
        component: {
          template: '<div data-testid="workspace-stub">workspace</div>',
        },
      },
      {
        path: '/search',
        component: {
          template: '<div data-testid="search-stub">search</div>',
        },
      },
    ],
  })
}

describe('LoginPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('supports login by pressing Enter on password input and redirects to query target', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      accessToken: 'token-1',
      user: {
        id: 'u1',
        email: 'owner@example.com',
        name: 'Owner',
      },
    })

    const router = createTestRouter()
    await router.push('/login?redirect=%2Fsearch')
    await router.isReady()

    const wrapper = mount(LoginPage, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.get('[data-testid="login-email"]').setValue('owner@example.com')
    await wrapper.get('[data-testid="login-password"]').setValue('Passw0rd!pass')
    await wrapper.get('[data-testid="login-password"]').trigger('keydown.enter')

    expect(authApi.login).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => {
      expect(router.currentRoute.value.path).toBe('/search')
    })
  })

  it('shows visible disabled reason in register mode when form is incomplete', async () => {
    const router = createTestRouter()
    await router.push('/login')
    await router.isReady()

    const wrapper = mount(LoginPage, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.get('[data-testid="login-mode-register"]').trigger('click')

    const registerButton = wrapper.get('[data-testid="register-submit"]')
    expect(registerButton.attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="register-disabled-reason"]').text()).toContain('请输入昵称')
  })

  it('shows validation feedback when login form is invalid', async () => {
    const router = createTestRouter()
    await router.push('/login')
    await router.isReady()

    const wrapper = mount(LoginPage, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.get('[data-testid="login-email"]').setValue('owner@example.com')
    await wrapper.get('[data-testid="login-password"]').setValue('123')
    await wrapper.get('[data-testid="login-submit"]').trigger('click')

    expect(wrapper.get('[data-testid="login-error"]').text()).toContain('密码至少 8 位')
    expect(authApi.login).not.toHaveBeenCalled()
  })
})
