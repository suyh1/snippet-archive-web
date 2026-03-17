import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function readSettingsLayoutMetrics(page: Parameters<typeof test>[0]['page']) {
  return page.evaluate(() => {
    const shell = document.querySelector('.app-shell') as HTMLElement | null
    const content = document.querySelector('.content') as HTMLElement | null
    const settingsView = document.querySelector('.settings-view') as HTMLElement | null
    const settingsPanel = document.querySelector('.settings-panel') as HTMLElement | null
    const activeTabPanel = document.querySelector(
      '[data-testid^="settings-panel-"]',
    ) as HTMLElement | null
    const themeSettings = document.querySelector('[data-testid="settings-theme-panel"]') as
      | HTMLElement
      | null
    const tutorial = document.querySelector('[data-testid="settings-theme-tutorial"]') as
      | HTMLElement
      | null

    const contentRect = content?.getBoundingClientRect()
    const contentStyle = content ? window.getComputedStyle(content) : null
    const contentPaddingBottom = contentStyle ? parseFloat(contentStyle.paddingBottom) : 0
    const contentInnerBottom = contentRect ? contentRect.bottom - contentPaddingBottom : 0

    const panelRect = settingsPanel?.getBoundingClientRect()
    const panelStyle = settingsPanel ? window.getComputedStyle(settingsPanel) : null
    const panelBottomInset = panelStyle
      ? parseFloat(panelStyle.borderBottomWidth) + parseFloat(panelStyle.paddingBottom)
      : 0
    const panelContentBottom = panelRect ? panelRect.bottom - panelBottomInset : 0

    return {
      shellHeight: shell?.getBoundingClientRect().height ?? 0,
      viewportHeight: window.innerHeight,
      docHeight: document.documentElement.scrollHeight,
      bodyHeight: document.body.scrollHeight,
      contentInnerBottom,
      settingsViewBottom: settingsView?.getBoundingClientRect().bottom ?? 0,
      activeTabPanelBottom: activeTabPanel?.getBoundingClientRect().bottom ?? 0,
      panelContentBottom,
      themeSettingsBottom: themeSettings?.getBoundingClientRect().bottom ?? 0,
      tutorialBottom: tutorial?.getBoundingClientRect().bottom ?? 0,
    }
  })
}

type TopRightActionLabel = '打开设置' | '返回工作台'

type TopRightGeometryMetrics = {
  actionIntersectsMeta: boolean
  toolbarIntersectsMeta: boolean
  iconCenterYDelta: number
  topInset: number
  rightInset: number
  metaToIconGroupGap: number
}

async function readTopRightGeometryMetrics(
  page: Parameters<typeof test>[0]['page'],
  actionLabel: TopRightActionLabel,
) {
  return page.evaluate((expectedActionLabel) => {
    const topActions = document.querySelector('.route-shell-top-actions') as HTMLElement | null
    const meta = document.querySelector('.content-head .meta') as HTMLElement | null
    const actionEntry = document.querySelector(
      `[aria-label="${expectedActionLabel}"]`,
    ) as HTMLElement | null
    const toolbarEntry = document.querySelector('[data-testid="toolbar-toggle"]') as HTMLElement | null
    if (!topActions || !meta || !actionEntry || !toolbarEntry) {
      return null
    }

    const intersects = (a: DOMRect, b: DOMRect) =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

    const topActionsRect = topActions.getBoundingClientRect()
    const metaRect = meta.getBoundingClientRect()
    const actionRect = actionEntry.getBoundingClientRect()
    const toolbarRect = toolbarEntry.getBoundingClientRect()

    return {
      actionIntersectsMeta: intersects(metaRect, actionRect),
      toolbarIntersectsMeta: intersects(metaRect, toolbarRect),
      iconCenterYDelta: Math.abs(
        actionRect.top + actionRect.height / 2 - (toolbarRect.top + toolbarRect.height / 2),
      ),
      topInset: topActionsRect.top,
      rightInset: window.innerWidth - topActionsRect.right,
      metaToIconGroupGap: topActionsRect.left - metaRect.right,
    }
  }, actionLabel)
}

