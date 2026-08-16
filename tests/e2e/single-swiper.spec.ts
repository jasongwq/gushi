import { test, expect } from '@playwright/test'

// 辅助：进入古诗卡片页面并等待加载
async function enterPoemCardPage(page: any) {
  await page.goto('/#/poem-card')
  await expect(page.locator('.poem-card-page').first()).toBeVisible({ timeout: 5000 })
}

// 辅助：点击第一张卡片进入背诵模式（使用 force: true 绕过 Swiper 布局层拦截）
async function enterReciteFromSwiper(page: any) {
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 5000 })
  await page.locator('.poem-card').first().click({ force: true })
  // 应该看到 RecitationCard
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })
}

// 辅助：获取当前活跃 slide 的宽度
async function getSlideWidth(page: any): Promise<number> {
  const slideWidth = await page.evaluate(() => {
    const slide = document.querySelector('.swiper-slide-active') as HTMLElement
    return slide?.offsetWidth ?? 0
  })
  return slideWidth
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

// ====== 核心功能：展开/缩回 ======

test('点击卡片展开到全屏背诵模式', async ({ page }) => {
  await enterPoemCardPage(page)

  // 获取浏览模式下的 slide 宽度（应该是 65%）
  const browseWidth = await getSlideWidth(page)
  expect(browseWidth).toBeGreaterThan(0)

  // 点击卡片进入背诵
  await enterReciteFromSwiper(page)

  // 验证展开后 slide 宽度变大（接近 100%）
  const expandedWidth = await getSlideWidth(page)
  expect(expandedWidth).toBeGreaterThan(browseWidth)
  // 展开后宽度应该接近容器宽度（至少比浏览模式大 30%）
  expect(expandedWidth / browseWidth).toBeGreaterThan(1.3)
})

test('点击返回按钮缩回到浏览模式', async ({ page }) => {
  await enterPoemCardPage(page)
  await enterReciteFromSwiper(page)

  // 点击返回按钮
  await page.locator('button:has-text("返回")').first().click()

  // 应该回到浏览模式，看到 PoemCard
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 3000 })
  // 不应该有 RecitationCard
  await expect(page.locator('.recitation-card')).not.toBeVisible({ timeout: 1000 })
})

test('提交后自动进入下一首', async ({ page }) => {
  await enterPoemCardPage(page)
  await enterReciteFromSwiper(page)

  // 记录当前进度
  const progressBefore = await page.locator('[data-testid="detail-progress"]').textContent()

  // 标记熟练
  await page.locator('.recitation-card button:has-text("熟练")').click({ force: true })

  // 应该自动进入下一首（进度变化）
  const progressAfter = await page.locator('[data-testid="detail-progress"]').textContent({ timeout: 3000 })
  expect(progressAfter).not.toBe(progressBefore)
})

test('滑动时缩回展开的卡片', async ({ page }) => {
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

test('滑动到新卡片后不自动展开', async ({ page }) => {
  await enterPoemCardPage(page)

  // 滑动到下一首（不先展开）
  const swiperBox = await page.locator('.card-swiper').first().boundingBox()
  expect(swiperBox).toBeTruthy()

  await horizontalDrag(page, swiperBox!, 'left')
  await page.waitForTimeout(500)

  // 应该看到 PoemCard 而不是 RecitationCard
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 3000 })
  // RecitationCard 不应该可见（没有自动展开）
  await expect(page.locator('.recitation-card')).not.toBeVisible({ timeout: 1000 })
})

test('背诵模式显示进度信息', async ({ page }) => {
  await enterPoemCardPage(page)
  await enterReciteFromSwiper(page)

  // 进度应该显示
  const progressText = page.locator('[data-testid="detail-progress"]')
  await expect(progressText).toBeVisible({ timeout: 3000 })
  // 进度格式应该是 X/Y
  const text = await progressText.textContent()
  expect(text).toMatch(/\d+\/\d+/)
})

test('已查计数在提交后更新', async ({ page }) => {
  await enterPoemCardPage(page)

  // 初始已查 0 首
  await expect(page.locator('text=已查 0')).toBeVisible({ timeout: 5000 })

  // 进入背诵并提交
  await enterReciteFromSwiper(page)
  await page.locator('.recitation-card button:has-text("熟练")').click({ force: true })

  // 等待提交完成后检查
  await page.waitForTimeout(500)
  await expect(page.locator('text=已查 1')).toBeVisible({ timeout: 3000 })
})

test('来源筛选按钮可切换', async ({ page }) => {
  await enterPoemCardPage(page)

  // 默认"全部"应该可见
  await expect(page.locator('button:has-text("全部")').first()).toBeVisible()

  // 点击"智能混合"
  await page.locator('button:has-text("智能混合")').first().click()
  // 应该仍然显示 PoemCard
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 3000 })
})
