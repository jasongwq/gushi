# 古诗详情页拼音显示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在古诗详情页原文的每个字上方显示拼音（默认显示），提供显示/隐藏开关，并持久化偏好。

**Architecture:** 在 `src/utils/` 新增纯函数 `splitPinyinByLine`，将展平的 `poem.pinyin` 数组按 `poem.text` 每行长度切分；`PoemDetailPage.vue` 用 `<ruby><rt>` 逐字渲染拼音；`UserSettings` 新增 `showPinyin` 字段，复用现有 `learningStore.updateSettings()` 持久化。

**Tech Stack:** Vue 3.5 (script setup) + TypeScript + Vitest + Pinia。注意：本仓库约定代码修改须在新 worktree 进行（见 `feedback-work-in-worktree`）。

---

### Task 1: 新增 `splitPinyinByLine` 工具函数

**Files:**
- Create: `src/utils/pinyin.ts`
- Test: `tests/unit/pinyin.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/unit/pinyin.test.ts
import { describe, it, expect } from 'vitest'
import { splitPinyinByLine } from '@/utils/pinyin'
import type { PinyinPair } from '@/types'

describe('splitPinyinByLine', () => {
  const pinyin: PinyinPair[] = [
    { char: '鹅', pinyin: 'é' }, { char: '，', pinyin: '' },
    { char: '鹅', pinyin: 'é' }, { char: '，', pinyin: '' },
    { char: '鹅', pinyin: 'é' }, { char: '，', pinyin: '' },
    { char: '曲', pinyin: 'qǔ' }, { char: '项', pinyin: 'xiàng' },
    { char: '向', pinyin: 'xiàng' }, { char: '天', pinyin: 'tiān' },
    { char: '歌', pinyin: 'gē' }, { char: '。', pinyin: '' },
  ]

  it('按行切分展平 pinyin 数组', () => {
    const text = ['鹅，鹅，鹅，', '曲项向天歌。']
    const result = splitPinyinByLine(text, pinyin)
    expect(result).toEqual([
      ['é', '', 'é', '', 'é', ''],
      ['qǔ', 'xiàng', 'xiàng', 'tiān', 'gē', ''],
    ])
  })

  it('pinyin 缺失时返回空数组', () => {
    expect(splitPinyinByLine(['床前明月光'], undefined)).toEqual([])
  })

  it('长度不匹配时按边界截断不抛错', () => {
    const short: PinyinPair[] = [{ char: '鹅', pinyin: 'é' }]
    const result = splitPinyinByLine(['鹅，鹅，鹅，', '曲项向天歌。'], short)
    expect(result[0]).toEqual(['é'])
    expect(result[1]).toEqual([])
  })

  it('空行返回空数组', () => {
    expect(splitPinyinByLine([], [])).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/pinyin.test.ts`
Expected: FAIL — 模块 `@/utils/pinyin` 不存在

- [ ] **Step 3: 实现最小函数**

```ts
// src/utils/pinyin.ts
import type { PinyinPair } from '@/types'

/**
 * 将展平的 poem.pinyin 数组按 poem.text 每行长度切分，返回每行每字的拼音。
 * 标点的 pinyin 为空串，保留原位置（与 text 逐字对应）。
 * pinyin 缺失或长度不足时，按实际边界截断；pinyin 为空返回 []。
 */
export function splitPinyinByLine(text: string[], pinyin?: PinyinPair[]): string[][] {
  if (!pinyin) return []
  const flat = pinyin.map(p => p.pinyin)
  const result: string[][] = []
  let idx = 0
  for (const line of text) {
    const slice = flat.slice(idx, idx + line.length)
    result.push(slice)
    idx += line.length
  }
  return result
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/pinyin.test.ts`
Expected: PASS (4 个测试)

- [ ] **Step 5: 提交**

```bash
git add src/utils/pinyin.ts tests/unit/pinyin.test.ts
git commit -m "feat: add splitPinyinByLine utility"
```

---

### Task 2: `UserSettings` 新增 `showPinyin` 字段

**Files:**
- Modify: `src/types/index.ts:63-70`
- Modify: `tests/unit/types.test.ts`

- [ ] **Step 1: 修改类型定义**

`src/types/index.ts` 的 `UserSettings` 接口新增字段（`showYiwen` 之后）：

