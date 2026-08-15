# 古诗背诵及遗忘曲线数据功能 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为古诗抽查 PWA 新增背诵自评模块和遗忘曲线可视化功能

**Architecture:** 背诵模块独立于答题流程，通过 RecitePage 卡片流交互。背诵结果调用现有 ebbinghaus.ts 更新遗忘曲线。新增 ReciteRecord 类型与 QuizResult 并行存储。遗忘曲线可视化使用 Chart.js，进度页总览+单首详情页。

**Tech Stack:** Vue 3 + Pinia + Chart.js + TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/index.ts` | Modify | 新增 ReciteRecord，LearningRecord 增加 reciteCorrectness |
| `src/utils/storage.ts` | Modify | 数据迁移：reciteCorrectness、reciteRecords |
| `src/stores/learning.ts` | Modify | 新增 recordRecite 方法，背诵遗忘曲线调度 |
| `src/utils/retention.ts` | Create | 记忆保持率计算工具 |
| `src/views/RecitePage.vue` | Create | 背诵入口+卡片流（自评模式） |
| `src/views/ReciteResultPage.vue` | Create | 背诵结果页 |
| `src/views/PoemDetailPage.vue` | Create | 单首古诗详情+遗忘曲线图 |
| `src/router/index.ts` | Modify | 新增 /recite, /recite/result, /poem/:id 路由 |
| `src/views/HomePage.vue` | Modify | 新增"背诵"入口按钮 |
| `src/views/ProgressPage.vue` | Modify | 新增总览遗忘曲线图，古诗列表可点击 |
| `package.json` | Modify | 新增 chart.js 依赖 |
| `tests/unit/retention.test.ts` | Create | 保持率计算工具测试 |
| `tests/unit/learning-recite.test.ts` | Create | 背诵记录方法测试 |

---

### Task 1: 扩展数据模型 — types + storage 迁移

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/utils/storage.ts`
- Modify: `src/stores/learning.ts`
- Test: `tests/unit/storage.test.ts`

- [ ] **Step 1: 在 types/index.ts 新增 ReciteRecord，LearningRecord 增加 reciteCorrectness**

在 `src/types/index.ts` 中：

```typescript
// 在 QuizResult 接口之后新增：
export interface ReciteRecord {
  poemId: string
  date: string           // YYYY-MM-DD
  correct: boolean       // 自评"会"=true，"不会"=false
}

// 修改 LearningRecord，在 correctness 字段后新增：
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
}

// 修改 UserData，在 quizResults 之后新增：
export interface UserData {
  records: LearningRecord[]
  quizResults: QuizResult[]
  reciteRecords: ReciteRecord[]  // 新增
  wrongBook: WrongEntry[]
  settings: UserSettings
}
```

- [ ] **Step 2: 更新 storage.ts 数据迁移**

在 `src/utils/storage.ts` 中：

修改 `getDefaultData()`:
```typescript
function getDefaultData(): UserData {
  return {
    records: [],
    quizResults: [],
    reciteRecords: [],
    wrongBook: [],
    settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] },
  }
}
```

修改 `loadData()` 中 data 合并部分，增加 reciteRecords 和 records 的 reciteCorrectness 迁移：
```typescript
const data = {
  records: (parsed.records ?? defaults.records).map(r => ({
    ...r,
    reciteCorrectness: r.reciteCorrectness ?? [],
  })),
  quizResults: parsed.quizResults ?? defaults.quizResults,
  reciteRecords: parsed.reciteRecords ?? defaults.reciteRecords,
  wrongBook: parsed.wrongBook ?? defaults.wrongBook,
  settings: { ...defaults.settings, ...parsed.settings },
}
```

- [ ] **Step 3: 更新 learning.ts 的 getOrCreateRecord 和 clearAllData**

在 `src/stores/learning.ts` 中：

修改 `getOrCreateRecord`，新增 reciteCorrectness 初始化：
```typescript
function getOrCreateRecord(poemId: string): LearningRecord {
  let record = getRecord(poemId)
  if (!record) {
    const today = new Date().toISOString().split('T')[0]
    record = {
      poemId, lastReviewDate: today, reviewCount: 0,
      nextReviewDate: today, correctness: [], reciteCorrectness: [],
      masteryLevel: '新', unproficient: false, unproficientCorrectStreak: 0,
    }
    data.value.records.push(record)
  }
  return record
}
```

修改 `clearAllData`，新增 reciteRecords:
```typescript
function clearAllData() {
  data.value = { records: [], quizResults: [], reciteRecords: [], wrongBook: [], settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] } }
  persist()
}
```

- [ ] **Step 4: 运行测试验证**

Run: `npx vitest run tests/unit/storage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/utils/storage.ts src/stores/learning.ts
git commit -m "feat: extend data model with ReciteRecord and reciteCorrectness"
```

---

### Task 2: 新增背诵记录方法 — learning store

**Files:**
- Modify: `src/stores/learning.ts`
- Test: `tests/unit/learning-recite.test.ts`

- [ ] **Step 1: 在 learning.ts 新增 recordRecite 方法**

在 `src/stores/learning.ts` 中，在 `recordAnswer` 方法之后新增：

