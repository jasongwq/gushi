# 古诗卡片浏览交互优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化浏览层和详情层之间的切换交互：移除长按、改为左右滑动返回、添加放大/缩小动画、布局自适应。

**Architecture:** 浏览层和详情层通过 `<Transition>` 组件切换，进入详情时卡片放大动画，退出详情时卡片缩小动画。详情层使用绝对定位覆盖浏览层，左右滑动超过阈值触发返回。整体布局使用 flex 自适应，仅古诗正文区域可滚动。

**Tech Stack:** Vue 3 + Tailwind CSS + Swiper.js

---

### Task 1: 清理 PoemCardPage.vue 中错误的浏览层滑动手势

**Files:**
- Modify: `src/views/PoemCardPage.vue:164-181` (移除浏览层滑动进入详情的手势)

当前代码在浏览层卡片区域监听了 `@touchstart="onBrowseTouchStart"` 和 `@touchend="onBrowseSwipe"`，会和 Swiper 切卡片冲突。需要移除这些。

- [ ] **Step 1: 移除浏览层滑动手势函数**

删除 `PoemCardPage.vue` 中的以下函数（第164-181行）：

```typescript
// ========== 滑动手势 ==========
const SWIPE_THRESHOLD = 100 // 最小滑动距离

// 浏览层：左右大范围滑动进入详情
function onBrowseSwipe(e: TouchEvent) {
  const touch = e.changedTouches[0]
  const startX = (e.target as HTMLElement).dataset.swipeStartX
  if (startX == null) return
  const deltaX = touch.clientX - Number(startX)
  if (Math.abs(deltaX) >= SWIPE_THRESHOLD && poems.value.length > 0) {
    enterDetail(poems.value[currentIndex.value])
  }
}

function onBrowseTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  ;(e.target as HTMLElement).dataset.swipeStartX = String(touch.clientX)
}
```

替换为仅保留详情层滑动返回的手势：

```typescript
// ========== 滑动手势 ==========
const SWIPE_THRESHOLD = 100 // 最小滑动距离

// 详情层：左右滑动返回浏览
function onDetailSwipe(e: TouchEvent) {
  const touch = e.changedTouches[0]
  const startX = (e.target as HTMLElement).dataset.swipeStartX
  if (startX == null) return
  const deltaX = touch.clientX - Number(startX)
  if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
    goBackToBrowse()
  }
}

function onDetailTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  ;(e.target as HTMLElement).dataset.swipeStartX = String(touch.clientX)
}
```

注意：`goBackToBrowse()` 已存在（第107-111行），无需重复定义。同时删除原有的 `onDetailSwipe` 和 `onDetailTouchStart`（第183-199行），因为它们已经被上面的新版本替代。

- [ ] **Step 2: 移除浏览层卡片区域的手势事件绑定**

在模板中，卡片区域 `<div class="flex-1 min-h-0 p-4"` 上的 `@touchstart="onBrowseTouchStart"` 和 `@touchend="onBrowseSwipe"` 需要移除：

```html
<!-- 改前 -->
<div class="flex-1 min-h-0 p-4"
  @touchstart="onBrowseTouchStart"
  @touchend="onBrowseSwipe"
>

<!-- 改后 -->
<div class="flex-1 min-h-0 p-4">
```

- [ ] **Step 3: 更新底部提示文字**

将浏览层底部的提示文字从"左右滑动进入详情"改为"点击卡片进入详情"：

```html
<!-- 改前 -->
<p class="text-center text-xs text-gray-300 mt-1">左右滑动进入详情</p>

<!-- 改后 -->
<p class="text-center text-xs text-gray-300 mt-1">点击卡片进入详情</p>
```

- [ ] **Step 4: 构建验证**

