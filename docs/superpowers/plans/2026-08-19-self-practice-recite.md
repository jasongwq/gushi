# 自助练习「古诗背诵」题型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在自助练习的题型中新增「古诗背诵」，卡片默认仅显示标题，点击依次揭示 作者 → 译文 → 正文，揭示完整后可自评「熟练/完全不会」，与选择题同场混排并统一计入结果页。

**Architecture:** 复用现有 `RecitationCard` 组件，增加 `revealMode`/`revealStep` 揭示支持（家长抽查行为不变）。`quiz.ts` 的 `generateQuestion` 新增 `recite` case，使 `startQuiz` 能生成背诵题。`submitRecitationResult` 在推进前推 `answers` 条目，统一圆点/计分/结果页。`QuizSetupPage` 自助模式增加「古诗背诵」选项并走混排 `startQuiz`。

**Tech Stack:** Vue 3 (script setup + TS), Pinia, Vue Router, Vitest (@vue/test-utils), Playwright, Tailwind。

**关联 spec:** `docs/superpowers/specs/2026-08-19-self-practice-recite-design.md`

---

### Task 1: `RecitationCard` 揭示模式（单元测试先行）

**Files:**
- Modify: `src/components/RecitationCard.vue`
- Test: `tests/unit/RecitationCard.test.ts`

本任务让 `RecitationCard` 支持 `revealMode`，通过 `revealStep` 控制各区块显隐，点击卡片空白处触发 `reveal-step-change`。

- [ ] **Step 1: 写失败测试** — 追加到 `tests/unit/RecitationCard.test.ts`（在 `describe('RecitationCard', ...)` 内部末尾新增 `describe('revealMode', ...)`）。同时扩展 `mountCard` helper 的 props 类型以支持新 prop：

```ts
function mountCard(props?: Partial<{ poem: Poem; canGoPrev: boolean; revealMode: boolean; revealStep: number }>) {
  return mount(RecitationCard, {
    props: { poem: mockPoem, ...props },
    global: { stubs: {} },
  })
}
```

新增测试：

```ts
describe('revealMode', () => {
  const mountReveal = (step = 0, canGoPrev = false) =>
    mountCard({ revealMode: true, revealStep: step, canGoPrev })

  it('step 0: only title shown, no author/yiwen/text/self-assess', () => {
    const wrapper = mountReveal(0)
    expect(wrapper.text()).toContain('静夜思')
    expect(wrapper.text()).not.toContain('李白')
    expect(wrapper.text()).not.toContain('翻译内容')
    expect(wrapper.text()).not.toContain('床前明月光')
    // 自评按钮不可见
    expect(wrapper.text()).not.toContain('熟练')
    expect(wrapper.text()).not.toContain('完全不会')
  })

  it('step 1: author revealed, text/yiwen still hidden', () => {
    const wrapper = mountReveal(1)
    expect(wrapper.text()).toContain('李白')
    expect(wrapper.text()).toContain('唐')
    expect(wrapper.text()).not.toContain('翻译内容')
    expect(wrapper.text()).not.toContain('床前明月光')
    expect(wrapper.text()).not.toContain('熟练')
  })

  it('step 2: yiwen revealed directly, text still hidden', () => {
    const wrapper = mountReveal(2)
    expect(wrapper.text()).toContain('翻译内容')
    expect(wrapper.text()).not.toContain('床前明月光')
    expect(wrapper.text()).not.toContain('熟练')
  })

  it('step 3: full text and self-assess buttons visible', () => {
    const wrapper = mountReveal(3)
    expect(wrapper.text()).toContain('床前明月光')
    expect(wrapper.text()).toContain('熟练')
    expect(wrapper.text()).toContain('完全不会')
  })

  it('clicking card background emits reveal-step-change', async () => {
    const wrapper = mountReveal(0)
    // 点击标题区（非按钮）
    await wrapper.find('.recitation-card h2').trigger('click')
    expect(wrapper.emitted('reveal-step-change')).toHaveLength(1)
  })

  it('clicking a button does not emit reveal-step-change', async () => {
    const wrapper = mountReveal(3)
    const masteredBtn = getMasteredButton(wrapper)
    await masteredBtn.trigger('click')
    expect(wrapper.emitted('reveal-step-change')).toBeUndefined()
  })

  it('submit still works in revealMode step 3', async () => {
    const wrapper = mountReveal(3)
    await getMasteredButton(wrapper).trigger('click')
    const result = wrapper.emitted('submit')![0][0] as any
    expect(result.overallStatus).toBe('mastered')
  })

  it('step 0 shows dashed border box and hint 点击查看作者', () => {
    const wrapper = mountReveal(0)
    const card = wrapper.find('.recitation-card')
    expect(card.classes().join(' ')).toContain('reveal-dashed')
    expect(wrapper.text()).toContain('点击查看作者')
  })

  it('hint text updates per reveal step', () => {
    expect(mountReveal(0).text()).toContain('点击查看作者')
    expect(mountReveal(1).text()).toContain('点击查看译文')
    expect(mountReveal(2).text()).toContain('点击查看正文')
    expect(mountReveal(3).text()).not.toContain('点击查看')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/RecitationCard.test.ts`
