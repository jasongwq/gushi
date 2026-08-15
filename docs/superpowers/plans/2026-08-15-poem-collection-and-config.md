# 古诗集合浏览 & 启用配置 & 浮窗 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为古诗抽查 PWA 新增古诗集合浏览页、古诗启用配置页、古诗浮窗组件，并让错题本和答题结果页支持点击标题弹出浮窗。

**Architecture:** 两个独立页面（浏览+配置）+ 一个复用浮窗组件。数据层新增 enabledPoems 字段控制启用范围，抽查出题时过滤未启用的古诗。浮窗组件通过 props/emit 控制显隐，在多个页面复用。

**Tech Stack:** Vue 3 + TypeScript + Pinia + Tailwind CSS

---

## File Structure

### New Files
- `src/components/PoemPopup.vue` — 古诗浮窗组件，全页面复用
- `src/views/PoemCollectionPage.vue` — 古诗集合浏览页，按年级标签页浏览
- `src/views/PoemConfigPage.vue` — 古诗启用配置页，按年级批量+单首启用/禁用

### Modified Files
- `src/types/index.ts` — UserSettings 新增 enabledPoems，移除 enabledGrades
- `src/stores/poem.ts` — 新增启用相关计算属性和方法
- `src/stores/learning.ts` — 新增 getMasteryLevel 方法，clearAllData 适配新字段
- `src/stores/quiz.ts` — 出题源改为 enabledPoems
- `src/utils/storage.ts` — getDefaultData 适配新字段
- `src/utils/quiz.ts` — smartMix 等函数接受 enabledPoems 过滤
- `src/router/index.ts` — 新增两条路由
- `src/views/HomePage.vue` — 新增古诗集合入口
- `src/views/SettingsPage.vue` — 新增古诗配置入口
- `src/views/WrongBookPage.vue` — 标题可点击弹出浮窗
- `src/views/QuizResultPage.vue` — 标题可点击弹出浮窗
- `src/views/QuizPlayPage.vue` — 标题可点击弹出浮窗
- `src/components/FillBlankQuiz.vue` — 标题可点击弹出浮窗
- `src/components/NextLineQuiz.vue` — 标题可点击弹出浮窗

---

### Task 1: 更新类型定义和存储层

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/utils/storage.ts`
- Modify: `src/stores/poem.ts`
- Modify: `src/stores/learning.ts`

- [ ] **Step 1: 修改 UserSettings 类型**

在 `src/types/index.ts` 中，将 `enabledGrades` 替换为 `enabledPoems`：

```typescript
export interface UserSettings {
  enabledPoems: string[]
  quizCount: number
  source: SourceType
  quizTypes: QuizType[]
  selectedGrades: string[]
}
```

- [ ] **Step 2: 更新 storage.ts 默认值**

在 `src/utils/storage.ts` 的 `getDefaultData()` 中，将 `enabledGrades: []` 改为 `enabledPoems: []`：

```typescript
function getDefaultData(): UserData {
  return {
    records: [],
    quizResults: [],
    wrongBook: [],
    settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] },
  }
}
```

- [ ] **Step 3: 更新 learningStore 的 clearAllData**

在 `src/stores/learning.ts` 的 `clearAllData()` 中，将 `enabledGrades: []` 改为 `enabledPoems: []`：

```typescript
function clearAllData() {
  data.value = { records: [], quizResults: [], wrongBook: [], settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] } }
  persist()
}
```

- [ ] **Step 4: 在 poemStore 中新增启用相关属性和方法**

在 `src/stores/poem.ts` 中，新增以下内容。需要导入 `useLearningStore`：

```typescript
import { useLearningStore } from './learning'

// 在 defineStore 内部新增：

