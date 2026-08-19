# 背诵标注即时保存 + 作者/朝代按钮文字 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 背诵标注（卡顿/不会/作者/朝代）每次点击即时保存到错题本（localStorage），未提交的整体背诵调度通过「待调度标记 + 进入错题本自动补」修复；卡片按钮文字改为「作者不会」「朝代不会」。

**Architecture:** `RecitationCard.vue` 在标注变化时即时调用 `learningStore` 的 `recordDetail`/`removeWrongEntry`，并同步 `pendingReciteSchedules`（localStorage 的 poemId 列表）。`WrongBookPage` onMounted 遍历待调度列表补 `recordAnswer(poemId, 'recite', false)`（固定 false）。`submitRecitationResult`/`PoemCardPage.saveResult` 移除重复的 `recordDetail` 细节写入，只保留 `recordAnswer` 整体调度。

**Tech Stack:** Vue 3 + TypeScript + Pinia + Vitest + Playwright + localStorage

---

### Task 1: learningStore 待调度标记

**Files:**
- Modify: `src/stores/learning.ts`
- Test: `tests/unit/learning-store.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/unit/learning-store.test.ts` 末尾追加：

```typescript
describe('pendingReciteSchedules', () => {
  it('syncPendingReciteSchedule adds poemId when hasIssue', () => {
    const store = useLearningStore()
    store.syncPendingReciteSchedule('p001', true)
    expect(store.pendingReciteSchedules).toContain('p001')
  })

  it('syncPendingReciteSchedule removes poemId when no issue', () => {
    const store = useLearningStore()
    store.syncPendingReciteSchedule('p001', true)
    store.syncPendingReciteSchedule('p001', false)
    expect(store.pendingReciteSchedules).not.toContain('p001')
  })

  it('is idempotent when adding same poemId twice', () => {
    const store = useLearningStore()
    store.syncPendingReciteSchedule('p001', true)
    store.syncPendingReciteSchedule('p001', true)
    expect(store.pendingReciteSchedules).toEqual(['p001'])
  })

  it('persists to localStorage and restores on new store', () => {
    const store = useLearningStore()
    store.syncPendingReciteSchedule('p001', true)
    const raw = localStorage.getItem('poem-quiz-pending-recite')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)).toEqual(['p001'])

    // 新 store 实例从 localStorage 恢复
    setActivePinia(createPinia())
    const store2 = useLearningStore()
    expect(store2.pendingReciteSchedules).toEqual(['p001'])
  })

  it('unmarkPendingReciteSchedule removes poemId', () => {
    const store = useLearningStore()
    store.syncPendingReciteSchedule('p001', true)
    store.syncPendingReciteSchedule('p002', true)
    store.unmarkPendingReciteSchedule('p001')
    expect(store.pendingReciteSchedules).toEqual(['p002'])
  })

  it('flushPendingReciteSchedules returns and clears list', () => {
    const store = useLearningStore()
    store.syncPendingReciteSchedule('p001', true)
    const flushed = store.flushPendingReciteSchedules()
    expect(flushed).toEqual(['p001'])
    expect(store.pendingReciteSchedules).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/learning-store.test.ts`
Expected: FAIL，`syncPendingReciteSchedule` 不存在

- [ ] **Step 3: 实现**

在 `src/stores/learning.ts` 顶部新增常量：

```typescript
const PENDING_RECITE_KEY = 'poem-quiz-pending-recite'

function loadPendingReciteSchedules(): string[] {
  try {
    const raw = localStorage.getItem(PENDING_RECITE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePendingReciteSchedules(list: string[]) {
  localStorage.setItem(PENDING_RECITE_KEY, JSON.stringify(list))
}
```

在 `data` ref 之后新增状态与函数：

```typescript
  // 待补整体背诵调度的 poemId 列表（localStorage 持久化，进错题本时补 recordAnswer）
  const pendingReciteSchedules = ref<string[]>(loadPendingReciteSchedules())

  function syncPendingReciteSchedule(poemId: string, hasIssue: boolean) {
    if (hasIssue) {
      if (!pendingReciteSchedules.value.includes(poemId)) {
        pendingReciteSchedules.value.push(poemId)
      }
    } else {
      pendingReciteSchedules.value = pendingReciteSchedules.value.filter(id => id !== poemId)
    }
    savePendingReciteSchedules(pendingReciteSchedules.value)
  }

  function unmarkPendingReciteSchedule(poemId: string) {
    pendingReciteSchedules.value = pendingReciteSchedules.value.filter(id => id !== poemId)
    savePendingReciteSchedules(pendingReciteSchedules.value)
  }

  function flushPendingReciteSchedules(): string[] {
    const list = [...pendingReciteSchedules.value]
    pendingReciteSchedules.value = []
    savePendingReciteSchedules([])
    return list
  }
```

