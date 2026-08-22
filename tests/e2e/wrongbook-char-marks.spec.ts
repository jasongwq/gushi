import { test, expect } from '@playwright/test'

// Helper: start recitation with "all" source
async function startRecitationWithAll(page: any) {
  await page.goto('/#/recitation/setup')
  await page.selectOption('select', 'all')
  await page.click('text=5 首')
  await page.click('text=开始抽背')
}

// Helper: 清空状态 → 开始抽背 → 把第一个汉字标记为 wrong → 提交第一首 → 进入错题本
// 返回时错题本应已渲染出该诗的错题卡片
async function reachWrongBookWithWrongChar(page: any) {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await page.waitForTimeout(500)

  await startRecitationWithAll(page)

  // 第一首诗出现，标记第一个汉字：第1次点击 → fuzzy，第2次点击 → wrong
  const charSpans = page.locator('.char-mark')
  await expect(charSpans.first()).toBeVisible({ timeout: 5000 })
  await charSpans.first().click()
  await charSpans.first().click()
  await expect(charSpans.first()).toHaveClass(/char-wrong/)

  // 标记一行「卡顿」使「下一首」可点，点击提交
  await page.locator('.recitation-card').locator('button:has-text("卡顿")').first().click()
  await expect(page.locator('button:has-text("下一首")')).toBeEnabled()
  await page.click('text=下一首')

  // 进入第二首，说明第一首已提交
  await expect(page.locator('text=第 2 / 5 首')).toBeVisible({ timeout: 5000 })

  // 直接导航到错题本（数据在提交时已持久化到 localStorage）
  await page.goto('/#/wrong')
  await expect(page.locator('h2')).toContainText('错题本')
}

test('wrong book: 背诵标记错字提交后，错题本显示角标', async ({ page }) => {
  test.setTimeout(60000)
  await reachWrongBookWithWrongChar(page)

  // 角标显示「错1字」（wrong 状态的字）；该字只标记过一次，无 fuzzy
  const charSummary = page.locator('[data-testid="char-summary"]')
  await expect(charSummary).toContainText('错1字', { timeout: 5000 })
  await expect(charSummary).toContainText('模糊0字')
})

test('wrong book: 点击诗题，弹窗内高亮字可见', async ({ page }) => {
  test.setTimeout(60000)
  await reachWrongBookWithWrongChar(page)

  // 角标出现后再点诗题（确保 poemStore 已加载，popup 才能拿到诗内容）
  await expect(page.locator('[data-testid="char-summary"]')).toContainText('错1字', { timeout: 5000 })

  await page.locator('[data-testid="poem-title"]').click()

  // 弹窗打开，wrong 状态的字高亮可见（fuzzy 无记录，不应出现）
  await expect(page.locator('.popup-char-wrong')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.popup-char-fuzzy')).not.toBeVisible()
})

test('wrong book: 点击错题类型标签，操作菜单可见', async ({ page }) => {
  test.setTimeout(60000)
  await reachWrongBookWithWrongChar(page)

  await expect(page.locator('[data-testid="char-summary"]')).toContainText('错1字', { timeout: 5000 })

  // 点击标签（背诵/第 N 句·状态标签都行，取第一个）
  await page.locator('[data-testid="wrong-entry-label"]').first().click()

  await expect(page.locator('[data-testid="entry-action-menu"]')).toBeVisible({ timeout: 5000 })
})

test('wrong book: 错题条目标签显示 note 格式', async ({ page }) => {
  test.setTimeout(60000)
  await reachWrongBookWithWrongChar(page)

  // 卡顿行条目标签显示「第 1 句·卡顿」
  const label = page.locator('[data-testid="wrong-entry-label"]', { hasText: '卡顿' })
  await expect(label).toHaveText('第 1 句·卡顿', { timeout: 5000 })
})

test('wrong book: 弹窗内卡顿行有行级颜色标注', async ({ page }) => {
  test.setTimeout(60000)
  await reachWrongBookWithWrongChar(page)

  await expect(page.locator('[data-testid="char-summary"]')).toContainText('错1字', { timeout: 5000 })
  await page.locator('[data-testid="poem-title"]').click()

  // 第一行（被标记卡顿）有 stuck 行级变色
  await expect(page.locator('.popup-line-stuck')).toBeVisible({ timeout: 5000 })
  // 字词高亮共存
  await expect(page.locator('.popup-char-wrong')).toBeVisible()
})

test('wrong book: 家长抽查标记错字后不点下一首，返回进错题本角标可见', async ({ page }) => {
  test.setTimeout(60000)
  // 清空状态
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await page.waitForTimeout(300)

  // 家长抽查 → 点卡片展开进入背诵
  await page.click('text=家长抽查')
  await expect(page.locator('.poem-card-page').first()).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 5000 })
  await page.evaluate(() => {
    const active = document.querySelector('.swiper-slide-active') as HTMLElement
    const rect = active.getBoundingClientRect()
    const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    ;(el as HTMLElement)?.click()
  })
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 5000 })

  // 标记第一个汉字为 wrong（dispatchEvent 绕过滚动区视口检查；点击两次：fuzzy → wrong）
  const charSpans = page.locator('.recitation-card .char-mark')
  await expect(charSpans.first()).toBeVisible({ timeout: 5000 })
  await charSpans.first().dispatchEvent('click')
  await charSpans.first().dispatchEvent('click')
  await expect(charSpans.first()).toHaveClass(/char-wrong/)

  // 不点下一首，直接返回浏览模式
  await page.locator('[data-testid="recite-back"]').dispatchEvent('click')
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 3000 })

  // 进错题本：错字角标应可见（字级标记已即时保存 + 进错题本聚合）
  // 先回首页再导航，避免从 poem-card 硬跳转 hash 路由的边界情况
  await page.goto('/')
  await page.goto('/#/wrong')
  await page.waitForTimeout(500)
  await expect(page.locator('h2', { hasText: '错题本' }).first()).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="char-summary"]')).toContainText('错1字', { timeout: 5000 })
})

