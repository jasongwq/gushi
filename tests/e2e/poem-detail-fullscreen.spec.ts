import { test, expect } from '@playwright/test'

// 辅助：进入古诗卡片页面并等待加载
async function enterPoemCardPage(page: any) {
  await page.goto('/#/poem-card')
  await expect(page.locator('.poem-card-page').first()).toBeVisible({ timeout: 5000 })
}

// 辅助：进入背诵模式（点击 active slide 中心的卡片）
async function enterReciteFromSwiper(page: any) {
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 5000 })
  // 点击 active slide 中心的卡片（避免匹配到屏幕外的复制 slide）
  await page.evaluate(() => {
    const active = document.querySelector('.swiper-slide-active') as HTMLElement
    const rect = active.getBoundingClientRect()
    const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    ;(el as HTMLElement)?.click()
  })
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })
}

// 辅助：获取 active slide 的布局信息
async function getActiveSlideInfo(page: any) {
  return await page.evaluate(() => {
    const slide = document.querySelector('.swiper-slide-active') as HTMLElement
    if (!slide) return null
    const rect = slide.getBoundingClientRect()
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      offsetWidth: slide.offsetWidth,
    }
  })
}

// 辅助：获取 Swiper 容器宽度
async function getSwiperContainerWidth(page: any): Promise<number> {
  return await page.evaluate(() => {
    const swiper = document.querySelector('.swiper') as HTMLElement
    return swiper?.offsetWidth ?? 0
  })
}

// ====== 核心功能：点击展开全屏 ======

test('浏览模式 slide 为 65% 宽度（coverflow）', async ({ page }) => {
  await enterPoemCardPage(page)

  const containerWidth = await getSwiperContainerWidth(page)
  const browse = await getActiveSlideInfo(page)
  expect(browse).toBeTruthy()
  const b = browse!
  expect(b.width).toBeGreaterThan(0)
  // 浏览模式下 slide 宽度约为容器的 65%
  expect(b.width / containerWidth).toBeLessThan(0.8)

  // Swiper 有 coverflow 类
  const hasCoverflow = await page.evaluate(() => {
    const el = document.querySelector('.card-swiper')
    return el?.classList.contains('swiper-coverflow') ?? false
  })
  expect(hasCoverflow).toBe(true)
})

test('点击卡片后 slide 真正全屏（宽度 100%、覆盖容器）', async ({ page }) => {
  await enterPoemCardPage(page)

  const containerWidth = await getSwiperContainerWidth(page)
  const browse = await getActiveSlideInfo(page)
  expect(browse.width / containerWidth).toBeLessThan(0.8)

  // 点击进入背诵
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  // 展开后 slide 宽度应等于容器宽度（100%）
  const expanded = await getActiveSlideInfo(page)
  expect(expanded.width / containerWidth).toBeGreaterThan(0.9)

  // slide 左边缘与容器对齐，右边缘超出容器（因为 loop 复制了很多 slide）
  // 关键：active slide 的宽度 = 容器宽度 = 全屏
  expect(Math.abs(expanded.width - containerWidth)).toBeLessThan(2)
})

test('点击卡片后 RecitationCard 在 viewport 内且全宽', async ({ page }) => {
  await enterPoemCardPage(page)

  // 点击进入背诵
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  // 获取 active slide 内的 RecitationCard 位置
  const info = await page.evaluate(() => {
    const activeSlide = document.querySelector('.swiper-slide-active')
    const recCard = activeSlide?.querySelector('.recitation-card')
    if (!recCard) return null
    const slideRect = activeSlide!.getBoundingClientRect()
    const recRect = recCard.getBoundingClientRect()
    return {
      viewportWidth: document.documentElement.clientWidth,
      slideLeft: slideRect.left,
      slideRight: slideRect.right,
      slideWidth: slideRect.width,
      recLeft: recRect.left,
      recRight: recRect.right,
      recWidth: recRect.width,
    }
  })
  expect(info).toBeTruthy()
  const i = info!

  // RecitationCard 与 active slide 位置一致（全屏，不偏出）
  expect(Math.abs(i.recLeft - i.slideLeft)).toBeLessThan(2)
  expect(Math.abs(i.recRight - i.slideRight)).toBeLessThan(2)
  // RecitationCard 宽度 = slide 宽度 = 容器全宽
  expect(Math.abs(i.recWidth - i.slideWidth)).toBeLessThan(2)
})