在 return 中导出：

```typescript
    pendingReciteSchedules, syncPendingReciteSchedule, unmarkPendingReciteSchedule, flushPendingReciteSchedules,
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/learning-store.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/stores/learning.ts tests/unit/learning-store.test.ts
git commit -m "feat: add pending recite schedules with localStorage persistence"
```

---

### Task 2: RecitationCard 标注即时保存 + 待调度标记

**Files:**
- Modify: `src/components/RecitationCard.vue`
- Test: `tests/unit/RecitationCard.test.ts`

- [ ] **Step 1: 写失败测试**

更新 `tests/unit/RecitationCard.test.ts` 的 mock（新增 `recordDetail`、`removeWrongEntry`、`syncPendingReciteSchedule`）：

```typescript
const { toggleCharMarkMock, initCharMarksMock, charMarksMock, recordDetailMock, removeWrongEntryMock, syncPendingReciteScheduleMock } = vi.hoisted(() => ({
  toggleCharMarkMock: vi.fn(),
  initCharMarksMock: vi.fn(),
  charMarksMock: {} as Record<string, string>,
  recordDetailMock: vi.fn(),
  removeWrongEntryMock: vi.fn(),
  syncPendingReciteScheduleMock: vi.fn(),
}))

vi.mock('@/stores/learning', () => ({
  useLearningStore: () => ({
    settings: { showYiwen: false },
    updateSettings: vi.fn(),
    charMarks: charMarksMock,
    toggleCharMark: toggleCharMarkMock,
    initCharMarks: initCharMarksMock,
    recordDetail: recordDetailMock,
    removeWrongEntry: removeWrongEntryMock,
    syncPendingReciteSchedule: syncPendingReciteScheduleMock,
  }),
}))
```

在 `beforeEach` 中清空这些 mock：

```typescript
beforeEach(() => {
  recordDetailMock.mockClear()
  removeWrongEntryMock.mockClear()
  syncPendingReciteScheduleMock.mockClear()
})
```

新增 describe 块（放在 `Author/Dynasty "不会" toggle` 之后）：

```typescript
describe('即时保存', () => {
  beforeEach(() => {
    Object.keys(charMarksMock).forEach(k => delete charMarksMock[k])
  })

  it('点「卡顿」立即调用 recordDetail 写错题本', async () => {
    const wrapper = mountCard()
    const stuckBtns = getStuckButtons(wrapper)
    await stuckBtns[0].trigger('click')
    expect(recordDetailMock).toHaveBeenCalledWith('test-1', 'line', '第1句:stuck')
  })

  it('点「不会」立即调用 recordDetail 写错题本', async () => {
    const wrapper = mountCard()
    const forgotBtns = getForgotButtons(wrapper)
    await forgotBtns[2].trigger('click')
    expect(recordDetailMock).toHaveBeenCalledWith('test-1', 'line', '第3句:forgot')
  })

  it('撤销「卡顿」调用 removeWrongEntry 移除错题本条目', async () => {
    const wrapper = mountCard()
    const stuckBtns = getStuckButtons(wrapper)
    await stuckBtns[0].trigger('click')
    await stuckBtns[0].trigger('click')
    expect(removeWrongEntryMock).toHaveBeenCalledWith('test-1', 'line', '第1句:stuck')
  })

  it('点「作者不会」调用 recordDetail author', async () => {
    const wrapper = mountCard()
    const { authorForgot } = getAuthorDynastyButtons(wrapper)
    await authorForgot!.trigger('click')
    expect(recordDetailMock).toHaveBeenCalledWith('test-1', 'author')
  })

  it('点「朝代不会」调用 recordDetail dynasty', async () => {
    const wrapper = mountCard()
    const { dynastyForgot } = getAuthorDynastyButtons(wrapper)
    await dynastyForgot!.trigger('click')
    expect(recordDetailMock).toHaveBeenCalledWith('test-1', 'dynasty')
  })

  it('撤销作者调用 removeWrongEntry author', async () => {
    const wrapper = mountCard()
    const { authorForgot } = getAuthorDynastyButtons(wrapper)
    await authorForgot!.trigger('click')
    await authorForgot!.trigger('click') // false → true
    expect(removeWrongEntryMock).toHaveBeenCalledWith('test-1', 'author')
  })

  it('首次标记任何异常时 syncPendingReciteSchedule(poemId, true)', async () => {
    const wrapper = mountCard()
    const stuckBtns = getStuckButtons(wrapper)
    await stuckBtns[0].trigger('click')
    expect(syncPendingReciteScheduleMock).toHaveBeenCalledWith('test-1', true)
  })

  it('撤销全清后 syncPendingReciteSchedule(poemId, false)', async () => {
    const wrapper = mountCard()
    const stuckBtns = getStuckButtons(wrapper)
    await stuckBtns[0].trigger('click')
    await stuckBtns[0].trigger('click')
    expect(syncPendingReciteScheduleMock).toHaveBeenCalledWith('test-1', false)
  })
})

describe('按钮文字', () => {
  it('作者/朝代按钮分别显示「作者不会」「朝代不会」', () => {
    const wrapper = mountCard()
    const { authorForgot, dynastyForgot } = getAuthorDynastyButtons(wrapper)
    expect(authorForgot.text()).toBe('作者不会')
    expect(dynastyForgot.text()).toBe('朝代不会')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/RecitationCard.test.ts`
