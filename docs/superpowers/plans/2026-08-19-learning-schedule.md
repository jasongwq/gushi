# 学习计划排程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为复习计划表增加学习计划排程：未学的诗按节奏（每天1-5首 / 每2/3/5天1首）从今天开始排入未来日期，持久化到 localStorage，区分待学/已学/未学，支持重排。

**Architecture:** 复用纯函数+store+页面模式。新增 `src/utils/schedule.ts` 纯函数 `buildSchedule`（排程计算）和 `PACE_OPTIONS`（节奏档位）；`UserData` 新增 `schedule` 字段（诗→日期映射）；learning store 加 `getSchedule/setSchedule/clearSchedule/rebuildSchedule` 方法；`storage.ts` 迁移兼容旧数据；`ReviewPlanPage.vue` 加节奏选择器+重排按钮+待学/已学/未学分组。`reviewPlan.ts` 的 `new` 原因改为按排程到当天计算。

**Tech Stack:** Vue 3 + Pinia + TypeScript + Tailwind CSS + Vitest + Playwright

**Prerequisite:** 在 worktree `.codebuddy/worktrees/review-plan` 中开发。

---

### Task 1: 数据模型 — schedule 字段

**Files:**
- Modify: `src/types/index.ts:65-71`
- Modify: `src/utils/storage.ts:5-13,21-35,76-85`
- Test: `tests/unit/storage.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/unit/storage.test.ts` 末尾追加：

```typescript
describe('schedule migration', () => {
  it('defaults schedule to empty object when absent', () => {
    localStorage.clear()
    const oldData = {
      records: [],
      quizResults: [],
      reciteRecords: [],
      wrongBook: [],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
    }
    localStorage.setItem('poem-quiz-data', JSON.stringify(oldData))
    const data = loadData()
    expect(data.schedule).toEqual({})
  })

  it('preserves existing schedule on load', () => {
    localStorage.clear()
    const data = {
      records: [],
      quizResults: [],
      reciteRecords: [],
      wrongBook: [],
      schedule: { p001: '2026-08-20' },
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
    }
    localStorage.setItem('poem-quiz-data', JSON.stringify(data))
    expect(loadData().schedule).toEqual({ p001: '2026-08-20' })
  })
})
```

先确认 storage.test.ts 的 import。

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run tests/unit/storage.test.ts 2>&1 | tail -8
```

Expected: FAIL — `data.schedule` is undefined

- [ ] **Step 3: 修改 `src/types/index.ts`**

在 `UserData` 接口加字段：

```typescript
export interface UserData {
  records: LearningRecord[]
  quizResults: QuizResult[]
  reciteRecords: ReciteRecord[]  // 新增
  wrongBook: WrongEntry[]
  schedule: Record<string, string>  // 学习排程：诗→计划学习日期（YYYY-MM-DD）
  settings: UserSettings
}
```

- [ ] **Step 4: 修改 `src/utils/storage.ts`**

`getDefaultData` 加 `schedule: {}`：

```typescript
function getDefaultData(): UserData {
  return {
    records: [],
    quizResults: [],
    reciteRecords: [],
    wrongBook: [],
    schedule: {},
    settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] },
  }
}
```

`loadData` 的 `data` 对象加 `schedule`：

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
      schedule: parsed.schedule ?? defaults.schedule,
      settings: { ...defaults.settings, ...parsed.settings },
    }
```

`importData` 的 `data` 对象加 `schedule`：

```typescript
    const data: UserData = {
      records: parsed.records
        .map((r: any) => ({ ...defaultRecord, ...r }))
        .filter((r: any) => r.poemId),
      quizResults: parsed.quizResults ?? defaults.quizResults,
      reciteRecords: parsed.reciteRecords ?? defaults.reciteRecords,
      wrongBook: (parsed.wrongBook ?? []).map((w: any) => ({ ...defaultWrongEntry, ...w })),
      schedule: parsed.schedule ?? defaults.schedule,
      settings: { ...defaults.settings, ...parsed.settings },
    }
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run tests/unit/storage.test.ts 2>&1 | tail -8
```

Expected: PASS

