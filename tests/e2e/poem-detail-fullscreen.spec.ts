import { test, expect } from '@playwright/test'

// 辅助：进入古诗卡片页面并等待加载
async function enterPoemCardPage(page: any) {
  await page.goto('/#/poem-card')
  await expect(page.locator('.poem-card-page').first()).toBeVisible({ timeout: 5000 })
}

// 辅助：点击第一张卡片进入背诵模式
async function enterReciteFromSwiper(page: any) {
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 5000 })
  await page.locator('.poem-card').first().dispatchEvent('click')
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })
}

// 辅助：获取当前活跃 slide 的宽度
async function getActiveSlideWidth(page: any): Promise<number> {
  return await page.evaluate(() => {
    const slide = document.querySelector('.swiper-slide-active') as HTMLElement
    return slide?.offsetWidth ?? 0
  })
}

// 辅助：获取 Swiper 容器宽度
async function getSwiperContainerWidth(page: any): Promise<number> {
  return await page.evaluate(() => {
    const swiper = document.querySelector('.swiper') as HTMLElement
    return swiper?.offsetWidth ?? 0
  })
}

// ====== 核心功能：点击展开全屏 ======

test('点击卡片后 slide 宽度变为全屏', async ({ page }) => {
  await enterPoemCardPage(page)

  const containerWidth = await getSwiperContainerWidth(page)
  const browseWidth = await getActiveSlideWidth(page)
  expect(browseWidth).toBeGreaterThan(0)
  // 浏览模式下 slide 宽度应该约为容器的 65%
  expect(browseWidth / containerWidth).toBeLessThan(0.8)

  // 点击进入背诵
  await enterReciteFromSwiper(page)

  // 等待 transition 完成
  await page.waitForTimeout(500)

  // 展开后 slide 宽度应该接近容器宽度（100%）
  const expandedWidth = await getActiveSlideWidth(page)
  expect(expandedWidth).toBeGreaterThan(browseWidth)
  // 展开后应该接近全屏（至少 90% 的容器宽度）
  expect(expandedWidth / containerWidth).toBeGreaterThan(0.9)
})

test('点击卡片后 Swiper 效果切换为 slide', async ({ page }) => {
  await enterPoemCardPage(page)

  // 初始是 coverflow 效果
  const effectBefore = await page.evaluate(() => {
    const swiper = (document.querySelector('.swiper') as any)?.swiper
    return swiper?.params?.effect
  })
  expect(effectBefore).toBe('coverflow')

  // 点击进入背诵
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  // 展开后应该是 slide 效果
  const effectAfter = await page.evaluate(() => {
    const swiper = (document.querySelector('.swiper') as any)?.swiper
    return swiper?.params?.effect
  })
  expect(effectAfter).toBe('slide')
})

test('点击卡片后 Swiper 触摸被禁用', async ({ page }) => {
  await enterPoemCardPage(page)

  // 初始 allowTouchMove 为 true
  const touchBefore = await page.evaluate(() => {
    const swiper = (document.querySelector('.swiper') as any)?.swiper
    return swiper?.allowTouchMove
  })
  expect(touchBefore).toBe(true)

  // 点击进入背诵
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  // 展开后 allowTouchMove 应为 false
  const touchAfter = await page.evaluate(() => {
    const swiper = (document.querySelector('.swiper') as any)?.swiper
    return swiper?.allowTouchMove
  })
  expect(touchAfter).toBe(false)
})

test('点击卡片后 coverflow transform 被覆盖', async ({ page }) => {
  await enterPoemCardPage(page)

  // 点击进入背诵
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  // 活跃 slide 的 transform 应该是 none 或接近 none
  const transformResult = await page.evaluate(() => {
    const slide = document.querySelector('.swiper-slide-active') as HTMLElement
    if (!slide) return null
    const computed = window.getComputedStyle(slide)
    const transform = computed.transform
    // 检查是否是 identity matrix 或 none
    return {
      computedTransform: transform,
      styleTransform: slide.style.transform,
    }
  })

  // transform 应该是 none 或 identity（不是 coverflow 的 translate3d）
  expect(transformResult?.computedTransform).toMatch(/^(none|matrix\(1,?\s*0,?\s*0,?\s*1,?\s*0,?\s*0\)|matrix3d\(1,?\s*0)/)
})

test('展开后 RecitationCard 可见', async ({ page }) => {
  await enterPoemCardPage(page)

  // 点击进入背诵
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  // RecitationCard 应该可见
  await expect(page.locator('.recitation-card').first()).toBeVisible()
})

test('点击返回按钮缩回到浏览模式（宽度恢复 65%）', async ({ page }) => {
  await enterPoemCardPage(page)
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  const containerWidth = await getSwiperContainerWidth(page)

  // 点击返回按钮（使用更精确的选择器，避免匹配顶部导航的"← 返回"）
  await page.locator('[data-testid="detail-progress"]').locator('..').locator('button:has-text("返回")').dispatchEvent('click')
  await page.waitForTimeout(500)

  // 应该回到浏览模式 - PoemCard 可见
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 3000 })

  // 宽度应该恢复为 65%
  const browseWidth = await getActiveSlideWidth(page)
  expect(browseWidth / containerWidth).toBeLessThan(0.8)

  // Swiper 效果应该恢复为 coverflow
  const effectAfter = await page.evaluate(() => {
    const swiper = (document.querySelector('.swiper') as any)?.swiper
    return swiper?.params?.effect
  })
  expect(effectAfter).toBe('coverflow')
})

test('展开-缩回-再展开循环正常', async ({ page }) => {
  await enterPoemCardPage(page)

  const containerWidth = await getSwiperContainerWidth(page)

  // 第一次展开
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  let expandedWidth = await getActiveSlideWidth(page)
  expect(expandedWidth / containerWidth).toBeGreaterThan(0.9)

  // 缩回（使用更精确的选择器）
  await page.locator('[data-testid="detail-progress"]').locator('..').locator('button:has-text("返回")').dispatchEvent('click')
  await page.waitForTimeout(500)

  // 等待 PoemCard 可见
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 3000 })

  // 再次展开
  await page.locator('.poem-card').first().dispatchEvent('click')
  await page.waitForTimeout(500)
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })

  expandedWidth = await getActiveSlideWidth(page)
  expect(expandedWidth / containerWidth).toBeGreaterThan(0.9)
})