test('wrong book: 家长抽查切到下一首，上一首的字级标记不残留', async ({ page }) => {
  test.setTimeout(60000)
  // 清空状态
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await page.waitForTimeout(300)

  // 家长抽查 → 点卡片展开进入背诵
  await page.click('text=家长抽查')
  await expect(page.locator('.poem-card-page').first()).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 5000 })
  await page.evaluate(() => {
    const active = document.querySelector('.swiper-slide-active') as HTMLElement
    const rect = active.getBoundingClientRect()
    const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    ;(el as HTMLElement)?.click()
  })
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 5000 })

  // 标记第一个汉字为 wrong（dispatchEvent 绕过滚动区视口检查；点击两次：fuzzy → wrong）
  const charSpans = page.locator('.recitation-card .char-mark')
  await expect(charSpans.first()).toBeVisible({ timeout: 5000 })
  await charSpans.first().dispatchEvent('click')
  await charSpans.first().dispatchEvent('click')
  await expect(charSpans.first()).toHaveClass(/char-wrong/)

  // 记录被标记的诗 ID（通过本地存储确认第一首诗的标记已按诗隔离保存）
  const markedPoem = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('poem-quiz-data') || '{}')
    return data.records?.[0]?.poemId ?? null
  })

  // 返回浏览模式 → 横向拖拽切到下一首 → 再点卡片进入背诵
  await page.locator('[data-testid="recite-back"]').dispatchEvent('click')
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 3000 })

  const swiperBox = await page.locator('.card-swiper').first().boundingBox()
  expect(swiperBox).toBeTruthy()
  const startX = swiperBox!.x + swiperBox!.width * 0.7
  const endX = swiperBox!.x + swiperBox!.width * 0.2
  const y = swiperBox!.y + swiperBox!.height / 2
  await page.mouse.move(startX, y)
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(startX + (endX - startX) * (i / 20), y)
  }
  await page.mouse.up()
  await page.waitForTimeout(600)

  // 诊断：滑动后当前 active slide 的标题
  const activeTitle = await page.evaluate(() => {
    const active = document.querySelector('.swiper-slide-active') as HTMLElement
    return active?.textContent?.slice(0, 30) ?? 'N/A'
  })
  console.log(`滑动后 active slide 文本: ${activeTitle}`)

  // 点当前卡片进入背诵模式
  await page.evaluate(() => {
    const active = document.querySelector('.swiper-slide-active') as HTMLElement
    const rect = active.getBoundingClientRect()
    const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    ;(el as HTMLElement)?.click()
  })
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 5000 })

  // 诊断：背诵模式当前 active slide 内的诗标题（限定 active，避免匹配隐藏 slide）
  const reciteTitle = await page.locator('.swiper-slide-active .recitation-card h2').textContent()
  console.log(`背诵模式当前诗标题: ${reciteTitle}`)

  // 当前 active 诗不应有被标记的 wrong 字（上一首的标记不残留）
  // 限定 active slide：Swiper 会渲染所有 slide 的 DOM，但只有 active 可见
  const wrongChars = await page.locator('.swiper-slide-active .recitation-card .char-wrong').count()
  expect(wrongChars).toBe(0)
  console.log(`active 诗 wrong 标记数: ${wrongChars}（上一首诗: ${markedPoem}）`)
})
