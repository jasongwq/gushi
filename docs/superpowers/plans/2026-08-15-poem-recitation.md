# 古诗抽背功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有古诗抽查 PWA 中新增"古诗抽背"模式，家长念标题，孩子口头背诵，家长对照原文逐句判定对错。

**Architecture:** 复用现有 quiz store 的筛选/出题/进度基础设施，新增 `mode: 'recitation'` 区分抽背模式。新增独立的抽背页面和结果页处理多粒度判定。抽背结果写入 learningStore 复用遗忘曲线和错题本。

**Tech Stack:** Vue 3 + Pinia + Vue Router + Tailwind CSS

---

### Task 1: 新增类型定义

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 在 `src/types/index.ts` 中新增 RecitationLineResult 和 RecitationResult 类型**

在 `QuizSession` 接口之后添加：

```typescript
export interface RecitationLineResult {
  lineIndex: number
  status: 'ok' | 'stuck' | 'forgot'
}

export interface RecitationResult {
  poemId: string
  overallStatus: 'mastered' | 'not-mastered'
  lines: RecitationLineResult[]
  authorCorrect: boolean | null
  dynastyCorrect: boolean | null
}
```

同时修改 `QuizSession` 接口，新增 `mode` 和 `recitationResults` 字段：

```typescript
export interface QuizSession {
  source: SourceType
  quizTypes: QuizType[]
  questions: QuizQuestion[]
  currentIndex: number
  answers: { questionIndex: number; selectedIndex: number; correct: boolean }[]
  startTime: string
  mode: 'quiz' | 'recitation'
  recitationResults: RecitationResult[]
}
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

Run: `npx vue-tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
git add src/types/index.ts
git commit -m "feat: add RecitationResult types and extend QuizSession"
```

---

### Task 2: 扩展 QuizStore 支持抽背模式

**Files:**
- Modify: `src/stores/quiz.ts`

- [ ] **Step 1: 新增 startRecitation 方法**

在 `src/stores/quiz.ts` 中：

1. 导入新类型：`import type { QuizQuestion, QuizSession, QuizType, SourceType, Poem, RecitationResult } from '@/types'`

2. 新增 `currentRecitation` ref 和 `resetCurrentRecitation` 方法：

```typescript
const currentRecitation = ref<{
  overallStatus: 'mastered' | 'not-mastered' | null
  lineStatuses: { lineIndex: number; status: 'ok' | 'stuck' | 'forgot' }[]
  authorCorrect: boolean | null
  dynastyCorrect: boolean | null
}>({
  overallStatus: null,
  lineStatuses: [],
  authorCorrect: null,
  dynastyCorrect: null,
})

