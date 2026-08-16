# 架构问题修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 architecture issues identified in AI code review: recitation over-recording, wrong timeline dates, destructive migration, weak import validation, unstable shuffle, popup accessibility, and duplicate save logic.

**Architecture:** Each fix is a focused change to a specific module. The key structural change is adding `recordDetail` to separate detail recording from review scheduling, and adding `firstLearnDate` to `LearningRecord`. All other fixes are surgical removals or additions.

**Tech Stack:** Vue 3, Pinia, TypeScript, vitest, vue-focus-lock

---

### Task 1: Expand WrongEntry.quizType type

**Files:**
- Modify: `src/types/index.ts:1,44-50`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/types.test.ts — add to existing file
it('WrongEntry accepts detail quizTypes', () => {
  const entry: WrongEntry = { poemId: 'p001', quizType: 'line', wrongCount: 1, lastWrongDate: '2026-01-01', unproficient: false }
  expect(entry.quizType).toBe('line')
  const entry2: WrongEntry = { poemId: 'p001', quizType: 'author', wrongCount: 1, lastWrongDate: '2026-01-01', unproficient: false }
  expect(entry2.quizType).toBe('author')
  const entry3: WrongEntry = { poemId: 'p001', quizType: 'dynasty', wrongCount: 1, lastWrongDate: '2026-01-01', unproficient: false }
  expect(entry3.quizType).toBe('dynasty')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/types.test.ts`
Expected: FAIL — Type '"line"' is not assignable to type '"fillBlank" | "nextLine" | "recite"'

- [ ] **Step 3: Expand the type**

In `src/types/index.ts`, change line 1:

```ts
export type QuizType = 'fillBlank' | 'nextLine' | 'recite' | 'line' | 'author' | 'dynasty'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts tests/unit/types.test.ts
git commit -m "feat: expand QuizType with line/author/dynasty for detail recording"
```

---

### Task 2: Add firstLearnDate to LearningRecord

**Files:**
- Modify: `src/types/index.ts:17-28`
- Modify: `src/stores/learning.ts:21-33`

- [ ] **Step 1: Add firstLearnDate to LearningRecord interface**

In `src/types/index.ts`, add `firstLearnDate` to `LearningRecord`:

```ts
export interface LearningRecord {
  poemId: string
  lastReviewDate: string
  reviewCount: number
  nextReviewDate: string
  correctness: number[]
  reciteCorrectness: number[]
  masteryLevel: MasteryLevel
  unproficient: boolean
  unproficientCorrectStreak: number
  lastLearnDate?: string
  firstLearnDate?: string  // 首次学习日期，用于遗忘曲线时间线
}
```

- [ ] **Step 2: Set firstLearnDate in getOrCreateRecord**

In `src/stores/learning.ts`, modify `getOrCreateRecord`:

```ts
function getOrCreateRecord(poemId: string): LearningRecord {
  let record = getRecord(poemId)
  if (!record) {
    const today = new Date().toISOString().split('T')[0]
    record = {
      poemId, lastReviewDate: today, reviewCount: 0,
      nextReviewDate: today, correctness: [], reciteCorrectness: [], masteryLevel: '新',
      unproficient: false, unproficientCorrectStreak: 0,
      firstLearnDate: today,
    }
    data.value.records.push(record)
  }
  return record
}
```

- [ ] **Step 3: Write test for firstLearnDate**

In `tests/unit/learning-store.test.ts`, add:

```ts
describe('getOrCreateRecord', () => {
  it('sets firstLearnDate to today on creation', () => {
    const store = useLearningStore()
    const today = new Date().toISOString().split('T')[0]
    store.recordAnswer('p001', 'fillBlank', true)
    const record = store.getRecord('p001')
    expect(record!.firstLearnDate).toBe(today)
  })

  it('preserves firstLearnDate on subsequent answers', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', true)
    const firstDate = store.getRecord('p001')!.firstLearnDate
    store.recordAnswer('p001', 'nextLine', true)
    expect(store.getRecord('p001')!.firstLearnDate).toBe(firstDate)
  })
})
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/learning-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/stores/learning.ts tests/unit/learning-store.test.ts
git commit -m "feat: add firstLearnDate to LearningRecord for accurate timeline"
```

---

### Task 3: Add recordDetail function to learning store

**Files:**
- Modify: `src/stores/learning.ts:35-58,143-147`

- [ ] **Step 1: Write the failing test**

In `tests/unit/learning-store.test.ts`, add:

```ts
describe('recordDetail', () => {
  it('adds line detail to wrongBook', () => {
    const store = useLearningStore()
    store.recordDetail('p001', 'line', '第1句:stuck')
    expect(store.data.wrongBook).toHaveLength(1)
    expect(store.data.wrongBook[0].quizType).toBe('line')
    expect(store.data.wrongBook[0].wrongCount).toBe(1)
  })

  it('adds author detail to wrongBook', () => {
    const store = useLearningStore()
    store.recordDetail('p001', 'author')
    expect(store.data.wrongBook).toHaveLength(1)
    expect(store.data.wrongBook[0].quizType).toBe('author')
  })

  it('increments wrongCount on repeated detail', () => {
    const store = useLearningStore()
    store.recordDetail('p001', 'line')
    store.recordDetail('p001', 'line')
    expect(store.data.wrongBook).toHaveLength(1)
    expect(store.data.wrongBook[0].wrongCount).toBe(2)
  })

  it('does not affect reviewCount or correctness', () => {
    const store = useLearningStore()
    store.recordDetail('p001', 'line')
    // No learning record should be created
    const record = store.getRecord('p001')
    expect(record).toBeUndefined()
  })

  it('does not generate quizResult', () => {
    const store = useLearningStore()
    store.recordDetail('p001', 'line')
    expect(store.data.quizResults).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/learning-store.test.ts`
Expected: FAIL — store.recordDetail is not a function

- [ ] **Step 3: Implement recordDetail**

In `src/stores/learning.ts`, add after `recordAnswer` function (after line 58):

```ts
function recordDetail(poemId: string, detailType: 'line' | 'author' | 'dynasty', wrongInfo?: string) {
  const today = new Date().toISOString().split('T')[0]
  const existing = data.value.wrongBook.find(w => w.poemId === poemId && w.quizType === detailType)
  if (existing) {
    existing.wrongCount++
    existing.lastWrongDate = today
  } else {
    data.value.wrongBook.push({
      poemId,
      quizType: detailType,
      wrongCount: 1,
      lastWrongDate: today,
      unproficient: false,
    })
  }
  persist()
}
```

Update the return statement to include `recordDetail`:

```ts
return {
  data, records, wrongBook, settings, reviewDueCount, unproficientCount, wrongCount,
  getRecord, getOrCreateRecord, getMasteryLevel, recordAnswer, recordDetail, recordRecite, toggleUnproficient, removeWrongEntry,
  updateSettings, importUserData, exportUserData, clearAllData, persist,
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/learning-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/learning.ts tests/unit/learning-store.test.ts
git commit -m "feat: add recordDetail for separating detail recording from review scheduling"
```

---

### Task 4: Fix recordAnswer to clear all wrongBook on recite correct

**Files:**
- Modify: `src/stores/learning.ts:50-56`

- [ ] **Step 1: Write the failing test**

In `tests/unit/learning-store.test.ts`, add:

```ts
it('clears all wrongBook entries for poem when recite correct', () => {
  const store = useLearningStore()
  // Simulate: poem had line/author/dynasty wrong entries
  store.data.wrongBook.push(
    { poemId: 'p001', quizType: 'line' as const, wrongCount: 1, lastWrongDate: '2026-01-01', unproficient: false },
    { poemId: 'p001', quizType: 'author' as const, wrongCount: 1, lastWrongDate: '2026-01-01', unproficient: false },
    { poemId: 'p001', quizType: 'dynasty' as const, wrongCount: 1, lastWrongDate: '2026-01-01', unproficient: false },
  )
  expect(store.data.wrongBook).toHaveLength(3)
  // Correct recite answer clears all entries for this poem
  store.recordAnswer('p001', 'recite', true)
  expect(store.data.wrongBook).toHaveLength(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/learning-store.test.ts`
Expected: FAIL — expected 0, got 2 (line/author/dynasty entries remain)

- [ ] **Step 3: Implement the fix**

In `src/stores/learning.ts`, replace the wrongBook logic in `recordAnswer` (lines 50-56):

```ts
    if (!correct) {
      const existing = data.value.wrongBook.find(w => w.poemId === poemId && w.quizType === quizType)
      if (existing) { existing.wrongCount++; existing.lastWrongDate = result.date }
      else { data.value.wrongBook.push({ poemId, quizType: quizType as WrongEntry['quizType'], wrongCount: 1, lastWrongDate: result.date, unproficient: false }) }
    } else if (quizType === 'recite') {
      // 背诵正确时清除该诗所有 wrongBook 条目（包括 line/author/dynasty）
      data.value.wrongBook = data.value.wrongBook.filter(w => w.poemId !== poemId)
    } else {
      data.value.wrongBook = data.value.wrongBook.filter(w => !(w.poemId === poemId && w.quizType === quizType))
    }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/learning-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/learning.ts tests/unit/learning-store.test.ts
git commit -m "fix: recite correct clears all wrongBook entries for poem"
```

---

### Task 5: Fix submitRecitationResult to use recordDetail

**Files:**
- Modify: `src/stores/quiz.ts:200-226`

- [ ] **Step 1: Write the failing test**

In `tests/unit/quiz-store-full.test.ts`, add:

```ts
describe('submitRecitationResult separation', () => {
  it('only calls recordAnswer once per poem', () => {
    const store = useQuizStore()
    const learningStore = useLearningStore()
    store.startRecitation('all', 3)
    const poemId = store.currentQuestion!.poemId
    store.submitRecitationResult({
      poemId,
      overallStatus: 'not-mastered',
      lines: [
        { lineIndex: 0, status: 'stuck' },
        { lineIndex: 1, status: 'forgot' },
      ],
      authorCorrect: false,
      dynastyCorrect: false,
    })
    // Only 1 quizResult (from the single recordAnswer call)
    const quizResults = learningStore.data.quizResults.filter(r => r.poemId === poemId)
    expect(quizResults).toHaveLength(1)
    // Only 1 correctness entry
    const record = learningStore.getRecord(poemId)
    expect(record!.correctness).toHaveLength(1)
    // reviewCount should be 1, not 5
    expect(record!.reviewCount).toBe(1)
  })

  it('detail entries go to wrongBook via recordDetail', () => {
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
    })
    // Should have line + author wrongBook entries
    const wbEntries = learningStore.wrongBook.filter(w => w.poemId === poemId)
    expect(wbEntries.some(w => w.quizType === 'line')).toBe(true)
    expect(wbEntries.some(w => w.quizType === 'author')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/quiz-store-full.test.ts`
Expected: FAIL — quizResults length is 4 (not 1), reviewCount is 4 (not 1)

- [ ] **Step 3: Implement the fix**

In `src/stores/quiz.ts`, replace `submitRecitationResult` function (lines 200-226):

```ts
  function submitRecitationResult(result: RecitationResult) {
    if (!session.value) return
    session.value.recitationResults.push(result)

    const learningStore = useLearningStore()

    // 整体只调用一次 recordAnswer
    learningStore.recordAnswer(result.poemId, 'recite', result.overallStatus === 'mastered')

    // 细节用 recordDetail，不影响复习调度
    if (result.overallStatus !== 'mastered') {
      for (const line of result.lines) {
        if (line.status === 'stuck' || line.status === 'forgot') {
          learningStore.recordDetail(result.poemId, 'line', `第${line.lineIndex + 1}句:${line.status}`)
        }
      }
    }
    if (result.authorCorrect === false) {
      learningStore.recordDetail(result.poemId, 'author')
    }
    if (result.dynastyCorrect === false) {
      learningStore.recordDetail(result.poemId, 'dynasty')
    }

    session.value.currentIndex++
    resetCurrentRecitation()
  }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/quiz-store-full.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/quiz.ts tests/unit/quiz-store-full.test.ts
git commit -m "fix: submitRecitationResult uses recordDetail for separation"
```

---

### Task 6: Fix PoemCardPage.saveResult to use recordDetail

**Files:**
- Modify: `src/views/PoemCardPage.vue:80-98`

- [ ] **Step 1: Replace saveResult function**

In `src/views/PoemCardPage.vue`, replace the `saveResult` function (lines 80-98):

```ts
function saveResult(result: RecitationResult) {
  checkedPoemIds.value.add(result.poemId)

  // 整体只调用一次 recordAnswer
  learningStore.recordAnswer(result.poemId, 'recite', result.overallStatus === 'mastered')

  // 细节用 recordDetail，不影响复习调度
  if (result.overallStatus !== 'mastered') {
    for (const line of result.lines) {
      if (line.status === 'stuck' || line.status === 'forgot') {
        learningStore.recordDetail(result.poemId, 'line', `第${line.lineIndex + 1}句:${line.status}`)
      }
    }
  }
  if (result.authorCorrect === false) {
    learningStore.recordDetail(result.poemId, 'author')
  }
  if (result.dynastyCorrect === false) {
    learningStore.recordDetail(result.poemId, 'dynasty')
  }
}
```

- [ ] **Step 2: Run build to verify**

Run: `npx vite build`
Expected: Success

- [ ] **Step 3: Commit**

```bash
git add src/views/PoemCardPage.vue
git commit -m "fix: PoemCardPage.saveResult uses recordDetail for separation"
```

---

### Task 7: Fix calculatePoemRetentionTimeline to use firstLearnDate

**Files:**
- Modify: `src/utils/retention.ts:55-95`

- [ ] **Step 1: Write the failing test**

In `tests/unit/retention-full.test.ts`, add:

```ts
it('uses firstLearnDate when available', () => {
  const record = makeRecord({
    firstLearnDate: '2025-06-01',
    lastReviewDate: '2026-01-15',
    reviewCount: 2,
    correctness: [1, 1],
  })
  const points = calculatePoemRetentionTimeline(record, '2026-01-20')
  expect(points[0].date).toBe('2025-06-01')
})

it('falls back to lastReviewDate when firstLearnDate absent', () => {
  const record = makeRecord({
    lastReviewDate: '2026-01-01',
    reviewCount: 2,
    correctness: [1, 1],
  })
  // No firstLearnDate — should fallback to lastReviewDate
  const points = calculatePoemRetentionTimeline(record, '2026-01-10')
  expect(points[0].date).toBe('2026-01-01')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/retention-full.test.ts`
Expected: FAIL — first test expects date '2025-06-01' but gets '2026-01-15'

- [ ] **Step 3: Implement the fix**

In `src/utils/retention.ts`, replace line 62:

```ts
  const startDate = new Date((record.firstLearnDate || record.lastReviewDate) + 'T00:00:00')
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/retention-full.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/retention.ts tests/unit/retention-full.test.ts
git commit -m "fix: calculatePoemRetentionTimeline uses firstLearnDate for accurate timeline"
```

---

### Task 8: Remove migration code from storage

**Files:**
- Modify: `src/utils/storage.ts:28-33`
- Modify: `tests/unit/storage-migration.test.ts`

- [ ] **Step 1: Remove the migration check**

In `src/utils/storage.ts`, replace the `loadData` function body:

```ts
export function loadData(): UserData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultData()
    const parsed = JSON.parse(raw) as Partial<UserData>
    const defaults = getDefaultData()
    return {
      records: (parsed.records ?? defaults.records).map(r => ({ ...r, reciteCorrectness: r.reciteCorrectness ?? [] })),
      quizResults: parsed.quizResults ?? defaults.quizResults,
      reciteRecords: parsed.reciteRecords ?? defaults.reciteRecords,
      wrongBook: parsed.wrongBook ?? defaults.wrongBook,
      settings: { ...defaults.settings, ...parsed.settings },
    }
  } catch {
    return getDefaultData()
  }
}
```

- [ ] **Step 2: Update tests — remove migration tests**

In `tests/unit/storage-migration.test.ts`, remove the `describe('loadData migration', ...)` block and update the `'resets data when old poemId starts with b'` test to verify the data is now preserved:

```ts
describe('loadData with old poemId', () => {
  it('preserves data with old poemId (migration removed)', () => {
    const oldData = {
      records: [{ poemId: 'b001', lastReviewDate: '2026-01-01', reviewCount: 1, nextReviewDate: '2026-01-02', correctness: [1], masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0 }],
      quizResults: [],
      wrongBook: [],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
    }
    localStorage.setItem('poem-quiz-data', JSON.stringify(oldData))
    const data = loadData()
    // Migration code removed — data is preserved
    expect(data.records).toHaveLength(1)
    expect(data.records[0].poemId).toBe('b001')
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/storage-migration.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/utils/storage.ts tests/unit/storage-migration.test.ts
git commit -m "fix: remove destructive migration code from loadData"
```

---

### Task 9: Add default value filling to importData

**Files:**
- Modify: `src/utils/storage.ts:48-58`

- [ ] **Step 1: Write the failing test**

In `tests/unit/storage-migration.test.ts`, add:

```ts
describe('importData default value filling', () => {
  beforeEach(() => { localStorage.clear() })

  it('fills missing record fields with defaults', () => {
    const data = {
      records: [{ poemId: 'p001' }],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
    }
    expect(importData(JSON.stringify(data))).toBe(true)
    const loaded = loadData()
    expect(loaded.records[0].poemId).toBe('p001')
    expect(loaded.records[0].reviewCount).toBe(0)
    expect(loaded.records[0].correctness).toEqual([])
    expect(loaded.records[0].masteryLevel).toBe('新')
  })

  it('filters out records without poemId', () => {
    const data = {
      records: [{ poemId: '' }, { poemId: 'p001' }, {}],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
    }
    expect(importData(JSON.stringify(data))).toBe(true)
    const loaded = loadData()
    expect(loaded.records).toHaveLength(1)
    expect(loaded.records[0].poemId).toBe('p001')
  })

  it('fills missing wrongBook fields with defaults', () => {
    const data = {
      records: [],
      wrongBook: [{ poemId: 'p001', quizType: 'fillBlank' }],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
    }
    expect(importData(JSON.stringify(data))).toBe(true)
    const loaded = loadData()
    expect(loaded.wrongBook[0].wrongCount).toBe(0)
    expect(loaded.wrongBook[0].unproficient).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/storage-migration.test.ts`
Expected: FAIL — `loaded.records[0].reviewCount` is undefined

- [ ] **Step 3: Implement default value filling**

In `src/utils/storage.ts`, replace `importData` function:

```ts
const defaultRecord = {
  poemId: '',
  lastReviewDate: '',
  reviewCount: 0,
  nextReviewDate: '',
  correctness: [] as number[],
  reciteCorrectness: [] as number[],
  masteryLevel: '新' as const,
  unproficient: false,
  unproficientCorrectStreak: 0,
}

const defaultWrongEntry = {
  poemId: '',
  quizType: 'fillBlank' as const,
  wrongCount: 0,
  lastWrongDate: '',
  unproficient: false,
}

export function importData(json: string): boolean {
  try {
    const parsed = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null) return false
    if (!Array.isArray(parsed.records)) return false
    if (!parsed.settings || typeof parsed.settings !== 'object') return false

    const defaults = getDefaultData()
    const data: UserData = {
      records: parsed.records
        .map((r: any) => ({ ...defaultRecord, ...r }))
        .filter((r: any) => r.poemId),
      quizResults: parsed.quizResults ?? defaults.quizResults,
      reciteRecords: parsed.reciteRecords ?? defaults.reciteRecords,
      wrongBook: (parsed.wrongBook ?? []).map((w: any) => ({ ...defaultWrongEntry, ...w })),
      settings: { ...defaults.settings, ...parsed.settings },
    }
    saveData(data)
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/storage-migration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/storage.ts tests/unit/storage-migration.test.ts
git commit -m "fix: importData fills missing fields with defaults, filters invalid records"
```

---

### Task 10: Replace shuffleArray with priority-based sorting in allPoems

**Files:**
- Modify: `src/views/PoemCardPage.vue:12,57-66`

- [ ] **Step 1: Write the failing test**

In `tests/unit/quiz.test.ts` or a new test file, add a test for the sorting stability. Actually, since `allPoems` is a computed in a Vue component, we'll test via the existing component test. Instead, verify the change by checking the import and removing shuffleArray usage.

- [ ] **Step 2: Replace allPoems computed with priority-based sorting**

In `src/views/PoemCardPage.vue`, replace the `allPoems` computed (lines 57-66):

```ts
const allPoems = computed(() => {
  const enabled = poemStore.enabledPoems
  if (source.value === 'all') return [...enabled].sort((a, b) => a.id.localeCompare(b.id))
  if (source.value === 'smart') {
    return [...enabled].sort((a, b) => {
      const today = new Date().toISOString().split('T')[0]
      // 优先级：到期需复习 > wrongBook > reviewCount 低 > poemId
      const aDue = learningStore.getRecord(a.id)?.nextReviewDate ?? ''
      const bDue = learningStore.getRecord(b.id)?.nextReviewDate ?? ''
      const aDueFlag = aDue <= today ? 0 : 1
      const bDueFlag = bDue <= today ? 0 : 1
      if (aDueFlag !== bDueFlag) return aDueFlag - bDueFlag
      const aWrong = learningStore.wrongBook.some(w => w.poemId === a.id) ? 0 : 1
      const bWrong = learningStore.wrongBook.some(w => w.poemId === b.id) ? 0 : 1
      if (aWrong !== bWrong) return aWrong - bWrong
      const aCount = learningStore.getRecord(a.id)?.reviewCount ?? 0
      const bCount = learningStore.getRecord(b.id)?.reviewCount ?? 0
      if (aCount !== bCount) return aCount - bCount
      return a.id.localeCompare(b.id)
    })
  }
  if (source.value === 'grade') return enabled.filter(p => selectedGrades.value.includes(p.grade))
  if (source.value === 'review') return getReviewPoems(enabled, learningStore.records, today)
  if (source.value === 'wrong') return getWrongPoems(enabled, learningStore.wrongBook)
  if (source.value === 'unproficient') return getUnproficientPoems(enabled, learningStore.records)
  return [...enabled].sort((a, b) => a.id.localeCompare(b.id))
})
```

Also remove the `shuffleArray` import from line 12:

```ts
import { getReviewPoems, getWrongPoems, getUnproficientPoems } from '@/utils/quiz'
```

- [ ] **Step 3: Run build to verify**

Run: `npx vite build`
Expected: Success

- [ ] **Step 4: Commit**

```bash
git add src/views/PoemCardPage.vue
git commit -m "fix: replace shuffleArray with stable priority-based sorting in allPoems"
```

---

### Task 11: Add vue-focus-lock and fix PoemPopup accessibility

**Files:**
- Modify: `package.json` (add vue-focus-lock)
- Modify: `src/components/PoemPopup.vue`

- [ ] **Step 1: Install vue-focus-lock**

Run: `npm install vue-focus-lock`

- [ ] **Step 2: Update PoemPopup.vue**

Replace the entire `src/components/PoemPopup.vue`:

```vue
<template>
  <Teleport to="body">
    <Transition name="popup">
      <div v-if="visible" class="popup-overlay" role="dialog" aria-modal="true" aria-label="古诗详情" @keydown.escape="$emit('update:visible', false)" @click.self="$emit('update:visible', false)">
        <FocusLock :return-focus="true">
          <div class="popup-content" ref="contentRef" tabindex="-1">
            <div class="popup-header">
              <h3 class="popup-title">{{ poem.title }}</h3>
              <span class="popup-meta">{{ poem.dynasty }}·{{ poem.author }}</span>
            </div>
            <div class="popup-body">
              <p v-for="(line, i) in poem.text" :key="i" class="popup-line">{{ line }}</p>
            </div>
            <div class="popup-yiwen-toggle">
              <button
                :class="['yiwen-btn', showYiwen ? 'yiwen-btn-active' : '']"
                @click="toggleYiwen"
              >
                {{ showYiwen ? '隐藏译文 ▴' : '显示译文 ▾' }}
              </button>
            </div>
            <div v-if="showYiwen" class="popup-yiwen">
              <p class="yiwen-text">{{ poem.yiwen }}</p>
            </div>
          </div>
        </FocusLock>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import FocusLock from 'vue-focus-lock'
import type { Poem } from '@/types'
import { useLearningStore } from '@/stores/learning'

const props = defineProps<{
  poem: Poem
  visible: boolean
}>()

defineEmits<{
  'update:visible': [value: boolean]
}>()

const learningStore = useLearningStore()
const showYiwen = ref(learningStore.settings.showYiwen ?? false)
const contentRef = ref<HTMLElement | null>(null)

watch(() => props.visible, (v) => {
  if (v) {
    showYiwen.value = learningStore.settings.showYiwen ?? false
    nextTick(() => contentRef.value?.focus())
  }
})

function toggleYiwen() {
  showYiwen.value = !showYiwen.value
  learningStore.updateSettings({ showYiwen: showYiwen.value })
}
</script>

<style scoped>
.popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}
.popup-content {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 320px;
  width: 100%;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
  outline: none;
}
.popup-header {
  text-align: center;
  margin-bottom: 1rem;
}
.popup-title {
  font-size: 1.125rem;
  font-weight: bold;
  color: var(--color-text);
}
.popup-meta {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-top: 0.25rem;
  display: block;
}
.popup-body {
  text-align: center;
}
.popup-line {
  font-size: 1rem;
  line-height: 2;
  color: var(--color-text);
}
.popup-yiwen-toggle {
  text-align: center;
  margin-top: 0.75rem;
}
.yiwen-btn {
  font-size: 0.8125rem;
  color: #6366f1;
  background: #eef2ff;
  border: 2px solid #c7d2fe;
  border-radius: 6px;
  cursor: pointer;
  padding: 0.375rem 1rem;
  transition: all 0.15s;
}
.yiwen-btn:hover {
  background: #e0e7ff;
}
.yiwen-btn-active {
  background: #6366f1;
  color: white;
  border-color: #6366f1;
}
.yiwen-btn-active:hover {
  background: #4f46e5;
}
.popup-yiwen {
  text-align: center;
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid #f0f0f0;
}
.yiwen-text {
  font-size: 0.875rem;
  line-height: 1.8;
  color: var(--color-text-secondary);
}
.popup-enter-active,
.popup-leave-active {
  transition: opacity 0.2s ease;
}
.popup-enter-from,
.popup-leave-to {
  opacity: 0;
}
</style>
```

- [ ] **Step 3: Run build to verify**

Run: `npx vite build`
Expected: Success

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/PoemPopup.vue
git commit -m "feat: add vue-focus-lock + ARIA + Escape key to PoemPopup"
```

---

### Task 12: Run full test suite and verify

**Files:** None

- [ ] **Step 1: Run unit tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run coverage check**

Run: `npx vitest run --coverage`
Expected: Stmts >= 80%, Branch >= 65%

- [ ] **Step 3: Build and run E2E tests**

Run: `npx vite build && npx playwright test`
Expected: E2E tests pass (excluding pre-existing failures)

- [ ] **Step 4: Commit if any test fixes needed**

```bash
git add -A
git commit -m "test: fix tests after architecture fixes"
```

---

### Task 13: Update learning.ts importUserData to use default filling

**Files:**
- Modify: `src/stores/learning.ts:112-120`

- [ ] **Step 1: Update importUserData to delegate to storage.importData**

In `src/stores/learning.ts`, replace `importUserData`:

```ts
function importUserData(json: string): boolean {
  try {
    const { importData } = await import('@/utils/storage')
    const success = importData(json)
    if (success) data.value = loadData()
    return success
  } catch { return false }
}
```

Actually, since `importData` is a sync function, we can just call it directly:

```ts
function importUserData(json: string): boolean {
  const success = importDataUtil(json)
  if (success) data.value = loadData()
  return success
}
```

But we need to rename the import to avoid name collision. Let's rename the storage import:

```ts
import { loadData, saveData, importData as importDataUtil } from '@/utils/storage'
```

Then replace `importUserData`:

```ts
function importUserData(json: string): boolean {
  const success = importDataUtil(json)
  if (success) data.value = loadData()
  return success
}
```

- [ ] **Step 2: Update the import line**

In `src/stores/learning.ts`, change line 4:

```ts
import { loadData, saveData, importData as importDataUtil } from '@/utils/storage'
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/learning-store.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/stores/learning.ts
git commit -m "refactor: importUserData delegates to storage.importData with default filling"
```
