import { expect, test } from './fixtures'
import type { APIRequestContext, Page } from '@playwright/test'

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

async function listWorkspaceFilePaths(request: APIRequestContext, workspaceId: string) {
  const listRes = await request.get(`http://127.0.0.1:3001/api/workspaces/${workspaceId}/files`)
  expect(listRes.ok()).toBeTruthy()

  const payload = await listRes.json()
  const items: Array<{ path: string }> = payload?.data?.items ?? []
  return items.map((item) => item.path)
}

async function readLayoutMetrics(page: Page) {
  return page.evaluate(() => {
    const content = document.querySelector('.content') as HTMLElement | null
    const workspaceView = document.querySelector('.workspace-view') as HTMLElement | null
    const workspaceMain = document.querySelector('.workspace-main') as HTMLElement | null
    const fileTree = document.querySelector('.file-tree') as HTMLElement | null
    const editorPanel = document.querySelector('.editor-panel') as HTMLElement | null

    const contentRect = content?.getBoundingClientRect()
    const contentStyle = content ? window.getComputedStyle(content) : null
    const contentPaddingBottom = contentStyle ? parseFloat(contentStyle.paddingBottom) : 0
    const contentInnerBottom = contentRect ? contentRect.bottom - contentPaddingBottom : 0

    return {
      contentInnerBottom,
      workspaceViewBottom: workspaceView?.getBoundingClientRect().bottom ?? 0,
      workspaceMainBottom: workspaceMain?.getBoundingClientRect().bottom ?? 0,
      fileTreeBottom: fileTree?.getBoundingClientRect().bottom ?? 0,
      editorPanelBottom: editorPanel?.getBoundingClientRect().bottom ?? 0,
      viewportHeight: window.innerHeight,
      docHeight: document.documentElement.scrollHeight,
      bodyHeight: document.body.scrollHeight,
    }
  })
}