function expectTopRightGeometry(metrics: TopRightGeometryMetrics | null) {
  expect(metrics).not.toBeNull()
  expect(metrics?.actionIntersectsMeta).toBe(false)
  expect(metrics?.toolbarIntersectsMeta).toBe(false)
  expect(metrics?.iconCenterYDelta).toBeLessThanOrEqual(2)
  expect(metrics?.topInset).toBeGreaterThanOrEqual(8)
  expect(metrics?.rightInset).toBeGreaterThanOrEqual(8)
  expect(metrics?.metaToIconGroupGap).toBeGreaterThanOrEqual(8)
}

test('top-right icon group keeps one-row geometry across routes and breakpoints', async ({ page }) => {
  const viewports = [
    { width: 2048, height: 526 },
    { width: 900, height: 760 },
  ]

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/')

    await expect(page.getByLabel('打开设置')).toHaveCount(1)
    await expect(page.getByLabel('返回工作台')).toHaveCount(0)
    const workspaceMetrics = await readTopRightGeometryMetrics(page, '打开设置')
    expectTopRightGeometry(workspaceMetrics)

    await page.getByTestId('open-settings').click()
    await expect(page).toHaveURL(/\/settings(?:\?.*)?$/)
    await expect(page.getByLabel('打开设置')).toHaveCount(0)
    await expect(page.getByLabel('返回工作台')).toHaveCount(1)
    const settingsMetrics = await readTopRightGeometryMetrics(page, '返回工作台')
    expectTopRightGeometry(settingsMetrics)
  }
})

