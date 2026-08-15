# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recite-flow.spec.ts >> recite flow: complete all poems and see results
- Location: tests/e2e/recite-flow.spec.ts:82:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('h2')
Expected substring: "背诵结果"
Received string:    "古诗背诵"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('h2')
    14 × locator resolved to <h2 class="text-xl font-bold text-center mb-6">古诗背诵</h2>
       - unexpected value "古诗背诵"

```

```yaml
- heading "古诗背诵" [level=2]
```

# Test source

```ts
  10  | 
  11  | test('navigate to recite page from home', async ({ page }) => {
  12  |   await page.goto('/')
  13  |   await expect(page.locator('text=自评背诵')).toBeVisible()
  14  |   await page.click('text=自评背诵')
  15  |   await expect(page.locator('h2')).toContainText('古诗背诵')
  16  | })
  17  | 
  18  | test('recite page shows source options', async ({ page }) => {
  19  |   await page.goto('/#/recite')
  20  |   await expect(page.locator('h2')).toContainText('古诗背诵')
  21  |   await expect(page.locator('text=待复习')).toBeVisible()
  22  |   await expect(page.locator('text=全部古诗')).toBeVisible()
  23  |   await expect(page.locator('text=开始背诵')).toBeVisible()
  24  | })
  25  | 
  26  | test('recite page: select all source and start', async ({ page }) => {
  27  |   await page.goto('/#/recite')
  28  |   await page.evaluate(() => localStorage.clear())
  29  |   await page.reload()
  30  | 
  31  |   // Select "全部古诗"
  32  |   await page.click('text=全部古诗')
  33  |   await page.click('text=开始背诵')
  34  | 
  35  |   // Should show poem title and "查看原文" button
  36  |   await expect(page.locator('text=查看原文')).toBeVisible({ timeout: 5000 })
  37  | })
  38  | 
  39  | test('recite flow: expand text and self-evaluate correct', async ({ page }) => {
  40  |   await page.goto('/#/recite')
  41  |   await page.evaluate(() => localStorage.clear())
  42  |   await page.reload()
  43  | 
  44  |   await page.click('text=全部古诗')
  45  |   await page.click('text=开始背诵')
  46  | 
  47  |   // Wait for first poem
  48  |   await expect(page.locator('text=查看原文')).toBeVisible({ timeout: 5000 })
  49  | 
  50  |   // Click to expand
  51  |   await page.click('text=查看原文')
  52  | 
  53  |   // Should see "会了" and "不会" buttons
  54  |   await expect(page.locator('text=会了')).toBeVisible()
  55  |   await expect(page.locator('text=不会')).toBeVisible()
  56  | 
  57  |   // Self-evaluate as correct
  58  |   await page.click('text=会了')
  59  | 
  60  |   // Should advance to next poem (progress text changes)
  61  |   await expect(page.locator('text=查看原文')).toBeVisible({ timeout: 5000 })
  62  | })
  63  | 
  64  | test('recite flow: expand text and self-evaluate wrong', async ({ page }) => {
  65  |   await page.goto('/#/recite')
  66  |   await page.evaluate(() => localStorage.clear())
  67  |   await page.reload()
  68  | 
  69  |   await page.click('text=全部古诗')
  70  |   await page.click('text=开始背诵')
  71  | 
  72  |   await expect(page.locator('text=查看原文')).toBeVisible({ timeout: 5000 })
  73  |   await page.click('text=查看原文')
  74  | 
  75  |   // Self-evaluate as wrong
  76  |   await page.click('text=不会')
  77  | 
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
> 110 |   await expect(page.locator('h2')).toContainText('背诵结果', { timeout: 5000 })
      |                                    ^ Error: expect(locator).toContainText(expected) failed
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
  178 |   await gradeBtn.click()
  179 | 
  180 |   // Start button should be enabled
  181 |   await expect(page.locator('button:has-text("开始背诵")')).toBeEnabled()
  182 | })
  183 | 
```