```typescript
function recordRecite(poemId: string, correct: boolean) {
  const record = getOrCreateRecord(poemId)
  const updated = calculateNextReview(record, correct)
  const afterUnproficient = checkAutoUnmark(updated, correct)
  const today = new Date().toISOString().split('T')[0]
  const idx = data.value.records.findIndex(r => r.poemId === poemId)
  data.value.records[idx] = {
    ...afterUnproficient,
    reciteCorrectness: [...(record.reciteCorrectness ?? []), correct ? 1 : 0],
    lastLearnDate: today,
    lastReviewDate: today,
  }

  data.value.reciteRecords.push({ poemId, date: today, correct })
  persist()
}
```

在 return 语句中新增 `recordRecite`。

- [ ] **Step 2: 编写背诵记录测试**

创建 `tests/unit/learning-recite.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLearningStore } from '@/stores/learning'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('recordRecite', () => {
  it('should create recite record and update reciteCorrectness', () => {
    const store = useLearningStore()
    store.recordRecite('p001', true)
    const record = store.getRecord('p001')
    expect(record).toBeDefined()
    expect(record!.reciteCorrectness).toEqual([1])
    expect(record!.reviewCount).toBe(1)
  })

  it('should append to reciteCorrectness on multiple recites', () => {
    const store = useLearningStore()
    store.recordRecite('p001', true)
    store.recordRecite('p001', false)
    const record = store.getRecord('p001')
    expect(record!.reciteCorrectness).toEqual([1, 0])
  })

  it('should store recite records in data', () => {
    const store = useLearningStore()
    store.recordRecite('p001', true)
    store.recordRecite('p002', false)
    expect(store.data.reciteRecords).toHaveLength(2)
    expect(store.data.reciteRecords[0]).toEqual({ poemId: 'p001', date: expect.any(String), correct: true })
  })

  it('should update forgetting curve on correct recite', () => {
    const store = useLearningStore()
    store.recordRecite('p001', true)
    const record = store.getRecord('p001')!
    expect(record.masteryLevel).toBe('学')
    expect(record.nextReviewDate).not.toBe(record.lastReviewDate)
  })

  it('should handle wrong recite with interval backoff', () => {
    const store = useLearningStore()
    store.recordRecite('p001', true)
    store.recordRecite('p001', true)
    const recordBefore = store.getRecord('p001')!
    store.recordRecite('p001', false)
    const recordAfter = store.getRecord('p001')!
    expect(recordAfter.reciteCorrectness).toEqual([1, 1, 0])
    expect(recordAfter.correctness).toEqual([])
  })

  it('should not mix reciteCorrectness with quiz correctness', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', true)
    store.recordRecite('p001', false)
    const record = store.getRecord('p001')!
    expect(record.correctness).toEqual([1])
    expect(record.reciteCorrectness).toEqual([0])
  })
})
```

- [ ] **Step 3: 运行测试验证**

Run: `npx vitest run tests/unit/learning-recite.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/stores/learning.ts tests/unit/learning-recite.test.ts
git commit -m "feat: add recordRecite method to learning store"
```

---

### Task 3: 记忆保持率计算工具

**Files:**
- Create: `src/utils/retention.ts`
- Test: `tests/unit/retention.test.ts`

- [ ] **Step 1: 创建 retention.ts**

```typescript
import type { LearningRecord } from '@/types'
import { getNextInterval } from '@/utils/ebbinghaus'

/**
 * 计算单首古诗在某天的记忆保持率
 * 基于 Ebbinghaus 模型：R = e^(-t/S)
 * t = 距上次复习天数，S = 当前复习间隔
 */
export function calculateRetention(record: LearningRecord, date: string): number {
  const lastReview = new Date(record.lastReviewDate + 'T00:00:00')
  const targetDate = new Date(date + 'T00:00:00')
  const daysSinceReview = Math.max(0, (targetDate.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24))

  if (daysSinceReview === 0) return 1

  const interval = getNextInterval(record.reviewCount)
  const retention = Math.exp(-daysSinceReview / interval)
  return Math.max(0, Math.min(1, retention))
}

/**
 * 计算所有已学习古诗在某天的平均保持率
 */
export function calculateAverageRetention(records: LearningRecord[], date: string): number {
  const learned = records.filter(r => r.reviewCount > 0)
  if (learned.length === 0) return 0
  const total = learned.reduce((sum, r) => sum + calculateRetention(r, date), 0)
  return total / learned.length
}

/**
 * 分别计算答题和背诵的保持率时间线
 * 答题保持率只考虑有答题记录的，背诵保持率只考虑有背诵记录的
 */
export function getRetentionTimelineSplit(
  records: LearningRecord[],
  days: number = 30
): { date: string; quizRetention: number; reciteRetention: number }[] {
  const result: { date: string; quizRetention: number; reciteRetention: number }[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)

    const quizRecords = records.filter(r => r.reviewCount > 0)
    const reciteRecords = records.filter(r => (r.reciteCorrectness ?? []).length > 0)

    const quizRetention = quizRecords.length > 0
      ? quizRecords.reduce((sum, r) => sum + calculateRetention(r, dateStr), 0) / quizRecords.length
      : 0
    const reciteRetention = reciteRecords.length > 0
      ? reciteRecords.reduce((sum, r) => sum + calculateRetention(r, dateStr), 0) / reciteRecords.length
      : 0

    result.push({ date: dateStr, quizRetention, reciteRetention })
  }
  return result
}

/**
 * 获取单首古诗的复习时间线数据点
 * 返回每次答题/背诵的时间点及保持率
 */
export function getPoemRetentionPoints(
  record: LearningRecord,
  quizResults: { poemId: string; date: string; correct: boolean }[],
  reciteRecords: { poemId: string; date: string; correct: boolean }[]
): { date: string; retention: number; type: 'quiz' | 'recite'; correct: boolean }[] {
  const points: { date: string; retention: number; type: 'quiz' | 'recite'; correct: boolean }[] = []

  // 构建复习事件时间线
  const events: { date: string; type: 'quiz' | 'recite'; correct: boolean }[] = [
    ...quizResults.filter(r => r.poemId === record.poemId).map(r => ({ date: r.date, type: 'quiz' as const, correct: r.correct })),
    ...reciteRecords.filter(r => r.poemId === record.poemId).map(r => ({ date: r.date, type: 'recite' as const, correct: r.correct })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  // 模拟逐事件后的保持率
  let simulatedRecord = { ...record, reviewCount: 0, correctness: [], reciteCorrectness: [] }
  for (const event of events) {
    if (event.type === 'quiz') {
      simulatedRecord = {
        ...simulatedRecord,
        reviewCount: simulatedRecord.reviewCount + 1,
        lastReviewDate: event.date,
        correctness: [...simulatedRecord.correctness, event.correct ? 1 : 0],
      }
    } else {
      simulatedRecord = {
        ...simulatedRecord,
        lastReviewDate: event.date,
        reciteCorrectness: [...simulatedRecord.reciteCorrectness, event.correct ? 1 : 0],
      }
    }
    const retention = calculateRetention(simulatedRecord, event.date)
    points.push({ date: event.date, retention, type: event.type, correct: event.correct })
  }

  return points
}
```

