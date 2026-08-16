import { test, expect } from '@playwright/test'

test.describe('no horizontal overflow', () => {
  test('browse page has no horizontal scrollbar', async ({ page }) => {
    await page.goto('/#/poem-card')
    await page.waitForTimeout(1000)

    // Check that the document has no horizontal scrollbar
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  test('detail page has no horizontal scrollbar', async ({ page }) => {
    await page.goto('/#/poem-card')
    await page.waitForTimeout(1000)

    // Click the first poem card to enter detail using JS click
    await page.locator('.poem-card').first().evaluate((el: HTMLElement) => el.click())
    await page.waitForTimeout(500)

    // Check that the document has no horizontal scrollbar
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  test('browse page - no visible element exceeds viewport right', async ({ page }) => {
    await page.goto('/#/poem-card')
    await page.waitForTimeout(1000)

    // Check that no VISIBLE element exceeds the viewport right edge
    // (elements clipped by overflow:hidden are not considered overflow)
    const hasOverflow = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth
      const allElements = document.querySelectorAll('*')
      for (const el of allElements) {
        // Skip elements whose parent has overflow:hidden and clips them
        const rect = el.getBoundingClientRect()
        if (rect.right > viewportWidth + 1) {
          // Check if any ancestor clips this element
          let parent = el.parentElement
          let clipped = false
          while (parent) {
            const style = getComputedStyle(parent)
            if ((style.overflow === 'hidden' || style.overflowX === 'hidden') && parent.contains(el)) {
              const parentRect = parent.getBoundingClientRect()
              if (rect.right > parentRect.right + 1) {
                clipped = true
                break
              }
            }
            parent = parent.parentElement
          }
          if (!clipped) {
            return { tag: el.tagName, class: el.className, right: rect.right, width: viewportWidth }
          }
        }
      }
      return null
    })
    expect(hasOverflow).toBeNull()
  })

  test('detail page - no visible element exceeds viewport right', async ({ page }) => {
    await page.goto('/#/poem-card')
    await page.waitForTimeout(1000)

    // Click the first poem card to enter detail using JS click
    await page.locator('.poem-card').first().evaluate((el: HTMLElement) => el.click())
    await page.waitForTimeout(500)

    // Check that no VISIBLE element exceeds the viewport right edge
    const hasOverflow = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth
      const allElements = document.querySelectorAll('*')
      for (const el of allElements) {
        const rect = el.getBoundingClientRect()
        if (rect.right > viewportWidth + 1) {
          let parent = el.parentElement
          let clipped = false
          while (parent) {
            const style = getComputedStyle(parent)
            if ((style.overflow === 'hidden' || style.overflowX === 'hidden') && parent.contains(el)) {
              const parentRect = parent.getBoundingClientRect()
              if (rect.right > parentRect.right + 1) {
                clipped = true
                break
              }
            }
            parent = parent.parentElement
          }
          if (!clipped) {
            return { tag: el.tagName, class: el.className, right: rect.right, width: viewportWidth }
          }
        }
      }
      return null
    })
    expect(hasOverflow).toBeNull()
  })
})