```ts
export interface UserSettings {
  enabledPoems: string[]
  quizCount: number
  source: SourceType
  quizTypes: QuizType[]
  selectedGrades: string[]
  showYiwen?: boolean
  showPinyin?: boolean  // 拼音显示开关，默认 true
}
```

- [ ] **Step 2: 更新类型测试**

`tests/unit/types.test.ts` 的 `should construct a valid UserSettings object` 测试中，在 `selectedGrades: []` 后加一行断言：

```ts
    const settings: UserSettings = {
      enabledPoems: ['一年级', '二年级'],
      quizCount: 10,
      source: 'smart',
      quizTypes: ['fillBlank', 'nextLine'],
      selectedGrades: [],
      showPinyin: true,
    }
    expect(settings.enabledPoems).toHaveLength(2)
    expect(settings.quizCount).toBe(10)
    expect(settings.source).toBe('smart')
    expect(settings.showPinyin).toBe(true)
```

- [ ] **Step 3: 运行测试确认通过**

Run: `npx vitest run tests/unit/types.test.ts`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/types/index.ts tests/unit/types.test.ts
git commit -m "feat: add showPinyin to UserSettings"
```

---

### Task 3: 详情页渲染拼音 + 切换开关

**Files:**
- Modify: `src/views/PoemDetailPage.vue`
- Create: `tests/component/PoemDetailPage.test.ts`

- [ ] **Step 1: 写组件测试（先失败）**

```ts
// tests/component/PoemDetailPage.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import PoemDetailPage from '@/views/PoemDetailPage.vue'
import type { Poem } from '@/types'

const mockPoem: Poem = {
  id: 'p1',
  title: '咏鹅',
  author: '骆宾王',
  dynasty: '唐',
  grade: '一年级',
  text: ['鹅，鹅，鹅，', '曲项向天歌。'],
  textType: '五言',
  yiwen: '大白鹅啊大白鹅…',
  pinyin: [
    { char: '鹅', pinyin: 'é' }, { char: '，', pinyin: '' },
    { char: '鹅', pinyin: 'é' }, { char: '，', pinyin: '' },
    { char: '鹅', pinyin: 'é' }, { char: '，', pinyin: '' },
    { char: '曲', pinyin: 'qǔ' }, { char: '项', pinyin: 'xiàng' },
    { char: '向', pinyin: 'xiàng' }, { char: '天', pinyin: 'tiān' },
    { char: '歌', pinyin: 'gē' }, { char: '。', pinyin: '' },
  ],
}

// Chart.js 在 jsdom 无 canvas 2D context，mock 掉
vi.mock('chart.js', () => ({
  Chart: class {
    static register() {}
    destroy() {}
    constructor() {}
  },
  registerables: [],
}))

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/poem/:id', name: 'poem-detail', component: PoemDetailPage }],
  })
}

let wrapper: VueWrapper | null = null

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

function mountPage(poem: Poem = mockPoem) {
  // 注入 poem store 的 getPoemById
  const { usePoemStore } = require('@/stores/poem')
  const store = usePoemStore()
  ;(store as any).poems = [poem]
  vi.spyOn(store, 'getPoemById').mockReturnValue(poem)
  wrapper = mount(PoemDetailPage, {
    global: {
      plugins: [makeRouter()],
    },
  })
  return wrapper
}

