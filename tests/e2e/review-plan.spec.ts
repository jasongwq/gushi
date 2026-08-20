import { test, expect } from '@playwright/test'

test('home page has review plan entry', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=复习计划')).toBeVisible({ timeout: 10000 })
})

test('review plan page shows today section with schedule', async ({ page }) => {
  await page.goto('/#/review-plan')
  await expect(page.locator('h2')).toContainText('复习计划', { timeout: 10000 })
  await expect(page.locator('text=今天')).toBeVisible({ timeout: 10000 })
  // 首次进入自动生成排程 → 今天有"新增学习"的诗（默认每天3首）
  await expect(page.locator('text=新增学习').first()).toBeVisible({ timeout: 10000 })
})

test('review plan page: pace selector and rebuild', async ({ page }) => {
  await page.goto('/#/review-plan')
  await expect(page.locator('select').first()).toBeVisible({ timeout: 10000 })
  await expect(page.locator('button:has-text("重排")')).toBeVisible()

  // 切换节奏到"每天 1 首"并重排
  await page.selectOption('select >> nth=0', '1')
  await page.click('button:has-text("重排")')

  // 今天区块仍在（每天1首 → 今天1首）
  await expect(page.locator('text=今天')).toBeVisible({ timeout: 5000 })
})

test('review plan page: not-learned section shows scheduled and unscheduled', async ({ page }) => {
  await page.goto('/#/review-plan')
  // 未学区块 header（正则匹配计数文本）
  const notLearnedHeader = page.locator('text=/未学（\\d+ 首）/')
  await expect(notLearnedHeader).toBeVisible({ timeout: 10000 })
  // 点击 header 的父级（带 @click 的 div）
  await notLearnedHeader.locator('xpath=ancestor::div[contains(@class,"cursor-pointer")]').first().click()
  // 200 首诗，默认每天3首排程 30 天后仍有 110 首排到 30 天后
  await expect(page.locator('text=已排期（30 天后）').first()).toBeVisible({ timeout: 5000 })
})

test('review plan page: calc tip toggles explanation', async ({ page }) => {
  await page.goto('/#/review-plan')
  await expect(page.locator('text=复习计划按以下规则计算')).not.toBeVisible()

  const tipIcon = page.locator('h2 span:has-text("!")')
  await tipIcon.click()
  await expect(page.locator('text=复习计划按以下规则计算')).toBeVisible()

  await tipIcon.click()
  await expect(page.locator('text=复习计划按以下规则计算')).not.toBeVisible()
})

test('review plan page: click poem navigates to detail', async ({ page }) => {
  await page.goto('/#/review-plan')

  // 展开今天并点击第一首
  await expect(page.locator('text=今天')).toBeVisible({ timeout: 10000 })
  const firstPoem = page.locator('div[class*="cursor-pointer"] span').filter({ hasText: /[一-龥]/ }).first()
  await expect(firstPoem).toBeVisible({ timeout: 10000 })
  await firstPoem.click()

  await expect(page.locator('text=掌握等级')).toBeVisible({ timeout: 5000 })
})

test('poem detail page: recite review button starts recitation', async ({ page }) => {
  // 直接访问详情页（hash 路由）。避免先访问首页再改 hash，
  // 防止 reload 竞态导致 hash 导航不生效。
  await page.goto('/#/poem/p001')
  await page.waitForLoadState('load')
  await expect(page.locator('h2')).toContainText('咏鹅', { timeout: 10000 })
  await expect(page.locator('button:has-text("背诵复习")')).toBeVisible({ timeout: 10000 })

  await page.locator('button:has-text("背诵复习")').click()

  // 进入背诵播放页，单首诗
  await expect(page.locator('text=第 1 / 1 首')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.recitation-card')).toBeVisible({ timeout: 5000 })
})

test('poem detail page: complete single-poem recitation to result page', async ({ page }) => {
  await page.goto('/#/poem/p001')
  await page.waitForLoadState('load')
  await expect(page.locator('button:has-text("背诵复习")')).toBeVisible({ timeout: 10000 })

  await page.locator('button:has-text("背诵复习")').click()

  // 背诵：标记熟练
  await expect(page.locator('button:has-text("熟练")')).toBeVisible({ timeout: 5000 })
  await page.locator('button:has-text("熟练")').click()

  // 单首完成 → 结果页
  await expect(page.locator('h2')).toContainText('抽背结果', { timeout: 5000 })
  await expect(page.locator('text=再来一轮')).toBeVisible()
  await expect(page.locator('text=返回首页')).toBeVisible()
})

test('review plan page: batch mark poems as learned', async ({ page }) => {
  await page.goto('/#/review-plan')
  // 打开标记已背篇目
  await expect(page.locator('button:has-text("标记已背篇目")')).toBeVisible({ timeout: 10000 })
  await page.click('button:has-text("标记已背篇目")')
  await expect(page.locator('text=勾选已经背过的诗')).toBeVisible({ timeout: 5000 })

  // 勾选第一首诗
  const checkbox = page.locator('input[type="checkbox"]').first()
  await checkbox.check()

  // 确认标记
  await page.click('button:has-text("确认标记")')

  // 标记已背篇目界面关闭
  await expect(page.locator('text=勾选已经背过的诗')).not.toBeVisible({ timeout: 5000 })

  // 该诗已有学习记录（检查 localStorage）
  const records = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('poem-quiz-data') || '{}')
    return data.records || []
  })
  expect(records.length).toBeGreaterThan(0)

  // 标记的诗 nextReviewDate 为占位（2099），不会进今日待复习
  const markedRecord = records.find((r: any) => r.nextReviewDate === '2099-01-01')
  expect(markedRecord).toBeDefined()
})

