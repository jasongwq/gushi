# 复习计划表 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为古诗抽查 PWA 新增「复习计划表」：按天分组展示未来 30 天每天要复习的古诗，每首标注复习原因（到期复习/不熟练/错题本/新增学习），首页新增入口，详情页新增「背诵复习」按钮。

**Architecture:** 复用现有「纯函数工具 + 页面」模式。`src/utils/reviewPlan.ts` 提供纯函数 `buildReviewPlan`，把 records/wrongBook/poems 转成 30 天计划（可注入 today 便于测试）；`ReviewPlanPage.vue` 渲染按天分组列表。`quizStore.startRecitation` 增加可选第 4 参 `poemId` 支持单诗背诵，`PoemDetailPage` 用该入口加「背诵复习」按钮。首页快捷栏由 4 列改 5 列加「复习计划」入口。

**Tech Stack:** Vue 3 + Pinia + TypeScript + Tailwind CSS + Vitest + Playwright

**Prerequisite:** 所有代码修改在 git worktree 中进行（`.codebuddy/worktrees/review-plan`），不在 master 直接改。

---

### Task 1: 创建 worktree 并安装依赖

**Files:** 无（环境准备）

- [ ] **Step 1: 创建 worktree**

在 master checkout 根目录运行：

```bash
cd /root/古诗抽查 && git worktree add .codebuddy/worktrees/review-plan -b review-plan
```

- [ ] **Step 2: 确认 worktree 在最新 master**

```bash
git -C /root/古诗抽查/.codebuddy/worktrees/review-plan log --oneline -1
```

Expected: 输出 `11d58db docs: add calc-logic help hint to review plan spec`（若不同，运行 `git -C /root/古诗抽查/.codebuddy/worktrees/review-plan merge master`）

- [ ] **Step 3: 安装依赖**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npm install 2>&1 | tail -5
```

Expected: 无报错

- [ ] **Step 4: 确认现有测试基线通过**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run 2>&1 | tail -10
```

Expected: 所有测试通过

- [ ] **Step 5: Commit（无代码改动，仅确认环境）**

```bash
git add -A && git commit -m "chore: verify baseline tests in review-plan worktree" 2>&1 || echo "nothing to commit"
```

Expected: nothing to commit（无改动时）

---

### Task 2: 纯函数 buildReviewPlan — 测试先行

