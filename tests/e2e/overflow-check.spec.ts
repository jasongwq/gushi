import { test, expect, type Page } from '@playwright/test'

// Shared helper: find any visible element whose right edge exceeds the viewport
// and is NOT clipped by an ancestor with overflow:hidden/clip
async function findVisibleOverflow(page: Page): Promise<{ tag: string; class: string; right: number; width: number; id: string } | null> {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth
    const allElements = document.querySelectorAll('*')
    for (const el of allElements) {
      const rect = el.getBoundingClientRect()
      if (rect.right > viewportWidth + 1) {
        // Check if any ancestor clips this element
        let parent = el.parentElement
        let clipped = false
        while (parent) {
          const style = getComputedStyle(parent)
          const overflowX = style.overflowX
          const overflowY = style.overflow
          if ((overflowX === 'hidden' || overflowX === 'clip' || overflowY === 'hidden' || overflowY === 'clip') && parent.contains(el)) {
            const parentRect = parent.getBoundingClientRect()
            if (rect.right > parentRect.right + 1) {
              clipped = true
              break
            }
          }
          parent = parent.parentElement
        }
        if (!clipped) {
          return { tag: el.tagName, class: (el.className && typeof el.className === 'string') ? el.className.slice(0, 120) : '', right: Math.round(rect.right), width: viewportWidth, id: (el as HTMLElement).id || '' }
        }
      }
    }
    return null
  })
}

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

    const hasOverflow = await findVisibleOverflow(page)
    expect(hasOverflow).toBeNull()
  })

  test('detail page - no visible element exceeds viewport right', async ({ page }) => {
    await page.goto('/#/poem-card')
    await page.waitForTimeout(1000)

    await page.locator('.poem-card').first().evaluate((el: HTMLElement) => el.click())
    await page.waitForTimeout(500)

    const hasOverflow = await findVisibleOverflow(page)
    expect(hasOverflow).toBeNull()
  })
})