test('review plan page: rebuild spreads marked-learned reviews', async ({ page }) => {
  await page.goto('/#/review-plan')
  // 批量标记第一首
  await page.click('button:has-text("标记已背篇目")')
  await expect(page.locator('text=勾选已经背过的诗')).toBeVisible({ timeout: 5000 })
  const checkbox = page.locator('input[type="checkbox"]').first()
  await checkbox.check()
  await page.click('button:has-text("确认标记")')
  await expect(page.locator('text=勾选已经背过的诗')).not.toBeVisible({ timeout: 5000 })

  // 标记后该诗 nextReviewDate 为占位
  const placeholder = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('poem-quiz-data') || '{}')
    return data.records.some((r: any) => r.nextReviewDate === '2099-01-01')
  })
  expect(placeholder).toBe(true)

  // 重排（默认复习数）后占位诗获得实际复习日期
  await page.click('button:has-text("重排")')
  await page.waitForTimeout(500)
  const assigned = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('poem-quiz-data') || '{}')
    return data.records.some((r: any) => r.nextReviewDate !== '2099-01-01' && r.reviewCount === 0)
  })
  expect(assigned).toBe(true)
})

test('review plan page: batch config cancel keeps state unchanged', async ({ page }) => {
  await page.goto('/#/review-plan')
  await page.click('button:has-text("标记已背篇目")')
  await expect(page.locator('text=勾选已经背过的诗')).toBeVisible({ timeout: 5000 })
  await page.click('button:has-text("取消")')
  await expect(page.locator('text=勾选已经背过的诗')).not.toBeVisible({ timeout: 5000 })
})

test('review plan page: grade checkbox selects all poems of that grade', async ({ page }) => {
  await page.goto('/#/review-plan')
  await page.click('button:has-text("标记已背篇目")')
  await expect(page.locator('text=勾选已经背过的诗')).toBeVisible({ timeout: 5000 })

  // 点击一年级（第一个年级）的复选框 → 全选该年级所有诗
  const gradeCheckbox = page.locator('label:has-text("一年级（") input[type="checkbox"]').first()
  await gradeCheckbox.check()

  // 确认按钮计数显示选中数量 > 0
  const confirmBtn = page.locator('button:has-text("确认标记")')
  await expect(confirmBtn).toContainText('确认标记（', { timeout: 5000 })
  const text = await confirmBtn.textContent()
  const count = parseInt(text!.match(/（(\d+)）/)![1], 10)
  expect(count).toBeGreaterThan(1)

  // 确认标记 → 该年级诗都创建记录
  await confirmBtn.click()
  await expect(page.locator('text=勾选已经背过的诗')).not.toBeVisible({ timeout: 5000 })
  const markedCount = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('poem-quiz-data') || '{}')
    return (data.records || []).filter((r: any) => r.isMarkedLearned === true).length
  })
  expect(markedCount).toBe(count)
})

test('single poem: marking a line saves immediately and wrongbook repairs schedule', async ({ page }) => {
  // 清空状态
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await page.waitForTimeout(300)

  // 古诗详情 → 背诵复习
  await page.goto('/#/poem/p001')
  await page.waitForLoadState('load')
  await expect(page.locator('button:has-text("背诵复习")')).toBeVisible({ timeout: 10000 })
  await page.locator('button:has-text("背诵复习")').click()

  // 标记一行「卡顿」（不点下一首）
  await expect(page.locator('.recitation-card').locator('button:has-text("卡顿")').first()).toBeVisible({ timeout: 5000 })
  await page.locator('.recitation-card').locator('button:has-text("卡顿")').first().click()

  // 验证错题本已即时写入（localStorage）
  const wb = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('poem-quiz-data') || '{}')
    return data.wrongBook || []
  })
  const lineEntry = wb.find((w: any) => w.quizType === 'line' && w.note === '第1句:stuck')
  expect(lineEntry).toBeTruthy()

  // 验证待调度标记已写入
  const pending = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('poem-quiz-pending-recite') || '[]')
  )
  expect(pending).toContain('p001')

  // 直接离开（不点下一首），进入错题本
  await page.goto('/#/wrong')
  await page.waitForLoadState('load')
  await page.waitForTimeout(300)

  // 验证 recordAnswer 已补：records 含 p001（错误回答不增加 reviewCount，验证 quizResults 有 recite 条目）
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('poem-quiz-data') || '{}'))
  const record = data.records.find((r: any) => r.poemId === 'p001')
  expect(record).toBeTruthy()
  const reciteResult = data.quizResults.find((q: any) => q.poemId === 'p001' && q.quizType === 'recite')
  expect(reciteResult).toBeTruthy()
  expect(reciteResult.correct).toBe(false)
  // 待调度列表已清空
  const pendingAfter = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('poem-quiz-pending-recite') || '[]')
  )
  expect(pendingAfter).toEqual([])
})
