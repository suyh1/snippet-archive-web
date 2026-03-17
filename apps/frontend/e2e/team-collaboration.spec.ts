import { expect, test } from './fixtures'

type PageLayoutMetrics = {
  width: number
  leftInset: number
  rightInset: number
  paddingTop: number
  paddingLeft: number
  paddingRight: number
}

type TeamShellMetrics = {
  shellHeight: number
  viewportHeight: number
  docHeight: number
  bodyHeight: number
  teamBottom: number
  contentBottom: number
  overflowY: string
}

async function readPageLayoutMetrics(
  page: Parameters<typeof test>[0]['page'],
  targetSelector: string,
) {
  return page.evaluate((selector) => {
    const content = document.querySelector('.route-shell-content') as HTMLElement | null
    const target = document.querySelector(selector) as HTMLElement | null
    if (!content || !target) {
      return null
    }

    const contentRect = content.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const style = window.getComputedStyle(target)

    return {
      width: targetRect.width,
      leftInset: targetRect.left - contentRect.left,
      rightInset: contentRect.right - targetRect.right,
      paddingTop: parseFloat(style.paddingTop),
      paddingLeft: parseFloat(style.paddingLeft),
      paddingRight: parseFloat(style.paddingRight),
    }
  }, targetSelector)
}

async function readTeamShellMetrics(page: Parameters<typeof test>[0]['page']) {
  return page.evaluate(() => {
    const shell = document.querySelector('[data-testid="route-shell"]') as HTMLElement | null
    const content = document.querySelector('.route-shell-content') as HTMLElement | null
    const team = document.querySelector('[data-testid="team-page"]') as HTMLElement | null
    if (!shell || !content || !team) {
      return null
    }

    return {
      shellHeight: shell.getBoundingClientRect().height,
      viewportHeight: window.innerHeight,
      docHeight: document.documentElement.scrollHeight,
      bodyHeight: document.body.scrollHeight,
      teamBottom: team.getBoundingClientRect().bottom,
      contentBottom: content.getBoundingClientRect().bottom,
      overflowY: window.getComputedStyle(team).overflowY,
    }
  })
}

function expectTeamShellContained(metrics: TeamShellMetrics | null) {
  expect(metrics).not.toBeNull()
  expect(Math.abs((metrics?.shellHeight ?? 0) - (metrics?.viewportHeight ?? 0))).toBeLessThanOrEqual(4)
  expect(metrics?.docHeight ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
    (metrics?.viewportHeight ?? 0) + 4,
  )
  expect(metrics?.bodyHeight ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
    (metrics?.viewportHeight ?? 0) + 4,
  )
  expect((metrics?.teamBottom ?? Number.POSITIVE_INFINITY) - (metrics?.contentBottom ?? 0)).toBeLessThanOrEqual(2)
  expect(['auto', 'scroll']).toContain(metrics?.overflowY)
}

test('team page layout stays aligned with favorites page baseline', async ({ page }) => {
  await page.goto('/favorites')
  await expect(page.getByTestId('favorites-page')).toBeVisible()
  const favoritesMetrics = await readPageLayoutMetrics(page, '[data-testid="favorites-page"]')
  expect(favoritesMetrics).not.toBeNull()

  await page.goto('/team')
  await expect(page.getByTestId('team-page')).toBeVisible()
  const teamMetrics = await readPageLayoutMetrics(page, '[data-testid="team-page"]')
  expect(teamMetrics).not.toBeNull()

  expect(Math.abs((teamMetrics?.width ?? 0) - (favoritesMetrics?.width ?? 0))).toBeLessThanOrEqual(4)
  expect(Math.abs((teamMetrics?.leftInset ?? 0) - (favoritesMetrics?.leftInset ?? 0))).toBeLessThanOrEqual(4)
  expect(Math.abs((teamMetrics?.rightInset ?? 0) - (favoritesMetrics?.rightInset ?? 0))).toBeLessThanOrEqual(4)
  expect(Math.abs((teamMetrics?.paddingTop ?? 0) - (favoritesMetrics?.paddingTop ?? 0))).toBeLessThanOrEqual(4)
  expect(Math.abs((teamMetrics?.paddingLeft ?? 0) - (favoritesMetrics?.paddingLeft ?? 0))).toBeLessThanOrEqual(4)
  expect(Math.abs((teamMetrics?.paddingRight ?? 0) - (favoritesMetrics?.paddingRight ?? 0))).toBeLessThanOrEqual(4)
})

test('team page supports org create, share create and audit query flows', async ({
  page,
  request,
}) => {
  const stamp = Date.now()
  const orgSlug = `team-${stamp}`

  await page.goto('/team')
  await expect(page.getByTestId('team-org-name')).toBeVisible()
  const sparseMetrics = await readTeamShellMetrics(page)
  expectTeamShellContained(sparseMetrics)

  await page.getByTestId('team-org-name').fill('Team Alpha')
  await page.getByTestId('team-org-slug').fill(orgSlug)
  await page.getByTestId('team-org-slug').press('Enter')

  await expect(page.getByTestId('team-org-select')).toHaveValue(/[0-9a-f-]{36}/)
  const organizationId = await page.getByTestId('team-org-select').inputValue()
  expect(organizationId).toHaveLength(36)

  const createWorkspaceRes = await request.post('http://127.0.0.1:3001/api/workspaces', {
    data: {
      title: 'Playwright Team Workspace',
      organizationId,
    },
  })

  expect(createWorkspaceRes.ok()).toBeTruthy()
  const workspacePayload = await createWorkspaceRes.json()
  const workspaceId = workspacePayload.data.id as string

  const createFileRes = await request.post(
    `http://127.0.0.1:3001/api/workspaces/${workspaceId}/files`,
    {
      data: {
        name: 'shared.ts',
        path: '/shared.ts',
        language: 'typescript',
        content: 'export const shared = true',
        kind: 'file',
        order: 1,
      },
    },
  )

  expect(createFileRes.ok()).toBeTruthy()
  const filePayload = await createFileRes.json()
  const fileId = filePayload.data.id as string

  await page.getByTestId('team-share-workspace-id').fill(workspaceId)
  await page.getByTestId('team-share-file-id').fill(fileId)
  await page.getByTestId('team-share-expiry').fill('2026-03-18T10:00')
  await page.getByTestId('team-share-expiry').blur()
  await page.getByTestId('team-share-file-id').press('Enter')

  await expect(page.getByTestId('team-share-item')).toHaveCount(1)
  await expect(page.getByTestId('team-share-item').first()).toContainText('PUBLIC')

  await page.getByTestId('team-audit-action').fill('SHARE_LINK_CREATED')
  await page.getByTestId('team-audit-query').click()
  await expect(page.getByTestId('team-audit-item')).toHaveCount(1)
  const denseMetrics = await readTeamShellMetrics(page)
  expectTeamShellContained(denseMetrics)
})
