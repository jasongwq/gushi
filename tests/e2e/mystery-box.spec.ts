import { test, expect } from '@playwright/test'

// 辅助：进入古诗卡片页面并等待加载
async function enterPoemCardPage(page: any) {
  await page.goto('/#/poem-card')
  // 等待古诗数据加载完成（滑动模式或筛选栏出现）
  await expect(page.locator('.poem-card-page').first()).toBeVisible({ timeout: 5000 })
}

// 辅助：切换到盲盒模式
async function switchToMysteryMode(page: any) {
  await page.locator('button:has-text("盲盒")').click()
  await expect(page.locator('.mystery-boxes')).toBeVisible({ timeout: 3000 })
}

// 辅助：开一个盲盒（点击关闭状态的盒子）
async function openOneBox(page: any) {
  const revealedCountBefore = await page.locator('.mystery-boxes button[data-state="revealed"]').count()
  const closedBox = page.locator('.mystery-boxes button[data-state="closed"]').first()
  await closedBox.click()
  // 等待开盒动画完成并确认 revealed 数量增加
  await expect(page.locator('.mystery-boxes button[data-state="revealed"]')).toHaveCount(revealedCountBefore + 1, { timeout: 3000 })
}

// 辅助：获取已开盒数量
async function getRevealedBoxCount(page: any): Promise<number> {
  return page.locator('.mystery-boxes button[data-state="revealed"]').count()
}

// 辅助：获取未开盒数量
async function getClosedBoxCount(page: any): Promise<number> {
  return page.locator('.mystery-boxes button[data-state="closed"]').count()
}

// 辅助：获取当前 active slide 中背诵卡片的古诗标题
// （loop 模式下隐藏 slide 也在 DOM 中且含 h2，必须从 .swiper-slide-active 取）
async function activeSlideTitle(page: any): Promise<string | null> {
  return page.evaluate(() => {
    const active = document.querySelector('.card-swiper .swiper-slide-active')
    return active?.querySelector('h2')?.textContent ?? null
  })
}

test('switch to mystery mode shows 4 closed boxes', async ({ page }) => {
  await enterPoemCardPage(page)
  await switchToMysteryMode(page)

  // 应该有4个盒子
  const boxes = page.locator('.mystery-boxes button')
  await expect(boxes).toHaveCount(4)

  // 所有盒子都是关闭状态
  const closedBoxes = await getClosedBoxCount(page)
  expect(closedBoxes).toBe(4)
})

test('clicking closed box reveals it', async ({ page }) => {
  await enterPoemCardPage(page)
  await switchToMysteryMode(page)

  // 点击第一个盒子
  await openOneBox(page)

  // 应该有一个已开盒
  const revealedCount = await getRevealedBoxCount(page)
  expect(revealedCount).toBe(1)

  // 应该有3个未开盒
  const closedCount = await getClosedBoxCount(page)
  expect(closedCount).toBe(3)
})

test('clicking revealed box enters recite mode', async ({ page }) => {
  await enterPoemCardPage(page)
  await switchToMysteryMode(page)

  // 开一个盒子
  await openOneBox(page)

  // 点击已开盒的盒子进入背诵
  const revealedBox = page.locator('.mystery-boxes button[data-state="revealed"]').first()
  await revealedBox.click()

  // 应该进入背诵模式
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })
})

test('returning from recite to mystery preserves blind box state', async ({ page }) => {
  await enterPoemCardPage(page)
  await switchToMysteryMode(page)

  // 开2个盒子
  await openOneBox(page)
  await openOneBox(page)

  // 记录已开盒数量
  const revealedBefore = await getRevealedBoxCount(page)
  expect(revealedBefore).toBe(2)

  // 点击已开盒进入背诵
  const revealedBox = page.locator('.mystery-boxes button[data-state="revealed"]').first()
  await revealedBox.click()
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })

  // 点击返回
  await page.locator('[data-testid="recite-back"]').click()

  // 应该回到盲盒模式
  await expect(page.locator('.mystery-boxes')).toBeVisible({ timeout: 3000 })

  // 已开盒数量应该保持不变
  const revealedAfter = await getRevealedBoxCount(page)
  expect(revealedAfter).toBe(2)

  // 未开盒数量也应该保持
  const closedAfter = await getClosedBoxCount(page)
  expect(closedAfter).toBe(2)
})