function resetCurrentRecitation() {
  currentRecitation.value = {
    overallStatus: null,
    lineStatuses: [],
    authorCorrect: null,
    dynastyCorrect: null,
  }
}
```

3. 新增 `startRecitation` 方法，复用 `startQuiz` 的出题逻辑但不生成选项：

```typescript
function startRecitation(source: SourceType, count: number, grades?: string[]): boolean {
  const poemStore = usePoemStore()
  const learningStore = useLearningStore()
  const today = new Date().toISOString().split('T')[0]

  let selectedPoems: Poem[]
  if (source === 'smart') {
    selectedPoems = smartMix(poemStore.poems, learningStore.records, learningStore.wrongBook, count, today)
  } else if (source === 'review') {
    selectedPoems = shuffleArray(getReviewPoems(poemStore.poems, learningStore.records, today)).slice(0, count)
  } else if (source === 'wrong') {
    selectedPoems = shuffleArray(getWrongPoems(poemStore.poems, learningStore.wrongBook)).slice(0, count)
  } else if (source === 'unproficient') {
    selectedPoems = shuffleArray(getUnproficientPoems(poemStore.poems, learningStore.records)).slice(0, count)
  } else {
    selectedPoems = getPoemsBySource(poemStore.poems, source, today, { grades })
    selectedPoems = shuffleArray(selectedPoems).slice(0, count)
  }

  if (selectedPoems.length === 0) return false

  // 抽背模式的题目：只需 poemId，不需要选项
  const questions: QuizQuestion[] = selectedPoems.map(p => ({
    poemId: p.id,
    quizType: 'recite' as QuizType,
    prompt: p.title,
    options: [],
    correctIndex: 0,
  }))

  session.value = {
    source,
    quizTypes: ['recite'],
    questions,
    currentIndex: 0,
    answers: [],
    startTime: new Date().toISOString(),
    mode: 'recitation',
    recitationResults: [],
  }
  resetCurrentRecitation()
  return true
}
```

4. 新增 `submitRecitationResult` 方法，将当前诗的判定结果写入 session 并更新学习记录：

```typescript
function submitRecitationResult(result: RecitationResult) {
  if (!session.value) return
  session.value.recitationResults.push(result)

  const learningStore = useLearningStore()

  // 整首判定
  if (result.overallStatus === 'mastered') {
    learningStore.recordAnswer(result.poemId, 'recite', true)
  } else {
    learningStore.recordAnswer(result.poemId, 'recite', false)
    // 逐句判定中卡顿/不会的句子记入错题
    for (const line of result.lines) {
      if (line.status === 'stuck' || line.status === 'forgot') {
        learningStore.recordAnswer(result.poemId, 'recite', false, `第${line.lineIndex + 1}句:${line.status}`)
      }
    }
  }

  // 作者/朝代
  if (result.authorCorrect === false) {
    learningStore.recordAnswer(result.poemId, 'author', false)
  }
  if (result.dynastyCorrect === false) {
    learningStore.recordAnswer(result.poemId, 'dynasty', false)
  }

  session.value.currentIndex++
  resetCurrentRecitation()
}
```

5. 修改 `resetSession` 方法，同时重置 `currentRecitation`：

```typescript
function resetSession() {
  session.value = null
  resetCurrentRecitation()
}
```

6. 更新 return 语句，导出新增的属性和方法：

```typescript
return {
  session, currentIndex, currentQuestion, isFinished, totalQuestions, correctCount,
  currentRecitation, resetCurrentRecitation,
  startQuiz, startRecitation, answerQuestion, submitRecitationResult, resetSession,
}
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

Run: `npx vue-tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
git add src/stores/quiz.ts
git commit -m "feat: extend QuizStore with recitation mode support"
```

---

### Task 3: 新增路由

**Files:**
- Modify: `src/router/index.ts`

- [ ] **Step 1: 在路由配置中新增抽背页面路由**

在 `src/router/index.ts` 的 `routes` 数组中，在 `quiz-result` 之后添加：

```typescript
{ path: '/recitation/setup', name: 'recitation-setup', component: () => import('@/views/RecitationSetupPage.vue') },
{ path: '/recitation/play', name: 'recitation-play', component: () => import('@/views/RecitationPlayPage.vue') },
{ path: '/recitation/result', name: 'recitation-result', component: () => import('@/views/RecitationResultPage.vue') },
```

- [ ] **Step 2: 提交**

```bash
git add src/router/index.ts
git commit -m "feat: add recitation routes"
```

---

### Task 4: 新增抽背设置页面

**Files:**
- Create: `src/views/RecitationSetupPage.vue`

- [ ] **Step 1: 创建 RecitationSetupPage.vue**

参照 `QuizSetupPage.vue` 的模式，但简化为只有来源和数量选择（不需要题型选择），按钮文字改为"开始抽背"：

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import type { SourceType } from '@/types'

const router = useRouter()
const quizStore = useQuizStore()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

const source = ref<SourceType>(learningStore.settings.source || 'smart')
const count = ref(learningStore.settings.quizCount || 10)
const selectedGrades = ref<string[]>(learningStore.settings.selectedGrades || [])
const errorMsg = ref('')

function saveSettings() {
  learningStore.updateSettings({
    source: source.value,
    quizCount: count.value,
    selectedGrades: selectedGrades.value,
  })
}

