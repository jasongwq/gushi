# 快速配置已学 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 计划页支持快速批量标记古诗为"已学"：复用学习记录检查（有 LearningRecord 即已学），批量创建最小学习记录并从排程移除，不再排入"新增学习"。

**Architecture:** 复用现有模式。`learning.ts` 新增 `markLearned(poemIds: string[])` 方法（批量创建最小记录 + 从 schedule 移除）。`ReviewPlanPage.vue` 顶部节奏旁加「批量配置」按钮，进入覆盖式批量勾选界面（所有未学诗、按年级分组、多选、确认/取消）。

**Tech Stack:** Vue 3 + Pinia + TypeScript + Tailwind CSS + Vitest + Playwright

**Prerequisite:** 在 worktree `.codebuddy/worktrees/review-plan` 中开发。

---

### Task 1: store 方法 markLearned

**Files:**
- Modify: `src/stores/learning.ts`
- Test: `tests/unit/learning-store.test.ts`（或新建 `tests/unit/learning-mark-learned.test.ts`）

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/learning-mark-learned.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLearningStore } from '@/stores/learning'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('markLearned', () => {
  it('creates minimal records for the given poems', () => {
    const store = useLearningStore()
    store.markLearned(['p001', 'p002'])
    const r1 = store.getRecord('p001')
    const r2 = store.getRecord('p002')
    expect(r1).toBeDefined()
    expect(r1!.reviewCount).toBe(0)
    expect(r1!.masteryLevel).toBe('新')
    expect(r1!.lastReviewDate).toBe(new Date().toISOString().split('T')[0])
    expect(r2).toBeDefined()
    expect(r2!.reviewCount).toBe(0)
  })

  it('keeps existing records unchanged', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', true)
    const before = store.getRecord('p001')!.reviewCount
    store.markLearned(['p001'])
    expect(store.getRecord('p001')!.reviewCount).toBe(before)
  })

  it('removes marked poems from schedule', () => {
    const store = useLearningStore()
    store.setSchedule({ p001: '2026-08-19', p002: '2026-08-19' })
    store.markLearned(['p001'])
    expect(store.getSchedule()).toEqual({ p002: '2026-08-19' })
  })

  it('persists records to localStorage', () => {
    const store = useLearningStore()
    store.markLearned(['p001'])
    // 重新加载应保留
    const raw = localStorage.getItem('poem-quiz-data')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.records.some((r: any) => r.poemId === 'p001')).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run tests/unit/learning-mark-learned.test.ts 2>&1 | tail -8
```

Expected: FAIL — `store.markLearned is not a function`

- [ ] **Step 3: 实现 markLearned**

在 `learning.ts` 的 `clearAllData` 上方（getSchedule 方法附近）加：

```typescript
  // 批量标记已学：创建最小学习记录（不触发复习调度），并从排程移除
  function markLearned(poemIds: string[]) {
    const today = new Date().toISOString().split('T')[0]
    for (const poemId of poemIds) {
      if (!getRecord(poemId)) {
        data.value.records.push({
          poemId, lastReviewDate: today, reviewCount: 0,
          nextReviewDate: today, correctness: [], reciteCorrectness: [],
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

在 return 中加 `markLearned`：

```typescript
    getSchedule, setSchedule, clearSchedule, rebuildSchedule, markLearned,
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

Expected: 无错误，全部通过

- [ ] **Step 6: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add src/stores/learning.ts tests/unit/learning-mark-learned.test.ts && git commit -m "feat: add markLearned batch method to learning store"
```

---

### Task 2: 计划页批量配置界面

**Files:**
- Modify: `src/views/ReviewPlanPage.vue`

- [ ] **Step 1: 加批量配置状态和逻辑**

在 `<script setup>` 中 `const showNotLearned = ref(false)` 附近加：

```typescript
// 批量配置已学
const showBatchConfig = ref(false)
const selectedLearned = ref<Set<string>>(new Set())

// 按年级分组的未学诗
const unlearnedByGrade = computed(() => {
  const map = new Map<string, Poem[]>()
  for (const p of unlearnedPoems.value) {
    const list = map.get(p.grade) ?? []
    list.push(p)
    map.set(p.grade, list)
  }
  return [...map.entries()]
})

function openBatchConfig() {
  selectedLearned.value = new Set()
  showBatchConfig.value = true
}

function toggleSelect(poemId: string) {
  const next = new Set(selectedLearned.value)
  if (next.has(poemId)) next.delete(poemId)
  else next.add(poemId)
  selectedLearned.value = next
}

function isSelected(poemId: string): boolean {
  return selectedLearned.value.has(poemId)
}

function confirmMarkLearned() {
  if (selectedLearned.value.size === 0) return
  learningStore.markLearned([...selectedLearned.value])
  showBatchConfig.value = false
  initExpand()
}
```

注意：需要 import `Poem` 类型。

- [ ] **Step 2: 加「批量配置」按钮**

在节奏选择器/重排按钮那行，重排按钮后加：

```html
      <button
        class="px-3 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-sm cursor-pointer hover:bg-indigo-50 transition"
        @click="openBatchConfig"
      >批量配置</button>
```

- [ ] **Step 3: 加批量配置覆盖式界面**

在页面根 div 内、末尾（router-link 后）加：

```html
    <!-- 批量配置已学 覆盖层 -->
    <div v-if="showBatchConfig" class="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div class="max-w-md mx-auto p-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold">批量配置已学</h3>
          <button class="text-sm text-gray-500 cursor-pointer" @click="showBatchConfig = false">关闭</button>
        </div>
        <p class="text-xs text-gray-400 mb-3">勾选已学过的诗（已从学习队列移除，不再排入新增学习）</p>

        <div v-for="[grade, list] in unlearnedByGrade" :key="grade" class="mb-4">
          <div class="text-sm font-medium text-gray-500 mb-1">{{ grade }}（{{ list.length }} 首）</div>
          <div class="space-y-1">
            <label
              v-for="p in list"
              :key="p.id"
              class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <input type="checkbox" :checked="isSelected(p.id)" @change="toggleSelect(p.id)" class="w-4 h-4" />
              <span class="flex-1 text-sm">{{ p.title }}</span>
              <span v-if="p.author" class="text-xs text-gray-400">{{ p.author }}</span>
            </label>
          </div>
        </div>

        <div v-if="unlearnedByGrade.length === 0" class="text-center text-gray-400 text-sm py-8">
          没有未学的诗
        </div>

        <button
          class="w-full p-4 bg-indigo-500 text-white rounded-lg text-lg font-medium cursor-pointer hover:bg-indigo-600 transition mb-3"
          :disabled="selectedLearned.size === 0"
          :class="selectedLearned.size === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : ''"
          @click="confirmMarkLearned"
        >确认标记（{{ selectedLearned.size }}）</button>
        <button class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-500 text-sm cursor-pointer hover:bg-gray-50 transition" @click="showBatchConfig = false">
          取消
        </button>
      </div>
    </div>
```

- [ ] **Step 4: 更新组件测试**

在 `tests/component/ReviewPlanPage.test.ts` 追加：

```typescript
  it('opens batch config and marks poems as learned', async () => {
    const store = useLearningStore()
    const wrapper = mountPage()
    await flushPromises()
    // 打开批量配置
    await wrapper.findAll('button').find(b => b.text().includes('批量配置'))!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('批量配置已学')
    // 勾选第一首并确认
    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.trigger('change')
    await wrapper.findAll('button').find(b => b.text().includes('确认标记'))!.trigger('click')
    await flushPromises()
    // 该诗已有学习记录
    const learned = store.records.filter(r => r.reviewCount === 0)
    expect(learned.length).toBeGreaterThan(0)
  })

  it('cancel closes batch config without changes', async () => {
    const store = useLearningStore()
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text().includes('批量配置'))!.trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text() === '取消')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('批量配置已学')
    expect(store.records.length).toBe(0)
  })
```

- [ ] **Step 5: 类型检查 + 构建 + 全量单测**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vue-tsc --noEmit 2>&1 | head -5
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vite build 2>&1 | tail -3
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vitest run 2>&1 | tail -4
```

Expected: 无错误，构建成功，全部通过

- [ ] **Step 6: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add src/views/ReviewPlanPage.vue tests/component/ReviewPlanPage.test.ts && git commit -m "feat: add batch mark-learned config UI to review plan page"
```

---

### Task 3: e2e 测试

**Files:**
- Modify: `tests/e2e/review-plan.spec.ts`

- [ ] **Step 1: 写 e2e 测试**

在 `tests/e2e/review-plan.spec.ts` 末尾追加：

```typescript
test('review plan page: batch mark poems as learned', async ({ page }) => {
  await page.goto('/#/review-plan')
  // 打开批量配置
  await expect(page.locator('button:has-text("批量配置")')).toBeVisible({ timeout: 10000 })
  await page.click('button:has-text("批量配置")')
  await expect(page.locator('text=批量配置已学')).toBeVisible({ timeout: 5000 })

  // 勾选第一首诗
  const checkbox = page.locator('input[type="checkbox"]').first()
  await checkbox.check()

  // 确认标记
  await page.click('button:has-text("确认标记")')

  // 批量配置界面关闭
  await expect(page.locator('text=批量配置已学')).not.toBeVisible({ timeout: 5000 })

  // 该诗已有学习记录（检查 localStorage）
  const records = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('poem-quiz-data') || '{}')
    return data.records || []
  })
  expect(records.length).toBeGreaterThan(0)
})

test('review plan page: batch config cancel keeps state unchanged', async ({ page }) => {
  await page.goto('/#/review-plan')
  await page.click('button:has-text("批量配置")')
  await expect(page.locator('text=批量配置已学')).toBeVisible({ timeout: 5000 })
  await page.click('button:has-text("取消")')
  await expect(page.locator('text=批量配置已学')).not.toBeVisible({ timeout: 5000 })
})
```

- [ ] **Step 2: 构建 + 跑 review-plan e2e**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx vite build 2>&1 | tail -3 && npx playwright test tests/e2e/review-plan.spec.ts 2>&1 | tail -12
```

Expected: 全部通过（10 个）

- [ ] **Step 3: 全量 e2e**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && npx playwright test 2>&1 | tail -6
```

Expected: 全部通过

- [ ] **Step 4: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/review-plan && git add tests/e2e/review-plan.spec.ts && git commit -m "test(e2e): batch mark-learned flow on review plan page"
```

---

### Task 4: 最终验证

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
