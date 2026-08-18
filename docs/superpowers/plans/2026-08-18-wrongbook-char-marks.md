# 错题本字词标注展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在错题本页面展示字词级背诵标注——卡片按诗合并显示错题类型标签与字词角标，弹窗内古诗逐字高亮并显示错误次数。

**Architecture:** 复用已持久化的 `LearningRecord.charMarkStats` 与现有 `getCharMarkStats(poemId, poemText)`。新增两个纯函数（`buildCharMarkLookup`/`summarizeCharMarks`）于 `src/utils/charMark.ts`；增强 `PoemPopup` 支持可选 `charMarkStats` prop 逐字高亮；重构 `WrongBookPage` 按诗聚合分组展示。

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, @vue/test-utils

---

### Task 1: charMark 工具函数（buildCharMarkLookup / summarizeCharMarks）

**Files:**
- Modify: `src/utils/charMark.ts`
- Test: `tests/unit/charMark.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/unit/charMark.test.ts` 末尾追加：

```typescript
import { parseLine, buildCharMarkLookup, summarizeCharMarks } from '@/utils/charMark'
import type { CharMarkStats } from '@/types'

describe('buildCharMarkLookup', () => {
  it('builds lookup keyed by lineIndex-charIndex', () => {
    const stats: CharMarkStats[] = [
      { poemId: 'p1', lineIndex: 0, charIndex: 2, char: '清', fuzzyCount: 0, wrongCount: 3 },
      { poemId: 'p1', lineIndex: 1, charIndex: 0, char: '红', fuzzyCount: 2, wrongCount: 0 },
    ]
    const lookup = buildCharMarkLookup(stats)
    expect(lookup['0-2']).toEqual({ char: '清', fuzzyCount: 0, wrongCount: 3 })
    expect(lookup['1-0']).toEqual({ char: '红', fuzzyCount: 2, wrongCount: 0 })
    expect(lookup['9-9']).toBeUndefined()
  })
})

describe('summarizeCharMarks', () => {
  it('counts wrong and fuzzy separately', () => {
    const stats: CharMarkStats[] = [
      { poemId: 'p1', lineIndex: 0, charIndex: 0, char: '床', fuzzyCount: 0, wrongCount: 2 },
      { poemId: 'p1', lineIndex: 0, charIndex: 1, char: '前', fuzzyCount: 3, wrongCount: 0 },
      { poemId: 'p1', lineIndex: 0, charIndex: 2, char: '明', fuzzyCount: 1, wrongCount: 1 },
    ]
    // 一个字既有 fuzzy 又有 wrong 时优先计入 wrong
    expect(summarizeCharMarks(stats)).toEqual({ wrongCount: 2, fuzzyCount: 1 })
  })

  it('returns zeros for empty stats', () => {
    expect(summarizeCharMarks([])).toEqual({ wrongCount: 0, fuzzyCount: 0 })
  })
})
```

注意：更新文件顶部 import 行以包含新函数。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/charMark.test.ts`
Expected: FAIL，报 `buildCharMarkLookup` / `summarizeCharMarks` 未定义

- [ ] **Step 3: 实现**

在 `src/utils/charMark.ts` 末尾追加：

```typescript
import type { CharMarkStats } from '@/types'

/** 单字统计查找表条目 */
export interface CharMarkStatEntry {
  char: string
  fuzzyCount: number
  wrongCount: number
}

/** 从 CharMarkStats[] 构建 `${lineIndex}-${charIndex}` 查找表 */
export function buildCharMarkLookup(stats: CharMarkStats[]): Record<string, CharMarkStatEntry> {
  const lookup: Record<string, CharMarkStatEntry> = {}
  for (const s of stats) {
    lookup[`${s.lineIndex}-${s.charIndex}`] = { char: s.char, fuzzyCount: s.fuzzyCount, wrongCount: s.wrongCount }
  }
  return lookup
}

/** 某诗的字词统计摘要（用于角标）。一个字同时有 fuzzy/wrong 记录时优先计入 wrong */
export interface CharMarkSummary {
  wrongCount: number
  fuzzyCount: number
}

export function summarizeCharMarks(stats: CharMarkStats[]): CharMarkSummary {
  let wrongCount = 0
  let fuzzyCount = 0
  for (const s of stats) {
    if (s.wrongCount > 0) wrongCount++
    else if (s.fuzzyCount > 0) fuzzyCount++
  }
  return { wrongCount, fuzzyCount }
}
```

注意：`CharMarkStats` 已从 `@/types` 导出（见 `src/types/index.ts:113`）。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/charMark.test.ts`
Expected: PASS（原有 4 个 parseLine 测试 + 新增 3 个测试）