const enabledPoems = computed(() => {
  const learningStore = useLearningStore()
  const enabledSet = learningStore.settings.enabledPoems
  if (enabledSet.length === 0) return poems.value
  const ids = new Set(enabledSet)
  return poems.value.filter(p => ids.has(p.id))
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
    // 全部启用状态：先设为全部ID，再移除指定ID
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
  const gradeIds = (poemsByGrade.value.get(grade) ?? []).map(p => p.id)

  if (current.length === 0) {
    // 全部启用状态
    if (!enabled) {
      // 移除整个年级
      const excludeSet = new Set(gradeIds)
      learningStore.updateSettings({ enabledPoems: poems.value.filter(p => !excludeSet.has(p.id)).map(p => p.id) })
    }
    // enabled=true 且当前全部启用，无需操作
  } else {
    if (enabled) {
      const existingSet = new Set(current)
      const toAdd = gradeIds.filter(id => !existingSet.has(id))
      learningStore.updateSettings({ enabledPoems: [...current, ...toAdd] })
    } else {
      const excludeSet = new Set(gradeIds)
      learningStore.updateSettings({ enabledPoems: current.filter(id => !excludeSet.has(id)) })
    }
  }
}

const enabledCount = computed(() => enabledPoems.value.length)

function gradeEnabledCount(grade: string): number {
  const learningStore = useLearningStore()
  const enabledSet = learningStore.settings.enabledPoems
  const gradePoems = poemsByGrade.value.get(grade) ?? []
  if (enabledSet.length === 0) return gradePoems.length
  const ids = new Set(enabledSet)
  return gradePoems.filter(p => ids.has(p.id)).length
}
```

更新 return 语句：

```typescript
return { poems, loading, grades, poemsByGrade, enabledPoems, enabledCount, fetchPoems, getPoemById, isEnabled, togglePoem, toggleGrade, gradeEnabledCount }
```

- [ ] **Step 5: 在 learningStore 中新增 getMasteryLevel 方法**

在 `src/stores/learning.ts` 的 return 之前新增：

```typescript
function getMasteryLevel(poemId: string): MasteryLevel {
  const record = getRecord(poemId)
  return record?.masteryLevel ?? '新'
}
```

更新 return 语句，新增 `getMasteryLevel`。

- [ ] **Step 6: 运行构建验证**

Run: `cd /root/古诗抽查 && npx vue-tsc --noEmit 2>&1 | head -30`
Expected: 可能有旧引用 enabledGrades 的报错，下一步修复

- [ ] **Step 7: 搜索并修复所有 enabledGrades 引用**

Run: `cd /root/古诗抽查 && grep -rn "enabledGrades" src/`
Expected: 应无其他引用（learningStore 和 storage 已修复）。如有，替换为 enabledPoems。

- [ ] **Step 8: 运行构建确认通过**

Run: `cd /root/古诗抽查 && npx vue-tsc --noEmit 2>&1 | head -30`
Expected: 无错误

- [ ] **Step 9: 提交**

```bash
git add -A && git commit -m "feat: add enabledPoems to types and stores"
```

---

### Task 2: 创建古诗浮窗组件

**Files:**
- Create: `src/components/PoemPopup.vue`

- [ ] **Step 1: 创建 PoemPopup.vue**

```vue
<template>
  <Teleport to="body">
    <Transition name="popup">
      <div v-if="visible" class="popup-overlay" @click.self="$emit('update:visible', false)">
        <div class="popup-content">
          <div class="popup-header">
            <h3 class="popup-title">{{ poem.title }}</h3>
            <span class="popup-meta">{{ poem.dynasty }}·{{ poem.author }}</span>
          </div>
          <div class="popup-body">
            <p v-for="(line, i) in poem.text" :key="i" class="popup-line">{{ line }}</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { Poem } from '@/types'

defineProps<{
  poem: Poem
  visible: boolean
}>()

defineEmits<{
  'update:visible': [value: boolean]
}>()
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

- [ ] **Step 2: 提交**

```bash
git add -A && git commit -m "feat: add PoemPopup component"
```

---

### Task 3: 创建古诗集合浏览页

**Files:**
- Create: `src/views/PoemCollectionPage.vue`
- Modify: `src/router/index.ts`

- [ ] **Step 1: 创建 PoemCollectionPage.vue**

```vue
<template>
  <div class="max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-4">古诗集合</h2>

    <div class="grade-tabs flex overflow-x-auto gap-1 mb-4 pb-1">
      <button
        v-for="grade in poemStore.grades"
        :key="grade"
        :class="['px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition', activeGrade === grade ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600']"
        @click="activeGrade = grade"
      >
        {{ grade }}
      </button>
    </div>

    <div v-if="currentPoems.length === 0" class="text-center text-gray-400 py-12">
      暂无古诗
    </div>

    <div v-else class="space-y-2">
      <div v-for="poem in currentPoems" :key="poem.id" class="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
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

    <PoemPopup
      v-if="popupPoem"
      :poem="popupPoem"
      v-model:visible="popupVisible"
    />

    <router-link :to="{ name: 'home' }" class="block text-center text-indigo-500 no-underline text-sm mt-6">返回首页</router-link>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import PoemPopup from '@/components/PoemPopup.vue'
import type { Poem } from '@/types'

const poemStore = usePoemStore()
const learningStore = useLearningStore()

const activeGrade = ref('')

onMounted(() => {
  poemStore.fetchPoems()
  if (poemStore.grades.length > 0) {
    activeGrade.value = poemStore.grades[0]
  }
})

const currentPoems = computed(() => {
  return poemStore.poemsByGrade.get(activeGrade.value) ?? []
})

const popupVisible = ref(false)
const popupPoemId = ref('')

const popupPoem = computed<Poem | undefined>(() => {
  if (!popupPoemId.value) return undefined
  return poemStore.getPoemById(popupPoemId.value)
})

function togglePopup(poemId: string) {
  if (popupPoemId.value === poemId && popupVisible.value) {
    popupVisible.value = false
  } else {
    popupPoemId.value = poemId
    popupVisible.value = true
  }
}

function masteryClass(poemId: string): string {
  const level = learningStore.getMasteryLevel(poemId)
  switch (level) {
    case '新': return 'bg-gray-100 text-gray-500'
    case '学': return 'bg-blue-100 text-blue-600'
    case '熟': return 'bg-green-100 text-green-600'
    case '固': return 'bg-indigo-100 text-indigo-600'
    default: return 'bg-gray-100 text-gray-500'
  }
}
</script>
```

- [ ] **Step 2: 在 router/index.ts 中新增路由**

在 routes 数组中新增：

```typescript
{ path: '/poems', name: 'poem-collection', component: () => import('@/views/PoemCollectionPage.vue') },
```

- [ ] **Step 3: 运行构建验证**

Run: `cd /root/古诗抽查 && npx vue-tsc --noEmit 2>&1 | head -30`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add -A && git commit -m "feat: add PoemCollectionPage with grade tabs and popup"
```

---

### Task 4: 创建古诗启用配置页

**Files:**
- Create: `src/views/PoemConfigPage.vue`
- Modify: `src/router/index.ts`

- [ ] **Step 1: 创建 PoemConfigPage.vue**

```vue
<template>
  <div class="max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-4">古诗配置</h2>

    <div class="grade-tabs flex overflow-x-auto gap-1 mb-3 pb-1">
      <button
        v-for="grade in poemStore.grades"
        :key="grade"
        :class="['px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition', activeGrade === grade ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600']"
        @click="activeGrade = grade"
      >
        {{ grade }}
      </button>
    </div>

    <div class="flex gap-2 mb-3">
      <button
        class="px-3 py-1 text-sm border border-indigo-200 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
        @click="enableAllGrade"
      >
        全选
      </button>
      <button
        class="px-3 py-1 text-sm border border-gray-200 rounded bg-white text-gray-600 hover:bg-gray-50 transition"
        @click="disableAllGrade"
      >
        全不选
      </button>
    </div>

    <div v-if="currentPoems.length === 0" class="text-center text-gray-400 py-12">
      暂无古诗
    </div>

    <div v-else class="space-y-2">
      <div v-for="poem in currentPoems" :key="poem.id" class="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div class="flex items-center gap-2">
          <span
            class="font-bold flex-1 cursor-pointer text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300"
            @click="togglePopup(poem.id)"
          >
            {{ poem.title }}
          </span>
          <span class="text-sm text-gray-500">{{ poem.dynasty }}·{{ poem.author }}</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" class="sr-only peer" :checked="poemStore.isEnabled(poem.id)" @change="poemStore.togglePoem(poem.id)">
            <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
          </label>
        </div>
      </div>
    </div>

    <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 text-center text-sm text-gray-600">
      已启用 {{ poemStore.enabledCount }} / 共 {{ poemStore.poems.length }} 首
    </div>

    <PoemPopup
      v-if="popupPoem"
      :poem="popupPoem"
      v-model:visible="popupVisible"
    />

    <router-link :to="{ name: 'settings' }" class="block text-center text-indigo-500 no-underline text-sm mt-6">返回设置</router-link>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePoemStore } from '@/stores/poem'
