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

test('extensionless file keeps language on paste and supports manual language selection', async ({ page, request, context }) => {
  await cleanupWorkspaces(request)

  const workspaceTitle = 'Editor Status Workspace'

  await page.goto('/')
  await page.getByPlaceholder('新建工作区名称').fill(workspaceTitle)
  await page.getByRole('button', { name: '新建' }).click()

  await page.getByTestId('create-file-root').click()
  await page.getByTestId('create-inline-input').fill('scratch')
  await page.getByTestId('create-inline-input').press('Enter')

  await page.getByTestId('tree-row').filter({ hasText: '/scratch' }).first().click()

  await expect(page.getByTestId('editor-status-language')).toContainText('Plain Text')
  await expect(page.getByTestId('editor-language-select')).toBeEnabled()
  const languageOptionCount = await page.locator('[data-testid="editor-language-select"] option').count()
  expect(languageOptionCount).toBeGreaterThanOrEqual(100)

  const editorContent = page.locator('[data-testid="code-editor"] .cm-content').first()
  await editorContent.click()

  const snippet = 'const map: Map<string, number> = new Map<string, number>()'

  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.evaluate(async (value) => {
    await navigator.clipboard.writeText(value)
  }, snippet)

  await page.keyboard.press('ControlOrMeta+V')

  await expect(editorContent).toContainText('Map<string, number>')
  await expect(page.getByTestId('editor-status-language')).toContainText('Plain Text')

  await page.getByTestId('editor-language-select').selectOption('python')
  await expect(page.getByTestId('editor-status-language')).toContainText('Python')
  await expect(page.getByTestId('tree-row').filter({ hasText: '/scratch.py' }).first()).toBeVisible()

  await editorContent.click()
  await page.keyboard.type('\nconst nextValue = 1')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('editor-status-language')).toContainText('Python')
  await expect(page.getByTestId('editor-status-lines')).toContainText('3 行')
  await expect(page.getByTestId('editor-status-encoding')).toContainText('UTF-8')
})

test('known suffix defaults language but allows manual override', async ({ page, request, context }) => {
  await cleanupWorkspaces(request)

  await page.goto('/')
  await page.getByPlaceholder('新建工作区名称').fill('Editor Status Suffix Workspace')
  await page.getByRole('button', { name: '新建' }).click()

  await page.getByTestId('create-file-root').click()
  await page.getByTestId('create-inline-input').fill('main.ts')
  await page.getByTestId('create-inline-input').press('Enter')

  await page.getByTestId('tree-row').filter({ hasText: '/main.ts' }).first().click()

  await expect(page.getByTestId('editor-status-language')).toContainText('TypeScript')
  await expect(page.getByTestId('editor-language-select')).toBeEnabled()
  await page.getByTestId('editor-language-select').selectOption('html')
  await expect(page.getByTestId('editor-status-language')).toContainText('HTML')
  await expect(page.getByTestId('tree-row').filter({ hasText: '/main.html' }).first()).toBeVisible()

  const editorContent = page.locator('[data-testid="code-editor"] .cm-content').first()
  await editorContent.click()

  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.evaluate(async () => {
    await navigator.clipboard.writeText('const list: string[] = []')
  })

  await page.keyboard.press('ControlOrMeta+V')

  await expect(page.getByTestId('editor-status-language')).toContainText('HTML')
})
