import { test, expect } from '@playwright/test'

// 清空状态
async function cleanState(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await page.waitForTimeout(500)
}

test('self practice: recite-only mode reveals step by step and submits', async ({ page }) => {
  test.setTimeout(60000)
  await cleanState(page)

  await page.goto('/#/quiz/setup?mode=self')
  await page.waitForSelector('select', { timeout: 10000 })
  await page.selectOption('select', 'all')

  // 只勾选「古诗背诵」：先取消默认勾选的 补字选择 和 上下句接龙，再勾选 古诗背诵
  await page.locator('label:has-text("补字选择") input').click()
  await page.locator('label:has-text("上下句接龙") input').click()
  await page.locator('label:has-text("古诗背诵") input').click()

  await page.click('text=5')
  await page.click('text=开始抽查')

  // 背诵题初始仅标题，作者隐藏
  await expect(page.locator('.recitation-card')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.recitation-card').locator('h2')).toBeVisible()
  await expect(page.locator('.recitation-card').locator('text=作者 · ？？')).toBeVisible()

  // 点击标题区 → 显示作者
  await page.locator('.recitation-card h2').click()
  await expect(page.locator('.recitation-card').locator('text=作者 · ？？')).not.toBeVisible()

  // 再点击 → 显示译文
  await page.locator('.recitation-card h2').click()
  await expect(page.locator('.recitation-card .bg-gray-50')).toBeVisible()

  // 再点击 → 显示正文和自评按钮
  await page.locator('.recitation-card h2').click()
  await expect(page.locator('.recitation-card').locator('button:has-text("卡顿")').first()).toBeVisible()
  await expect(page.locator('button:has-text("熟练")')).toBeVisible()

  // 自评熟练
  await page.locator('button:has-text("熟练")').click()

  // 圆点状态
  await expect(page.locator('.dot.correct')).toHaveCount(1)
})

test('self practice: mixed recite+nextLine completes to result page', async ({ page }) => {
  test.setTimeout(60000)
  await cleanState(page)

  await page.goto('/#/quiz/setup?mode=self')
  await page.waitForSelector('select', { timeout: 10000 })
  await page.selectOption('select', 'all')

  // 勾选古诗背诵 + 上下句接龙，取消补字选择
  await page.locator('label:has-text("补字选择") input').click()
  await page.locator('label:has-text("古诗背诵") input').click()

  await page.click('text=5')
  await page.click('text=开始抽查')

  // 用圆点数量验证有题目
  await expect(page.locator('.dot').first()).toBeVisible({ timeout: 5000 })
  const dotCount = await page.locator('.dot').count()
  expect(dotCount).toBeGreaterThan(0)

  // 逐题推进：背诵题连点3次揭示后点熟练；选择题点第一个选项；直到结果页
  // 注意：选项题答错后会停留约 1.5s 展示反馈，必须等当前圆点推进后再进入下一轮，
  // 否则会点到处于反馈态（仍可见）的选项按钮，造成重复作答。
  let finished = false
  for (let i = 0; i < 30 && !finished; i++) {
    // 结果页没有进度圆点 → 结束
    if ((await page.locator('.dot.current').count()) === 0) {
      finished = true
      break
    }
    // 等待当前题渲染（背诵卡或选项题）
    await page.locator('.recitation-card, .option-btn').first().waitFor({ state: 'visible', timeout: 8000 })
    const currentNum = await page.locator('.dot.current').textContent()

    const reciteCard = page.locator('.recitation-card')
    if (await reciteCard.isVisible().catch(() => false)) {
      await reciteCard.locator('h2').click()
      await reciteCard.locator('h2').click()
      await reciteCard.locator('h2').click()
      await page.locator('button:has-text("熟练")').click()
    } else {
      await page.locator('.option-btn').first().click()
    }

    // 等待推进：当前圆点变为下一题，或圆点消失（已进入结果页）
    await page.waitForFunction(
      (prev) => {
        const cur = document.querySelector('.dot.current')
        return !cur || (cur.textContent || '') !== prev
      },
      currentNum,
      { timeout: 8000 }
    )
  }

  await expect(page.locator('h2')).toContainText('抽查结果')
  await expect(page.locator('.text-5xl')).toBeVisible()
  // 背诵条目（无“你的答案”明细行）渲染在结果页
  const reciteRows = page.locator('.border-l-4').filter({ hasNotText: '你的答案' })
  await expect(reciteRows.first()).toBeVisible()
})