**Files:**
- Create: `tests/unit/reviewPlan.test.ts`
- Create: `src/utils/reviewPlan.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/reviewPlan.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import { buildReviewPlan } from '@/utils/reviewPlan'
import type { LearningRecord, WrongEntry, Poem } from '@/types'

const poems: Poem[] = [
  { id: 'p001', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级', text: ['床前明月光'], textType: '五言', yiwen: '' },
  { id: 'p002', title: '春晓', author: '孟浩然', dynasty: '唐', grade: '一年级', text: ['春眠不觉晓'], textType: '五言', yiwen: '' },
  { id: 'p003', title: '咏鹅', author: '骆宾王', dynasty: '唐', grade: '一年级', text: ['鹅鹅鹅'], textType: '其他', yiwen: '' },
  { id: 'p004', title: '江南', author: '汉乐府', dynasty: '汉', grade: '一年级', text: ['江南可采莲'], textType: '五言', yiwen: '' },
]

function makeRecord(poemId: string, nextReviewDate: string, overrides: Partial<LearningRecord> = {}): LearningRecord {
  return {
    poemId, lastReviewDate: '2026-08-01', reviewCount: 1,
    nextReviewDate, correctness: [1], reciteCorrectness: [],
    charMarkStats: [], masteryLevel: '学',
    unproficient: false, unproficientCorrectStreak: 0,
    ...overrides,
  }
}

const TODAY = '2026-08-19'

describe('buildReviewPlan', () => {
  it('returns an array covering the requested number of days starting today', () => {
    const plan = buildReviewPlan([], [], poems, 30, TODAY)
    expect(plan).toHaveLength(30)
    expect(plan[0].date).toBe(TODAY)
    expect(plan[29].date).toBe('2026-09-17')
  })

  it('places due poems on their nextReviewDate', () => {
    const records = [makeRecord('p001', '2026-08-20')]
    const plan = buildReviewPlan(records, [], poems, 30, TODAY)
    const day20 = plan.find(d => d.date === '2026-08-20')
    const item = day20!.items.find(i => i.poemId === 'p001')
    expect(item?.reasons).toContain('due')
  })

  it('does not include a poem on a day that is not its nextReviewDate', () => {
    const records = [makeRecord('p001', '2026-08-25')]
    const plan = buildReviewPlan(records, [], poems, 30, TODAY)
    const day20 = plan.find(d => d.date === '2026-08-20')!
    expect(day20.items.some(i => i.poemId === 'p001')).toBe(false)
  })

  it('moves overdue due poems to today', () => {
    const records = [makeRecord('p001', '2026-08-10')]
    const plan = buildReviewPlan(records, [], poems, 30, TODAY)
    const today = plan[0]
    const item = today.items.find(i => i.poemId === 'p001')
    expect(item?.reasons).toContain('due')
  })

  it('puts unproficient poems on today', () => {
    const records = [makeRecord('p001', '2026-09-10', { unproficient: true })]
    const plan = buildReviewPlan(records, [], poems, 30, TODAY)
    const today = plan[0]
    expect(today.items.find(i => i.poemId === 'p001')?.reasons).toContain('unproficient')
  })

  it('puts unlearned poems on today as new', () => {
    // p004 has no record
    const plan = buildReviewPlan([], [], poems, 30, TODAY)
    const today = plan[0]
    expect(today.items.find(i => i.poemId === 'p004')?.reasons).toContain('new')
  })

  it('schedules wrong-book poems for the day after lastWrongDate', () => {
    const wrongBook: WrongEntry[] = [
      { poemId: 'p002', quizType: 'fillBlank', wrongCount: 1, lastWrongDate: '2026-08-20', unproficient: false },
    ]
    const plan = buildReviewPlan([], wrongBook, poems, 30, TODAY)
    const day21 = plan.find(d => d.date === '2026-08-21')!
    expect(day21.items.find(i => i.poemId === 'p002')?.reasons).toContain('wrongBook')
  })

  it('moves overdue wrong-book poems to today', () => {
    const wrongBook: WrongEntry[] = [
      { poemId: 'p002', quizType: 'fillBlank', wrongCount: 1, lastWrongDate: '2026-08-10', unproficient: false },
    ]
    const plan = buildReviewPlan([], wrongBook, poems, 30, TODAY)
    const today = plan[0]
    expect(today.items.find(i => i.poemId === 'p002')?.reasons).toContain('wrongBook')
  })

  it('uses the most recent lastWrongDate for poems with multiple entries', () => {
    const wrongBook: WrongEntry[] = [
      { poemId: 'p002', quizType: 'fillBlank', wrongCount: 1, lastWrongDate: '2026-08-10', unproficient: false },
      { poemId: 'p002', quizType: 'line', wrongCount: 1, lastWrongDate: '2026-08-21', unproficient: false },
    ]
    const plan = buildReviewPlan([], wrongBook, poems, 30, TODAY)
    const day22 = plan.find(d => d.date === '2026-08-22')!
    expect(day22.items.find(i => i.poemId === 'p002')?.reasons).toContain('wrongBook')
  })

  it('combines multiple reasons for the same poem on the same day', () => {
    const records = [makeRecord('p001', '2026-08-20', { unproficient: true })]
    const wrongBook: WrongEntry[] = [
      { poemId: 'p001', quizType: 'fillBlank', wrongCount: 1, lastWrongDate: '2026-08-19', unproficient: false },
    ]
    const plan = buildReviewPlan(records, wrongBook, poems, 30, TODAY)
    const day20 = plan.find(d => d.date === '2026-08-20')!
    const item = day20.items.find(i => i.poemId === 'p001')
    expect(item?.reasons).toContain('due')
    expect(item?.reasons).toContain('unproficient')
    expect(item?.reasons).toContain('wrongBook') // 错于 08-19，次日 08-20 复习
  })

  it('does not add an unproficient poem to future due days as unproficient', () => {
    // unproficient 只归今天；future due day 上该诗 reasons 不应含 unproficient
    const records = [makeRecord('p001', '2026-08-20', { unproficient: true })]
    const plan = buildReviewPlan(records, [], poems, 30, TODAY)
    const day20 = plan.find(d => d.date === '2026-08-20')!
    const item = day20.items.find(i => i.poemId === 'p001')
    expect(item?.reasons).toEqual(['due'])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run tests/unit/reviewPlan.test.ts 2>&1 | tail -15
```