test('点击卡片后 Swiper 重建为 slide 效果（无 coverflow 类）', async ({ page }) => {
  await enterPoemCardPage(page)

  // 点击进入背诵
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  const classes = await page.evaluate(() => {
    const el = document.querySelector('.card-swiper')
    return el ? [...el.classList] : []
  })

  // 背诵模式：不应再有 coverflow/3d 类，应有 is-fullscreen
  expect(classes.some(c => c.includes('coverflow'))).toBe(false)
  expect(classes.includes('is-fullscreen')).toBe(true)
})

test('点击卡片后 RecitationCard 高度占满可用空间', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await enterPoemCardPage(page)

  // 点击进入背诵
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  const info = await page.evaluate(() => {
    const viewportH = document.documentElement.clientHeight
    const topbar = document.querySelector('.poem-card-page > div > div:first-child') as HTMLElement | null
    const bottomBar = document.querySelector('.poem-card-page .bg-white.border-t') as HTMLElement | null
    const recCard = document.querySelector('.swiper-slide-active .recitation-card') as HTMLElement | null
    if (!recCard) return null
    const recRect = recCard.getBoundingClientRect()
    const topbarBottom = topbar?.getBoundingClientRect().bottom ?? 0
    const bottomBarTop = bottomBar?.getBoundingClientRect().top ?? viewportH
    return {
      viewportH,
      recTop: Math.round(recRect.top),
      recBottom: Math.round(recRect.bottom),
      recHeight: Math.round(recRect.height),
      topbarBottom: Math.round(topbarBottom),
      bottomBarTop: Math.round(bottomBarTop),
      availableHeight: Math.round(bottomBarTop - topbarBottom),
      // RecitationCard 高度应接近卡片区域高度（至少 90%）
      heightRatio: recRect.height / Math.max(1, bottomBarTop - topbarBottom),
    }
  })
  expect(info).toBeTruthy()
  const i = info!

  // 背诵模式隐藏筛选栏后，卡片区域应占大部分屏幕
  expect(i.topbarBottom).toBeLessThan(i.viewportH * 0.1)
  // RecitationCard 高度应达到卡片区域高度的 95% 以上
  expect(i.heightRatio).toBeGreaterThan(0.95)
  // RecitationCard 底部不超出卡片区域
  expect(i.recBottom).toBeLessThanOrEqual(i.bottomBarTop + 1)
})

test('背诵模式点击卡顿按钮不缩回且能标记', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()

  await page.goto('/#/poem-card')
  await expect(page.locator('.poem-card-page').first()).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(500)

  // 进入背诵（点击 active slide 中心的卡片）
  await page.evaluate(() => {
    const active = document.querySelector('.swiper-slide-active') as HTMLElement
    const rect = active.getBoundingClientRect()
    const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    ;(el as HTMLElement)?.click()
  })
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })
  await page.waitForTimeout(600)

  // 触摸点击卡顿按钮
  const stuckBtn = page.locator('.swiper-slide-active').locator('.recitation-card').locator('button', { hasText: '卡顿' }).first()
  const box = await stuckBtn.boundingBox()
  expect(box).toBeTruthy()
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.waitForTimeout(500)

  // 应该仍在背诵模式（没有缩回）
  expect(await page.locator('.recitation-card').count()).toBeGreaterThan(0)

  // 卡顿按钮应被标记（黄色边框）
  const stuckMarked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.recitation-card button')]
      .find(b => b.textContent === '卡顿' && (b as HTMLElement).getBoundingClientRect().left >= 0)
    return btn ? [...btn.classList].includes('border-yellow-500') : false
  })
  expect(stuckMarked).toBe(true)

  await context.close()
})

test('背诵模式点击熟练按钮提交后不误缩回', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()

  await page.goto('/#/poem-card')
  await expect(page.locator('.poem-card-page').first()).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(500)

  // 进入背诵
  await page.evaluate(() => {
    const active = document.querySelector('.swiper-slide-active') as HTMLElement
    const rect = active.getBoundingClientRect()
    const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    ;(el as HTMLElement)?.click()
  })
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })
  await page.waitForTimeout(600)

  // 鼠标点击熟练按钮（应提交成功，不缩回浏览）
  const masterBtn = page.locator('.swiper-slide-active').locator('.recitation-card').locator('button', { hasText: '熟练' }).first()
  const box = await masterBtn.boundingBox()
  expect(box).toBeTruthy()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.waitForTimeout(500)

  // 不应缩回浏览模式
  expect(await page.locator('.recitation-card').count()).toBeGreaterThan(0)

  await context.close()
})

