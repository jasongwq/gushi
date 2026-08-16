# 抽卡式古诗切换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将家长抽查页面重新设计为抽卡模式——古诗以卡片形式横向排列，支持左右滑动切换和随机抽卡（洗牌动画），替代现有的逐首顺序抽查流程。

**Architecture:** 新建 `CardSwiper`（纯手写 Touch 事件 + CSS 动画的横向卡片滑动容器）和 `PoemCard`（收起只显示标题、点击揭示完整诗文+标记按钮的卡片组件），组合为 `PoemCardPage` 页面。家长抽查入口直接跳转到新页面，不再走 QuizSetupPage 的设置流程。

**Tech Stack:** Vue 3 Composition API, Tailwind CSS, 纯手写 Touch 事件 + CSS transform/transition

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/CardSwiper.vue` | Create | 横向卡片滑动容器：Touch 事件处理、惯性滑动、卡片缩放/透明度、洗牌动画 |
| `src/components/PoemCard.vue` | Create | 古诗卡片：收起(标题) / 展开(全文+标记) / 译文切换 |
| `src/views/PoemCardPage.vue` | Create | 抽卡页面：筛选栏 + CardSwiper + 底部工具栏 |
| `src/router/index.ts` | Modify | 添加 `poem-card` 路由 |
| `src/views/HomePage.vue` | Modify | 家长抽查入口改为跳转 `poem-card` |
| `src/views/QuizSetupPage.vue` | Modify | 家长模式的古诗抽背选项改为跳转 `poem-card` |

---

### Task 1: CardSwiper 组件

**Files:**
- Create: `src/components/CardSwiper.vue`

CardSwiper 是一个横向卡片滑动容器，接收一组卡片 slot，显示当前居中放大、两侧缩小预览的布局。支持触摸滑动、惯性滑动、边界回弹、洗牌动画。

- [ ] **Step 1: 创建 CardSwiper.vue 基础结构**

```vue
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  count: number
  modelValue: number
}>(), {
  count: 0,
  modelValue: 0,
})

const emit = defineEmits<{
  'update:modelValue': [index: number]
}>()

const currentIndex = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// 滑动状态
const containerRef = ref<HTMLElement | null>(null)
const offsetX = ref(0) // 当前拖拽偏移量 (px)
const isDragging = ref(false)
const isAnimating = ref(false)

// Touch 事件处理
let startX = 0
let startY = 0
let startTime = 0
let lastOffsetX = 0
let isHorizontal: boolean | null = null

function onTouchStart(e: TouchEvent) {
  if (isAnimating.value) return
  const touch = e.touches[0]
  startX = touch.clientX
  startY = touch.clientY
  startTime = Date.now()
  lastOffsetX = offsetX.value
  isDragging.value = true
  isHorizontal = null
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value) return
  const touch = e.touches[0]
  const dx = touch.clientX - startX
  const dy = touch.clientY - startY

  // 判断滑动方向（只判断一次）
  if (isHorizontal === null) {
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      isHorizontal = Math.abs(dx) > Math.abs(dy)
    }
    return
  }
  if (!isHorizontal) return

  e.preventDefault()
  offsetX.value = dx
}

function onTouchEnd() {
  if (!isDragging.value) return
  isDragging.value = false

  const velocity = Math.abs(offsetX.value) / (Date.now() - startTime)
  const threshold = containerRef.value ? containerRef.value.offsetWidth * 0.2 : 80

  if (Math.abs(offsetX.value) > threshold || velocity > 0.3) {
    if (offsetX.value < 0 && currentIndex.value < props.count - 1) {
      goTo(currentIndex.value + 1)
    } else if (offsetX.value > 0 && currentIndex.value > 0) {
      goTo(currentIndex.value - 1)
    } else {
      snapBack()
    }
  } else {
    snapBack()
  }
}

function snapBack() {
  offsetX.value = 0
}

function goTo(index: number) {
  isAnimating.value = true
  currentIndex.value = index
  offsetX.value = 0
  setTimeout(() => {
    isAnimating.value = false
  }, 350)
}