Expected: FAIL — module not found: `@/utils/reviewPlan`

- [ ] **Step 3: 实现 `src/utils/reviewPlan.ts`**

```typescript
import type { LearningRecord, WrongEntry, Poem } from '@/types'
import { addDays } from '@/utils/ebbinghaus'

export type ReviewReason = 'due' | 'unproficient' | 'wrongBook' | 'new'

export interface ReviewPlanItem {
  poemId: string
  reasons: ReviewReason[]
}

export interface ReviewPlanDay {
  date: string
  items: ReviewPlanItem[]
}

/**
 * 生成未来 days 天的复习计划。
 * 归组规则：
 * - due: nextReviewDate === date；逾期（< today）落回今天
 * - unproficient: 归入今天（持续状态）
 * - new: 无学习记录的诗归入今天
 * - wrongBook: lastWrongDate + 1 天；逾期落回今天；多条目取最近 lastWrongDate
 */
export function buildReviewPlan(
  records: LearningRecord[],
  wrongBook: WrongEntry[],
  poems: Poem[],
  days: number = 30,
  today?: string,
): ReviewPlanDay[] {
  const baseDate = today ?? new Date().toISOString().slice(0, 10)
  const recordMap = new Map(records.map(r => [r.poemId, r]))
  const learnedIds = new Set(recordMap.keys())

  // 每首诗最近一次错题日期（取 max lastWrongDate）
  const wrongByPoem = new Map<string, string>()
  for (const entry of wrongBook) {
    const cur = wrongByPoem.get(entry.poemId)
    if (!cur || entry.lastWrongDate > cur) {
      wrongByPoem.set(entry.poemId, entry.lastWrongDate)
    }
  }

  const plan: ReviewPlanDay[] = []
  for (let i = 0; i < days; i++) {
    const date = addDays(baseDate, i)
    const items: ReviewPlanItem[] = []

    for (const poem of poems) {
      const record = recordMap.get(poem.id)
      const reasons: ReviewReason[] = []

      // due：到期当天，或逾期落回今天
      if (record) {
        if (record.nextReviewDate === date) {
          reasons.push('due')
        } else if (record.nextReviewDate < baseDate && date === baseDate) {
          reasons.push('due')
        }
      }

      // unproficient：仅今天
      if (date === baseDate && record?.unproficient) {
        reasons.push('unproficient')
      }

      // wrongBook：lastWrongDate+1 天；逾期落回今天
      const lastWrong = wrongByPoem.get(poem.id)
      if (lastWrong) {
        const suggested = addDays(lastWrong, 1)
        if (suggested === date) {
          reasons.push('wrongBook')
        } else if (suggested < baseDate && date === baseDate) {
          reasons.push('wrongBook')
        }
      }

      // new：无学习记录，仅今天
      if (date === baseDate && !learnedIds.has(poem.id)) {
        reasons.push('new')
      }

      if (reasons.length > 0) {
        items.push({ poemId: poem.id, reasons })
      }
    }

    plan.push({ date, items })
  }

  return plan
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run tests/unit/reviewPlan.test.ts 2>&1 | tail -15
```

Expected: PASS，全部测试通过

- [ ] **Step 5: 运行全部单测确认无回归**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run 2>&1 | tail -10
```

Expected: 所有测试通过

- [ ] **Step 6: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add tests/unit/reviewPlan.test.ts src/utils/reviewPlan.ts && git commit -m "feat: add buildReviewPlan pure function with 30-day review plan logic"
```

---

### Task 3: quiz store 单诗背诵支持

**Files:**
- Modify: `src/stores/quiz.ts:144-187`
- Modify: `tests/unit/quiz-store-full.test.ts`（新增 describe 块）

- [ ] **Step 1: 写失败测试**

在 `tests/unit/quiz-store-full.test.ts` 末尾追加：

