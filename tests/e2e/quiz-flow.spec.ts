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

// Bug fix 1: Quiz setup config persists after navigating away
test('quiz setup config persists when returning from home', async ({ page }) => {
  await page.goto('/#/quiz/setup')

  // Change source to "全部"
  await page.selectOption('select', 'all')

  // Change count to 20
  await page.click('text=20')

  // Uncheck 补字选择, leaving only 上下句接龙
  await page.click('text=补字选择')

  // Navigate away and back
  await page.click('text=返回首页')
  await page.click('text=自主练习')

  // Verify config persisted
  await expect(page.locator('select')).toHaveValue('all')
  await expect(page.locator('text=20').first()).toBeVisible()
  // 上下句接龙 should still be checked
  const nextLineCheckbox = page.locator('input[type="checkbox"]').last()
  await expect(nextLineCheckbox).toBeChecked()
  // 补字选择 should be unchecked
  const fillBlankCheckbox = page.locator('input[type="checkbox"]').first()
  await expect(fillBlankCheckbox).not.toBeChecked()
})

// Bug fix 2: Fill-blank quiz shows blanks (____) in poem text
test('fill-blank quiz shows blanks in poem text', async ({ page }) => {
  await page.goto('/#/quiz/setup')

  // Select only fillBlank quiz type
  // Uncheck 上下句接龙 if it's checked
  const nextLineCheckbox = page.locator('input[type="checkbox"]').last()
  if (await nextLineCheckbox.isChecked()) {
    await nextLineCheckbox.click()
  }

  // Set count to 5
  await page.click('text=5')

  // Start quiz
  await page.click('text=开始抽查')

  // Verify poem text has blanks
  const poemText = page.locator('.poem-text')
  await expect(poemText).toBeVisible({ timeout: 3000 })
  await expect(poemText).toContainText('____')
})

// Bug fix 3: Empty quiz shows error message instead of "答题完成"
test('empty quiz source shows error message', async ({ page }) => {
  // Clear localStorage to ensure no wrong answers exist
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  // Go to quiz setup and select "错题本" source (no wrong answers)
  await page.goto('/#/quiz/setup')
  await page.selectOption('select', 'wrong')

  // Try to start quiz
  await page.click('text=开始抽查')

  // Should show error message instead of navigating to quiz-play
  await expect(page.locator('text=没有符合条件的题目，请调整设置')).toBeVisible({ timeout: 3000 })

  // Should still be on setup page
  await expect(page.locator('h2')).toContainText('抽查设置')
})

// Bug fix 4: Wrong book can mark unproficient
test('wrong book can mark entry as unproficient', async ({ page }) => {
  // First, create a wrong answer by doing a quiz and answering incorrectly
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.goto('/#/quiz/setup')
  await page.selectOption('select', 'all')
  // Only fillBlank
  const nextLineCheckbox = page.locator('input[type="checkbox"]').last()
  if (await nextLineCheckbox.isChecked()) {
    await nextLineCheckbox.click()
  }
  await page.click('text=5')
  await page.click('text=开始抽查')

  // Answer incorrectly - click a wrong option
  const optionBtns = page.locator('.option-btn')
  if (await optionBtns.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    // Click the second option (likely wrong)
    await optionBtns.nth(1).click()
    await page.waitForTimeout(2000)
  }

  // Navigate to wrong book
  await page.goto('/#/wrong')

  // If there's a wrong entry, test the unproficient toggle
  const unproficientBtn = page.locator('text=标不熟练').first()
  if (await unproficientBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await unproficientBtn.click()
    // Button should now show "已标不熟练"
    await expect(page.locator('text=已标不熟练').first()).toBeVisible({ timeout: 2000 })
  }
})

// Bug fix 5: SelectTitle quiz type is not available
test('selectTitle quiz type is not available in setup', async ({ page }) => {
  await page.goto('/#/quiz/setup')

  // Verify only two quiz type options exist
  const checkboxes = page.locator('input[type="checkbox"]')
  await expect(checkboxes).toHaveCount(2)

  // Verify the labels are correct
  await expect(page.locator('text=补字选择')).toBeVisible()
  await expect(page.locator('text=上下句接龙')).toBeVisible()

  // Verify selectTitle is not present
  await expect(page.locator('text=选标题/作者/朝代')).not.toBeVisible()
})

// Feature: Auto-navigate to result page after last question
test('answering all questions auto-navigates to result page', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.goto('/#/quiz/setup')
  await page.selectOption('select', 'all')
  // Only fillBlank to keep it simple
  const nextLineCheckbox = page.locator('input[type="checkbox"]').last()
  if (await nextLineCheckbox.isChecked()) {
    await nextLineCheckbox.click()
  }
  // Set count to 5
  await page.click('text=5')
  await page.click('text=开始抽查')

  // Answer all 5 questions
  for (let i = 0; i < 5; i++) {
    const optionBtn = page.locator('.option-btn').first()
    await expect(optionBtn).toBeVisible({ timeout: 5000 })
    await optionBtn.click()
    // Wait for feedback to clear (1.5s) + small buffer
    await page.waitForTimeout(2000)
  }

  // Should auto-navigate to result page (no "答题完成" intermediate page)
  await expect(page.locator('h2')).toContainText('抽查结果', { timeout: 5000 })
  // Should NOT show "查看结果" button (intermediate page removed)
  await expect(page.locator('text=查看结果')).not.toBeVisible()
})

// Feature: Result page shows prompt and user answer for all questions
test('result page shows prompt and user answer for each question', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.goto('/#/quiz/setup')
  await page.selectOption('select', 'all')
  // Only fillBlank
  const nextLineCheckbox = page.locator('input[type="checkbox"]').last()
  if (await nextLineCheckbox.isChecked()) {
    await nextLineCheckbox.click()
  }
  // Set count to 5
  await page.click('text=5')
  await page.click('text=开始抽查')

  // Answer all 5 questions
  for (let i = 0; i < 5; i++) {
    const optionBtn = page.locator('.option-btn').first()
    await expect(optionBtn).toBeVisible({ timeout: 5000 })
    await optionBtn.click()
    await page.waitForTimeout(2000)
  }

  // Wait for result page
  await expect(page.locator('h2')).toContainText('抽查结果', { timeout: 5000 })

  // Each answer card should show "你的答案" label
  const answerCards = page.locator('text=你的答案：')
  await expect(answerCards).toHaveCount(5, { timeout: 5000 })

  // Wrong answers should also show "正确答案"
  // (We can't guarantee any specific answer is wrong, but the structure should be there)
  // At minimum, verify the score is displayed
  await expect(page.locator('text=分')).toBeVisible()
  await expect(page.locator('text=正确')).toBeVisible()

  // "返回首页" button should be present
  await expect(page.locator('text=返回首页')).toBeVisible()
})
