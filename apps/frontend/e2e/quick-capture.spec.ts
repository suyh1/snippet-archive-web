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

  await expect(page.getByTestId('floating-toolbar')).toHaveCount(0)
  await expect(page.getByTestId('quick-capture-dialog')).toHaveCount(0)

  await page.getByTestId('toolbar-toggle').click()
  await expect(page.getByTestId('floating-toolbar')).toBeVisible()
  const toolbarStyle = await page.getByTestId('floating-toolbar').evaluate((node) => {
    const style = window.getComputedStyle(node as HTMLElement)
    return {
      backdropFilter: style.backdropFilter,
      boxShadow: style.boxShadow,
    }
  })
  expect(toolbarStyle.backdropFilter).not.toBe('none')
  expect(toolbarStyle.boxShadow).not.toBe('none')

  await page.locator('.route-shell-content').click({ position: { x: 40, y: 40 } })
  await expect(page.getByTestId('floating-toolbar')).toHaveCount(0)

  await page.getByTestId('toolbar-toggle').click()
  await expect(page.getByTestId('floating-toolbar')).toBeVisible()
  await page.getByTestId('quick-capture-open').click()
  await expect(page.getByTestId('quick-capture-dialog')).toBeVisible()
  const quickCaptureBox = await page.getByTestId('quick-capture-dialog').boundingBox()
  expect(quickCaptureBox).not.toBeNull()
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  expect(quickCaptureBox!.height).toBeLessThan(520)
  expect(quickCaptureBox!.y).toBeGreaterThan(40)
  expect(quickCaptureBox!.y).toBeLessThan((viewport?.height ?? 0) * 0.4)
  const dialogCenterX = quickCaptureBox!.x + quickCaptureBox!.width / 2
  const viewportCenterX = (viewport?.width ?? 0) / 2
  expect(Math.abs(dialogCenterX - viewportCenterX)).toBeLessThanOrEqual(8)
  await page.getByTestId('quick-capture-cancel').click()
  await expect(page.getByTestId('quick-capture-dialog')).toHaveCount(0)

  await page.keyboard.press('ControlOrMeta+Shift+K')
  await expect(page.getByTestId('floating-toolbar')).toBeVisible()
  await page.getByTestId('quick-capture-open').click()
  await expect(page.getByTestId('quick-capture-dialog')).toBeVisible()

  await page.getByTestId('quick-capture-name').fill('quick-capture')
  await page.getByTestId('quick-capture-language').selectOption('typescript')
  await page.getByTestId('quick-capture-tags').fill('quick, capture')
  await page.getByTestId('quick-capture-content').fill('const fromQuickCapture = 1')
  await page.getByTestId('quick-capture-submit').click()

  await expect(page).toHaveURL(/\/workspace\?workspaceId=.*&fileId=.*/)
  await expect(page.getByTestId('tree-row').filter({ hasText: '/quick-capture.ts' }).first()).toBeVisible()
})
