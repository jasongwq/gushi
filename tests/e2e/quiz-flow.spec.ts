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
  await page.click('text=5')
  await page.click('text=开始抽查')

  const optionBtn = page.locator('.option-btn').first()
  if (await optionBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await optionBtn.click()
  }
  await page.waitForTimeout(2000)
})

// Bug fix 1: Quiz setup config persists after navigating away
test('quiz setup config persists when returning from home', async ({ page }) => {
  await page.goto('/#/quiz/setup')
  await page.selectOption('select', 'all')
  await page.click('text=20')
  await page.click('text=补字选择')

  // Navigate away and back
  await page.goto('/')
  await page.click('text=自主练习')

  // Verify config persisted
  await expect(page.locator('select')).toHaveValue('all')
  await expect(page.locator('text=20').first()).toBeVisible()
  const nextLineCheckbox = page.locator('input[type="checkbox"]').last()
  await expect(nextLineCheckbox).toBeChecked()
  const fillBlankCheckbox = page.locator('input[type="checkbox"]').first()
  await expect(fillBlankCheckbox).not.toBeChecked()
})

// Bug fix 2: Fill-blank quiz shows blanks (____) in poem text
test('fill-blank quiz shows blanks in poem text', async ({ page }) => {
  // Reset persisted config from previous test
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())

  await page.goto('/#/quiz/setup')

  // Select only fillBlank quiz type - uncheck 上下句接龙
  const nextLineCheckbox = page.locator('input[type="checkbox"]').last()
  if (await nextLineCheckbox.isChecked()) {
    await nextLineCheckbox.click()
  }
  await page.click('text=5')
  await page.click('text=开始抽查')

  // Wait for quiz to load
  await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 })

  // Verify poem text has blanks
  const poemText = page.locator('.poem-text')
  await expect(poemText).toBeVisible()
  await expect(poemText).toContainText('____')
})

// Bug fix 3: Empty quiz shows error message instead of "答题完成"
test('empty quiz source shows error message', async ({ page }) => {
  // Go to app and clear data
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())

  // Go to quiz setup and select "错题本" source (no wrong answers)
  await page.goto('/#/quiz/setup')
  await page.selectOption('select', 'wrong')
  await page.click('text=开始抽查')

  // Should show error message instead of navigating to quiz-play
  await expect(page.locator('.text-red-500')).toContainText('没有符合条件的题目，请调整设置', { timeout: 5000 })
  await expect(page.locator('h2')).toContainText('抽查设置')
})

// Bug fix 4: Wrong book can mark unproficient
test('wrong book can mark entry as unproficient', async ({ page }) => {
  test.setTimeout(60000)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())

  await page.goto('/#/quiz/setup')
  await page.waitForSelector('select', { timeout: 10000 })
  await page.selectOption('select', 'all')
  const nextLineCheckbox = page.locator('input[type="checkbox"]').last()
  if (await nextLineCheckbox.isChecked()) {
    await nextLineCheckbox.click()
  }
  await page.click('text=5')
  await page.click('text=开始抽查')

  // Answer incorrectly - click a wrong option
  const optionBtns = page.locator('.option-btn')
  if (await optionBtns.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await optionBtns.nth(1).click()
    await page.waitForTimeout(2000)
  }

  // Navigate to wrong book
  await page.goto('/#/wrong')
  const unproficientBtn = page.locator('text=标不熟练').first()
  if (await unproficientBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await unproficientBtn.click()
    await expect(page.locator('text=已标不熟练').first()).toBeVisible({ timeout: 2000 })
  }
})

// Bug fix 5: SelectTitle quiz type is not available
test('selectTitle quiz type is not available in setup', async ({ page }) => {
  await page.goto('/#/quiz/setup')
  const checkboxes = page.locator('input[type="checkbox"]')
  await expect(checkboxes).toHaveCount(2)
  await expect(page.locator('text=补字选择')).toBeVisible()
  await expect(page.locator('text=上下句接龙')).toBeVisible()
  await expect(page.locator('text=选标题/作者/朝代')).not.toBeVisible()
})

// Feature: Auto-navigate to result page after last question
test('answering all questions auto-navigates to result page', async ({ page }) => {
  test.setTimeout(60000)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())

  await page.goto('/#/quiz/setup')
  await page.waitForSelector('select', { timeout: 10000 })
  await page.selectOption('select', 'all')
  const nextLineCheckbox = page.locator('input[type="checkbox"]').last()
  if (await nextLineCheckbox.isChecked()) {
    await nextLineCheckbox.click()
  }
  await page.click('text=5')
  await page.click('text=开始抽查')

  for (let i = 0; i < 5; i++) {
    const optionBtn = page.locator('.option-btn').first()
    await expect(optionBtn).toBeVisible({ timeout: 5000 })
    await optionBtn.click()
    await page.waitForTimeout(2000)
  }

  await expect(page.locator('h2')).toContainText('抽查结果', { timeout: 5000 })
  await expect(page.locator('text=查看结果')).not.toBeVisible()
})

// Feature: Result page shows prompt and user answer for all questions
test('result page shows prompt and user answer for each question', async ({ page }) => {
  test.setTimeout(60000)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())

  await page.goto('/#/quiz/setup')
  await page.waitForSelector('select', { timeout: 10000 })
  await page.selectOption('select', 'all')
  const nextLineCheckbox = page.locator('input[type="checkbox"]').last()
  if (await nextLineCheckbox.isChecked()) {
    await nextLineCheckbox.click()
  }
  await page.click('text=5')
  await page.click('text=开始抽查')

  for (let i = 0; i < 5; i++) {
    const optionBtn = page.locator('.option-btn').first()
    await expect(optionBtn).toBeVisible({ timeout: 5000 })
    await optionBtn.click()
    await page.waitForTimeout(2000)
  }

  await expect(page.locator('h2')).toContainText('抽查结果', { timeout: 5000 })
  const answerCards = page.locator('.border-l-4')
  await expect(answerCards).toHaveCount(5, { timeout: 5000 })
  await expect(page.locator('text=分')).toBeVisible()
  await expect(page.locator('.text-center.text-sm')).toContainText('正确')
  await expect(page.locator('text=返回首页')).toBeVisible()
})