- [ ] **Step 2: 编写保持率计算测试**

创建 `tests/unit/retention.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import { calculateRetention, calculateAverageRetention, getRetentionTimeline, getPoemRetentionPoints } from '@/utils/retention'
import type { LearningRecord } from '@/types'

describe('calculateRetention', () => {
  it('should return 1 on the review day', () => {
    const record: LearningRecord = {
      poemId: 'p001', lastReviewDate: '2026-08-15', reviewCount: 1,
      nextReviewDate: '2026-08-17', correctness: [1], reciteCorrectness: [],
      masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0,
    }
    expect(calculateRetention(record, '2026-08-15')).toBe(1)
  })

  it('should decrease over time', () => {
    const record: LearningRecord = {
      poemId: 'p001', lastReviewDate: '2026-08-15', reviewCount: 1,
      nextReviewDate: '2026-08-17', correctness: [1], reciteCorrectness: [],
      masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0,
    }
    const r1 = calculateRetention(record, '2026-08-16')
    const r2 = calculateRetention(record, '2026-08-17')
    expect(r1).toBeGreaterThan(r2)
    expect(r2).toBeGreaterThan(0)
  })

  it('should return higher retention for higher review count', () => {
    const record1: LearningRecord = {
      poemId: 'p001', lastReviewDate: '2026-08-15', reviewCount: 1,
      nextReviewDate: '2026-08-17', correctness: [1], reciteCorrectness: [],
      masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0,
    }
    const record5: LearningRecord = {
      poemId: 'p001', lastReviewDate: '2026-08-15', reviewCount: 5,
      nextReviewDate: '2026-09-14', correctness: [1, 1, 1, 1, 1], reciteCorrectness: [],
      masteryLevel: '固', unproficient: false, unproficientCorrectStreak: 0,
    }
    const r1 = calculateRetention(record1, '2026-08-16')
    const r5 = calculateRetention(record5, '2026-08-16')
    expect(r5).toBeGreaterThan(r1)
  })
})

describe('calculateAverageRetention', () => {
  it('should return 0 for no learned records', () => {
    expect(calculateAverageRetention([], '2026-08-15')).toBe(0)
  })

  it('should calculate average across learned records', () => {
    const records: LearningRecord[] = [
      { poemId: 'p001', lastReviewDate: '2026-08-15', reviewCount: 1, nextReviewDate: '2026-08-17', correctness: [1], reciteCorrectness: [], masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0 },
      { poemId: 'p002', lastReviewDate: '2026-08-15', reviewCount: 0, nextReviewDate: '2026-08-15', correctness: [], reciteCorrectness: [], masteryLevel: '新', unproficient: false, unproficientCorrectStreak: 0 },
    ]
    const avg = calculateAverageRetention(records, '2026-08-15')
    expect(avg).toBe(1) // only p001 is learned, p002 is 新
  })
})

describe('getRetentionTimelineSplit', () => {
  it('should return 30 data points', () => {
    const result = getRetentionTimelineSplit([], 30)
    expect(result).toHaveLength(30)
  })

  it('should separate quiz and recite retention', () => {
    const records: LearningRecord[] = [
      { poemId: 'p001', lastReviewDate: '2026-08-15', reviewCount: 1, nextReviewDate: '2026-08-17', correctness: [1], reciteCorrectness: [], masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0 },
    ]
    const result = getRetentionTimelineSplit(records, 1)
    expect(result[0].quizRetention).toBeGreaterThan(0)
    expect(result[0].reciteRetention).toBe(0)
  })
})

describe('getPoemRetentionPoints', () => {
  it('should return empty for no results', () => {
    const record: LearningRecord = {
      poemId: 'p001', lastReviewDate: '2026-08-15', reviewCount: 1,
      nextReviewDate: '2026-08-17', correctness: [1], reciteCorrectness: [],
      masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0,
    }
    const points = getPoemRetentionPoints(record, [], [])
    expect(points).toHaveLength(0)
  })

  it('should build timeline from quiz and recite results', () => {
    const record: LearningRecord = {
      poemId: 'p001', lastReviewDate: '2026-08-15', reviewCount: 2,
      nextReviewDate: '2026-08-19', correctness: [1, 1], reciteCorrectness: [],
      masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0,
    }
    const quizResults = [{ poemId: 'p001', date: '2026-08-14', correct: true }]
    const reciteRecords = [{ poemId: 'p001', date: '2026-08-15', correct: false }]
    const points = getPoemRetentionPoints(record, quizResults, reciteRecords)
    expect(points).toHaveLength(2)
    expect(points[0].type).toBe('quiz')
    expect(points[1].type).toBe('recite')
  })
})
```