import PoemPopup from '@/components/PoemPopup.vue'
import type { Poem } from '@/types'

const poemStore = usePoemStore()

const activeGrade = ref('')

onMounted(() => {
  poemStore.fetchPoems()
  if (poemStore.grades.length > 0) {
    activeGrade.value = poemStore.grades[0]
  }
})

const currentPoems = computed(() => {
  return poemStore.poemsByGrade.get(activeGrade.value) ?? []
})

function enableAllGrade() {
  poemStore.toggleGrade(activeGrade.value, true)
}

function disableAllGrade() {
  poemStore.toggleGrade(activeGrade.value, false)
}

const popupVisible = ref(false)
const popupPoemId = ref('')

const popupPoem = computed<Poem | undefined>(() => {
  if (!popupPoemId.value) return undefined
  return poemStore.getPoemById(popupPoemId.value)
})

function togglePopup(poemId: string) {
  if (popupPoemId.value === poemId && popupVisible.value) {
    popupVisible.value = false
  } else {
    popupPoemId.value = poemId
    popupVisible.value = true
  }
}
</script>
```

- [ ] **Step 2: 在 router/index.ts 中新增路由**

在 routes 数组中新增：

```typescript
{ path: '/settings/poems', name: 'poem-config', component: () => import('@/views/PoemConfigPage.vue') },
```

- [ ] **Step 3: 运行构建验证**

Run: `cd /root/古诗抽查 && npx vue-tsc --noEmit 2>&1 | head -30`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add -A && git commit -m "feat: add PoemConfigPage with toggle and grade batch ops"
```