- [ ] **Step 6: 类型检查**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vue-tsc --noEmit 2>&1 | head -10
```

Expected: 无错误（learning store 的 clearAllData 可能需补 schedule，见 Task 2）

- [ ] **Step 7: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add src/types/index.ts src/utils/storage.ts tests/unit/storage.test.ts && git commit -m "feat: add schedule field to UserData with storage migration"
```

---

### Task 2: 排程纯函数 — schedule.ts

**Files:**
- Create: `src/utils/schedule.ts`
- Test: `tests/unit/schedule.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/schedule.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import { buildSchedule, PACE_OPTIONS, type PaceOption } from '@/utils/schedule'
import type { Poem } from '@/types'

const poems: Poem[] = [
  { id: 'p001', title: 'A1', author: '', dynasty: '唐', grade: '一年级', text: ['a'], textType: '五言', yiwen: '' },
  { id: 'p002', title: 'A2', author: '', dynasty: '唐', grade: '一年级', text: ['b'], textType: '五言', yiwen: '' },
  { id: 'p003', title: 'B1', author: '', dynasty: '唐', grade: '二年级', text: ['c'], textType: '五言', yiwen: '' },
  { id: 'p004', title: 'B2', author: '', dynasty: '唐', grade: '二年级', text: ['d'], textType: '五言', yiwen: '' },
  { id: 'p005', title: 'C1', author: '', dynasty: '唐', grade: '三年级', text: ['e'], textType: '五言', yiwen: '' },
]

const TODAY = '2026-08-19'

describe('buildSchedule', () => {
  it('schedules perDay count poems each day starting today', () => {
    const pace: PaceOption = { type: 'perDay', count: 2 }
    const result = buildSchedule(poems, pace, TODAY)
    expect(result['p001']).toBe('2026-08-19')
    expect(result['p002']).toBe('2026-08-19')
    expect(result['p003']).toBe('2026-08-20')
    expect(result['p004']).toBe('2026-08-20')
    expect(result['p005']).toBe('2026-08-21')
  })

  it('schedules perDays one poem every N days', () => {
    const pace: PaceOption = { type: 'perDays', days: 3 }
    const result = buildSchedule(poems, pace, TODAY)
    expect(result['p001']).toBe('2026-08-19')
    expect(result['p002']).toBe('2026-08-22')
    expect(result['p003']).toBe('2026-08-25')
    expect(result['p004']).toBe('2026-08-28')
    expect(result['p005']).toBe('2026-08-31')
  })

  it('returns empty object for empty poems', () => {
    const result = buildSchedule([], { type: 'perDay', count: 3 }, TODAY)
    expect(result).toEqual({})
  })

  it('preserves input order (grades low to high)', () => {
    // 传入顺序即年级低→高；验证输出按此顺序分配日期
    const result = buildSchedule(poems, { type: 'perDay', count: 3 }, TODAY)
    expect(result['p001']).toBe('2026-08-19')
    expect(result['p003']).toBe('2026-08-19')
    expect(result['p005']).toBe('2026-08-19')
  })
})

describe('PACE_OPTIONS', () => {
  it('has 8 options covering perDay 1-5 and perDays 2/3/5', () => {
    expect(PACE_OPTIONS).toHaveLength(8)
    expect(PACE_OPTIONS.map(o => o.value)).toEqual(['1', '2', '3', '4', '5', 'every2', 'every3', 'every5'])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run tests/unit/schedule.test.ts 2>&1 | tail -8
```

Expected: FAIL — module not found

- [ ] **Step 3: 实现 `src/utils/schedule.ts`**