Expected: FAIL —— 新用例中 `revealMode` prop 未定义导致 mount 报 prop 类型警告或揭示逻辑不生效（`李白` 在 step 0 出现）。

- [ ] **Step 3: 实现 revealMode**

修改 `src/components/RecitationCard.vue`：

1. **props 定义**（第 7-10 行附近）：

```ts
const props = defineProps<{
  poem: Poem
  canGoPrev?: boolean
  revealMode?: boolean
  revealStep?: number
}>()

const emit = defineEmits<{
  submit: [result: RecitationResult]
  goPrev: []
  revealStepChange: []
}>()
```

2. **揭示辅助计算**（script 内）：

```ts
// 揭示模式：当前揭示层（父组件控制，review 时传 3）
const revealStep = computed(() => {
  if (!props.revealMode) return 3 // 非揭示模式一切照常
  return Math.max(0, Math.min(3, props.revealStep ?? 0))
})

function handleBackgroundClick() {
  if (!props.revealMode) return
  if (revealStep.value >= 3) return
  emit('revealStepChange')
}
```

3. **模板修改**：

- 根节点 `div.recitation-card` 加 `@click="handleBackgroundClick"`（第 116 行），并在 revealMode 且未揭示完整时加虚线框 class：

```html
<div
  class="recitation-card py-2 w-full flex flex-col h-full"
  :class="{ 'reveal-dashed': revealMode && revealStep < 3 }"
  @click="handleBackgroundClick"
>
```

  样式（`<style scoped>` 内）：

```css
.reveal-dashed {
  border: 2px dashed var(--color-primary, #6366f1);
  border-radius: 12px;
  padding: 16px;
  background: #fafbff;
  cursor: pointer;
  transition: border-color 0.2s;
}
```

- 底部（自评按钮区之后）加按层提示文案，仅 revealMode 且 step < 3 时显示：

```html
<div v-if="revealMode && revealStep < 3" class="text-center text-indigo-500 text-sm mt-3 shrink-0">
  {{ revealHint }}
</div>
```

  script 中：

```ts
const revealHint = computed(() => {
  if (!props.revealMode) return ''
  switch (revealStep.value) {
    case 0: return '点击查看作者'
    case 1: return '点击查看译文'
    case 2: return '点击查看正文'
    default: return ''
  }
})
```
- 标题区（第 117-134 行）：作者行外层包一层，用 `v-if="revealStep >= 1"` 控制；step 0 时显示占位文本：

```html
<div class="text-center mb-4 shrink-0">
  <h2 class="text-2xl font-bold mb-1">{{ poem.title }}</h2>
  <div v-if="revealStep >= 1" class="flex items-center justify-center gap-4 text-gray-500 text-sm">
    <span>{{ poem.dynasty }} · {{ poem.author }}</span>
    <div class="flex items-center gap-2">
      <button
        data-testid="btn-author-forgot"
        :class="[...现有...]"
        @click.stop="toggleAuthorCorrect"
      >不会</button>
      <button
        data-testid="btn-dynasty-forgot"
        :class="[...现有...]"
        @click.stop="toggleDynastyCorrect"
      >不会</button>
    </div>
  </div>
  <p v-else class="text-gray-400 text-sm mt-1">作者 · ？？</p>
</div>
```

  注意：作者/朝代「不会」按钮加 `@click.stop`，防止触发背景点击揭示。