watch([source, count, selectedGrades], saveSettings, { deep: true })

const sourceOptions: { value: SourceType; label: string }[] = [
  { value: 'smart', label: '智能混合' },
  { value: 'grade', label: '按年级' },
  { value: 'all', label: '全部' },
  { value: 'review', label: '仅待复习' },
  { value: 'wrong', label: '错题本' },
  { value: 'unproficient', label: '不熟练' },
]

const countOptions = [5, 10, 20]

const showGradeSelector = computed(() => source.value === 'grade')

const canStart = computed(() => {
  if (source.value === 'grade' && selectedGrades.value.length === 0) return false
  return true
})

function toggleGrade(grade: string) {
  const idx = selectedGrades.value.indexOf(grade)
  if (idx >= 0) selectedGrades.value.splice(idx, 1)
  else selectedGrades.value.push(grade)
}

function startRecitation() {
  if (!canStart.value) return
  errorMsg.value = ''
  const grades = source.value === 'grade' ? selectedGrades.value : undefined
  const success = quizStore.startRecitation(source.value, count.value, grades)
  if (!success) {
    errorMsg.value = '没有符合条件的古诗，请调整设置'
    return
  }
  router.push({ name: 'recitation-play' })
}
</script>

<template>
  <div class="max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-6">抽背设置</h2>

    <section class="mb-6">
      <h3 class="text-sm text-gray-500 mb-2">题目来源</h3>
      <select v-model="source" class="w-full p-3 border border-gray-200 rounded-lg text-base bg-white focus:border-indigo-300 focus:outline-none">
        <option v-for="opt in sourceOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </section>

    <section v-if="showGradeSelector" class="mb-6">
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

    <section class="mb-6">
      <h3 class="text-sm text-gray-500 mb-2">背诵数量</h3>
      <div class="flex gap-3">
        <button
          v-for="n in countOptions"
          :key="n"
          :class="['flex-1 p-3 border-2 rounded-lg text-base cursor-pointer transition', count === n ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white']"
          @click="count = n"
        >
          {{ n }} 首
        </button>
      </div>
    </section>

    <p v-if="errorMsg" class="text-red-500 text-sm text-center mb-3">{{ errorMsg }}</p>

    <button
      :disabled="!canStart"
      :class="['w-full p-4 rounded-lg text-lg font-medium cursor-pointer mb-3 transition', canStart ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-gray-300 text-gray-500 cursor-not-allowed']"
      @click="startRecitation"
    >
      开始抽背
    </button>

    <button class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-500 text-sm cursor-pointer hover:bg-gray-50 transition" @click="router.push({ name: 'home' })">
      返回首页
    </button>
  </div>