// 洗牌动画
const isShuffling = ref(false)

function shuffle() {
  if (isShuffling.value || props.count === 0) return
  isShuffling.value = true

  const targetIndex = Math.floor(Math.random() * props.count)
  const steps = 8 + Math.floor(Math.random() * 6) // 8-13 步
  let step = 0

  function animateStep() {
    if (step >= steps) {
      // 最后一步：跳到目标
      currentIndex.value = targetIndex
      offsetX.value = 0
      isShuffling.value = false
      return
    }

    // 来回快速移动
    const direction = step % 2 === 0 ? 1 : -1
    const jumpSize = Math.min(2, props.count - 1)
    let next = currentIndex.value + direction * jumpSize
    next = Math.max(0, Math.min(props.count - 1, next))
    currentIndex.value = next
    offsetX.value = 0

    step++
    // 速度递减：从 80ms 到 200ms
    const delay = 80 + (step / steps) * 120
    setTimeout(animateStep, delay)
  }

  animateStep()
}

// 计算卡片样式
function cardStyle(index: number) {
  const diff = index - currentIndex.value
  const dragRatio = containerRef.value ? offsetX.value / containerRef.value.offsetWidth : 0
  const effectiveDiff = diff - dragRatio

  const absDiff = Math.abs(effectiveDiff)
  const scale = absDiff === 0 ? 1 : absDiff === 1 ? 0.85 : 0.7
  const opacity = absDiff === 0 ? 1 : absDiff === 1 ? 0.6 : 0.3
  const translateX = effectiveDiff * 75 // 75% of card width spacing

  return {
    transform: `translateX(${translateX}%) scale(${scale})`,
    opacity: absDiff > 2 ? 0 : opacity,
    transition: isDragging.value ? 'none' : 'transform 0.35s ease, opacity 0.35s ease',
    zIndex: 10 - Math.round(absDiff),
    position: 'absolute' as const,
    left: '50%',
    top: '0',
    width: '80%',
    marginLeft: '-40%',
  }
}

defineExpose({ shuffle, goTo })
</script>

<template>
  <div
    ref="containerRef"
    class="card-swiper relative w-full overflow-hidden"
    style="touch-action: pan-y;"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div
      v-for="i in count"
      :key="i - 1"
      :style="cardStyle(i - 1)"
      class="card-swiper-item"
    >
      <slot :index="i - 1" />
    </div>
  </div>
</template>

