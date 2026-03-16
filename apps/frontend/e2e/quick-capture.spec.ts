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

test('quick capture supports global shortcut and creates file in selected workspace', async ({ page, request }) => {
  await cleanupWorkspaces(request)

  await page.goto('/')

  await page.getByPlaceholder('新建工作区名称').fill('Quick Capture Workspace')
  await page.getByRole('button', { name: '新建' }).click()

  await page.keyboard.press('ControlOrMeta+Shift+K')
  await expect(page.getByTestId('quick-capture-dialog')).toBeVisible()

  await page.getByTestId('quick-capture-name').fill('quick-capture')
  await page.getByTestId('quick-capture-language').selectOption('typescript')
  await page.getByTestId('quick-capture-tags').fill('quick, capture')
  await page.getByTestId('quick-capture-content').fill('const fromQuickCapture = 1')
  await page.getByTestId('quick-capture-submit').click()

  await expect(page).toHaveURL(/\/workspace\?workspaceId=.*&fileId=.*/)
  await expect(page.getByTestId('tree-row').filter({ hasText: '/quick-capture.ts' }).first()).toBeVisible()
})
