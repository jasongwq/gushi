# 未启用古诗全面隐藏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在设置中取消选择的古诗，在古诗集合、错题本、首页、抽查选诗来源等所有地方都不再出现。

**Architecture:** 改造 poemStore 的 `grades`、`poemsByGrade`、`poemsByAuthor`、`authors` 计算属性为基于 `enabledPoems`，新增 `allGrades` 供设置页使用。各页面消费方自动获得过滤后的数据。

**Tech Stack:** Vue 3, Pinia, TypeScript

---

### Task 1: 改造 poemStore 计算属性

**Files:**
- Modify: `src/stores/poem.ts`

- [ ] **Step 1: 改造 `grades`、`poemsByGrade`、`poemsByAuthor`、`authors` 为基于 `enabledPoems`，新增 `allGrades`，修复 `toggleGrade` 和 `gradeEnabledCount`**

将 `src/stores/poem.ts` 的内容替换为：

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Poem } from '@/types'
import { useLearningStore } from './learning'

export const usePoemStore = defineStore('poem', () => {
  const poems = ref<Poem[]>([])
  const loading = ref(false)

  const GRADE_ORDER: Record<string, number> = {
    '一年级': 1, '二年级': 2, '三年级': 3,
    '四年级': 4, '五年级': 5, '六年级': 6, '配读篇目': 7,
  }

  // 全量年级列表（供设置页使用）
  const allGrades = computed(() => {
    return [...new Set(poems.value.map(p => p.grade))].sort((a, b) => (GRADE_ORDER[a] ?? 99) - (GRADE_ORDER[b] ?? 99))
  })

  // 基于已启用古诗的年级列表
  const grades = computed(() => {
    return [...new Set(enabledPoems.value.map(p => p.grade))].sort((a, b) => (GRADE_ORDER[a] ?? 99) - (GRADE_ORDER[b] ?? 99))
  })

  const enabledPoems = computed(() => {
    const learningStore = useLearningStore()
    const enabledSet = learningStore.settings.enabledPoems
    if (enabledSet.length === 0) return poems.value
    const ids = new Set(enabledSet)
    return poems.value.filter(p => ids.has(p.id))
  })

  // 基于已启用古诗按年级分组
  const poemsByGrade = computed(() => {
    const map = new Map<string, Poem[]>()
    for (const poem of enabledPoems.value) {
      const list = map.get(poem.grade) ?? []
      list.push(poem)
      map.set(poem.grade, list)
    }
    return map
  })

  // 基于已启用古诗按诗人分组
  const poemsByAuthor = computed(() => {
    const map = new Map<string, Poem[]>()
    for (const poem of enabledPoems.value) {
      const list = map.get(poem.author) ?? []
      list.push(poem)
      map.set(poem.author, list)
    }
    // Group single-poem authors into "其他"
    const otherPoems: Poem[] = []
    const toRemove: string[] = []
    for (const [author, authorPoems] of map) {
      if (authorPoems.length <= 1) {
        otherPoems.push(...authorPoems)
        toRemove.push(author)
      }
    }
    for (const author of toRemove) {
      map.delete(author)
    }
    if (otherPoems.length > 0) {
      map.set('其他', otherPoems)
    }
    return map
  })

  // 基于已启用古诗的诗人列表
  const authors = computed(() => {
    const countMap = new Map<string, number>()
    for (const poem of enabledPoems.value) {
      countMap.set(poem.author, (countMap.get(poem.author) ?? 0) + 1)
    }
    const multiAuthor = [...countMap.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([author]) => author)
    const hasSingle = [...countMap.entries()].some(([, count]) => count <= 1)
    return hasSingle ? [...multiAuthor, '其他'] : multiAuthor
  })

  function isEnabled(poemId: string): boolean {
    const learningStore = useLearningStore()
    const enabledSet = learningStore.settings.enabledPoems
    if (enabledSet.length === 0) return true
    return enabledSet.includes(poemId)
  }

  function togglePoem(poemId: string) {
    const learningStore = useLearningStore()
    const current = learningStore.settings.enabledPoems
    if (current.length === 0) {
      const allIds = poems.value.map(p => p.id)
      learningStore.updateSettings({ enabledPoems: allIds.filter(id => id !== poemId) })
    } else {
      const idx = current.indexOf(poemId)
      if (idx >= 0) {
        const next = [...current]
        next.splice(idx, 1)
        learningStore.updateSettings({ enabledPoems: next })
      } else {
        learningStore.updateSettings({ enabledPoems: [...current, poemId] })
      }
    }
  }

  function toggleGrade(grade: string, enabled: boolean) {
    const learningStore = useLearningStore()
    const current = learningStore.settings.enabledPoems
    // 直接从全量 poems 过滤获取某年级古诗 ID
    const gradeIds = poems.value.filter(p => p.grade === grade).map(p => p.id)

    if (current.length === 0) {
      if (!enabled) {
        const excludeSet = new Set(gradeIds)
        learningStore.updateSettings({ enabledPoems: poems.value.filter(p => !excludeSet.has(p.id)).map(p => p.id) })
      }
    } else {
      if (enabled) {
        const existingSet = new Set(current)
        const toAdd = gradeIds.filter(id => !existingSet.has(id))
        learningStore.updateSettings({ enabledPoems: [...current, ...toAdd] })
      } else {
        const excludeSet = new Set(gradeIds)
        learningStore.updateSettings({ enabledPoems: current.filter((id: string) => !excludeSet.has(id)) })
      }
    }
  }

  const enabledCount = computed(() => enabledPoems.value.length)

  function gradeEnabledCount(grade: string): number {
    const learningStore = useLearningStore()
    const enabledSet = learningStore.settings.enabledPoems
    const gradePoems = poems.value.filter(p => p.grade === grade)
    if (enabledSet.length === 0) return gradePoems.length
    const ids = new Set(enabledSet)
    return gradePoems.filter(p => ids.has(p.id)).length
  }

  async function fetchPoems() {
    if (poems.value.length > 0) return
    loading.value = true
    try {
      const resp = await fetch('/poems.json')
      poems.value = await resp.json()
    } finally {
      loading.value = false
    }
  }

  function getPoemById(id: string): Poem | undefined {
    return poems.value.find(p => p.id === id)
  }

  return { poems, loading, allGrades, grades, poemsByGrade, poemsByAuthor, authors, enabledPoems, enabledCount, fetchPoems, getPoemById, isEnabled, togglePoem, toggleGrade, gradeEnabledCount }
})
```

关键改动：
- `grades` 改为从 `enabledPoems` 提取
- `poemsByGrade` 改为从 `enabledPoems` 分组
- `poemsByAuthor` 改为从 `enabledPoems` 分组，内部变量 `poems` 重命名为 `authorPoems` 避免遮蔽外层
- `authors` 改为从 `enabledPoems` 提取
- 新增 `allGrades`（全量年级，供设置页使用）
- `toggleGrade` 改为直接从 `poems` 过滤获取年级 ID
- `gradeEnabledCount` 改为直接从 `poems` 过滤获取年级古诗
- return 中新增 `allGrades`

- [ ] **Step 2: 验证构建通过**

Run: `cd /root/古诗抽查 && npx vue-tsc --noEmit 2>&1 | head -30`
Expected: 无类型错误（可能因 PoemConfigPage 未更新而有错误，下一步修复）

- [ ] **Step 3: Commit**

```bash
git add src/stores/poem.ts
git commit -m "refactor: make grades/poemsByGrade/poemsByAuthor/authors based on enabledPoems"
```

---

### Task 2: 修改 PoemConfigPage 使用全量数据

**Files:**
- Modify: `src/views/PoemConfigPage.vue`

- [ ] **Step 1: 改用 `allGrades` 和手动年级分组**

在 `PoemConfigPage.vue` 的 `<script setup>` 中：

1. 将 `poemStore.grades` 改为 `poemStore.allGrades`（年级 tab 列表和 onMounted 初始化）
2. 将 `currentPoems` 改为从 `poemStore.poems` 直接过滤：

```typescript
const currentPoems = computed(() => {
  return poemStore.poems.filter(p => p.grade === activeGrade.value)
})
```

模板中 `poemStore.grades` 改为 `poemStore.allGrades`（第 7 行）。

- [ ] **Step 2: 验证构建通过**

Run: `cd /root/古诗抽查 && npx vue-tsc --noEmit 2>&1 | head -30`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/views/PoemConfigPage.vue
git commit -m "fix: PoemConfigPage use allGrades for full poem list"
```