test('partial reveal: progress shows only revealed count', async ({ page }) => {
  await enterPoemCardPage(page)
  await switchToMysteryMode(page)

  // 开2个盒子
  await openOneBox(page)
  await openOneBox(page)

  // 点击已开盒进入背诵
  const revealedBox = page.locator('.mystery-boxes button[data-state="revealed"]').first()
  await revealedBox.click()
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })

  // 进度应该显示 1/2（当前第1首，共2首已开盒）
  const progressText = page.locator('[data-testid="detail-progress"]')
  await expect(progressText).toHaveText('1/2', { timeout: 3000 })
})

test('partial reveal: progress shows revealed count', async ({ page }) => {
  test.setTimeout(60000)
  await enterPoemCardPage(page)
  await switchToMysteryMode(page)

  // 开2个盒子
  await openOneBox(page)
  await openOneBox(page)

  // 点击已开盒进入背诵
  const revealedBox = page.locator('.mystery-boxes button[data-state="revealed"]').first()
  await revealedBox.click()
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })
  await page.waitForTimeout(500)

  // 进度 1/2（只有2首已开盒）
  const progressText = page.locator('[data-testid="detail-progress"]')
  await expect(progressText).toHaveText('1/2', { timeout: 3000 })

  // 返回盲盒
  await page.locator('[data-testid="recite-back"]').click()
  await expect(page.locator('.mystery-boxes')).toBeVisible({ timeout: 3000 })

  // 已开盒数量保持不变
  const revealedAfter = await getRevealedBoxCount(page)
  expect(revealedAfter).toBe(2)
})

test('returning from recite via "返回盲盒" button preserves state', async ({ page }) => {
  await enterPoemCardPage(page)
  await switchToMysteryMode(page)

  // 开1个盒子
  await openOneBox(page)

  // 点击已开盒进入背诵
  const revealedBox = page.locator('.mystery-boxes button[data-state="revealed"]').first()
  await revealedBox.click()
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })

  // 点击 "返回盲盒" 按钮
  await page.locator('button:has-text("返回盲盒")').click()

  // 应该回到盲盒模式
  await expect(page.locator('.mystery-boxes')).toBeVisible({ timeout: 3000 })

  // 已开盒数量应该保持
  const revealedCount = await getRevealedBoxCount(page)
  expect(revealedCount).toBe(1)
})

test('all revealed: progress shows 4 poems', async ({ page }) => {
  await enterPoemCardPage(page)
  await switchToMysteryMode(page)

  // 开4个盒子
  for (let i = 0; i < 4; i++) {
    await openOneBox(page)
  }

  // 点击已开盒进入背诵
  const revealedBox = page.locator('.mystery-boxes button[data-state="revealed"]').first()
  await revealedBox.click()
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })

  // 进度应该显示 1/4
  const progressText = page.locator('[data-testid="detail-progress"]')
  await expect(progressText).toHaveText('1/4', { timeout: 3000 })
})

test('all revealed: "再抽一轮" button appears', async ({ page }) => {
  await enterPoemCardPage(page)
  await switchToMysteryMode(page)

  // 开4个盒子
  for (let i = 0; i < 4; i++) {
    await openOneBox(page)
  }

  // 应该出现 "再抽一轮" 按钮
  await expect(page.locator('button:has-text("再抽一轮")')).toBeVisible({ timeout: 3000 })
})