```typescript
describe('startRecitation single poem', () => {
  it('starts a recitation with only the given poem when poemId is provided', () => {
    const store = useQuizStore()
    const result = store.startRecitation('all', 3, undefined, 'p002')
    expect(result).toBe(true)
    expect(store.session).not.toBeNull()
    expect(store.session!.mode).toBe('recitation')
    expect(store.session!.questions).toHaveLength(1)
    expect(store.session!.questions[0].poemId).toBe('p002')
  })

  it('ignores count when poemId is provided', () => {
    const store = useQuizStore()
    store.startRecitation('all', 20, undefined, 'p003')
    expect(store.session!.questions).toHaveLength(1)
    expect(store.session!.questions[0].poemId).toBe('p003')
  })

  it('returns false when poemId does not exist', () => {
    const store = useQuizStore()
    const result = store.startRecitation('all', 3, undefined, 'nonexistent')
    expect(result).toBe(false)
  })

  it('returns false when poemId is disabled', () => {
    const store = useQuizStore()
    const learningStore = useLearningStore()
    learningStore.updateSettings({ enabledPoems: ['p001', 'p002'] })
    const result = store.startRecitation('all', 3, undefined, 'p004')
    expect(result).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run tests/unit/quiz-store-full.test.ts 2>&1 | tail -15
```

Expected: FAIL — 4 个新用例失败（startRecitation 不认第 4 个参数）

- [ ] **Step 3: 修改 `src/stores/quiz.ts` 的 `startRecitation`**

将函数签名和开头改为（现有 source/count/grades 逻辑保留）：

```typescript
  function startRecitation(source: SourceType, count: number, grades?: string[], poemId?: string): boolean {
    const poemStore = usePoemStore()
    const learningStore = useLearningStore()
    const today = new Date().toISOString().split('T')[0]

    const enabledPoems = poemStore.enabledPoems

    // 单诗模式：直接以指定诗构造 session
    if (poemId) {
      const poem = poemStore.getPoemById(poemId)
      if (!poem || !enabledPoems.some(p => p.id === poemId)) return false
      session.value = {
        source,
        quizTypes: ['recite'],
        questions: [{
          poemId: poem.id,
          quizType: 'recite' as QuizType,
          prompt: poem.title,
          options: [],
          correctIndex: 0,
        }],
        currentIndex: 0,
        answers: [],
        startTime: new Date().toISOString(),
        mode: 'recitation',
        recitationResults: [],
      }
      resetCurrentRecitation()
      return true
    }

    let selectedPoems: Poem[]
    // ……以下原有 source 分支逻辑不变……
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run tests/unit/quiz-store-full.test.ts 2>&1 | tail -15
```

Expected: PASS

- [ ] **Step 5: 运行全部单测确认无回归**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run 2>&1 | tail -10
```

Expected: 所有测试通过

- [ ] **Step 6: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add src/stores/quiz.ts tests/unit/quiz-store-full.test.ts && git commit -m "feat: support single-poem recitation via optional poemId param"
```

---

### Task 4: ReviewPlanPage 页面

**Files:**
- Create: `src/views/ReviewPlanPage.vue`
- Modify: `src/router/index.ts:8-23`
- Modify: `src/views/HomePage.vue:21-38`

- [ ] **Step 1: 创建 `src/views/ReviewPlanPage.vue`**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import { buildReviewPlan, type ReviewReason } from '@/utils/reviewPlan'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

onMounted(() => poemStore.fetchPoems())

const showCalcTip = ref(false)

const plan = computed(() => {
  if (poemStore.enabledPoems.length === 0) return []
  return buildReviewPlan(learningStore.records, learningStore.wrongBook, poemStore.enabledPoems, 30)
})

const activeDays = computed(() => plan.value.filter(d => d.items.length > 0))

// 展开状态：今天默认展开（activeDays[0] 即今天，可能为空则无展开）
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

// 初始化今天展开（activeDays 计算属性首次求值后再执行）
function initExpand() {
  const first = activeDays.value[0]
  if (first) expandedDates.value = new Set([first.date])
}

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
</script>