- [ ] **Step 5: 提交**

```bash
git add src/utils/charMark.ts tests/unit/charMark.test.ts
git commit -m "feat: add char mark lookup and summary utils"
```

---

### Task 2: PoemPopup 支持 charMarkStats 高亮

**Files:**
- Modify: `src/components/PoemPopup.vue`
- Test: `tests/component/PoemPopup.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/component/PoemPopup.test.ts` 末尾追加 describe 块：

```typescript
import { parseLine } from '@/utils/charMark'
import type { CharMarkStats } from '@/types'

describe('PoemPopup char mark highlighting', () => {
  const charMarkStats: CharMarkStats[] = [
    { poemId: 'p1', lineIndex: 0, charIndex: 2, char: '明', fuzzyCount: 0, wrongCount: 3 },
    { poemId: 'p1', lineIndex: 0, charIndex: 3, char: '月', fuzzyCount: 2, wrongCount: 0 },
  ]

  it('renders highlighted chars when charMarkStats provided', async () => {
    const wrapper = mountPopup({ visible: true, charMarkStats })
    await wrapper.vm.$nextTick()
    const fuzzySpans = wrapper.findAll('.popup-char-fuzzy')
    const wrongSpans = wrapper.findAll('.popup-char-wrong')
    expect(fuzzySpans.length).toBe(1)
    expect(fuzzySpans[0].text()).toBe('月')
    expect(wrongSpans.length).toBe(1)
    expect(wrongSpans[0].text()).toBe('明')
  })

  it('shows wrong count as superscript on highlighted chars', async () => {
    const wrapper = mountPopup({ visible: true, charMarkStats })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.popup-char-wrong').text()).toContain('×3')
    expect(wrapper.find('.popup-char-fuzzy').text()).toContain('×2')
  })

  it('renders plain text when no charMarkStats', async () => {
    const wrapper = mountPopup({ visible: true })
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.popup-char-fuzzy').length).toBe(0)
    expect(wrapper.findAll('.popup-char-wrong').length).toBe(0)
    expect(wrapper.text()).toContain('床前明月光')
  })

  it('renders plain text when charMarkStats is empty array', async () => {
    const wrapper = mountPopup({ visible: true, charMarkStats: [] })
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.popup-char-fuzzy').length).toBe(0)
    expect(wrapper.findAll('.popup-char-wrong').length).toBe(0)
  })

  it('renders punctuation normally with highlighting', async () => {
    const poemWithPunct: Poem = { ...mockPoem, text: ['床前明月光，'] }
    const stats: CharMarkStats[] = [
      { poemId: 'p1', lineIndex: 0, charIndex: 4, char: '光', fuzzyCount: 0, wrongCount: 1 },
    ]
    const wrapper = mountPopup({ visible: true, poem: poemWithPunct, charMarkStats: stats })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.popup-char-wrong').text()).toContain('光')
    expect(wrapper.text()).toContain('，')
  })
})
```

更新 mountPopup 签名以支持新 prop：

```typescript
function mountPopup(props: { poem?: Poem; visible?: boolean; charMarkStats?: CharMarkStats[] } = {}) {
  activeWrapper = mount(PoemPopup, {
    props: { poem: mockPoem, visible: false, ...props },
    global: { plugins: [createPinia()], stubs: { Teleport: { template: '<div><slot /></div>' } } },
  })
  return activeWrapper
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/component/PoemPopup.test.ts`
Expected: FAIL（无高亮渲染，`.popup-char-fuzzy` 找不到）

- [ ] **Step 3: 实现 PoemPopup**

修改 `src/components/PoemPopup.vue`：

1. Script 增加 props 和 import：

```typescript
import { ref, watch, nextTick, onBeforeUnmount, computed } from 'vue'
import type { Poem, CharMarkStats } from '@/types'
import { parseLine, buildCharMarkLookup } from '@/utils/charMark'

const props = defineProps<{
  poem: Poem
  visible: boolean
  charMarkStats?: CharMarkStats[]
}>()
```

2. 新增 computed：

```typescript
const charLookup = computed(() => buildCharMarkLookup(props.charMarkStats ?? []))
const hasCharMarks = computed(() => (props.charMarkStats?.length ?? 0) > 0)
```

3. 模板的 popup-body 改为条件渲染：