```typescript
import type { Poem } from '@/types'
import { addDays } from '@/utils/ebbinghaus'

export type PaceOption =
  | { type: 'perDay'; count: number }      // 每天 count 首，count ∈ 1..5
  | { type: 'perDays'; days: number }       // 每 days 天 1 首，days ∈ 2/3/5

export const PACE_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '每天 1 首' },
  { value: '2', label: '每天 2 首' },
  { value: '3', label: '每天 3 首' },
  { value: '4', label: '每天 4 首' },
  { value: '5', label: '每天 5 首' },
  { value: 'every2', label: '每 2 天 1 首' },
  { value: 'every3', label: '每 3 天 1 首' },
  { value: 'every5', label: '每 5 天 1 首' },
]

// 把节奏档位 value 解析为 PaceOption
export function parsePace(value: string): PaceOption {
  if (value === 'every2') return { type: 'perDays', days: 2 }
  if (value === 'every3') return { type: 'perDays', days: 3 }
  if (value === 'every5') return { type: 'perDays', days: 5 }
  const count = parseInt(value, 10)
  if (count >= 1 && count <= 5) return { type: 'perDay', count }
  return { type: 'perDay', count: 3 } // 默认每天 3 首
}

/**
 * 把未学的诗按节奏排到日期映射 { poemId: 'YYYY-MM-DD' }。
 * 传入顺序决定排程顺序（调用方需按年级低→高排序）。
 * perDay: 每天 count 首，连续排
 * perDays: 每 days 天 1 首
 */
export function buildSchedule(
  unlearnedPoems: Poem[],
  pace: PaceOption,
  today: string,
): Record<string, string> {
  const result: Record<string, string> = {}
  if (pace.type === 'perDay') {
    for (let i = 0; i < unlearnedPoems.length; i++) {
      const dayIndex = Math.floor(i / pace.count)
      result[unlearnedPoems[i].id] = addDays(today, dayIndex)
    }
  } else {
    for (let i = 0; i < unlearnedPoems.length; i++) {
      result[unlearnedPoems[i].id] = addDays(today, i * pace.days)
    }
  }
  return result
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run tests/unit/schedule.test.ts 2>&1 | tail -8
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add src/utils/schedule.ts tests/unit/schedule.test.ts && git commit -m "feat: add schedule pure functions with pace options"
```

---

### Task 3: store 方法 — schedule 管理

**Files:**
- Modify: `src/stores/learning.ts`

- [ ] **Step 1: 加 store 方法**

在 `learning.ts` 的 `clearAllData` 上方加：

```typescript
  function getSchedule(): Record<string, string> {
    return data.value.schedule
  }

  function setSchedule(schedule: Record<string, string>) {
    data.value.schedule = schedule
    persist()
  }

  function clearSchedule() {
    data.value.schedule = {}
    persist()
  }

  function rebuildSchedule(unlearnedPoems: Poem[], pace: PaceOption, today: string) {
    data.value.schedule = buildSchedule(unlearnedPoems, pace, today)
    persist()
  }
```

修改 import（顶部加 schedule 相关）：

```typescript
import { buildSchedule, type PaceOption } from '@/utils/schedule'
import type { Poem } from '@/types'
```

修改 `clearAllData`（加 `schedule: {}`）：

```typescript
  function clearAllData() {
    data.value = { records: [], quizResults: [], reciteRecords: [], wrongBook: [], schedule: {}, settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] } }
    persist()
  }
```

修改 return（加 4 个方法）：

```typescript
  return {
    data, records, wrongBook, settings, reviewDueCount, unproficientCount, wrongCount,
    getRecord, getOrCreateRecord, getMasteryLevel, recordAnswer, recordDetail, recordRecite, toggleUnproficient, removeWrongEntry,
    updateSettings, importUserData, exportUserData, clearAllData, persist,
    charMarks, initCharMarks, toggleCharMark, recordReciteWithCharMarks, getCharMarkStats,
    getSchedule, setSchedule, clearSchedule, rebuildSchedule,
  }
```

注意：`import type { Poem }` 若 `Poem` 已在现有 import 中则合并，避免重复 import。

- [ ] **Step 2: 类型检查**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vue-tsc --noEmit 2>&1 | head -10
```

Expected: 无错误

- [ ] **Step 3: 跑全量单测确认无回归**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run 2>&1 | tail -5
```

Expected: 全部通过