<template>
  <div class="w-full max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-1 flex items-center justify-center gap-1">
      复习计划
      <span
        class="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-indigo-500 bg-indigo-100 rounded-full cursor-pointer select-none"
        @click="showCalcTip = !showCalcTip"
      >!</span>
    </h2>
    <p class="text-sm text-gray-500 text-center mb-4">未来 30 天复习安排</p>

    <div v-if="showCalcTip" class="text-xs text-gray-500 bg-indigo-50 rounded-lg p-3 mb-4 leading-relaxed">
      复习计划按以下规则计算：
      <ul class="list-disc pl-4 mt-1 space-y-0.5">
        <li><strong>到期复习</strong>：艾宾浩斯调度当天到期；逾期未复习的会落到今天</li>
        <li><strong>不熟练</strong>：标记了"不熟练"的诗，每天建议复习</li>
        <li><strong>错题本</strong>：最近答错的诗，错后第 2 天建议复习；逾期未复习的落到今天</li>
        <li><strong>新增学习</strong>：还没学过的诗，建议今天开始学</li>
      </ul>
    </div>

    <div v-if="activeDays.length === 0" class="text-center text-gray-400 text-sm py-10">
      暂无复习安排
    </div>

    <div v-for="(day, index) in activeDays" :key="day.date" class="mb-3">
      <div
        class="p-3 bg-white border border-gray-200 rounded-lg shadow-sm cursor-pointer"
        @click="toggleDay(day.date)"
      >
        <div class="flex items-center justify-between">
          <div class="font-medium">{{ formatDay(day.date, index) }}</div>
          <div class="text-xs text-gray-400">{{ day.items.length }} 首 {{ isExpanded(day.date) ? '▴' : '▾' }}</div>
        </div>
        <div v-if="isExpanded(day.date)" class="mt-2 space-y-1">
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
          </div>
        </div>
      </div>
    </div>

    <router-link :to="{ name: 'home' }" class="block text-center text-indigo-500 no-underline text-sm mt-6">返回首页</router-link>
  </div>
</template>
```

- [ ] **Step 2: 初始化今天展开**

在上方 `onMounted(() => poemStore.fetchPoems())` 改为：

```typescript
onMounted(async () => {
  await poemStore.fetchPoems()
  initExpand()
})
```

- [ ] **Step 3: 注册路由**

修改 `src/router/index.ts`，在 `poem-detail` 路由前加：

```typescript
  { path: '/review-plan', name: 'review-plan', component: () => import('@/views/ReviewPlanPage.vue') },
```

- [ ] **Step 4: 首页加入口**

修改 `src/views/HomePage.vue` 底部快捷栏：`grid grid-cols-4` 改为 `grid grid-cols-5`，并在「古诗集合」前加：

```html
      <router-link to="/review-plan" class="shortcut-btn p-3 bg-white rounded-lg shadow text-center hover:shadow-md transition">
        <div class="text-sm">复习计划</div>
        <div class="text-lg">📅</div>
      </router-link>
```

- [ ] **Step 5: 类型检查 + 构建验证**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vue-tsc --noEmit 2>&1 | head -20
```

Expected: 无错误

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vite build 2>&1 | tail -5
```

Expected: 构建成功

- [ ] **Step 6: 单测确认无回归**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run 2>&1 | tail -10
```

Expected: 所有测试通过

- [ ] **Step 7: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add src/views/ReviewPlanPage.vue src/router/index.ts src/views/HomePage.vue && git commit -m "feat: add review plan page with 30-day grouped list and home entry"
```

---

### Task 5: 详情页「背诵复习」按钮

**Files:**
- Modify: `src/views/PoemDetailPage.vue`

- [ ] **Step 1: 在 `src/views/PoemDetailPage.vue` 脚本加复习方法**

在 `<script setup>` 的 `toggleYiwen` 函数后加：

```typescript
function startReciteReview() {
  const success = quizStore.startRecitation('review', 1, undefined, poemId.value)
  if (success) {
    router.push({ name: 'recitation-play' })
  }
}
```

并在 import 区加：

```typescript
import { useQuizStore } from '@/stores/quiz'
```

在 `const learningStore = useLearningStore()` 后加：

```typescript
const quizStore = useQuizStore()
```

- [ ] **Step 2: 模板加按钮**

在「译文」区块 `</div>` 之后、`</template>` 之前（返回按钮上方）加：

```html
      <button
        class="w-full p-4 bg-indigo-500 text-white rounded-lg text-lg font-medium cursor-pointer hover:bg-indigo-600 transition mb-3"
        @click="startReciteReview"
      >背诵复习</button>