test('delete flow: cancel keeps file, confirm removes file and persists', async ({ page, request }) => {
  await cleanupWorkspaces(request)

  let nativeDialogMessage: string | null = null
  page.on('dialog', async (dialog) => {
    nativeDialogMessage = dialog.message()
    await dialog.dismiss()
  })

  await page.goto('/')

  const workspaceTitle = 'Delete Flow Workspace'
  await page.getByPlaceholder('新建工作区名称').fill(workspaceTitle)
  await page.getByRole('button', { name: '新建' }).click()

  await expect(page.getByRole('heading', { name: workspaceTitle }).first()).toBeVisible()

  // keyboard flow: continuous typing + Esc cancel draft
  await page.getByTestId('create-file-root').click()
  const canceledInput = page.getByTestId('create-inline-input')
  await canceledInput.type('temp-cancel.ts')
  await canceledInput.press('Escape')
  await expect(page.getByText('/temp-cancel.ts')).toHaveCount(0)

  // keyboard flow: continuous typing + Enter submit
  await page.getByTestId('create-file-root').click()
  const deleteInput = page.getByTestId('create-inline-input')
  await deleteInput.fill('')
  await deleteInput.pressSequentially('delete-me.ts')
  await deleteInput.press('Enter')

  // click/focus switch/blur flow: blur submit create
  await page.getByTestId('create-file-root').click()
  const keepInput = page.getByTestId('create-inline-input')
  await keepInput.fill('')
  await keepInput.pressSequentially('keep.ts')
  await page.getByRole('heading', { name: 'Files' }).click()

  await page.getByTestId('create-folder-root').click()
  const folderInput = page.getByTestId('create-inline-input')
  await folderInput.fill('')
  await folderInput.pressSequentially('archive')
  await folderInput.press('Enter')

  const deleteRow = page.getByTestId('tree-row').filter({ hasText: '/delete-me.ts' }).first()
  const keepRow = page.getByTestId('tree-row').filter({ hasText: '/keep.ts' }).first()
  const folderRow = page.getByTestId('tree-row').filter({ hasText: '/archive' }).first()
  await expect(deleteRow).toBeVisible()
  await expect(keepRow).toBeVisible()
  await expect(folderRow).toBeVisible()
  await expect(page.getByText('输入内容不合法，请检查后重试。')).toHaveCount(0)

  const workspaceId = await getWorkspaceIdByTitle(request, workspaceTitle)

  await deleteRow.getByTestId('delete-item').click()

  const inlineConfirmButton = deleteRow.getByTestId('confirm-delete-file')
  const inlineCancelButton = deleteRow.getByTestId('cancel-delete-file')
  await expect(inlineConfirmButton).toBeVisible()
  await expect(inlineCancelButton).toBeVisible()

  await inlineCancelButton.click()

  await expect(deleteRow).toBeVisible()
  let paths = await listWorkspaceFilePaths(request, workspaceId)
  expect(paths).toContain('/delete-me.ts')

  const deleteRowAgain = page.getByTestId('tree-row').filter({ hasText: '/delete-me.ts' }).first()
  const deleteResponsePromise = page.waitForResponse((response) => {
    return (
      response.request().method() === 'DELETE' &&
      response.url().includes(`/api/workspaces/${workspaceId}/files/`)
    )
  })
  await deleteRowAgain.getByTestId('delete-item').click()
  await deleteRowAgain.getByTestId('confirm-delete-file').click()
  const deleteResponse = await deleteResponsePromise
  expect(deleteResponse.ok()).toBeTruthy()

  const pathsAfterConfirm = await listWorkspaceFilePaths(request, workspaceId)
  expect(pathsAfterConfirm).not.toContain('/delete-me.ts')

  await expect(deleteRowAgain).toHaveCount(0)
  await expect(page.getByTestId('file-delete-toast')).toContainText('delete-me.ts')
  await expect(keepRow).toBeVisible()

  await page.getByTestId('undo-delete-file').click()
  await expect(page.getByTestId('tree-row').filter({ hasText: '/delete-me.ts' }).first()).toBeVisible()

  paths = await listWorkspaceFilePaths(request, workspaceId)
  expect(paths).toContain('/delete-me.ts')
  expect(paths).toContain('/keep.ts')

  await folderRow.getByTestId('delete-item').click()
  await expect(page.getByTestId('confirm-dialog')).toBeVisible()
  await expect(page.getByTestId('confirm-dialog')).toContainText('archive')
  await page.getByTestId('confirm-dialog-cancel').click()
  await expect(page.getByTestId('confirm-dialog')).toHaveCount(0)
  await expect(folderRow).toBeVisible()

  await folderRow.getByTestId('delete-item').click()
  await page.getByTestId('confirm-dialog-confirm').click()
  await expect(folderRow).toHaveCount(0)

  const workspaceDeleteButton = page.locator('.workspace-sidebar .delete-button').first()
  await workspaceDeleteButton.click()
  await expect(page.getByTestId('confirm-dialog')).toBeVisible()
  await page.getByTestId('confirm-dialog-cancel').click()
  await expect(page.getByRole('heading', { name: workspaceTitle }).first()).toBeVisible()

  expect(nativeDialogMessage).toBeNull()

  const metrics = await readLayoutMetrics(page)
  expect(metrics.docHeight).toBeLessThanOrEqual(metrics.viewportHeight + 4)
  expect(metrics.bodyHeight).toBeLessThanOrEqual(metrics.viewportHeight + 4)
  expect(Math.abs(metrics.workspaceViewBottom - metrics.contentInnerBottom)).toBeLessThanOrEqual(2)
  expect(Math.abs(metrics.workspaceMainBottom - metrics.workspaceViewBottom)).toBeLessThanOrEqual(2)
  expect(Math.abs(metrics.fileTreeBottom - metrics.workspaceMainBottom)).toBeLessThanOrEqual(2)
  expect(Math.abs(metrics.editorPanelBottom - metrics.workspaceMainBottom)).toBeLessThanOrEqual(2)
})
