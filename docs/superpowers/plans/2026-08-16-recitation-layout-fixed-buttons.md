# 古诗背诵详情页布局调整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `RecitationCard.vue` 布局改为：4 个操作按钮固定底部、正文区独立滚动、作者/朝代 [不会] 按钮移到标题下方并删除底部原区域。

**Architecture:** 组件内 flex 布局。根节点改 `flex flex-col h-full`，分为标题区（固定）、正文区（`flex-1 min-h-0 overflow-y-auto`）、按钮区（固定）三段。作者/朝代 [不会] 按钮从底部移到标题区，状态逻辑（`authorCorrect`/`dynastyCorrect` 三态循环）不变。单组件改动，`PoemCardPage` 和 `RecitationPlayPage` 两处使用自动生效。

**Tech Stack:** Vue 3 (script setup) + Tailwind CSS + Vitest + Playwright

---

## File Structure

| 文件 | 改动 |
|------|------|
| `src/components/RecitationCard.vue` | 根节点改 flex 布局；作者/朝代 [不会] 移到标题区；删除底部作者/朝代区；正文区独立滚动 |
| `tests/unit/RecitationCard.test.ts` | `getAuthorDynastyButtons` 改为位置无关定位；新增布局结构测试 |
| `tests/e2e/poem-detail-fullscreen.spec.ts` | 可选：新增按钮固定底部断言 |

---

### Task 1: 更新单元测试辅助函数（位置无关定位）

**Files:**
- Modify: `tests/unit/RecitationCard.test.ts:61-71`

- [ ] **Step 1: 修改 `getAuthorDynastyButtons`，不再依赖 DOM 顺序**

原实现 `allForgot[mockPoem.text.length]` 假设 line `不会` 按钮在 DOM 中先出现。移动位置后失效。改为：找到 `不会` 按钮，用其所在行的文本（含 `李白` 或 `唐`）区分。

```typescript
// Helper: find author/dynasty "不会" buttons (the ones next to author/dynasty text)
function getAuthorDynastyButtons(wrapper: ReturnType<typeof mountCard>) {
  // Author "不会" is in a row containing "李白", dynasty "不会" in a row containing "唐"
  // Line-level "不会" buttons are in rows with poem line text only
  const buttons = wrapper.findAll('button').filter(b => b.text() === '不会')
  const findInRow = (text: string) => buttons.find(b => b.element.parentElement?.textContent?.includes(text))
  return {
    authorForgot: findInRow('李白'),
    dynastyForgot: findInRow('唐'),
  }
}
```

注意：`mockPoem` 的 dynasty 是 `'唐'`，而 line 文本不含 `'唐'`，`findInRow('唐')` 能唯一定位朝代按钮。

- [ ] **Step 2: 运行单元测试确认现有测试仍通过**

Run: `cd /root/古诗抽查/.worktrees/poem-detail-layout && npx vitest run tests/unit/RecitationCard.test.ts`
Expected: 全部通过（布局尚未改动，行为不变）

- [ ] **Step 3: 提交**

```bash
cd /root/古诗抽查/.worktrees/poem-detail-layout
git add tests/unit/RecitationCard.test.ts
git commit -m "test: make author/dynasty button locator position-independent"
```

---

### Task 2: RecitationCard 布局改造（TDD）

**Files:**
- Modify: `src/components/RecitationCard.vue`（模板 96-187 行）
- Test: `tests/unit/RecitationCard.test.ts`

- [ ] **Step 1: 先写布局结构测试（红）**

在 `tests/unit/RecitationCard.test.ts` 的 `describe('RecitationCard')` 内、`renders poem title...` 测试之后追加：