---

### Task 3: 修改 HomePage 显示已启用数量

**Files:**
- Modify: `src/views/HomePage.vue`

- [ ] **Step 1: 将古诗集合数量改为已启用数量**

将 `HomePage.vue` 第 24 行：
```
{{ poemStore.poems.length }}
```
改为：
```
{{ poemStore.enabledPoems.length }}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/HomePage.vue
git commit -m "fix: HomePage show enabled poem count instead of total"
```

---

### Task 4: 修改 WrongBookPage 过滤未启用古诗

**Files:**
- Modify: `src/views/WrongBookPage.vue`

- [ ] **Step 1: 添加过滤逻辑，只显示已启用古诗的错题**

在 `<script setup>` 中新增计算属性：

```typescript
const enabledWrongBook = computed(() => {
  return learningStore.wrongBook.filter(entry => poemStore.isEnabled(entry.poemId))
})
```

在模板中，将所有 `learningStore.wrongBook` 替换为 `enabledWrongBook`：
- 第 43 行：`learningStore.wrongBook.length === 0` → `enabledWrongBook.length === 0`
- 第 48 行：`v-for="entry in learningStore.wrongBook"` → `v-for="entry in enabledWrongBook"`

- [ ] **Step 2: Commit**

```bash
git add src/views/WrongBookPage.vue
git commit -m "fix: WrongBookPage hide entries for disabled poems"
```

---

### Task 5: 验证所有改动

- [ ] **Step 1: 运行构建**

Run: `cd /root/古诗抽查 && npx vue-tsc --noEmit && npm run build 2>&1 | tail -10`
Expected: 构建成功

- [ ] **Step 2: 手动验证场景**

在浏览器中验证：
1. 设置页 → 取消选择某首古诗 → 该古诗从古诗集合中消失
2. 首页古诗集合数量 = 已启用数量
3. 错题本中不显示已禁用古诗的条目
4. 抽查页年级选择器只显示有启用古诗的年级
5. 设置页仍显示全量古诗，可正常启用/禁用
