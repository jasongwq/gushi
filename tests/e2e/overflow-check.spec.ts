import { test, expect } from '@playwright/test'

test.describe('poem card page - no horizontal overflow', () => {
  test('browse page has no horizontal overflow', async ({ page }) => {
    await page.goto('/#/poem-card')
    await page.waitForTimeout(1000) // wait for poems to load

    // Check that no element exceeds the viewport width
    const hasOverflow = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*')
      const viewportWidth = document.documentElement.clientWidth
      for (const el of allElements) {
        const rect = el.getBoundingClientRect()
        if (rect.right > viewportWidth + 1) {
          return { tag: el.tagName, class: el.className, right: rect.right, width: viewportWidth, id: el.id }
        }
      }
      return null
    })
    expect(hasOverflow).toBeNull()
  })

  test('detail page has no horizontal overflow', async ({ page }) => {
    await page.goto('/#/poem-card')
    await page.waitForTimeout(1000)

    // Click the first poem card to enter detail
    const card = page.locator('.poem-card').first()
    if (await card.isVisible()) {
      await card.click()
      await page.waitForTimeout(500)

      // Check that no element exceeds the viewport width
      const hasOverflow = await page.evaluate(() => {
        const allElements = document.querySelectorAll('*')
        const viewportWidth = document.documentElement.clientWidth
        for (const el of allElements) {
          const rect = el.getBoundingClientRect()
          if (rect.right > viewportWidth + 1) {
            return { tag: el.tagName, class: el.className, right: rect.right, width: viewportWidth, id: el.id }
          }
        }
        return null
      })
      expect(hasOverflow).toBeNull()
    }
  })
})
