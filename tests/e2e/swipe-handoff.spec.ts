import { test, expect } from '@playwright/test'

// 辅助：进入滑动卡片页面并点击第一张卡片进入详情
async function enterDetailFromSwiper(page: any) {
  await page.goto('/#/poem-card')
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 5000 })
  await page.locator('.poem-card').first().evaluate((el: HTMLElement) => el.click())
  await expect(page.locator('.detail-layer')).toBeVisible({ timeout: 3000 })
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

test('swipe left on detail layer returns to browse layer', async ({ page }) => {
  await enterDetailFromSwiper(page)

  const box = await page.locator('.detail-layer').boundingBox()
  expect(box).toBeTruthy()
  await horizontalDrag(page, box!, 'left')

  await expect(page.locator('.detail-layer')).not.toBeVisible({ timeout: 2000 })
})

test('swipe right on detail layer returns to browse layer', async ({ page }) => {
  await enterDetailFromSwiper(page)

  const box = await page.locator('.detail-layer').boundingBox()
  expect(box).toBeTruthy()
  await horizontalDrag(page, box!, 'right')

  await expect(page.locator('.detail-layer')).not.toBeVisible({ timeout: 2000 })
})

test('after swipe back, swiper is still visible and functional', async ({ page }) => {
  await enterDetailFromSwiper(page)

  const box = await page.locator('.detail-layer').boundingBox()
  expect(box).toBeTruthy()
  await horizontalDrag(page, box!, 'left')

  await expect(page.locator('.detail-layer')).not.toBeVisible({ timeout: 2000 })
  await expect(page.locator('.card-swiper').first()).toBeVisible({ timeout: 2000 })

  // 在 Swiper 上拖拽切换卡片
  const swiperBox = await page.locator('.card-swiper').first().boundingBox()
  expect(swiperBox).toBeTruthy()
  await horizontalDrag(page, swiperBox!, 'left')

  await page.waitForTimeout(500)
  await expect(page.locator('.card-swiper').first()).toBeVisible()
})
