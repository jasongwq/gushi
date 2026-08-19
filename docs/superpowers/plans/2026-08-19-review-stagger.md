# 已学诗复习摊开 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解决批量标记已学导致今日待复习飙升问题：markLearned 记录 `nextReviewDate` 设为 `'2099-01-01'` 占位（不进待复习），重排时新增"每天最多复习数 N"参数，已标记已学的诗按全局配额（艾宾浩斯到期优先）摊开分配复习日期。

**Architecture:** 扩展现有 `rebuildSchedule`。新增纯函数 `spreadReviews`（全局配额摊开算法）到 `schedule.ts`；`markLearned` 改设 `nextReviewDate='2099-01-01'`；`rebuildSchedule` 接收双参数（pace + reviewPerDay），同时排新诗学习排程和标记已学复习摊开。页面重排区加"每天复习数"选择器。

**Tech Stack:** Vue 3 + Pinia + TypeScript + Tailwind CSS + Vitest + Playwright

**Prerequisite:** 在 worktree `.codebuddy/worktrees/review-plan` 中开发。

---

### Task 1: 纯函数 spreadReviews — 全局配额摊开

**Files:**
- Create: `tests/unit/schedule.test.ts` 追加 spreadReviews 测试
- Modify: `src/utils/schedule.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/unit/schedule.test.ts` 末尾追加：

```typescript
import { buildSchedule, parsePace, spreadReviews, PACE_OPTIONS, type PaceOption } from '@/utils/schedule'
```

（更新顶部 import）

```typescript
describe('spreadReviews', () => {
  // 已标记已学诗：poemId → 当前 nextReviewDate（'2099-01-01' 表示待排）
  const markedLearned: Record<string, string> = {
    m01: '2099-01-01',
    m02: '2099-01-01',
    m03: '2099-01-01',
    m04: '2099-01-01',
    m05: '2099-01-01',
  }
  // 艾宾浩斯到期诗：poemId → nextReviewDate（今天或已过）
  const ebbinghausDue: Record<string, string> = {
    e01: '2026-08-19',
    e02: '2026-08-19',
    e03: '2026-08-18',
  }

  it('spreads marked-learned poems into future days with daily quota', () => {
    // 每天复习名额 2，但今天有 3 首艾宾浩斯到期 → 今天剩余 0，从明天开始排
    const result = spreadReviews(markedLearned, ebbinghausDue, 2, '2026-08-19')
    expect(result['m01']).toBe('2026-08-20')
    expect(result['m02']).toBe('2026-08-20')
    expect(result['m03']).toBe('2026-08-21')
    expect(result['m04']).toBe('2026-08-21')
    expect(result['m05']).toBe('2026-08-22')
  })

  it('uses today remaining quota when ebbinghaus due is below quota', () => {
    const due = { e01: '2026-08-19' }
    const result = spreadReviews(markedLearned, due, 2, '2026-08-19')
    // 今天 1 首到期，剩 1 名额 → m01 今天
    expect(result['m01']).toBe('2026-08-19')
    expect(result['m02']).toBe('2026-08-20')
    expect(result['m03']).toBe('2026-08-20')
  })

  it('returns empty when no marked-learned poems', () => {
    const result = spreadReviews({}, ebbinghausDue, 2, '2026-08-19')
    expect(result).toEqual({})
  })

  it('does not touch poems already assigned a real date', () => {
    // m01 已有实际日期，跳过
    const marked = { ...markedLearned, m01: '2026-08-25' }
    const result = spreadReviews(marked, {}, 2, '2026-08-19')
    expect(result['m01']).toBe('2026-08-25')
    expect(result['m02']).toBe('2026-08-19')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run tests/unit/schedule.test.ts 2>&1 | tail -8
```

Expected: FAIL — `spreadReviews is not a function`

- [ ] **Step 3: 实现 `spreadReviews`**

在 `src/utils/schedule.ts` 末尾追加：