---

### Task 5: 更新首页和设置页入口

**Files:**
- Modify: `src/views/HomePage.vue`
- Modify: `src/views/SettingsPage.vue`

- [ ] **Step 1: 在首页新增古诗集合入口**

在 `src/views/HomePage.vue` 的 `<template>` 中，将 `grid-cols-3` 的快捷入口区域改为 `grid-cols-4`，并新增古诗集合入口。替换整个 grid 区域：

```html
<div class="grid grid-cols-4 gap-3">
  <router-link to="/poems" class="shortcut-btn p-3 bg-white rounded-lg shadow text-center hover:shadow-md transition">
    <div class="text-sm">古诗集合</div>
    <div class="text-lg font-bold text-indigo-500">{{ poemStore.poems.length }}</div>
  </router-link>
  <router-link to="/wrong" class="shortcut-btn p-3 bg-white rounded-lg shadow text-center hover:shadow-md transition">
    <div class="text-sm">错题本</div>
    <div class="text-lg font-bold text-red-500">{{ wrongCount }}</div>
  </router-link>
  <router-link to="/progress" class="shortcut-btn p-3 bg-white rounded-lg shadow text-center hover:shadow-md transition">
    <div class="text-sm">学习进度</div>
    <div class="text-lg font-bold text-green-500">{{ learnedCount }}</div>
  </router-link>
  <router-link to="/settings" class="shortcut-btn p-3 bg-white rounded-lg shadow text-center hover:shadow-md transition">
    <div class="text-sm">设置</div>
    <div class="text-lg">⚙️</div>
  </router-link>
</div>
```

- [ ] **Step 2: 在设置页新增古诗配置入口**

在 `src/views/SettingsPage.vue` 的按钮列表顶部（`<div class="flex flex-col gap-3 mb-6">` 内的最前面），新增：

```html
<router-link to="/settings/poems" class="w-full p-4 border border-gray-200 rounded-lg bg-white text-base text-left cursor-pointer hover:bg-gray-50 transition block no-underline text-inherit">
  古诗配置
</router-link>
```

- [ ] **Step 3: 运行构建验证**

Run: `cd /root/古诗抽查 && npx vue-tsc --noEmit 2>&1 | head -30`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add -A && git commit -m "feat: add poem collection and config entry points"
```

---

### Task 6: 错题本和答题结果页添加浮窗

**Files:**
- Modify: `src/views/WrongBookPage.vue`
- Modify: `src/views/QuizResultPage.vue`

- [ ] **Step 1: 更新 WrongBookPage.vue**

在 `<script setup>` 中新增导入和状态：

```typescript
import PoemPopup from '@/components/PoemPopup.vue'
import type { Poem } from '@/types'

const popupVisible = ref(false)
const popupPoemId = ref('')

