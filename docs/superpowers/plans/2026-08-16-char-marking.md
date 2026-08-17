# 字词标记功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 RecitationCard 中实现点击汉字标记背诵错误（三态循环：ok→模糊→错误→ok），行内高亮，持久化到 localStorage。

**Architecture:** 逐字拆分渲染方案。每行文字通过 parseLine 拆分为字符段，汉字渲染为独立 span 绑定点击事件。字级状态保存在 learning store 的 `charMarks`（当前会话）和 `ReciteRecord.charMarks`（提交快照）+ `LearningRecord.charMarkStats`（聚合统计）。

**Tech Stack:** Vue 3, Pinia, TypeScript, Tailwind CSS, Vitest, @vue/test-utils

**相关文件：**
- `src/types/index.ts` — 类型定义
- `src/utils/storage.ts` — localStorage 加载时字段补全
- `src/stores/learning.ts` — store 逻辑
- `src/components/RecitationCard.vue` — 核心 UI
- `src/views/PoemCardPage.vue` — 提交时传参（saveResult）
- `src/views/RecitationPlayPage.vue` — 提交时传参（onSubmit）

---

### Task 1: 定义类型

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 添加字词标记相关类型**

在 `src/types/index.ts` 中添加以下类型：

```typescript
// 字级标记状态（ok = 无记录，不显式存储）
export type CharMarkStatus = 'fuzzy' | 'wrong'

// 会话内字级标记 map，key 为 `${lineIndex}-${charIndex}`
export type CharMarkMap = Record<string, CharMarkStatus>

// 单字聚合统计（跨所有历史背诵快照累计）
export interface CharMarkStats {
  poemId: string
  lineIndex: number
  charIndex: number
  char: string           // 原字，用于校验数据一致性
  fuzzyCount: number     // 被标为模糊的次数
  wrongCount: number     // 被标为错误的次数
}
```

修改 `LearningRecord`，新增 `charMarkStats` 字段：

```typescript
export interface LearningRecord {
  poemId: string
  lastReviewDate: string
  reviewCount: number
  nextReviewDate: string
  correctness: number[]
  reciteCorrectness: number[]   // 新增：背诵正确性历史
  masteryLevel: MasteryLevel
  unproficient: boolean
  unproficientCorrectStreak: number
  lastLearnDate?: string
  charMarkStats: CharMarkStats[]  // 新增：按字聚合的统计
}
```

修改 `ReciteRecord`，新增 `charMarks` 字段：

```typescript
export interface ReciteRecord {
  poemId: string
  date: string           // YYYY-MM-DD
  correct: boolean       // 自评"会"=true，"不会"=false
  charMarks: CharMarkMap  // 新增：本次背诵最终状态的快照
}
```

