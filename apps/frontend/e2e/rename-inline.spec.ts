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

test('rename inline: name and path should both update', async ({ page, request }) => {
  await cleanupWorkspaces(request)

  await page.goto('/')
  await page.getByPlaceholder('新建工作区名称').fill('Rename Workspace')
  await page.getByRole('button', { name: '新建' }).click()

  await page.getByTestId('create-file-root').click()
  await page.getByTestId('create-inline-input').fill('main.ts')
  await page.getByTestId('create-inline-input').press('Enter')

  await expect(page.getByText('/main.ts')).toBeVisible()

  await page.getByTestId('rename-item').first().click()
  await page.getByTestId('rename-inline-input').fill('entry.ts')
  await page.getByTestId('rename-inline-input').press('Enter')

  await expect(page.locator('.name').first()).toHaveText('entry.ts')
  await expect(page.getByText('/entry.ts')).toBeVisible()
})
