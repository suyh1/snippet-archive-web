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

test('revision panel can restore file to an older saved version', async ({ page, request }) => {
  await cleanupWorkspaces(request)

  await page.goto('/')

  await page.getByPlaceholder('新建工作区名称').fill('Revision Restore Workspace')
  await page.getByRole('button', { name: '新建' }).click()

  await page.getByTestId('create-file-root').click()
  await page.getByTestId('create-inline-input').fill('main.ts')
  await page.getByTestId('create-inline-input').press('Enter')

  await page.getByTestId('tree-row').filter({ hasText: '/main.ts' }).first().click()

  const content = page.locator('[data-testid="code-editor"] .cm-content').first()
  await content.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('const version = 1')
  await page.getByRole('button', { name: '保存' }).click()

  await content.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('const version = 2')
  await page.getByRole('button', { name: '保存' }).click()

  await content.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('const version = 3')
  await page.getByRole('button', { name: '保存' }).click()

  await page.getByTestId('editor-revisions').click()
  await expect(page.getByTestId('revision-dialog')).toBeVisible()

  const revisionRows = page.getByTestId('revision-item')
  await expect(revisionRows).toHaveCount(3)

  await page.getByTestId('revision-restore').nth(1).click()
  await expect(content).toContainText('const version = 2')
})
