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

test('search center: keyword search and open result', async ({ page, request }) => {
  await cleanupWorkspaces(request)

  const workspaceRes = await request.post('http://127.0.0.1:3001/api/workspaces', {
    data: {
      title: 'Search Workspace',
      tags: ['backend'],
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
      },
    },
  )
  expect(fileRes.ok()).toBeTruthy()

  await page.goto('/search')

  await page.getByTestId('search-keyword-input').fill('token')
  await page.getByTestId('search-submit').click()

  await expect(page.getByTestId('search-result-item')).toHaveCount(1)
  await page.getByTestId('search-result-open').first().click()

  await expect(page).toHaveURL(/\/workspace/)
  await expect(page.getByRole('heading', { name: 'Search Workspace' }).first()).toBeVisible()
})
