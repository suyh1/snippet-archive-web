import { expect, test } from '@playwright/test'

type MainNavGeometryMetrics = {
  intersects: boolean
  verticalGap: number
}

async function readMainNavGeometryMetrics(
  page: Parameters<typeof test>[0]['page'],
  targetSelector: string,
) {
  return page.evaluate((selector) => {
    const nav = document.querySelector('[data-testid="app-main-nav"]') as HTMLElement | null
    const target = document.querySelector(selector) as HTMLElement | null
    if (!nav || !target) {
      return null
    }

    const navRect = nav.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const intersects =
      navRect.left < targetRect.right &&
      navRect.right > targetRect.left &&
      navRect.top < targetRect.bottom &&
      navRect.bottom > targetRect.top

    return {
      intersects,
      verticalGap: targetRect.top - navRect.bottom,
    }
  }, targetSelector)
}

function expectMainNavClear(metrics: MainNavGeometryMetrics | null) {
  expect(metrics).not.toBeNull()
  expect(metrics?.intersects).toBe(false)
  expect(metrics?.verticalGap).toBeGreaterThanOrEqual(8)
}

test('entry goes to login and workspace route requires authentication', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  await expect(page.getByTestId('login-page')).toBeVisible()

  await page.goto('/workspace')
  await expect(page).toHaveURL(/\/login\?redirect=\/workspace$/)
})

test('authenticated user can navigate pages from normal top navigation without opening toolbar', async ({
  page,
  request,
}) => {
  const stamp = Date.now()
  const email = `nav-user-${stamp}@example.com`
  const password = 'Passw0rd!pass'

  const registerRes = await request.post('http://127.0.0.1:3001/api/auth/register', {
    data: {
      email,
      name: 'Nav User',
      password,
    },
  })
  expect(registerRes.ok()).toBeTruthy()

  await page.goto('/login')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()

  await expect(page).toHaveURL(/\/workspace(?:\?.*)?$/)
  await expect(page.getByTestId('floating-toolbar')).toHaveCount(0)
  await expect(page.getByTestId('app-main-nav')).toBeVisible()

  await page.getByTestId('main-nav-search').click()
  await expect(page).toHaveURL(/\/search(?:\?.*)?$/)

  await page.getByTestId('main-nav-favorites').click()
  await expect(page).toHaveURL(/\/favorites(?:\?.*)?$/)

  await page.getByTestId('main-nav-team').click()
  await expect(page).toHaveURL(/\/team(?:\?.*)?$/)
})

test('main navigation stays clear of workspace sidebar and team header', async ({
  page,
  request,
}) => {
  const stamp = Date.now()
  const email = `layout-nav-${stamp}@example.com`
  const password = 'Passw0rd!pass'

  const registerRes = await request.post('http://127.0.0.1:3001/api/auth/register', {
    data: {
      email,
      name: 'Layout User',
      password,
    },
  })
  expect(registerRes.ok()).toBeTruthy()

  const loginRes = await request.post('http://127.0.0.1:3001/api/auth/login', {
    data: {
      email,
      password,
    },
  })
  expect(loginRes.ok()).toBeTruthy()
  const loginPayload = await loginRes.json()
  const token = loginPayload?.data?.accessToken as string
  expect(token.length).toBeGreaterThan(0)

  const viewports = [
    { width: 2048, height: 526 },
    { width: 900, height: 760 },
  ]

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/login')
    await page.evaluate(([value]) => {
      window.localStorage.setItem('snippet-auth-token-v1', value)
    }, [token] as const)
    await page.goto('/workspace')
    await expect(page.getByTestId('app-main-nav')).toBeVisible()
    const workspaceMetrics = await readMainNavGeometryMetrics(page, '.workspace-sidebar .sidebar-head')
    expectMainNavClear(workspaceMetrics)

    await page.getByTestId('main-nav-team').click()
    await expect(page).toHaveURL(/\/team(?:\?.*)?$/)
    await expect(page.getByTestId('team-page')).toBeVisible()
    const teamMetrics = await readMainNavGeometryMetrics(page, '[data-testid="team-page"] .team-page-head')
    expectMainNavClear(teamMetrics)
  }
})

test('authenticated user can logout from global top actions and is redirected to login', async ({
  page,
  request,
}) => {
  const stamp = Date.now()
  const email = `logout-${stamp}@example.com`
  const password = 'Passw0rd!pass'

  const registerRes = await request.post('http://127.0.0.1:3001/api/auth/register', {
    data: {
      email,
      name: 'Logout User',
      password,
    },
  })
  expect(registerRes.ok()).toBeTruthy()

  await page.goto('/login')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await expect(page).toHaveURL(/\/workspace(?:\?.*)?$/)

  await expect(page.getByTestId('global-logout')).toBeVisible()
  await page.getByTestId('main-nav-search').click()
  await expect(page).toHaveURL(/\/search(?:\?.*)?$/)
  await page.getByTestId('global-logout').click()

  await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  await expect(page.getByTestId('login-page')).toBeVisible()

  const storedToken = await page.evaluate(() => {
    return window.localStorage.getItem('snippet-auth-token-v1')
  })
  expect(storedToken).toBeNull()

  await page.goto('/workspace')
  await expect(page).toHaveURL(/\/login\?redirect=\/workspace$/)
})