test('背诵模式水平滑动切诗、上滑缩回', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()

  await page.goto('/#/poem-card')
  await expect(page.locator('.poem-card-page').first()).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(500)

  // 进入背诵
  await page.evaluate(() => {
    const active = document.querySelector('.swiper-slide-active') as HTMLElement
    const rect = active.getBoundingClientRect()
    const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    ;(el as HTMLElement)?.click()
  })
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })
  await page.waitForTimeout(600)

  const cdp = await page.context().newCDPSession(page)
  const box = await page.locator('.card-swiper').boundingBox()
  const cx = box!.x + box!.width / 2
  const cy = box!.y + box!.height / 2

  // 1. 水平左滑 → 切诗（进度变化），不缩回
  const progressBefore = await page.locator('[data-testid="detail-progress"]').textContent()
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx + 100, y: cy }] })
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + 100 - 20 * i, y: cy }] })
    await new Promise(r => setTimeout(r, 16))
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(600)

  // 不缩回（仍在背诵）
  expect(await page.locator('.recitation-card').count()).toBeGreaterThan(0)
  // 进度变化 = 切到下一首
  const progressAfter = await page.locator('[data-testid="detail-progress"]').textContent()
  expect(progressAfter).not.toBe(progressBefore)

  // 2. 上滑 → 缩回浏览模式
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] })
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy - 20 * i }] })
    await new Promise(r => setTimeout(r, 16))
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(600)

  // 应缩回浏览模式
  expect(await page.locator('.recitation-card').count()).toBe(0)
  expect(await page.locator('.poem-card').count()).toBeGreaterThan(0)

  await cdp.detach()
  await context.close()
})

test('背诵模式允许水平滑动切诗（allowTouchMove 为 true）', async ({ page }) => {
  await enterPoemCardPage(page)

  // 初始 allowTouchMove 为 true（coverflow 浏览模式）
  const touchBefore = await page.evaluate(() => {
    const swiper = (document.querySelector('.swiper') as any)?.swiper
    return swiper?.allowTouchMove
  })
  expect(touchBefore).toBe(true)

  // 点击进入背诵
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  // 背诵模式也允许水平滑动切诗
  const touchAfter = await page.evaluate(() => {
    const swiper = (document.querySelector('.swiper') as any)?.swiper
    return swiper?.allowTouchMove
  })
  expect(touchAfter).toBe(true)
})

test('点击返回按钮缩回到浏览模式（宽度恢复 65%、coverflow 恢复）', async ({ page }) => {
  await enterPoemCardPage(page)
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  const containerWidth = await getSwiperContainerWidth(page)

  // 点击返回按钮（背诵模式顶部精简返回条）
  await page.locator('[data-testid="recite-back"]').dispatchEvent('click')
  await page.waitForTimeout(500)

  // 应该回到浏览模式 - PoemCard 可见
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 3000 })

  // 宽度应该恢复为 65%
  const browse = await getActiveSlideInfo(page)
  expect(browse.width / containerWidth).toBeLessThan(0.8)

  // coverflow 类恢复
  const classes = await page.evaluate(() => {
    const el = document.querySelector('.card-swiper')
    return el ? [...el.classList] : []
  })
  expect(classes.some(c => c.includes('coverflow'))).toBe(true)
  expect(classes.includes('is-fullscreen')).toBe(false)
})

test('展开-缩回-再展开循环正常', async ({ page }) => {
  await enterPoemCardPage(page)

  const containerWidth = await getSwiperContainerWidth(page)

  // 第一次展开
  await enterReciteFromSwiper(page)
  await page.waitForTimeout(500)

  let expanded = await getActiveSlideInfo(page)
  expect(expanded.width / containerWidth).toBeGreaterThan(0.9)

  // 缩回（背诵模式顶部精简返回条）
  await page.locator('[data-testid="recite-back"]').dispatchEvent('click')
  await page.waitForTimeout(500)

  // 等待 PoemCard 可见
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 3000 })

  // 再次展开
  await page.locator('.poem-card').first().dispatchEvent('click')
  await page.waitForTimeout(500)
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })

  expanded = await getActiveSlideInfo(page)
  expect(expanded.width / containerWidth).toBeGreaterThan(0.9)
})

