import { test, expect } from '@playwright/test'

// Helper: wait for poems to load (grade tabs appear)
async function waitForPoems(page: import('@playwright/test').Page) {
  await page.locator('.grade-tabs button').first().waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForTimeout(500)
}

// === 首页入口 ===

test('home page has 古诗集合 entry', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=古诗集合')).toBeVisible()
})

test('navigate to poem collection from home', async ({ page }) => {
  await page.goto('/')
  await page.click('text=古诗集合')
  await expect(page.locator('h2')).toContainText('古诗集合')
})

// === 设置页入口 ===

test('settings page has 古诗配置 entry', async ({ page }) => {
  await page.goto('/#/settings')
  await expect(page.locator('text=古诗配置')).toBeVisible()
})

test('navigate to poem config from settings', async ({ page }) => {
  await page.goto('/#/settings')
  await page.click('text=古诗配置')
  await expect(page.locator('h2')).toContainText('古诗配置')
})

// === 古诗集合浏览页 ===

test.describe('poem collection page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/poems')
    await waitForPoems(page)
  })

  test('displays grade tabs', async ({ page }) => {
    const tabs = page.locator('.grade-tabs button')
    await expect(tabs).toHaveCount(7)
  })

  test('first grade tab is active by default', async ({ page }) => {
    const activeTab = page.locator('.grade-tabs button.text-white')
    await expect(activeTab).toHaveCount(1)
  })

  test('switching grade tab shows different poems', async ({ page }) => {
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const firstPoemBefore = await page.locator('.space-y-2 > div').first().textContent()
    await page.locator('.grade-tabs button').nth(1).click()
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const firstPoemAfter = await page.locator('.space-y-2 > div').first().textContent()
    expect(firstPoemBefore).not.toBe(firstPoemAfter)
  })

  test('displays poem list with title and author info', async ({ page }) => {
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const firstPoem = page.locator('.space-y-2 > div').first()
    await expect(firstPoem.locator('span.font-bold')).toBeVisible()
    await expect(firstPoem.locator('text=·')).toBeVisible()
  })

  test('displays mastery level badge', async ({ page }) => {
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const firstPoem = page.locator('.space-y-2 > div').first()
    await expect(firstPoem.locator('text=新')).toBeVisible()
  })

  test('clicking poem title opens popup', async ({ page }) => {
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const titleSpan = page.locator('.space-y-2 > div').first().locator('span.font-bold')
    await titleSpan.click()
    await expect(page.locator('.popup-overlay')).toBeVisible()
    await expect(page.locator('.popup-title')).toBeVisible()
    await expect(page.locator('.popup-body')).toBeVisible()
  })

  test('popup shows poem full text', async ({ page }) => {
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const titleSpan = page.locator('.space-y-2 > div').first().locator('span.font-bold')
    await titleSpan.click()
    await expect(page.locator('.popup-overlay')).toBeVisible()
    await expect(page.locator('.popup-line').first()).toBeVisible()
  })

  test('popup yiwen toggle shows and hides translation', async ({ page }) => {
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const titleSpan = page.locator('.space-y-2 > div').first().locator('span.font-bold')
    await titleSpan.click()
    await expect(page.locator('.popup-overlay')).toBeVisible()

    // 译文默认隐藏
    await expect(page.locator('.popup-yiwen')).not.toBeVisible()

    // 点击显示译文
    await page.locator('.yiwen-btn').click()
    await expect(page.locator('.popup-yiwen')).toBeVisible()
    await expect(page.locator('.yiwen-text')).toBeVisible()

    // 再次点击隐藏译文
    await page.locator('.yiwen-btn').click()
    await expect(page.locator('.popup-yiwen')).not.toBeVisible()
  })

  test('clicking overlay closes popup', async ({ page }) => {
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const titleSpan = page.locator('.space-y-2 > div').first().locator('span.font-bold')
    await titleSpan.click()
    await expect(page.locator('.popup-overlay')).toBeVisible()
    // Click overlay area (top-left corner, away from content)
    await page.locator('.popup-overlay').click({ position: { x: 10, y: 10 } })
    await expect(page.locator('.popup-overlay')).not.toBeVisible()
  })

  test('clicking same title again closes popup', async ({ page }) => {
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const titleSpan = page.locator('.space-y-2 > div').first().locator('span.font-bold')
    await titleSpan.click()
    await expect(page.locator('.popup-overlay')).toBeVisible()
    // Click same title again (force needed because overlay intercepts)
    await titleSpan.click({ force: true })
    await expect(page.locator('.popup-overlay')).not.toBeVisible()
  })

  test('clicking different title switches popup', async ({ page }) => {
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const firstTitle = page.locator('.space-y-2 > div').first().locator('span.font-bold')
    const secondTitle = page.locator('.space-y-2 > div').nth(1).locator('span.font-bold')
    await firstTitle.click()
    const firstPopupTitle = await page.locator('.popup-title').textContent()
    // Close popup first, then click second title
    await page.locator('.popup-overlay').click({ position: { x: 10, y: 10 } })
    await expect(page.locator('.popup-overlay')).not.toBeVisible()
    await secondTitle.click()
    const secondPopupTitle = await page.locator('.popup-title').textContent()
    expect(firstPopupTitle).not.toBe(secondPopupTitle)
  })

  test('return to home link works', async ({ page }) => {
    await page.click('text=返回首页')
    await expect(page.locator('h1')).toContainText('古诗抽查')
  })

  // Feature: 按诗人分类
  test('has category mode toggle buttons', async ({ page }) => {
    await expect(page.locator('text=按年级')).toBeVisible()
    await expect(page.locator('text=按诗人')).toBeVisible()
  })

  test('default category mode is grade', async ({ page }) => {
    const gradeBtn = page.locator('button:has-text("按年级")')
    await expect(gradeBtn).toHaveClass(/bg-indigo-500/)
  })

  test('switching to author mode shows author tabs', async ({ page }) => {
    await page.click('text=按诗人')
    // Grade tabs should be replaced by author tabs
    const authorTabs = page.locator('.grade-tabs button')
    await expect(authorTabs.first()).toBeVisible({ timeout: 5000 })
    // Should have more than 7 authors (many poets)
    const count = await authorTabs.count()
    expect(count).toBeGreaterThan(0)
  })

  test('switching to author mode shows different poems', async ({ page }) => {
    // Get first poem in grade mode
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const firstPoemGrade = await page.locator('.space-y-2 > div').first().textContent()

    // Switch to author mode
    await page.click('text=按诗人')
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const firstPoemAuthor = await page.locator('.space-y-2 > div').first().textContent()

    // Poems should be different (different grouping)
    expect(firstPoemGrade).not.toBe(firstPoemAuthor)
  })

  test('switching author tabs shows different poems', async ({ page }) => {
    await page.click('text=按诗人')
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const firstPoemBefore = await page.locator('.space-y-2 > div').first().textContent()

    // Click second author tab
    await page.locator('.grade-tabs button').nth(1).click()
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const firstPoemAfter = await page.locator('.space-y-2 > div').first().textContent()
    expect(firstPoemBefore).not.toBe(firstPoemAfter)
  })

  test('switching back to grade mode restores grade tabs', async ({ page }) => {
    await page.click('text=按诗人')
    await page.click('text=按年级')
    const gradeTabs = page.locator('.grade-tabs button')
    await expect(gradeTabs).toHaveCount(7)
  })
})

