import { expect, test } from '@playwright/test'

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