</template>
```

- [ ] **Step 2: 提交**

```bash
git add src/views/RecitationSetupPage.vue
git commit -m "feat: add RecitationSetupPage"
```

---

### Task 5: 新增 RecitationCard 组件

**Files:**
- Create: `src/components/RecitationCard.vue`

- [ ] **Step 1: 创建 RecitationCard.vue**

核心交互组件，展示标题 → 展开原文 → 逐句判定 → 整首熟练 → 作者/朝代附加项：

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Poem, RecitationResult, RecitationLineResult } from '@/types'

const props = defineProps<{
  poem: Poem
}>()

const emit = defineEmits<{
  submit: [result: RecitationResult]
}>()

const expanded = ref(false)
const overallStatus = ref<'mastered' | 'not-mastered' | null>(null)
const lineStatuses = ref<{ lineIndex: number; status: 'ok' | 'stuck' | 'forgot' }[]>(
  props.poem.text.map((_, i) => ({ lineIndex: i, status: 'ok' as const }))
)
const authorCorrect = ref<boolean | null>(null)
const dynastyCorrect = ref<boolean | null>(null)
const showAuthor = ref(false)
const showDynasty = ref(false)

// 当 poem 变化时重置状态
watch(() => props.poem.id, () => {
  expanded.value = false
  overallStatus.value = null
  lineStatuses.value = props.poem.text.map((_, i) => ({ lineIndex: i, status: 'ok' as const }))
  authorCorrect.value = null
  dynastyCorrect.value = null
  showAuthor.value = false
  showDynasty.value = false
})

function markMastered() {
  overallStatus.value = 'mastered'
  expanded.value = false
}

function markNotMastered() {
  overallStatus.value = 'not-mastered'
  expanded.value = true
}

function setLineStatus(index: number, status: 'ok' | 'stuck' | 'forgot') {
  lineStatuses.value[index] = { lineIndex: index, status }
}

const canSubmit = computed(() => overallStatus.value !== null)

function submit() {
  if (!overallStatus.value) return

  const result: RecitationResult = {
    poemId: props.poem.id,
    overallStatus: overallStatus.value,
    lines: overallStatus.value === 'not-mastered'
      ? lineStatuses.value.filter(l => l.status !== 'ok')
      : [],
    authorCorrect: showAuthor.value ? authorCorrect.value : null,
    dynastyCorrect: showDynasty.value ? dynastyCorrect.value : null,
  }
  emit('submit', result)
}
</script>

<template>
  <div class="recitation-card">
    <div class="text-center mb-6">
      <h2 class="text-3xl font-bold mb-2">{{ poem.title }}</h2>
      <p class="text-gray-500">{{ poem.dynasty }} · {{ poem.author }}</p>
    </div>

    <!-- 整首熟练 / 不熟练 -->
    <div v-if="!overallStatus" class="flex gap-3 mb-6">
      <button
        class="flex-1 p-4 bg-green-50 border-2 border-green-200 rounded-lg text-green-700 font-medium text-lg cursor-pointer hover:bg-green-100 transition"
        @click="markMastered"
      >
        ✓ 整首熟练
      </button>
      <button
        class="flex-1 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700 font-medium text-lg cursor-pointer hover:bg-red-100 transition"
        @click="markNotMastered"
      >
        ✗ 有不熟练
      </button>
    </div>

    <!-- 已选状态 -->
    <div v-else class="mb-4 text-center">
      <span v-if="overallStatus === 'mastered'" class="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium">
        ✓ 整首熟练
      </span>
      <span v-else class="inline-block px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium">
        ✗ 有不熟练
      </span>
    </div>

    <!-- 展开原文逐句判定 -->
    <div v-if="expanded" class="mb-6">
      <div
        v-for="(line, index) in poem.text"
        :key="index"
        class="flex items-center gap-2 py-3 border-b border-gray-100 last:border-b-0"
      >
        <span class="flex-1 text-lg">{{ line }}</span>
        <div class="flex gap-1 shrink-0">
          <button
            :class="['px-2 py-1 text-sm rounded border-2 cursor-pointer transition', lineStatuses[index].status === 'ok' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-400']"
            @click="setLineStatus(index, 'ok')"
          >✓</button>
          <button
            :class="['px-2 py-1 text-sm rounded border-2 cursor-pointer transition', lineStatuses[index].status === 'stuck' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 bg-white text-gray-400']"
            @click="setLineStatus(index, 'stuck')"
          >⏸</button>
          <button
            :class="['px-2 py-1 text-sm rounded border-2 cursor-pointer transition', lineStatuses[index].status === 'forgot' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
            @click="setLineStatus(index, 'forgot')"
          >✗</button>
        </div>
      </div>
    </div>

    <!-- 作者/朝代附加项 -->
    <div class="mb-6">
      <div class="flex gap-3 mb-3">
        <button
          v-if="!showAuthor"
          class="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-pointer hover:bg-gray-50 transition"
          @click="showAuthor = true; authorCorrect = null"
        >标记作者</button>
        <button
          v-if="!showDynasty"
          class="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-pointer hover:bg-gray-50 transition"
          @click="showDynasty = true; dynastyCorrect = null"
        >标记朝代</button>
      </div>

      <div v-if="showAuthor" class="flex items-center gap-2 mb-2">
        <span class="text-sm text-gray-600">作者（{{ poem.author }}）：</span>
        <button
          :class="['px-2 py-1 text-sm rounded border-2 cursor-pointer transition', authorCorrect === true ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-400']"
          @click="authorCorrect = true"
        >✓</button>
        <button
          :class="['px-2 py-1 text-sm rounded border-2 cursor-pointer transition', authorCorrect === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
          @click="authorCorrect = false"
        >✗</button>
      </div>

      <div v-if="showDynasty" class="flex items-center gap-2 mb-2">
        <span class="text-sm text-gray-600">朝代（{{ poem.dynasty }}）：</span>
        <button
          :class="['px-2 py-1 text-sm rounded border-2 cursor-pointer transition', dynastyCorrect === true ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-400']"
          @click="dynastyCorrect = true"
        >✓</button>
        <button
          :class="['px-2 py-1 text-sm rounded border-2 cursor-pointer transition', dynastyCorrect === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
          @click="dynastyCorrect = false"
        >✗</button>
      </div>
    </div>

    <!-- 提交 -->
    <button
      :disabled="!canSubmit"
      :class="['w-full p-4 rounded-lg text-lg font-medium cursor-pointer transition', canSubmit ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-gray-300 text-gray-500 cursor-not-allowed']"
      @click="submit"
    >
      下一首
    </button>
  </div>
</template>
```