```typescript
/**
 * 把已标记已学但待排复习的诗（nextReviewDate === '2099-01-01'）按每天复习名额 N 摊开。
 * 全局配额算法：
 * 1. 从今天起逐天检查
 * 2. 每天先放艾宾浩斯到期的诗（占用当天名额）
 * 3. 当天剩余名额（N - 艾宾浩斯到期数）给标记已学的诗，满则顺延下一天
 * 已分配实际日期的诗（非 2099 占位）保持不变。
 */
export function spreadReviews(
  markedLearned: Record<string, string>,  // poemId → 当前 nextReviewDate
  ebbinghausDue: Record<string, string>,   // poemId → nextReviewDate（今天或已过，当天到期）
  reviewPerDay: number,                    // 每天最多复习数 N
  today: string,
): Record<string, string> {
  const result: Record<string, string> = {}
  // 待排的标记已学诗（按 poemId 顺序稳定）
  const pending = Object.entries(markedLearned).filter(([, date]) => date === '2099-01-01')
  if (pending.length === 0) return result

  // 每天艾宾浩斯到期数（占名额）
  const dueCountByDay = new Map<string, number>()
  for (const date of Object.values(ebbinghausDue)) {
    const d = date <= today ? today : date
    dueCountByDay.set(d, (dueCountByDay.get(d) ?? 0) + 1)
  }

  let pendingIdx = 0
  let dayOffset = 0
  while (pendingIdx < pending.length) {
    const date = addDays(today, dayOffset)
    const dueCount = dueCountByDay.get(date) ?? 0
    const available = Math.max(0, reviewPerDay - dueCount)
    for (let i = 0; i < available && pendingIdx < pending.length; i++) {
      const [poemId] = pending[pendingIdx]
      result[poemId] = date
      pendingIdx++
    }
    dayOffset++
  }

  // 保留已分配实际日期的诗
  for (const [poemId, date] of Object.entries(markedLearned)) {
    if (date !== '2099-01-01' && !(poemId in result)) {
      result[poemId] = date
    }
  }
  return result
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run tests/unit/schedule.test.ts 2>&1 | tail -6
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add src/utils/schedule.ts tests/unit/schedule.test.ts && git commit -m "feat: add spreadReviews global-quota review spreading function"
```

---

### Task 2: markLearned 占位 + rebuildSchedule 扩展

**Files:**
- Modify: `src/stores/learning.ts`
- Modify: `tests/unit/learning-mark-learned.test.ts`

- [ ] **Step 1: 更新 markLearned 测试**

在 `tests/unit/learning-mark-learned.test.ts` 中：

`creates minimal records for the given poems` 用例的断言改为 nextReviewDate 是 '2099-01-01'：

```typescript
  it('creates minimal records with placeholder nextReviewDate', () => {
    const store = useLearningStore()
    store.markLearned(['p001', 'p002'])
    const r1 = store.getRecord('p001')
    const r2 = store.getRecord('p002')
    expect(r1).toBeDefined()
    expect(r1!.reviewCount).toBe(0)
    expect(r1!.masteryLevel).toBe('新')
    expect(r1!.nextReviewDate).toBe('2099-01-01')
    expect(r2).toBeDefined()
    expect(r2!.nextReviewDate).toBe('2099-01-01')
  })
```

新增用例：

```typescript
  it('placeholder date does not make poems due today', () => {
    const store = useLearningStore()
    store.markLearned(['p001'])
    expect(store.reviewDueCount).toBe(0)
  })

  it('rebuildSchedule spreads marked-learned poems with review quota', () => {
    const store = useLearningStore()
    store.markLearned(['p001', 'p002', 'p003'])
    // 每天复习名额 1 → p001 明天，p002 后天，p003 大后天
    store.rebuildSchedule([], { type: 'perDay', count: 3 }, '2026-08-19', 1)
    const today = '2026-08-19'
    expect(store.getRecord('p001')!.nextReviewDate).toBe('2026-08-20')
    expect(store.getRecord('p002')!.nextReviewDate).toBe('2026-08-21')
    expect(store.getRecord('p003')!.nextReviewDate).toBe('2026-08-22')
  })
```

