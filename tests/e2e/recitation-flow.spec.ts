import { test, expect } from '@playwright/test'

test('navigate to recitation setup from home', async ({ page }) => {
  await page.goto('/')
  await page.click('text=古诗抽背')
  await expect(page.locator('h2')).toContainText('抽背设置')
})

test('recitation setup page shows source and count options', async ({ page }) => {
  await page.goto('/#/recitation/setup')
  await expect(page.locator('h2')).toContainText('抽背设置')
  await expect(page.locator('select')).toBeVisible()
  await expect(page.locator('text=5 首')).toBeVisible()
  await expect(page.locator('text=开始抽背')).toBeVisible()
})

test('recitation setup requires grade selection for grade source', async ({ page }) => {
  await page.goto('/#/recitation/setup')
  await page.selectOption('select', 'grade')
  // Start button should be disabled without grade selection
  await expect(page.locator('button:has-text("开始抽背")')).toBeDisabled()
})

test('recitation setup enables start after selecting grade', async ({ page }) => {
  await page.goto('/#/recitation/setup')
  await page.selectOption('select', 'grade')
  // Click a grade button in the grade selector section
  const gradeBtn = page.locator('section button').filter({ hasText: '年级' }).first()
  await gradeBtn.click()
  await expect(page.locator('button:has-text("开始抽背")')).toBeEnabled()
})

// Helper: start recitation with "all" source to ensure poems are available
async function startRecitationWithAll(page: any) {
  await page.goto('/#/recitation/setup')
  await page.selectOption('select', 'all')
  await page.click('text=5 首')
  await page.click('text=开始抽背')
}

test('recitation play page shows poem title and judgment buttons', async ({ page }) => {
  await startRecitationWithAll(page)

  // Should be on play page with judgment buttons
  await expect(page.locator('button:has-text("整首熟练")')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('button:has-text("有不熟练")')).toBeVisible()
  await expect(page.locator('button:has-text("标记作者")')).toBeVisible()
  await expect(page.locator('button:has-text("标记朝代")')).toBeVisible()
  // Next button should be disabled before judgment
  await expect(page.locator('button:has-text("下一首")')).toBeDisabled()
})

test('recitation flow: mark mastered and advance', async ({ page }) => {
  await startRecitationWithAll(page)

  // Wait for first poem
  await expect(page.locator('button:has-text("整首熟练")')).toBeVisible({ timeout: 5000 })

  // Mark as mastered
  await page.locator('button:has-text("整首熟练")').click()

  // Next button should now be enabled
  await expect(page.locator('button:has-text("下一首")')).toBeEnabled()

  // Click next
  await page.click('text=下一首')

  // Should show progress for second poem
  await expect(page.locator('text=第 2 / 5 首')).toBeVisible({ timeout: 5000 })
})

test('recitation flow: mark not mastered and judge lines', async ({ page }) => {
  await startRecitationWithAll(page)

  // Wait for first poem
  await expect(page.locator('button:has-text("整首熟练")')).toBeVisible({ timeout: 5000 })

  // Mark as not mastered
  await page.locator('button:has-text("有不熟练")').click()

  // Lines should be visible with judgment buttons
  await expect(page.locator('.recitation-card').locator('button:has-text("✓")').first()).toBeVisible()

  // Mark author and dynasty
  await page.click('text=标记作者')
  await page.click('text=标记朝代')

  // Author/dynasty correct/wrong buttons should appear
  await expect(page.locator('text=作者').first()).toBeVisible()

  // Click next to submit
  await page.click('text=下一首')
})

test('recitation flow: complete all poems and see results', async ({ page }) => {
  await startRecitationWithAll(page)

  // Complete 5 poems - mark all as mastered
  for (let i = 0; i < 5; i++) {
    await expect(page.locator('button:has-text("整首熟练")')).toBeVisible({ timeout: 5000 })
    await page.locator('button:has-text("整首熟练")').click()
    await page.click('text=下一首')
  }

  // Should be on results page
  await expect(page.locator('h2')).toContainText('抽背结果')
  await expect(page.locator('text=熟练').first()).toBeVisible()
  await expect(page.locator('text=不熟练').first()).toBeVisible()
  await expect(page.locator('text=再来一轮')).toBeVisible()
  await expect(page.locator('text=返回首页')).toBeVisible()
})

test('recitation results show not-mastered details on click', async ({ page }) => {
  await startRecitationWithAll(page)

  // First poem: mark not mastered
  await expect(page.locator('button:has-text("整首熟练")')).toBeVisible({ timeout: 5000 })
  await page.locator('button:has-text("有不熟练")').click()
  await page.click('text=下一首')

  // Rest: mark mastered
  for (let i = 1; i < 5; i++) {
    await expect(page.locator('button:has-text("整首熟练")')).toBeVisible({ timeout: 5000 })
    await page.locator('button:has-text("整首熟练")').click()
    await page.click('text=下一首')
  }

  // Results page
  await expect(page.locator('h2')).toContainText('抽背结果')

  // Click on not-mastered item to expand details
  const notMasteredItem = page.locator('.bg-red-50').first()
  await notMasteredItem.click()
})

test('recitation results: try again navigates to setup', async ({ page }) => {
  await startRecitationWithAll(page)

  // Complete all poems
  for (let i = 0; i < 5; i++) {
    await expect(page.locator('button:has-text("整首熟练")')).toBeVisible({ timeout: 5000 })
    await page.locator('button:has-text("整首熟练")').click()
    await page.click('text=下一首')
  }

  // Click try again
  await page.click('text=再来一轮')
  await expect(page.locator('h2')).toContainText('抽背设置')
})

test('recitation results: go home navigates to home', async ({ page }) => {
  await startRecitationWithAll(page)

  // Complete all poems
  for (let i = 0; i < 5; i++) {
    await expect(page.locator('button:has-text("整首熟练")')).toBeVisible({ timeout: 5000 })
    await page.locator('button:has-text("整首熟练")').click()
    await page.click('text=下一首')
  }

  // Click go home
  await page.click('text=返回首页')
  await expect(page.locator('h1')).toContainText('古诗抽查')
})
