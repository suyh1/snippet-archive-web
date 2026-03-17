import { test as base, expect } from '@playwright/test'

const AUTH_STORAGE_KEY = 'snippet-auth-token-v1'
const API_BASE_URL = 'http://127.0.0.1:3001'
const DEFAULT_PASSWORD = 'Passw0rd!pass'

type AuthenticatedFixtures = {
  authToken: string
}

export const test = base.extend<AuthenticatedFixtures>({
  authToken: async ({ playwright }, use) => {
    const anonRequest = await playwright.request.newContext()
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const email = `e2e-${stamp}@example.com`

    const registerRes = await anonRequest.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        name: `E2E ${stamp}`,
        password: DEFAULT_PASSWORD,
      },
    })
    if (!registerRes.ok()) {
      throw new Error(`Failed to register e2e account: ${registerRes.status()} ${await registerRes.text()}`)
    }

    const loginRes = await anonRequest.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email,
        password: DEFAULT_PASSWORD,
      },
    })
    if (!loginRes.ok()) {
      throw new Error(`Failed to login e2e account: ${loginRes.status()} ${await loginRes.text()}`)
    }

    const payload = await loginRes.json()
    const token = payload?.data?.accessToken as string | undefined
    if (!token || token.length === 0) {
      throw new Error('Failed to read access token from e2e login response')
    }

    await use(token)
    await anonRequest.dispose()
  },
  request: async ({ playwright, authToken }, use) => {
    const authedRequest = await playwright.request.newContext({
      extraHTTPHeaders: {
        Authorization: `Bearer ${authToken}`,
      },
    })
    await use(authedRequest)
    await authedRequest.dispose()
  },
  page: async ({ page, authToken }, use) => {
    await page.addInitScript(
      ([storageKey, token]) => {
        window.localStorage.setItem(storageKey, token)
      },
      [AUTH_STORAGE_KEY, authToken] as const,
    )

    await use(page)
  },
})

export { expect }