const popupPoem = computed<Poem | undefined>(() => {
  if (!popupPoemId.value) return undefined
  return poemStore.getPoemById(popupPoemId.value)
})

function togglePopup(poemId: string) {
  if (popupPoemId.value === poemId && popupVisible.value) {
    popupVisible.value = false
  } else {
    popupPoemId.value = poemId
    popupVisible.value = true
  }
}
```

在 `<script setup>` 顶部添加 `ref` 和 `computed` 的导入（如果还没有）。

在 `<template>` 中，将标题 `<span class="font-bold flex-1">{{ getPoemTitle(entry.poemId) }}</span>` 替换为：

```html
<span class="font-bold flex-1 cursor-pointer text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300" @click="togglePopup(entry.poemId)">{{ getPoemTitle(entry.poemId) }}</span>
```

在模板末尾（`</div>` 根元素之前）添加浮窗组件：

```html
<PoemPopup v-if="popupPoem" :poem="popupPoem" v-model:visible="popupVisible" />
```

- [ ] **Step 2: 更新 QuizResultPage.vue**

在 `<script setup>` 中新增导入和状态：

```typescript
import PoemPopup from '@/components/PoemPopup.vue'
import type { Poem } from '@/types'

const popupVisible = ref(false)
const popupPoemId = ref('')

const popupPoem = computed<Poem | undefined>(() => {
  if (!popupPoemId.value) return undefined
  return poemStore.getPoemById(popupPoemId.value)
})

function togglePopup(poemId: string) {
  if (popupPoemId.value === poemId && popupVisible.value) {
    popupVisible.value = false
  } else {
    popupPoemId.value = poemId
    popupVisible.value = true
  }
}
```

在 `<script setup>` 顶部添加 `ref` 的导入（如果还没有）。

在 `<template>` 中，将 `<span class="flex-1 text-sm">{{ item.poemTitle }}</span>` 替换为：

```html
<span class="flex-1 text-sm cursor-pointer text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300" @click="togglePopup(quizStore.session!.questions[item.index - 1].poemId)">{{ item.poemTitle }}</span>
```

在模板末尾添加浮窗组件：

```html
<PoemPopup v-if="popupPoem" :poem="popupPoem" v-model:visible="popupVisible" />
```

- [ ] **Step 3: 运行构建验证**

Run: `cd /root/古诗抽查 && npx vue-tsc --noEmit 2>&1 | head -30`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add -A && git commit -m "feat: add poem popup to wrong book and quiz result pages"
```

---

### Task 7: 答题页组件添加浮窗

**Files:**
- Modify: `src/components/FillBlankQuiz.vue`
- Modify: `src/components/NextLineQuiz.vue`

- [ ] **Step 1: 更新 FillBlankQuiz.vue**

在 `<script setup>` 中新增导入和状态：

```typescript
import { ref, computed } from 'vue'
import PoemPopup from '@/components/PoemPopup.vue'
import type { Poem } from '@/types'

const popupVisible = ref(false)
const popupPoemId = ref(props.question.poemId)

const popupPoem = computed<Poem | undefined>(() => {
  return poemStore.getPoemById(popupPoemId.value)
})
```

在 `<template>` 中，将 `<p class="poem-title">{{ poem?.title }} — {{ poem?.dynasty }}·{{ poem?.author }}</p>` 替换为：

```html
<p class="poem-title">
  <span class="cursor-pointer text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300" @click="popupVisible = !popupVisible">{{ poem?.title }}</span>
  — {{ poem?.dynasty }}·{{ poem?.author }}
</p>
```

在模板末尾添加浮窗组件：

```html
<PoemPopup v-if="popupPoem" :poem="popupPoem" v-model:visible="popupVisible" />
```

- [ ] **Step 2: 更新 NextLineQuiz.vue**

在 `<script setup>` 中新增导入和状态：

```typescript
import { ref, computed } from 'vue'
import PoemPopup from '@/components/PoemPopup.vue'
import type { Poem } from '@/types'

const popupVisible = ref(false)
const popupPoemId = ref(props.question.poemId)

const popupPoem = computed<Poem | undefined>(() => {
  return poemStore.getPoemById(popupPoemId.value)
})
```

在 `<template>` 中，将 `<p class="poem-title">{{ poem?.title }} — {{ poem?.dynasty }}·{{ poem?.author }}</p>` 替换为：

