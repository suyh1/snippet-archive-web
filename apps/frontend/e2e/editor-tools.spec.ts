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

test('editor toolbar supports search/replace and undo/redo interactions', async ({ page, request }) => {
  await cleanupWorkspaces(request)

  await page.goto('/')

  await page.getByPlaceholder('新建工作区名称').fill('Editor Tools Workspace')
  await page.getByRole('button', { name: '新建' }).click()

  await page.getByTestId('create-file-root').click()
  await page.getByTestId('create-inline-input').fill('main.ts')
  await page.getByTestId('create-inline-input').press('Enter')

  await page.getByTestId('tree-row').filter({ hasText: '/main.ts' }).first().click()

  const content = page.locator('[data-testid="code-editor"] .cm-content').first()
  await content.click()
  await page.keyboard.press('End')
  await page.keyboard.type('\nconst alpha = 1')

  await expect(content).toContainText('alpha = 1')

  await page.getByTestId('editor-undo').click()
  await expect(content).not.toContainText('alpha = 1')

  await page.getByTestId('editor-redo').click()
  await expect(content).toContainText('alpha = 1')

  await page.getByTestId('editor-search').click()
  await expect(page.locator('.cm-search')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.cm-search')).toHaveCount(0)

  await page.getByTestId('editor-replace').click()
  await content.click()
  await page.keyboard.press('Home')

  const searchInput = page.locator('.cm-search input[name="search"]').first()
  const replaceInput = page.locator('.cm-search input[name="replace"]').first()
  await expect(searchInput).toBeVisible()
  await expect(replaceInput).toBeVisible()

  await searchInput.click()
  await searchInput.press('ControlOrMeta+a')
  await searchInput.press('Backspace')
  await page.keyboard.type('alpha')

  await replaceInput.click()
  await replaceInput.press('ControlOrMeta+a')
  await replaceInput.press('Backspace')
  await page.keyboard.type('beta')

  await searchInput.press('Enter')
  await replaceInput.press('Enter')

  await expect(content).toContainText('beta = 1')
})