Expected: FAIL（recordDetail 未调用、按钮文字为「不会」）

- [ ] **Step 3: 实现**

在 `RecitationCard.vue` 的 `setLineStatus` 中即时写错题本：

```typescript
function setLineStatus(index: number, status: 'ok' | 'stuck' | 'forgot') {
  if (props.disabled) return
  const prev = lineStatuses.value[index].status
  lineStatuses.value[index] = { lineIndex: index, status }
  const note = `第${index + 1}句:${status}`
  const prevNote = `第${index + 1}句:${prev}`
  if (status === 'stuck' || status === 'forgot') {
    if (prev !== status) learningStore.recordDetail(props.poem.id, 'line', note)
  } else {
    learningStore.removeWrongEntry(props.poem.id, 'line', prevNote)
  }
  syncPending()
}
```

`toggleAuthorCorrect` 即时写错题本：

```typescript
function toggleAuthorCorrect() {
  if (props.disabled) return
  if (authorCorrect.value === null) authorCorrect.value = false
  else if (authorCorrect.value === false) authorCorrect.value = true
  else authorCorrect.value = null
  if (authorCorrect.value === false) {
    learningStore.recordDetail(props.poem.id, 'author')
  } else {
    learningStore.removeWrongEntry(props.poem.id, 'author')
  }
  syncPending()
}
```

`toggleDynastyCorrect` 即时写错题本（同上，quizType 为 `'dynasty'`）。

新增 `syncPending` 辅助函数：

```typescript
function syncPending() {
  learningStore.syncPendingReciteSchedule(props.poem.id, hasAnyIssue.value)
}
```

