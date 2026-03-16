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

  await page.getByTestId('nav-favorites').click()
  await expect(page.getByTestId('favorites-page')).toBeVisible()

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