describe('PoemDetailPage 拼音', () => {
  it('默认显示拼音，每个字上方有 rt 标签', async () => {
    const w = mountPage()
    await w.vm.$nextTick()
    const rts = w.findAll('ruby rt')
    expect(rts.length).toBeGreaterThan(0)
    expect(w.text()).toContain('é')
    expect(w.text()).toContain('qǔ')
  })

  it('点击"隐藏拼音"后 rt 消失', async () => {
    const w = mountPage()
    await w.vm.$nextTick()
    await w.find('.pinyin-btn').trigger('click')
    await w.vm.$nextTick()
    expect(w.findAll('ruby rt').length).toBe(0)
  })

  it('偏好持久化：隐藏后重新挂载仍为隐藏', async () => {
    const w = mountPage()
    await w.vm.$nextTick()
    await w.find('.pinyin-btn').trigger('click')
    w.unmount()
    const w2 = mountPage()
    await w2.vm.$nextTick()
    expect(w2.findAll('ruby rt').length).toBe(0)
    w2.unmount()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/component/PoemDetailPage.test.ts`
Expected: FAIL — 找不到 `.pinyin-btn` / rt 元素

- [ ] **Step 3: 修改 `PoemDetailPage.vue`**

**script 部分** — 在 `showYiwen` 相关代码之后（L24-29 区域）新增：

```ts
const showPinyin = ref(learningStore.settings.showPinyin ?? true)

function togglePinyin() {
  showPinyin.value = !showPinyin.value
  learningStore.updateSettings({ showPinyin: showPinyin.value })
}
```

新增 import：

```ts
import { splitPinyinByLine } from '@/utils/pinyin'
```

在 `poem` computed 之后新增：

```ts
const pinyinByLine = computed(() =>
  poem.value ? splitPinyinByLine(poem.value.text, poem.value.pinyin) : []
)
```

**template 部分** — 原文卡片头部（L181-189）译文按钮前新增拼音按钮：

```html
<button
  class="pinyin-btn px-3 py-1.5 text-xs rounded-lg border-2 cursor-pointer transition"
  :class="showPinyin ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-indigo-200 bg-indigo-50 text-indigo-600'"
  @click="togglePinyin"
>
  {{ showPinyin ? '隐藏拼音 ▴' : '显示拼音 ▾' }}
</button>
```

原文行渲染（L190）由纯文本改为逐字 ruby：

```html
<p
  v-for="(line, i) in poem.text"
  :key="i"
  class="text-lg leading-relaxed text-center"
>
  <ruby v-for="(char, j) in line" :key="j">
    <rt v-if="showPinyin && pinyinByLine[i]?.[j]">{{ pinyinByLine[i][j] }}</rt>
    {{ char }}
  </ruby>
</p>
```

注：`v-if="showPinyin && ..."` 中 pinyin 为空串时 `v-if` 视为 falsy，标点不显示 rt，正好符合需求（标点上方无拼音）。

- [ ] **Step 4: 运行组件测试确认通过**

Run: `npx vitest run tests/component/PoemDetailPage.test.ts`
Expected: PASS (3 个测试)

- [ ] **Step 5: 运行全量单元测试确认无回归**

Run: `npx vitest run`
Expected: 全部 PASS

- [ ] **Step 6: 提交**

```bash
git add src/views/PoemDetailPage.vue tests/component/PoemDetailPage.test.ts
git commit -m "feat: show pinyin on poem detail page with toggle"
```

---

### Task 4: 类型检查 + 手动验证

**Files:** 无（验证用）

- [ ] **Step 1: 类型检查**

Run: `npx vue-tsc -b`
Expected: 无错误

- [ ] **Step 2: 启动 dev server 手动验证（可选）**

Run: `npm run dev`
手动检查：进入任一古诗详情页，原文每个字上方显示拼音；点"隐藏拼音"后拼音消失；刷新页面保持隐藏状态。

- [ ] **Step 3: 提交最终状态**

```bash
git status
git log --oneline -5
```

---

## Self-Review

**Spec coverage:**
- 拼音默认显示、每个字上方 → Task 3（rt 默认渲染，`showPinyin ?? true`）
- 切换开关 → Task 3（`togglePinyin` + `.pinyin-btn`）
- 偏好持久化 → Task 2（`UserSettings.showPinyin`）+ Task 3（`updateSettings`）
- 按行切分 → Task 1（`splitPinyinByLine`）
- pinyin 缺失回退纯文本 → Task 1 测试 + Task 3 的 `v-if` 守卫

**Placeholder scan:** 无 TBD/TODO。组件测试中的 `require` 用法与仓库内其他测试（如 `poem-card-page.test.ts`）的 store mock 方式一致，执行时若仓库模式不同可微调，但测试目标（默认显示 rt、切换消失、持久化）保持不变。

**Type consistency:** `splitPinyinByLine(text: string[], pinyin?: PinyinPair[])` 在 Task 1 定义、Task 3 使用；`showPinyin` 在 Task 2 定义、Task 3 读写；`pinyinByLine[i]?.[j]` 索引与 Task 1 返回的 `string[][]` 一致。