- 正文滚动区（第 138 行 `data-scroll-area` div）加 `v-if="revealStep >= 3"`。
- 译文按钮（第 171-177 行）与译文区块（第 178-180 行）：外层包 `v-if="revealStep >= 2"`。**揭示模式下译文直接显示**（不依赖 `showYiwen` 开关）：

```html
<div v-if="revealStep >= 2" class="mb-3 text-center">
  <p class="text-sm leading-relaxed text-gray-500 p-3 bg-gray-50 rounded-lg">{{ poem.yiwen }}</p>
</div>
```

  原文的「显示/隐藏译文」按钮仅在非 revealMode 时保留（`v-if="!revealMode"`），因为揭示模式第 2 层已直接显示译文。

- 操作按钮区「熟练/完全不会」（第 184-199 行）：加 `v-if="revealStep >= 3"`。
- 上一首/下一首（第 202-213 行）：仅非 revealMode 时显示（`v-if="!revealMode"`），自助练习队列由圆点导航。
- 卡顿/不会按钮（每行，第 157-165 行）和字级标记 span（第 148-153 行）：加 `@click.stop`（字级标记 span 已有 `@click`，需加 `.stop`）。译文/自评按钮同理加 `.stop` 或由外层 `v-if` 保证（在 step 3 时点击自评按钮不应触发背景点击）。

  具体：给行内「卡顿」「不会」按钮、字级标记 span、熟练/完全不会按钮都加 `@click.stop`。

- `submitResult` 的 `@click.stop` 确保提交后不会额外触发背景揭示。

