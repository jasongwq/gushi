# 右侧溢出问题排查文档

## 问题描述

用户反馈：古诗抽查 PWA 的浏览层（卡片 Swiper）和详情层（RecitationCard）都存在右侧超出画面的问题。

## 相关提交（按时间倒序）

| 提交 | 说明 | 影响 |
|------|------|------|
| `3cf4e92` | 加了 overflow-hidden 卡片区域 + e2e 测试 | 试图修复，但用户反馈仍有问题 |
| `c629376` | 拖拽返回时 Swiper 接管手势 | 修改了详情层/浏览层交互 |
| `edd2933` | 修复右侧溢出：RecitationCard 加 break-all、coverflow stretch/depth 减小 | 试图修复，不够 |
| `ff6e690` | 跟手拖拽返回 + 浏览层始终渲染 | 重写了 PoemCardPage.vue |
| `4fde2be` | 消除浏览器滚动条：html/body/#app overflow:hidden，App.vue flex 容器，h-dvh | 改了全局布局 |
| `473f018` | 简化 Transition 动画 | 移除浏览层 Transition |
| `8d578fa` | CardSwiper slide 高度 100% | 改了 slide 高度 |
| `da83658` | 详情页 flex 布局，仅正文区可滚动 | 重构了详情层模板 |
| `6e6a127` | 移除浏览层滑动进入详情手势 | 删除了手势代码 |
| `eb0c15b` | 三视图交互（详情/滑动/盲盒） | 初始实现 |

## 当前代码状态

### 全局布局链

```
html/body/#app → overflow:hidden, height:100% (style.css)
  └─ App.vue: div.h-dvh.flex.flex-col.overflow-hidden
      ├─ router-view.flex-1.min-h-0
      └─ footer.shrink-0
```

### PoemCardPage 布局

```
div.poem-card-page.max-w-md.mx-auto.h-dvh.flex.flex-col.bg-gray-50.relative.overflow-hidden
  ├─ 详情层 (viewLayer === 'detail' 时渲染)
  │   └─ div.detail-layer.absolute.inset-0.flex.flex-col.bg-gray-50.z-10
  │       ├─ 顶部标题栏 (shrink-0)
  │       ├─ RecitationCard.flex-1.min-h-0.overflow-y-auto.overflow-x-hidden.px-4
  │       └─ 底部区域 (shrink-0)
  └─ 浏览层 (始终渲染)
      └─ div.flex.flex-col.flex-1.min-h-0
          ├─ 顶部筛选栏
          ├─ 卡片区域 div.flex-1.min-h-0.p-4.overflow-hidden
          │   └─ CardSwiper.h-full
          │       └─ Swiper (swiper.js coverflow effect)
          │           └─ .swiper > .swiper-wrapper > .swiper-slide (width:65%)
          └─ 底部工具栏
```

## 已尝试的修复

### 1. 全局 overflow:hidden（style.css）
```css
html, body, #app {
  height: 100%;
  overflow: hidden;
}
```
- 作用：防止浏览器原生滚动条
- 局限：只防止 document 级溢出，不防子元素溢出

### 2. App.vue flex 容器
- 将 footer 包裹在 `h-dvh flex flex-col overflow-hidden` 容器内
- footer 用 `shrink-0` 防止超出视口
- 作用：消除 footer 导致的 document 高度溢出

### 3. 卡片区域 overflow-hidden（PoemCardPage.vue:471）
```html
<div class="flex-1 min-h-0 p-4 overflow-hidden">
```
- 作用：裁剪 Swiper coverflow 效果导致的侧边卡片溢出
- **局限：可能不够**——如果 Swiper 的 `.swiper` 容器本身宽度超出，或者 coverflow 的 transform 让 wrapper 宽度超出

### 4. CardSwiper 自身 overflow:hidden
```css
.card-swiper {
  overflow: hidden;
}
```
- 作用：裁剪 Swiper 内部溢出
- **局限：Swiper 的 coverflow 效果通过 JS 设置 inline transform，可能绕过 overflow:hidden**

### 5. RecitationCard 防溢出
- 逐句文字加 `min-w-0 break-all`，长文本允许换行
- 根元素加 `w-full`
- 父容器加 `overflow-x-hidden`

### 6. Swiper coverflow 参数减小
```js
// 之前
{ stretch: 40, depth: 200 }
// 之后
{ stretch: 30, depth: 150 }
```
- 减小了相邻卡片向两侧延伸的幅度

## e2e 测试结果

4 个测试全部通过（在桌面浏览器 1280px 宽度下）：
1. 浏览页无水平滚动条 ✅
2. 详情页无水平滚动条 ✅
3. 浏览页无可见元素超出视口右侧 ✅
4. 详情页无可见元素超出视口右侧 ✅

**但用户反馈仍有问题**——可能是移动端（窄屏）下的问题，e2e 测试使用的是桌面浏览器宽度。

## 可能的根因（待排查）

