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

test('paste auto-detects language and updates editor status bar', async ({ page, request, context }) => {
  await cleanupWorkspaces(request)

  const workspaceTitle = 'Editor Status Workspace'

  await page.goto('/')
  await page.getByPlaceholder('新建工作区名称').fill(workspaceTitle)
  await page.getByRole('button', { name: '新建' }).click()

  await page.getByTestId('create-file-root').click()
  await page.getByTestId('create-inline-input').fill('notes.txt')
  await page.getByTestId('create-inline-input').press('Enter')

  await page.getByTestId('tree-row').filter({ hasText: '/notes.txt' }).first().click()

  await expect(page.getByTestId('editor-status-language')).toContainText('Plain Text')

  const editorContent = page.locator('[data-testid="code-editor"] .cm-content').first()
  await editorContent.click()

  const snippet = 'interface User { id: number }\nconst user: User = { id: 1 }'

  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.evaluate(async (value) => {
    await navigator.clipboard.writeText(value)
  }, snippet)

  await page.keyboard.press('ControlOrMeta+V')

  await expect(editorContent).toContainText('interface User')
  await expect(page.getByTestId('editor-status-language')).toContainText('TypeScript')
  await expect(page.getByTestId('editor-status-lines')).toContainText('2 行')
  await expect(page.getByTestId('editor-status-encoding')).toContainText('UTF-8')
})