```

- [ ] **Step 3: 类型检查 + 构建验证**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vue-tsc --noEmit 2>&1 | head -20
```

Expected: 无错误

- [ ] **Step 4: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add src/views/PoemDetailPage.vue && git commit -m "feat: add recite-review button to poem detail page"
```

---

### Task 6: e2e 测试

**Files:**
- Create: `tests/e2e/review-plan.spec.ts`

- [ ] **Step 1: 写 e2e 测试**

```typescript
import { test, expect } from '@playwright/test'

test('home page has review plan entry', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=复习计划')).toBeVisible({ timeout: 10000 })
})

test('review plan page shows today section with reason tags', async ({ page }) => {
  await page.goto('/#/review-plan')
  await expect(page.locator('h2')).toContainText('复习计划', { timeout: 10000 })
  await expect(page.locator('text=今天')).toBeVisible({ timeout: 10000 })
  // 有古诗数据时今天应有内容（未学的诗归今天，标签"新增学习"）
  await expect(page.locator('text=新增学习').first()).toBeVisible({ timeout: 10000 })
})

test('review plan page: calc tip toggles explanation', async ({ page }) => {
  await page.goto('/#/review-plan')
  await expect(page.locator('text=复习计划按以下规则计算')).not.toBeVisible()

  const tipIcon = page.locator('h2 span:has-text("!")')
  await tipIcon.click()
  await expect(page.locator('text=复习计划按以下规则计算')).toBeVisible()

  await tipIcon.click()
  await expect(page.locator('text=复习计划按以下规则计算')).not.toBeVisible()
})

test('review plan page: click poem navigates to detail', async ({ page }) => {
  await page.goto('/#/review-plan')

  // 展开今天并点击第一首
  await expect(page.locator('text=今天')).toBeVisible({ timeout: 10000 })
  const firstPoem = page.locator('div[class*="cursor-pointer"] span').filter({ hasText: /[一-龥]/ }).first()
  await expect(firstPoem).toBeVisible({ timeout: 10000 })
  await firstPoem.click()

  await expect(page.locator('text=掌握等级')).toBeVisible({ timeout: 5000 })
})

test('poem detail page: recite review button starts recitation', async ({ page }) => {
  // 清空状态避免残留 session
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()

  await page.goto('/#/poem/p001')
  await expect(page.locator('button:has-text("背诵复习")')).toBeVisible({ timeout: 10000 })

  await page.locator('button:has-text("背诵复习")').click()

  // 进入背诵播放页，单首诗
  await expect(page.locator('text=第 1 / 1 首')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.recitation-card')).toBeVisible({ timeout: 5000 })
})
```

- [ ] **Step 2: 构建 preview 并跑 e2e**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vite build 2>&1 | tail -3 && npx playwright test tests/e2e/review-plan.spec.ts 2>&1 | tail -20
```

Expected: 5 个用例通过

注意：若 4173 端口有旧的 preview 服务（跨 worktree 复用旧构建），先停掉：

```bash
lsof -ti:4173 | xargs -r kill
```

再重新 build + test。

- [ ] **Step 3: 跑全量 e2e 确认无回归**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx playwright test 2>&1 | tail -20
```

Expected: 全部通过（含既有 162 个用例 + 新增 5 个）

- [ ] **Step 4: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add tests/e2e/review-plan.spec.ts && git commit -m "test(e2e): review plan page and detail recite-review button"
```

---

### Task 7: 最终验证

**Files:** 无新文件

- [ ] **Step 1: 全量单测**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run 2>&1 | tail -10
```

Expected: 全部通过

- [ ] **Step 2: 类型检查**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vue-tsc --noEmit 2>&1
```

Expected: 无错误

- [ ] **Step 3: 生产构建**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vite build 2>&1 | tail -5
```

Expected: 构建成功

- [ ] **Step 4: 全量 e2e**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx playwright test 2>&1 | tail -20
```

Expected: 全部通过

- [ ] **Step 5: Commit（如有未提交）**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add -A && git commit -m "chore: final verification" 2>&1 || echo "nothing to commit"
```