注意：`reviewDueCount` 用 `new Date().toISOString()`（真实今天），测试里 placeholder 2099 永远不进待复习，断言成立。

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run tests/unit/learning-mark-learned.test.ts 2>&1 | tail -8
```

Expected: FAIL — markLearned 仍设今天，断言不符；rebuildSchedule 缺第 4 参

- [ ] **Step 3: 实现**

修改 `markLearned`（`nextReviewDate: today` 改为 `'2099-01-01'`）：

```typescript
  // 批量标记已学：创建最小学习记录（nextReviewDate 占位，待重排分配复习日期），并从排程移除
  function markLearned(poemIds: string[]) {
    const today = new Date().toISOString().split('T')[0]
    for (const poemId of poemIds) {
      if (!getRecord(poemId)) {
        data.value.records.push({
          poemId, lastReviewDate: today, reviewCount: 0,
          nextReviewDate: '2099-01-01', correctness: [], reciteCorrectness: [],
          masteryLevel: '新', unproficient: false, unproficientCorrectStreak: 0,
          charMarkStats: [], firstLearnDate: today,
        })
      }
      // 从排程移除
      if (poemId in data.value.schedule) {
        delete data.value.schedule[poemId]
      }
    }
    persist()
  }
```

扩展 `rebuildSchedule`（加第 4 参 `reviewPerDay`，同时摊开已标记已学诗）：

```typescript
  // 重排：未学诗按 pace 排 schedule；已标记已学且待排复习的诗按 reviewPerDay 摊开 nextReviewDate
  function rebuildSchedule(unlearnedPoems: Poem[], pace: PaceOption, today: string, reviewPerDay = 3) {
    data.value.schedule = buildSchedule(unlearnedPoems, pace, today)

    // 已标记已学的诗（有记录且 reviewCount===0 且 nextReviewDate==='2099-01-01'）
    const marked: Record<string, string> = {}
    const due: Record<string, string> = {}
    for (const r of data.value.records) {
      if (r.nextReviewDate === '2099-01-01') {
        marked[r.poemId] = r.nextReviewDate
      } else if (r.nextReviewDate <= today && r.reviewCount > 0) {
        due[r.poemId] = r.nextReviewDate
      }
    }
    const spread = spreadReviews(marked, due, reviewPerDay, today)
    for (const [poemId, date] of Object.entries(spread)) {
      const record = getRecord(poemId)
      if (record && record.nextReviewDate === '2099-01-01') {
        record.nextReviewDate = date
      }
    }
    persist()
  }
```

顶部 import 加 `spreadReviews`：

```typescript
import { buildSchedule, spreadReviews, type PaceOption } from '@/utils/schedule'
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run tests/unit/learning-mark-learned.test.ts 2>&1 | tail -6
```

Expected: PASS

- [ ] **Step 5: 类型检查 + 全量单测**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vue-tsc --noEmit 2>&1 | head -5
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run 2>&1 | tail -4
```

Expected: 无错误（可能组件测试因 reviewDueCount 变化需更新，见 Task 3）

- [ ] **Step 6: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add src/stores/learning.ts tests/unit/learning-mark-learned.test.ts && git commit -m "feat: placeholder nextReviewDate for marked-learned and review-spread in rebuild"
```

---

### Task 3: 页面重排区加复习数选择

**Files:**
- Modify: `src/views/ReviewPlanPage.vue`

- [ ] **Step 1: 加复习数状态和选择器**

在 `const paceValue = ref('3')` 后加：

```typescript
const reviewPerDayValue = ref('3')
```

在 `rebuild()` 中传 reviewPerDay：

```typescript
function rebuild() {
  if (unlearnedPoems.value.length === 0 && learningStore.records.filter(r => r.nextReviewDate === '2099-01-01').length === 0) return
  const pace = parsePace(paceValue.value)
  learningStore.rebuildSchedule(unlearnedPoems.value, pace, new Date().toISOString().slice(0, 10), parseInt(reviewPerDayValue.value, 10))
  initExpand()
}
```

在模板节奏选择器行下方加复习数选择器：

```html
    <div class="flex items-center gap-2 mb-2">
      <label class="flex-1 text-sm text-gray-500">每天复习数</label>
      <select v-model="reviewPerDayValue" class="flex-1 p-2 border border-gray-200 rounded-lg text-sm bg-white focus:border-indigo-300 focus:outline-none">
        <option value="1">1 首</option>
        <option value="3">3 首</option>
        <option value="5">5 首</option>
        <option value="10">10 首</option>
      </select>
    </div>