- **watch poem.id 重置**（第 45-52 行）：revealMode 下重置时也复位 `showYiwen` 等，无需改动（父组件负责 revealStep 重置）。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/RecitationCard.test.ts`
Expected: PASS —— 全部用例（含原有非 revealMode 用例）通过。

- [ ] **Step 5: Commit**

```bash
git add src/components/RecitationCard.vue tests/unit/RecitationCard.test.ts
git commit -m "feat: RecitationCard revealMode with stepwise reveal"
```

---

### Task 2: `generateQuestion` 支持 recite + `startQuiz` 混排

**Files:**
- Modify: `src/stores/quiz.ts:98-142`
- Test: `tests/unit/quiz-store-full.test.ts`

- [ ] **Step 1: 写失败测试** — 追加到 `tests/unit/quiz-store-full.test.ts`：

```ts
describe('startQuiz with recite type', () => {
  it('generates recite questions in mixed queue', () => {
    const store = useQuizStore()
    const result = store.startQuiz('all', ['recite', 'fillBlank'], 2)
    expect(result).toBe(true)
    expect(store.session!.mode).toBe('quiz')
    const reciteQ = store.session!.questions.filter(q => q.quizType === 'recite')
    const fillQ = store.session!.questions.filter(q => q.quizType === 'fillBlank')
    expect(reciteQ.length).toBeGreaterThan(0)
    expect(fillQ.length).toBeGreaterThan(0)
    // recite 题目结构
    const first = reciteQ[0]
    expect(first.options).toEqual([])
    expect(first.correctIndex).toBe(0)
    expect(first.prompt.length).toBeGreaterThan(0)
  })

  it('recite-only queue still uses quiz mode', () => {
    const store = useQuizStore()
    const result = store.startQuiz('all', ['recite'], 3)
    expect(result).toBe(true)
    expect(store.session!.mode).toBe('quiz')
    expect(store.session!.questions.every(q => q.quizType === 'recite')).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/quiz-store-full.test.ts`
Expected: FAIL —— `startQuiz('all', ['recite', 'fillBlank'], 2)` 目前 `generateQuestion` 把 recite fallback 为 nextLine，无 recite 题目。

- [ ] **Step 3: 实现**

在 `src/stores/quiz.ts` 的 `generateQuestion` switch 中、`default` 之前新增：

```ts
case 'recite': {
  return {
    poemId: poem.id,
    quizType: 'recite',
    prompt: poem.title,
    options: [],
    correctIndex: 0,
  }
}
```

`generateQuestions`（第 85-96 行）已遍历 quizTypes 并为每首诗每个题型生成一题，`shuffleArray` 已混排，无需其他改动。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/quiz-store-full.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/quiz.ts tests/unit/quiz-store-full.test.ts
git commit -m "feat: generate recite questions for mixed quiz"
```

---

### Task 3: `submitRecitationResult` 同步推 answers 条目

**Files:**
- Modify: `src/stores/quiz.ts:224-250`
- Test: `tests/unit/quiz-store-full.test.ts`

- [ ] **Step 1: 写失败测试** — 追加到 `describe('submitRecitationResult', ...)`（第 180-217 行）内：

```ts
it('pushes an answers entry for unified dots/score', () => {
  const store = useQuizStore()
  store.startRecitation('all', 3)
  const poemId = store.currentQuestion!.poemId
  store.submitRecitationResult({
    poemId,
    overallStatus: 'mastered',
    lines: [],
    authorCorrect: null,
    dynastyCorrect: null,
    charMarks: {},
  })
  expect(store.session!.answers).toHaveLength(1)
  expect(store.session!.answers[0].questionIndex).toBe(0)
  expect(store.session!.answers[0].correct).toBe(true)
  // 下一个背诵结果 correct=false
  const poemId2 = store.currentQuestion!.poemId
  store.submitRecitationResult({
    poemId: poemId2,
    overallStatus: 'not-mastered',
    lines: [{ lineIndex: 0, status: 'forgot' }],
    authorCorrect: false,
    dynastyCorrect: false,
    charMarks: {},
  })
  expect(store.session!.answers).toHaveLength(2)
  expect(store.session!.answers[1].correct).toBe(false)
  expect(store.session!.answers[1].questionIndex).toBe(1)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/quiz-store-full.test.ts`
Expected: FAIL —— `answers` 长度为 0。

- [ ] **Step 3: 实现**

修改 `src/stores/quiz.ts` 的 `submitRecitationResult`，在 `currentIndex++` **之前**（第 248 行前）插入：

```ts
// 混排统一：背诵题也推一条 answers 条目，使进度圆点/计分/结果页统一工作
session.value.answers.push({
  questionIndex: session.value.currentIndex,
  selectedIndex: 0, // recite 无选项，占位
  correct: result.overallStatus === 'mastered',
})
```

- [ ] **Step 4: 运行测试确认通过 + 全量单测**

Run: `npx vitest run tests/unit/quiz-store-full.test.ts tests/unit/quiz-store.test.ts`
Expected: PASS

Run: `npx vitest run`（全量单测）
Expected: PASS —— 确认现有 `goToPrevRecitation` 测试（第 266-290 行）等仍通过。注意：`goToPrevRecitation` 删除的是 `recitationResults` 条目，answers 条目保留（与选择题回顾一致：已答题目圆点仍显示状态）。若该逻辑导致问题（如回退后 answers 多于实际），可接受——选择题 answerQuestion 也无法撤销，行为一致。

- [ ] **Step 5: Commit**

```bash
git add src/stores/quiz.ts tests/unit/quiz-store-full.test.ts
git commit -m "feat: push answers entry on recitation submit for mixed scoring"
```

---

### Task 4: `QuizSetupPage` 自助模式增加「古诗背诵」

**Files:**
- Modify: `src/views/QuizSetupPage.vue`
- Test: `tests/e2e/quiz-flow.spec.ts`（e2e 由 Task 7 覆盖；此处单元层面验证选项渲染）

- [ ] **Step 1: 修改选项与流程**

`src/views/QuizSetupPage.vue`：

1. `selfQuizTypeOptions`（第 56-59 行）增加：

```ts
const selfQuizTypeOptions: { value: QuizType; label: string }[] = [
  { value: 'fillBlank', label: '补字选择' },
  { value: 'nextLine', label: '上下句接龙' },
  { value: 'recite', label: '古诗背诵' },
]
```

2. `startQuiz`（第 89-121 行）修改：

```ts
function startQuiz() {
  if (!canStart.value) return
  errorMsg.value = ''
  const grades = source.value === 'grade' ? selectedGrades.value : undefined

  // 家长模式下若勾选了古诗抽背，跳转到抽卡页面（保留现状）
  if (isParentMode.value && quizTypes.value.includes('recite')) {
    router.push({ name: 'poem-card' })
    return
  }

  // 自助练习：走统一混排流程（startQuiz 现可生成 recite 题目）
  const success = quizStore.startQuiz(source.value, quizTypes.value, count.value, grades)
  if (!success) {
    errorMsg.value = '没有符合条件的题目，请调整设置'
    return
  }
  router.push({ name: 'quiz-play' })
}
```

  删除原第 100-121 行的「如果选中了古诗抽背，走背诵流程」和「否则走普通测验流程」两个分支。

3. 注意 `parentQuizTypes`/`selfQuizTypes` 逻辑不变，家长模式 checkbox 数量仍是 2（recite + nextLine）。

- [ ] **Step 2: 验证编译与现有 e2e**

Run: `npx vue-tsc -b`（typecheck）
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: 手动冒烟（可跳过，e2e 覆盖）**

Run: `npm run dev` 后在浏览器打开 `/#/quiz/setup?mode=self`，确认出现「古诗背诵」checkbox。

- [ ] **Step 4: Commit**

```bash
git add src/views/QuizSetupPage.vue
git commit -m "feat: add recite option to self quiz setup"
```

---

### Task 5: `QuizPlayPage` 渲染背诵题

**Files:**
- Modify: `src/views/QuizPlayPage.vue`
- Test: `tests/component/QuizPlayPage.test.ts`

- [ ] **Step 1: 写失败测试** — 追加到 `tests/component/QuizPlayPage.test.ts`：

```ts
describe('recite questions in mixed queue', () => {
  const reciteSession = (overrides: Partial<QuizSession> = {}): QuizSession => ({
    source: 'all',
    quizTypes: ['recite', 'fillBlank'],
    questions: [
      { poemId: 'p1', quizType: 'recite', prompt: '静夜思', options: [], correctIndex: 0 },
      { poemId: 'p2', quizType: 'fillBlank', prompt: '春眠不觉晓\n处处闻啼鸟', options: ['晓', '鸟', '花', '月', '风', '雨'], correctIndex: 0, blankPositions: [4] },
    ],
    currentIndex: 0,
    answers: [],
    startTime: '2026-01-01T00:00:00.000Z',
    mode: 'quiz',
    recitationResults: [],
    ...overrides,
  })

  it('renders RecitationCard in revealMode for recite question', () => {
    const wrapper = mountWithSession(reciteSession())
    expect(wrapper.findComponent({ name: 'RecitationCard' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'RecitationCard' }).props('revealMode')).toBe(true)
  })

  it('recite question submit pushes answer and advances', async () => {
    const wrapper = mountWithSession(reciteSession())
    const card = wrapper.findComponent({ name: 'RecitationCard' })
    await card.vm.$emit('submit', {
      poemId: 'p1',
      overallStatus: 'mastered',
      lines: [],
      authorCorrect: null,
      dynastyCorrect: null,
      charMarks: {},
    })
    await wrapper.vm.$nextTick()
    const quizStore = (wrapper.vm as any).quizStore
    expect(quizStore.session.answers).toHaveLength(1)
    expect(quizStore.session.answers[0].correct).toBe(true)
    expect(quizStore.session.currentIndex).toBe(1)
  })

  it('recite question in reviewing shows revealStep 3', async () => {
    const session = reciteSession({
      currentIndex: 1,
      answers: [{ questionIndex: 0, selectedIndex: 0, correct: true }],
    })
    const wrapper = mountWithSession(session)
    // 点击圆点 1 回顾已答背诵题
    await wrapper.findAll('.dot')[0].trigger('click')
    await wrapper.vm.$nextTick()
    const card = wrapper.findComponent({ name: 'RecitationCard' })
    expect(card.props('revealStep')).toBe(3)
  })
})
```

  注意：`QuizPlayPage.test.ts` 顶部 mock 了 poemStore（`getPoemById: vi.fn(() => undefined)`）。recite 渲染需要 poem 数据，需在测试的 mock 中返回 mockPoem。修改顶部 mock：

```ts
vi.mock('@/stores/poem', () => ({
  usePoemStore: () => ({
    fetchPoems: vi.fn(() => Promise.resolve()),
    getPoemById: vi.fn(() => mockPoemForRecite),
  }),
}))
```

  其中 `mockPoemForRecite` 是模块级常量：

```ts
const mockPoemForRecite = {
  id: 'p1', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级',
  text: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'],
  textType: '五言', yiwen: '译文',
}
```

  同时 `RecitationCard` 依赖 learning store（`useLearningStore`），组件测试需 mock：

```ts
vi.mock('@/stores/learning', () => ({
  useLearningStore: () => ({
    settings: { showYiwen: false },
    updateSettings: vi.fn(),
    charMarks: {},
    toggleCharMark: vi.fn(),
    initCharMarks: vi.fn(),
  }),
}))
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/component/QuizPlayPage.test.ts`
Expected: FAIL —— recite 题目前渲染 FillBlankQuiz（因 `quizType !== 'fillBlank'` 走 v-else 的 NextLineQuiz）或组件不存在。

- [ ] **Step 3: 实现**

`src/views/QuizPlayPage.vue`：

1. import `RecitationCard`：

```ts
import RecitationCard from '@/components/RecitationCard.vue'
```

2. script 增加揭示状态：

```ts
const revealStep = ref(0)

// 切换题目时重置揭示状态
watch(displayIndex, () => { revealStep.value = 0 })

// 当前背诵题的 poem
const currentPoem = computed(() => {
  if (!currentDisplayQuestion.value) return null
  return poemStore.getPoemById(currentDisplayQuestion.value.poemId) ?? null
})

function onReciteSubmit(result: RecitationResult) {
  if (!quizStore.session || !currentDisplayQuestion.value) return
  // 字级标记统计（与 RecitationPlayPage 一致）
  const poem = poemStore.getPoemById(result.poemId)
  if (poem) {
    learningStore.recordReciteWithCharMarks(result.poemId, result.overallStatus === 'mastered', poem.text, result.charMarks)
  }
  quizStore.submitRecitationResult(result)
  if (quizStore.isFinished) {
    router.push({ name: 'quiz-result' })
  }
}
```

  import 需要 `learningStore`（`useLearningStore`）和 `RecitationResult` 类型。

3. 模板：在 `NextLineQuiz` 的 `v-else` 之后加 `v-else-if`（注意顺序）：

```html
<RecitationCard
  v-else-if="currentDisplayQuestion.quizType === 'recite' && currentPoem"
  :key="'q-' + displayIndex"
  :poem="currentPoem"
  reveal-mode
  :reveal-step="isReviewing ? 3 : revealStep"
  @reveal-step-change="revealStep++"
  @submit="onReciteSubmit"
/>
```

  原 `v-else`（NextLineQuiz）保持，但因 recite 命中 `v-else-if`，NextLineQuiz 分支只对真正 nextLine 生效。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/component/QuizPlayPage.test.ts`
Expected: PASS —— 含原有用例（原有用例不涉及 recite，行为不变）。

- [ ] **Step 5: Commit**

```bash
git add src/views/QuizPlayPage.vue tests/component/QuizPlayPage.test.ts
git commit -m "feat: render recitation reveal card in mixed quiz play"
```

---

### Task 6: `QuizResultPage` 处理 recite 条目显示

**Files:**
- Modify: `src/views/QuizResultPage.vue`
- Test: `tests/component/`（现有结果页无组件测试，用现有 e2e 或新增）

- [ ] **Step 1: 修改 answers computed**

`src/views/QuizResultPage.vue` 的 `answers` computed（第 20-47 行）中，对 recite 条目设置显示文本。在 `const poem = poemStore.getPoemById(question.poemId)` 之后、return 前插入：

```ts
const isRecite = question.quizType === 'recite'
return {
  index: i + 1,
  poemId: question.poemId,
  poemTitle: poem?.title ?? '',
  prompt: question.prompt,
  selected: isRecite
    ? (a.correct ? '熟练' : '不熟练')
    : question.options[a.selectedIndex],
  correct: isRecite ? '熟练' : question.options[question.correctIndex],
  isCorrect: a.correct,
  isRecite,
}
```

- [ ] **Step 2: 模板隐藏空选项行**

对 recite 条目，模板中「你的答案/正确答案」两行（第 95-98 行）加 `v-if="!item.isRecite"`：

```html
<div v-if="!item.isRecite" class="mt-1 text-xs">
  <p :class="item.isCorrect ? 'text-green-600' : 'text-red-500'">你的答案：{{ item.selected }}</p>
  <p v-if="!item.isCorrect" class="text-green-600">正确答案：{{ item.correct }}</p>
</div>
```

- [ ] **Step 3: 验证**

Run: `npx vue-tsc -b`
Expected: PASS

Run: `npm run build`
Expected: PASS

（结果页行为由 Task 7 的 e2e 覆盖。）

- [ ] **Step 4: Commit**

```bash
git add src/views/QuizResultPage.vue
git commit -m "feat: display recite entries as mastered/not-mastered in result page"
```

---

### Task 7: e2e 测试（自助练习古诗背诵全流程 + 混排）

**Files:**
- Create: `tests/e2e/self-practice-recite.spec.ts`

- [ ] **Step 1: 写 e2e 测试**

新建 `tests/e2e/self-practice-recite.spec.ts`：

```ts
import { test, expect } from '@playwright/test'

// 清空状态
async function cleanState(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await page.waitForTimeout(500)
}

test('self practice: recite-only mode reveals step by step and submits', async ({ page }) => {
  test.setTimeout(60000)
  await cleanState(page)

  await page.goto('/#/quiz/setup?mode=self')
  await page.waitForSelector('select', { timeout: 10000 })
  await page.selectOption('select', 'all')

  // 只勾选「古诗背诵」：取消补字和接龙
  const checkboxes = page.locator('input[type="checkbox"]')
  for (let i = 0; i < 3; i++) {
    const cb = checkboxes.nth(i)
    if (await cb.isChecked()) await cb.click()
  }
  await page.locator('input[type="checkbox"]').last().click() // 勾选古诗背诵（第三个）

  await page.click('text=5')
  await page.click('text=开始抽查')

  // 背诵题初始仅标题
  await expect(page.locator('.recitation-card')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.recitation-card').locator('h2')).toBeVisible()
  // 作者隐藏
  await expect(page.locator('.recitation-card').locator('text=作者 · ？？')).toBeVisible()

  // 点击卡片 → 显示作者
  await page.locator('.recitation-card h2').click()
  await expect(page.locator('.recitation-card').locator('text=作者 · ？？')).not.toBeVisible()

  // 再点击 → 显示译文
  await page.locator('.recitation-card h2').click()
  await expect(page.locator('.recitation-card .bg-gray-50')).toBeVisible()

  // 再点击 → 显示正文和自评按钮
  await page.locator('.recitation-card h2').click()
  await expect(page.locator('.recitation-card').locator('button:has-text("卡顿")').first()).toBeVisible()
  await expect(page.locator('button:has-text("熟练")')).toBeVisible()

  // 自评熟练
  await page.locator('button:has-text("熟练")').click()

  // 圆点状态
  await expect(page.locator('.dot.correct')).toHaveCount(1)
})

test('self practice: mixed recite+nextLine reveals, submits and completes', async ({ page }) => {
  test.setTimeout(60000)
  await cleanState(page)

  await page.goto('/#/quiz/setup?mode=self')
  await page.waitForSelector('select', { timeout: 10000 })
  await page.selectOption('select', 'all')

  // 勾选古诗背诵，取消补字（保留接龙）
  await page.locator('input[type="checkbox"]').nth(0).click() // 取消补字（若勾选）
  await page.locator('input[type="checkbox"]').last().click() // 勾选古诗背诵

  await page.click('text=5')
  await page.click('text=开始抽查')

  // 用圆点数量验证有题目
  await expect(page.locator('.dot').first()).toBeVisible({ timeout: 5000 })
  const dotCount = await page.locator('.dot').count()
  expect(dotCount).toBeGreaterThan(0)

  // 逐题推进：交替处理 recite 与 nextLine，直到结果页
  let finished = false
  for (let i = 0; i < 30 && !finished; i++) {
    const reciteCard = page.locator('.recitation-card')
    if (await reciteCard.isVisible().catch(() => false)) {
      // 背诵题：连点三次揭示，再点熟练
      await reciteCard.locator('h2').click()
      await reciteCard.locator('h2').click()
      await reciteCard.locator('h2').click()
      await page.locator('button:has-text("熟练")').click()
    } else {
      const optBtn = page.locator('.option-btn').first()
      if (await optBtn.isVisible().catch(() => false)) {
        await optBtn.click()
      }
    }
    await page.waitForTimeout(500)
    // 若到结果页则退出
    if (await page.locator('h2:has-text("抽查结果")').isVisible().catch(() => false)) {
      finished = true
    }
  }

  await expect(page.locator('h2')).toContainText('抽查结果')
  // 结果页有分数
  await expect(page.locator('.text-5xl')).toBeVisible()
  // 背诵条目显示熟练/不熟练
  const reciteRows = page.locator('.border-l-4').filter({ hasText: '熟练' })
  await expect(reciteRows.first()).toBeVisible()
})
```

- [ ] **Step 2: 运行 e2e**

先启动构建 + preview（e2e 依赖 preview server）：

```bash
npm run build
npx playwright test tests/e2e/self-practice-recite.spec.ts
```

Expected: 两个用例 PASS。

- [ ] **Step 3: 回归全量 e2e**

```bash
npx playwright test
```

Expected: PASS。特别关注：
- `quiz-flow.spec.ts` 中 `self quiz mode shows fillBlank and nextLine options` 测试断言 checkbox 数量为 2 —— **此测试会失败**，因现在自助模式有 3 个 checkbox。需更新该测试：

```ts
test('self quiz mode shows fillBlank, nextLine and recite options', async ({ page }) => {
  await page.goto('/#/quiz/setup?mode=self')
  await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 })
  const checkboxes = page.locator('input[type="checkbox"]')
  await expect(checkboxes).toHaveCount(3)
  await expect(page.locator('text=补字选择')).toBeVisible()
  await expect(page.locator('text=上下句接龙')).toBeVisible()
  await expect(page.locator('text=古诗背诵')).toBeVisible()
  await expect(page.locator('text=选标题/作者/朝代')).not.toBeVisible()
})
```

- `quiz-flow.spec.ts` 的 `quiz setup config persists when returning from home` 测试点击 `text=补字选择` 取消、断言 `nextLineCheckbox` checked —— 自助模式现在 3 个 checkbox，`.last()` 变成古诗背诵。需检查并更新该测试（它断言 `.first()` 补字 unchecked、`.last()` checked；原 last 是接龙，现在 last 是古诗背诵）。更新为显式按文本选择：

```ts
// 取消补字选择
await page.locator('label:has-text("补字选择") input').click()
// 接龙仍勾选
await expect(page.locator('label:has-text("上下句接龙") input')).toBeChecked()
```

- `parent quiz mode shows recite and nextLine options only` 测试：家长模式 checkbox 仍 2 个，不受影响。
- `recitation-flow.spec.ts` 等独立抽背流程不受影响。

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/self-practice-recite.spec.ts tests/e2e/quiz-flow.spec.ts
git commit -m "test(e2e): self practice recite reveal flow and mixed queue"
```

---

### Task 8: 全量回归与收尾

**Files:** 无新增

- [ ] **Step 1: 全量单测**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 2: typecheck + build**

Run: `npx vue-tsc -b && npm run build`
Expected: PASS

- [ ] **Step 3: 全量 e2e**

Run: `npx playwright test`
Expected: PASS

- [ ] **Step 4: 更新记忆中的 quizTypeLabels 死代码（如存在）**

检查 `src` 中是否有 `quizTypeLabels` 之类的类型标签映射需补充 recite。用 grep：

Run: `grep -rn "quizTypeLabels\|古诗抽背\|fillBlank" src --include="*.vue" --include="*.ts" | head -50`
Expected: 如发现需要新增 recite 标签的地方（如错题本页面 WrongBookPage 的 quizType 显示映射），补上 `recite: '古诗背诵'`。若 `quizTypeLabels` 确为死代码（memory 中已有记录），跳过，不在此任务范围。

- [ ] **Step 5: 提交收尾**

```bash
git add -A
git commit -m "chore: full regression for self practice recite feature"
```

---

## 自审记录

**Spec coverage:**
- 揭示层级 0-3：Task 1（组件）+ Task 5（QuizPlayPage 状态管理）
- 点击卡片任意处揭示：Task 1
- 同场混排：Task 2（generateQuestion recite）+ Task 5（QuizPlayPage 渲染）
- 统一队列推进：Task 3（answers 同步）+ Task 5
- 圆点+可回顾：Task 3 + Task 5（isReviewing → revealStep 3）
- 熟练=正确：Task 3（correct = mastered）
- 结果页显示：Task 6
- 自助设置页选项：Task 4
- e2e 覆盖：Task 7

**待执行时确认的风险点：**
1. `QuizPlayPage.test.ts` 顶部 poemStore mock 需要返回 mockPoem（recite 渲染依赖），需在 Task 5 一并处理。
2. `quiz-flow.spec.ts` 中 `self quiz mode shows fillBlank and nextLine options` 和 `quiz setup config persists` 两个测试因 checkbox 数量变化需更新（Task 7 Step 3 已说明）。
3. `RecitationCard` 中 `charMarks`/`toggleCharMark` 依赖 learning store，组件测试需 mock（Task 5 Step 1 已给出）。