test('settings page shows language list and supports tab switching', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByLabel('打开设置')).toHaveCount(1)
  const topRightLayout = await page.evaluate(() => {
    const meta = document.querySelector('.content-head .meta') as HTMLElement | null
    const settingsEntry = document.querySelector('[aria-label="打开设置"]') as HTMLElement | null
    const toolbarEntry = document.querySelector('[data-testid="toolbar-toggle"]') as HTMLElement | null
    if (!meta || !settingsEntry || !toolbarEntry) {
      return null
    }

    const metaRect = meta.getBoundingClientRect()
    const settingsRect = settingsEntry.getBoundingClientRect()
    const toolbarRect = toolbarEntry.getBoundingClientRect()
    const intersects =
      metaRect.left < settingsRect.right &&
      metaRect.right > settingsRect.left &&
      metaRect.top < settingsRect.bottom &&
      metaRect.bottom > settingsRect.top
    const toolbarIntersects =
      metaRect.left < toolbarRect.right &&
      metaRect.right > toolbarRect.left &&
      metaRect.top < toolbarRect.bottom &&
      metaRect.bottom > toolbarRect.top
    const iconCenterYDelta = Math.abs(
      settingsRect.top + settingsRect.height / 2 - (toolbarRect.top + toolbarRect.height / 2),
    )

    return {
      intersects,
      toolbarIntersects,
      iconCenterYDelta,
    }
  })
  expect(topRightLayout).not.toBeNull()
  expect(topRightLayout?.intersects).toBe(false)
  expect(topRightLayout?.toolbarIntersects).toBe(false)
  expect(topRightLayout?.iconCenterYDelta).toBeLessThanOrEqual(2)

  await page.getByTestId('open-settings').click()
  await expect(page).toHaveURL(/\/settings(?:\?.*)?$/)
  await expect(page.getByTestId('settings-view')).toBeVisible()
  await expect(page.getByLabel('打开设置')).toHaveCount(0)
  await expect(page.getByLabel('返回工作台')).toHaveCount(1)

  const settingsTopRightLayout = await page.evaluate(() => {
    const meta = document.querySelector('.content-head .meta') as HTMLElement | null
    const backEntry = document.querySelector('[aria-label="返回工作台"]') as HTMLElement | null
    const toolbarEntry = document.querySelector('[data-testid="toolbar-toggle"]') as HTMLElement | null
    if (!meta || !backEntry || !toolbarEntry) {
      return null
    }

    const metaRect = meta.getBoundingClientRect()
    const backRect = backEntry.getBoundingClientRect()
    const toolbarRect = toolbarEntry.getBoundingClientRect()
    const backIntersects =
      metaRect.left < backRect.right &&
      metaRect.right > backRect.left &&
      metaRect.top < backRect.bottom &&
      metaRect.bottom > backRect.top
    const toolbarIntersects =
      metaRect.left < toolbarRect.right &&
      metaRect.right > toolbarRect.left &&
      metaRect.top < toolbarRect.bottom &&
      metaRect.bottom > toolbarRect.top
    const iconCenterYDelta = Math.abs(
      backRect.top + backRect.height / 2 - (toolbarRect.top + toolbarRect.height / 2),
    )

    return {
      backIntersects,
      toolbarIntersects,
      iconCenterYDelta,
    }
  })
  expect(settingsTopRightLayout).not.toBeNull()
  expect(settingsTopRightLayout?.backIntersects).toBe(false)
  expect(settingsTopRightLayout?.toolbarIntersects).toBe(false)
  expect(settingsTopRightLayout?.iconCenterYDelta).toBeLessThanOrEqual(2)

  await expect(page.getByTestId('settings-panel-languages')).toBeVisible()
  const languageCount = await page.getByTestId('settings-language-item').count()
  expect(languageCount).toBeGreaterThanOrEqual(100)

  await page.getByTestId('settings-tab-general').click()
  await expect(page.getByTestId('settings-panel-general')).toBeVisible()

  await page.getByTestId('settings-tab-themes').click()
  await expect(page.getByTestId('settings-panel-themes')).toBeVisible()
  const themeTutorial = page.getByTestId('settings-theme-tutorial')
  await expect(themeTutorial).toBeVisible()
  await expect(themeTutorial).toContainText('schemaVersion')
  await expect(themeTutorial).toContainText('modules')
  await expect(themeTutorial).toContainText('surface.toolbarGlassBackground')
  await expect(themeTutorial).toContainText('surface.toolbarGlassHighlightArc')

  await page.getByTestId('settings-tab-shortcuts').click()
  await expect(page.getByTestId('settings-panel-shortcuts')).toBeVisible()
  await expect(page.getByTestId('settings-panel-shortcuts')).toContainText('Ctrl/Cmd + Shift + K')
  await expect(page.getByTestId('settings-panel-shortcuts')).toContainText('Ctrl/Cmd + S')

  await page.getByTestId('settings-tab-languages').click()
  await expect(page.getByTestId('settings-panel-languages')).toBeVisible()

  await page.getByTestId('settings-language-search').fill('python')
  await expect(page.getByTestId('settings-language-list')).toContainText('Python')

  await page.getByTestId('settings-language-search').fill('vue')
  const filteredItems = page.getByTestId('settings-language-item')
  await expect(filteredItems).toHaveCount(1)
  const onlyItemBox = await filteredItems.first().boundingBox()
  expect(onlyItemBox).not.toBeNull()
  expect(onlyItemBox!.height).toBeLessThan(140)

  await page.getByTestId('back-to-workspace').click()
  await expect(page).toHaveURL(/\/workspace(?:\?.*)?$/)
  await expect(page.getByTestId('open-settings')).toBeVisible()
})

