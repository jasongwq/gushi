import { test, expect } from '@playwright/test'

test('home page has review plan entry', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=复习计划')).toBeVisible({ timeout: 10000 })
})

test('review plan page shows today section with reason tags', async ({ page }) => {
  await page.goto('/#/review-plan')
  await expect(page.locator('h2')).toContainText('复习计划', { timeout: 10000 })
  await expect(page.locator('text=今天')).toBeVisible({ timeout: 10000 })
  // 有古诗数据时今天应有内容（未学的诗归今天，标签"新增学习"）
  await expect(page.locator('text=新增学习').first()).toBeVisible({ timeout: 10000 })
})

test('review plan page: calc tip toggles explanation', async ({ page }) => {
  await page.goto('/#/review-plan')
  await expect(page.locator('text=复习计划按以下规则计算')).not.toBeVisible()

  const tipIcon = page.locator('h2 span:has-text("!")')
  await tipIcon.click()
  await expect(page.locator('text=复习计划按以下规则计算')).toBeVisible()

  await tipIcon.click()
  await expect(page.locator('text=复习计划按以下规则计算')).not.toBeVisible()
})

test('review plan page: click poem navigates to detail', async ({ page }) => {
  await page.goto('/#/review-plan')

  // 展开今天并点击第一首
  await expect(page.locator('text=今天')).toBeVisible({ timeout: 10000 })
  const firstPoem = page.locator('div[class*="cursor-pointer"] span').filter({ hasText: /[一-龥]/ }).first()
  await expect(firstPoem).toBeVisible({ timeout: 10000 })
  await firstPoem.click()

  await expect(page.locator('text=掌握等级')).toBeVisible({ timeout: 5000 })
})

test('poem detail page: recite review button starts recitation', async ({ page }) => {
  // 直接访问详情页（hash 路由）。避免先访问首页再改 hash，
  // 防止 reload 竞态导致 hash 导航不生效。
  await page.goto('/#/poem/p001')
  await page.waitForLoadState('load')
  await expect(page.locator('h2')).toContainText('咏鹅', { timeout: 10000 })
  await expect(page.locator('button:has-text("背诵复习")')).toBeVisible({ timeout: 10000 })

  await page.locator('button:has-text("背诵复习")').click()

  // 进入背诵播放页，单首诗
  await expect(page.locator('text=第 1 / 1 首')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.recitation-card')).toBeVisible({ timeout: 5000 })
})