- [ ] **Step 3: 运行测试验证**

Run: `npx vitest run tests/unit/retention.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/utils/retention.ts tests/unit/retention.test.ts
git commit -m "feat: add retention calculation utility"
```

---

### Task 4: 安装 Chart.js 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 chart.js**

Run: `npm install chart.js`

- [ ] **Step 2: 验证安装**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add chart.js dependency"
```

---

### Task 5: 背诵页面 — RecitePage

**Files:**
- Create: `src/views/RecitePage.vue`

- [ ] **Step 1: 创建 RecitePage.vue**

这是背诵功能的独立页面，包含来源选择和卡片流。自评模式简化为：看标题→自行背诵→展开原文→"会了/不会"。

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import { shuffleArray } from '@/utils/quiz'
import type { Poem } from '@/types'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

type Phase = 'select' | 'recite'
const phase = ref<Phase>('select')
const source = ref<'review' | 'all'>('review')
const selectedGrades = ref<string[]>([])
const poemQueue = ref<Poem[]>([])
const currentIndex = ref(0)
const showText = ref(false)

const reviewDueCount = computed(() => learningStore.reviewDueCount)

const canStart = computed(() => {
  if (source.value === 'all' && selectedGrades.value.length === 0) return false
  return poemQueue.value.length > 0
})

function selectSource(s: 'review' | 'all') {
  source.value = s
  if (s === 'review') {
    buildQueue()
  } else {
    selectedGrades.value = []
    poemQueue.value = []
  }
}

function toggleGrade(grade: string) {
  const idx = selectedGrades.value.indexOf(grade)
  if (idx >= 0) selectedGrades.value.splice(idx, 1)
  else selectedGrades.value.push(grade)
  buildQueue()
}

function buildQueue() {
  const today = new Date().toISOString().split('T')[0]
  if (source.value === 'review') {
    const dueIds = new Set(learningStore.records.filter(r => r.nextReviewDate <= today).map(r => r.poemId))
    poemQueue.value = shuffleArray(poemStore.enabledPoems.filter(p => dueIds.has(p.id)))
  } else {
    const gradeSet = new Set(selectedGrades.value)
    poemQueue.value = shuffleArray(poemStore.enabledPoems.filter(p => gradeSet.has(p.grade)))
  }
}

function startRecite() {
  if (poemQueue.value.length === 0) return
  phase.value = 'recite'
  currentIndex.value = 0
  showText.value = false
}

const currentPoem = computed(() => poemQueue.value[currentIndex.value] ?? null)

const progressPercent = computed(() =>
  poemQueue.value.length > 0 ? (currentIndex.value / poemQueue.value.length) * 100 : 0
)

function answer(correct: boolean) {
  if (!currentPoem.value) return
  learningStore.recordRecite(currentPoem.value.id, correct)
  showText.value = false
  currentIndex.value++
  if (currentIndex.value >= poemQueue.value.length) {
    const reciteResults = poemQueue.value.map(p => {
      const rec = learningStore.getRecord(p.id)
      const lastCorrect = rec?.reciteCorrectness[rec.reciteCorrectness.length - 1] ?? 0
      return { poemId: p.id, correct: lastCorrect === 1 }
    })
    router.push({ name: 'recite-result', query: { data: JSON.stringify(reciteResults) } })
  }
}

function goHome() {
  router.push({ name: 'home' })
}

onMounted(() => {
  poemStore.fetchPoems()
  buildQueue()
})
</script>

<template>
  <div class="max-w-md mx-auto p-4">
    <!-- 来源选择阶段 -->
    <template v-if="phase === 'select'">
      <h2 class="text-xl font-bold text-center mb-6">古诗背诵</h2>

      <div v-if="reviewDueCount > 0" class="mb-4 p-4 bg-indigo-50 rounded-lg">
        <p class="text-indigo-700 font-medium">今日待复习：{{ reviewDueCount }} 首</p>
      </div>

      <div class="flex gap-3 mb-6">
        <button
          :class="['flex-1 p-4 border-2 rounded-lg cursor-pointer transition', source === 'review' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white']"
          @click="selectSource('review')"
        >
          <div class="font-medium">待复习</div>
          <div class="text-sm text-gray-500">{{ reviewDueCount }} 首</div>
        </button>
        <button
          :class="['flex-1 p-4 border-2 rounded-lg cursor-pointer transition', source === 'all' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white']"
          @click="selectSource('all')"
        >
          <div class="font-medium">全部古诗</div>
          <div class="text-sm text-gray-500">{{ poemStore.enabledPoems.length }} 首</div>
        </button>
      </div>

      <section v-if="source === 'all'" class="mb-6">
        <h3 class="text-sm text-gray-500 mb-2">选择年级</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="grade in poemStore.grades"
            :key="grade"
            :class="['px-3 py-2 border-2 rounded-lg text-sm cursor-pointer transition', selectedGrades.includes(grade) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white']"
            @click="toggleGrade(grade)"
          >
            {{ grade }}
          </button>
        </div>
      </section>

      <p v-if="poemQueue.length === 0 && source === 'review'" class="text-center text-gray-500 mb-4">今日没有待复习的古诗</p>

      <button
        :disabled="!canStart"
        :class="['w-full p-4 rounded-lg text-lg font-medium cursor-pointer transition mb-3', canStart ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-gray-300 text-gray-500 cursor-not-allowed']"
        @click="startRecite"
      >
        开始背诵 ({{ poemQueue.length }} 首)
      </button>

      <button class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-500 text-sm cursor-pointer hover:bg-gray-50 transition" @click="goHome">
        返回首页
      </button>
    </template>

    <!-- 背诵卡片流阶段 -->
    <template v-else-if="phase === 'recite' && currentPoem">
      <div class="progress-bar mb-2">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <p class="text-sm text-gray-500 text-center mb-4">
        第 {{ currentIndex + 1 }} / {{ poemQueue.length }} 首
      </p>

      <div class="text-center mb-6">
        <h2 class="text-3xl font-bold mb-2">{{ currentPoem.title }}</h2>
        <p class="text-gray-500">{{ currentPoem.dynasty }} · {{ currentPoem.author }}</p>
      </div>

      <div v-if="!showText" class="text-center mb-6">
        <button
          class="px-6 py-3 bg-white border-2 border-indigo-200 rounded-lg text-indigo-600 font-medium cursor-pointer hover:bg-indigo-50 transition"
          @click="showText = true"
        >
          查看原文
        </button>
      </div>

      <div v-else class="mb-6 p-4 bg-gray-50 rounded-lg">
        <p v-for="(line, i) in currentPoem.text" :key="i" class="text-lg text-center py-1">{{ line }}</p>
      </div>

      <div class="flex gap-3">
        <button
          class="flex-1 p-4 bg-green-50 border-2 border-green-200 rounded-lg text-green-700 font-medium text-lg cursor-pointer hover:bg-green-100 transition"
          @click="answer(true)"
        >
          会了
        </button>
        <button
          class="flex-1 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700 font-medium text-lg cursor-pointer hover:bg-red-100 transition"
          @click="answer(false)"
        >
          不会
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s;
}
</style>
```