- [ ] **Step 2: 提交**

```bash
git add src/components/RecitationCard.vue
git commit -m "feat: add RecitationCard component"
```

---

### Task 6: 新增抽背答题页面

**Files:**
- Create: `src/views/RecitationPlayPage.vue`

- [ ] **Step 1: 创建 RecitationPlayPage.vue**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import { usePoemStore } from '@/stores/poem'
import RecitationCard from '@/components/RecitationCard.vue'
import type { RecitationResult } from '@/types'

const router = useRouter()
const quizStore = useQuizStore()
const poemStore = usePoemStore()

const currentPoem = computed(() => {
  if (!quizStore.session || !quizStore.currentQuestion) return null
  return poemStore.getPoemById(quizStore.currentQuestion.poemId) ?? null
})

const progressPercent = computed(() =>
  quizStore.totalQuestions > 0
    ? (quizStore.currentIndex / quizStore.totalQuestions) * 100
    : 0
)

function onSubmit(result: RecitationResult) {
  quizStore.submitRecitationResult(result)
  if (quizStore.isFinished) {
    router.push({ name: 'recitation-result' })
  }
}
</script>

<template>
  <div class="recitation-play max-w-md mx-auto p-4">
    <template v-if="currentPoem && !quizStore.isFinished">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <p class="progress-text text-sm text-gray-500 text-center mb-4">
        第 {{ quizStore.currentIndex + 1 }} / {{ quizStore.totalQuestions }} 首
      </p>
      <RecitationCard :poem="currentPoem" @submit="onSubmit" />
    </template>
    <div v-else>
      <p>未开始抽背</p>
      <button @click="router.push({ name: 'home' })">返回首页</button>
    </div>
  </div>
</template>

