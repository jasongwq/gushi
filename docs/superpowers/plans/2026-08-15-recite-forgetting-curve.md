# 古诗背诵及遗忘曲线数据功能 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为古诗抽查 PWA 新增独立背诵模块（自评模式）和遗忘曲线可视化功能，背诵结果纳入遗忘曲线调度且与答题记录分开存储。

**Architecture:** 背诵模块独立于现有抽查流程，有独立的 RecitePage（卡片流自评）和 ReciteResultPage。新增 `ReciteRecord` 类型和 `reciteCorrectness` 字段分别记录背诵数据。遗忘曲线可视化使用 Chart.js，在 ProgressPage 增加总览图，新增 PoemDetailPage 展示单首古诗的详细遗忘曲线。遗忘曲线调度复用现有 `ebbinghaus.ts`。

**Tech Stack:** Vue 3 + Pinia + TypeScript + Tailwind CSS + Chart.js + Vite

---

### Task 1: 扩展数据模型 — 新增 ReciteRecord 和 reciteCorrectness

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 在 `src/types/index.ts` 中新增 `ReciteRecord` 接口，修改 `LearningRecord` 和 `UserData`**

在 `QuizResult` 接口之后新增：

```typescript
export interface ReciteRecord {
  poemId: string
  date: string           // YYYY-MM-DD
  correct: boolean       // 自评"会"=true，"不会"=false
}
```

修改 `LearningRecord`，在 `correctness` 后新增：

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
}
```

修改 `UserData`，在 `quizResults` 后新增：

```typescript
export interface UserData {
  records: LearningRecord[]
  quizResults: QuizResult[]
  reciteRecords: ReciteRecord[]  // 新增
  wrongBook: WrongEntry[]
  settings: UserSettings
}
```

- [ ] **Step 2: 运行类型检查确认无编译错误**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/recite-forgetting-curve && npx vue-tsc --noEmit 2>&1 | head -30`
Expected: 可能有其他文件因缺少 reciteCorrectness 字段而报错，这将在后续 Task 中修复

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add ReciteRecord type and reciteCorrectness to LearningRecord"
```

---

### Task 2: 更新存储层 — 数据迁移和 persistence

**Files:**
- Modify: `src/utils/storage.ts`
- Modify: `src/stores/learning.ts`

- [ ] **Step 1: 更新 `src/utils/storage.ts` 的 `getDefaultData` 和 `loadData`**

修改 `getDefaultData`：

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

修改 `loadData`，在 `const data = {` 块中增加 `reciteRecords`：

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

- [ ] **Step 2: 更新 `src/stores/learning.ts` — 新增 `recordRecite` 方法**

在 `getOrCreateRecord` 中补充 `reciteCorrectness: []` 初始化：

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

新增 `recordRecite` 方法（在 `recordAnswer` 之后）：

```typescript
  function recordRecite(poemId: string, correct: boolean) {
    const record = getOrCreateRecord(poemId)
    const today = new Date().toISOString().split('T')[0]

    // 更新 lastReviewDate 为当天
    const updated = { ...record, lastReviewDate: today, lastLearnDate: today }

    // 调用遗忘曲线调度
    const scheduled = calculateNextReview(updated, correct)
    const afterUnproficient = checkAutoUnmark(scheduled, correct)

    // 更新背诵正确性历史
    const finalRecord = {
      ...afterUnproficient,
      reciteCorrectness: [...afterUnproficient.reciteCorrectness, correct ? 1 : 0],
    }

    const idx = data.value.records.findIndex(r => r.poemId === poemId)
    data.value.records[idx] = finalRecord

    // 记录背诵记录
    data.value.reciteRecords.push({ poemId, date: today, correct })

    persist()
  }
```

修改 `clearAllData`，增加 `reciteRecords: []`：

```typescript
  function clearAllData() {
    data.value = { records: [], quizResults: [], reciteRecords: [], wrongBook: [], settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] } }
    persist()
  }
```

在 return 中增加 `recordRecite`：

```typescript
  return {
    data, records, wrongBook, settings, reviewDueCount, unproficientCount, wrongCount,
    getRecord, getOrCreateRecord, getMasteryLevel, recordAnswer, recordRecite, toggleUnproficient, removeWrongEntry,
    updateSettings, importUserData, exportUserData, clearAllData, persist,
  }