- [ ] **Step 2: 验证类型编译**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/char-marking && npx vue-tsc --noEmit`
Expected: 类型错误（现有测试代码中构造 `LearningRecord`/`ReciteRecord` 处缺新字段会报错）— 这是预期的，后续任务修复。

---

### Task 2: storage.ts 字段补全

**Files:**
- Modify: `src/utils/storage.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/unit/storage.test.ts` 末尾添加：

```typescript
it('adds charMarkStats and charMarks to old data', () => {
  const oldData = {
    records: [{ poemId: 'p001', lastReviewDate: '2026-01-01', reviewCount: 1, nextReviewDate: '2026-01-02', correctness: [1], reciteCorrectness: [], masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0 }],
    quizResults: [],
    reciteRecords: [{ poemId: 'p001', date: '2026-01-01', correct: true }],
    wrongBook: [],
    settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
  }
  localStorage.setItem('poem-quiz-data', JSON.stringify(oldData))
  const data = loadData()
  expect(data.records[0].charMarkStats).toEqual([])
  expect(data.reciteRecords[0].charMarks).toEqual({})
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run tests/unit/storage.test.ts`
Expected: 新测试 FAIL（`charMarkStats` 为 undefined）

- [ ] **Step 3: 实现字段补全**

修改 `loadData()` 中的 records 映射，补充 `charMarkStats`：

```typescript
const data = {
  records: (parsed.records ?? defaults.records).map(r => ({
    ...r,
    reciteCorrectness: r.reciteCorrectness ?? [],
    charMarkStats: r.charMarkStats ?? [],
  })),
  quizResults: parsed.quizResults ?? defaults.quizResults,
  reciteRecords: (parsed.reciteRecords ?? defaults.reciteRecords).map(r => ({
    ...r,
    charMarks: r.charMarks ?? {},
  })),
  wrongBook: parsed.wrongBook ?? defaults.wrongBook,
  settings: { ...defaults.settings, ...parsed.settings },
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run tests/unit/storage.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/types/index.ts src/utils/storage.ts tests/unit/storage.test.ts
git commit -m "feat: add char mark types and storage migration"
```

---

### Task 3: learning store 字词标记逻辑

**Files:**
- Modify: `src/stores/learning.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/learning-char-marks.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useLearningStore } from '@/stores/learning'
import { createPinia, setActivePinia } from 'pinia'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('char marks in learning store', () => {
  it('initCharMarks resets current char marks', () => {
    const store = useLearningStore()
    store.toggleCharMark('p001', 0, 2)
    expect(Object.keys(store.charMarks)).toHaveLength(1)
    store.initCharMarks()
    expect(Object.keys(store.charMarks)).toHaveLength(0)
  })

  it('toggleCharMark cycles ok→fuzzy→wrong→ok', () => {
    const store = useLearningStore()
    // ok → fuzzy
    store.toggleCharMark('p001', 0, 0)
    expect(store.charMarks['0-0']).toBe('fuzzy')
    // fuzzy → wrong
    store.toggleCharMark('p001', 0, 0)
    expect(store.charMarks['0-0']).toBe('wrong')
    // wrong → ok (删除条目)
    store.toggleCharMark('p001', 0, 0)
    expect(store.charMarks['0-0']).toBeUndefined()
  })

  it('toggleCharMark key format is lineIndex-charIndex', () => {
    const store = useLearningStore()
    store.toggleCharMark('p001', 2, 5)
    expect(store.charMarks['2-5']).toBe('fuzzy')
  })

  it('toggleCharMark does not require existing record', () => {
    const store = useLearningStore()
    expect(() => store.toggleCharMark('p999', 0, 0)).not.toThrow()
    expect(store.charMarks['0-0']).toBe('fuzzy')
  })

  it('recordReciteWithCharMarks saves charMarks snapshot and updates stats', () => {
    const store = useLearningStore()
    store.toggleCharMark('p001', 0, 0) // fuzzy
    store.toggleCharMark('p001', 0, 0) // wrong
    store.toggleCharMark('p001', 1, 3) // fuzzy
    store.recordReciteWithCharMarks('p001', false, ['床前明月光', '疑是地上霜'], { '0-0': 'wrong', '1-3': 'fuzzy' })

    const reciteRecord = store.data.reciteRecords[0]
    expect(reciteRecord.charMarks).toEqual({ '0-0': 'wrong', '1-3': 'fuzzy' })

    const record = store.getRecord('p001')
    expect(record!.charMarkStats).toEqual([
      { poemId: 'p001', lineIndex: 0, charIndex: 0, char: '床', fuzzyCount: 0, wrongCount: 1 },
      { poemId: 'p001', lineIndex: 1, charIndex: 3, char: '上', fuzzyCount: 1, wrongCount: 0 },
    ])
  })

  it('recordReciteWithCharMarks updates existing stats incrementally', () => {
    const store = useLearningStore()
    store.recordReciteWithCharMarks('p001', false, ['床前明月光'], { '0-0': 'fuzzy' }) // 1st: fuzzy
    store.recordReciteWithCharMarks('p001', false, ['床前明月光'], { '0-0': 'wrong' }) // 2nd: wrong

    const record = store.getRecord('p001')
    expect(record!.charMarkStats).toEqual([
      { poemId: 'p001', lineIndex: 0, charIndex: 0, char: '床', fuzzyCount: 1, wrongCount: 1 },
    ])
  })

  it('recordReciteWithCharMarks without marks keeps empty stats', () => {
    const store = useLearningStore()
    store.recordReciteWithCharMarks('p001', true, ['床前明月光'], {})
    const record = store.getRecord('p001')
    expect(record!.charMarkStats).toEqual([])
    expect(store.data.reciteRecords[0].charMarks).toEqual({})
  })

  it('getCharMarkStats skips stale stats when poem text changed', () => {
    const store = useLearningStore()
    store.recordReciteWithCharMarks('p001', false, ['床前明月光'], { '0-0': 'fuzzy' })
    // 原 stats: lineIndex=0, charIndex=0, char='床'
    // 诗文本变化后（'床' 不再是第一个汉字），校验应过滤该条
    const filtered = store.getCharMarkStats('p001', ['疑是地上霜'])
    expect(filtered).toEqual([])
    // 不传 poemText 时不做校验，返回原始统计
    const raw = store.getCharMarkStats('p001')
    expect(raw).toHaveLength(1)
  })
})
```

注意：`recordReciteWithCharMarks(poemId, correct, poemText, charMarksSnapshot)` 的 poemText 是诗行数组（用于解析汉字取原字），charMarksSnapshot 是本次背诵的字级标记。在调用方 PoemCardPage/RecitationPlayPage 中从 `result.charMarks` 和 `poem.text` 传入。

测试中 `'疑是地上霜'` 的汉字索引：疑(0) 是(1) 地(2) 上(3) 霜(4)，所以 charIdx=3 为 '上'。

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run tests/unit/learning-char-marks.test.ts`
Expected: FAIL（store 中无这些方法）

- [ ] **Step 3: 实现 store 逻辑**

在 `src/stores/learning.ts` 中添加：

```typescript
import { parseLine } from '@/utils/charMark'
import type { CharMarkMap, CharMarkStats } from '@/types'

// 当前会话的字级标记（不持久化，切换诗时重置）
const charMarks = ref<CharMarkMap>({})

function initCharMarks() {
  charMarks.value = {}
}

function toggleCharMark(lineIndex: number, charIndex: number) {
  const key = `${lineIndex}-${charIndex}`
  const current = charMarks.value[key]
  if (current === 'fuzzy') charMarks.value[key] = 'wrong'
  else if (current === 'wrong') delete charMarks.value[key]
  else charMarks.value[key] = 'fuzzy'
}

// 提交背诵时附带字级标记：保存快照并聚合统计
function recordReciteWithCharMarks(poemId: string, correct: boolean, poemText: string[], charMarksSnapshot: CharMarkMap) {
  recordRecite(poemId, correct)

  // 保存快照到 reciteRecords（覆盖刚 push 的默认空对象）
  const reciteRecords = data.value.reciteRecords
  const lastIdx = reciteRecords.length - 1
  if (lastIdx >= 0) {
    reciteRecords[lastIdx] = { ...reciteRecords[lastIdx], charMarks: charMarksSnapshot }
  }

  // 聚合统计
  if (Object.keys(charMarksSnapshot).length > 0) {
    const record = getRecord(poemId)
    if (record) {
      const stats = [...record.charMarkStats]
      // 用 parseLine 将诗行拆成段，通过 charIdx 找到对应汉字（跳过标点）
      const lineSegments = poemText.map(line => parseLine(line))
      for (const [key, status] of Object.entries(charMarksSnapshot)) {
        const [lineIndex, charIndex] = key.split('-').map(Number)
        const seg = lineSegments[lineIndex]?.find(s => s.type === 'char' && s.charIdx === charIndex)
        const char = seg?.char ?? ''
        const existing = stats.find(s => s.poemId === poemId && s.lineIndex === lineIndex && s.charIndex === charIndex)
        if (existing) {
          if (status === 'fuzzy') existing.fuzzyCount++
          else existing.wrongCount++
        } else {
          stats.push({
            poemId, lineIndex, charIndex, char,
            fuzzyCount: status === 'fuzzy' ? 1 : 0,
            wrongCount: status === 'wrong' ? 1 : 0,
          })
        }
      }
      record.charMarkStats = stats
    }
  }
  persist()
}

function getCharMarkStats(poemId: string, poemText?: string[]): CharMarkStats[] {
  const stats = getRecord(poemId)?.charMarkStats ?? []
  // spec「古诗内容变化」：若 poemText 提供，校验存储的 char 与当前诗行解析结果一致
  // 不一致说明 poems.json 已更新导致行内容变化，该条统计失效，跳过
  if (!poemText || stats.length === 0) return stats
  const lineSegments = poemText.map(line => parseLine(line))
  return stats.filter(s => {
    if (s.poemId !== poemId) return false
    const seg = lineSegments[s.lineIndex]?.find(seg => seg.type === 'char' && seg.charIdx === s.charIndex)
    return seg?.char === s.char
  })
}
```

导出这些方法。注意：`getCharMarkStats` 增加可选 `poemText` 参数用于校验（spec 边界要求）。`recordReciteWithCharMarks` 复用 `recordRecite`，但 `recordRecite` 内部会调用 `persist()`，随后再修改 reciteRecords 和 stats 后再次 `persist()`。为简单起见，`recordReciteWithCharMarks` 自己完成后调用 `persist()` 一次即可（recordRecite 内部那次是冗余但无害）。

在 store 的 return 对象中补充导出：

```typescript
return {
  // ...existing exports...
  charMarks, initCharMarks, toggleCharMark, recordReciteWithCharMarks, getCharMarkStats,
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run tests/unit/learning-char-marks.test.ts`
Expected: PASS

- [ ] **Step 5: 修复现有测试的类型错误**

现有 `learning-recite.test.ts` 中 `recordRecite` 仍可用（保留原方法），类型加了必填字段 `charMarkStats` 后，`tests/unit/learning-store.test.ts` 等构造 `LearningRecord` 的地方需补 `charMarkStats: []`。运行全部单测确认。

Run: `npx vitest run`
Expected: 全部 PASS

- [ ] **Step 6: 提交**

```bash
git add src/stores/learning.ts tests/unit/learning-char-marks.test.ts
git commit -m "feat: add char mark toggle and stats to learning store"
```

---

### Task 4: parseLine 工具函数

**Files:**
- Create: `src/utils/charMark.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/charMark.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import { parseLine } from '@/utils/charMark'

describe('parseLine', () => {
  it('splits line into char and punct segments with charIdx', () => {
    expect(parseLine('床前明月光，')).toEqual([
      { type: 'char', char: '床', charIdx: 0 },
      { type: 'char', char: '前', charIdx: 1 },
      { type: 'char', char: '明', charIdx: 2 },
      { type: 'char', char: '月', charIdx: 3 },
      { type: 'char', char: '光', charIdx: 4 },
      { type: 'punct', char: '，' },
    ])
  })

  it('skips punctuation when counting charIdx', () => {
    expect(parseLine('鹅，鹅，鹅，')).toEqual([
      { type: 'char', char: '鹅', charIdx: 0 },
      { type: 'punct', char: '，' },
      { type: 'char', char: '鹅', charIdx: 1 },
      { type: 'punct', char: '，' },
      { type: 'char', char: '鹅', charIdx: 2 },
      { type: 'punct', char: '，' },
    ])
  })

  it('handles multiple punctuation types', () => {
    expect(parseLine('举头望明月。')).toEqual([
      { type: 'char', char: '举', charIdx: 0 },
      { type: 'char', char: '头', charIdx: 1 },
      { type: 'char', char: '望', charIdx: 2 },
      { type: 'char', char: '明', charIdx: 3 },
      { type: 'char', char: '月', charIdx: 4 },
      { type: 'punct', char: '。' },
    ])
  })

  it('returns empty array for empty line', () => {
    expect(parseLine('')).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run tests/unit/charMark.test.ts`
Expected: FAIL（module not found）

- [ ] **Step 3: 实现 parseLine**

创建 `src/utils/charMark.ts`：

```typescript
/** Regex matching Chinese characters (CJK Unified Ideographs). */
export const CJK_CHAR_REGEX = /[\u4e00-\u9fff]/

export interface CharSegment {
  type: 'char' | 'punct'
  char: string
  charIdx: number  // 汉字索引（跳过标点）；punct 段无意义为 -1
}

/** 将一行诗拆分为字符段，汉字带递增的 charIdx（跳过标点）。 */
export function parseLine(line: string): CharSegment[] {
  const segments: CharSegment[] = []
  let charIdx = 0
  for (const ch of line) {
    if (CJK_CHAR_REGEX.test(ch)) {
      segments.push({ type: 'char', char: ch, charIdx: charIdx++ })
    } else {
      segments.push({ type: 'punct', char: ch, charIdx: -1 })
    }
  }
  return segments
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run tests/unit/charMark.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/charMark.ts tests/unit/charMark.test.ts
git commit -m "feat: add parseLine util for char-level splitting"
```

---

### Task 5: RecitationCard 逐字渲染 + 点击标记

**Files:**
- Modify: `src/components/RecitationCard.vue`

- [ ] **Step 1: 写失败测试**

在 `tests/unit/RecitationCard.test.ts` 中新增 describe 块。注意现有 mock 需要补充 store 的 char mark 方法。

修改文件顶部：引入 `useLearningStore`，并将 mock 函数提升到模块级以便断言：

```typescript
import { useLearningStore } from '@/stores/learning'

// 模块级可断言 mock 函数
const toggleCharMarkMock = vi.fn()
const initCharMarksMock = vi.fn()
const charMarksMock = {} as Record<string, string>

vi.mock('@/stores/learning', () => ({
  useLearningStore: () => ({
    settings: { showYiwen: false },
    updateSettings: vi.fn(),
    charMarks: charMarksMock,
    toggleCharMark: toggleCharMarkMock,
    initCharMarks: initCharMarksMock,
  }),
}))
```

注意：这些 mock 函数和对象定义在 `vi.mock` 之前，因为 `vi.mock` 被 hoisted。若 hoisting 导致引用问题，将 mock 声明移到 vi.mock 回调内部并通过 `vi.hoisted` 提升：

```typescript
const { toggleCharMarkMock, initCharMarksMock, charMarksMock } = vi.hoisted(() => ({
  toggleCharMarkMock: vi.fn(),
  initCharMarksMock: vi.fn(),
  charMarksMock: {} as Record<string, string>,
}))

vi.mock('@/stores/learning', () => ({
  useLearningStore: () => ({
    settings: { showYiwen: false },
    updateSettings: vi.fn(),
    charMarks: charMarksMock,
    toggleCharMark: toggleCharMarkMock,
    initCharMarks: initCharMarksMock,
  }),
}))
```

（优先使用 `vi.hoisted` 方案，避免 hoisting 竞态。）

新增测试：

```typescript
describe('char-level marking', () => {
  beforeEach(() => {
    toggleCharMarkMock.mockClear()
    initCharMarksMock.mockClear()
    Object.keys(charMarksMock).forEach(k => delete charMarksMock[k])
  })

  it('renders each char as a clickable span', () => {
    const wrapper = mountCard()
    // '床前明月光' 有 5 个汉字，无标点
    const charSpans = wrapper.findAll('.char-mark')
    expect(charSpans.length).toBe(5)
    expect(charSpans[0].text()).toBe('床')
  })

  it('does not render punctuation as clickable chars', () => {
    const poemWithPunct: Poem = {
      ...mockPoem,
      text: ['床前明月光，', '疑是地上霜。'],
    }
    const wrapper = mountCard({ poem: poemWithPunct })
    const charSpans = wrapper.findAll('.char-mark')
    expect(charSpans.length).toBe(10)  // 5+5 汉字
    expect(wrapper.findAll('.punct').length).toBe(2)
  })

  it('clicking a char calls toggleCharMark with line and char index', async () => {
    const wrapper = mountCard()
    const charSpans = wrapper.findAll('.char-mark')
    await charSpans[2].trigger('click')
    expect(toggleCharMarkMock).toHaveBeenCalledWith(0, 2)
  })

  it('switching poem calls initCharMarks to reset session marks', async () => {
    const wrapper = mountCard()
    const initCallsBefore = initCharMarksMock.mock.calls.length
    await wrapper.setProps({ poem: { ...mockPoem, id: 'test-2', title: '咏鹅' } })
    expect(initCharMarksMock.mock.calls.length).toBeGreaterThan(initCallsBefore)
  })

  it('char status classes render from store charMarks', () => {
    charMarksMock['0-0'] = 'fuzzy'
    charMarksMock['0-1'] = 'wrong'
    const wrapper = mountCard()
    const charSpans = wrapper.findAll('.char-mark')
    expect(charSpans[0].classes().join(' ')).toContain('char-fuzzy')
    expect(charSpans[1].classes().join(' ')).toContain('char-wrong')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run tests/unit/RecitationCard.test.ts`
Expected: FAIL（.char-mark 不存在）

- [ ] **Step 3: 实现逐字渲染**

在 `RecitationCard.vue` 中：

引入：

```typescript
import { parseLine } from '@/utils/charMark'
import type { CharMarkMap, CharMarkStatus } from '@/types'
```

script 部分新增：

```typescript
// 当前诗的字级标记状态（直接读 store）
function charMarkClass(lineIndex: number, charIdx: number): string {
  const status = learningStore.charMarks[`${lineIndex}-${charIdx}`]
  if (status === 'fuzzy') return 'char-fuzzy'
  if (status === 'wrong') return 'char-wrong'
  return ''
}

function toggleCharMark(lineIndex: number, charIdx: number) {
  learningStore.toggleCharMark(lineIndex, charIdx)
}
```

**关键：切换古诗时重置字级标记（spec「切换古诗」边界要求）。**

修改现有 `watch(() => props.poem.id, ...)`，在重置行级状态的同时调用 `initCharMarks()`：

```typescript
watch(() => props.poem.id, () => {
  lineStatuses.value = props.poem.text.map((_, i) => ({ lineIndex: i, status: 'ok' as const }))
  authorCorrect.value = null
  dynastyCorrect.value = null
  showYiwen.value = learningStore.settings.showYiwen ?? false
  // 切换古诗时重置当前会话的字级标记
  learningStore.initCharMarks()
})
```

注意：`markMastered`/`markForgot`/`submitResult` 内部也需在提交后重置字级标记（`submitResult` 中调用 `initCharMarks()`，见 Task 6 Step 1）。切换诗（watch）与提交（submitResult）两条路径都要重置，避免残留。

template 中，将行文本 span 替换：

```html
<span class="flex-1 text-lg min-w-0 break-all">
  <template v-for="(segment, i) in parseLine(line)" :key="i">
    <span
      v-if="segment.type === 'char'"
      class="char-mark"
      :class="charMarkClass(index, segment.charIdx)"
      @click="toggleCharMark(index, segment.charIdx)"
    >{{ segment.char }}</span>
    <span v-else class="punct">{{ segment.char }}</span>
  </template>
</span>
```

注意：行级状态的颜色（`text-red-400`/`text-yellow-600`）仍作用于整行 span，与字级底色高亮并存。为避免冲突，字级标记的颜色 class 使用背景色，行级用文字色，二者叠加时字级背景色优先可见。

- [ ] **Step 4: 添加样式**

在 `<style scoped>` 中（如果 RecitationCard 无 style 块则新增）：

```css
.char-fuzzy {
  background: #fef3c7;
  color: #d97706;
  border-radius: 3px;
  padding: 0 1px;
}
.char-wrong {
  background: #fecaca;
  color: #dc2626;
  border-radius: 3px;
  padding: 0 1px;
}
.punct {
  pointer-events: none;
  user-select: none;
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `npx vitest run tests/unit/RecitationCard.test.ts`
Expected: PASS（原有测试 + 新测试）

- [ ] **Step 6: 运行全部单测**

Run: `npx vitest run`
Expected: 全部 PASS

- [ ] **Step 7: 提交**

```bash
git add src/components/RecitationCard.vue tests/unit/RecitationCard.test.ts
git commit -m "feat: render char-level tap marking in RecitationCard"
```

---

### Task 6: 提交时携带 charMarks 并更新统计

**Files:**
- Modify: `src/components/RecitationCard.vue`
- Modify: `src/views/PoemCardPage.vue`
- Modify: `src/views/RecitationPlayPage.vue`

- [ ] **Step 1: RecitationCard emit 携带 charMarks**

修改 `RecitationCard.vue` 的 `submitResult`：

```typescript
function submitResult(overallStatus: 'mastered' | 'not-mastered') {
  const result: RecitationResult = {
    poemId: props.poem.id,
    overallStatus,
    lines: overallStatus === 'not-mastered'
      ? lineStatuses.value.filter(l => l.status !== 'ok')
      : [],
    authorCorrect: authorCorrect.value,
    dynastyCorrect: dynastyCorrect.value,
    charMarks: { ...learningStore.charMarks },
  }
  emit('submit', result)
  // 提交后重置当前会话的字级标记
  learningStore.initCharMarks()
}
```

- [ ] **Step 2: 修改类型定义**

`RecitationResult` 新增 `charMarks: CharMarkMap`：

```typescript
export interface RecitationResult {
  poemId: string
  overallStatus: 'mastered' | 'not-mastered'
  lines: RecitationLineResult[]
  authorCorrect: boolean | null
  dynastyCorrect: boolean | null
  charMarks: CharMarkMap  // 新增
}
```

- [ ] **Step 3: PoemCardPage.saveResult 更新统计**

修改 `src/views/PoemCardPage.vue` 的 `saveResult`，在现有逻辑后追加：

```typescript
function saveResult(result: RecitationResult) {
  // ...existing logic...

  // 字级标记统计
  if (result.charMarks && Object.keys(result.charMarks).length > 0) {
    const poem = poemStore.getPoemById(result.poemId)
    if (poem) {
      learningStore.recordReciteWithCharMarks(result.poemId, result.overallStatus === 'mastered', poem.text, result.charMarks)
    }
  }
}
```

注意：现有 `saveResult` 用 `learningStore.recordAnswer` 逐行记录错句，没有调用 `recordRecite`。字级统计应作为独立的 `recordReciteWithCharMarks` 调用（它会触发 `recordRecite` 记录一次背诵，与现有逐行 recordAnswer 语义有重叠但数据不冲突）。

- [ ] **Step 4: RecitationPlayPage.onSubmit 更新统计**

修改 `src/views/RecitationPlayPage.vue` 的 `onSubmit`：

```typescript
function onSubmit(result: RecitationResult) {
  quizStore.submitRecitationResult(result)
  if (result.charMarks && Object.keys(result.charMarks).length > 0) {
    const poem = poemStore.getPoemById(result.poemId)
    if (poem) {
      learningStore.recordReciteWithCharMarks(result.poemId, result.overallStatus === 'mastered', poem.text, result.charMarks)
    }
  }
  if (quizStore.isFinished) {
    router.push({ name: 'recitation-result' })
  }
}
```

需要引入 `useLearningStore`。

- [ ] **Step 5: 更新测试**

`RecitationCard.test.ts` 中所有断言 `result` 的测试需补 `charMarks` 字段：

- "fully mastered result has correct structure" 的 `toEqual` 需加 `charMarks: {}`
- "完全不会 result" 断言不变（只检查部分字段）

新增测试：点击某个字后提交，result 携带 charMarks。

在 store mock 中，`charMarks` 需要是可变的（用 `vi.hoisted` 提升的对象），因为组件从 `learningStore.charMarks` 读取。Task 5 已用 `vi.hoisted` 方案定义 `charMarksMock`/`toggleCharMarkMock`/`initCharMarksMock`，Task 6 沿用同样的 mock 结构。

在 Task 6 的测试中，模拟点击字后提交：

```typescript
it('submit result includes current charMarks snapshot', async () => {
  charMarksMock['0-2'] = 'wrong'
  const wrapper = mountCard()
  const masteredBtn = getMasteredButton(wrapper)
  await masteredBtn.trigger('click')
  const result = wrapper.emitted('submit')![0][0] as any
  expect(result.charMarks).toEqual({ '0-2': 'wrong' })
  // 提交后重置会话标记
  expect(initCharMarksMock).toHaveBeenCalled()
})
```

- [ ] **Step 6: 运行测试**

Run: `npx vitest run`
Expected: 全部 PASS

- [ ] **Step 7: 提交**

```bash
git add src/types/index.ts src/components/RecitationCard.vue src/views/PoemCardPage.vue src/views/RecitationPlayPage.vue tests/unit/RecitationCard.test.ts
git commit -m "feat: carry charMarks through submission and update stats"
```

---

### Task 7: E2E 测试 + 手动验证

**Files:**
- Create: `tests/e2e/char-marking.spec.ts`

- [ ] **Step 1: 写 E2E 测试**

创建 `tests/e2e/char-marking.spec.ts`：

```typescript
import { test, expect } from '@playwright/test'

test('char-level marking in recitation card', async ({ page }) => {
  // 进入家长抽查 → 全部 → 点击第一张卡片进入背诵
  await page.goto('/')
  await page.getByRole('button', { name: '家长抽查' }).click()
  await page.getByRole('button', { name: '全部' }).click()
  await page.locator('.poem-card').first().click()

  // 背诵模式，点击第一个汉字
  const charSpans = page.locator('.char-mark')
  await expect(charSpans).toHaveCount(5)  // 五言诗第一行
  await charSpans.nth(0).click()
  await expect(charSpans.nth(0)).toHaveClass(/char-fuzzy/)

  // 再点击 → wrong
  await charSpans.nth(0).click()
  await expect(charSpans.nth(0)).toHaveClass(/char-wrong/)

  // 再点击 → 取消
  await charSpans.nth(0).click()
  await expect(charSpans.nth(0)).not.toHaveClass(/char-fuzzy|char-wrong/)
})
```

（E2E 可能需要根据实际选择器调整，`.poem-card` 类、进入路径等需对照现有 e2e 测试确认。先运行现有 `tests/e2e/recitation-flow.spec.ts` 了解进入背诵的路径。）

- [ ] **Step 2: 运行 E2E 测试**

先确认现有 e2e 测试可跑：

Run: `cd /root/古诗抽查/.codebuddy/worktrees/char-marking && npx playwright test tests/e2e/recitation-flow.spec.ts`
Expected: PASS（可能需要先 build + preview）

注意：`playwright.config.ts` 的 webServer 用 `npm run preview`（4173 端口）。如果端口被占用或复用旧构建，按项目 memory 的提示：先杀掉 4173 端口旧 preview 进程再跑。

- [ ] **Step 3: 运行新建的 char-marking e2e**

Run: `npx playwright test tests/e2e/char-marking.spec.ts`
Expected: PASS

若选择器不匹配，修正测试直到通过。

- [ ] **Step 4: 手动验证 + 截图**

在 worktree 启动 dev server（新端口）：

```bash
cd /root/古诗抽查/.codebuddy/worktrees/char-marking
npm run dev -- --port 5180
```

浏览器访问 `http://localhost:5180`，进入家长抽查 → 点击卡片进入背诵模式：
1. 点击汉字 → 变黄（fuzzy）
2. 再点 → 变红（wrong）
3. 再点 → 取消
4. 标记后提交「下一首」，刷新页面确认标记统计已持久化

- [ ] **Step 5: 提交**

```bash
git add tests/e2e/char-marking.spec.ts
git commit -m "test: add e2e coverage for char-level marking"
```

---

### Task 8: 回归验证

- [ ] **Step 1: 全量单测**

Run: `npx vitest run`
Expected: 全部 PASS

- [ ] **Step 2: 类型检查**

Run: `npx vue-tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 4: 全量 E2E**

Run: `npx playwright test`
Expected: 全部 PASS

- [ ] **Step 5: 完成**

若全部通过，实现完成。可将 `worktree-char-marking` 分支推送到远端并创建 PR/合并。
