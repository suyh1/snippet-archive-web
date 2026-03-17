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

async function getWorkspaceIdByTitle(request: APIRequestContext, title: string) {
  const listRes = await request.get('http://127.0.0.1:3001/api/workspaces')
  expect(listRes.ok()).toBeTruthy()

  const payload = await listRes.json()
  const items: Array<{ id: string; title: string }> = payload?.data?.items ?? []
  const target = items.find((item) => item.title === title)

  expect(target?.id).toBeTruthy()
  return target!.id
}

async function seedManyFiles(request: APIRequestContext, workspaceId: string, total: number) {
  for (let index = 1; index <= total; index += 1) {
    const fileRes = await request.post(
      `http://127.0.0.1:3001/api/workspaces/${workspaceId}/files`,
      {
        data: {
          name: `bulk-${index}.ts`,
          path: `/bulk-${index}.ts`,
          language: 'typescript',
          content: `export const v${index} = ${index};`,
          kind: 'file',
          order: index,
        },
      },
    )

    expect(fileRes.ok()).toBeTruthy()
  }
}

async function readLayoutMetrics(page: Parameters<typeof test>[0]['page']) {
  return page.evaluate(() => {
    const shell = document.querySelector('.app-shell') as HTMLElement | null
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
      shellHeight: shell?.getBoundingClientRect().height ?? 0,
      viewportHeight: window.innerHeight,
      docHeight: document.documentElement.scrollHeight,
      bodyHeight: document.body.scrollHeight,
      contentInnerBottom,
      workspaceViewBottom: workspaceView?.getBoundingClientRect().bottom ?? 0,
      workspaceMainBottom: workspaceMain?.getBoundingClientRect().bottom ?? 0,
      fileTreeBottom: fileTree?.getBoundingClientRect().bottom ?? 0,
      editorPanelBottom: editorPanel?.getBoundingClientRect().bottom ?? 0,
    }
  })
}

test('files panel progressive reveal keeps layout contained and supports keyboard flows', async ({
  page,
  request,
}) => {
  await cleanupWorkspaces(request)

  await page.goto('/')

  const workspaceTitle = 'Progressive Reveal Workspace'

  await page.getByPlaceholder('新建工作区名称').fill(workspaceTitle)
  await page.getByRole('button', { name: '新建' }).click()

  await expect(page.getByRole('heading', { name: workspaceTitle }).first()).toBeVisible()

  const emptyStateLayout = await readLayoutMetrics(page)
  expect(Math.abs(emptyStateLayout.workspaceViewBottom - emptyStateLayout.contentInnerBottom)).toBeLessThanOrEqual(2)
  expect(Math.abs(emptyStateLayout.workspaceMainBottom - emptyStateLayout.workspaceViewBottom)).toBeLessThanOrEqual(2)
  expect(Math.abs(emptyStateLayout.fileTreeBottom - emptyStateLayout.workspaceMainBottom)).toBeLessThanOrEqual(2)
  expect(Math.abs(emptyStateLayout.editorPanelBottom - emptyStateLayout.workspaceMainBottom)).toBeLessThanOrEqual(2)

  await page.getByTestId('create-file-root').click()
  const draftInput = page.getByTestId('create-inline-input')
  await draftInput.type('temp-cancel.ts')
  await draftInput.press('Escape')

  await expect(page.getByText('/temp-cancel.ts')).toHaveCount(0)

  await page.getByTestId('create-file-root').click()
  const blurInput = page.getByTestId('create-inline-input')
  await blurInput.type('blur-save.ts')
  await page.getByRole('heading', { name: 'Files' }).click()

  await expect(page.getByText('/blur-save.ts')).toBeVisible()

  await page.getByTestId('create-folder-root').click()
  await page.getByTestId('create-inline-input').fill('src')
  await page.getByTestId('create-inline-input').press('Enter')

  await expect(
    page.getByTestId('tree-row').filter({ hasText: '/src' }).first(),
  ).toBeVisible()

  const workspaceId = await getWorkspaceIdByTitle(request, workspaceTitle)
  await seedManyFiles(request, workspaceId, 170)

  await page.reload()
  await page.getByRole('button', { name: workspaceTitle }).first().click()

  const rows = page.getByTestId('tree-row')
  await expect(rows).toHaveCount(16)
  await expect(page.getByTestId('rows-segment-indicator')).toContainText('1 /')

  const showMore = page.getByTestId('show-more-rows')
  await expect(showMore).toBeVisible()

  await showMore.click()
  await expect(rows).toHaveCount(16)
  await expect(page.getByTestId('rows-segment-indicator')).toContainText('2 /')

  await showMore.focus()
  await page.keyboard.press('Enter')
  await expect(rows).toHaveCount(16)
  await expect(page.getByTestId('rows-segment-indicator')).toContainText('3 /')

  const metrics = await readLayoutMetrics(page)

  expect(metrics.shellHeight).toBeGreaterThan(metrics.viewportHeight - 2)
  expect(metrics.docHeight).toBeLessThanOrEqual(metrics.viewportHeight + 4)
  expect(metrics.bodyHeight).toBeLessThanOrEqual(metrics.viewportHeight + 4)
  expect(Math.abs(metrics.workspaceViewBottom - metrics.contentInnerBottom)).toBeLessThanOrEqual(2)
  expect(Math.abs(metrics.workspaceMainBottom - metrics.workspaceViewBottom)).toBeLessThanOrEqual(2)
  expect(Math.abs(metrics.fileTreeBottom - metrics.workspaceMainBottom)).toBeLessThanOrEqual(2)
  expect(Math.abs(metrics.editorPanelBottom - metrics.workspaceMainBottom)).toBeLessThanOrEqual(2)
})