test('switch to global mode from mystery recite', async ({ page }) => {
  await enterPoemCardPage(page)
  await switchToMysteryMode(page)

  // 开1个盒子
  await openOneBox(page)

  // 点击已开盒进入背诵
  const revealedBox = page.locator('.mystery-boxes button[data-state="revealed"]').first()
  await revealedBox.click()
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })

  // 进度应该显示 1/1（只有1首已开盒）
  const progressText = page.locator('[data-testid="detail-progress"]')
  await expect(progressText).toHaveText('1/1', { timeout: 3000 })

  // 记录当前背诵的古诗标题（active slide）
  const boxTitles = await page.locator('.mystery-boxes button[data-state="revealed"] span.font-bold').allTextContents()
  await expect.poll(() => activeSlideTitle(page), { timeout: 5000 }).toBe(boxTitles[0])
  const poemTitleBefore = boxTitles[0]

  // 点击 "全部古诗" 按钮
  await page.locator('button:has-text("全部古诗")').click()

  // 进度应该变成全局古诗数量（不再是 1/1，而是更大的数字）
  await expect
    .poll(async () => progressText.textContent(), { timeout: 5000 })
    .not.toBe('1/1')

  // 切换后应保持当前古诗不变（全局列表定位到同一首）
  await expect.poll(() => activeSlideTitle(page), { timeout: 5000 }).toBe(poemTitleBefore)
})

test('all revealed: clicking each box enters the matching poem detail', async ({ page }) => {
  test.setTimeout(90000)
  await enterPoemCardPage(page)
  await switchToMysteryMode(page)

  // 开4个盒子
  for (let i = 0; i < 4; i++) {
    await openOneBox(page)
  }

  // 记录每个盒子显示的标题（视觉顺序 = boxes 数组顺序）
  const boxTitles = await page.locator('.mystery-boxes button[data-state="revealed"] span.font-bold').allTextContents()
  expect(boxTitles).toHaveLength(4)

  // 依次点击每个盒子，验证进入的详情标题与点击盒子一致
  for (let i = 0; i < 4; i++) {
    const boxTitle = boxTitles[i]
    await page.locator('.mystery-boxes button[data-state="revealed"]').nth(i).click()
    await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })
    // 轮询等待 Swiper 定位到目标诗（onSwiper 对齐 + 过渡完成，状态驱动而非固定 sleep）
    await expect.poll(() => activeSlideTitle(page), { timeout: 5000 }).toBe(boxTitle)

    // 返回盲盒，继续下一个
    await page.locator('[data-testid="recite-back"]').click()
    await expect(page.locator('.mystery-boxes')).toBeVisible({ timeout: 3000 })
  }
})

test('all revealed: last box then 下一首 returns to mystery', async ({ page }) => {
  test.setTimeout(60000)
  await enterPoemCardPage(page)
  await switchToMysteryMode(page)

  // 开4个盒子
  for (let i = 0; i < 4; i++) {
    await openOneBox(page)
  }

  // 点击右下角（第4个）盒子进入背诵
  await page.locator('.mystery-boxes button[data-state="revealed"]').nth(3).click()
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })
  // 轮询等待定位到最后一首
  const boxTitles = await page.locator('.mystery-boxes button[data-state="revealed"] span.font-bold').allTextContents()
  await expect.poll(() => activeSlideTitle(page), { timeout: 5000 }).toBe(boxTitles[3])

  // 进度应显示 4/4（最后一首）
  const progressText = page.locator('[data-testid="detail-progress"]')
  await expect(progressText).toHaveText('4/4', { timeout: 3000 })

  // 点击「熟练」提交最后一首 → 应回到盲盒
  await page.evaluate(() => {
    const active = document.querySelector('.card-swiper .swiper-slide-active')
    const btn = [...(active?.querySelectorAll('button') ?? [])].find(b => b.textContent?.includes('熟练'))
    btn?.click()
  })
  await expect(page.locator('.mystery-boxes')).toBeVisible({ timeout: 5000 })
})
