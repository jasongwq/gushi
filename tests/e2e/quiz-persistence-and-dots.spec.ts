import { test, expect } from '@playwright/test'

// Helper: clear storage and reload
async function cleanState(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await page.waitForTimeout(500)
}

// Helper: start a quiz with all source, 5 questions
async function startQuiz(page: import('@playwright/test').Page) {
  await page.goto('/#/quiz/setup?mode=self')
  await page.waitForSelector('select', { timeout: 10000 })
  await page.selectOption('select', 'all')
  const nextLineCheckbox = page.locator('input[type="checkbox"]').last()
  if (await nextLineCheckbox.isChecked()) {
    await nextLineCheckbox.click()
  }
  await page.click('text=5')
  await page.click('text=开始抽查')
}

// === Progress dots feature ===

test('quiz shows progress dots for each question', async ({ page }) => {
  await cleanState(page)
  await startQuiz(page)

  await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 })
  const dots = page.locator('.dot')
  await expect(dots).toHaveCount(5)
})

test('current question dot is highlighted', async ({ page }) => {
  await cleanState(page)
  await startQuiz(page)

  await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 })
  const currentDot = page.locator('.dot.current')
  await expect(currentDot).toBeVisible()
  expect(await currentDot.textContent()).toBe('1')
})

test('answered question dot shows correct/wrong color', async ({ page }) => {
  test.setTimeout(60000)
  await cleanState(page)
  await startQuiz(page)

  // Answer first question
  await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 })
  await page.locator('.option-btn').first().click()
  await page.waitForTimeout(2000)

  // The first dot should now be colored (correct or wrong)
  const firstDot = page.locator('.dot').first()
  const hasCorrectOrWrong = await firstDot.evaluate(el =>
    el.classList.contains('correct') || el.classList.contains('wrong')
  )
  expect(hasCorrectOrWrong).toBe(true)
})

test('can click answered dot to review previous question', async ({ page }) => {
  test.setTimeout(60000)
  await cleanState(page)
  await startQuiz(page)

  // Answer first question
  await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 })
  await page.locator('.option-btn').first().click()
  await page.waitForTimeout(2000)

  // Now on question 2, click the first dot to review question 1
  const firstDot = page.locator('.dot').first()
  await firstDot.click()

  // The question display should change - we should see the question text
  // (either the question-text or poem-text element)
  await expect(page.locator('.question-text, .poem-text').first()).toBeVisible({ timeout: 3000 })
})

test('unanswered dots are disabled', async ({ page }) => {
  await cleanState(page)
  await startQuiz(page)

  await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 })
  const dots = page.locator('.dot')
  // Future dots (not current and not answered) should be disabled
  const thirdDot = dots.nth(2)
  await expect(thirdDot).toBeDisabled()
})

// === Refresh persistence feature ===

test('quiz session persists after page refresh', async ({ page }) => {
  test.setTimeout(60000)
  await cleanState(page)
  await startQuiz(page)

  // Answer first question
  await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 })
  await page.locator('.option-btn').first().click()
  await page.waitForTimeout(2000)

  // Should be on question 2 now
  const currentDot = page.locator('.dot.current')
  expect(await currentDot.textContent()).toBe('2')

  // Refresh the page
  await page.reload()
  await page.waitForTimeout(1000)

  // Should still be on the quiz page with session restored
  await expect(page.locator('.dot').first()).toBeVisible({ timeout: 5000 })
  // The first dot should still be answered (colored)
  const firstDot = page.locator('.dot').first()
  const hasCorrectOrWrong = await firstDot.evaluate(el =>
    el.classList.contains('correct') || el.classList.contains('wrong')
  )
  expect(hasCorrectOrWrong).toBe(true)
})

test('recite page state persists after page refresh', async ({ page }) => {
  test.setTimeout(60000)
  await cleanState(page)

  await page.goto('/#/recite')
  await page.click('text=全部古诗')
  await page.click('text=开始背诵')

  // Wait for first poem
  await expect(page.locator('text=查看原文')).toBeVisible({ timeout: 10000 })
  await page.click('text=查看原文')

  // Evaluate first poem
  await page.click('button:has-text("会了")')
  await page.waitForTimeout(500)

  // Should be on second poem
  await expect(page.locator('text=查看原文')).toBeVisible({ timeout: 5000 })

  // Refresh the page
  await page.reload()
  await page.waitForTimeout(1000)

  // Should still be on the recite page with cards phase
  await expect(page.locator('h2.text-3xl')).toBeVisible({ timeout: 5000 })
  // Should not be on the setup screen
  await expect(page.locator('text=开始背诵')).not.toBeVisible()
})
