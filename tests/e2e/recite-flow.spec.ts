import { test, expect } from '@playwright/test'

test('navigate to recite page from home', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=自评背诵')).toBeVisible()
  await page.click('text=自评背诵')
  await expect(page.locator('h2')).toContainText('古诗背诵')
})

test('recite page shows source options', async ({ page }) => {
  await page.goto('/#/recite')
  await expect(page.locator('h2')).toContainText('古诗背诵')
  await expect(page.locator('text=待复习')).toBeVisible()
  await expect(page.locator('text=全部古诗')).toBeVisible()
  await expect(page.locator('text=开始背诵')).toBeVisible()
})

test('recite page: select all source and start', async ({ page }) => {
  await page.goto('/#/recite')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  // Select "全部古诗"
  await page.click('text=全部古诗')
  await page.click('text=开始背诵')

  // Should show poem title and "查看原文" button (wait for poems to load)
  await expect(page.locator('text=查看原文')).toBeVisible({ timeout: 10000 })
})

test('recite flow: expand text and self-evaluate correct', async ({ page }) => {
  await page.goto('/#/recite')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.click('text=全部古诗')
  await page.click('text=开始背诵')

  // Wait for first poem
  await expect(page.locator('text=查看原文')).toBeVisible({ timeout: 10000 })

  // Click to expand
  await page.click('text=查看原文')

  // Should see "会了" and "不会" buttons
  await expect(page.locator('button:has-text("会了")')).toBeVisible()
  await expect(page.locator('button:has-text("不会")')).toBeVisible()

  // Self-evaluate as correct
  await page.click('button:has-text("会了")')

  // Should advance to next poem
  await expect(page.locator('text=查看原文')).toBeVisible({ timeout: 5000 })
})

test('recite flow: expand text and self-evaluate wrong', async ({ page }) => {
  await page.goto('/#/recite')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.click('text=全部古诗')
  await page.click('text=开始背诵')

  await expect(page.locator('text=查看原文')).toBeVisible({ timeout: 10000 })
  await page.click('text=查看原文')

  // Self-evaluate as wrong
  await page.click('button:has-text("不会")')

  // Should advance to next poem
  await expect(page.locator('text=查看原文')).toBeVisible({ timeout: 5000 })
})

test('recite flow: complete all poems and see results', async ({ page }) => {
  test.setTimeout(120000)

  await page.goto('/#/recite')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.click('text=全部古诗')
  await page.click('text=开始背诵')

  // Complete all poems (max 20)
  for (let i = 0; i < 20; i++) {
    const expandBtn = page.locator('text=查看原文')
    if (!(await expandBtn.isVisible({ timeout: 5000 }).catch(() => false))) break

    await expandBtn.click()
    await page.waitForTimeout(300)

    // Alternate between "会了" and "不会"
    if (i % 2 === 0) {
      await page.click('button:has-text("会了")')
    } else {
      await page.click('button:has-text("不会")')
    }
    await page.waitForTimeout(300)
  }

  // Should be on results page
  await expect(page.locator('h2')).toContainText('背诵结果', { timeout: 10000 })
  await expect(page.locator('text=会了')).toBeVisible()
  await expect(page.locator('text=不会')).toBeVisible()
  await expect(page.locator('text=再来一轮')).toBeVisible()
  await expect(page.locator('text=返回首页')).toBeVisible()
})

test('recite results: go home navigates to home', async ({ page }) => {
  test.setTimeout(120000)

  await page.goto('/#/recite')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.click('text=全部古诗')
  await page.click('text=开始背诵')

  // Complete poems quickly
  for (let i = 0; i < 20; i++) {
    const expandBtn = page.locator('text=查看原文')
    if (!(await expandBtn.isVisible({ timeout: 5000 }).catch(() => false))) break
    await expandBtn.click()
    await page.waitForTimeout(300)
    await page.click('button:has-text("会了")')
    await page.waitForTimeout(300)
  }

  await expect(page.locator('h2')).toContainText('背诵结果', { timeout: 10000 })
  await page.click('text=返回首页')
  await expect(page.locator('h1')).toContainText('古诗抽查')
})

test('recite results: try again navigates to recite page', async ({ page }) => {
  test.setTimeout(120000)

  await page.goto('/#/recite')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.click('text=全部古诗')
  await page.click('text=开始背诵')

  for (let i = 0; i < 20; i++) {
    const expandBtn = page.locator('text=查看原文')
    if (!(await expandBtn.isVisible({ timeout: 5000 }).catch(() => false))) break
    await expandBtn.click()
    await page.waitForTimeout(300)
    await page.click('button:has-text("会了")')
    await page.waitForTimeout(300)
  }

  await expect(page.locator('h2')).toContainText('背诵结果', { timeout: 10000 })
  await page.click('text=再来一轮')
  await expect(page.locator('h2')).toContainText('古诗背诵')
})

test('recite page: grade filter works', async ({ page }) => {
  await page.goto('/#/recite')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.click('text=全部古诗')

  // Grade section should appear
  await expect(page.locator('text=选择年级')).toBeVisible({ timeout: 5000 })

  // Click a grade button (e.g. "一年级")
  const gradeBtn = page.locator('section button').filter({ hasText: '年级' }).first()
  await gradeBtn.click()

  // Start button should be enabled
  await expect(page.locator('button:has-text("开始背诵")')).toBeEnabled()
})
