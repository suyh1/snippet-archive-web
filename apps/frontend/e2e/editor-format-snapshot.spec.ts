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

test('editor can format code and rollback via snapshots', async ({ page, request }) => {
  await cleanupWorkspaces(request)

  await page.goto('/')

  await page.getByPlaceholder('新建工作区名称').fill('Editor Format Snapshot Workspace')
  await page.getByRole('button', { name: '新建' }).click()

  await page.getByTestId('create-file-root').click()
  await page.getByTestId('create-inline-input').fill('main.ts')
  await page.getByTestId('create-inline-input').press('Enter')

  await page.getByTestId('tree-row').filter({ hasText: '/main.ts' }).first().click()

  const content = page.locator('[data-testid="code-editor"] .cm-content').first()
  await content.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('const add=(a:number,b:number)=>{return a+b}')

  await page.getByTestId('editor-format').click()
  await expect(content).toContainText('const add = (a: number, b: number) => {')

  await page.getByTestId('editor-snapshots').click()
  await expect(page.getByTestId('snapshot-dialog')).toBeVisible()

  await page.getByTestId('snapshot-restore').first().click()
  await expect(content).toContainText('const add=(a:number,b:number)=>{return a+b}')
})
