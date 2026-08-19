import { test, expect } from '@playwright/test'

test('home page has review plan entry', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=复习计划')).toBeVisible({ timeout: 10000 })
})

test('review plan page shows today section with schedule', async ({ page }) => {
  await page.goto('/#/review-plan')
  await expect(page.locator('h2')).toContainText('复习计划', { timeout: 10000 })
  await expect(page.locator('text=今天')).toBeVisible({ timeout: 10000 })
  // 首次进入自动生成排程 → 今天有"新增学习"的诗（默认每天3首）
  await expect(page.locator('text=新增学习').first()).toBeVisible({ timeout: 10000 })
})

test('review plan page: pace selector and rebuild', async ({ page }) => {
  await page.goto('/#/review-plan')
  await expect(page.locator('select')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('button:has-text("重排")')).toBeVisible()

  // 切换节奏到"每天 1 首"并重排
  await page.selectOption('select', '1')
  await page.click('button:has-text("重排")')

  // 今天区块仍在（每天1首 → 今天1首）
  await expect(page.locator('text=今天')).toBeVisible({ timeout: 5000 })
})

test('review plan page: not-learned section shows scheduled and unscheduled', async ({ page }) => {
  await page.goto('/#/review-plan')
  // 未学区块 header（正则匹配计数文本）
  const notLearnedHeader = page.locator('text=/未学（\\d+ 首）/')
  await expect(notLearnedHeader).toBeVisible({ timeout: 10000 })
  // 点击 header 的父级（带 @click 的 div）
  await notLearnedHeader.locator('xpath=ancestor::div[contains(@class,"cursor-pointer")]').first().click()
  // 200 首诗，默认每天3首排程 30 天后仍有 110 首排到 30 天后
  await expect(page.locator('text=已排期（30 天后）').first()).toBeVisible({ timeout: 5000 })
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

test('poem detail page: complete single-poem recitation to result page', async ({ page }) => {
  await page.goto('/#/poem/p001')
  await page.waitForLoadState('load')
  await expect(page.locator('button:has-text("背诵复习")')).toBeVisible({ timeout: 10000 })

  await page.locator('button:has-text("背诵复习")').click()

  // 背诵：标记熟练
  await expect(page.locator('button:has-text("熟练")')).toBeVisible({ timeout: 5000 })
  await page.locator('button:has-text("熟练")').click()

  // 单首完成 → 结果页
  await expect(page.locator('h2')).toContainText('抽背结果', { timeout: 5000 })
  await expect(page.locator('text=再来一轮')).toBeVisible()
  await expect(page.locator('text=返回首页')).toBeVisible()
})