<style scoped>
.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}
.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add src/views/RecitationPlayPage.vue
git commit -m "feat: add RecitationPlayPage"
```

---

### Task 7: 新增抽背结果页面

**Files:**
- Create: `src/views/RecitationResultPage.vue`

- [ ] **Step 1: 创建 RecitationResultPage.vue**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import { usePoemStore } from '@/stores/poem'
import type { RecitationResult } from '@/types'

const router = useRouter()
const quizStore = useQuizStore()
const poemStore = usePoemStore()

const results = computed(() => {
  if (!quizStore.session) return []
  return quizStore.session.recitationResults
})

const masteredCount = computed(() => results.value.filter(r => r.overallStatus === 'mastered').length)
const notMasteredCount = computed(() => results.value.filter(r => r.overallStatus === 'not-mastered').length)

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
  quizStore.resetSession()
  router.push({ name: 'home' })
}

function tryAgain() {
  quizStore.resetSession()
  router.push({ name: 'recitation-setup' })
}
</script>

<template>
  <div class="max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-4">抽背结果</h2>

    <div class="text-center mb-6">
      <div class="flex justify-center gap-6">
        <div>
          <div class="text-3xl font-bold text-green-500">{{ masteredCount }}</div>
          <div class="text-sm text-gray-500">熟练</div>
        </div>
        <div>
          <div class="text-3xl font-bold text-red-500">{{ notMasteredCount }}</div>
          <div class="text-sm text-gray-500">不熟练</div>
        </div>
      </div>
    </div>

    <div class="mb-6">
      <div v-for="result in results" :key="result.poemId" class="mb-2">
        <div
          :class="['p-3 rounded-lg border-l-4 cursor-pointer', result.overallStatus === 'mastered' ? 'bg-green-50 border-l-green-500' : 'bg-red-50 border-l-red-500']"
          @click="result.overallStatus === 'not-mastered' && toggleExpand(result.poemId)"
        >
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ getPoemTitle(result.poemId) }}</span>
            <span :class="['ml-auto text-lg font-bold', result.overallStatus === 'mastered' ? 'text-green-600' : 'text-red-500']">
              {{ result.overallStatus === 'mastered' ? '✓' : '✗' }}
            </span>
          </div>
        </div>

        <!-- 展开不熟练详情 -->
        <div v-if="expandedIds.has(result.poemId) && result.overallStatus === 'not-mastered'" class="ml-4 mt-1 p-3 bg-white rounded-lg border border-gray-100">
          <div v-for="line in result.lines" :key="line.lineIndex" class="flex items-center gap-2 py-1">
            <span class="text-sm text-gray-600">{{ getPoemText(result.poemId)[line.lineIndex] }}</span>
            <span :class="['text-xs px-2 py-0.5 rounded', line.status === 'stuck' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700']">
              {{ line.status === 'stuck' ? '卡顿' : '不会' }}
            </span>
          </div>
          <div v-if="result.authorCorrect === false" class="text-sm text-red-500 mt-1">作者不正确</div>
          <div v-if="result.dynastyCorrect === false" class="text-sm text-red-500 mt-1">朝代不正确</div>
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

- [ ] **Step 2: 提交**

```bash
git add src/views/RecitationResultPage.vue
git commit -m "feat: add RecitationResultPage"
```

---

### Task 8: 首页新增抽背入口

**Files:**
- Modify: `src/views/HomePage.vue`

- [ ] **Step 1: 在首页模式按钮区域新增"古诗抽背"按钮**

在 `src/views/HomePage.vue` 的 `<script setup>` 中添加路由跳转方法：

```typescript
function startRecitation() {
  router.push({ name: 'recitation-setup' })
}
```

在模板的 `<div class="grid grid-cols-2 gap-4 mb-6">` 中，将 `grid-cols-2` 改为 `grid-cols-3`，并在现有两个按钮后添加第三个按钮：

```html
<button class="mode-btn p-6 bg-white rounded-lg shadow hover:shadow-md transition" @click="startRecitation">
  <div class="text-3xl mb-2">📖</div>
  <div class="font-medium">古诗抽背</div>
</button>
```

- [ ] **Step 2: 验证页面正常显示**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 3: 提交**

```bash
git add src/views/HomePage.vue
git commit -m "feat: add recitation entry on home page"
```

---

### Task 9: 集成验证

**Files:**
- All modified/created files

- [ ] **Step 1: 运行 TypeScript 类型检查**

Run: `npx vue-tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 2: 运行构建**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 3: 启动开发服务器手动验证**

Run: `npm run dev`
验证：
1. 首页三个按钮（家长抽查、自主练习、古诗抽背）
2. 点击"古诗抽背" → 设置页 → 选择来源/数量 → 开始抽背
3. 逐首翻页：整首熟练一键 / 逐句判定 / 作者朝代标记
4. 全部完成后查看结果页汇总
5. 再来一轮 / 返回首页

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: complete poem recitation feature"
```
