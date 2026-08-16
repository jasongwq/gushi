# 盲盒功能 Bug 修复与 E2E 测试

## 日期：2026-08-16

## Bug 修复

### Bug 1：古诗详情页面回到盲盒页面后，盲盒状态被重置

**原因**：MysteryBox 组件使用 `v-if` 条件渲染，进入详情页时 `viewMode` 从 `'mystery'` 切换为 `'detail'`，导致 MysteryBox 被销毁。返回时重新创建，所有盒子恢复为关闭状态。

**修复**：将 MysteryBox 从 `v-if` 改为 `v-show`，组件始终保留在 DOM 中，仅通过 `display` 控制可见性，状态得以保留。同时 CardSwiper 也改为 `v-show` + `v-if` 配合。

**文件**：`src/views/PoemCardPage.vue:487-496`

### Bug 2：盲盒未全开启状态进入详情，总数和滑动范围应只限于已开盒

**原因**：`poems` computed 在 `fromMystery` 为 true 时返回 `mysteryPoems`（全部 4 首盲盒诗），包含了未开盒的诗。进度显示和滑动范围都基于这个列表，导致用户看到未开盒的诗。

**修复**：将 `poems` computed 改为使用 `mysteryRevealedPoems`（仅已开盒的诗），同时简化 `detailProgress` 计算逻辑，直接使用 `poems` 列表计算进度。

**文件**：`src/views/PoemCardPage.vue:71`

## 其他改动

### MysteryBox 异步数据初始化

**问题**：MysteryBox 在 `initBoxes()` 时如果 `poems` prop 为空（数据异步加载），盒子不会初始化。后续数据到达后组件不会重新初始化。

**修复**：添加 `watch` 监听 `poems.length` 变化，从 0 变为有数据时自动调用 `initBoxes()`。

**文件**：`src/components/MysteryBox.vue:37-42`

### 添加 data-state 和 data-testid

- MysteryBox 按钮添加 `data-state` 属性，便于 e2e 测试定位关闭/已开盒状态
- 详情页进度添加 `data-testid="detail-progress"`，便于 e2e 测试精确选择

## E2E 测试

新增 `tests/e2e/mystery-box.spec.ts`，共 10 个测试用例：

| 测试 | 说明 |
|------|------|
| switch to mystery mode shows 4 closed boxes | 切换到盲盒模式显示 4 个关闭盒子 |
| clicking closed box reveals it | 点击关闭盒子变为已开盒 |
| clicking revealed box enters recite mode | 点击已开盒进入背诵模式 |
| returning from recite to mystery preserves blind box state | 从背诵返回盲盒后状态保留 |
| partial reveal: progress shows only revealed count | 部分开盒时进度只显示已开盒数量 |
| partial reveal: swipe only between revealed poems | 部分开盒时只能在已开盒之间切换 |
| returning from recite via "返回盲盒" button preserves state | 通过"返回盲盒"按钮返回后状态保留 |
| all revealed: progress shows 4 poems | 全部开盒后进度显示 4 首 |
| all revealed: "再抽一轮" button appears | 全部开盒后显示"再抽一轮"按钮 |
| switch to global mode from mystery recite | 从盲盒背诵切换到全局古诗模式 |

## 变更文件清单

| 文件 | 变更 |
|------|------|
| `src/views/PoemCardPage.vue` | poems computed 改用 mysteryRevealedPoems；detailProgress 简化；MysteryBox/CardSwiper 改用 v-show；添加 data-testid |
| `src/components/MysteryBox.vue` | 添加 watch 初始化；添加 data-state 属性 |
| `tests/e2e/mystery-box.spec.ts` | 新增 10 个 e2e 测试用例 |