Run: `cd /root/古诗抽查 && npm run build`
Expected: 构建成功，无错误

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "fix: remove browse layer swipe-to-detail gesture, keep click only"
```

---

### Task 2: 修复详情层布局为 flex 自适应

**Files:**
- Modify: `src/views/PoemCardPage.vue:257-298` (详情层模板)
- Modify: `src/components/RecitationCard.vue:96-185` (详情卡片布局)

当前详情层整体是 `overflow-y-auto`，整个页面可以滚动。需要改为：整体 flex 自适应，仅古诗正文区域可滚动。

- [ ] **Step 1: 修改 PoemCardPage.vue 详情层模板**

将详情层从整体滚动改为 flex 自适应布局：

```html
<!-- ====== 详情层 ====== -->
<Transition name="card-zoom">
  <div v-if="viewLayer === 'detail' && currentPoem" class="detail-layer absolute inset-0 flex flex-col bg-gray-50 z-10"
    @touchstart="onDetailTouchStart"
    @touchend="onDetailSwipe"
  >
    <!-- 顶部标题栏 - 固定高度 -->
    <div class="shrink-0 p-4 pb-2">
      <div class="flex items-center justify-between mb-2">
        <button class="text-gray-400 text-sm" @click="goBackToBrowse">← 返回</button>
        <span class="text-xs text-gray-400">{{ detailProgress.text }}</span>
      </div>
      <!-- 进度条 -->
      <div class="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div class="h-full bg-indigo-500 rounded-full transition-all duration-300" :style="{ width: detailProgress.percent + '%' }"></div>
      </div>
    </div>
    <!-- 古诗正文区域 - flex-1 占剩余空间，内部可滚动 -->
    <RecitationCard
      class="flex-1 min-h-0 overflow-y-auto px-4"
      :poem="currentPoem"
      :can-go-prev="fromMystery ? mysteryRevealedPoems.findIndex(p => p.id === currentPoem?.id) > 0 : poems.findIndex(p => p.id === currentPoem?.id) > 0"
      @submit="onDetailSubmit"
      @go-prev="onDetailGoPrev"
    />
    <!-- 底部区域 - 固定高度 -->
    <div class="shrink-0 p-3 bg-white border-t border-gray-100 text-center">
      <span class="text-xs text-gray-300">左右滑动返回卡片浏览</span>
      <button
        v-if="fromMystery"
        class="ml-3 text-xs text-purple-400 cursor-pointer"
        @click="viewLayer = 'browse'; viewMode = 'mystery'"
      >返回盲盒</button>
      <button
        v-if="fromMystery"
        class="ml-2 text-xs text-indigo-400 cursor-pointer"
        @click="switchToGlobal"
      >全部古诗</button>
    </div>
  </div>
</Transition>
```

- [ ] **Step 2: 修改 RecitationCard.vue 为纯内容组件**

RecitationCard 当前是纯内容组件，不需要 `overflow-y-auto`，因为滚动由父容器控制。但它需要移除自身的 `mb-6` 等 margin 防止溢出，改为用 padding 控制间距。将模板改为：

```html
<template>
  <div class="recitation-card py-2">
    <div class="text-center mb-4">
      <h2 class="text-2xl font-bold mb-1">{{ poem.title }}</h2>
      <p class="text-gray-500 text-sm">{{ poem.dynasty }} · {{ poem.author }}</p>
    </div>

    <!-- 全诗原文 + 逐句标记 -->
    <div class="mb-4">
      <div
        v-for="(line, index) in poem.text"
        :key="index"
        class="flex items-center gap-2 py-2 border-b border-gray-100 last:border-b-0"
      >
        <span :class="['flex-1 text-lg', lineStatuses[index].status === 'forgot' ? 'text-red-400' : lineStatuses[index].status === 'stuck' ? 'text-yellow-600' : '']">{{ line }}</span>
        <div class="flex gap-1 shrink-0">
          <button
            :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', lineStatuses[index].status === 'stuck' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 bg-white text-gray-400']"
            @click="setLineStatus(index, lineStatuses[index].status === 'stuck' ? 'ok' : 'stuck')"
          >卡顿</button>
          <button
            :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', lineStatuses[index].status === 'forgot' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
            @click="setLineStatus(index, lineStatuses[index].status === 'forgot' ? 'ok' : 'forgot')"
          >不会</button>
        </div>
      </div>
    </div>

    <!-- 译文 -->
    <div class="mb-3 text-center">
      <button
        :class="['px-3 py-1.5 text-xs rounded-lg border-2 cursor-pointer transition', showYiwen ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-indigo-200 bg-indigo-50 text-indigo-600']"
        @click="toggleYiwen"
      >
        {{ showYiwen ? '隐藏译文 ▴' : '显示译文 ▾' }}
      </button>
    </div>
    <div v-if="showYiwen" class="mb-3 p-3 bg-gray-50 rounded-lg text-center">
      <p class="text-sm leading-relaxed text-gray-500">{{ poem.yiwen }}</p>
    </div>

    <!-- 作者/朝代标记 -->
    <div class="mb-4 flex items-center gap-4">
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-600">{{ poem.author }}</span>
        <button
          :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', authorCorrect === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
          @click="toggleAuthorCorrect"
        >不会</button>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-600">{{ poem.dynasty }}</span>
        <button
          :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', dynastyCorrect === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
          @click="toggleDynastyCorrect"
        >不会</button>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="flex gap-3 mb-3">
      <button
        class="flex-1 p-3 bg-green-50 border-2 border-green-200 rounded-lg text-green-700 font-medium text-base cursor-pointer hover:bg-green-100 transition"
        @click="markMastered"
      >
        熟练
      </button>
      <button
        class="flex-1 p-3 bg-red-50 border-2 border-red-200 rounded-lg text-red-700 font-medium text-base cursor-pointer hover:bg-red-100 transition"
        @click="markForgot"
      >
        完全不会
      </button>
    </div>

    <!-- 上一首 / 下一首 -->
    <div class="flex gap-3">
      <button
        :disabled="!props.canGoPrev"
        :class="['flex-1 p-3 rounded-lg text-base font-medium cursor-pointer transition', props.canGoPrev ? 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-gray-100 text-gray-300 cursor-not-allowed']"
        @click="emit('goPrev')"
      >上一首</button>
      <button
        :disabled="!hasAnyIssue"
        :class="['flex-1 p-3 rounded-lg text-base font-medium cursor-pointer transition', hasAnyIssue ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-gray-300 text-gray-500 cursor-not-allowed']"
        @click="submit"
      >下一首</button>
    </div>
  </div>