### A. Swiper coverflow 效果
- coverflow 效果让 `.swiper-wrapper` 和 `.swiper-slide` 通过 `transform: translateX/Z` 定位
- `stretch: 30` 让相邻 slide 之间有 30px 额外间距
- 即使父容器有 `overflow: hidden`，如果 Swiper 的 `.swiper` 容器宽度计算有问题，仍可能溢出
- **排查方向**：在移动端检查 `.swiper` 容器的实际宽度和 `.swiper-wrapper` 的 transform 值

### B. max-w-md 在移动端的问题
- `max-w-md` = 28rem = 448px
- 在手机上（375px 宽），`max-w-md` 不生效，容器就是全屏宽度
- 但 `mx-auto` 可能在某些情况下导致水平偏移
- **排查方向**：检查 `max-w-md mx-auto` 在移动端是否有布局问题

### C. 详情层 absolute inset-0 + scale() 变换
- 详情层 `absolute inset-0` 撑满父容器
- `transform: scale()` 缩放时以中心为原点
- `scale(0.85)` 缩小不会溢出，但 `scale(1)` 时如果内容本身有溢出，可能可见
- **排查方向**：检查详情层在 `scale(1)` 时内部是否有元素溢出

### D. RecitationCard 逐句标记行
- 诗句文字 + "卡顿"/"不会" 按钮在同一行
- 如果诗句很长，`flex-1` + `break-all` 可能不够
- **排查方向**：检查长诗句（如《将进酒》）在移动端的渲染

### E. viewport meta tag
- 当前：`<meta name="viewport" content="width=device-width, initial-scale=1.0" />`
- 没有设置 `maximum-scale=1` 或 `user-scalable=no`
- 某些浏览器缩放行为可能导致溢出

## 关键文件

| 文件 | 路径 |
|------|------|
| PoemCardPage | `src/views/PoemCardPage.vue` |
| CardSwiper | `src/components/CardSwiper.vue` |
| PoemCard | `src/components/PoemCard.vue` |
| RecitationCard | `src/components/RecitationCard.vue` |
| App.vue | `src/App.vue` |
| 全局样式 | `src/style.css` |
| e2e 测试 | `tests/e2e/overflow-check.spec.ts` |

## 建议排查步骤

1. **用移动端 viewport 运行 e2e 测试**：在 playwright 配置中设置 `viewport: { width: 375, height: 812 }`（iPhone X），重新运行 overflow 测试
2. **检查 Swiper coverflow 效果在窄屏下的表现**：可能需要 `overflow: clip` 或给 Swiper 容器加 `width: 100%` + `max-width: 100%`
3. **检查 RecitationCard 长诗句渲染**：用《将进酒》等长诗测试
4. **检查详情层 `absolute inset-0` 在移动端是否正确**：`inset-0` 在有 `max-w-md` 的父容器中可能行为不同
5. **考虑用 `overflow: clip` 替代 `overflow: hidden`**：`clip` 不创建新的格式化上下文，可能更可靠

## 排查结果（2026-08-16）

### 根因

`.poem-card-page` 使用 `max-w-md mx-auto` 但缺少 `w-full`。在移动端（375px）下：

- `max-w-md` = 448px，在 375px 视口中不会收缩
- 父容器（App.vue flex 容器）`display: flex`，flex 子项默认 `min-width: auto`
- `poem-card-page` 作为 flex 子项，宽度被内容撑到 448px，超出视口 73px
- `mx-auto` 使其居中，导致两侧各溢出 ~36.5px
- `overflow: hidden` 在父容器上裁剪了可见内容，但 `.poem-card-page` 本身布局宽度为 448px
- 详情层 `absolute inset-0` 相对于 448px 宽的父容器，所以也超出视口

### 修复

在 `PoemCardPage.vue` 的 `.poem-card-page` 根元素上添加 `w-full`：

```html
<!-- 之前 -->
<div class="poem-card-page max-w-md mx-auto h-dvh flex flex-col bg-gray-50 relative overflow-hidden">

<!-- 之后 -->
<div class="poem-card-page w-full max-w-md mx-auto h-dvh flex flex-col bg-gray-50 relative overflow-hidden">
```

`w-full` = `width: 100%`，在 flex 子项中使 `flex-basis: 100%`，确保容器宽度不超过父容器。`max-w-md` 仍然在宽屏上限制最大宽度。

### e2e 测试覆盖

新增 19 个溢出检测测试，包括：
- 4 个桌面端测试（浏览页/详情页 + 滚动条 + 可见元素检测）
- 7 个移动端 viewport（375x812）测试（浏览页/详情页/长诗 + 滚动条 + 深度诊断）
- 8 个其他页面移动端溢出检测（home/poems/settings/progress）

所有 19 个测试通过。

### 代码审查修复

1. **关键：双触发 bug** — 在触摸设备上，touch 和 pointer 事件同时触发。添加 `if (e.pointerType === 'touch') return` 守卫。
2. **重要：`as Touch` 类型断言** — 替换为 `HandoffTouch` 最小接口，消除不安全的类型断言。
3. **重要：e2e 测试逻辑重复** — 桌面端测试改为使用共享的 `findVisibleOverflow` helper。

### 单元测试覆盖

`useSwipeHandoff.ts`：100% 语句、100% 分支、100% 函数、100% 行覆盖率。
