import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('settings page shows supported languages tab and list', async ({ page }) => {
  await page.goto('/')

  await page.getByTestId('open-settings').click()
  await expect(page.getByTestId('settings-view')).toBeVisible()

  await expect(page.getByTestId('settings-panel-languages')).toBeVisible()
  const languageCount = await page.getByTestId('settings-language-item').count()
  expect(languageCount).toBeGreaterThanOrEqual(100)

  await page.getByTestId('settings-tab-general').click()
  await expect(page.getByTestId('settings-panel-general')).toBeVisible()

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
  await expect(page.getByTestId('open-settings')).toBeVisible()
})

test('settings general tab supports theme import/export and keyboard flows', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('open-settings').click()
  await page.getByTestId('settings-tab-general').click()

  await expect(page.getByTestId('settings-theme-panel')).toBeVisible()
  await expect(page.getByTestId('settings-theme-current-id')).toContainText('glass-gradient')

  await expect(page.getByTestId('settings-theme-preset-select')).toBeVisible()
  await page.getByTestId('settings-theme-preset-select').selectOption('graphite-pro')
  await page.getByTestId('settings-theme-apply-preset').click()
  await expect(page.getByTestId('settings-theme-current-id')).toContainText('graphite-pro')

  await page.getByTestId('settings-theme-preset-select').selectOption('nordic-fog')
  await page.getByTestId('settings-theme-apply-preset').focus()
  await page.keyboard.press('Enter')
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
  await page.getByTestId('open-settings').click()
  await page.getByTestId('settings-tab-general').click()
  await expect(page.getByTestId('settings-theme-current-id')).toContainText('rose-glass')

  const resetButton = page.getByTestId('settings-theme-reset')
  await resetButton.focus()
  await page.keyboard.press('Enter')

  await expect(page.getByTestId('settings-theme-current-id')).toContainText('glass-gradient')
})
