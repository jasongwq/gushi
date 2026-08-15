import { test, expect } from '@playwright/test'

test('home page loads correctly', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('古诗抽查')
})

test('navigate to quiz setup', async ({ page }) => {
  await page.goto('/')
  await page.click('text=自主练习')
  await expect(page.locator('h2')).toContainText('抽查设置')
})

test('wrong book page', async ({ page }) => {
  await page.goto('/#/wrong')
  await expect(page.locator('h2')).toContainText('错题本')
})

test('progress page', async ({ page }) => {
  await page.goto('/#/progress')
  await expect(page.locator('h2')).toContainText('学习进度')
})

test('settings page', async ({ page }) => {
  await page.goto('/#/settings')
  await expect(page.locator('h2')).toContainText('设置')
})

test('complete quiz flow', async ({ page }) => {
  await page.goto('/')
  await page.click('text=自主练习')

  // Select source (smart is default)
  // Select quiz type (fillBlank is default)
  // Set count to 5
  await page.click('text=5')

  // Start quiz
  await page.click('text=开始抽查')

  // Answer a question - click first option
  const optionBtn = page.locator('.option-btn').first()
  if (await optionBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await optionBtn.click()
  }

  // Wait for feedback or next question
  await page.waitForTimeout(2000)
})