```

- [ ] **Step 2: 更新组件测试**

`tests/component/ReviewPlanPage.test.ts` 中「auto-generates schedule on first visit with default pace」用例：首次自动生成时 `rebuild()` 会调 rebuildSchedule。断言 getSchedule 非空仍成立。但「shows today section expanded by default」里断言 `新增学习` 仍成立（默认 pace 3）。

新增用例：

```typescript
  it('rebuild spreads marked-learned poems with review quota', async () => {
    const store = useLearningStore()
    store.markLearned(['p001', 'p002'])
    const wrapper = mountPage()
    await flushPromises()
    // 切换复习数到 1 并重排
    const reviewSelect = wrapper.findAll('select')[1]
    await reviewSelect.setValue('1')
    await wrapper.findAll('button').find(b => b.text().includes('重排'))!.trigger('click')
    await flushPromises()
    // p001 明天，p002 后天（每天1首）
    const today = new Date().toISOString().slice(0, 10)
    expect(store.getRecord('p001')!.nextReviewDate > today).toBe(true)
    expect(store.getRecord('p002')!.nextReviewDate > store.getRecord('p001')!.nextReviewDate).toBe(true)
  })
```

- [ ] **Step 3: 类型检查 + 构建 + 全量单测**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vue-tsc --noEmit 2>&1 | head -5
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vite build 2>&1 | tail -3
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run 2>&1 | tail -4
```

Expected: 无错误，构建成功，全部通过

- [ ] **Step 4: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add src/views/ReviewPlanPage.vue tests/component/ReviewPlanPage.test.ts && git commit -m "feat: add review-per-day selector to rebuild controls"
```

---

### Task 4: e2e 更新

**Files:**
- Modify: `tests/e2e/review-plan.spec.ts`

- [ ] **Step 1: 更新批量标记 e2e**

「batch mark poems as learned」测试断言 records.length > 0，仍成立。新增断言：标记后今日待复习不飙升（标记的 1 首 nextReviewDate=2099，reviewDueCount 不增）。在现有测试的 localStorage 检查后追加：

```typescript
  // 标记的诗 nextReviewDate 为占位（2099），不会进今日待复习
  const markedRecord = records.find((r: any) => r.nextReviewDate === '2099-01-01')
  expect(markedRecord).toBeDefined()
```

- [ ] **Step 2: 新增 e2e：重排摊开**

```typescript
test('review plan page: rebuild spreads marked-learned reviews', async ({ page }) => {
  await page.goto('/#/review-plan')
  // 批量标记第一首
  await page.click('button:has-text("批量配置")')
  await expect(page.locator('text=批量配置已学')).toBeVisible({ timeout: 5000 })
  const checkbox = page.locator('input[type="checkbox"]').first()
  await checkbox.check()
  await page.click('button:has-text("确认标记")')
  await expect(page.locator('text=批量配置已学')).not.toBeVisible({ timeout: 5000 })

  // 标记后该诗 nextReviewDate 为占位
  const placeholder = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('poem-quiz-data') || '{}')
    return data.records.some((r: any) => r.nextReviewDate === '2099-01-01')
  })
  expect(placeholder).toBe(true)

  // 重排（默认复习数）后占位诗获得实际复习日期
  await page.click('button:has-text("重排")')
  await page.waitForTimeout(500)
  const assigned = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('poem-quiz-data') || '{}')
    return data.records.some((r: any) => r.nextReviewDate !== '2099-01-01' && r.reviewCount === 0)
  })
  expect(assigned).toBe(true)
})
```

- [ ] **Step 3: 构建 + 跑 review-plan e2e**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vite build 2>&1 | tail -3 && npx playwright test tests/e2e/review-plan.spec.ts 2>&1 | tail -12
```

Expected: 全部通过

- [ ] **Step 4: 全量 e2e**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx playwright test 2>&1 | tail -6
```

Expected: 全部通过

- [ ] **Step 5: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add tests/e2e/review-plan.spec.ts && git commit -m "test(e2e): verify marked-learned poems get staggered review dates on rebuild"
```

---

### Task 5: 最终验证

**Files:** 无新文件

- [ ] **Step 1: 全量单测 + 类型 + 构建 + 覆盖率**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run 2>&1 | tail -4
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vue-tsc --noEmit 2>&1
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vite build 2>&1 | tail -3
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run --coverage 2>&1 | grep -E "All files|ERROR"
```

Expected: 全部通过，无 ERROR，覆盖率达标

- [ ] **Step 2: 全量 e2e**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx playwright test 2>&1 | tail -6
```

Expected: 全部通过

- [ ] **Step 3: Commit（如有未提交）**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add -A && git commit -m "chore: final verification" 2>&1 || echo "nothing to commit"
```