```typescript
it('布局：作者/朝代 [不会] 位于标题下方，正文区独立滚动，4 按钮固定底部', () => {
  const wrapper = mountCard()
  const root = wrapper.find('.recitation-card')
  const rootClasses = root.classes().join(' ')

  // 根节点为 flex 纵向布局
  expect(rootClasses).toContain('flex')
  expect(rootClasses).toContain('flex-col')

  // 标题区：标题 h2 与作者/朝代 [不会] 按钮相邻
  const titleH2 = wrapper.find('.recitation-card h2')
  const titleSection = titleH2.element.parentElement
  expect(titleSection?.textContent).toContain('静夜思')
  expect(titleSection?.textContent).toContain('李白')
  expect(titleSection?.textContent).toContain('不会')

  // 正文区：含逐句标记与译文，可滚动
  const scrollArea = wrapper.find('.recitation-card .overflow-y-auto')
  expect(scrollArea.exists()).toBe(true)
  expect(scrollArea.element.parentElement?.textContent).toContain('床前明月光')
  expect(scrollArea.classes().join(' ')).toContain('flex-1')

  // 按钮区：熟练/完全不会/上一首/下一首 在正文区之后（底部）
  const rootEl = root.element
  const scrollBottom = scrollArea.element.getBoundingClientRect().bottom
  const btnMastered = wrapper.findAll('button').find(b => b.text() === '熟练')!
  const btnBottom = btnMastered.element.getBoundingClientRect().top
  expect(btnBottom).toBeGreaterThan(scrollBottom)

  // 底部原作者/朝代区已删除：标题区外不应再有单独的"李白 [不会]"行
  const bodyText = root.element.textContent ?? ''
  const occurrenceCount = bodyText.split('李白').length - 1
  expect(occurrenceCount).toBe(1)
})
```

- [ ] **Step 2: 运行测试确认失败（红）**

Run: `npx vitest run tests/unit/RecitationCard.test.ts -t "布局"`
Expected: FAIL（`getBoundingClientRect` 在 happy-dom 中返回全 0，布局断言会失败——需要调整断言方式）

> **happy-dom 注意事项**：happy-dom 的 `getBoundingClientRect()` 不计算真实布局，返回全 0。因此**不要用坐标断言**。改为仅断言 DOM 结构：标题 h2 的父元素包含作者/朝代按钮；`overflow-y-auto` 元素存在且包含逐句标记；4 按钮的 `flex-1` 在 `overflow-y-auto` 外层兄弟。

用下面的**修正版测试**替换上一步（去掉坐标断言）：

```typescript
it('布局：作者/朝代 [不会] 位于标题下方，正文区独立滚动，4 按钮在正文区之后', () => {
  const wrapper = mountCard()
  const root = wrapper.find('.recitation-card')
  const rootClasses = root.classes().join(' ')

  // 根节点为 flex 纵向布局
  expect(rootClasses).toContain('flex')
  expect(rootClasses).toContain('flex-col')
  expect(rootClasses).toContain('h-full')

  // 标题区：标题 h2 所在容器包含作者/朝代 [不会] 按钮
  const titleH2 = wrapper.find('.recitation-card h2')
  const titleSection = titleH2.element.parentElement
  expect(titleSection?.textContent).toContain('李白')
  expect(titleSection?.textContent).toContain('唐')
  expect(titleSection?.textContent).toContain('不会')

  // 正文区：独立滚动容器，包含逐句标记与译文
  const scrollArea = wrapper.find('.recitation-card .overflow-y-auto')
  expect(scrollArea.exists()).toBe(true)
  const scrollText = scrollArea.element.textContent ?? ''
  expect(scrollText).toContain('床前明月光')
  expect(scrollText).toContain('显示译文')

  // 4 按钮（熟练/完全不会/上一首/下一首）在正文区外层（flex 根节点的直接子级，位于正文区之后）
  const rootChildren = Array.from(root.element.children).map(c => c.className)
  const btnMastered = wrapper.findAll('button').find(b => b.text() === '熟练')!
  // 熟练按钮的祖先链中，应有一个父元素是根节点的直接子级，且该父元素位于正文区容器之后
  let btnSection = btnMastered.element.parentElement
  while (btnSection && btnSection.parentElement !== root.element) {
    btnSection = btnSection.parentElement
  }
  expect(btnSection).toBeTruthy()
  const scrollSection = scrollArea.element.parentElement
  const scrollIndex = rootChildren.indexOf(scrollSection?.className ?? '')
  const btnIndex = rootChildren.indexOf(btnSection!.className)
  expect(btnIndex).toBeGreaterThan(scrollIndex)

  // 底部原作者/朝代区已删除：全文"李白"只出现一次（标题区）
  const bodyText = root.element.textContent ?? ''
  expect(bodyText.split('李白').length - 1).toBe(1)
})
```

