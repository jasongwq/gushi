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
  await page.locator('button:has-text("返回")').first().click()

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

test('partial reveal: swipe only between revealed poems', async ({ page }) => {
  await enterPoemCardPage(page)
  await switchToMysteryMode(page)

  // 开2个盒子
  await openOneBox(page)
  await openOneBox(page)

  // 点击已开盒进入背诵
  const revealedBox = page.locator('.mystery-boxes button[data-state="revealed"]').first()
  await revealedBox.click()
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })

  // 进度 1/2
  const progressText = page.locator('[data-testid="detail-progress"]')
  await expect(progressText).toHaveText('1/2', { timeout: 3000 })

  // 标记熟练后进入下一首
  await page.locator('.recitation-card button:has-text("熟练")').click()

  // 进度应该变成 2/2
  await expect(progressText).toHaveText('2/2', { timeout: 3000 })

  // 再标记熟练后应该回到盲盒
  await page.locator('.recitation-card button:has-text("熟练")').click()
  await expect(page.locator('.mystery-boxes')).toBeVisible({ timeout: 3000 })
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

  // 点击 "全部古诗" 按钮
  await page.locator('button:has-text("全部古诗")').click()

  // 进度应该变成全局古诗数量
  const newProgressText = await progressText.textContent()
  // 不再是 1/1，而是更大的数字
  expect(newProgressText).not.toBe('1/1')
})
