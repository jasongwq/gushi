# 古诗集合页面搜索功能 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在古诗集合页面添加搜索功能，支持按标题、作者、内容模糊匹配，标题权重最高。

**Architecture:** 新增 `utils/search.ts` 工具函数处理模糊匹配与排序逻辑，在 `PoemCollectionPage.vue` 中添加搜索框 UI 和搜索结果列表，通过 computed 属性实时过滤。搜索时隐藏分类标签栏，清空搜索后恢复分类视图。

**Tech Stack:** Vue 3 (Composition API + `<script setup>`), TypeScript, Tailwind CSS, Vitest

---

### Task 1: 模糊匹配工具函数

**Files:**
- Create: `src/utils/search.ts`
- Create: `tests/unit/search.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/search.test.ts
import { describe, it, expect } from 'vitest'
import { fuzzyMatch, searchPoems } from '@/utils/search'
import type { Poem } from '@/types'

describe('fuzzyMatch', () => {
  it('matches exact substring', () => {
    expect(fuzzyMatch('静夜思', '夜思')).toBe(true)
  })

  it('matches subsequence characters', () => {
    expect(fuzzyMatch('静夜思', '静思')).toBe(true)
  })

  it('returns false when characters are out of order', () => {
    expect(fuzzyMatch('静夜思', '思静')).toBe(false)
  })

  it('returns false when character not found', () => {
    expect(fuzzyMatch('静夜思', '李白')).toBe(false)
  })

  it('matches case-insensitively', () => {
    expect(fuzzyMatch('Hello World', 'hlo')).toBe(true)
  })

  it('returns true for empty query', () => {
    expect(fuzzyMatch('静夜思', '')).toBe(true)
  })
})

describe('searchPoems', () => {
  const poems: Poem[] = [
    { id: 'p001', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级', text: ['床前明月光，', '疑是地上霜。', '举头望明月，', '低头思故乡。'], textType: '五言', yiwen: '译文' },
    { id: 'p002', title: '春晓', author: '孟浩然', dynasty: '唐', grade: '一年级', text: ['春眠不觉晓，', '处处闻啼鸟。'], textType: '五言', yiwen: '译文' },
    { id: 'p003', title: '望庐山瀑布', author: '李白', dynasty: '唐', grade: '二年级', text: ['日照香炉生紫烟，', '遥看瀑布挂前川。'], textType: '七言', yiwen: '译文' },
    { id: 'p004', title: '咏鹅', author: '骆宾王', dynasty: '唐', grade: '一年级', text: ['鹅，鹅，鹅，', '曲项向天歌。', '白毛浮绿水，', '红掌拨清波。'], textType: '其他', yiwen: '译文' },
  ]

  it('returns title matches first, then author=content', () => {
    const results = searchPoems(poems, '李白')
    // p001 and p003 match by author "李白"
    expect(results.map(p => p.id)).toEqual(['p001', 'p003'])
  })

  it('title matches rank higher than author matches', () => {
    // "望" matches p003 title "望庐山瀑布" and no other
    const results = searchPoems(poems, '望')
    expect(results.map(p => p.id)).toEqual(['p003'])
  })

  it('does not duplicate poems that match in multiple fields', () => {
    // "静夜思" matches p001 title, also p001 content contains "思故乡"
    const results = searchPoems(poems, '静思')
    expect(results.filter(p => p.id === 'p001').length).toBe(1)
  })

  it('returns empty array when no matches', () => {
    const results = searchPoems(poems, '杜甫')
    expect(results).toEqual([])
  })

  it('returns all poems for empty query', () => {
    const results = searchPoems(poems, '')
    expect(results.length).toBe(4)
  })

  it('matches content text', () => {
    const results = searchPoems(poems, '明月')
    // p001 content has "明月光" and "望明月" — title "静夜思" does not contain "明月"
    expect(results.map(p => p.id)).toEqual(['p001'])
  })

  it('preserves original order within same priority level', () => {
    const results = searchPoems(poems, '李白')
    expect(results.map(p => p.id)).toEqual(['p001', 'p003'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/poem-search && npx vitest run tests/unit/search.test.ts`
Expected: FAIL — `Cannot find module '@/utils/search'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/utils/search.ts
import type { Poem } from '@/types'

/**
 * Fuzzy match: checks if query characters appear as a subsequence in target.
 * Also matches exact substrings. Case-insensitive.
 */
export function fuzzyMatch(target: string, query: string): boolean {
  if (!query) return true
  const t = target.toLowerCase()
  const q = query.toLowerCase()
  let ti = 0
  for (let qi = 0; qi < q.length; qi++) {
    const found = t.indexOf(q[qi], ti)
    if (found === -1) return false
    ti = found + 1
  }
  return true
}

/**
 * Search poems by query across title, author, and content fields.
 * Returns results sorted by priority: title matches > author matches = content matches.
 * Within the same priority level, preserves original array order.
 * Each poem appears at most once, at its highest priority position.
 */
export function searchPoems(poems: Poem[], query: string): Poem[] {
  if (!query) return poems

  const titleMatches: Poem[] = []
  const authorMatches: Poem[] = []
  const contentMatches: Poem[] = []
  const seenIds = new Set<string>()

  for (const poem of poems) {
    if (fuzzyMatch(poem.title, query)) {
      titleMatches.push(poem)
      seenIds.add(poem.id)
    }
  }

  for (const poem of poems) {
    if (seenIds.has(poem.id)) continue
    if (fuzzyMatch(poem.author, query)) {
      authorMatches.push(poem)
      seenIds.add(poem.id)
    }
  }

  for (const poem of poems) {
    if (seenIds.has(poem.id)) continue
    const fullText = poem.text.join('')
    if (fuzzyMatch(fullText, query)) {
      contentMatches.push(poem)
      seenIds.add(poem.id)
    }
  }

  return [...titleMatches, ...authorMatches, ...contentMatches]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/poem-search && npx vitest run tests/unit/search.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/poem-search
git add src/utils/search.ts tests/unit/search.test.ts
git commit -m "feat: add fuzzy search utility with priority-based sorting"
```