- [ ] **Step 2: 验证编译**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/views/RecitePage.vue
git commit -m "feat: add RecitePage with self-assessment card flow"
```

---

### Task 6: 背诵结果页 — ReciteResultPage

**Files:**
- Create: `src/views/ReciteResultPage.vue`

- [ ] **Step 1: 创建 ReciteResultPage.vue**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

interface ReciteResultItem {
  poemId: string
  correct: boolean
}

const results = computed<ReciteResultItem[]>(() => {
  try {
    const data = router.currentRoute.value.query.data as string
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
})

const masteredCount = computed(() => results.value.filter(r => r.correct).length)
const notMasteredCount = computed(() => results.value.filter(r => !r.correct).length)

const expandedIds = ref<Set<string>>(new Set())

function toggleExpand(poemId: string) {
  if (expandedIds.value.has(poemId)) {
    expandedIds.value.delete(poemId)
  } else {
    expandedIds.value.add(poemId)
  }
}

function getPoemTitle(poemId: string): string {
  return poemStore.getPoemById(poemId)?.title ?? ''
}

function getPoemText(poemId: string): string[] {
  return poemStore.getPoemById(poemId)?.text ?? []
}

function goHome() {
  router.push({ name: 'home' })
}

function tryAgain() {
  router.push({ name: 'recite' })
}
</script>

<template>
  <div class="max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-4">背诵结果</h2>

    <div class="text-center mb-6">
      <div class="flex justify-center gap-6">
        <div>
          <div class="text-3xl font-bold text-green-500">{{ masteredCount }}</div>
          <div class="text-sm text-gray-500">会了</div>
        </div>
        <div>
          <div class="text-3xl font-bold text-red-500">{{ notMasteredCount }}</div>
          <div class="text-sm text-gray-500">不会</div>
        </div>
      </div>
    </div>

    <div class="mb-6">
      <div v-for="result in results" :key="result.poemId" class="mb-2">
        <div
          :class="['p-3 rounded-lg border-l-4 cursor-pointer', result.correct ? 'bg-green-50 border-l-green-500' : 'bg-red-50 border-l-red-500']"
          @click="!result.correct && toggleExpand(result.poemId)"
        >
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ getPoemTitle(result.poemId) }}</span>
            <span :class="['ml-auto text-lg font-bold', result.correct ? 'text-green-600' : 'text-red-500']">
              {{ result.correct ? '✓' : '✗' }}
            </span>
          </div>
        </div>
        <div v-if="expandedIds.has(result.poemId) && !result.correct" class="ml-4 mt-1 p-3 bg-white rounded-lg border border-gray-100">
          <p v-for="(line, i) in getPoemText(result.poemId)" :key="i" class="text-sm text-gray-600 py-0.5">{{ line }}</p>
        </div>
      </div>
    </div>

    <button v-if="notMasteredCount > 0" class="w-full p-4 bg-indigo-500 text-white rounded-lg text-lg font-medium cursor-pointer hover:bg-indigo-600 transition mb-3" @click="tryAgain">
      再来一轮
    </button>
    <button class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-500 text-sm cursor-pointer hover:bg-gray-50 transition" @click="goHome">
      返回首页
    </button>
  </div>
</template>
```

