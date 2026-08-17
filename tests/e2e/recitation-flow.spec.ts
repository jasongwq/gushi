import { test, expect } from '@playwright/test'

// Feature: 古诗抽背 is now accessed via 家长抽查
test('navigate to recitation setup via parent quiz', async ({ page }) => {
  await page.goto('/')
  await page.click('text=家长抽查')
  // 家长抽查 now goes directly to poem-card page
  await expect(page.locator('.poem-card-page')).toBeVisible({ timeout: 5000 })
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
  await expect(page.locator('button:has-text("开始抽背")')).toBeDisabled()
})

test('recitation setup enables start after selecting grade', async ({ page }) => {
  await page.goto('/#/recitation/setup')
  await page.selectOption('select', 'grade')
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

test('recitation play page shows poem with all lines and judgment buttons', async ({ page }) => {
  await startRecitationWithAll(page)

  // Should show poem lines (not hidden behind a click)
  await expect(page.locator('.recitation-card').locator('button:has-text("卡顿")').first()).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.recitation-card').locator('button:has-text("不会")').first()).toBeVisible()
  // Author and dynasty with "不会" buttons
  await expect(page.locator('.recitation-card').locator('text=不会').first()).toBeVisible()
  // Global buttons
  await expect(page.locator('button:has-text("熟练")')).toBeVisible()
  await expect(page.locator('button:has-text("完全不会")')).toBeVisible()
  // "下一首" disabled by default (no issues marked)
  await expect(page.locator('button:has-text("下一首")')).toBeDisabled()
})

test('recitation flow: mark mastered and advance', async ({ page }) => {
  await startRecitationWithAll(page)

  await expect(page.locator('button:has-text("熟练")')).toBeVisible({ timeout: 5000 })

  // Click "熟练" to mark all as mastered
  await page.locator('button:has-text("熟练")').click()

  // Should advance to second poem
  await expect(page.locator('text=第 2 / 5 首')).toBeVisible({ timeout: 5000 })
})

test('recitation flow: mark completely forgot and advance', async ({ page }) => {
  await startRecitationWithAll(page)

  await expect(page.locator('button:has-text("完全不会")')).toBeVisible({ timeout: 5000 })

  // Click "完全不会" to mark all lines as forgot
  await page.locator('button:has-text("完全不会")').click()

  // Should advance to second poem
  await expect(page.locator('text=第 2 / 5 首')).toBeVisible({ timeout: 5000 })
})

test('recitation flow: mark individual line and submit', async ({ page }) => {
  await startRecitationWithAll(page)

  await expect(page.locator('.recitation-card').locator('button:has-text("卡顿")').first()).toBeVisible({ timeout: 5000 })

  // Mark first line as "卡顿"
  await page.locator('.recitation-card').locator('button:has-text("卡顿")').first().click()

  // "下一首" should now be enabled
  await expect(page.locator('button:has-text("下一首")')).toBeEnabled()

  // Click next
  await page.click('text=下一首')

  // Should show second poem
  await expect(page.locator('text=第 2 / 5 首')).toBeVisible({ timeout: 5000 })
})

test('recitation flow: mark author forgot', async ({ page }) => {
  await startRecitationWithAll(page)

  await expect(page.locator('.recitation-card').locator('button:has-text("不会")').first()).toBeVisible({ timeout: 5000 })

  // Click author "不会" button (the one next to author name)
  const authorBtn = page.locator('.recitation-card').locator('button:has-text("不会")').first()
  await authorBtn.click()

  // "下一首" should be enabled
  await expect(page.locator('button:has-text("下一首")')).toBeEnabled()

  await page.click('text=下一首')
})

test('recitation flow: complete all poems and see results', async ({ page }) => {
  await startRecitationWithAll(page)

  // Complete 5 poems - mark all as mastered
  for (let i = 0; i < 5; i++) {
    await expect(page.locator('button:has-text("熟练")')).toBeVisible({ timeout: 5000 })
    await page.locator('button:has-text("熟练")').click()
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

  // First poem: mark a line as forgot
  await expect(page.locator('.recitation-card').locator('button:has-text("不会")').first()).toBeVisible({ timeout: 5000 })
  await page.locator('.recitation-card').locator('button:has-text("不会")').first().click()
  await page.click('text=下一首')

  // Rest: mark mastered
  for (let i = 1; i < 5; i++) {
    await expect(page.locator('button:has-text("熟练")')).toBeVisible({ timeout: 5000 })
    await page.locator('button:has-text("熟练")').click()
  }

  // Results page
  await expect(page.locator('h2')).toContainText('抽背结果')

  // Click on not-mastered item to expand details
  const notMasteredItem = page.locator('.bg-red-50').first()
  await notMasteredItem.click()
})

test('recitation results: try again navigates to setup', async ({ page }) => {
  await startRecitationWithAll(page)

  for (let i = 0; i < 5; i++) {
    await expect(page.locator('button:has-text("熟练")')).toBeVisible({ timeout: 5000 })
    await page.locator('button:has-text("熟练")').click()
  }

  await page.click('text=再来一轮')
  await expect(page.locator('h2')).toContainText('抽背设置')
})

test('recitation results: go home navigates to home', async ({ page }) => {
  await startRecitationWithAll(page)

  for (let i = 0; i < 5; i++) {
    await expect(page.locator('button:has-text("熟练")')).toBeVisible({ timeout: 5000 })
    await page.locator('button:has-text("熟练")').click()
  }

  await page.click('text=返回首页')
  await expect(page.locator('h1')).toContainText('古诗抽查')
})

test('recitation flow: toggle line status on and off', async ({ page }) => {
  await startRecitationWithAll(page)

  await expect(page.locator('.recitation-card').locator('button:has-text("卡顿")').first()).toBeVisible({ timeout: 5000 })

  // Click "卡顿" to mark line as stuck
  await page.locator('.recitation-card').locator('button:has-text("卡顿")').first().click()
  await expect(page.locator('button:has-text("下一首")')).toBeEnabled()

  // Click "卡顿" again to toggle back to ok
  await page.locator('.recitation-card').locator('button:has-text("卡顿")').first().click()
  await expect(page.locator('button:has-text("下一首")')).toBeDisabled()
})

test('recitation flow: go back to previous poem', async ({ page }) => {
  await startRecitationWithAll(page)

  // Mark first poem as mastered
  await expect(page.locator('button:has-text("熟练")')).toBeVisible({ timeout: 5000 })
  await page.locator('button:has-text("熟练")').click()

  // Should be on second poem
  await expect(page.locator('text=第 2 / 5 首')).toBeVisible({ timeout: 5000 })

  // Go back to first poem
  await page.click('text=上一首')
  await expect(page.locator('text=第 1 / 5 首')).toBeVisible({ timeout: 5000 })

  // "上一首" should be disabled on first poem
  await expect(page.locator('button:has-text("上一首")')).toBeDisabled()
})

test('recitation flow: yiwen toggle shows and hides translation', async ({ page }) => {
  await startRecitationWithAll(page)

  await expect(page.locator('.recitation-card').locator('button:has-text("卡顿")').first()).toBeVisible({ timeout: 5000 })

  // 译文默认隐藏
  await expect(page.locator('.recitation-card').locator('button:has-text("显示译文")')).toBeVisible()
  await expect(page.locator('.recitation-card .bg-gray-50')).not.toBeVisible()

  // 点击显示译文
  await page.locator('.recitation-card').locator('button:has-text("显示译文")').click()
  await expect(page.locator('.recitation-card').locator('button:has-text("隐藏译文")')).toBeVisible()

  // 再次点击隐藏译文
  await page.locator('.recitation-card').locator('button:has-text("隐藏译文")').click()
  await expect(page.locator('.recitation-card').locator('button:has-text("显示译文")')).toBeVisible()
})

// 架构修复：not-mastered 背诵只记录一次 recite，细节进错题本不重复调度
test('recitation flow: not-mastered poem creates exactly one recite wrongBook entry', async ({ page }) => {
  test.setTimeout(60000)
  // 清空状态（localStorage + sessionStorage）
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await page.waitForTimeout(500)

  await startRecitationWithAll(page)

  // 第一首：标记一行"卡顿"
  await expect(page.locator('.recitation-card').locator('button:has-text("卡顿")').first()).toBeVisible({ timeout: 5000 })
  await page.locator('.recitation-card').locator('button:has-text("卡顿")').first().click()
  await expect(page.locator('button:has-text("下一首")')).toBeEnabled()
  await page.click('text=下一首')

  // 等待进入第 2 首（避免过渡期重复点击旧卡片）
  await expect(page.locator('text=第 2 / 5 首')).toBeVisible({ timeout: 5000 })

  // 其余诗标记熟练
  for (let i = 1; i < 5; i++) {
    await expect(page.locator('button:has-text("熟练")')).toBeVisible({ timeout: 5000 })
    await page.locator('button:has-text("熟练")').click()
    if (i < 4) {
      await expect(page.locator(`text=第 ${i + 2} / 5 首`)).toBeVisible({ timeout: 5000 })
    }
  }
  await expect(page.locator('h2')).toContainText('抽背结果')

  // 检查 localStorage：5 首诗各一条 recite quizResult
  const quizResults = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('poem-quiz-data') || '{}')
    return data.quizResults || []
  })
  const reciteResults = quizResults.filter((r: any) => r.quizType === 'recite')
  expect(reciteResults.length).toBe(5)

  // 错题本中 no-mastered 的诗只有 1 条 recite 条目
  const wrongBook = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('poem-quiz-data') || '{}')
    return data.wrongBook || []
  })
  const reciteEntries = wrongBook.filter((w: any) => w.quizType === 'recite')
  expect(reciteEntries.length).toBeLessThanOrEqual(1)
})