<style scoped>
.card-swiper {
  height: 100%;
}
.card-swiper-item {
  height: 100%;
}
</style>
```

- [ ] **Step 2: 验证 CardSwiper 组件可被导入无报错**

Run: `cd /root/古诗抽查 && npx vue-tsc --noEmit 2>&1 | head -20`

Expected: 无 CardSwiper 相关错误（可能有其他文件的已有错误）

- [ ] **Step 3: Commit**

```bash
git add src/components/CardSwiper.vue
git commit -m "feat: add CardSwiper component with touch swipe and shuffle animation"
```

---

### Task 2: PoemCard 组件

**Files:**
- Create: `src/components/PoemCard.vue`

古诗卡片组件：收起状态只显示标题，点击后一次性揭示作者/朝代/全文/标记按钮。每行有"卡顿/不会"标记，滑走时自动保存。

- [ ] **Step 1: 创建 PoemCard.vue**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Poem, RecitationResult } from '@/types'
import { useLearningStore } from '@/stores/learning'

const props = defineProps<{
  poem: Poem
  checked?: boolean
}>()

const emit = defineEmits<{
  checkedChange: [result: RecitationResult]
}>()

const learningStore = useLearningStore()

// 展开/收起状态
const expanded = ref(false)

// 译文
const showYiwen = ref(learningStore.settings.showYiwen ?? false)

// 每行标记状态
const lineStatuses = ref<{ lineIndex: number; status: 'ok' | 'stuck' | 'forgot' }[]>(
  props.poem.text.map((_, i) => ({ lineIndex: i, status: 'ok' as const }))
)
const authorCorrect = ref<boolean | null>(null)
const dynastyCorrect = ref<boolean | null>(null)

// 当 poem 变化时重置状态
watch(() => props.poem.id, () => {
  expanded.value = false
  lineStatuses.value = props.poem.text.map((_, i) => ({ lineIndex: i, status: 'ok' as const }))
  authorCorrect.value = null
  dynastyCorrect.value = null
  showYiwen.value = learningStore.settings.showYiwen ?? false
})

function toggleExpand() {
  expanded.value = !expanded.value
}

function toggleYiwen() {
  showYiwen.value = !showYiwen.value
  learningStore.updateSettings({ showYiwen: showYiwen.value })
}

function setLineStatus(index: number, status: 'ok' | 'stuck' | 'forgot') {
  lineStatuses.value[index] = { lineIndex: index, status }
}

function toggleAuthorCorrect() {
  if (authorCorrect.value === null) authorCorrect.value = false
  else if (authorCorrect.value === false) authorCorrect.value = true
  else authorCorrect.value = null
}

function toggleDynastyCorrect() {
  if (dynastyCorrect.value === null) dynastyCorrect.value = false
  else if (dynastyCorrect.value === false) dynastyCorrect.value = true
  else dynastyCorrect.value = null
}

// 获取当前标记结果（滑走时调用）
function getResult(): RecitationResult {
  const hasAnyIssue = lineStatuses.value.some(l => l.status !== 'ok')
    || authorCorrect.value === false
    || dynastyCorrect.value === false

  return {
    poemId: props.poem.id,
    overallStatus: hasAnyIssue ? 'not-mastered' : 'mastered',
    lines: hasAnyIssue ? lineStatuses.value.filter(l => l.status !== 'ok') : [],
    authorCorrect: authorCorrect.value,
    dynastyCorrect: dynastyCorrect.value,
  }
}

defineExpose({ getResult, expanded })
</script>

<template>
  <div class="poem-card h-full flex flex-col bg-white rounded-2xl shadow-lg overflow-hidden" @click="toggleExpand">
    <!-- 收起状态：只显示标题 -->
    <div v-if="!expanded" class="flex-1 flex items-center justify-center p-6">
      <h2 class="text-2xl font-bold text-center">{{ poem.title }}</h2>
    </div>

    <!-- 展开状态：完整诗文 + 标记 -->
    <div v-else class="flex-1 flex flex-col overflow-y-auto p-5" @click.stop>
      <div class="text-center mb-4">
        <h2 class="text-xl font-bold mb-1">{{ poem.title }}</h2>
        <p class="text-gray-500 text-sm">{{ poem.dynasty }} · {{ poem.author }}</p>
      </div>

      <!-- 逐行标记 -->
      <div class="flex-1 mb-4">
        <div
          v-for="(line, index) in poem.text"
          :key="index"
          class="flex items-center gap-2 py-2 border-b border-gray-100 last:border-b-0"
        >
          <span :class="['flex-1 text-base leading-relaxed', lineStatuses[index].status === 'forgot' ? 'text-red-400' : lineStatuses[index].status === 'stuck' ? 'text-yellow-600' : '']">{{ line }}</span>
          <div class="flex gap-1 shrink-0">
            <button
              :class="['px-1.5 py-0.5 text-xs rounded border cursor-pointer transition', lineStatuses[index].status === 'stuck' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 bg-white text-gray-400']"
              @click.stop="setLineStatus(index, lineStatuses[index].status === 'stuck' ? 'ok' : 'stuck')"
            >卡顿</button>
            <button
              :class="['px-1.5 py-0.5 text-xs rounded border cursor-pointer transition', lineStatuses[index].status === 'forgot' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
              @click.stop="setLineStatus(index, lineStatuses[index].status === 'forgot' ? 'ok' : 'forgot')"
            >不会</button>
          </div>
        </div>
      </div>

      <!-- 译文 -->
      <div class="text-center mb-3">
        <button
          :class="['px-3 py-1 text-xs rounded-lg border-2 cursor-pointer transition', showYiwen ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-indigo-200 bg-indigo-50 text-indigo-600']"
          @click.stop="toggleYiwen"
        >
          {{ showYiwen ? '隐藏译文 ▴' : '显示译文 ▾' }}
        </button>
      </div>
      <div v-if="showYiwen" class="mb-3 p-3 bg-gray-50 rounded-lg text-center">
        <p class="text-sm leading-relaxed text-gray-500">{{ poem.yiwen }}</p>
      </div>

      <!-- 作者/朝代标记 -->
      <div class="flex items-center gap-4 justify-center">
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">{{ poem.author }}</span>
          <button
            :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', authorCorrect === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
            @click.stop="toggleAuthorCorrect"
          >不会</button>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">{{ poem.dynasty }}</span>
          <button
            :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', dynastyCorrect === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
            @click.stop="toggleDynastyCorrect"
          >不会</button>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 验证 PoemCard 组件可被导入无报错**

Run: `cd /root/古诗抽查 && npx vue-tsc --noEmit 2>&1 | head -20`

Expected: 无 PoemCard 相关错误

- [ ] **Step 3: Commit**

```bash
git add src/components/PoemCard.vue
git commit -m "feat: add PoemCard component with expand/collapse and line marking"
```

---

### Task 3: PoemCardPage 页面

**Files:**
- Create: `src/views/PoemCardPage.vue`

抽查页面：顶部筛选栏 + CardSwiper + 底部工具栏。从 poemStore 获取古诗列表，筛选后生成卡片数组，滑动/抽卡切换当前索引，滑走时自动保存标记结果。

- [ ] **Step 1: 创建 PoemCardPage.vue**

```vue
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import CardSwiper from '@/components/CardSwiper.vue'
import PoemCard from '@/components/PoemCard.vue'
import type { RecitationResult, SourceType } from '@/types'
import { smartMix, getPoemsBySource, getReviewPoems, getWrongPoems, getUnproficientPoems, shuffleArray } from '@/utils/quiz'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