```

- [ ] **Step 3: 运行测试确认通过**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/recite-forgetting-curve && npx vitest run 2>&1`
Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
git add src/utils/storage.ts src/stores/learning.ts
git commit -m "feat: add storage migration and recordRecite method for recite tracking"
```

---

### Task 3: 新增记忆保持率计算工具

**Files:**
- Create: `src/utils/retention.ts`
- Test: `tests/unit/retention.test.ts`

- [ ] **Step 1: 编写 `retention.ts` 的测试**

```typescript
import { describe, it, expect } from 'vitest'
import { calculateRetention, calculateOverallRetention, calculateDailyRetention } from '@/utils/retention'
import type { LearningRecord } from '@/types'

describe('calculateRetention', () => {
  it('returns 1 for a poem just reviewed today', () => {
    const today = new Date().toISOString().slice(0, 10)
    const record: LearningRecord = {
      poemId: 'p001', lastReviewDate: today, reviewCount: 1,
      nextReviewDate: today, correctness: [1], reciteCorrectness: [],
      masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0,
    }
    expect(calculateRetention(record, today)).toBeCloseTo(1)
  })

  it('returns 0 for a poem never reviewed', () => {
    const today = new Date().toISOString().slice(0, 10)
    const record: LearningRecord = {
      poemId: 'p001', lastReviewDate: today, reviewCount: 0,
      nextReviewDate: today, correctness: [], reciteCorrectness: [],
      masteryLevel: '新', unproficient: false, unproficientCorrectStreak: 0,
    }
    expect(calculateRetention(record, today)).toBe(0)
  })

  it('decreases as days pass since last review', () => {
    const today = '2026-08-15'
    const record: LearningRecord = {
      poemId: 'p001', lastReviewDate: '2026-08-13', reviewCount: 1,
      nextReviewDate: '2026-08-15', correctness: [1], reciteCorrectness: [],
      masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0,
    }
    const retention = calculateRetention(record, today)
    expect(retention).toBeGreaterThan(0)
    expect(retention).toBeLessThan(1)
  })
})

describe('calculateOverallRetention', () => {
  it('returns 0 for empty records', () => {
    expect(calculateOverallRetention([], '2026-08-15')).toBe(0)
  })

  it('returns average retention across records', () => {
    const today = '2026-08-15'
    const records: LearningRecord[] = [
      { poemId: 'p001', lastReviewDate: today, reviewCount: 1, nextReviewDate: '2026-08-17', correctness: [1], reciteCorrectness: [], masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0 },
      { poemId: 'p002', lastReviewDate: today, reviewCount: 1, nextReviewDate: '2026-08-17', correctness: [1], reciteCorrectness: [], masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0 },
    ]
    expect(calculateOverallRetention(records, today)).toBeCloseTo(1)
  })
})

