import { test, expect } from '@playwright/test'

// 辅助：进入古诗卡片页面并等待加载
async function enterPoemCardPage(page: any) {
  await page.goto('/#/poem-card')
  await expect(page.locator('.poem-card-page').first()).toBeVisible({ timeout: 5000 })
}

// 辅助：点击第一张卡片进入背诵模式
async function enterReciteFromSwiper(page: any) {
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 5000 })
  await page.locator('.poem-card').first().click()
  // 应该看到 RecitationCard
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })
}

// 辅助：在元素上模拟水平拖拽
async function horizontalDrag(page: any, box: { x: number; y: number; width: number; height: number }, direction: 'left' | 'right' = 'left') {
  const startX = direction === 'left' ? box.x + box.width * 0.7 : box.x + box.width * 0.3
  const startY = box.y + box.height / 2
  const endX = direction === 'left' ? box.x + box.width * 0.2 : box.x + box.width * 0.8

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) {
    const x = startX + (endX - startX) * (i / 20)
    await page.mouse.move(x, startY)
  }
  await page.mouse.up()
}

test('click card expands to recite mode', async ({ page }) => {
  await enterPoemCardPage(page)
  await enterReciteFromSwiper(page)

  // 进度应该显示
  const progressText = page.locator('[data-testid="detail-progress"]')
  await expect(progressText).toBeVisible({ timeout: 3000 })
})

test('click back button collapses to browse mode', async ({ page }) => {
  await enterPoemCardPage(page)
  await enterReciteFromSwiper(page)

  // 点击返回按钮
  await page.locator('button:has-text("返回")').first().click()

  // 应该回到浏览模式，看到 PoemCard
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 3000 })
})

test('submit result advances to next poem', async ({ page }) => {
  await enterPoemCardPage(page)
  await enterReciteFromSwiper(page)

  // 标记熟练
  await page.locator('.recitation-card button:has-text("熟练")').click()

  // 应该自动进入下一首
  const progressText = page.locator('[data-testid="detail-progress"]')
  await expect(progressText).not.toHaveText('1/', { timeout: 3000 })
})

test('swipe collapses expanded card back to browse mode', async ({ page }) => {
  await enterPoemCardPage(page)
  await enterReciteFromSwiper(page)

  // 在 Swiper 上模拟水平拖拽
  const swiperBox = await page.locator('.card-swiper').first().boundingBox()
  expect(swiperBox).toBeTruthy()

  await horizontalDrag(page, swiperBox!, 'left')

  // 滑动后应该缩回，看到 PoemCard
  await page.waitForTimeout(500)
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 3000 })
})

test('swipe to new card does not auto-expand', async ({ page }) => {
  await enterPoemCardPage(page)

  // 滑动到下一首（不先展开）
  const swiperBox = await page.locator('.card-swiper').first().boundingBox()
  expect(swiperBox).toBeTruthy()

  await horizontalDrag(page, swiperBox!, 'left')
  await page.waitForTimeout(500)

  // 应该看到 PoemCard 而不是 RecitationCard
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 3000 })
})