- [ ] **Step 3: 运行测试确认失败（红）**

Run: `npx vitest run tests/unit/RecitationCard.test.ts -t "布局"`
Expected: FAIL（`h-full` 类、`overflow-y-auto` 容器尚不存在）

- [ ] **Step 4: 修改 RecitationCard.vue 模板实现布局（绿）**

修改 `src/components/RecitationCard.vue` 的 `<template>`：

**4a. 根节点改 flex 纵向布局：**

```html
<div class="recitation-card py-2 w-full flex flex-col h-full">
```

**4b. 标题区（移到根节点最前，含作者/朝代 + [不会] 按钮，固定 `shrink-0`）：**

```html
<div class="text-center mb-4 shrink-0">
  <h2 class="text-2xl font-bold mb-1">{{ poem.title }}</h2>
  <div class="flex items-center justify-center gap-4 text-gray-500 text-sm">
    <div class="flex items-center gap-2">
      <span>{{ poem.dynasty }} · {{ poem.author }}</span>
      <button
        data-testid="btn-author-forgot"
        :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', authorCorrect === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
        @click="toggleAuthorCorrect"
      >不会</button>
      <button
        data-testid="btn-dynasty-forgot"
        :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', dynastyCorrect === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
        @click="toggleDynastyCorrect"
      >不会</button>
    </div>
  </div>
</div>
```

**4c. 正文区包一层滚动容器（`flex-1 min-h-0 overflow-y-auto`），包含逐句标记 + 译文：**

将原本位于标题区之后、按钮区之前的全部内容（逐句标记 div + 译文 div）包裹进滚动容器：

```html
<div class="flex-1 min-h-0 overflow-y-auto mb-4">
  <!-- 全诗原文 + 逐句标记（原样保留，含每行的 卡顿/不会 按钮） -->
  <div class="mb-4">
    <div
      v-for="(line, index) in poem.text"
      :key="index"
      class="flex items-center gap-2 py-2 border-b border-gray-100 last:border-b-0"
    >
      <span :class="['flex-1 text-lg min-w-0 break-all', lineStatuses[index].status === 'forgot' ? 'text-red-400' : lineStatuses[index].status === 'stuck' ? 'text-yellow-600' : '']">{{ line }}</span>
      <div class="flex gap-1 shrink-0">
        <button
          :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', lineStatuses[index].status === 'stuck' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 bg-white text-gray-400']"
          @click="setLineStatus(index, lineStatuses[index].status === 'stuck' ? 'ok' : 'stuck')"
        >卡顿</button>
        <button
          :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', lineStatuses[index].status === 'forgot' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
          @click="setLineStatus(index, lineStatuses[index].status === 'forgot' ? 'ok' : 'forgot')"
        >不会</button>
      </div>
    </div>
  </div>

  <!-- 译文切换 + 译文内容（原样保留） -->
  <div class="mb-3 text-center">
    <button
      :class="['px-3 py-1.5 text-xs rounded-lg border-2 cursor-pointer transition', showYiwen ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-indigo-200 bg-indigo-50 text-indigo-600']"
      @click="toggleYiwen"
    >
      {{ showYiwen ? '隐藏译文 ▴' : '显示译文 ▾' }}
    </button>
  </div>
  <div v-if="showYiwen" class="mb-3 p-3 bg-gray-50 rounded-lg text-center">
    <p class="text-sm leading-relaxed text-gray-500">{{ poem.yiwen }}</p>
  </div>
</div>
```

**4d. 删除底部作者/朝代标记区**（原模板中位于译文下方的 `李白 [不会] 唐 [不会]` 那段，`data-testid` 不复用）：

```html
<!-- 删除：原作者/朝代标记区 -->
```

**4e. 按钮区加 `shrink-0`（固定底部，不滚动）：**

```html
<div class="flex gap-3 mb-3 shrink-0">...</div>  <!-- 熟练/完全不会 -->
<div class="flex gap-3 shrink-0">...</div>       <!-- 上一首/下一首 -->
```

- [ ] **Step 5: 运行全部单元测试确认通过（绿）**

