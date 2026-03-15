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

async function getWorkspaceIdByTitle(request: APIRequestContext, title: string) {
  const listRes = await request.get('http://127.0.0.1:3001/api/workspaces')
  expect(listRes.ok()).toBeTruthy()

  const payload = await listRes.json()
  const items: Array<{ id: string; title: string }> = payload?.data?.items ?? []
  const target = items.find((item) => item.title === title)

  expect(target?.id).toBeTruthy()
  return target!.id
}

async function listFiles(request: APIRequestContext, workspaceId: string) {
  const listRes = await request.get(`http://127.0.0.1:3001/api/workspaces/${workspaceId}/files`)
  expect(listRes.ok()).toBeTruthy()

  const payload = await listRes.json()
  return (payload?.data?.items ?? []) as Array<{ id: string; content: string; path: string }>
}

test('editor auto-save and local draft recovery work in real typing flow', async ({ page, request }) => {
  await cleanupWorkspaces(request)

  const workspaceTitle = 'Editor Autosave Workspace'

  await page.goto('/')
  await page.getByPlaceholder('新建工作区名称').fill(workspaceTitle)
  await page.getByRole('button', { name: '新建' }).click()
  await expect(page.getByRole('heading', { name: workspaceTitle }).first()).toBeVisible()

  const workspaceId = await getWorkspaceIdByTitle(request, workspaceTitle)

  const createFileRes = await request.post(
    `http://127.0.0.1:3001/api/workspaces/${workspaceId}/files`,
    {
      data: {
        name: 'main.ts',
        path: '/main.ts',
        language: 'typescript',
        content: 'const seed = 1',
        kind: 'file',
        order: 1,
      },
    },
  )
  expect(createFileRes.ok()).toBeTruthy()

  await page.reload()
  await page.getByRole('button', { name: workspaceTitle }).first().click()

  const mainRow = page.getByTestId('tree-row').filter({ hasText: '/main.ts' }).first()
  await mainRow.click()

  const editorContent = page.locator('[data-testid="code-editor"] .cm-content').first()
  await expect(editorContent).toContainText('const seed = 1')

  await editorContent.click()
  await page.keyboard.press('End')
  await page.keyboard.type('\n// autosave-pass')

  await expect.poll(async () => {
    const files = await listFiles(request, workspaceId)
    const file = files.find((item) => item.path === '/main.ts')
    return file?.content.includes('// autosave-pass') ?? false
  }, { timeout: 10000 }).toBe(true)

  await editorContent.click()
  await page.keyboard.press('End')
  await page.keyboard.type('\n// local-draft-only')

  await page.reload()
  await page.getByRole('button', { name: workspaceTitle }).first().click()
  await page.getByTestId('tree-row').filter({ hasText: '/main.ts' }).first().click()

  const recoveredContent = page.locator('[data-testid="code-editor"] .cm-content').first()
  await expect(recoveredContent).toContainText('// local-draft-only')
})
