import { expect, test, type APIRequestContext } from '@playwright/test'

async function cleanupWorkspaces(request: APIRequestContext) {
  const listRes = await request.get('http://127.0.0.1:3001/api/workspaces')
  expect(listRes.ok()).toBeTruthy()

  const payload = await listRes.json()
  const items: Array<{ id: string }> = payload?.data?.items ?? []

  for (const item of items) {
    await request.delete(`http://127.0.0.1:3001/api/workspaces/${item.id}`)
  }
}

async function seedSearchWorkspace(request: APIRequestContext) {
  const workspaceRes = await request.post('http://127.0.0.1:3001/api/workspaces', {
    data: {
      title: 'Search Workspace',
      tags: ['backend'],
    },
  })
  expect(workspaceRes.ok()).toBeTruthy()
  const workspacePayload = await workspaceRes.json()
  const workspaceId: string = workspacePayload.data.id

  const targetFileRes = await request.post(
    `http://127.0.0.1:3001/api/workspaces/${workspaceId}/files`,
    {
      data: {
        name: 'token.ts',
        path: '/src/token.ts',
        language: 'typescript',
        content: 'const token = process.env.API_TOKEN',
        kind: 'file',
        order: 1,
        tags: ['backend'],
      },
    },
  )
  expect(targetFileRes.ok()).toBeTruthy()
  const targetFilePayload = await targetFileRes.json()
  const targetFileId: string = targetFilePayload.data.id

  const secondaryFileRes = await request.post(
    `http://127.0.0.1:3001/api/workspaces/${workspaceId}/files`,
    {
      data: {
        name: 'notes.md',
        path: '/docs/notes.md',
        language: 'markdown',
        content: 'project notes without target token',
        kind: 'file',
        order: 2,
        tags: ['docs'],
      },
    },
  )
  expect(secondaryFileRes.ok()).toBeTruthy()

  return {
    workspaceId,
    targetFileId,
  }
}

async function readSearchGeometry(page: Parameters<typeof test>[0]['page']) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="search-page"]') as HTMLElement | null
    const header = document.querySelector('.search-header') as HTMLElement | null
    const filters = document.querySelector('[data-testid="search-filters"]') as HTMLElement | null
    const content = document.querySelector('[data-testid="search-content"]') as HTMLElement | null
    const meta = document.querySelector('.search-header .meta') as HTMLElement | null
    const settings = document.querySelector('[data-testid="open-settings"]') as HTMLElement | null
    const toolbar = document.querySelector('[data-testid="toolbar-toggle"]') as HTMLElement | null
    const topActions = document.querySelector('.route-shell-top-actions') as HTMLElement | null
    const firstResult = document.querySelector('[data-testid="search-result-item"]') as HTMLElement | null
    const pagination = document.querySelector('[data-testid="search-pagination"]') as HTMLElement | null
    if (!root || !header || !filters || !content || !meta || !settings || !toolbar || !topActions) {
      return null
    }

    const intersects = (a: DOMRect, b: DOMRect) =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

    const rootRect = root.getBoundingClientRect()
    const headerRect = header.getBoundingClientRect()
    const filtersRect = filters.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()
    const metaRect = meta.getBoundingClientRect()
    const settingsRect = settings.getBoundingClientRect()
    const toolbarRect = toolbar.getBoundingClientRect()
    const topActionsRect = topActions.getBoundingClientRect()

    return {
      gapHeaderToFilters: filtersRect.top - headerRect.bottom,
      gapFiltersToContent: contentRect.top - filtersRect.bottom,
      docHeight: document.documentElement.scrollHeight,
      bodyHeight: document.body.scrollHeight,
      viewportHeight: window.innerHeight,
      settingsIntersectsMeta: intersects(metaRect, settingsRect),
      toolbarIntersectsMeta: intersects(metaRect, toolbarRect),
      iconCenterYDelta: Math.abs(
        settingsRect.top + settingsRect.height / 2 - (toolbarRect.top + toolbarRect.height / 2),
      ),
      topInset: topActionsRect.top,
      rightInset: window.innerWidth - topActionsRect.right,
      settingsCount: document.querySelectorAll('[data-testid="open-settings"]').length,
      toolbarCount: document.querySelectorAll('[data-testid="toolbar-toggle"]').length,
      resultItemHeight: firstResult?.getBoundingClientRect().height ?? null,
      paginationVisible:
        Boolean(pagination) &&
        pagination!.getClientRects().length > 0 &&
        window.getComputedStyle(pagination!).display !== 'none',
      pageBottomInset: rootRect.bottom - contentRect.bottom,
    }
  })
}