</template>
```

主要变化：
- 标题 `text-3xl` → `text-2xl`，`mb-6` → `mb-4`，紧凑化
- 逐句 `py-3` → `py-2`，`mb-6` → `mb-4`
- 按钮区 `p-4 text-lg` → `p-3 text-base`，紧凑化
- 译文区 `mb-4` → `mb-3`
- 作者/朝代区 `mb-6` → `mb-4`

- [ ] **Step 3: 构建验证**

Run: `cd /root/古诗抽查 && npm run build`
Expected: 构建成功，无错误

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "fix: detail page flex layout, only poem text area scrollable"
```

---

### Task 3: 修复浏览层卡片尺寸为 flex 自适应

**Files:**
- Modify: `src/components/CardSwiper.vue:105-110` (slide 高度)
- Modify: `src/components/PoemCard.vue:30-48` (卡片内部间距)

当前 Swiper slide 高度是 `75%` 固定百分比，需要改为填满卡片区域（`100%`），因为卡片区域本身已经是 `flex-1` 自适应了。

- [ ] **Step 1: 修改 CardSwiper.vue slide 高度**

```css
/* 改前 */
.card-swiper :deep(.swiper-slide) {
  width: 65%;
  height: 75%;
}

/* 改后 */
.card-swiper :deep(.swiper-slide) {
  width: 65%;
  height: 100%;
}
```

卡片区域本身已经是 `flex-1 min-h-0 p-4`，占满剩余空间。slide 填满卡片区域即可，高度由外层 flex 布局决定。

- [ ] **Step 2: 确认 PoemCard.vue 当前状态**

PoemCard 当前已经是 `h-full` + `p-5` + `text-xl`，配合上面 slide 高度 100%，卡片会填满卡片区域。无需额外修改。

- [ ] **Step 3: 构建验证**

Run: `cd /root/古诗抽查 && npm run build`
Expected: 构建成功，无错误

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "fix: card height flex-adaptive, fill remaining space"
```

---

### Task 4: 修复 Transition 动画

**Files:**
- Modify: `src/views/PoemCardPage.vue:399-444` (CSS 动画)

当前动画基本正确，但需要微调：浏览层不需要 Transition（因为浏览层和详情层是互斥的，详情层 absolute 覆盖浏览层，浏览层始终在下方）。

- [ ] **Step 1: 移除浏览层的 Transition，仅保留详情层**

浏览层不需要 Transition，因为它是被详情层覆盖的底层。动画只在详情层的进入/退出时发生：

```html
<!-- ====== 详情层 ====== -->
<Transition name="card-zoom">
  <div v-if="viewLayer === 'detail' && currentPoem" class="detail-layer absolute inset-0 flex flex-col bg-gray-50 z-10"
    @touchstart="onDetailTouchStart"
    @touchend="onDetailSwipe"
  >
    <!-- ...内容不变... -->
  </div>
</Transition>

<!-- ====== 浏览层 ====== -->
<div v-if="viewLayer !== 'detail'" class="flex flex-col flex-1 min-h-0">
  <!-- ...内容不变... -->
</div>
```

- [ ] **Step 2: 简化 CSS 动画**

只保留 `card-zoom` 动画（详情层进入/退出），删除 `card-shrink` 动画：

```css
<style scoped>
/* 详情层进入：卡片放大 */
.card-zoom-enter-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.card-zoom-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.card-zoom-enter-from {
  transform: scale(0.85);
  opacity: 0;
}
.card-zoom-enter-to {
  transform: scale(1);
  opacity: 1;
}
.card-zoom-leave-from {
  transform: scale(1);
  opacity: 1;
}
.card-zoom-leave-to {
  transform: scale(0.85);
  opacity: 0;
}
</style>
```

关键变化：`card-zoom-leave-to` 从 `scale(1.05)` 改为 `scale(0.85)`，这样退出时也是缩小动画，与进入时的放大动画对称。

- [ ] **Step 3: 构建验证**

Run: `cd /root/古诗抽查 && npm run build`
Expected: 构建成功，无错误

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "fix: simplify transition animation, symmetric scale in/out"
```

---

### Task 5: 最终验证

- [ ] **Step 1: 构建验证**

Run: `cd /root/古诗抽查 && npm run build`
Expected: 构建成功，无错误

- [ ] **Step 2: 手动验证检查清单**

在浏览器中验证以下行为：
1. 浏览层左右滑动 → 只切卡片，不进入详情
2. 点击卡片 → 放大动画进入详情
3. 详情页左右滑动超过100px → 缩小动画返回浏览
4. 点击"← 返回" → 返回浏览
5. 详情页整体不滚动，仅古诗正文区域可滚动（长诗时）
6. 浏览层卡片高度自适应屏幕，不出现空白
7. 底部提示文字显示"点击卡片进入详情"