Run: `npx vitest run tests/unit/RecitationCard.test.ts`
Expected: 全部通过（含新增布局测试）

- [ ] **Step 6: 运行组件级测试确认无回归**

Run: `npx vitest run tests/component`
Expected: 全部通过

- [ ] **Step 7: 提交**

```bash
cd /root/古诗抽查/.worktrees/poem-detail-layout
git add src/components/RecitationCard.vue tests/unit/RecitationCard.test.ts
git commit -m "feat: 背诵详情页布局调整 - 按钮固定底部、作者朝代上移标题下"
```

---

### Task 3: E2E 验证按钮固定底部

**Files:**
- Modify: `tests/e2e/poem-detail-fullscreen.spec.ts`

- [ ] **Step 1: 新增 E2E 测试，验证长诗正文滚动时按钮固定在底部**

在 `poem-detail-fullscreen.spec.ts` 末尾追加：

```typescript
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

  // 布局断言：根节点 flex，正文区可滚动，按钮区在底部
  const layout = await page.evaluate(() => {
    const card = document.querySelector('.swiper-slide-active .recitation-card')
    if (!card) return null
    const rootClasses = [...card.classList].join(' ')
    const scrollArea = card.querySelector('.overflow-y-auto')
    const masteredBtn = [...card.querySelectorAll('button')].find(b => b.textContent === '熟练')
    const scrollTop = scrollArea?.getBoundingClientRect().top ?? 0
    const scrollHeight = scrollArea?.scrollHeight ?? 0
    const scrollClientHeight = scrollArea?.clientHeight ?? 0
    const masteredTop = masteredBtn?.getBoundingClientRect().top ?? 0
    const viewportH = document.documentElement.clientHeight
    return {
      rootClasses,
      hasScrollArea: !!scrollArea,
      scrollTop: Math.round(scrollTop),
      scrollHeight,
      scrollClientHeight,
      masteredTop: Math.round(masteredTop),
      viewportH,
      masteredNearBottom: Math.abs(masteredTop - (viewportH - 40)) < 100,
      authorInTitle: card.querySelector('h2')?.parentElement?.textContent?.includes('李白') ?? false,
    }
  })
  expect(layout).toBeTruthy()
  const l = layout!
  expect(l.rootClasses).toContain('flex-col')
  expect(l.hasScrollArea).toBe(true)
  // 熟练按钮固定在视口底部附近（与视口底边距离 < 120px，说明不在正文末尾随内容滚动）
  expect(l.masteredNearBottom).toBe(true)
  // 作者/朝代在标题下方
  expect(l.authorInTitle).toBe(true)

  await context.close()
})
```

- [ ] **Step 2: 运行新增 E2E 测试**

Run: `cd /root/古诗抽查/.worktrees/poem-detail-layout && npx playwright test tests/e2e/poem-detail-fullscreen.spec.ts -g "按钮固定在底部"`
Expected: PASS

- [ ] **Step 3: 运行相关 E2E 回归**

Run: `npx playwright test tests/e2e/poem-detail-fullscreen.spec.ts tests/e2e/recitation-flow.spec.ts tests/e2e/overflow-check.spec.ts`
Expected: 全部通过

> 注意：`recitation-flow.spec.ts` 走 `RecitationPlayPage`，该处组件无固定高度容器，`h-full` 退化为内容高度——按钮仍可见（单首诗不满屏），文本定位不受影响。

- [ ] **Step 4: 提交**

```bash
cd /root/古诗抽查/.worktrees/poem-detail-layout
git add tests/e2e/poem-detail-fullscreen.spec.ts
git commit -m "test: 验证背诵模式按钮固定底部、作者朝代在标题下"
```

---

### Task 4: 完整验证与收尾

**Files:** 无

- [ ] **Step 1: 运行全部单元测试**

Run: `npx vitest run`
Expected: 全部通过

- [ ] **Step 2: 运行全部 E2E 测试**

Run: `npx playwright test`
Expected: 全部通过

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功（vue-tsc 无类型错误）

- [ ] **Step 4: 提交最终状态（若有剩余改动）**

```bash
git status --short
git add -A
git commit -m "chore: 布局调整收尾"
```