test('search layout: empty state keeps compact rhythm and top-right actions do not overlap', async ({ page, request }) => {
  await cleanupWorkspaces(request)

  const viewports = [
    { width: 1280, height: 720 },
    { width: 900, height: 760 },
  ]

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/search')

    await expect(page.getByTestId('search-page')).toBeVisible()
    await expect(page.getByTestId('search-empty')).toBeVisible()
    await expect(page.getByTestId('search-pagination')).toHaveCount(0)
    await expect(page.getByTestId('open-settings')).toHaveCount(1)
    await expect(page.getByTestId('toolbar-toggle')).toHaveCount(1)

    const metrics = await readSearchGeometry(page)
    expect(metrics).not.toBeNull()
    expect(metrics?.gapHeaderToFilters).toBeLessThanOrEqual(28)
    expect(metrics?.gapFiltersToContent).toBeLessThanOrEqual(28)
    expect(metrics?.docHeight).toBeLessThanOrEqual((metrics?.viewportHeight ?? 0) + 4)
    expect(metrics?.bodyHeight).toBeLessThanOrEqual((metrics?.viewportHeight ?? 0) + 4)
    expect(metrics?.settingsIntersectsMeta).toBe(false)
    expect(metrics?.toolbarIntersectsMeta).toBe(false)
    expect(metrics?.iconCenterYDelta).toBeLessThanOrEqual(2)
    expect(metrics?.topInset).toBeGreaterThanOrEqual(8)
    expect(metrics?.rightInset).toBeGreaterThanOrEqual(8)
    expect(metrics?.settingsCount).toBe(1)
    expect(metrics?.toolbarCount).toBe(1)
  }
})

test('search center: keyword enter search stays compact and can open result', async ({ page, request }) => {
  await cleanupWorkspaces(request)
  const { workspaceId, targetFileId } = await seedSearchWorkspace(request)

  await page.goto('/search')
  await page.getByTestId('search-keyword-input').fill('API_TOKEN')
  await page.getByTestId('search-keyword-input').press('Enter')

  await expect(page.getByTestId('search-result-item')).toHaveCount(1)
  const geometry = await readSearchGeometry(page)
  expect(geometry).not.toBeNull()
  expect(geometry?.resultItemHeight).toBeLessThan(140)
  expect(geometry?.paginationVisible).toBe(true)

  await page.getByTestId('search-result-open').first().click()
  await expect(page).toHaveURL(new RegExp(`/workspace\\?workspaceId=${workspaceId}&fileId=${targetFileId}`))
  await expect(page.getByRole('heading', { name: 'Search Workspace' }).first()).toBeVisible()
})

test('search center: clear resets filters and refreshes result list', async ({ page, request }) => {
  await cleanupWorkspaces(request)
  await seedSearchWorkspace(request)

  await page.goto('/search')
  await page.getByTestId('search-keyword-input').fill('API_TOKEN')
  await page.getByTestId('search-submit').click()
  await expect(page.getByTestId('search-result-item')).toHaveCount(1)

  await page.getByTestId('search-clear').click()
  await expect(page.getByTestId('search-keyword-input')).toHaveValue('')
  await expect(page.getByTestId('search-result-item')).toHaveCount(2)
})