---

### Task 2: 搜索框 UI 与搜索结果列表

**Files:**
- Modify: `src/views/PoemCollectionPage.vue`

- [ ] **Step 1: Add search state and computed to PoemCollectionPage.vue**

In the `<script setup>` section, add the following after the existing `activeAuthor` ref (line 88):

```typescript
import { searchPoems } from '@/utils/search'

const searchQuery = ref('')

const isSearching = computed(() => searchQuery.value.trim().length > 0)

const searchResults = computed(() => {
  if (!isSearching.value) return []
  return searchPoems(poemStore.enabledPoems, searchQuery.value.trim())
})

const displayPoems = computed(() => {
  if (isSearching.value) return searchResults.value
  if (categoryMode.value === 'grade') {
    return poemStore.poemsByGrade.get(activeGrade.value) ?? []
  } else {
    return poemStore.poemsByAuthor.get(activeAuthor.value) ?? []
  }
})

function clearSearch() {
  searchQuery.value = ''
}
```

- [ ] **Step 2: Add search bar template in PoemCollectionPage.vue**

In the `<template>` section, add the search bar between the `<h2>` heading and the category toggle div (after line 3, before line 5):

```html
    <!-- 搜索框 -->
    <div class="relative mb-4">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索古诗…"
        class="w-full pl-9 pr-8 py-2 bg-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-300 transition"
      />
      <button
        v-if="searchQuery"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        @click="clearSearch"
      >
        <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
```

- [ ] **Step 3: Conditionally hide category toggle and tabs when searching**

Replace the category toggle div (lines 6-15) and the grade/author tabs (lines 17-43) with conditional rendering:

Change the category toggle div opening tag from:
```html
    <div class="flex gap-2 mb-4">
```
to:
```html
    <div v-if="!isSearching" class="flex gap-2 mb-4">
```

Change the grade tabs template opening tag from:
```html
    <template v-if="categoryMode === 'grade'">
```
to:
```html
    <template v-if="!isSearching && categoryMode === 'grade'">
```

Change the author tabs template opening tag from:
```html
    <template v-else>
```
to:
```html
    <template v-else-if="!isSearching">
```

- [ ] **Step 4: Use displayPoems and add empty state for search**

Replace the current poem list section (lines 45-64) with:

```html
    <div v-if="displayPoems.length === 0" class="text-center text-gray-400 py-12">
      {{ isSearching ? '未找到相关古诗' : '暂无古诗' }}
    </div>

    <div v-else class="space-y-2">
      <div v-for="poem in displayPoems" :key="poem.id" class="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div class="flex items-center gap-2">
          <span
            class="font-bold flex-1 cursor-pointer text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300"
            @click="togglePopup(poem.id)"
          >
            {{ poem.title }}
          </span>
          <span class="text-sm text-gray-500">{{ poem.dynasty }}·{{ poem.author }}</span>
          <span :class="['text-xs px-1.5 py-0.5 rounded', masteryClass(poem.id)]">
            {{ learningStore.getMasteryLevel(poem.id) }}
          </span>
        </div>
      </div>
    </div>
```

- [ ] **Step 5: Verify the app builds and runs**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/poem-search && npx vite build 2>&1 | tail -5`
Expected: Build succeeds with no errors

- [ ] **Step 6: Run existing tests to verify no regressions**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/poem-search && npx vitest run 2>&1 | grep -E "Tests|Test Files"`
Expected: All test files pass (13 passed), same test count as baseline

- [ ] **Step 7: Commit**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/poem-search
git add src/views/PoemCollectionPage.vue
git commit -m "feat: add search bar to poem collection page with fuzzy matching"
```

---

### Task 3: 验证与收尾

**Files:**
- Verify: `src/utils/search.ts`
- Verify: `src/views/PoemCollectionPage.vue`

- [ ] **Step 1: Run full test suite**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/poem-search && npx vitest run 2>&1 | grep -E "Tests|Test Files"`
Expected: All tests pass

- [ ] **Step 2: Verify build succeeds**

Run: `cd /root/古诗抽查/.codebuddy/worktrees/poem-search && npx vite build 2>&1 | tail -3`
Expected: Build succeeds

- [ ] **Step 3: Final commit (if any remaining changes)**

```bash
cd /root/古诗抽查/.codebuddy/worktrees/poem-search
git add -A
git diff --cached --quiet || git commit -m "chore: final cleanup for search feature"
```
