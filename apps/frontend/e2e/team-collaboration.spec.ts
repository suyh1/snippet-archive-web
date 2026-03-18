import type { Page } from '@playwright/test'
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

function toDatetimeLocalInput(date: Date) {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16)
}

async function readPageLayoutMetrics(
  page: Page,
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

async function readTeamShellMetrics(page: Page) {
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

test('team page supports org create, share create and audit combo query flows', async ({
  page,
  playwright,
  request,
}) => {
  const stamp = Date.now()
  const orgSlug = `team-${stamp}`
  const memberEmail = `member-${stamp}@example.com`
  let nativeDialogMessage: string | null = null

  page.on('dialog', async (dialog) => {
    nativeDialogMessage = dialog.message()
    await dialog.dismiss()
  })

  const anonRequest = await playwright.request.newContext()
  const registerMemberRes = await anonRequest.post('http://127.0.0.1:3001/api/auth/register', {
    data: {
      email: memberEmail,
      name: 'Team Member',
      password: 'Passw0rd!pass',
    },
  })

  expect(registerMemberRes.ok()).toBeTruthy()
  await anonRequest.dispose()

  await page.goto('/team')
  await expect(page.getByTestId('team-org-name')).toBeVisible()
  const sparseMetrics = await readTeamShellMetrics(page)
  expectTeamShellContained(sparseMetrics)

  const meRes = await request.get('http://127.0.0.1:3001/api/auth/me')
  expect(meRes.ok()).toBeTruthy()
  const mePayload = await meRes.json()
  const ownerId = mePayload.data.id as string

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

  await page.getByTestId('team-member-email').fill(memberEmail)
  await page.getByTestId('team-member-role').selectOption('VIEWER')
  await page.getByTestId('team-member-add').click()

  const memberRow = page.getByTestId('team-member-item').filter({ hasText: memberEmail }).first()
  await expect(memberRow).toBeVisible()
  await expect(memberRow).toContainText('VIEWER')

  await memberRow.getByTestId('team-member-role-select').selectOption('EDITOR')
  await memberRow.getByTestId('team-member-role-save').click()
  await expect(memberRow).toContainText('EDITOR')

  await memberRow.getByTestId('team-member-remove').click()
  await expect(page.getByTestId('confirm-dialog')).toBeVisible()
  await page.getByTestId('confirm-dialog-cancel').click()
  await expect(page.getByTestId('confirm-dialog')).toHaveCount(0)
  await expect(memberRow).toBeVisible()

  await memberRow.getByTestId('team-member-remove').click()
  await page.getByTestId('confirm-dialog-confirm').click()
  await expect(memberRow).toHaveCount(0)

  await page.getByTestId('team-share-refresh').click()
  await page.getByTestId('team-share-workspace-select').selectOption(workspaceId)
  await page.getByTestId('team-share-file-select').selectOption(fileId)
  await page.getByTestId('team-share-permission').selectOption('READ_METADATA')
  await page.getByTestId('team-share-expiry').fill('2026-03-18T10:00')
  await page.getByTestId('team-share-expiry').blur()
  await page.getByTestId('team-share-file-select').press('Enter')

  await expect(page.getByTestId('team-share-item')).toHaveCount(1)
  await expect(page.getByTestId('team-share-item').first()).toContainText('PUBLIC')
  await expect(page.getByTestId('team-share-item').first()).toContainText('READ_METADATA')

  const fromInputValue = toDatetimeLocalInput(new Date(Date.now() - 10 * 60 * 1000))
  const toInputValue = toDatetimeLocalInput(new Date(Date.now() + 10 * 60 * 1000))
  const fromIso = new Date(fromInputValue).toISOString()
  const toIso = new Date(toInputValue).toISOString()

  await page.getByTestId('team-audit-action').fill('SHARE_LINK_CREATED')
  await page.getByTestId('team-audit-actor').fill(` ${ownerId} `)
  await page.getByTestId('team-audit-from').fill(fromInputValue)
  await page.getByTestId('team-audit-to').fill(toInputValue)
  await page.getByTestId('team-audit-from').blur()
  await page.getByTestId('team-audit-to').blur()

  const comboFilterResponsePromise = page.waitForResponse((response) => {
    if (
      response.request().method() !== 'GET' ||
      !response.url().includes(`/api/organizations/${organizationId}/audit-logs`)
    ) {
      return false
    }

    const url = new URL(response.url())
    return (
      url.searchParams.get('action') === 'SHARE_LINK_CREATED' &&
      url.searchParams.get('actorId') === ownerId &&
      url.searchParams.get('from') === fromIso &&
      url.searchParams.get('to') === toIso
    )
  })

  await page.getByTestId('team-audit-to').press('Enter')
  const comboFilterResponse = await comboFilterResponsePromise
  expect(comboFilterResponse.ok()).toBeTruthy()
  await expect(page.getByTestId('team-audit-item')).toHaveCount(1)

  await page.getByTestId('team-audit-actor').fill('00000000-0000-0000-0000-000000000000')
  await page.getByTestId('team-audit-query').click()
  await expect(page.getByTestId('team-audit-item')).toHaveCount(0)
  await expect(page.getByTestId('team-audit-empty')).toBeVisible()

  expect(nativeDialogMessage).toBeNull()
  const denseMetrics = await readTeamShellMetrics(page)
  expectTeamShellContained(denseMetrics)
})