test('settings themes tutorial stays contained and is scrollable', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('open-settings').click()

  await page.getByTestId('settings-tab-general').click()
  await expect(page.getByTestId('settings-panel-general')).toBeVisible()
  const sparseStateLayout = await readSettingsLayoutMetrics(page)
  expect(Math.abs(sparseStateLayout.shellHeight - sparseStateLayout.viewportHeight)).toBeLessThanOrEqual(4)
  expect(sparseStateLayout.docHeight).toBeLessThanOrEqual(sparseStateLayout.viewportHeight + 4)
  expect(sparseStateLayout.bodyHeight).toBeLessThanOrEqual(sparseStateLayout.viewportHeight + 4)
  expect(
    Math.abs(sparseStateLayout.settingsViewBottom - sparseStateLayout.contentInnerBottom),
  ).toBeLessThanOrEqual(2)
  expect(
    Math.abs(sparseStateLayout.activeTabPanelBottom - sparseStateLayout.panelContentBottom),
  ).toBeLessThanOrEqual(2)

  await page.getByTestId('settings-tab-themes').click()
  await expect(page.getByTestId('settings-panel-themes')).toBeVisible()

  const denseStateLayout = await readSettingsLayoutMetrics(page)
  expect(Math.abs(denseStateLayout.shellHeight - denseStateLayout.viewportHeight)).toBeLessThanOrEqual(4)
  expect(denseStateLayout.docHeight).toBeLessThanOrEqual(denseStateLayout.viewportHeight + 4)
  expect(denseStateLayout.bodyHeight).toBeLessThanOrEqual(denseStateLayout.viewportHeight + 4)
  expect(Math.abs(denseStateLayout.settingsViewBottom - denseStateLayout.contentInnerBottom)).toBeLessThanOrEqual(2)
  expect(Math.abs(denseStateLayout.activeTabPanelBottom - denseStateLayout.panelContentBottom)).toBeLessThanOrEqual(2)
  expect(denseStateLayout.themeSettingsBottom).toBeLessThanOrEqual(denseStateLayout.panelContentBottom + 2)
  expect(denseStateLayout.tutorialBottom).toBeLessThanOrEqual(denseStateLayout.panelContentBottom + 2)

  const tutorialScroll = await page.getByTestId('settings-theme-tutorial').evaluate((node) => {
    const element = node as HTMLElement
    element.scrollTop = 0
    element.scrollTop = 120
    return {
      overflowY: window.getComputedStyle(element).overflowY,
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }
  })

  expect(['auto', 'scroll']).toContain(tutorialScroll.overflowY)
  expect(tutorialScroll.scrollHeight).toBeGreaterThan(tutorialScroll.clientHeight)
  expect(tutorialScroll.scrollTop).toBeGreaterThan(0)
})

