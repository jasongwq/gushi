# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: progress-and-detail.spec.ts >> poem detail page shows all sections
- Location: tests/e2e/progress-and-detail.spec.ts:37:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.cursor-pointer.hover\\:bg-gray-50').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.cursor-pointer.hover\\:bg-gray-50').first()

```

```yaml
- heading "学习进度" [level=2]
- text: 0 / 0 已学 / 总数
- heading "掌握程度分布" [level=3]
- text: 新 0 学 0 熟 0 固 0
- heading "记忆保持率趋势（近30天）" [level=3]
- text: 0 不熟练
- heading "古诗列表（点击查看详情）" [level=3]
- link "返回首页":
  - /url: "#/"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test('progress page shows forgetting curve chart', async ({ page }) => {
  4  |   await page.goto('/#/progress')
  5  |   await expect(page.locator('h2')).toContainText('学习进度')
  6  |   await expect(page.locator('text=记忆保持率趋势')).toBeVisible()
  7  |   // Chart canvas should be present
  8  |   await expect(page.locator('canvas')).toBeVisible()
  9  | })
  10 | 
  11 | test('progress page shows clickable poem list', async ({ page }) => {
  12 |   await page.goto('/#/progress')
  13 |   await expect(page.locator('text=古诗列表')).toBeVisible()
  14 |   // Poem list items should be visible
  15 |   const poemItems = page.locator('.cursor-pointer.hover\\:bg-gray-50')
  16 |   await expect(poemItems.first()).toBeVisible({ timeout: 5000 })
  17 | })
  18 | 
  19 | test('progress page: click poem navigates to detail', async ({ page }) => {
  20 |   await page.goto('/#/progress')
  21 |   await page.evaluate(() => localStorage.clear())
  22 |   await page.reload()
  23 | 
  24 |   // Wait for poem list to load
  25 |   const poemItems = page.locator('.cursor-pointer.hover\\:bg-gray-50')
  26 |   await expect(poemItems.first()).toBeVisible({ timeout: 5000 })
  27 | 
  28 |   // Click first poem
  29 |   await poemItems.first().click()
  30 | 
  31 |   // Should be on poem detail page
  32 |   await expect(page.locator('text=掌握等级')).toBeVisible({ timeout: 5000 })
  33 |   await expect(page.locator('text=下次复习')).toBeVisible()
  34 |   await expect(page.locator('text=复习次数')).toBeVisible()
  35 | })
  36 | 
  37 | test('poem detail page shows all sections', async ({ page }) => {
  38 |   // Navigate to a specific poem detail page
  39 |   await page.goto('/#/progress')
  40 |   await page.evaluate(() => localStorage.clear())
  41 |   await page.reload()
  42 | 
  43 |   const poemItems = page.locator('.cursor-pointer.hover\\:bg-gray-50')
> 44 |   await expect(poemItems.first()).toBeVisible({ timeout: 5000 })
     |                                   ^ Error: expect(locator).toBeVisible() failed
  45 |   await poemItems.first().click()
  46 | 
  47 |   // Verify all sections are present
  48 |   await expect(page.locator('text=遗忘曲线')).toBeVisible({ timeout: 5000 })
  49 |   await expect(page.locator('text=原文')).toBeVisible()
  50 |   await expect(page.locator('text=返回')).toBeVisible()
  51 | })
  52 | 
  53 | test('poem detail page: back button returns to previous page', async ({ page }) => {
  54 |   await page.goto('/#/progress')
  55 |   await page.evaluate(() => localStorage.clear())
  56 |   await page.reload()
  57 | 
  58 |   const poemItems = page.locator('.cursor-pointer.hover\\:bg-gray-50')
  59 |   await expect(poemItems.first()).toBeVisible({ timeout: 5000 })
  60 |   await poemItems.first().click()
  61 | 
  62 |   await expect(page.locator('text=返回')).toBeVisible({ timeout: 5000 })
  63 |   await page.click('text=返回')
  64 | 
  65 |   // Should be back on progress page
  66 |   await expect(page.locator('h2')).toContainText('学习进度')
  67 | })
  68 | 
  69 | test('poem detail page direct URL', async ({ page }) => {
  70 |   // Navigate directly to a poem detail page
  71 |   await page.goto('/#/poem/p001')
  72 |   // Should show either poem details or "古诗不存在"
  73 |   const body = page.locator('body')
  74 |   await expect(body).toBeVisible()
  75 | })
  76 | 
```