describe('calculateDailyRetention', () => {
  it('returns array of retention values for date range', () => {
    const records: LearningRecord[] = [
      { poemId: 'p001', lastReviewDate: '2026-08-10', reviewCount: 1, nextReviewDate: '2026-08-12', correctness: [1], reciteCorrectness: [], masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0 },
    ]
    const result = calculateDailyRetention(records, '2026-08-10', '2026-08-12')
    expect(result).toHaveLength(3)
    expect(result[0].retention).toBeCloseTo(1)
    expect(result[2].retention).toBeLessThan(1)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/recite-forgetting-curve && npx vitest run tests/unit/retention.test.ts 2>&1`
Expected: FAIL — module not found

- [ ] **Step 3: 实现 `retention.ts`**

```typescript
import type { LearningRecord } from '@/types'
import { getNextInterval } from '@/utils/ebbinghaus'

/**
 * 计算单首古诗在某天的记忆保持率
 * 保持率 = max(0, 1 - 距上次复习天数 / 当前复习间隔)
 * reviewCount=0 时返回 0（未学习）
 */
export function calculateRetention(record: LearningRecord, date: string): number {
  if (record.reviewCount === 0) return 0

  const lastReview = new Date(record.lastReviewDate + 'T00:00:00')
  const targetDate = new Date(date + 'T00:00:00')
  const daysSinceReview = Math.floor((targetDate.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24))

  if (daysSinceReview <= 0) return 1

  const interval = getNextInterval(record.reviewCount - 1)
  return Math.max(0, 1 - daysSinceReview / interval)
}

/**
 * 计算所有已学习古诗在某天的平均保持率
 */
export function calculateOverallRetention(records: LearningRecord[], date: string): number {
  const learned = records.filter(r => r.reviewCount > 0)
  if (learned.length === 0) return 0
  const sum = learned.reduce((acc, r) => acc + calculateRetention(r, date), 0)
  return sum / learned.length
}

/**
 * 生成日期范围内的每日保持率数据
 */
export function calculateDailyRetention(
  records: LearningRecord[],
  startDate: string,
  endDate: string,
): { date: string; retention: number }[] {
  const result: { date: string; retention: number }[] = []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10)
    result.push({ date: dateStr, retention: calculateOverallRetention(records, dateStr) })
  }
  return result
}

/**
 * 计算单首古诗的遗忘曲线时间线数据点
 * 基于 correctness 和 reciteCorrectness 重建每次复习后的保持率
 */
export function calculatePoemRetentionTimeline(
  record: LearningRecord,
  endDate: string,
): { date: string; retention: number; type: 'quiz' | 'recite'; correct: boolean }[] {
  if (record.reviewCount === 0) return []

  const points: { date: string; retention: number; type: 'quiz' | 'recite'; correct: boolean }[] = []
  const startDate = new Date(record.lastReviewDate + 'T00:00:00')

  // 合并答题和背诵记录，按日期排序
  // 简化实现：基于现有数据，从 lastReviewDate 开始，按间隔推算
  let reviewCount = 0
  let lastDate = startDate

  // 答题记录
  for (const correct of record.correctness) {
    reviewCount++
    const interval = getNextInterval(reviewCount - 1)
    const retention = correct ? 1 : 0.5
    points.push({
      date: lastDate.toISOString().slice(0, 10),
      retention,
      type: 'quiz',
      correct: correct === 1,
    })
    const nextDate = new Date(lastDate)
    nextDate.setDate(nextDate.getDate() + interval)
    lastDate = nextDate
  }

  // 背诵记录
  for (const correct of record.reciteCorrectness) {
    const retention = correct ? 1 : 0.5
    points.push({
      date: lastDate.toISOString().slice(0, 10),
      retention,
      type: 'recite',
      correct: correct === 1,
    })
  }

  return points
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/recite-forgetting-curve && npx vitest run tests/unit/retention.test.ts 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/retention.ts tests/unit/retention.test.ts
git commit -m "feat: add retention calculation utilities for forgetting curve visualization"
```

---

### Task 4: 安装 Chart.js 并更新构建配置

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 chart.js 依赖**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/recite-forgetting-curve && npm install chart.js 2>&1 | tail -5`

- [ ] **Step 2: 验证安装成功**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/recite-forgetting-curve && node -e "require('chart.js')" 2>&1 || echo "OK - ESM module"`
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add chart.js dependency for forgetting curve visualization"
```

---

### Task 5: 新增背诵页面 — RecitePage

**Files:**
- Modify: `src/router/index.ts`
- Create: `src/views/RecitePage.vue`

这是独立于现有 RecitationSetupPage/RecitationPlayPage 的**自评模式**背诵页面。核心交互：看标题→自行背诵→展开原文→自评"会/不会"。

- [ ] **Step 1: 在 `src/router/index.ts` 新增路由**

在现有路由数组中添加：

```typescript
  { path: '/recite', name: 'recite', component: () => import('@/views/RecitePage.vue') },
  { path: '/recite/result', name: 'recite-result', component: () => import('@/views/ReciteResultPage.vue') },
  { path: '/poem/:id', name: 'poem-detail', component: () => import('@/views/PoemDetailPage.vue') },
```

- [ ] **Step 2: 创建 `src/views/RecitePage.vue`**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import { isDueForReview } from '@/utils/ebbinghaus'
import { shuffleArray } from '@/utils/quiz'
import type { Poem } from '@/types'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

const source = ref<'review' | 'all'>('review')
const selectedGrades = ref<string[]>([])
const phase = ref<'setup' | 'cards'>('setup')
const poems = ref<Poem[]>([])
const currentIndex = ref(0)
const expanded = ref(false)
const results = ref<{ poemId: string; correct: boolean }[]>([])

const reviewDuePoems = computed(() => {
  const records = learningStore.records.filter(r => isDueForReview(r))
  return poemStore.enabledPoems.filter(p => records.some(r => r.poemId === p.id))
})

const reviewDueCount = computed(() => reviewDuePoems.value.length)

const currentPoem = computed(() => poems.value[currentIndex.value] ?? null)
const progressText = computed(() => `${currentIndex.value + 1} / ${poems.value.length}`)
const progressPercent = computed(() => poems.value.length > 0 ? ((currentIndex.value) / poems.value.length) * 100 : 0)

function toggleGrade(grade: string) {
  const idx = selectedGrades.value.indexOf(grade)
  if (idx >= 0) selectedGrades.value.splice(idx, 1)
  else selectedGrades.value.push(grade)
}

function startRecite() {
  let selected: Poem[] = []
  if (source.value === 'review') {
    selected = shuffleArray(reviewDuePoems.value)
  } else {
    if (selectedGrades.value.length > 0) {
      selected = poemStore.enabledPoems.filter(p => selectedGrades.value.includes(p.grade))
    } else {
      selected = [...poemStore.enabledPoems]
    }
    selected = shuffleArray(selected)
  }

  if (selected.length === 0) return
  poems.value = selected.slice(0, 20)
  currentIndex.value = 0
  expanded.value = false
  results.value = []
  phase.value = 'cards'
}

function selfEvaluate(correct: boolean) {
  if (!currentPoem.value) return
  learningStore.recordRecite(currentPoem.value.id, correct)
  results.value.push({ poemId: currentPoem.value.id, correct })

  if (currentIndex.value < poems.value.length - 1) {
    currentIndex.value++
    expanded.value = false
  } else {
    router.push({ name: 'recite-result', state: { results: results.value } })
  }
}
</script>

<template>
  <div class="max-w-md mx-auto p-4">
    <!-- 设置阶段 -->
    <template v-if="phase === 'setup'">
      <h2 class="text-xl font-bold text-center mb-6">古诗背诵</h2>

      <div v-if="reviewDueCount > 0" class="mb-4 p-4 bg-indigo-50 rounded-lg">
        <p class="text-indigo-700 font-medium">今日待复习：{{ reviewDueCount }} 首</p>
      </div>

      <section class="mb-6">
        <h3 class="text-sm text-gray-500 mb-2">背诵来源</h3>
        <div class="flex gap-3">
          <button
            :class="['flex-1 p-3 border-2 rounded-lg cursor-pointer transition', source === 'review' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white']"
            @click="source = 'review'"
          >待复习</button>
          <button
            :class="['flex-1 p-3 border-2 rounded-lg cursor-pointer transition', source === 'all' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white']"
            @click="source = 'all'"
          >全部古诗</button>
        </div>
      </section>

      <section v-if="source === 'all'" class="mb-6">
        <h3 class="text-sm text-gray-500 mb-2">选择年级（不选则为全部）</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="grade in poemStore.grades"
            :key="grade"
            :class="['px-3 py-2 border-2 rounded-lg text-sm cursor-pointer transition', selectedGrades.includes(grade) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white']"
            @click="toggleGrade(grade)"
          >{{ grade }}</button>
        </div>
      </section>

      <button
        :disabled="source === 'review' && reviewDueCount === 0"
        :class="['w-full p-4 rounded-lg text-lg font-medium cursor-pointer transition mb-3', (source === 'review' && reviewDueCount === 0) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-500 text-white hover:bg-indigo-600']"
        @click="startRecite"
      >开始背诵</button>

      <button class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-500 text-sm cursor-pointer hover:bg-gray-50 transition" @click="router.push({ name: 'home' })">
        返回首页
      </button>
    </template>

    <!-- 背诵卡片阶段 -->
    <template v-else-if="currentPoem">
      <div class="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
        <div class="h-full bg-indigo-500 transition-all duration-300" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <p class="text-sm text-gray-500 text-center mb-4">{{ progressText }}</p>

      <div class="text-center mb-6">
        <h2 class="text-3xl font-bold mb-2">{{ currentPoem.title }}</h2>
        <p class="text-gray-500">{{ currentPoem.dynasty }} · {{ currentPoem.author }}</p>
      </div>

      <!-- 查看原文 -->
      <div v-if="!expanded" class="text-center mb-6">
        <button
          class="px-6 py-3 bg-white border-2 border-indigo-200 rounded-lg text-indigo-600 font-medium cursor-pointer hover:bg-indigo-50 transition"
          @click="expanded = true"
        >查看原文</button>
      </div>

      <!-- 展开原文 -->
      <div v-else class="mb-6">
        <div class="p-4 bg-white border border-gray-200 rounded-lg mb-4">
          <p v-for="(line, i) in currentPoem.text" :key="i" class="text-lg leading-relaxed text-center">{{ line }}</p>
        </div>
        <div class="flex gap-3">
          <button
            class="flex-1 p-4 bg-green-50 border-2 border-green-200 rounded-lg text-green-700 font-medium text-lg cursor-pointer hover:bg-green-100 transition"
            @click="selfEvaluate(true)"
          >会了</button>
          <button
            class="flex-1 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700 font-medium text-lg cursor-pointer hover:bg-red-100 transition"
            @click="selfEvaluate(false)"
          >不会</button>
        </div>
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 3: 运行类型检查**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/recite-forgetting-curve && npx vue-tsc --noEmit 2>&1 | head -20`
Expected: 无错误（ReciteResultPage 和 PoemDetailPage 还未创建，路由可能报错，但它们是懒加载不会阻断编译）

- [ ] **Step 4: Commit**

```bash
git add src/views/RecitePage.vue src/router/index.ts
git commit -m "feat: add RecitePage with self-evaluation mode for poem recitation"
```

---

### Task 6: 新增背诵结果页面 — ReciteResultPage

**Files:**
- Create: `src/views/ReciteResultPage.vue`

- [ ] **Step 1: 创建 `src/views/ReciteResultPage.vue`**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'

const router = useRouter()
const poemStore = usePoemStore()

interface ReciteResult {
  poemId: string
  correct: boolean
}

// 从 router state 获取结果
const results = ref<ReciteResult[]>((history.state?.results as ReciteResult[]) ?? [])

const correctCount = computed(() => results.value.filter(r => r.correct).length)
const wrongCount = computed(() => results.value.filter(r => !r.correct).length)
const wrongResults = computed(() => results.value.filter(r => !r.correct))

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
          <div class="text-3xl font-bold text-green-500">{{ correctCount }}</div>
          <div class="text-sm text-gray-500">会了</div>
        </div>
        <div>
          <div class="text-3xl font-bold text-red-500">{{ wrongCount }}</div>
          <div class="text-sm text-gray-500">不会</div>
        </div>
      </div>
    </div>

    <div v-if="wrongResults.length > 0" class="mb-6">
      <h3 class="text-sm text-gray-500 mb-2">不会的古诗</h3>
      <div v-for="result in wrongResults" :key="result.poemId" class="mb-2">
        <div
          class="p-3 rounded-lg border-l-4 cursor-pointer bg-red-50 border-l-red-500"
          @click="toggleExpand(result.poemId)"
        >
          <span class="font-medium">{{ getPoemTitle(result.poemId) }}</span>
        </div>
        <div v-if="expandedIds.has(result.poemId)" class="ml-4 mt-1 p-3 bg-white rounded-lg border border-gray-100">
          <p v-for="(line, i) in getPoemText(result.poemId)" :key="i" class="text-sm text-gray-600">{{ line }}</p>
        </div>
      </div>
    </div>

    <button class="w-full p-4 bg-indigo-500 text-white rounded-lg text-lg font-medium cursor-pointer hover:bg-indigo-600 transition mb-3" @click="tryAgain">
      再来一轮
    </button>
    <button class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-500 text-sm cursor-pointer hover:bg-gray-50 transition" @click="goHome">
      返回首页
    </button>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/ReciteResultPage.vue
git commit -m "feat: add ReciteResultPage for self-evaluation results"
```

---

### Task 7: 新增古诗详情页 — PoemDetailPage

**Files:**
- Create: `src/views/PoemDetailPage.vue`

- [ ] **Step 1: 创建 `src/views/PoemDetailPage.vue`**

```vue
<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import { calculatePoemRetentionTimeline } from '@/utils/retention'
import { getMasteryLevel as getMasteryLevelUtil } from '@/utils/ebbinghaus'
import type { LearningRecord } from '@/types'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const route = useRoute()
const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

const poemId = computed(() => route.params.id as string)
const poem = computed(() => poemStore.getPoemById(poemId.value))
const record = computed(() => learningStore.getRecord(poemId.value))

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const quizCorrectRate = computed(() => {
  if (!record.value || record.value.correctness.length === 0) return null
  const correct = record.value.correctness.filter(c => c === 1).length
  return Math.round((correct / record.value.correctness.length) * 100)
})

const reciteCorrectRate = computed(() => {
  if (!record.value || record.value.reciteCorrectness.length === 0) return null
  const correct = record.value.reciteCorrectness.filter(c => c === 1).length
  return Math.round((correct / record.value.reciteCorrectness.length) * 100)
})

const nextReviewDate = computed(() => record.value?.nextReviewDate ?? '—')
const masteryLevel = computed(() => record.value?.masteryLevel ?? '新')

function renderChart() {
  if (!chartCanvas.value || !record.value) return

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  const timeline = calculatePoemRetentionTimeline(record.value, new Date().toISOString().slice(0, 10))
  if (timeline.length === 0) return

  const quizPoints = timeline.filter(p => p.type === 'quiz')
  const recitePoints = timeline.filter(p => p.type === 'recite')

  chartInstance = new Chart(chartCanvas.value, {
    type: 'line',
    data: {
      labels: timeline.map(p => p.date),
      datasets: [
        {
          label: '答题',
          data: timeline.map(p => p.type === 'quiz' ? (p.correct ? 1 : 0.3) : null),
          borderColor: '#4f46e5',
          backgroundColor: '#4f46e5',
          pointRadius: 6,
          pointStyle: 'circle',
          spanGaps: false,
          showLine: false,
        },
        {
          label: '背诵',
          data: timeline.map(p => p.type === 'recite' ? (p.correct ? 1 : 0.3) : null),
          borderColor: '#22c55e',
          backgroundColor: '#22c55e',
          pointRadius: 6,
          pointStyle: 'circle',
          spanGaps: false,
          showLine: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 1,
          ticks: {
            callback: (value) => `${(Number(value) * 100).toFixed(0)}%`,
          },
        },
        x: {
          ticks: {
            maxRotation: 45,
          },
        },
      },
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const point = timeline[context.dataIndex]
              if (!point) return ''
              return `${point.type === 'quiz' ? '答题' : '背诵'}：${point.correct ? '正确' : '错误'}`
            },
          },
        },
      },
    },
  })
}

onMounted(() => {
  if (poem.value) renderChart()
})

watch(poemId, () => {
  if (poem.value) renderChart()
})
</script>

<template>
  <div class="max-w-md mx-auto p-4">
    <template v-if="poem">
      <h2 class="text-xl font-bold text-center mb-2">{{ poem.title }}</h2>
      <p class="text-center text-gray-500 mb-4">{{ poem.dynasty }} · {{ poem.author }} · {{ poem.grade }}</p>

      <!-- 基本信息 -->
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="text-center p-3 bg-white border border-gray-200 rounded-lg">
          <div class="text-lg font-bold text-indigo-500">{{ masteryLevel }}</div>
          <div class="text-xs text-gray-500">掌握等级</div>
        </div>
        <div class="text-center p-3 bg-white border border-gray-200 rounded-lg">
          <div class="text-lg font-bold text-orange-500">{{ nextReviewDate }}</div>
          <div class="text-xs text-gray-500">下次复习</div>
        </div>
        <div class="text-center p-3 bg-white border border-gray-200 rounded-lg">
          <div class="text-lg font-bold text-gray-500">{{ record?.reviewCount ?? 0 }}</div>
          <div class="text-xs text-gray-500">复习次数</div>
        </div>
      </div>

      <!-- 正确率 -->
      <div class="flex gap-3 mb-4">
        <div v-if="quizCorrectRate !== null" class="flex-1 text-center p-3 bg-indigo-50 rounded-lg">
          <div class="text-lg font-bold text-indigo-600">{{ quizCorrectRate }}%</div>
          <div class="text-xs text-gray-500">答题正确率</div>
        </div>
        <div v-if="reciteCorrectRate !== null" class="flex-1 text-center p-3 bg-green-50 rounded-lg">
          <div class="text-lg font-bold text-green-600">{{ reciteCorrectRate }}%</div>
          <div class="text-xs text-gray-500">背诵正确率</div>
        </div>
      </div>

      <!-- 遗忘曲线图 -->
      <div class="mb-4 p-4 bg-white border border-gray-200 rounded-lg">
        <h3 class="text-sm text-gray-500 mb-2">遗忘曲线</h3>
        <div style="height: 250px; position: relative;">
          <canvas ref="chartCanvas"></canvas>
        </div>
        <p v-if="!record || record.reviewCount === 0" class="text-center text-gray-400 text-sm py-8">暂无学习数据</p>
      </div>

      <!-- 原文 -->
      <div class="p-4 bg-white border border-gray-200 rounded-lg mb-4">
        <h3 class="text-sm text-gray-500 mb-2">原文</h3>
        <p v-for="(line, i) in poem.text" :key="i" class="text-lg leading-relaxed text-center">{{ line }}</p>
      </div>
    </template>

    <div v-else class="text-center text-gray-500 py-8">古诗不存在</div>

    <button class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-500 text-sm cursor-pointer hover:bg-gray-50 transition" @click="router.back()">
      返回
    </button>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/PoemDetailPage.vue
git commit -m "feat: add PoemDetailPage with forgetting curve chart"
```

---

### Task 8: 更新首页 — 新增背诵入口

**Files:**
- Modify: `src/views/HomePage.vue`

- [ ] **Step 1: 修改 HomePage.vue，在现有"古诗抽背"按钮旁新增"自评背诵"按钮**

将现有 3 列 grid 改为 4 列（或保持 3 列增加第 2 行）。在现有 3 个按钮后新增：

```html
      <button class="mode-btn p-6 bg-white rounded-lg shadow hover:shadow-md transition" @click="router.push({ name: 'recite' })">
        <div class="text-3xl mb-2">🎯</div>
        <div class="font-medium">自评背诵</div>
      </button>
```

将 `grid grid-cols-3` 改为 `grid grid-cols-2`，使得 4 个按钮排列为 2x2 布局。

- [ ] **Step 2: 验证首页显示正常**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/recite-forgetting-curve && npx vite build 2>&1 | tail -5`
Expected: 构建成功

- [ ] **Step 3: Commit**

```bash
git add src/views/HomePage.vue
git commit -m "feat: add self-evaluation recite entry button on home page"
```

---

### Task 9: 更新进度页 — 新增遗忘曲线总览和古诗可点击

**Files:**
- Modify: `src/views/ProgressPage.vue`

- [ ] **Step 1: 重写 `src/views/ProgressPage.vue`，增加 Chart.js 总览图和可点击古诗列表**

```vue
<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLearningStore } from '@/stores/learning'
import { usePoemStore } from '@/stores/poem'
import { calculateDailyRetention } from '@/utils/retention'
import type { MasteryLevel } from '@/types'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

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

// 遗忘曲线总览
const overviewCanvas = ref<HTMLCanvasElement | null>(null)
let overviewChart: Chart | null = null

function renderOverviewChart() {
  if (!overviewCanvas.value) return

  if (overviewChart) {
    overviewChart.destroy()
    overviewChart = null
  }

  const today = new Date()
  const endStr = today.toISOString().slice(0, 10)
  const start = new Date(today)
  start.setDate(start.getDate() - 29)
  const startStr = start.toISOString().slice(0, 10)

  const dailyData = calculateDailyRetention(learningStore.records, startStr, endStr)

  overviewChart = new Chart(overviewCanvas.value, {
    type: 'line',
    data: {
      labels: dailyData.map(d => d.date.slice(5)),
      datasets: [{
        label: '记忆保持率',
        data: dailyData.map(d => Math.round(d.retention * 100)),
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { callback: (v) => `${v}%` },
        },
      },
      plugins: {
        legend: { display: false },
      },
    },
  })
}

// 古诗列表
const poemList = computed(() => {
  return poemStore.enabledPoems.map(p => {
    const record = learningStore.getRecord(p.id)
    return {
      id: p.id,
      title: p.title,
      author: p.author,
      masteryLevel: record?.masteryLevel ?? '新',
      nextReviewDate: record?.nextReviewDate ?? '—',
    }
  }).sort((a, b) => {
    const order: Record<string, number> = { '新': 0, '学': 1, '熟': 2, '固': 3 }
    return order[a.masteryLevel] - order[b.masteryLevel]
  })
})

function goToDetail(poemId: string) {
  router.push({ name: 'poem-detail', params: { id: poemId } })
}

onMounted(() => {
  renderOverviewChart()
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

    <!-- 遗忘曲线总览 -->
    <div class="mb-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h3 class="text-sm text-gray-500 mb-2">记忆保持率趋势（近30天）</h3>
      <div style="height: 200px; position: relative;">
        <canvas ref="overviewCanvas"></canvas>
      </div>
    </div>

    <div class="text-center p-4 bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
      <div class="text-3xl font-bold text-orange-500">{{ learningStore.unproficientCount }}</div>
      <div class="text-sm text-gray-500 mt-1">不熟练</div>
    </div>

    <!-- 古诗列表 -->
    <div class="mb-4">
      <h3 class="text-sm text-gray-500 mb-2">古诗列表（点击查看详情）</h3>
      <div class="max-h-96 overflow-y-auto">
        <div
          v-for="item in poemList"
          :key="item.id"
          class="p-3 bg-white border border-gray-200 rounded-lg mb-1 cursor-pointer hover:bg-gray-50 transition flex items-center gap-2"
          @click="goToDetail(item.id)"
        >
          <span :class="['text-xs font-bold px-2 py-0.5 rounded', masteryColors[item.masteryLevel]]">{{ item.masteryLevel }}</span>
          <span class="flex-1 text-sm">{{ item.title }}</span>
          <span class="text-xs text-gray-400">{{ item.author }}</span>
        </div>
      </div>
    </div>

    <router-link :to="{ name: 'home' }" class="block text-center text-indigo-500 no-underline text-sm mt-6">返回首页</router-link>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/ProgressPage.vue
git commit -m "feat: add forgetting curve overview chart and clickable poem list to progress page"
```

---

### Task 10: 更新现有测试并添加新测试

**Files:**
- Modify: `tests/unit/storage.test.ts`
- Modify: `tests/unit/types.test.ts`
- Create: `tests/unit/learning-recite.test.ts`

- [ ] **Step 1: 更新 `tests/unit/storage.test.ts`，确保 `reciteCorrectness` 和 `reciteRecords` 迁移正确**

在现有测试中，确保 `loadData` 返回的对象包含 `reciteRecords` 和每条 record 的 `reciteCorrectness`。添加测试：

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { loadData, saveData, clearData } from '@/utils/storage'

beforeEach(() => {
  localStorage.clear()
})

describe('storage migration', () => {
  it('adds reciteCorrectness to old records without it', () => {
    const oldData = {
      records: [{ poemId: 'p001', lastReviewDate: '2026-01-01', reviewCount: 1, nextReviewDate: '2026-01-02', correctness: [1], masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0 }],
      quizResults: [],
      wrongBook: [],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
    }
    localStorage.setItem('poem-quiz-data', JSON.stringify(oldData))
    const data = loadData()
    expect(data.records[0].reciteCorrectness).toEqual([])
    expect(data.reciteRecords).toEqual([])
  })
})
```

- [ ] **Step 2: 新增 `tests/unit/learning-recite.test.ts`，测试 `recordRecite` 方法**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useLearningStore } from '@/stores/learning'
import { createPinia, setActivePinia } from 'pinia'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('recordRecite', () => {
  it('creates a new record with reciteCorrectness on correct answer', () => {
    const store = useLearningStore()
    store.recordRecite('p001', true)
    const record = store.getRecord('p001')
    expect(record).toBeDefined()
    expect(record!.reciteCorrectness).toEqual([1])
    expect(record!.reviewCount).toBeGreaterThan(0)
  })

  it('appends to reciteCorrectness on subsequent answers', () => {
    const store = useLearningStore()
    store.recordRecite('p001', true)
    store.recordRecite('p001', false)
    const record = store.getRecord('p001')
    expect(record!.reciteCorrectness).toEqual([1, 0])
  })

  it('adds reciteRecord to reciteRecords array', () => {
    const store = useLearningStore()
    store.recordRecite('p001', true)
    expect(store.data.reciteRecords).toHaveLength(1)
    expect(store.data.reciteRecords[0].poemId).toBe('p001')
    expect(store.data.reciteRecords[0].correct).toBe(true)
  })

  it('updates nextReviewDate via ebbinghaus on correct answer', () => {
    const store = useLearningStore()
    store.recordRecite('p001', true)
    const record = store.getRecord('p001')
    expect(record!.nextReviewDate).not.toBe(record!.lastReviewDate)
  })
})
```

- [ ] **Step 3: 运行所有测试**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/recite-forgetting-curve && npx vitest run 2>&1`
Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
git add tests/unit/storage.test.ts tests/unit/learning-recite.test.ts tests/unit/types.test.ts
git commit -m "test: add tests for recite data migration and recordRecite method"
```

---

### Task 11: 最终验证和构建

**Files:**
- 无新文件

- [ ] **Step 1: 运行完整测试套件**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/recite-forgetting-curve && npx vitest run 2>&1`
Expected: 所有测试通过

- [ ] **Step 2: 运行类型检查**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/recite-forgetting-curve && npx vue-tsc --noEmit 2>&1`
Expected: 无错误

- [ ] **Step 3: 运行生产构建**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/recite-forgetting-curve && npx vite build 2>&1`
Expected: 构建成功

- [ ] **Step 4: Commit（如有未提交的修改）**

```bash
git add -A
git commit -m "chore: final verification and cleanup"
```