// === 古诗启用配置页 ===

test.describe('poem config page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/settings/poems')
    await waitForPoems(page)
  })

  test('displays grade tabs', async ({ page }) => {
    const tabs = page.locator('.grade-tabs button')
    await expect(tabs).toHaveCount(7)
  })

  test('displays select all / deselect all buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("全选")')).toBeVisible()
    await expect(page.locator('button:has-text("全不选")')).toBeVisible()
  })

  test('displays poem list with toggle switches', async ({ page }) => {
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const firstPoem = page.locator('.space-y-2 > div').first()
    await expect(firstPoem.locator('span.font-bold')).toBeVisible()
    await expect(firstPoem.locator('label')).toBeVisible()
  })

  test('displays enabled count footer', async ({ page }) => {
    const footer = page.locator('text=已启用')
    await expect(footer).toBeVisible()
    await expect(footer).toContainText('200')
  })

  test('clicking poem title opens popup', async ({ page }) => {
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const titleSpan = page.locator('.space-y-2 > div').first().locator('span.font-bold')
    await titleSpan.click()
    await expect(page.locator('.popup-overlay')).toBeVisible()
    await expect(page.locator('.popup-title')).toBeVisible()
  })

  test('toggling a poem off updates enabled count', async ({ page }) => {
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const footerBefore = await page.locator('text=已启用').textContent()
    expect(footerBefore).toContain('200')

    const firstToggle = page.locator('.space-y-2 > div').first().locator('label')
    await firstToggle.click()

    const footerAfter = await page.locator('text=已启用').textContent()
    expect(footerAfter).toContain('199')
  })

  test('toggling a poem off then on restores count', async ({ page }) => {
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const firstToggle = page.locator('.space-y-2 > div').first().locator('label')
    await firstToggle.click()
    const footerAfterOff = await page.locator('text=已启用').textContent()
    expect(footerAfterOff).toContain('199')
    await firstToggle.click()
    const footerAfterOn = await page.locator('text=已启用').textContent()
    expect(footerAfterOn).toContain('200')
  })

  test('deselect all disables all poems in current grade', async ({ page }) => {
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    await page.click('button:has-text("全不选")')
    const footer = await page.locator('text=已启用').textContent()
    expect(footer).toContain('187')
  })

  test('select all re-enables all poems in current grade', async ({ page }) => {
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    await page.click('button:has-text("全不选")')
    const footerAfterDeselect = await page.locator('text=已启用').textContent()
    expect(footerAfterDeselect).toContain('187')
    await page.click('button:has-text("全选")')
    const footerAfterSelect = await page.locator('text=已启用').textContent()
    expect(footerAfterSelect).toContain('200')
  })

  test('switching grade tab preserves toggle state', async ({ page }) => {
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })
    const firstToggle = page.locator('.space-y-2 > div').first().locator('label')
    await firstToggle.click()
    const footerAfterToggle = await page.locator('text=已启用').textContent()
    expect(footerAfterToggle).toContain('199')

    await page.locator('.grade-tabs button').nth(1).click()
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })

    await page.locator('.grade-tabs button').first().click()
    await page.locator('.space-y-2 > div').first().waitFor({ state: 'visible' })

    const footerAfterSwitch = await page.locator('text=已启用').textContent()
    expect(footerAfterSwitch).toContain('199')
  })

  test('return to settings link works', async ({ page }) => {
    await page.click('text=返回设置')
    await expect(page.locator('h2')).toContainText('设置')
  })
})

// === 错题本页浮窗 ===

test('wrong book page loads without errors', async ({ page }) => {
  await page.goto('/#/wrong')
  await expect(page.locator('h2')).toContainText('错题本')
  await expect(page.locator('text=暂无错题')).toBeVisible()
})

// === 导航一致性 ===

test.describe('navigation consistency', () => {
  test('direct URL access to poem collection works', async ({ page }) => {
    await page.goto('/#/poems')
    await waitForPoems(page)
    await expect(page.locator('h2')).toContainText('古诗集合')
  })

  test('direct URL access to poem config works', async ({ page }) => {
    await page.goto('/#/settings/poems')
    await waitForPoems(page)
    await expect(page.locator('h2')).toContainText('古诗配置')
  })

  test('poem collection back link goes to home', async ({ page }) => {
    await page.goto('/#/poems')
    await waitForPoems(page)
    await page.click('text=返回首页')
    await expect(page.locator('h1')).toContainText('古诗抽查')
  })

  test('poem config back link goes to settings', async ({ page }) => {
    await page.goto('/#/settings/poems')
    await waitForPoems(page)
    await page.click('text=返回设置')
    await expect(page.locator('h2')).toContainText('设置')
  })
})
