import { test, expect } from '@playwright/test'

test('progress page shows forgetting curve chart', async ({ page }) => {
  await page.goto('/#/progress')
  await expect(page.locator('h2')).toContainText('学习进度')
  await expect(page.locator('text=记忆保持率趋势')).toBeVisible({ timeout: 10000 })
  // Chart canvas should be present
  await expect(page.locator('canvas')).toBeVisible()
})

test('progress page shows clickable poem list', async ({ page }) => {
  await page.goto('/#/progress')
  await expect(page.locator('text=古诗列表')).toBeVisible({ timeout: 10000 })
  const poemItems = page.locator('[data-testid="poem-list-item"]')
  await expect(poemItems.first()).toBeVisible({ timeout: 10000 })
})

test('progress page: click poem navigates to detail', async ({ page }) => {
  await page.goto('/#/progress')

  await expect(page.locator('text=古诗列表')).toBeVisible({ timeout: 10000 })

  const poemItems = page.locator('[data-testid="poem-list-item"]')
  await expect(poemItems.first()).toBeVisible({ timeout: 10000 })
  await poemItems.first().click()

  await expect(page.locator('text=掌握等级')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('text=下次复习')).toBeVisible()
  await expect(page.locator('text=复习次数')).toBeVisible()
})

test('poem detail page shows all sections', async ({ page }) => {
  await page.goto('/#/progress')

  await expect(page.locator('text=古诗列表')).toBeVisible({ timeout: 10000 })
  const poemItems = page.locator('[data-testid="poem-list-item"]')
  await expect(poemItems.first()).toBeVisible({ timeout: 10000 })
  await poemItems.first().click()

  await expect(page.locator('text=遗忘曲线')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('text=原文')).toBeVisible()
  await expect(page.locator('text=返回')).toBeVisible()
})

test('poem detail page yiwen toggle shows and hides translation', async ({ page }) => {
  await page.goto('/#/progress')

  await expect(page.locator('text=古诗列表')).toBeVisible({ timeout: 10000 })
  const poemItems = page.locator('[data-testid="poem-list-item"]')
  await expect(poemItems.first()).toBeVisible({ timeout: 10000 })
  await poemItems.first().click()

  await expect(page.locator('text=原文')).toBeVisible({ timeout: 5000 })

  // 译文区块默认隐藏
  await expect(page.locator('h3:has-text("译文")')).not.toBeVisible()

  // 点击显示译文
  await page.locator('button:has-text("显示译文")').click()
  await expect(page.locator('h3:has-text("译文")')).toBeVisible()

  // 再次点击隐藏译文
  await page.locator('button:has-text("隐藏译文")').click()
  await expect(page.locator('h3:has-text("译文")')).not.toBeVisible()
})

test('poem detail page: back button returns to previous page', async ({ page }) => {
  await page.goto('/#/progress')

  await expect(page.locator('text=古诗列表')).toBeVisible({ timeout: 10000 })
  const poemItems = page.locator('[data-testid="poem-list-item"]')
  await expect(poemItems.first()).toBeVisible({ timeout: 10000 })
  await poemItems.first().click()

  await expect(page.locator('text=返回')).toBeVisible({ timeout: 5000 })
  await page.click('text=返回')

  await expect(page.locator('h2')).toContainText('学习进度')
})

test('poem detail page direct URL', async ({ page }) => {
  await page.goto('/#/poem/p001')
  // Should show either poem details or "古诗不存在"
  const body = page.locator('body')
  await expect(body).toBeVisible()
})

test('progress page: mastery tip toggle shows and hides explanation', async ({ page }) => {
  await page.goto('/#/progress')
  await expect(page.locator('text=掌握程度分布')).toBeVisible({ timeout: 10000 })

  // Tip should be hidden initially
  await expect(page.locator('text=掌握程度分为四个等级')).not.toBeVisible()

  // Click the ! icon to show tip
  const tipIcons = page.locator('span:has-text("!")')
  await tipIcons.first().click()
  await expect(page.locator('text=掌握程度分为四个等级')).toBeVisible()

  // Click again to hide tip
  await tipIcons.first().click()
  await expect(page.locator('text=掌握程度分为四个等级')).not.toBeVisible()
})

test('progress page: retention tip toggle shows and hides explanation', async ({ page }) => {
  await page.goto('/#/progress')
  await expect(page.locator('text=记忆保持率趋势')).toBeVisible({ timeout: 10000 })

  // Tip should be hidden initially
  await expect(page.locator('text=记忆保持率基于艾宾浩斯遗忘曲线')).not.toBeVisible()

  // Click the ! icon next to retention chart to show tip
  const tipIcons = page.locator('span:has-text("!")')
  await tipIcons.nth(1).click()
  await expect(page.locator('text=记忆保持率基于艾宾浩斯遗忘曲线')).toBeVisible()

  // Click again to hide tip
  await tipIcons.nth(1).click()
  await expect(page.locator('text=记忆保持率基于艾宾浩斯遗忘曲线')).not.toBeVisible()
})

test('progress page: page is scrollable', async ({ page }) => {
  await page.goto('/#/progress')
  await expect(page.locator('h2')).toContainText('学习进度')

  // The router-view container should have overflow-y-auto for scrolling
  const routerView = page.locator('.overflow-y-auto').first()
  await expect(routerView).toBeVisible()
})
