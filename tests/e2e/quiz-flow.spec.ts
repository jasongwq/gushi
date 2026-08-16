import { test, expect } from '@playwright/test'

// Helper: clear localStorage and reload to ensure clean state
async function cleanState(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(500)
}

test('home page loads correctly', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('古诗抽查')
})

test('navigate to self quiz setup', async ({ page }) => {
  await page.goto('/')
  await page.click('text=自主练习')
  await expect(page.locator('h2')).toContainText('抽查设置')
})

test('navigate to parent quiz setup', async ({ page }) => {
  await page.goto('/')
  await page.click('text=家长抽查')
  await expect(page.locator('h2')).toContainText('家长抽查')
})

test('home page has 3 mode buttons', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=家长抽查')).toBeVisible()
  await expect(page.locator('text=自主练习')).toBeVisible()
  await expect(page.locator('text=自评背诵')).toBeVisible()
  // 古诗抽背 should NOT be on home page anymore
  await expect(page.locator('text=古诗抽背')).not.toBeVisible()
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

test('complete quiz flow (self mode)', async ({ page }) => {
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
  await page.goto('/#/quiz/setup?mode=self')
  await page.waitForSelector('select', { timeout: 10000 })
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
  await cleanState(page)

  await page.goto('/#/quiz/setup?mode=self')
  await page.waitForSelector('select', { timeout: 10000 })

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

// Feature: Fill-blank quiz shows exactly one blank (____)
test('fill-blank quiz shows exactly one blank', async ({ page }) => {
  await cleanState(page)

  await page.goto('/#/quiz/setup?mode=self')
  await page.waitForSelector('select', { timeout: 10000 })

  // Select only fillBlank quiz type
  const nextLineCheckbox = page.locator('input[type="checkbox"]').last()
  if (await nextLineCheckbox.isChecked()) {
    await nextLineCheckbox.click()
  }
  await page.click('text=5')
  await page.click('text=开始抽查')

  await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 })

  const poemText = await page.locator('.poem-text').textContent()
  // Count occurrences of ____ - should be exactly 1
  const blankCount = (poemText?.match(/____/g) || []).length
  expect(blankCount).toBe(1)
})

// Bug fix 3: Empty quiz shows error message instead of "答题完成"
test('empty quiz source shows error message', async ({ page }) => {
  await cleanState(page)

  // Go to quiz setup and select "错题本" source (no wrong answers)
  await page.goto('/#/quiz/setup?mode=self')
  await page.waitForSelector('select', { timeout: 10000 })
  await page.selectOption('select', 'wrong')
  await page.click('text=开始抽查')

  // Should show error message instead of navigating to quiz-play
  await expect(page.locator('.text-red-500')).toContainText('没有符合条件的题目，请调整设置', { timeout: 5000 })
  await expect(page.locator('h2')).toContainText('抽查设置')
})

// Bug fix 4: Wrong book can mark unproficient
test('wrong book can mark entry as unproficient', async ({ page }) => {
  test.setTimeout(60000)
  await cleanState(page)

  await page.goto('/#/quiz/setup?mode=self')
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

// Bug fix 5: SelectTitle quiz type is not available in self mode
test('self quiz mode shows fillBlank and nextLine options', async ({ page }) => {
  await page.goto('/#/quiz/setup?mode=self')
  await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 })
  const checkboxes = page.locator('input[type="checkbox"]')
  await expect(checkboxes).toHaveCount(2)
  await expect(page.locator('text=补字选择')).toBeVisible()
  await expect(page.locator('text=上下句接龙')).toBeVisible()
  await expect(page.locator('text=选标题/作者/朝代')).not.toBeVisible()
})

// Feature: Parent quiz mode shows recite and nextLine options (no fillBlank)
test('parent quiz mode shows recite and nextLine options only', async ({ page }) => {
  await page.goto('/#/quiz/setup?mode=parent')
  await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 })
  const checkboxes = page.locator('input[type="checkbox"]')
  await expect(checkboxes).toHaveCount(2)
  await expect(page.locator('text=古诗抽背')).toBeVisible()
  await expect(page.locator('text=上下句接龙')).toBeVisible()
  // 补字选择 should NOT be in parent mode
  await expect(page.locator('text=补字选择')).not.toBeVisible()
})

// Feature: Parent quiz mode defaults to 古诗抽背
test('parent quiz mode defaults to recite checked', async ({ page }) => {
  await page.goto('/#/quiz/setup?mode=parent')
  await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 })
  const reciteCheckbox = page.locator('input[type="checkbox"]').first()
  await expect(reciteCheckbox).toBeChecked()
})

// Feature: Parent quiz mode starts recitation flow
test('parent quiz mode starts recitation when recite is checked', async ({ page }) => {
  test.setTimeout(60000)
  await cleanState(page)

  await page.goto('/#/quiz/setup?mode=parent')
  await page.waitForSelector('select', { timeout: 10000 })
  await page.selectOption('select', 'all')
  await page.click('text=5')
  await page.click('text=开始抽查')

  // Should navigate to recitation play page (not quiz play)
  await expect(page.locator('.recitation-card').locator('button:has-text("卡顿")').first()).toBeVisible({ timeout: 10000 })
})

// Feature: Parent quiz mode title shows "家长抽查"
test('parent quiz mode title shows 家长抽查', async ({ page }) => {
  await page.goto('/#/quiz/setup?mode=parent')
  await expect(page.locator('h2')).toContainText('家长抽查')
})

// Feature: Auto-navigate to result page after last question
test('answering all questions auto-navigates to result page', async ({ page }) => {
  test.setTimeout(60000)
  await cleanState(page)

  await page.goto('/#/quiz/setup?mode=self')
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
  await cleanState(page)

  await page.goto('/#/quiz/setup?mode=self')
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
  await expect(page.locator('.text-lg.text-gray-500')).toContainText('分')
  await expect(page.locator('.text-center.text-sm')).toContainText('正确')
  await expect(page.locator('text=返回首页')).toBeVisible()
})
