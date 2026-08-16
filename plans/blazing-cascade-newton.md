# 跟手拖拽返回 + 消除浏览器滚动条

## 问题

1. **浏览器滚动条**：App.vue 的 footer 在 router-view 下方，导致页面总高度超出视口；html/body 缺少 overflow:hidden
2. **详情页返回体验**：当前是松手后才播放缩小动画，需要改为跟手拖拽——手指拖动时详情页实时缩小+透明化，浏览层在背后同步露出

## 改动

### 1. 消除浏览器滚动条

**`src/style.css`** — 添加全局 overflow 控制：
```css
html, body, #app {
  height: 100%;
  overflow: hidden;
}
```

**`src/App.vue`** — footer 包裹在 flex 容器内，不超出视口：
```html
<template>
  <div class="h-dvh flex flex-col overflow-hidden">
    <router-view class="flex-1 min-h-0" />
    <footer class="shrink-0 text-center text-xs text-gray-400 py-3 select-none">
      v{{ version }} · {{ buildTime }} · {{ gitHash }}
    </footer>
  </div>
</template>
```

**`src/views/PoemCardPage.vue`** — `h-screen` → `h-dvh`

### 2. 跟手拖拽返回详情页

**`src/views/PoemCardPage.vue`** — 核心改动：

**a) 浏览层始终渲染**（去掉 `v-if`，改为始终可见）：
- 去掉 `v-if="viewLayer !== 'detail'"`
- 详情层通过 z-index 覆盖在浏览层上方
- 拖拽时浏览层自然从背后露出

**b) 跟手拖拽状态机**：
```typescript
const dragState = ref<'idle' | 'pending' | 'dragging' | 'settling'>('idle')
const dragDeltaX = ref(0)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragDirection = ref<'h' | 'v' | null>(null)
const SWIPE_THRESHOLD = 100

// touchstart: 记录起点
// touchmove: 判断方向 → 锁定水平 → 实时更新 dragDeltaX
// touchend: 超阈值 → 完成返回；未超 → 弹回
```

**c) 详情层样式绑定**：
```html
<div class="detail-layer absolute inset-0 ..."
  :style="dragState === 'dragging' || dragState === 'settling'
    ? { transform: `scale(${dragScale})`, opacity: dragOpacity, transition: dragState === 'settling' ? 'all 0.25s ease' : 'none' }
    : {}"
>
```

计算属性：
```typescript
const dragScale = computed(() => {
  const progress = Math.min(Math.abs(dragDeltaX.value) / SWIPE_THRESHOLD, 1)
  return 1 - progress * 0.15  // 1.0 → 0.85
})

const dragOpacity = computed(() => {
  const progress = Math.min(Math.abs(dragDeltaX.value) / SWIPE_THRESHOLD, 1)
  return 1 - progress  // 1.0 → 0.0
})
```

**d) 进入详情时的放大动画**（用 CSS transition + nextTick）：
```typescript
function enterDetail(poem: Poem) {
  currentPoem.value = poem
  viewLayer.value = 'detail'
  // 详情层初始 scale(0.85) opacity(0)，nextTick 后 transition 到 scale(1) opacity(1)
  detailEnterAnim.value = true
  nextTick(() => {
    detailEnterAnim.value = false
  })
}
```

**e) 移除 `<Transition name="card-zoom">`**，因为跟手拖拽已手动控制动画

### 3. 不改动的部分

- `RecitationCard.vue` — 不变
- `CardSwiper.vue` — 不变
- `PoemCard.vue` — 不变

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/style.css` | 添加 html/body/#app overflow:hidden + height:100% |
| `src/App.vue` | flex 容器 h-dvh，footer shrink-0 |
| `src/views/PoemCardPage.vue` | 跟手拖拽 + 浏览层始终渲染 + h-dvh + 移除 Transition + 移除旧滑动手势 |

