import { test, expect } from '@playwright/test'

// Helper: start recitation with "all" source
async function startRecitationWithAll(page: any) {
  await page.goto('/#/recitation/setup')
  await page.selectOption('select', 'all')
  await page.click('text=5 首')
  await page.click('text=开始抽背')
}

test('char marking: renders char spans and toggles through three states', async ({ page }) => {
  await startRecitationWithAll(page)

  // 第一首诗出现，找到第一个可点击的汉字
  const charSpans = page.locator('.char-mark')
  await expect(charSpans.first()).toBeVisible({ timeout: 5000 })

  // 第1次点击 → fuzzy（黄）
  await charSpans.first().click()
  await expect(charSpans.first()).toHaveClass(/char-fuzzy/)

  // 第2次点击 → wrong（红）
  await charSpans.first().click()
  await expect(charSpans.first()).toHaveClass(/char-wrong/)

  // 第3次点击 → 取消
  await charSpans.first().click()
  await expect(charSpans.first()).not.toHaveClass(/char-fuzzy|char-wrong/)
})

test('char marking: punctuation is not clickable', async ({ page }) => {
  await startRecitationWithAll(page)

  const punctSpans = page.locator('.punct')
  await expect(punctSpans.first()).toBeVisible({ timeout: 5000 })
  // punct span 不应有 char-mark class
  await expect(punctSpans.first()).not.toHaveClass(/char-mark/)
})

test('char marking: mark char then submit persists to stats', async ({ page }) => {
  await startRecitationWithAll(page)

  const charSpans = page.locator('.char-mark')
  await expect(charSpans.first()).toBeVisible({ timeout: 5000 })

  // 标记第一个字为 fuzzy
  await charSpans.first().click()
  await expect(charSpans.first()).toHaveClass(/char-fuzzy/)

  // 标记一行「卡顿」使"下一首"可点
  await page.locator('.recitation-card').locator('button:has-text("卡顿")').first().click()
  await expect(page.locator('button:has-text("下一首")')).toBeEnabled()
  await page.click('text=下一首')

  // 进入第二首，字级标记应已重置（第一个字无高亮）
  await expect(page.locator('text=第 2 / 5 首')).toBeVisible({ timeout: 5000 })
  const secondCharSpans = page.locator('.char-mark')
  await expect(secondCharSpans.first()).not.toHaveClass(/char-fuzzy|char-wrong/)
})