- [ ] **Step 4: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add src/stores/learning.ts && git commit -m "feat: add schedule get/set/clear/rebuild methods to learning store"
```

---

### Task 4: reviewPlan 的 new 原因按排程计算

**Files:**
- Modify: `src/utils/reviewPlan.ts`
- Modify: `tests/unit/reviewPlan.test.ts`

现状：`buildReviewPlan` 里 `new` 原因 = 无学习记录的诗归入今天。改为：**排程到当天的未学诗**。

- [ ] **Step 1: 写失败测试**

在 `tests/unit/reviewPlan.test.ts` 加一个用例：

```typescript
  it('marks new poems only on their scheduled day, not all on today', () => {
    // p001、p002 排程到今天，p003、p004 排程到 2026-08-20
    const schedule = { p001: TODAY, p002: TODAY, p003: '2026-08-20', p004: '2026-08-20' }
    const plan = buildReviewPlan([], [], poems, 30, TODAY, schedule)
    const today = plan[0]
    const todayIds = today.items.map(i => i.poemId)
    expect(todayIds).toContain('p001')
    expect(todayIds).toContain('p002')
    expect(todayIds).not.toContain('p003')
    expect(todayIds).not.toContain('p004')
    const day20 = plan.find(d => d.date === '2026-08-20')!
    expect(day20.items.map(i => i.poemId)).toEqual(expect.arrayContaining(['p003', 'p004']))
  })

  it('does not add new reason for poems already learned', () => {
    // p001 已学（有记录），p002 未学且排程今天
    const records = [makeRecord('p001', '2026-08-25')]
    const schedule = { p001: TODAY, p002: TODAY }
    const plan = buildReviewPlan(records, [], poems, 30, TODAY, schedule)
    const today = plan[0]
    // p001 已有记录 → 不标 new
    expect(today.items.find(i => i.poemId === 'p001')?.reasons).not.toContain('new')
    // p002 未学且排程今天 → new
    expect(today.items.find(i => i.poemId === 'p002')?.reasons).toContain('new')
  })
```

需要更新 `buildReviewPlan` 签名加第 6 参 `schedule?: Record<string, string>`。

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run tests/unit/reviewPlan.test.ts 2>&1 | tail -8
```

Expected: 新增用例失败（TS 签名不匹配或断言失败）

- [ ] **Step 3: 修改 `src/utils/reviewPlan.ts`**

签名加 `schedule?: Record<string, string>`：

```typescript
export function buildReviewPlan(
  records: LearningRecord[],
  wrongBook: WrongEntry[],
  poems: Poem[],
  days: number = 30,
  today?: string,
  schedule?: Record<string, string>,
): ReviewPlanDay[] {
```

修改 `new` 原因判断逻辑（原：无学习记录归今天）：

```typescript
      // new：排程到当天的未学诗
      if (!learnedIds.has(poem.id)) {
        const scheduledDate = schedule?.[poem.id]
        if (scheduledDate && scheduledDate === date) {
          reasons.push('new')
        }
      }
```

同时保留 overdue 逻辑（schedule 日期已过的诗不重复——排程日期 < today 的诗不显示，因为排程重建后日期是未来的；若排程日期在过去（如 3 天前排了但没学），按"逾期"处理归今天）。

修正 overdue 逻辑：

```typescript
      // new：排程到当天的未学诗；排程日期已过（逾期未学）落回今天
      if (!learnedIds.has(poem.id)) {
        const scheduledDate = schedule?.[poem.id]
        if (scheduledDate) {
          if (scheduledDate === date) {
            reasons.push('new')
          } else if (scheduledDate < baseDate && date === baseDate) {
            reasons.push('new')
          }
        }
      }
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run tests/unit/reviewPlan.test.ts 2>&1 | tail -8
```

Expected: PASS（注意原有"无 schedule 时未学归今天"的用例可能需要更新——见 Step 5）

- [ ] **Step 5: 更新旧用例**

`tests/unit/reviewPlan.test.ts` 中原「puts unlearned poems on today as new」用例，现在无 schedule 时未学诗不再归今天。更新为：

```typescript
  it('does not schedule unlearned poems when no schedule is provided', () => {
    const plan = buildReviewPlan([], [], poems, 30, TODAY)
    const today = plan[0]
    // 无排程时未学诗不出现（由计划页自动生成排程）
    expect(today.items.some(i => i.poemId === 'p004')).toBe(false)
  })
```

同时现有依赖 `new` 的旧用例（如「puts unlearned poems on today as new」）若存在则删除/替换。