test('settings themes tab supports import/export and keyboard flows', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('open-settings').click()
  await page.getByTestId('settings-tab-themes').click()

  await expect(page.getByTestId('settings-theme-panel')).toBeVisible()
  await expect(page.getByTestId('settings-theme-current-id')).toContainText('glass-gradient')

  await expect(page.getByTestId('settings-theme-preset-select')).toBeVisible()
  await page.getByTestId('settings-theme-preset-select').selectOption('graphite-pro')
  await expect(page.getByTestId('settings-theme-current-id')).toContainText('graphite-pro')

  const presetSelect = page.getByTestId('settings-theme-preset-select')
  await presetSelect.selectOption('nordic-fog')
  await expect(page.getByTestId('settings-theme-current-id')).toContainText('nordic-fog')

  const exportNameInput = page.getByTestId('settings-theme-export-name')
  await exportNameInput.click()
  await exportNameInput.fill('')
  await exportNameInput.pressSequentially('  custom-glass  ')
  await exportNameInput.blur()
  await expect(exportNameInput).toHaveValue('custom-glass')

  await exportNameInput.fill('temporary-name')
  await exportNameInput.press('Escape')
  await expect(exportNameInput).toHaveValue('nordic-fog')

  const downloadPromise = page.waitForEvent('download')
  await exportNameInput.press('Enter')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('nordic-fog.json')

  const downloadPath = await download.path()
  expect(downloadPath).not.toBeNull()
  const exportedText = await readFile(downloadPath as string, 'utf-8')
  const exportedTheme = JSON.parse(exportedText) as {
    meta: { id: string; name: string }
    modules: {
      layout: {
        appShellBackground: string
      }
    }
  }

  exportedTheme.meta.id = 'rose-glass'
  exportedTheme.meta.name = 'Rose Glass'
  exportedTheme.modules.layout.appShellBackground =
    'linear-gradient(160deg, #ffe4e6 0%, #fecdd3 52%, #fda4af 100%)'

  await page.setInputFiles('[data-testid="settings-theme-import-input"]', {
    name: 'rose-glass.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exportedTheme, null, 2)),
  })

  await expect(page.getByTestId('settings-theme-import-message')).toContainText('主题已导入并应用')
  await expect(page.getByTestId('settings-theme-current-id')).toContainText('rose-glass')

  const importedShellBackground = await page.evaluate(() => {
    return document.documentElement.style
      .getPropertyValue('--theme-layout-app-shell-background')
      .trim()
  })
  expect(importedShellBackground).toContain('#fda4af')

  await page.reload()
  await expect(page).toHaveURL(/\/settings(?:\?.*)?$/)
  await page.getByTestId('settings-tab-themes').click()
  await expect(page.getByTestId('settings-theme-current-id')).toContainText('rose-glass')

  const resetButton = page.getByTestId('settings-theme-reset')
  await resetButton.focus()
  await page.keyboard.press('Enter')

  await expect(page.getByTestId('settings-theme-current-id')).toContainText('glass-gradient')

  delete (exportedTheme.modules as Record<string, unknown>).surface
  await page.setInputFiles('[data-testid="settings-theme-import-input"]', {
    name: 'broken-theme.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exportedTheme, null, 2)),
  })
  await expect(page.getByTestId('settings-theme-import-message')).toContainText(
    '缺少 surface 模块',
  )
})

test('themes tab can cycle all built-in presets and apply immediately', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('open-settings').click()
  await page.getByTestId('settings-tab-themes').click()

  const presetIds = [
    'glass-gradient',
    'nordic-fog',
    'graphite-pro',
    'tokyo-neon',
    'paper-ink',
    'forest-glass',
    'sunset-ui',
    'mono-minimal',
    'aurora-night',
  ]

  let previousShellBackground = ''
  let previousToolbarBackground = ''
  for (const presetId of presetIds) {
    await page.getByTestId('settings-theme-preset-select').selectOption(presetId)
    await expect(page.getByTestId('settings-theme-current-id')).toContainText(presetId)

    const appliedState = await page.evaluate(() => {
      const shell = document.querySelector('.app-shell')
      const shellBackground = shell ? getComputedStyle(shell).backgroundImage : ''
      return {
        themeId: document.documentElement.dataset.uiThemeId ?? '',
        shellBackground,
      }
    })

    expect(appliedState.themeId).toBe(presetId)
    expect(appliedState.shellBackground).not.toBe('')

    if (previousShellBackground) {
      expect(appliedState.shellBackground).not.toBe(previousShellBackground)
    }
    previousShellBackground = appliedState.shellBackground

    await page.getByTestId('toolbar-toggle').click()
    await expect(page.getByTestId('floating-toolbar')).toBeVisible()

    const toolbarBackground = await page.getByTestId('floating-toolbar').evaluate((node) => {
      return getComputedStyle(node as HTMLElement).backgroundImage
    })
    expect(toolbarBackground).not.toBe('')
    if (previousToolbarBackground) {
      expect(toolbarBackground).not.toBe(previousToolbarBackground)
    }
    previousToolbarBackground = toolbarBackground

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('floating-toolbar')).toHaveCount(0)
  }

  await page.reload()
  await expect(page).toHaveURL(/\/settings(?:\?.*)?$/)
  await page.getByTestId('settings-tab-themes').click()
  await expect(page.getByTestId('settings-theme-current-id')).toContainText('aurora-night')
})