- [ ] **Step 2: 验证编译**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/views/ReciteResultPage.vue
git commit -m "feat: add ReciteResultPage"
```

---

### Task 7: 单首古诗详情页 — PoemDetailPage

**Files:**
- Create: `src/views/PoemDetailPage.vue`

- [ ] **Step 1: 创建 PoemDetailPage.vue**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import { getPoemRetentionPoints, calculateRetention } from '@/utils/retention'
import { getNextInterval } from '@/utils/ebbinghaus'
import Chart from 'chart.js/auto'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

const poemId = computed(() => {
  const id = router.currentRoute.value.params.id as string
  return id
})

const poem = computed(() => poemStore.getPoemById(poemId.value))
const record = computed(() => learningStore.getRecord(poemId.value))

const currentRetention = computed(() => {
  if (!record.value) return 0
  const today = new Date().toISOString().slice(0, 10)
  return calculateRetention(record.value, today)
})

const nextInterval = computed(() => {
  if (!record.value) return '-'
  return getNextInterval(record.value.reviewCount)
})

const quizCorrectRate = computed(() => {
  if (!record.value || record.value.correctness.length === 0) return '-'
  const correct = record.value.correctness.filter(c => c === 1).length
  return `${correct}/${record.value.correctness.length}`
})

const reciteCorrectRate = computed(() => {
  if (!record.value || record.value.reciteCorrectness.length === 0) return '-'
  const correct = record.value.reciteCorrectness.filter(c => c === 1).length
  return `${correct}/${record.value.reciteCorrectness.length}`
})

const chartRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

function renderChart() {
  if (!chartRef.value || !record.value) return

  const points = getPoemRetentionPoints(
    record.value,
    learningStore.data.quizResults,
    learningStore.data.reciteRecords
  )

  if (points.length === 0) return

  const labels = points.map(p => p.date.slice(5))
  const data = points.map(p => Math.round(p.retention * 100))
  const pointBgColors = points.map(p => {
    if (!p.correct) return '#ef4444'
    return p.type === 'quiz' ? '#3b82f6' : '#22c55e'
  })
  const pointBorderColors = pointBgColors

  chartInstance = new Chart(chartRef.value, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '记忆保持率',
        data,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: pointBgColors,
        pointBorderColor: pointBorderColors,
        pointRadius: 6,
        pointHoverRadius: 8,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const point = points[ctx.dataIndex]
              const typeLabel = point.type === 'quiz' ? '答题' : '背诵'
              const resultLabel = point.correct ? '正确' : '错误'
              return `${typeLabel}${resultLabel} 保持率 ${ctx.parsed.y}%`
            }
          }
        }
      },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: v => v + '%' } },
        x: { title: { display: true, text: '日期' } }
      }
    }
  })
}

onMounted(() => {
  poemStore.fetchPoems()
  setTimeout(renderChart, 100)
})

function goBack() {
  router.push({ name: 'progress' })
}
</script>

<template>
  <div class="max-w-md mx-auto p-4">
    <template v-if="poem">
      <h2 class="text-xl font-bold text-center mb-2">{{ poem.title }}</h2>
      <p class="text-center text-gray-500 mb-4">{{ poem.dynasty }} · {{ poem.author }} · {{ poem.grade }}</p>

      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="text-center p-3 bg-white border border-gray-200 rounded-lg">
          <div class="text-lg font-bold text-indigo-500">{{ record?.masteryLevel ?? '新' }}</div>
          <div class="text-xs text-gray-500">掌握等级</div>
        </div>
        <div class="text-center p-3 bg-white border border-gray-200 rounded-lg">
          <div class="text-lg font-bold text-indigo-500">{{ Math.round(currentRetention * 100) }}%</div>
          <div class="text-xs text-gray-500">当前保持率</div>
        </div>
        <div class="text-center p-3 bg-white border border-gray-200 rounded-lg">
          <div class="text-lg font-bold text-indigo-500">{{ record?.nextReviewDate ?? '-' }}</div>
          <div class="text-xs text-gray-500">下次复习</div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="text-center p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <div class="text-lg font-bold text-blue-600">{{ quizCorrectRate }}</div>
          <div class="text-xs text-gray-500">答题正确率</div>
        </div>
        <div class="text-center p-3 bg-green-50 border border-green-100 rounded-lg">
          <div class="text-lg font-bold text-green-600">{{ reciteCorrectRate }}</div>
          <div class="text-xs text-gray-500">背诵正确率</div>
        </div>
      </div>

      <div class="mb-4">
        <h3 class="text-sm text-gray-500 mb-2">遗忘曲线</h3>
        <div class="bg-white border border-gray-200 rounded-lg p-3">
          <canvas ref="chartRef"></canvas>
        </div>
        <div class="flex gap-4 mt-2 text-xs text-gray-500 justify-center">
          <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full bg-blue-500"></span> 答题正确</span>
          <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full bg-green-500"></span> 背诵正确</span>
          <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full bg-red-500"></span> 错误</span>
        </div>
      </div>

      <div class="mb-4 p-4 bg-gray-50 rounded-lg">
        <p v-for="(line, i) in poem.text" :key="i" class="text-lg text-center py-0.5">{{ line }}</p>
      </div>
    </template>

    <div v-else class="text-center text-gray-500">
      <p>古诗未找到</p>
    </div>

    <button class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-500 text-sm cursor-pointer hover:bg-gray-50 transition" @click="goBack">
      返回进度
    </button>
  </div>
</template>
```