`markMastered` / `markForgot` 保持不变（它们本身 emit submit，提交路径会移除待调度标记）。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/RecitationCard.test.ts`
Expected: PASS

注意：`hasAnyIssue` 是 computed，`syncPending` 在 `setLineStatus` 内同步调用时读取的是更新前的值（computed 惰性）。若失败，改为在函数末尾显式计算：

```typescript
const hasLineIssueNow = lineStatuses.value.some(l => l.status !== 'ok')
const hasAuthorIssueNow = authorCorrect.value === false
const hasDynastyIssueNow = dynastyCorrect.value === false
learningStore.syncPendingReciteSchedule(props.poem.id, hasLineIssueNow || hasAuthorIssueNow || hasDynastyIssueNow)
```

（用一个私有辅助 `computeHasIssue()` 封装上述显式计算，三个函数共用。）

- [ ] **Step 5: 提交**

```bash
git add src/components/RecitationCard.vue tests/unit/RecitationCard.test.ts
git commit -m "feat: auto-save recitation marks on tap, label author/dynasty buttons"
```

---

### Task 3: 提交路径移除重复 detail 写入

**Files:**
- Modify: `src/stores/quiz.ts`（`submitRecitationResult`）
- Modify: `src/views/PoemCardPage.vue`（`saveResult`）
- Test: `tests/unit/quiz-store-full.test.ts`
- Test: `tests/component/poem-card-page.test.ts`

- [ ] **Step 1: 写失败测试**

`tests/unit/quiz-store-full.test.ts`：把 `detail entries go to wrongBook via recordDetail` 测试改为断言「submit 只调度 recordAnswer 一次，不再写 detail」：

```typescript
it('submitRecitationResult only schedules via recordAnswer, details saved by card', () => {
  const store = useQuizStore()
  const learningStore = useLearningStore()
  store.startRecitation('all', 3)
  const poemId = store.currentQuestion!.poemId
  store.submitRecitationResult({
    poemId,
    overallStatus: 'not-mastered',
    lines: [{ lineIndex: 0, status: 'stuck' }],
    authorCorrect: false,
    dynastyCorrect: null,
    charMarks: {},
  })
  // recordAnswer 调用一次（quizResults 1 条）
  const quizResults = learningStore.data.quizResults.filter(r => r.poemId === poemId)
  expect(quizResults).toHaveLength(1)
  expect(quizResults[0].quizType).toBe('recite')
  expect(quizResults[0].correct).toBe(false)
  // 不再写 line/author 细节（即时保存负责）
  const wbEntries = learningStore.wrongBook.filter(w => w.poemId === poemId)
  expect(wbEntries.some(w => w.quizType === 'line')).toBe(false)
  expect(wbEntries.some(w => w.quizType === 'author')).toBe(false)
})
```

`tests/component/poem-card-page.test.ts`：更新 `saveResult records char marks` 测试，断言 `recordDetail` 不再被调用：

```typescript
expect(recordAnswerMock).toHaveBeenCalledWith('p1', 'recite', false)
expect(recordDetailMock).not.toHaveBeenCalled()
expect(recordReciteWithCharMarksMock).toHaveBeenCalledWith('p1', false, expect.any(Array), { '0-0': 'wrong' })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/quiz-store-full.test.ts tests/component/poem-card-page.test.ts`
Expected: FAIL（detail 仍在写）

- [ ] **Step 3: 实现**

`src/stores/quiz.ts` 的 `submitRecitationResult`：删除 `recordDetail` 循环与 author/dynasty 分支，保留 `recordAnswer`：

```typescript
  function submitRecitationResult(result: RecitationResult) {
    if (!session.value) return
    session.value.recitationResults.push(result)

    // 混排统一：背诵题也推一条 answers 条目，使进度圆点/计分/结果页统一工作
    session.value.answers.push({
      questionIndex: session.value.currentIndex,
      selectedIndex: 0, // recite 无选项，占位
      correct: result.overallStatus === 'mastered',
    })

    const learningStore = useLearningStore()

    // 整体只调用一次 recordAnswer
    learningStore.recordAnswer(result.poemId, 'recite', result.overallStatus === 'mastered')
    // 正常提交，移除待调度标记
    learningStore.unmarkPendingReciteSchedule(result.poemId)

    session.value.currentIndex++
    resetCurrentRecitation()
  }
