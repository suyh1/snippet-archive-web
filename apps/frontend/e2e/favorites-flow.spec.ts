import { expect, test } from './fixtures'
import type { APIRequestContext } from '@playwright/test'

async function cleanupWorkspaces(request: APIRequestContext) {
  const listRes = await request.get('http://127.0.0.1:3001/api/workspaces')
  expect(listRes.ok()).toBeTruthy()

  const payload = await listRes.json()
  const items: Array<{ id: string }> = payload?.data?.items ?? []

  for (const item of items) {
    await request.delete(`http://127.0.0.1:3001/api/workspaces/${item.id}`)
  }
}

async function readFavoritesGeometry(page: Parameters<typeof test>[0]['page']) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="favorites-page"]') as HTMLElement | null
    const header = document.querySelector('.favorites-header') as HTMLElement | null
    const filters = document.querySelector('.favorites-filters') as HTMLElement | null
    const contentShell = document.querySelector('[data-testid="favorites-content"]') as HTMLElement | null
    const list = document.querySelector('[data-testid="favorites-list"]') as HTMLElement | null
    const empty = document.querySelector('[data-testid="favorites-empty"]') as HTMLElement | null
    const pagination = document.querySelector('footer.favorites-pagination') as HTMLElement | null
    if (!root || !header || !filters || !contentShell) {
      return null
    }

    const rootRect = root.getBoundingClientRect()
    const headerRect = header.getBoundingClientRect()
    const filtersRect = filters.getBoundingClientRect()
    const contentShellRect = contentShell.getBoundingClientRect()
    const paginationRect = pagination ? pagination.getBoundingClientRect() : null
    const paginationVisible =
      Boolean(pagination) &&
      pagination!.getClientRects().length > 0 &&
      window.getComputedStyle(pagination!).display !== 'none'

    return {
      gapHeaderToFilters: filtersRect.top - headerRect.bottom,
      gapFiltersToContent: contentShellRect.top - filtersRect.bottom,
      gapContentToPagination: paginationRect ? paginationRect.top - contentShellRect.bottom : null,
      pageBottomInset: paginationRect ? rootRect.bottom - paginationRect.bottom : null,
      hasList: Boolean(list),
      hasEmpty: Boolean(empty),
      paginationVisible,
    }
  })
}

test('favorites layout: empty state keeps compact vertical rhythm', async ({ page, request }) => {
  await cleanupWorkspaces(request)
  await page.goto('/favorites')

  await expect(page.getByTestId('favorites-page')).toBeVisible()
  await expect(page.getByTestId('favorites-empty')).toBeVisible()
  await expect(page.locator('footer.favorites-pagination')).toHaveCount(0)

  const geometry = await readFavoritesGeometry(page)
  expect(geometry).not.toBeNull()
  expect(geometry?.hasEmpty).toBe(true)
  expect(geometry?.hasList).toBe(false)
  expect(geometry?.gapHeaderToFilters).toBeLessThanOrEqual(28)
  expect(geometry?.gapFiltersToContent).toBeLessThanOrEqual(28)
})

test('favorites flow: star workspace/file and filter by tag', async ({ page, request }) => {
  await cleanupWorkspaces(request)

  const workspaceRes = await request.post('http://127.0.0.1:3001/api/workspaces', {
    data: {
      title: 'Favorites Workspace',
      tags: ['backend'],
      starred: false,
    },
  })
  expect(workspaceRes.ok()).toBeTruthy()
  const workspacePayload = await workspaceRes.json()
  const workspaceId: string = workspacePayload.data.id

  const fileRes = await request.post(
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
        starred: false,
      },
    },
  )
  expect(fileRes.ok()).toBeTruthy()

  await page.goto(`/workspace?workspaceId=${workspaceId}`)

  await page.getByTestId('workspace-star-toggle').click()

  await page.getByTestId('tree-row').filter({ hasText: '/src/token.ts' }).first().click()
  await page.getByTestId('file-star-toggle').click()

  await expect(page.getByTestId('file-tags-input')).toHaveValue('backend')
  await page.getByTestId('file-tags-input').fill('backend, temp')
  await page.getByTestId('file-tags-input').press('Escape')
  await expect(page.getByTestId('file-tags-input')).toHaveValue('backend')
  await page.getByTestId('file-tags-input').fill('backend, core')
  await page.getByTestId('workspace-tags-input').click()

  await page.getByTestId('workspace-tags-input').fill('backend, team')
  await page.getByTestId('tree-row').filter({ hasText: '/src/token.ts' }).first().click()

  await page.getByTestId('toolbar-toggle').click()
  await expect(page.getByTestId('floating-toolbar')).toBeVisible()
  await page.getByTestId('nav-favorites').click()
  await expect(page.getByTestId('favorites-page')).toBeVisible()
  await expect(page.getByTestId('favorites-item')).toHaveCount(2)

  const populatedGeometry = await readFavoritesGeometry(page)
  expect(populatedGeometry).not.toBeNull()
  expect(populatedGeometry?.hasList).toBe(true)
  expect(populatedGeometry?.paginationVisible).toBe(true)
  expect(populatedGeometry?.gapHeaderToFilters).toBeLessThanOrEqual(28)
  expect(populatedGeometry?.gapFiltersToContent).toBeLessThanOrEqual(28)
  expect(populatedGeometry?.gapContentToPagination).toBeLessThanOrEqual(28)
  expect(populatedGeometry?.pageBottomInset).toBeGreaterThanOrEqual(8)

  await page.getByTestId('favorites-type-select').selectOption('workspace')
  await page.getByTestId('favorites-tag-input').fill('team')
  await page.getByTestId('favorites-tag-input').press('Enter')
  await expect(page.getByTestId('favorites-item')).toHaveCount(1)
  await expect(page.getByTestId('favorites-item').first()).toContainText('Favorites Workspace')

  await page.getByTestId('favorites-type-select').selectOption('file')
  await page.getByTestId('favorites-tag-input').fill('core')
  await page.getByTestId('favorites-tag-input').press('Enter')
  await expect(page.getByTestId('favorites-item')).toHaveCount(1)

  await page.getByTestId('favorites-item').filter({ hasText: '/src/token.ts' }).getByTestId('favorites-open').click()

  await expect(page).toHaveURL(/\/workspace/)
  await expect(page.getByRole('heading', { name: 'Favorites Workspace' }).first()).toBeVisible()
})