onMounted(() => poemStore.fetchPoems())

// 筛选
const source = ref<SourceType>('all')
const selectedGrades = ref<string[]>([])

const sourceOptions: { value: SourceType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'smart', label: '智能混合' },
  { value: 'grade', label: '按年级' },
  { value: 'review', label: '待复习' },
  { value: 'wrong', label: '错题本' },
  { value: 'unproficient', label: '不熟练' },
]

const showGradeSelector = computed(() => source.value === 'grade')

function toggleGrade(grade: string) {
  const idx = selectedGrades.value.indexOf(grade)
  if (idx >= 0) selectedGrades.value.splice(idx, 1)
  else selectedGrades.value.push(grade)
}

// 当前古诗列表
const today = new Date().toISOString().split('T')[0]

const poems = computed(() => {
  const enabled = poemStore.enabledPoems
  if (source.value === 'all') return enabled
  if (source.value === 'smart') return shuffleArray(enabled)
  if (source.value === 'grade') return enabled.filter(p => selectedGrades.value.includes(p.grade))
  if (source.value === 'review') return getReviewPoems(enabled, learningStore.records, today)
  if (source.value === 'wrong') return getWrongPoems(enabled, learningStore.wrongBook)
  if (source.value === 'unproficient') return getUnproficientPoems(enabled, learningStore.records)
  return enabled
})

// 当前卡片索引
const currentIndex = ref(0)

// 已抽查过的诗 ID 集合
const checkedPoemIds = ref(new Set<string>())

// PoemCard refs
const poemCardRefs = ref<InstanceType<typeof PoemCard>[]>([])

// 当前诗
const currentPoem = computed(() => poems.value[currentIndex.value] ?? null)

// 索引变化时，保存上一首诗的标记结果
let prevIndex = 0
watch(currentIndex, (newIdx, oldIdx) => {
  if (oldIdx !== undefined && oldIdx < poems.value.length) {
    const prevPoem = poems.value[oldIdx]
    if (prevPoem) {
      const card = poemCardRefs.value[oldIdx]
      if (card && card.expanded) {
        const result = card.getResult()
        saveResult(result)
      }
    }
  }
  prevIndex = newIdx
})

