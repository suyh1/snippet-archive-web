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

test('smoke: create workspace, create file, drag move', async ({ page, request }) => {
  await cleanupWorkspaces(request)

  await page.goto('/')

  await expect(page.getByText('还没有工作区，先创建一个吧。')).toBeVisible()

  await page.getByPlaceholder('新建工作区名称').fill('Smoke Workspace')
  await page.getByRole('button', { name: '新建' }).click()

  await expect(page.getByRole('heading', { name: 'Smoke Workspace' }).first()).toBeVisible()

  await page.getByTestId('create-folder-root').click()
  await page.getByTestId('create-inline-input').fill('dst')
  await page.getByTestId('create-inline-input').press('Enter')

  await page.getByTestId('create-file-root').click()
  await page.getByTestId('create-inline-input').fill('main.ts')
  await page.getByTestId('create-inline-input').press('Enter')

  await expect(
    page.getByTestId('tree-row').filter({ hasText: '/main.ts' }).first(),
  ).toBeVisible()
  await expect(
    page.getByTestId('tree-row').filter({ hasText: '/dst' }).first(),
  ).toBeVisible()

  const fileRow = page.getByTestId('tree-row').filter({ hasText: '/main.ts' }).first()
  const folderRow = page.getByTestId('tree-row').filter({ hasText: '/dst' }).first()

  await fileRow.dragTo(folderRow)

  await expect(
    page.getByTestId('tree-row').filter({ hasText: '/dst/main.ts' }).first(),
  ).toBeVisible()
})