- [ ] **Step 2: 验证编译**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/views/PoemDetailPage.vue
git commit -m "feat: add PoemDetailPage with forgetting curve chart"
```

---

### Task 8: 更新路由和首页导航

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/views/HomePage.vue`

- [ ] **Step 1: 在 router/index.ts 新增路由**

在现有路由数组中新增：

```typescript
{ path: '/recite', name: 'recite', component: () => import('@/views/RecitePage.vue') },
{ path: '/recite/result', name: 'recite-result', component: () => import('@/views/ReciteResultPage.vue') },
{ path: '/poem/:id', name: 'poem-detail', component: () => import('@/views/PoemDetailPage.vue') },
```

- [ ] **Step 2: 在 HomePage.vue 新增"背诵"入口按钮**

在现有 grid 中，将"古诗抽背"按钮改为指向新的背诵路由：

修改 `startRecitation` 方法：
```typescript
function startRecitation() {
  router.push({ name: 'recite' })
}
```

（按钮本身已存在，只需修改路由目标）

- [ ] **Step 3: 验证编译**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/router/index.ts src/views/HomePage.vue
git commit -m "feat: add recite routes and update home navigation"
```

---

### Task 9: 进度页增强 — 总览遗忘曲线图 + 可点击列表

**Files:**
- Modify: `src/views/ProgressPage.vue`

- [ ] **Step 1: 更新 ProgressPage.vue**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLearningStore } from '@/stores/learning'
import { usePoemStore } from '@/stores/poem'
import { getRetentionTimelineSplit } from '@/utils/retention'
import { isDueForReview } from '@/utils/ebbinghaus'
import Chart from 'chart.js/auto'
import type { MasteryLevel } from '@/types'

const router = useRouter()
const learningStore = useLearningStore()
const poemStore = usePoemStore()

const totalPoems = computed(() => poemStore.enabledPoems.length)

const learnedCount = computed(() => {
  return learningStore.records.filter(r => r.masteryLevel !== '新').length
})

const masteryDistribution = computed(() => {
  const levels: MasteryLevel[] = ['新', '学', '熟', '固']
  return levels.map(level => ({
    level,
    count: learningStore.records.filter(r => r.masteryLevel === level).length,
  }))
})

const masteryColors: Record<string, string> = {
  '新': 'bg-gray-100 text-gray-500',
  '学': 'bg-blue-100 text-blue-600',
  '熟': 'bg-green-100 text-green-600',
  '固': 'bg-orange-100 text-orange-600',
}

// 总览遗忘曲线图
const overviewChartRef = ref<HTMLCanvasElement | null>(null)
let overviewChart: Chart | null = null

function renderOverviewChart() {
  if (!overviewChartRef.value) return

  const timeline = getRetentionTimelineSplit(learningStore.records, 30)
  if (timeline.length === 0) return

  const labels = timeline.map(t => t.date.slice(5))
  const quizData = timeline.map(t => Math.round(t.quizRetention * 100))
  const reciteData = timeline.map(t => Math.round(t.reciteRetention * 100))

  overviewChart = new Chart(overviewChartRef.value, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '答题保持率',
          data: quizData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        },
        {
          label: '背诵保持率',
          data: reciteData,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true, position: 'top' } },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: v => v + '%' } },
        x: { title: { display: true, text: '最近30天' }, ticks: { maxTicksLimit: 7 } }
      }
    }
  })
}

// 古诗列表（按掌握等级分组）
const poemListByMastery = computed(() => {
  const levels: MasteryLevel[] = ['新', '学', '熟', '固']
  return levels.map(level => {
    const records = learningStore.records.filter(r => r.masteryLevel === level)
    const poems = records.map(r => {
      const poem = poemStore.getPoemById(r.poemId)
      return poem ? { poem, record: r } : null
    }).filter(Boolean) as { poem: NonNullable<ReturnType<typeof poemStore.getPoemById>>; record: typeof records[0] }[]
    return { level, poems }
  })
})

function goToDetail(poemId: string) {
  router.push({ name: 'poem-detail', params: { id: poemId } })
}

onMounted(() => {
  poemStore.fetchPoems()
  setTimeout(renderOverviewChart, 100)
})
</script>

<template>
  <div class="max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-6">学习进度</h2>

    <div class="text-center p-4 bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
      <div class="text-3xl font-bold text-indigo-500">{{ learnedCount }} / {{ totalPoems }}</div>
      <div class="text-sm text-gray-500 mt-1">已学 / 总数</div>
    </div>

    <div class="mb-4">
      <h3 class="text-sm text-gray-500 mb-2">掌握程度分布</h3>
      <div class="flex gap-3 justify-center">
        <div v-for="item in masteryDistribution" :key="item.level" class="flex flex-col items-center gap-1 p-3 bg-white border border-gray-200 rounded-lg shadow-sm min-w-[60px]">
          <span :class="['text-xl font-bold px-2 py-0.5 rounded', masteryColors[item.level]]">{{ item.level }}</span>
          <span class="text-lg font-bold">{{ item.count }}</span>
        </div>
      </div>
    </div>

    <div class="text-center p-4 bg-white border border-gray-200 rounded-lg shadow-sm mb-6">
      <div class="text-3xl font-bold text-orange-500">{{ learningStore.unproficientCount }}</div>
      <div class="text-sm text-gray-500 mt-1">不熟练</div>
    </div>

    <!-- 总览遗忘曲线图 -->
    <div class="mb-6">
      <h3 class="text-sm text-gray-500 mb-2">记忆保持率趋势</h3>
      <div class="bg-white border border-gray-200 rounded-lg p-3">
        <canvas ref="overviewChartRef"></canvas>
      </div>
    </div>

    <!-- 古诗列表 -->
    <div class="mb-6">
      <h3 class="text-sm text-gray-500 mb-2">古诗列表</h3>
      <div v-for="group in poemListByMastery" :key="group.level" class="mb-3">
        <div :class="['text-sm font-medium mb-1 px-2 py-1 rounded', masteryColors[group.level]]">{{ group.level }} ({{ group.poems.length }})</div>
        <div class="space-y-1">
          <div
            v-for="item in group.poems"
            :key="item.poem.id"
            class="flex items-center gap-2 p-2 bg-white border border-gray-100 rounded-lg cursor-pointer hover:bg-gray-50 transition"
            @click="goToDetail(item.poem.id)"
          >
            <span class="text-sm font-medium">{{ item.poem.title }}</span>
            <span class="text-xs text-gray-400">{{ item.poem.dynasty }}·{{ item.poem.author }}</span>
            <span class="ml-auto text-xs text-gray-400">下次：{{ item.record.nextReviewDate }}</span>
          </div>
        </div>
      </div>
    </div>

    <router-link :to="{ name: 'home' }" class="block text-center text-indigo-500 no-underline text-sm mt-6">返回首页</router-link>
  </div>
</template>
```

