---
name: Single Swiper Refactor
description: 将两层架构合并为单 Swiper，coverflow 效果统一，点击展开/滑动缩回
type: project
---

# 单 Swiper 架构重构设计

> 日期：2026-08-16
> 状态：已确认

---

## 一、背景

当前 `PoemCardPage.vue` 采用「浏览层 + 详情层」两层架构，通过 `useSwipeHandoff` hack Swiper 内部状态实现手势接力。这个方案脆弱且复杂。

用户确认：**详情页面和滑动页面就应该是同一个页面，在同一个 Swiper 里，使用 coverflow 卡片效果。**

## 二、核心架构

**单一 Swiper，始终 coverflow 效果。** 三个 viewMode 状态：

| viewMode | 说明 | slide 内容 | slide 宽度 |
|----------|------|-----------|-----------|
| `swiper` | 浏览 | PoemCard | 65% |
| `recite` | 背诵（某张卡片展开） | 展开的 slide: RecitationCard / 其他: PoemCard | 展开的: 100% / 其他: 65% |
| `mystery` | 盲盒 | MysteryBox | — |

**关键交互：**
- 点击 PoemCard → 该 slide 展开到 100%，内容切换为 RecitationCard
- 开始滑动 → 展开的 slide 缩回 65%，内容切回 PoemCard，然后正常滑动
- 滑到新卡片后 → 不自动展开，需要再次点击
- 返回按钮 → 缩回小卡片
- 提交后 → 缩回小卡片，自动滑到下一首，不自动展开

## 三、删除的代码

| 文件/代码 | 说明 |
|-----------|------|
| `useSwipeHandoff.ts` | 整个文件删除 |
| `viewLayer` 状态 | 不再需要 browse/detail 层 |
| `currentPoem` ref | 改为 `computed(() => poems[currentIndex.value])` |
| `detailEnterAnim` | 不再需要 |
| `dragPhase`、`dragDeltaX`、`dragStartX/Y`、`dragDirection` | 全部删除 |
| `onDetailTouchStart/Move/End` | 全部删除 |
| `onDetailPointerDown/Move/End` | 全部删除 |
| `detailLayerStyle` 计算属性 | 全部删除 |
| 详情层 DOM（`v-if="viewLayer === 'detail'"`） | 全部删除 |
| `PoemCard.vue` 的 `expanded` 状态和 `toggleExpand` | 简化为纯展示 |

## 四、状态模型

```typescript
type ViewMode = 'swiper' | 'recite' | 'mystery'

const viewMode = ref<ViewMode>('swiper')
const currentIndex = ref(0)
const expandedSlideIndex = ref(-1) // 当前展开的 slide 索引，-1 表示没有展开
const fromMystery = ref(false)
const mysteryRevealedPoems = ref<Poem[]>([])
```

**数据源：**
- `viewMode === 'swiper'` 或 `viewMode === 'recite'` 且 `!fromMystery`：使用 `allPoems`
- `viewMode === 'recite'` 且 `fromMystery`：使用 `mysteryRevealedPoems`
- 盲盒点击已开盒 → 设置 `fromMystery = true`，切换 `viewMode = 'recite'`

## 五、缩放过渡

**展开（PoemCard → RecitationCard）：**
1. 点击 PoemCard，记录当前 slide
2. slide 添加 `expanded` 类：宽度从 65% → 100%（CSS transition）
3. 内容切换为 RecitationCard
4. 遮罩淡入淡出遮盖内容切换

**缩回（RecitationCard → PoemCard）：**
1. 触发滑动或点击返回按钮
2. slide 移除 `expanded` 类：宽度从 100% → 65%
3. 动画结束后内容切回 PoemCard

**滑动时缩回：**
1. `touchStart` 事件中检测到有展开的 slide
2. 立即调用 `collapseSlide()` 缩回
3. Swiper 正常处理滑动

## 六、CardSwiper 修改

**新增 props：** 无（始终 coverflow，不需要动态切换 effect）

**新增暴露方法：**
- `getSlideElement(index)` — 获取 slide DOM 元素，用于添加/移除 `expanded` 类

**Swiper 事件处理：**
- `touchStart`：如果有展开的 slide，先缩回
- `slideChangeTransitionEnd`：更新进度

## 七、盲盒模式

- `viewMode === 'mystery'` 时显示 MysteryBox，Swiper 隐藏
- 点击已开盒 → 切换到 `viewMode = 'recite'`，Swiper 显示，数据源为 `mysteryRevealedPoems`
- 点击的盲盒诗作为 `initialSlide`
- 背诵模式中顶部显示"返回盲盒"按钮
- 返回盲盒 → `viewMode = 'mystery'`，盲盒状态保留

## 八、E2E 测试场景

| # | 场景 | 验证点 |
|---|------|--------|
| 1 | 点击卡片展开背诵 | slide 从 65% 展开到 100%，显示 RecitationCard，内容正确 |
| 2 | 展开状态下左右滑动 | 展开的 slide 缩回 65%，正常滑动切换 |
| 3 | 滑到新卡片后不自动展开 | 新卡片显示 PoemCard，需要点击才展开 |
| 4 | 提交结果后 | 缩回小卡片，自动滑到下一首，不自动展开 |
| 5 | 最后一首提交后 | 缩回小卡片，回到浏览模式 |
| 6 | 返回按钮 | 缩回小卡片，回到浏览模式 |
| 7 | 盲盒→点击已开盒→背诵 | 进入背诵模式，数据源为盲盒已开诗 |
| 8 | 背诵→返回盲盒 | 盲盒状态保留（已开盒不变） |
| 9 | 盲盒背诵→全局浏览切换 | 数据源切换正确 |