```html
<div class="popup-body">
  <template v-if="hasCharMarks">
    <p v-for="(line, i) in poem.text" :key="i" class="popup-line">
      <template v-for="(segment, j) in parseLine(line)" :key="j">
        <template v-if="segment.type === 'char'">
          <span
            v-if="charLookup[`${i}-${segment.charIdx}`]?.wrongCount > 0"
            class="popup-char-wrong"
          >{{ segment.char }}<sup class="popup-char-count">{{ charLookup[`${i}-${segment.charIdx}`].wrongCount }}</sup></span>
          <span
            v-else-if="charLookup[`${i}-${segment.charIdx}`]?.fuzzyCount > 0"
            class="popup-char-fuzzy"
          >{{ segment.char }}<sup class="popup-char-count">{{ charLookup[`${i}-${segment.charIdx}`].fuzzyCount }}</sup></span>
          <span v-else>{{ segment.char }}</span>
        </template>
        <span v-else>{{ segment.char }}</span>
      </template>
    </p>
  </template>
  <p v-for="(line, i) in poem.text" :key="i" class="popup-line" v-else>{{ line }}</p>
</div>
```

注意：`v-else` 与同元素 `v-for` 不能共存，需拆成两段（如上述写法）。

4. Style 追加：

```css
.popup-char-fuzzy {
  background: #fef3c7;
  color: #d97706;
  border-radius: 3px;
  padding: 0 1px;
}
.popup-char-wrong {
  background: #fecaca;
  color: #dc2626;
  border-radius: 3px;
  padding: 0 1px;
}
.popup-char-count {
  font-size: 0.625rem;
  margin-left: 1px;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/component/PoemPopup.test.ts`
Expected: PASS（原有 11 个 + 新增 5 个）

- [ ] **Step 5: 验证现有使用者不受影响**

Run: `npx vitest run tests/component/poem-card-page.test.ts tests/component/QuizPlayPage.test.ts`
Expected: PASS（PoemPopup 在 QuizResultPage/PoemCollectionPage 使用处未传 charMarkStats，走纯文本分支）

- [ ] **Step 6: 提交**

```bash
git add src/components/PoemPopup.vue tests/component/PoemPopup.test.ts
git commit -m "feat: PoemPopup renders char mark highlighting with counts"
```

---

### Task 3: WrongBookPage 按诗聚合展示

**Files:**
- Modify: `src/views/WrongBookPage.vue`
- Test: `tests/component/WrongBookPage.test.ts` (Create)

- [ ] **Step 1: 写失败测试**

创建 `tests/component/WrongBookPage.test.ts`：

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import WrongBookPage from '@/views/WrongBookPage.vue'
import type { Poem, WrongEntry } from '@/types'