```html
<p class="poem-title">
  <span class="cursor-pointer text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300" @click="popupVisible = !popupVisible">{{ poem?.title }}</span>
  — {{ poem?.dynasty }}·{{ poem?.author }}
</p>
```

在模板末尾添加浮窗组件：

```html
<PoemPopup v-if="popupPoem" :poem="popupPoem" v-model:visible="popupVisible" />
```

- [ ] **Step 3: 运行构建验证**

Run: `cd /root/古诗抽查 && npx vue-tsc --noEmit 2>&1 | head -30`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add -A && git commit -m "feat: add poem popup to quiz components"
```

---

### Task 8: 抽查出题使用启用范围过滤

**Files:**
- Modify: `src/stores/quiz.ts`

- [ ] **Step 1: 修改 startQuiz 方法使用 enabledPoems**

在 `src/stores/quiz.ts` 的 `startQuiz` 方法中，将所有 `poemStore.poems` 替换为 `poemStore.enabledPoems`：

```typescript
function startQuiz(source: SourceType, quizTypes: QuizType[], count: number, grades?: string[]): boolean {
  const poemStore = usePoemStore()
  const learningStore = useLearningStore()
  const today = new Date().toISOString().split('T')[0]

  const enabledPoems = poemStore.enabledPoems

  let selectedPoems: Poem[]
  if (source === 'smart') {
    selectedPoems = smartMix(enabledPoems, learningStore.records, learningStore.wrongBook, count, today)
  } else if (source === 'review') {
    selectedPoems = shuffleArray(getReviewPoems(enabledPoems, learningStore.records, today)).slice(0, count)
  } else if (source === 'wrong') {
    selectedPoems = shuffleArray(getWrongPoems(enabledPoems, learningStore.wrongBook)).slice(0, count)
  } else if (source === 'unproficient') {
    selectedPoems = shuffleArray(getUnproficientPoems(enabledPoems, learningStore.records)).slice(0, count)
  } else {
    selectedPoems = getPoemsBySource(enabledPoems, source, today, { grades })
    selectedPoems = shuffleArray(selectedPoems).slice(0, count)
  }

  const questions = generateQuestions(selectedPoems.map(p => p.id), quizTypes)
  if (questions.length === 0) return false
  session.value = {
    source, quizTypes, questions, currentIndex: 0, answers: [],
    startTime: new Date().toISOString(),
  }
  return true
}
```

- [ ] **Step 2: 修改 generateQuestion 使用 enabledPoems 作为干扰项来源**

在 `generateQuestion` 方法中，将 `poemStore.poems` 替换为 `poemStore.enabledPoems`：

```typescript
function generateQuestion(poem: Poem, quizType: QuizType, allPoems: Poem[]): QuizQuestion {
```

保持函数签名不变，但调用处传入的 allPoems 改为 enabledPoems。在 `generateQuestions` 中：

```typescript
function generateQuestions(poemIds: string[], quizTypes: QuizType[]): QuizQuestion[] {
  const poemStore = usePoemStore()
  const questions: QuizQuestion[] = []
  for (const poemId of poemIds) {
    const poem = poemStore.getPoemById(poemId)
    if (!poem) continue
    for (const quizType of quizTypes) {
      questions.push(generateQuestion(poem, quizType, poemStore.enabledPoems))
    }
  }
  return shuffleArray(questions)
}
```

- [ ] **Step 3: 运行构建验证**

Run: `cd /root/古诗抽查 && npx vue-tsc --noEmit 2>&1 | head -30`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add -A && git commit -m "feat: use enabledPoems as quiz source filter"
```

---

### Task 9: 端到端验证

**Files:**
- None (verification only)

- [ ] **Step 1: 运行完整构建**

Run: `cd /root/古诗抽查 && npm run build 2>&1 | tail -20`
Expected: 构建成功

- [ ] **Step 2: 运行现有测试**

Run: `cd /root/古诗抽查 && npx vitest run 2>&1 | tail -30`
Expected: 所有测试通过

- [ ] **Step 3: 修复任何失败的测试**

如果有测试因 enabledGrades 改为 enabledPoems 而失败，更新测试中的默认数据。

- [ ] **Step 4: 最终提交**

如果有修复：
```bash
git add -A && git commit -m "fix: update tests for enabledPoems migration"
```