- [ ] **Step 6: 跑全量单测**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run 2>&1 | tail -5
```

Expected: 全部通过

- [ ] **Step 7: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add src/utils/reviewPlan.ts tests/unit/reviewPlan.test.ts && git commit -m "feat: schedule-based new reason in review plan"
```

---

### Task 5: ReviewPlanPage — 节奏选择器 + 重排 + 分组

**Files:**
- Modify: `src/views/ReviewPlanPage.vue`

- [ ] **Step 1: 更新脚本逻辑**

替换 `<script setup>` 为（保留现有基础逻辑，新增排程）：

```typescript
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import { buildReviewPlan, type ReviewReason } from '@/utils/reviewPlan'
import { PACE_OPTIONS, parsePace, type PaceOption } from '@/utils/schedule'
import type { Poem } from '@/types'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

const paceValue = ref('3')
const showCalcTip = ref(false)
const isRebuilding = ref(false)

// 未学诗（无学习记录），按年级低→高、同年级按诗库顺序
const unlearnedPoems = computed(() => {
  const learnedIds = new Set(learningStore.records.map(r => r.poemId))
  const order: Record<string, number> = {
    '一年级': 1, '二年级': 2, '三年级': 3,
    '四年级': 4, '五年级': 5, '六年级': 6, '配读篇目': 7,
  }
  return poemStore.enabledPoems
    .filter(p => !learnedIds.has(p.id))
    .sort((a, b) => (order[a.grade] ?? 99) - (order[b.grade] ?? 99) || a.id.localeCompare(b.id))
})

const schedule = computed(() => learningStore.getSchedule())

const plan = computed(() => {
  if (poemStore.poems.length === 0) return []
  return buildReviewPlan(
    learningStore.records,
    learningStore.wrongBook,
    poemStore.enabledPoems,
    30,
    undefined,
    schedule.value,
  )
})

const activeDays = computed(() => plan.value.filter(d => d.items.length > 0))

// 已学标记：schedule 里有该诗且有学习记录
function isLearned(poemId: string): boolean {
  return !!learningStore.getRecord(poemId)
}

// 展开状态：今天默认展开
const expandedDates = ref<Set<string>>(new Set())

function toggleDay(date: string) {
  const next = new Set(expandedDates.value)
  if (next.has(date)) next.delete(date)
  else next.add(date)
  expandedDates.value = next
}

function isExpanded(date: string): boolean {
  return expandedDates.value.has(date)
}

function initExpand() {
  const first = activeDays.value[0]
  if (first) expandedDates.value = new Set([first.date])
}

function rebuild() {
  if (unlearnedPoems.value.length === 0) return
  const pace = parsePace(paceValue.value)
  learningStore.rebuildSchedule(unlearnedPoems.value, pace, new Date().toISOString().slice(0, 10))
  initExpand()
}

onMounted(async () => {
  await poemStore.fetchPoems()
  // 无排程时自动生成（默认每天 3 首）
  if (Object.keys(learningStore.getSchedule()).length === 0) {
    rebuild()
  }
  initExpand()
})

// 底部未学区块分组
const notScheduled = computed(() =>
  unlearnedPoems.value.filter(p => !(p.id in schedule.value))
)
const scheduledBeyond30 = computed(() =>
  unlearnedPoems.value.filter(p => {
    const date = schedule.value[p.id]
    if (!date) return false
    const todayStr = new Date().toISOString().slice(0, 10)
    const diff = (new Date(date + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 30
  })
)

const showNotLearned = ref(false)

const reasonLabels: Record<ReviewReason, string> = {
  due: '到期复习',
  unproficient: '不熟练',
  wrongBook: '错题本',
  new: '新增学习',
}

const reasonColors: Record<ReviewReason, string> = {
  due: 'bg-indigo-100 text-indigo-600',
  unproficient: 'bg-orange-100 text-orange-600',
  wrongBook: 'bg-red-100 text-red-600',
  new: 'bg-green-100 text-green-600',
}

function formatDay(date: string, index: number): string {
  if (index === 0) return '今天'
  const d = new Date(date + 'T00:00:00')
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return `${weekday} ${date.slice(5)}`
}

function goToDetail(poemId: string) {
  router.push({ name: 'poem-detail', params: { id: poemId } })
}
```