```

`src/views/PoemCardPage.vue` 的 `saveResult`：删除 `recordDetail` 相关分支，保留 `recordAnswer` + `recordReciteWithCharMarks`，并移除待调度标记：

```typescript
function saveResult(result: RecitationResult) {
  checkedPoemIds.value.add(result.poemId)

  // 整体只调用一次 recordAnswer
  learningStore.recordAnswer(result.poemId, 'recite', result.overallStatus === 'mastered')
  // 正常提交，移除待调度标记
  learningStore.unmarkPendingReciteSchedule(result.poemId)

  // 字级标记统计
  if (result.charMarks && Object.keys(result.charMarks).length > 0) {
    const poem = poemStore.getPoemById(result.poemId)
    if (poem) {
      learningStore.recordReciteWithCharMarks(result.poemId, result.overallStatus === 'mastered', poem.text, result.charMarks)
    }
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/quiz-store-full.test.ts tests/component/poem-card-page.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/stores/quiz.ts src/views/PoemCardPage.vue tests/unit/quiz-store-full.test.ts tests/component/poem-card-page.test.ts
git commit -m "refactor: remove duplicate detail writes from submit paths"
```

---

### Task 4: WrongBookPage 进入时补未提交调度

**Files:**
- Modify: `src/views/WrongBookPage.vue`
- Test: `tests/component/WrongBookPage.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/component/WrongBookPage.test.ts` 新增 describe：

```typescript
describe('进入错题本自动补调度', () => {
  it('onMounted 对待调度列表补 recordAnswer(poemId, recite, false)', async () => {
    const store = useLearningStore()
    // 预置待调度标记
    store.syncPendingReciteSchedule('p1', true)
    const recordAnswerSpy = vi.spyOn(store, 'recordAnswer')
    await mountPage()
    expect(recordAnswerSpy).toHaveBeenCalledWith('p1', 'recite', false)
    // 补完清空待调度列表
    expect(store.pendingReciteSchedules).toEqual([])
  })

  it('无待调度时不调用 recordAnswer', async () => {
    const store = useLearningStore()
    const recordAnswerSpy = vi.spyOn(store, 'recordAnswer')
    await mountPage()
    expect(recordAnswerSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/component/WrongBookPage.test.ts`
Expected: FAIL（onMounted 未补调度）

- [ ] **Step 3: 实现**

`src/views/WrongBookPage.vue` 的 onMounted：

```typescript
onMounted(() => {
  poemStore.fetchPoems()
  // 补未提交的整体背诵调度（关闭页面/直接返回时细节已即时入错题本，但 recordAnswer 未调用）
  const pending = learningStore.flushPendingReciteSchedules()
  for (const poemId of pending) {
    learningStore.recordAnswer(poemId, 'recite', false)
  }
})
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/component/WrongBookPage.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/views/WrongBookPage.vue tests/component/WrongBookPage.test.ts
git commit -m "feat: repair pending recite schedules on wrongbook entry"
```

---

### Task 5: e2e 单诗即时保存 + 错题本修复

**Files:**
- Modify: `tests/e2e/review-plan.spec.ts`

- [ ] **Step 1: 写 e2e 测试**

在 `tests/e2e/review-plan.spec.ts` 末尾追加：

```typescript
test('single poem: marking a line saves immediately and wrongbook repairs schedule', async ({ page }) => {
  // 清空状态
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await page.waitForTimeout(300)

  // 古诗详情 → 背诵复习
  await page.goto('/#/poem/p001')
  await page.waitForLoadState('load')
  await expect(page.locator('button:has-text("背诵复习")')).toBeVisible({ timeout: 10000 })
  await page.locator('button:has-text("背诵复习")').click()

  // 标记一行「卡顿」（不点下一首）
  await expect(page.locator('.recitation-card').locator('button:has-text("卡顿")').first()).toBeVisible({ timeout: 5000 })
  await page.locator('.recitation-card').locator('button:has-text("卡顿")').first().click()

  // 验证错题本已即时写入（localStorage）
  const wb = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('poem-quiz-data') || '{}')
    return data.wrongBook || []
  })
  const lineEntry = wb.find((w: any) => w.quizType === 'line' && w.note === '第1句:stuck')
  expect(lineEntry).toBeTruthy()

  // 验证待调度标记已写入
  const pending = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('poem-quiz-pending-recite') || '[]')
  )
  expect(pending).toContain('p001')

  // 直接返回（不点下一首），进入错题本
  await page.locator('text=返回').first().click()
  await page.goto('/#/wrong')
  await page.waitForLoadState('load')
  await page.waitForTimeout(300)

  // 验证 recordAnswer 已补：records 含 p001 且 reviewCount 正确
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('poem-quiz-data') || '{}'))
  const record = data.records.find((r: any) => r.poemId === 'p001')
  expect(record).toBeTruthy()
  expect(record.reviewCount).toBeGreaterThan(0)
  // 待调度列表已清空
  const pendingAfter = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('poem-quiz-pending-recite') || '[]')
  )
  expect(pendingAfter).toEqual([])
})
```

- [ ] **Step 2: 构建并运行 e2e**

先构建（注意 `npm run build` 会因 tests/unit 预存 unused 变量 TS6133 报错，用 `npx vite build`）：

Run: `npx vite build`
Run: `npx playwright test tests/e2e/review-plan.spec.ts`
Expected: PASS

注意：跑 e2e 前确保 4173 端口没有其他 worktree 的 preview 占用（`reuseExistingServer: true` 会复用旧构建）。如有，先停掉或单独起本 worktree 的 preview。

- [ ] **Step 3: 运行全部 e2e 回归**

Run: `npx playwright test`
Expected: 全部 PASS（重点回归 `recitation-flow.spec.ts`、`quiz-flow.spec.ts`）

- [ ] **Step 4: 提交**

```bash
git add tests/e2e/review-plan.spec.ts
git commit -m "test(e2e): single poem marking auto-saves and wrongbook repairs schedule"
```

---

## 自检

**Spec 覆盖：**
- 标注即时保存（recordDetail/removeWrongEntry）→ Task 2
- 待调度标记 localStorage → Task 1
- 进入错题本补调度（固定 false）→ Task 4
- 提交路径移除重复 detail → Task 3
- 按钮文字「作者不会」「朝代不会」→ Task 2
- 字级标记不在即时保存范围 → 无任务（符合 spec 限制）
- 错题本/结果页文案不改 → 无任务（符合 spec 限制）

**类型一致性：** `syncPendingReciteSchedule`、`unmarkPendingReciteSchedule`、`flushPendingReciteSchedules`、`pendingReciteSchedules` 在 Task 1 定义，Task 2/3/4 使用，签名一致。

**关键风险（Task 2 Step 4 已注明）：** `hasAnyIssue` computed 惰性求值，`syncPending` 需用显式计算 `computeHasIssue()`，计划中已给出替代实现。