// ====== Mobile viewport tests (375x812, iPhone X) ======
// These test the same scenarios but with a narrow screen where the bug reproduces
test.describe('no horizontal overflow - mobile viewport (375x812)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('browse page - no visible element exceeds viewport right', async ({ page }) => {
    await page.goto('/#/poem-card')
    await page.waitForTimeout(1000)

    const hasOverflow = await findVisibleOverflow(page)
    expect(hasOverflow).toBeNull()
  })

  test('detail page - no visible element exceeds viewport right', async ({ page }) => {
    await page.goto('/#/poem-card')
    await page.waitForTimeout(1000)

    await page.locator('.poem-card').first().evaluate((el: HTMLElement) => el.click())
    await page.waitForTimeout(500)

    const hasOverflow = await findVisibleOverflow(page)
    expect(hasOverflow).toBeNull()
  })

  test('detail page with long poem - no visible element exceeds viewport right', async ({ page }) => {
    await page.goto('/#/poem-card')
    await page.waitForTimeout(1000)

    // Swipe through cards to find a long poem (将进酒 or similar)
    // Try clicking each card until we find one with many lines
    const cards = page.locator('.poem-card')
    const count = await cards.count()
    for (let i = 0; i < Math.min(count, 10); i++) {
      await cards.nth(i).evaluate((el: HTMLElement) => el.click())
      await page.waitForTimeout(300)

      const hasOverflow = await findVisibleOverflow(page)
      if (hasOverflow) {
        // Report which element overflows
        expect(hasOverflow).toBeNull()
      }

      // Go back to browse
      await page.locator('button', { hasText: '返回' }).first().click()
      await page.waitForTimeout(300)
    }
  })

  test('browse page - no horizontal scrollbar', async ({ page }) => {
    await page.goto('/#/poem-card')
    await page.waitForTimeout(1000)

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  test('detail page - no horizontal scrollbar', async ({ page }) => {
    await page.goto('/#/poem-card')
    await page.waitForTimeout(1000)

    await page.locator('.poem-card').first().evaluate((el: HTMLElement) => el.click())
    await page.waitForTimeout(500)

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  // ====== Deep diagnostic tests ======
  test('browse page - Swiper container and slides fit within viewport', async ({ page }) => {
    await page.goto('/#/poem-card')
    await page.waitForTimeout(1000)

    const diagnostics = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth
      const results: string[] = []

      // Check .poem-card-page container and its parent chain
      const pageEl = document.querySelector('.poem-card-page')
      if (pageEl) {
        const rect = pageEl.getBoundingClientRect()
        const style = getComputedStyle(pageEl)
        results.push(`poem-card-page: right=${rect.right}, width=${rect.width}, viewport=${viewportWidth}, maxW=${style.maxWidth}`)
        if (rect.right > viewportWidth + 1) {
          results.push('  → OVERFLOW: poem-card-page exceeds viewport')
        }
        // Check parent chain
        let parent = pageEl.parentElement
        let depth = 0
        while (parent && depth < 5) {
          const pRect = parent.getBoundingClientRect()
          const pStyle = getComputedStyle(parent)
          results.push(`  parent[${depth}] <${parent.tagName}>: right=${pRect.right}, width=${pRect.width}, overflow=${pStyle.overflow}, overflowX=${pStyle.overflowX}, display=${pStyle.display}`)
          parent = parent.parentElement
          depth++
        }
      }

      // Check .card-swiper
      const swiper = document.querySelector('.card-swiper')
      if (swiper) {
        const rect = swiper.getBoundingClientRect()
        results.push(`card-swiper: right=${rect.right}, width=${rect.width}`)
        if (rect.right > viewportWidth + 1) {
          results.push('  → OVERFLOW: card-swiper exceeds viewport')
        }
      }

      // Check .swiper (inner container)
      const swiperInner = document.querySelector('.swiper')
      if (swiperInner) {
        const rect = swiperInner.getBoundingClientRect()
        const style = getComputedStyle(swiperInner)
        results.push(`.swiper: right=${rect.right}, width=${rect.width}, overflow=${style.overflow}, overflowX=${style.overflowX}`)
        if (rect.right > viewportWidth + 1) {
          results.push('  → OVERFLOW: .swiper exceeds viewport')
        }
      }

      // Check .swiper-wrapper
      const wrapper = document.querySelector('.swiper-wrapper')
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect()
        const style = getComputedStyle(wrapper)
        results.push(`.swiper-wrapper: right=${rect.right}, width=${rect.width}, transform=${style.transform}`)
        if (rect.right > viewportWidth + 1) {
          results.push('  → OVERFLOW: .swiper-wrapper exceeds viewport')
        }
      }

      // Check all .swiper-slide elements
      const slides = document.querySelectorAll('.swiper-slide')
      slides.forEach((slide, i) => {
        const rect = slide.getBoundingClientRect()
        const style = getComputedStyle(slide)
        if (rect.right > viewportWidth + 1) {
          // Check if clipped by ancestor
          let parent = slide.parentElement
          let clipped = false
          while (parent) {
            const pStyle = getComputedStyle(parent)
            if ((pStyle.overflowX === 'hidden' || pStyle.overflowX === 'clip' || pStyle.overflow === 'hidden' || pStyle.overflow === 'clip') && parent.contains(slide)) {
              const pRect = parent.getBoundingClientRect()
              if (rect.right > pRect.right + 1) {
                clipped = true
                break
              }
            }
            parent = parent.parentElement
          }
          if (!clipped) {
            results.push(`.swiper-slide[${i}]: right=${rect.right}, width=${rect.width}, transform=${style.transform} → VISIBLE OVERFLOW`)
          }
        }
      })

      return results.join('\n')
    })

    // If any OVERFLOW lines found, fail the test
    if (diagnostics.includes('OVERFLOW')) {
      throw new Error(`Overflow detected:\n${diagnostics}`)
    }
  })

  test('detail page - RecitationCard content fits within viewport', async ({ page }) => {
    await page.goto('/#/poem-card')
    await page.waitForTimeout(1000)

    await page.locator('.poem-card').first().evaluate((el: HTMLElement) => el.click())
    await page.waitForTimeout(500)

    const diagnostics = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth
      const results: string[] = []

      // Check detail-layer
      const detailLayer = document.querySelector('.detail-layer')
      if (detailLayer) {
        const rect = detailLayer.getBoundingClientRect()
        results.push(`detail-layer: right=${rect.right}, width=${rect.width}`)
        if (rect.right > viewportWidth + 1) {
          results.push('  → OVERFLOW: detail-layer exceeds viewport')
        }
      }

      // Check recitation-card
      const recCard = document.querySelector('.recitation-card')
      if (recCard) {
        const rect = recCard.getBoundingClientRect()
        results.push(`recitation-card: right=${rect.right}, width=${rect.width}`)
        if (rect.right > viewportWidth + 1) {
          results.push('  → OVERFLOW: recitation-card exceeds viewport')
        }
      }

      // Check all visible text in detail page
      const textEls = document.querySelectorAll('.detail-layer *')
      textEls.forEach((el) => {
        const rect = el.getBoundingClientRect()
        if (rect.right > viewportWidth + 1 && rect.width > 0 && rect.height > 0) {
          const tag = el.tagName
          const text = el.textContent?.slice(0, 30) || ''
          // Check if clipped
          let parent = el.parentElement
          let clipped = false
          while (parent) {
            const pStyle = getComputedStyle(parent)
            if ((pStyle.overflowX === 'hidden' || pStyle.overflowX === 'clip' || pStyle.overflow === 'hidden' || pStyle.overflow === 'clip') && parent.contains(el)) {
              const pRect = parent.getBoundingClientRect()
              if (rect.right > pRect.right + 1) {
                clipped = true
                break
              }
            }
            parent = parent.parentElement
          }
          if (!clipped) {
            results.push(`${tag} "${text}": right=${rect.right} → VISIBLE OVERFLOW`)
          }
        }
      })

      return results.join('\n')
    })

    if (diagnostics.includes('OVERFLOW')) {
      throw new Error(`Overflow detected:\n${diagnostics}`)
    }
  })
})

// ====== Other pages - mobile viewport overflow check ======
test.describe('no horizontal overflow - other pages mobile (375x812)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  const pages = [
    { name: 'home', path: '/#/' },
    { name: 'poem-collection', path: '/#/poems' },
    { name: 'settings', path: '/#/settings' },
    { name: 'progress', path: '/#/progress' },
  ]

  for (const { name, path } of pages) {
    test(`${name} page has no horizontal scrollbar`, async ({ page }) => {
      await page.goto(path)
      await page.waitForTimeout(1000)

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })

    test(`${name} page - no visible element exceeds viewport right`, async ({ page }) => {
      await page.goto(path)
      await page.waitForTimeout(1000)

      const hasOverflow = await findVisibleOverflow(page)
      expect(hasOverflow).toBeNull()
    })
  }
})