- [ ] **Step 2: 更新模板**

在标题下方、计算逻辑提示上方加节奏选择器和重排按钮：

```html
    <div class="flex items-center gap-2 mb-3">
      <select v-model="paceValue" class="flex-1 p-2 border border-gray-200 rounded-lg text-sm bg-white focus:border-indigo-300 focus:outline-none">
        <option v-for="opt in PACE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <button
        class="px-3 py-2 bg-indigo-500 text-white rounded-lg text-sm cursor-pointer hover:bg-indigo-600 transition"
        @click="rebuild"
      >重排</button>
    </div>
    <p class="text-xs text-gray-400 text-center mb-3">切换节奏后点「重排」生效</p>
```

在诗行渲染处加"已学"标记（在原因标签后）：

```html
          <div
            v-for="item in day.items"
            :key="item.poemId"
            class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
            @click.stop="goToDetail(item.poemId)"
          >
            <span class="flex-1 text-sm">{{ poemStore.getPoemById(item.poemId)?.title ?? item.poemId }}</span>
            <span v-if="poemStore.getPoemById(item.poemId)?.author" class="text-xs text-gray-400">{{ poemStore.getPoemById(item.poemId)?.author }}</span>
            <span
              v-for="reason in item.reasons"
              :key="reason"
              :class="['text-xs px-1.5 py-0.5 rounded', reasonColors[reason]]"
            >{{ reasonLabels[reason] }}</span>
            <span v-if="isLearned(item.poemId)" class="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">已学</span>
          </div>
```

在"返回首页"链接前加底部未学区块：

```html
    <div class="mt-6 mb-3">
      <div
        class="p-3 bg-white border border-gray-200 rounded-lg shadow-sm cursor-pointer"
        @click="showNotLearned = !showNotLearned"
      >
        <div class="flex items-center justify-between">
          <div class="font-medium">未学（{{ notScheduled.length + scheduledBeyond30.length }} 首）</div>
          <div class="text-xs text-gray-400">{{ showNotLearned ? '▴' : '▾' }}</div>
        </div>
        <div v-if="showNotLearned" class="mt-2 space-y-1">
          <div v-if="scheduledBeyond30.length > 0" class="mt-1">
            <div class="text-xs text-gray-400 mb-1">已排期（30 天后）</div>
            <div
              v-for="p in scheduledBeyond30"
              :key="p.id"
              class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
              @click.stop="goToDetail(p.id)"
            >
              <span class="flex-1 text-sm">{{ p.title }}</span>
              <span v-if="p.author" class="text-xs text-gray-400">{{ p.author }}</span>
            </div>
          </div>
          <div v-if="notScheduled.length > 0" class="mt-1">
            <div class="text-xs text-gray-400 mb-1">未排期</div>
            <div
              v-for="p in notScheduled"
              :key="p.id"
              class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
              @click.stop="goToDetail(p.id)"
            >
              <span class="flex-1 text-sm">{{ p.title }}</span>
              <span v-if="p.author" class="text-xs text-gray-400">{{ p.author }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
```

- [ ] **Step 3: 类型检查 + 构建**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vue-tsc --noEmit 2>&1 | head -10
```

Expected: 无错误

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vite build 2>&1 | tail -3
```

Expected: 构建成功

- [ ] **Step 4: 更新组件测试**

`tests/component/ReviewPlanPage.test.ts` 需适配排程逻辑。整体替换测试文件为：

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useLearningStore } from '@/stores/learning'
import ReviewPlanPage from '@/views/ReviewPlanPage.vue'
import type { Poem, LearningRecord } from '@/types'