// poem store mock: 提供诗数据和启用状态
const mockPoems: Poem[] = [
  { id: 'p1', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级', text: ['床前明月光', '疑是地上霜'], textType: '五言', yiwen: '' },
]

vi.mock('@/stores/poem', () => ({
  usePoemStore: () => ({
    fetchPoems: vi.fn(),
    getPoemById: (id: string) => mockPoems.find(p => p.id === id),
    isEnabled: () => true,
  }),
}))

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

function mountPage() {
  return mount(WrongBookPage, {
    global: {
      plugins: [createPinia()],
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
}

function seedWrongBook(entries: Partial<WrongEntry>[] = []) {
  const store = useLearningStore()
  // 直接写入 store.data
  store.data = {
    records: [],
    quizResults: [],
    reciteRecords: [],
    wrongBook: entries.map(e => ({
      poemId: 'p1', quizType: 'line' as const, wrongCount: 1,
      lastWrongDate: '2026-08-18', unproficient: false, ...e,
    })),
    settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] },
  }
}
```

（上述 import 中需补 `useLearningStore`。）

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/component/WrongBookPage.test.ts`
Expected: 文件不存在 → vitest 报 no test files

- [ ] **Step 3: 实现 WrongBookPage 聚合**

完整重写 `src/views/WrongBookPage.vue`（保留现有样式与功能，改为聚合分组）：

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useLearningStore } from '@/stores/learning'
import { usePoemStore } from '@/stores/poem'
import PoemPopup from '@/components/PoemPopup.vue'
import { summarizeCharMarks } from '@/utils/charMark'
import type { Poem, WrongEntry, CharMarkSummary } from '@/types'

const learningStore = useLearningStore()
const poemStore = usePoemStore()

onMounted(() => poemStore.fetchPoems())

const popupVisible = ref(false)
const popupPoemId = ref('')

const popupPoem = computed<Poem | undefined>(() => {
  if (!popupPoemId.value) return undefined
  return poemStore.getPoemById(popupPoemId.value)
})

function togglePopup(poemId: string) {
  if (popupPoemId.value === poemId && popupVisible.value) {
    popupVisible.value = false
  } else {
    popupPoemId.value = poemId
    popupVisible.value = true
  }
}

const quizTypeLabels: Record<string, string> = {
  fillBlank: '补字选择',
  nextLine: '上下句接龙',
  recite: '背诵',
  line: '卡顿句',
  author: '作者',
  dynasty: '朝代',
}

const enabledWrongBook = computed(() => {
  return learningStore.wrongBook.filter(entry => poemStore.isEnabled(entry.poemId))
})

// 按诗聚合分组
interface GroupedWrongEntry {
  poemId: string
  poem?: Poem
  entries: WrongEntry[]
  quizTypeLabels: string[]
  totalWrongCount: number
  charSummary: CharMarkSummary | null
}

const groupedEntries = computed<GroupedWrongEntry[]>(() => {
  const map = new Map<string, GroupedWrongEntry>()
  for (const entry of enabledWrongBook.value) {
    let group = map.get(entry.poemId)
    if (!group) {
      const poem = poemStore.getPoemById(entry.poemId)
      const stats = poem
        ? learningStore.getCharMarkStats(entry.poemId, poem.text)
        : []
      group = {
        poemId: entry.poemId,
        poem,
        entries: [],
        quizTypeLabels: [],
        totalWrongCount: 0,
        charSummary: stats.length > 0 ? summarizeCharMarks(stats) : null,
      }
      map.set(entry.poemId, group)
    }
    group.entries.push(entry)
    const label = quizTypeLabels[entry.quizType] ?? entry.quizType
    if (!group.quizTypeLabels.includes(label)) group.quizTypeLabels.push(label)
    group.totalWrongCount += entry.wrongCount
  }
  return Array.from(map.values())
})

// 标签点击：记录当前操作条目
const actionEntry = ref<WrongEntry | null>(null)

function openEntryAction(entry: WrongEntry) {
  actionEntry.value = entry
}

// 移除当前操作条目
function removeActionEntry() {
  if (!actionEntry.value) return
  learningStore.removeWrongEntry(actionEntry.value.poemId, actionEntry.value.quizType)
  actionEntry.value = null
}

// 标不熟练当前操作条目（作用于整首诗所有条目，沿用现有 store 逻辑）
function toggleActionEntryUnproficient() {
  if (!actionEntry.value) return
  learningStore.toggleUnproficient(actionEntry.value.poemId)
  actionEntry.value = null
}
</script>
```

模板部分（保留原卡片视觉，改造为聚合）与操作菜单（新增）。完整模板：

```html
<template>
  <div class="w-full max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-6">错题本</h2>

    <div v-if="groupedEntries.length === 0" class="text-center text-gray-400 py-12">
      暂无错题
    </div>

    <div v-else class="mb-6">
      <div v-for="group in groupedEntries" :key="group.poemId" class="p-3 bg-white border border-gray-200 rounded-lg mb-2 shadow-sm">
        <div class="flex items-center gap-2 mb-2">
          <span class="font-bold flex-1 cursor-pointer text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300" @click="togglePopup(group.poemId)">{{ group.poem?.title ?? '' }}</span>
          <!-- 字词角标：无数据隐藏 -->
          <span v-if="group.charSummary && (group.charSummary.wrongCount + group.charSummary.fuzzyCount) > 0" class="text-xs font-medium">
            <span class="text-red-500">错{{ group.charSummary.wrongCount }}字</span>
            <span class="text-yellow-600"> · 模糊{{ group.charSummary.fuzzyCount }}字</span>
          </span>
          <span class="text-xs text-red-500">错 {{ group.totalWrongCount }} 次</span>
        </div>
        <div class="flex flex-wrap gap-1 mb-2">
          <!-- 错题类型标签：可点击弹出该条目操作 -->
          <span
            v-for="entry in group.entries"
            :key="entry.quizType + (entry.note ?? '')"
            class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded cursor-pointer hover:bg-gray-200"
            :title="entry.note ?? (quizTypeLabels[entry.quizType] ?? entry.quizType)"
            @click="openEntryAction(entry)"
          >{{ quizTypeLabels[entry.quizType] ?? entry.quizType }}</span>
        </div>
        <p v-if="group.entries.some(e => e.note)" class="text-xs text-gray-400 mb-2">
          {{ group.entries.filter(e => e.note).map(e => e.note).join('；') }}
        </p>

        <!-- 条目操作菜单：点击标签后弹出 -->
        <div v-if="actionEntry && actionEntry.poemId === group.poemId" class="mt-2 p-2 bg-gray-50 border border-gray-200 rounded">
          <p class="text-xs text-gray-500 mb-2">
            {{ quizTypeLabels[actionEntry.quizType] ?? actionEntry.quizType }}{{ actionEntry.note ? `（${actionEntry.note}）` : '' }}
          </p>
          <div class="flex gap-2">
            <button
              :class="['px-3 py-1 text-xs border rounded transition', actionEntry.unproficient ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 bg-white text-gray-600']"
              @click="toggleActionEntryUnproficient"
            >
              {{ actionEntry.unproficient ? '已标不熟练' : '标不熟练' }}
            </button>
            <button class="px-3 py-1 text-xs border border-gray-200 rounded bg-white text-gray-500 hover:bg-gray-50 transition" @click="removeActionEntry">
              移除
            </button>
            <button class="px-3 py-1 text-xs border border-gray-200 rounded bg-white text-gray-400 hover:bg-gray-50 transition" @click="actionEntry = null">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>

    <PoemPopup v-if="popupPoem" :poem="popupPoem" v-model:visible="popupVisible" :char-mark-stats="popupCharMarkStats" />

    <router-link :to="{ name: 'home' }" class="block text-center text-indigo-500 no-underline text-sm">返回首页</router-link>
  </div>
</template>
```

补充 `popupCharMarkStats` computed：

```typescript
const popupCharMarkStats = computed(() => {
  if (!popupPoem.value) return undefined
  return learningStore.getCharMarkStats(popupPoem.value.id, popupPoem.value.text)
})
```

注意：一个诗题只对应一个 PoemPopup 实例，`popupCharMarkStats` 自动匹配当前弹窗诗。

- [ ] **Step 4: 补全测试并运行**

将第一步的测试骨架补充完整（含分组/角标/标签操作断言）：

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useLearningStore } from '@/stores/learning'
import WrongBookPage from '@/views/WrongBookPage.vue'
import type { Poem, WrongEntry } from '@/types'

const mockPoems: Poem[] = [
  { id: 'p1', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级', text: ['床前明月光', '疑是地上霜'], textType: '五言', yiwen: '' },
  { id: 'p2', title: '咏鹅', author: '骆宾王', dynasty: '唐', grade: '一年级', text: ['鹅，鹅，鹅，', '曲项向天歌。'], textType: '五言', yiwen: '' },
]

vi.mock('@/stores/poem', () => ({
  usePoemStore: () => ({
    fetchPoems: vi.fn(),
    getPoemById: (id: string) => mockPoems.find(p => p.id === id),
    isEnabled: () => true,
  }),
}))

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

function mountPage() {
  return mount(WrongBookPage, {
    global: {
      plugins: [createPinia()],
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
}

function seed(store: ReturnType<typeof useLearningStore>, entries: Partial<WrongEntry>[]) {
  store.data = {
    records: [],
    quizResults: [],
    reciteRecords: [],
    wrongBook: entries.map(e => ({
      poemId: 'p1', quizType: 'line' as const, wrongCount: 1,
      lastWrongDate: '2026-08-18', unproficient: false, ...e,
    })) as WrongEntry[],
    settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] },
  }
}

describe('WrongBookPage grouping', () => {
  it('groups multiple entries of the same poem into one card', async () => {
    const store = useLearningStore()
    seed(store, [
      { quizType: 'line', note: '第1句:stuck' },
      { quizType: 'line', note: '第2句:forgot' },
      { quizType: 'author' },
    ])
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    // 聚合为一首诗的卡片
    expect(wrapper.findAll('.bg-white.border').filter(el => el.text().includes('静夜思')).length).toBe(1)
  })

  it('shows all quiz type labels for grouped poem', async () => {
    const store = useLearningStore()
    seed(store, [
      { quizType: 'line', note: '第1句:stuck' },
      { quizType: 'author' },
    ])
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('卡顿句')
    expect(wrapper.text()).toContain('作者')
  })

  it('hides char summary when no char mark stats', async () => {
    const store = useLearningStore()
    seed(store, [{ quizType: 'line', note: '第1句:stuck' }])
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('错')
    expect(wrapper.text()).not.toContain('模糊')
  })

  it('shows char summary when poem has char mark stats', async () => {
    const store = useLearningStore()
    store.recordReciteWithCharMarks('p1', false, mockPoems[0].text, { '0-2': 'wrong', '1-1': 'fuzzy' })
    seed(store, [{ quizType: 'recite' }])
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('错1字')
    expect(wrapper.text()).toContain('模糊1字')
  })

  it('clicking a quiz type label opens action menu for that entry', async () => {
    const store = useLearningStore()
    seed(store, [
      { quizType: 'line', note: '第1句:stuck' },
      { quizType: 'author' },
    ])
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    // 点击「作者」标签
    const labels = wrapper.findAll('.bg-gray-100.px-2')
    const authorLabel = labels.find(l => l.text() === '作者')!
    await authorLabel.trigger('click')
    expect(wrapper.text()).toContain('移除')
  })

  it('removing an entry via action menu keeps card if other entries remain', async () => {
    const store = useLearningStore()
    seed(store, [
      { quizType: 'line', note: '第1句:stuck' },
      { quizType: 'author' },
    ])
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    const labels = wrapper.findAll('.bg-gray-100.px-2')
    const authorLabel = labels.find(l => l.text() === '作者')!
    await authorLabel.trigger('click')
    await wrapper.find('button').filter(b => b.text() === '移除').trigger('click')
    await wrapper.vm.$nextTick()
    // author 条目被移除，line 条目保留 → 卡片仍在
    expect(wrapper.text()).toContain('静夜思')
    expect(wrapper.text()).toContain('卡顿句')
    expect(wrapper.text()).not.toContain('作者')
  })
})
```

注意：测试中 `.bg-gray-100.px-2` 选择器可能因 Tailwind class 生成方式不精确，可改用 `data-testid`。建议在实现模板中为标签加 `data-testid="wrong-entry-label"`，为操作按钮加 `data-testid="remove-entry-btn"`，测试用 find 方法。

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run tests/component/WrongBookPage.test.ts`
Expected: PASS

- [ ] **Step 6: 全量测试回归**

Run: `npx vitest run`
Expected: 所有测试通过（既有 26 文件 + 新 WrongBookPage 文件）

- [ ] **Step 7: 类型检查**

Run: `npx vue-tsc -b`
Expected: 无错误

- [ ] **Step 8: 提交**

```bash
git add src/views/WrongBookPage.vue tests/component/WrongBookPage.test.ts
git commit -m "feat: group wrong book entries by poem with char mark badge"
```

---

### Task 4: E2E 测试与收尾

**Files:**
- Create: `tests/e2e/wrongbook-char-marks.spec.ts`

- [ ] **Step 1: 写 e2e 测试**

创建 `tests/e2e/wrongbook-char-marks.spec.ts`（参考现有 `tests/e2e/char-marking.spec.ts` 的流程）：

```typescript
import { test, expect } from '@playwright/test'

// 参考 tests/e2e/char-marking.spec.ts 的导航与 seed 方式
// 场景：
// 1. 进入背诵 → 标记错字 → 提交 → 进入错题本
// 2. 断言错题本卡片显示「错X字 · 模糊Y字」角标
// 3. 点击诗题 → 弹窗内高亮字可见（.popup-char-wrong / .popup-char-fuzzy）
// 4. 点击错题类型标签 → 操作菜单可见
```

（按现有 e2e 模式补全具体步骤，参考 `recitation-flow.spec.ts` 如何产生错题。）

- [ ] **Step 2: 运行 e2e**

Run: `npm run test:e2e -- wrongbook-char-marks`
Expected: PASS（若 e2e 环境不可用，记录并说明）

- [ ] **Step 3: 提交**

```bash
git add tests/e2e/wrongbook-char-marks.spec.ts
git commit -m "test: add e2e coverage for wrongbook char marks"
```

---

## Self-Review 记录

- **Spec coverage**：卡片聚合（Task 3）、字词角标（Task 3）、弹窗高亮+次数（Task 2）、无数据隐藏（Task 2/3）、标签可点击操作（Task 3）、单条目退化（Task 3 聚合逻辑天然支持）全部覆盖
- **Type consistency**：`CharMarkSummary`/`CharMarkStatEntry` 在 Task 1 定义，Task 3 复用；`getCharMarkStats` 签名与现有 learning.ts 一致；`charMarkStats` prop 与 `CharMarkStats[]` 类型一致
- **兼容性**：PoemPopup 可选 prop，QuizResultPage/PoemCollectionPage 不受影响