function saveResult(result: RecitationResult) {
  checkedPoemIds.value.add(result.poemId)

  if (result.overallStatus === 'mastered') {
    learningStore.recordAnswer(result.poemId, 'recite', true)
  } else {
    learningStore.recordAnswer(result.poemId, 'recite', false)
    for (const line of result.lines) {
      if (line.status === 'stuck' || line.status === 'forgot') {
        learningStore.recordAnswer(result.poemId, 'recite', false, `第${line.lineIndex + 1}句:${line.status}`)
      }
    }
  }
  if (result.authorCorrect === false) {
    learningStore.recordAnswer(result.poemId, 'author', false)
  }
  if (result.dynastyCorrect === false) {
    learningStore.recordAnswer(result.poemId, 'dynasty', false)
  }
}

// 随机抽卡
const swiperRef = ref<InstanceType<typeof CardSwiper> | null>(null)

function shuffleCards() {
  swiperRef.value?.shuffle()
}

// 统计
const checkedCount = computed(() => checkedPoemIds.value.size)
const totalCount = computed(() => poems.value.length)
</script>

<template>
  <div class="poem-card-page max-w-md mx-auto h-screen flex flex-col bg-gray-50">
    <!-- 顶部筛选栏 -->
    <div class="p-3 bg-white border-b border-gray-100">
      <div class="flex items-center gap-2 mb-2">
        <button class="text-gray-400 text-sm" @click="router.push({ name: 'home' })">← 返回</button>
        <span class="text-sm text-gray-500 ml-auto">已查 {{ checkedCount }} / {{ totalCount }} 首</span>
      </div>
      <div class="flex gap-2 overflow-x-auto pb-1">
        <button
          v-for="opt in sourceOptions"
          :key="opt.value"
          :class="['px-3 py-1.5 text-xs rounded-full border whitespace-nowrap cursor-pointer transition', source === opt.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500']"
          @click="source = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
      <div v-if="showGradeSelector" class="flex flex-wrap gap-2 mt-2">
        <button
          v-for="grade in poemStore.grades"
          :key="grade"
          :class="['px-2 py-1 text-xs rounded border cursor-pointer transition', selectedGrades.includes(grade) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-400']"
          @click="toggleGrade(grade)"
        >
          {{ grade }}
        </button>
      </div>
    </div>

    <!-- 卡片区域 -->
    <div class="flex-1 min-h-0 p-4">
      <CardSwiper v-if="poems.length > 0" ref="swiperRef" v-model="currentIndex" :count="poems.length">
        <template #default="{ index }">
          <PoemCard
            :ref="(el: any) => { if (el) poemCardRefs[index] = el }"
            :poem="poems[index]"
            :checked="checkedPoemIds.has(poems[index].id)"
          />
        </template>
      </CardSwiper>
      <div v-else class="h-full flex items-center justify-center text-gray-400">
        没有符合条件的古诗
      </div>
    </div>

    <!-- 底部工具栏 -->
    <div class="p-4 bg-white border-t border-gray-100">
      <button
        :disabled="poems.length === 0"
        :class="['w-full py-3 rounded-xl text-base font-medium cursor-pointer transition', poems.length > 0 ? 'bg-indigo-500 text-white hover:bg-indigo-600 active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed']"
        @click="shuffleCards"
      >
        🎲 随机抽卡
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 验证 PoemCardPage 组件可被导入无报错**

Run: `cd /root/古诗抽查 && npx vue-tsc --noEmit 2>&1 | head -20`

Expected: 无 PoemCardPage 相关错误

- [ ] **Step 3: Commit**

```bash
git add src/views/PoemCardPage.vue
git commit -m "feat: add PoemCardPage with card swiper and shuffle"
```

---

### Task 4: 路由与入口更新