const mockPoems: Poem[] = [
  { id: 'p001', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级', text: ['床前明月光'], textType: '五言', yiwen: '' },
  { id: 'p002', title: '咏鹅', author: '骆宾王', dynasty: '唐', grade: '一年级', text: ['鹅鹅鹅'], textType: '其他', yiwen: '' },
  { id: 'p003', title: '春晓', author: '孟浩然', dynasty: '唐', grade: '二年级', text: ['春眠不觉晓'], textType: '五言', yiwen: '' },
]

// 可变的 poem store mock 状态
let poems = [...mockPoems]
let loading = false

vi.mock('@/stores/poem', () => ({
  usePoemStore: () => ({
    poems,
    loading,
    enabledPoems: poems,
    fetchPoems: vi.fn(async () => {}),
    getPoemById: (id: string) => poems.find(p => p.id === id),
  }),
}))

const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

let pinia: ReturnType<typeof createPinia>

beforeEach(() => {
  localStorage.clear()
  poems = [...mockPoems]
  loading = false
  pushMock.mockClear()
  pinia = createPinia()
  setActivePinia(pinia)
})

function mountPage() {
  return mount(ReviewPlanPage, {
    global: {
      plugins: [pinia],
      stubs: {
        'router-link': { template: '<a><slot /></a>' },
      },
    },
  })
}

function makeRecord(poemId: string, nextReviewDate: string, overrides: Partial<LearningRecord> = {}): LearningRecord {
  return {
    poemId, lastReviewDate: '2026-08-01', reviewCount: 1,
    nextReviewDate, correctness: [1], reciteCorrectness: [],
    charMarkStats: [], masteryLevel: '学',
    unproficient: false, unproficientCorrectStreak: 0,
    ...overrides,
  }
}

describe('ReviewPlanPage', () => {
  it('renders title and subtitle', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('复习计划')
    expect(wrapper.text()).toContain('未来 30 天复习安排')
  })

  it('shows loading state when poems are loading', async () => {
    loading = true
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('加载中…')
    expect(wrapper.text()).not.toContain('暂无复习安排')
  })

  it('shows empty state when no poems data', async () => {
    poems = []
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('暂无复习安排')
  })

  it('auto-generates schedule on first visit with default pace', async () => {
    const store = useLearningStore()
    const wrapper = mountPage()
    await flushPromises()
    // 首次进入无排程 → 自动生成，今天应有新增学习的诗
    expect(store.getSchedule()).not.toEqual({})
    expect(wrapper.text()).toContain('新增学习')
  })

  it('shows pace selector and rebuild button', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.text()).toContain('重排')
  })

  it('rebuild reschedules unlearned poems from today', async () => {
    const store = useLearningStore()
    // 预先设置一个"错误"的排程
    store.setSchedule({ p001: '2030-01-01' })
    const wrapper = mountPage()
    await flushPromises()
    // 点重排
    await wrapper.findAll('button').find(b => b.text().includes('重排'))!.trigger('click')
    await flushPromises()
    // 排程被重建，p001 应在今天（每天3首，第1首）
    const today = new Date().toISOString().slice(0, 10)
    expect(store.getSchedule()['p001']).toBe(today)
  })

  it('shows learned marker for scheduled poems with records', async () => {
    const store = useLearningStore()
    store.data.records = [makeRecord('p001', '2026-08-20')]
    store.setSchedule({ p001: new Date().toISOString().slice(0, 10) })
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('已学')
  })

  it('shows today section expanded by default', async () => {
    const store = useLearningStore()
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('今天')
    expect(wrapper.text()).toContain('新增学习')
  })

  it('toggles calc tip on clicking the help icon', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).not.toContain('复习计划按以下规则计算')
    await wrapper.find('h2 span').trigger('click')
    expect(wrapper.text()).toContain('复习计划按以下规则计算')
    await wrapper.find('h2 span').trigger('click')
    expect(wrapper.text()).not.toContain('复习计划按以下规则计算')
  })

  it('shows not-learned section with unlearned poems', async () => {
    const wrapper = mountPage()
    await flushPromises()
    // 默认每天3首，3 首诗全排进今天，无未排期的
    // 切换为每天1首并重排后，今天1首，其余进入未来/未排
    const select = wrapper.find('select')
    await select.setValue('1')
    await wrapper.findAll('button').find(b => b.text().includes('重排'))!.trigger('click')
    await flushPromises()
    // 未学区块存在
    expect(wrapper.text()).toContain('未学')
  })

  it('navigates to poem detail when clicking a poem', async () => {
    const store = useLearningStore()
    store.setSchedule({ p001: new Date().toISOString().slice(0, 10) })
    const wrapper = mountPage()
    await flushPromises()
    const poemItem = wrapper.find('.flex.items-center.gap-2')
    expect(poemItem.exists()).toBe(true)
    await poemItem.trigger('click')
    expect(pushMock).toHaveBeenCalledWith({ name: 'poem-detail', params: { id: 'p001' } })
  })
})
```

注意：原「shows multiple reason tags」「expands future day」等依赖无排程时 unlearned 归今天的用例，在排程逻辑下不再成立，已移除/替换。

- [ ] **Step 5: 全量单测**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run 2>&1 | tail -5
```

Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add src/views/ReviewPlanPage.vue tests/component/ReviewPlanPage.test.ts && git commit -m "feat: add pace selector, rebuild button, and learned/not-learned grouping to review plan page"
```

---

### Task 6: e2e 更新

**Files:**
- Modify: `tests/e2e/review-plan.spec.ts`

- [ ] **Step 1: 更新 e2e**

现有 e2e「review plan page shows today section with reason tags」依赖"未学归今天"。排程后未学诗只出现在排程日期。需要更新：

```typescript
test('review plan page shows today section with schedule', async ({ page }) => {
  await page.goto('/#/review-plan')
  await expect(page.locator('h2')).toContainText('复习计划', { timeout: 10000 })
  await expect(page.locator('text=今天')).toBeVisible({ timeout: 10000 })
  // 首次进入自动生成排程 → 今天有"新增学习"的诗（每天3首）
  await expect(page.locator('text=新增学习').first()).toBeVisible({ timeout: 10000 })
})