- [ ] **Step 2: 验证编译**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 3: 运行全部测试**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/views/ProgressPage.vue
git commit -m "feat: enhance ProgressPage with retention chart and clickable poem list"
```

---

### Task 10: 全量测试与构建验证

**Files:**
- 无新增

- [ ] **Step 1: 运行全部单元测试**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: 运行 TypeScript 类型检查**

Run: `npx vue-tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 运行构建**

Run: `npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit（如有修复）**

```bash
git add -A
git commit -m "fix: resolve build and test issues"
```

---

### Task 11: 修复现有 lastReviewDate bug

**Files:**
- Modify: `src/utils/ebbinghaus.ts`

- [ ] **Step 1: 修复 calculateNextReview 中 lastReviewDate 不更新的问题**

在 `src/utils/ebbinghaus.ts` 中，修改 `calculateNextReview`：

```typescript
export function calculateNextReview(record: LearningRecord, correct: boolean): LearningRecord {
  if (correct) {
    const newCount = record.reviewCount + 1
    const today = new Date().toISOString().slice(0, 10)
    const interval = getNextInterval(record.reviewCount)
    return {
      ...record,
      reviewCount: newCount,
      nextReviewDate: addDays(today, interval),
      masteryLevel: getMasteryLevel(newCount),
      correctness: [...record.correctness, 1],
      lastReviewDate: today,
    }
  }
  return handleWrongAnswer(record)
}
```

同时修改 `handleWrongAnswer`，更新 lastReviewDate：
```typescript
export function handleWrongAnswer(record: LearningRecord): LearningRecord {
  const today = new Date().toISOString().slice(0, 10)
  const currentIndex = Math.max(0, record.reviewCount - 1)
  const currentIntervalIndex = Math.min(currentIndex, INTERVALS.length - 1)
  const backoffIndex = Math.max(0, currentIntervalIndex - 1)
  const backoffInterval = INTERVALS[backoffIndex]

  return {
    ...record,
    nextReviewDate: addDays(today, backoffInterval),
    correctness: [...record.correctness, 0],
    unproficientCorrectStreak: 0,
    lastReviewDate: today,
  }
}
```

- [ ] **Step 2: 运行 ebbinghaus 测试验证**

Run: `npx vitest run tests/unit/ebbinghaus.test.ts`
Expected: PASS（可能需要更新测试中的断言以匹配新行为）

- [ ] **Step 3: 运行全部测试**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/utils/ebbinghaus.ts
git commit -m "fix: update lastReviewDate in calculateNextReview and handleWrongAnswer"
```
