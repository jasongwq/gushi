# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recite-flow.spec.ts >> recite page: grade filter works
- Location: tests/e2e/recite-flow.spec.ts:166:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button').filter({ hasText: '年级' }).first()

```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - heading "古诗背诵" [level=2] [ref=f1e4]
  - generic [ref=f1e5]:
    - heading "背诵来源" [level=3] [ref=f1e6]
    - generic [ref=f1e7]:
      - button "待复习" [ref=f1e8] [cursor=pointer]
      - button "全部古诗" [active] [ref=f1e9] [cursor=pointer]
  - heading "选择年级（不选则为全部）" [level=3] [ref=f1e11]
  - button "开始背诵" [ref=f1e12] [cursor=pointer]
  - button "返回首页" [ref=f1e13] [cursor=pointer]
```

# Test source

```ts
  78  |   // Should advance to next poem
  79  |   await expect(page.locator('text=查看原文')).toBeVisible({ timeout: 5000 })
  80  | })
  81  | 
  82  | test('recite flow: complete all poems and see results', async ({ page }) => {
  83  |   test.setTimeout(60000)
  84  | 
  85  |   await page.goto('/#/recite')
  86  |   await page.evaluate(() => localStorage.clear())
  87  |   await page.reload()
  88  | 
  89  |   await page.click('text=全部古诗')
  90  |   await page.click('text=开始背诵')
  91  | 
  92  |   // Complete 5 poems (default count)
  93  |   for (let i = 0; i < 20; i++) {
  94  |     const expandBtn = page.locator('text=查看原文')
  95  |     if (!(await expandBtn.isVisible({ timeout: 3000 }).catch(() => false))) break
  96  | 
  97  |     await expandBtn.click()
  98  |     await page.waitForTimeout(300)
  99  | 
  100 |     // Alternate between "会了" and "不会"
  101 |     if (i % 2 === 0) {
  102 |       await page.click('text=会了')
  103 |     } else {
  104 |       await page.click('text=不会')
  105 |     }
  106 |     await page.waitForTimeout(300)
  107 |   }
  108 | 
  109 |   // Should be on results page
  110 |   await expect(page.locator('h2')).toContainText('背诵结果', { timeout: 5000 })
  111 |   await expect(page.locator('text=会了')).toBeVisible()
  112 |   await expect(page.locator('text=不会')).toBeVisible()
  113 |   await expect(page.locator('text=再来一轮')).toBeVisible()
  114 |   await expect(page.locator('text=返回首页')).toBeVisible()
  115 | })
  116 | 
  117 | test('recite results: go home navigates to home', async ({ page }) => {
  118 |   test.setTimeout(60000)
  119 | 
  120 |   await page.goto('/#/recite')
  121 |   await page.evaluate(() => localStorage.clear())
  122 |   await page.reload()
  123 | 
  124 |   await page.click('text=全部古诗')
  125 |   await page.click('text=开始背诵')
  126 | 
  127 |   // Complete poems quickly
  128 |   for (let i = 0; i < 20; i++) {
  129 |     const expandBtn = page.locator('text=查看原文')
  130 |     if (!(await expandBtn.isVisible({ timeout: 3000 }).catch(() => false))) break
  131 |     await expandBtn.click()
  132 |     await page.waitForTimeout(300)
  133 |     await page.click('text=会了')
  134 |     await page.waitForTimeout(300)
  135 |   }
  136 | 
  137 |   await expect(page.locator('h2')).toContainText('背诵结果', { timeout: 5000 })
  138 |   await page.click('text=返回首页')
  139 |   await expect(page.locator('h1')).toContainText('古诗抽查')
  140 | })
  141 | 
  142 | test('recite results: try again navigates to recite page', async ({ page }) => {
  143 |   test.setTimeout(60000)
  144 | 
  145 |   await page.goto('/#/recite')
  146 |   await page.evaluate(() => localStorage.clear())
  147 |   await page.reload()
  148 | 
  149 |   await page.click('text=全部古诗')
  150 |   await page.click('text=开始背诵')
  151 | 
  152 |   for (let i = 0; i < 20; i++) {
  153 |     const expandBtn = page.locator('text=查看原文')
  154 |     if (!(await expandBtn.isVisible({ timeout: 3000 }).catch(() => false))) break
  155 |     await expandBtn.click()
  156 |     await page.waitForTimeout(300)
  157 |     await page.click('text=会了')
  158 |     await page.waitForTimeout(300)
  159 |   }
  160 | 
  161 |   await expect(page.locator('h2')).toContainText('背诵结果', { timeout: 5000 })
  162 |   await page.click('text=再来一轮')
  163 |   await expect(page.locator('h2')).toContainText('古诗背诵')
  164 | })
  165 | 
  166 | test('recite page: grade filter works', async ({ page }) => {
  167 |   await page.goto('/#/recite')
  168 |   await page.evaluate(() => localStorage.clear())
  169 |   await page.reload()
  170 | 
  171 |   await page.click('text=全部古诗')
  172 | 
  173 |   // Grade buttons should appear
  174 |   await expect(page.locator('text=选择年级')).toBeVisible()
  175 | 
  176 |   // Click a grade button
  177 |   const gradeBtn = page.locator('button').filter({ hasText: '年级' }).first()
> 178 |   await gradeBtn.click()
      |                  ^ Error: locator.click: Test timeout of 30000ms exceeded.
  179 | 
  180 |   // Start button should be enabled
  181 |   await expect(page.locator('button:has-text("开始背诵")')).toBeEnabled()
  182 | })
  183 | 
```