test('review plan page: pace selector and rebuild', async ({ page }) => {
  await page.goto('/#/review-plan')
  await expect(page.locator('select')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('button:has-text("重排")')).toBeVisible()

  // 切换节奏到"每天 1 首"并重排
  await page.selectOption('select', '1')
  await page.click('button:has-text("重排")')

  // 今天应只剩 1 首新增学习
  await expect(page.locator('text=今天')).toBeVisible({ timeout: 5000 })
})

test('review plan page: not-learned section shows scheduled beyond 30 days', async ({ page }) => {
  await page.goto('/#/review-plan')
  await expect(page.locator('text=未学').first()).toBeVisible({ timeout: 10000 })
  // 展开未学区块
  const notLearnedHeader = page.locator('div:has-text("未学")').first()
  await notLearnedHeader.click()
  await expect(page.locator('text=未排期').first()).toBeVisible()
})
```

注意 e2e 中 localStorage 跨测试共享（同一 browser context 内）——若前一个测试已生成排程，后续测试的"首次自动生成"不触发。用 `page.evaluate(() => localStorage.clear())` 隔离或依赖自动生成逻辑的幂等性。

- [ ] **Step 2: 构建 + 跑 e2e**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vite build 2>&1 | tail -3 && npx playwright test tests/e2e/review-plan.spec.ts 2>&1 | tail -15
```

Expected: 全部通过

- [ ] **Step 3: 全量 e2e**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx playwright test 2>&1 | tail -8
```

Expected: 全部通过（含既有）

- [ ] **Step 4: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add tests/e2e/review-plan.spec.ts && git commit -m "test(e2e): update review plan e2e for schedule pacing and rebuild"
```

---

### Task 7: 最终验证

**Files:** 无新文件

- [ ] **Step 1: 全量单测**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run 2>&1 | tail -5
```

Expected: 全部通过

- [ ] **Step 2: 类型检查**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vue-tsc --noEmit 2>&1
```

Expected: 无错误

- [ ] **Step 3: 覆盖率**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run --coverage 2>&1 | grep -E "All files|ERROR|schedule"
```

Expected: 无 ERROR，schedule.ts 覆盖率高

- [ ] **Step 4: 生产构建 + 全量 e2e**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vite build 2>&1 | tail -3 && npx playwright test 2>&1 | tail -8
```

Expected: 构建成功，全部 e2e 通过

- [ ] **Step 5: Commit（如有未提交）**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add -A && git commit -m "chore: final verification" 2>&1 || echo "nothing to commit"
```
