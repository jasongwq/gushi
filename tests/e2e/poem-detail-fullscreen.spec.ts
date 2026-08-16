import { test, expect } from '@playwright/test'

// 辅助：进入古诗卡片页面并等待加载
async function enterPoemCardPage(page: any) {
  await page.goto('/#/poem-card')
  await expect(page.locator('.poem-card-page').first()).toBeVisible({ timeout: 5000 })
}

// 辅助：点击第一张卡片进入背诵模式
// 使用 dispatchEvent 绕过 Swiper coverflow 布局层对 pointer events 的拦截
async function enterReciteFromSwiper(page: any) {
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 5000 })
  await page.locator('.poem-card').first().dispatchEvent('click')
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })
}

// 辅助：获取 active slide 的布局信息
async function getActiveSlideInfo(page: any) {
  return await page.evaluate(() => {
    const slide = document.querySelector('.swiper-slide-active') as HTMLElement
    if (!slide) return null
    const rect = slide.getBoundingClientRect()
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      offsetWidth: slide.offsetWidth,
    }
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

test('浏览模式 slide 为 65% 宽度（coverflow）', async ({ page }) => {
  await enterPoemCardPage(page)

  const containerWidth = await getSwiperContainerWidth(page)
  const browse = await getActiveSlideInfo(page)
  expect(browse).toBeTruthy()
  const b = browse!
  expect(b.width).toBeGreaterThan(0)
  // 浏览模式下 slide 宽度约为容器的 65%
  expect(b.width / containerWidth).toBeLessThan(0.8)

  // Swiper 有 coverflow 类
  const hasCoverflow = await page.evaluate(() => {
    const el = document.querySelector('.card-swiper')
    return el?.classList.contains('swiper-coverflow') ?? false
  })
  expect(hasCoverflow).toBe(true)
})

test('点击卡片后 slide 真正全屏（宽度 100%、覆盖容器）', async ({ page }) => {
  await enterPoemCardPage(page)

  const containerWidth = await getSwiperContainerWidth(page)
  const browse = await getActiveSlideInfo(page)
  expect(browse.width / containerWidth).toBeLessThan(0.8)

  // 点击进入背诵
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  // 展开后 slide 宽度应等于容器宽度（100%）
  const expanded = await getActiveSlideInfo(page)
  expect(expanded.width / containerWidth).toBeGreaterThan(0.9)

  // slide 左边缘与容器对齐，右边缘超出容器（因为 loop 复制了很多 slide）
  // 关键：active slide 的宽度 = 容器宽度 = 全屏
  expect(Math.abs(expanded.width - containerWidth)).toBeLessThan(2)
})

test('点击卡片后 RecitationCard 在 viewport 内且全宽', async ({ page }) => {
  await enterPoemCardPage(page)

  // 点击进入背诵
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  // 获取 active slide 内的 RecitationCard 位置
  const info = await page.evaluate(() => {
    const activeSlide = document.querySelector('.swiper-slide-active')
    const recCard = activeSlide?.querySelector('.recitation-card')
    if (!recCard) return null
    const slideRect = activeSlide!.getBoundingClientRect()
    const recRect = recCard.getBoundingClientRect()
    return {
      viewportWidth: document.documentElement.clientWidth,
      slideLeft: slideRect.left,
      slideRight: slideRect.right,
      slideWidth: slideRect.width,
      recLeft: recRect.left,
      recRight: recRect.right,
      recWidth: recRect.width,
    }
  })
  expect(info).toBeTruthy()
  const i = info!

  // RecitationCard 与 active slide 位置一致（全屏，不偏出）
  expect(Math.abs(i.recLeft - i.slideLeft)).toBeLessThan(2)
  expect(Math.abs(i.recRight - i.slideRight)).toBeLessThan(2)
  // RecitationCard 宽度 = slide 宽度 = 容器全宽
  expect(Math.abs(i.recWidth - i.slideWidth)).toBeLessThan(2)
})

test('点击卡片后 Swiper 重建为 slide 效果（无 coverflow 类）', async ({ page }) => {
  await enterPoemCardPage(page)

  // 点击进入背诵
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  const classes = await page.evaluate(() => {
    const el = document.querySelector('.card-swiper')
    return el ? [...el.classList] : []
  })

  // 背诵模式：不应再有 coverflow/3d 类，应有 is-fullscreen
  expect(classes.some(c => c.includes('coverflow'))).toBe(false)
  expect(classes.includes('is-fullscreen')).toBe(true)
})

test('点击卡片后 Swiper 触摸被禁用', async ({ page }) => {
  await enterPoemCardPage(page)

  // 初始 allowTouchMove 为 true（coverflow 浏览模式）
  const touchBefore = await page.evaluate(() => {
    const swiper = (document.querySelector('.swiper') as any)?.swiper
    return swiper?.allowTouchMove
  })
  expect(touchBefore).toBe(true)

  // 点击进入背诵
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  // 展开后 allowTouchMove 应为 false（背诵模式禁止滑动干扰按钮）
  const touchAfter = await page.evaluate(() => {
    const swiper = (document.querySelector('.swiper') as any)?.swiper
    return swiper?.allowTouchMove
  })
  expect(touchAfter).toBe(false)
})

test('点击返回按钮缩回到浏览模式（宽度恢复 65%、coverflow 恢复）', async ({ page }) => {
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
  const browse = await getActiveSlideInfo(page)
  expect(browse.width / containerWidth).toBeLessThan(0.8)

  // coverflow 类恢复
  const classes = await page.evaluate(() => {
    const el = document.querySelector('.card-swiper')
    return el ? [...el.classList] : []
  })
  expect(classes.some(c => c.includes('coverflow'))).toBe(true)
  expect(classes.includes('is-fullscreen')).toBe(false)
})

test('展开-缩回-再展开循环正常', async ({ page }) => {
  await enterPoemCardPage(page)

  const containerWidth = await getSwiperContainerWidth(page)

  // 第一次展开
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  let expanded = await getActiveSlideInfo(page)
  expect(expanded.width / containerWidth).toBeGreaterThan(0.9)

  // 缩回（使用更精确的选择器）
  await page.locator('[data-testid="detail-progress"]').locator('..').locator('button:has-text("返回")').dispatchEvent('click')
  await page.waitForTimeout(500)

  // 等待 PoemCard 可见
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 3000 })

  // 再次展开
  await page.locator('.poem-card').first().dispatchEvent('click')
  await page.waitForTimeout(500)
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })

  expanded = await getActiveSlideInfo(page)
  expect(expanded.width / containerWidth).toBeGreaterThan(0.9)
})