test('水平滑动切诗后 RecitationCard 内容更新为下一首', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()

  await page.goto('/#/poem-card')
  await expect(page.locator('.poem-card-page').first()).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(500)

  // 进入背诵（点击 active slide 中心的卡片）
  await page.evaluate(() => {
    const active = document.querySelector('.swiper-slide-active') as HTMLElement
    const rect = active.getBoundingClientRect()
    const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    ;(el as HTMLElement)?.click()
  })
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })
  await page.waitForTimeout(600)

  // 记录当前诗标题
  const titleBefore = await page.evaluate(() => {
    const active = document.querySelector('.swiper-slide-active')
    return active?.querySelector('.recitation-card h2')?.textContent?.trim() ?? ''
  })
  expect(titleBefore).toBeTruthy()

  // 水平左滑切到下一首
  const cdp = await page.context().newCDPSession(page)
  const box = await page.locator('.card-swiper').boundingBox()
  const cx = box!.x + box!.width / 2
  const cy = box!.y + box!.height / 2
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx + 100, y: cy }] })
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + 100 - 20 * i, y: cy }] })
    await new Promise(r => setTimeout(r, 16))
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(800)

  // 记录切换后标题
  const titleAfter = await page.evaluate(() => {
    const active = document.querySelector('.swiper-slide-active')
    return active?.querySelector('.recitation-card h2')?.textContent?.trim() ?? ''
  })

  // 内容应切换为下一首诗
  expect(titleAfter).toBeTruthy()
  expect(titleAfter).not.toBe(titleBefore)

  await cdp.detach()
  await context.close()
})

test('背诵模式长诗正文可滚动，4 按钮固定在底部', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()

  await page.goto('/#/poem-card')
  await expect(page.locator('.poem-card-page').first()).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.poem-card').first()).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(500)

  // 进入背诵（点击 active slide 中心的卡片）
  await page.evaluate(() => {
    const active = document.querySelector('.swiper-slide-active') as HTMLElement
    const rect = active.getBoundingClientRect()
    const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    ;(el as HTMLElement)?.click()
  })
  await expect(page.locator('.recitation-card').first()).toBeVisible({ timeout: 3000 })
  await page.waitForTimeout(600)

  // 布局断言：根节点 flex，正文区可滚动，按钮区固定在底部
  const layout = await page.evaluate(() => {
    const card = document.querySelector('.swiper-slide-active .recitation-card')
    if (!card) return null
    const rootClasses = [...card.classList].join(' ')
    const scrollArea = card.querySelector('.overflow-y-auto')
    const buttons = [...card.querySelectorAll('button')]
    // Vue 模板会在按钮文字周围渲染空白，需 trim
    const masteredBtn = buttons.find(b => b.textContent?.trim() === '熟练')
    // 底部按钮行最后一个（下一首）是卡片里最靠下的元素
    const lastBtn = buttons[buttons.length - 1]
    const scrollAreaBottom = scrollArea?.getBoundingClientRect().bottom ?? 0
    const masteredTop = masteredBtn?.getBoundingClientRect().top ?? 0
    const lastBtnBottom = lastBtn?.getBoundingClientRect().bottom ?? 0
    const cardBottom = card.getBoundingClientRect().bottom
    const viewportH = document.documentElement.clientHeight
    const h2 = card.querySelector('h2')
    const titleAreaText = h2?.parentElement?.textContent ?? ''
    return {
      rootClasses,
      hasScrollArea: !!scrollArea,
      scrollHeight: scrollArea?.scrollHeight ?? 0,
      scrollClientHeight: scrollArea?.clientHeight ?? 0,
      masteredTop: Math.round(masteredTop),
      lastBtnBottom: Math.round(lastBtnBottom),
      cardBottom: Math.round(cardBottom),
      viewportH,
      // 熟练按钮在正文滚动区下方（不在正文末尾，属于固定的底部按钮区）
      masteredBelowScrollArea: masteredTop > scrollAreaBottom,
      // 底部按钮行紧贴卡片底边（卡片内按钮下方无残留内容）
      lastBtnNearCardBottom: cardBottom - lastBtnBottom < 40,
      // 卡片底部接近视口底部（卡片占满可用高度，而非只包住正文）
      cardNearViewportBottom: viewportH - cardBottom < 120,
      // 作者/朝代与标题同处标题区（h2 父容器包含「朝代 · 作者」）
      authorInTitle: (() => {
        if (!h2) return false
        return titleAreaText.includes(h2.textContent ?? '') && titleAreaText.includes('·')
      })(),
    }
  })
  expect(layout).toBeTruthy()
  const l = layout!
  expect(l.rootClasses).toContain('flex-col')
  expect(l.hasScrollArea).toBe(true)
  // 熟练按钮在正文滚动区下方（按钮区不在正文末尾、固定于卡片底部）
  expect(l.masteredBelowScrollArea).toBe(true)
  // 底部按钮行紧贴卡片底边，且卡片占满可用高度 → 按钮不会随正文滚动
  expect(l.lastBtnNearCardBottom).toBe(true)
  expect(l.cardNearViewportBottom).toBe(true)
  // 作者/朝代在标题下方（与标题同一标题区）
  expect(l.authorInTitle).toBe(true)

  await context.close()
})