**Files:**
- Modify: `src/router/index.ts:8-24`
- Modify: `src/views/HomePage.vue:11-13`
- Modify: `src/views/QuizSetupPage.vue:88-102`

- [ ] **Step 1: 在 router/index.ts 添加 poem-card 路由**

在 `routes` 数组中，`recite` 路由之前添加：

```typescript
  { path: '/poem-card', name: 'poem-card', component: () => import('@/views/PoemCardPage.vue') },
```

- [ ] **Step 2: 修改 HomePage.vue，家长抽查入口改为跳转 poem-card**

将 `startQuiz('parent')` 的路由从 `quiz-setup?mode=parent` 改为 `poem-card`：

```vue
<button class="mode-btn p-6 bg-white rounded-lg shadow hover:shadow-md transition" @click="router.push({ name: 'poem-card' })">
```

同时删除 `startQuiz` 函数中不再需要的 parent 逻辑（如果 `startQuiz` 仍被 self 模式使用则保留）。

- [ ] **Step 3: 修改 QuizSetupPage.vue，家长模式的古诗抽背跳转 poem-card**

在 `startQuiz()` 函数中，当 `quizTypes.value.includes('recite')` 时，如果 `isParentMode` 为 true，跳转到 `poem-card` 而非 `recitation-play`：

```typescript
if (quizTypes.value.includes('recite')) {
  if (isParentMode.value) {
    router.push({ name: 'poem-card' })
    return
  }
  // ... 原有 recitation 逻辑
}
```

- [ ] **Step 4: 验证编译通过**

Run: `cd /root/古诗抽查 && npx vue-tsc --noEmit 2>&1 | head -20`

Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/router/index.ts src/views/HomePage.vue src/views/QuizSetupPage.vue
git commit -m "feat: route parent quiz to new PoemCardPage"
```

---

### Task 5: 手动验证与调优

**Files:**
- Possibly modify: `src/components/CardSwiper.vue`
- Possibly modify: `src/components/PoemCard.vue`
- Possibly modify: `src/views/PoemCardPage.vue`

- [ ] **Step 1: 启动开发服务器**

Run: `cd /root/古诗抽查 && npm run dev`

- [ ] **Step 2: 在浏览器中测试以下场景**

1. 首页点"家长抽查" → 应进入 PoemCardPage
2. 卡片只显示标题 → 点击展开显示全文+标记
3. 左右滑动切换卡片 → 惯性滑动和回弹正常
4. 点击"随机抽卡" → 洗牌动画后停在随机一张
5. 标记后滑走 → 结果自动保存
6. 筛选栏切换 → 卡片列表更新
7. 边界：首尾卡片无法继续滑动

- [ ] **Step 3: 根据测试结果调整参数**

可能需要调整的参数：
- CardSwiper 中的 `translateX` 间距（`75%`）
- 滑动阈值（`0.2` 和 `0.3`）
- 动画时长（`0.35s`）
- 洗牌动画步数和速度

- [ ] **Step 4: Commit 调优**

```bash
git add -A
git commit -m "fix: tune card swiper animation and interaction parameters"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ 卡片收起只显示标题 → Task 2 PoemCard
- ✅ 点击展开一次性揭示全文+标记 → Task 2 PoemCard
- ✅ 横向滚动卡片组，中间大两侧小 → Task 1 CardSwiper
- ✅ 左右滑动切换 → Task 1 CardSwiper touch events
- ✅ 洗牌动画随机抽卡 → Task 1 CardSwiper shuffle + Task 3 button
- ✅ 滑走自动保存标记 → Task 3 watch currentIndex
- ✅ 不需要完成按钮 → Task 2 no submit button
- ✅ 筛选栏年级/来源 → Task 3 PoemCardPage
- ✅ 统计已查/总数 → Task 3 PoemCardPage
- ✅ 不区分家长/自背模式 → Task 2/3 unified
- ✅ 家长抽查入口跳转新页面 → Task 4

**Placeholder scan:** No TBD/TODO/placeholders found.

**Type consistency:** All types match (`RecitationResult`, `Poem`, `SourceType`, `QuizType`).
