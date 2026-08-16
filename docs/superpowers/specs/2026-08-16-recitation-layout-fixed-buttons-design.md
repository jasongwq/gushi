# 古诗背诵详情页布局调整设计

> 日期：2026-08-16
> 状态：已确认

## 一、背景

`RecitationCard.vue`（背诵模式详情卡片）当前布局存在两个问题：

1. **4 个操作按钮（熟练/完全不会/上一首/下一首）在文档流内**，位于古诗正文之后。遇到长诗（数据最长《劝学》63 句）时，按钮随内容一起滚出屏幕，操作不便。
2. **作者/朝代标记区位于卡片最底部**，与标题分离，标记时视线要在标题和底部之间来回跳。

用户确认的新布局：

- 4 个按钮**固定在屏幕底部**，不随正文滚动
- **正文区独立滚动**（逐句标记 + 译文），按钮始终可见
- 作者/朝代的 [不会] 按钮**移到古诗标题下方**，并**删除底部原有的作者/朝代标记区**
- 改动对 `PoemCardPage`（滑动/盲盒详情）和 `RecitationPlayPage`（传统抽背）**两处使用都生效**

## 二、目标布局

```
┌────────────────────────────────┐
│ 静夜思                          │  ← 标题区（固定）
│ 唐 · 李白  [不会] [不会]        │  ← 作者/朝代 + 按钮（标题下，固定）
├────────────────────────────────┤
│ 床前明月光  [卡顿] [不会]       │
│ 疑是地上霜  [卡顿] [不会]       │  ← 正文区（flex-1 独立滚动）
│ 举头望明月  [卡顿] [不会]       │
│ 低头思故乡  [卡顿] [不会]       │
│ [显示译文 ▾]                    │
│ 译文内容（展开时）              │
├────────────────────────────────┤
│ [熟练]   [完全不会]             │  ← 按钮区（固定底部）
│ [上一首] [下一首]               │
└────────────────────────────────┘
```

## 三、实现方案

**组件内 flex 布局**（方案 1），改动全在 `RecitationCard.vue` 内部，两处使用自动生效。

### 1. 根节点改为 flex 纵向布局

根容器 `div.recitation-card`：

```
class="recitation-card py-2 w-full flex flex-col h-full"
```

三个区域：

| 区域 | class | 说明 |
|------|-------|------|
| 标题区 | `shrink-0` | 标题 + 作者/朝代 + [不会] 按钮，不滚动 |
| 正文区 | `flex-1 min-h-0 overflow-y-auto` | 逐句标记 + 译文，内容过长时独立滚动 |
| 按钮区 | `shrink-0` | 熟练/完全不会/上一首/下一首，始终可见 |

### 2. 作者/朝代区移到标题下方

删除原底部「作者/朝代标记区」（当前模板中 `李白 [不会] 唐 [不会]` 那段，位于译文下方）。

在标题区（`唐 · 李白` 那行）合并两个 [不会] 按钮：

- 作者 [不会]：绑定 `toggleAuthorCorrect`，状态 `authorCorrect`
- 朝代 [不会]：绑定 `toggleDynastyCorrect`，状态 `dynastyCorrect`

按钮样式与逻辑**不变**（`border-red-500` 高亮、null→false→true 循环），仅移动位置。

### 3. 状态逻辑不变

`authorCorrect` / `dynastyCorrect` / `lineStatuses` / `hasAnyIssue` 等响应式状态全部保留原逻辑，仅调整模板位置。`markMastered` / `markForgot` / `submit` / `submitResult` 等函数无需改动。

### 4. 两处使用的高度约束差异

| 使用处 | 容器 | `h-full` 效果 |
|--------|------|---------------|
| `PoemCardPage` 详情（Swiper slide） | slide 高度占满卡片区域 | 根节点填满，正文区滚动，按钮固定底部 |
| `RecitationPlayPage` 抽背 | 普通文档流 `p-4`，无固定高度 | `h-full` 退化为内容高度，按钮在正文之后；单首诗一般不满屏，行为可接受 |

两处均为同一组件、同一布局代码，无需 prop 区分。

## 四、涉及的既有测试

### 单元测试 `tests/unit/RecitationCard.test.ts`

- 多数测试通过查找按钮文本定位（`getAuthorDynastyButtons` 按文档顺序取 `不会` 按钮），**无需修改**——`不会` 按钮总数不变（4 行 × 1 + 作者 1 + 朝代 1），仅 DOM 顺序变化
- `getAuthorDynastyButtons` 的注释提到"line 不会 buttons come first"，但实现是按索引取 `allForgot[mockPoem.text.length]` 和 `[+1]`，**位置变化不影响**，需运行验证
- 无布局相关断言，不受影响

### E2E 测试

- `recitation-flow.spec.ts`：`startRecitationWithAll` 走 `RecitationPlayPage` 流程，断言用文本定位按钮，不受布局影响
- `poem-detail-fullscreen.spec.ts`：
  - 「RecitationCard 高度占满可用空间」断言 `heightRatio > 0.95`——改为 flex 布局后根节点 `h-full` 高度仍占满卡片区域，正文区 `overflow-y-auto` 不影响，**应通过**，需运行验证
  - 「背诵模式点击卡顿按钮不缩回且能标记」——正文区可滚动，卡顿按钮仍在正文区内可见，不受影响
- `overflow-check.spec.ts`：检查无水平溢出，flex 纵向布局不影响

## 五、验证

1. `npm run test:unit`（RecitationCard 相关测试全绿）
2. `npm run test:e2e`（重点 `recitation-flow`、`poem-detail-fullscreen`、`overflow-check`）
3. 手动验证：长诗（如《劝学》）进入背诵模式，正文滚动时 4 按钮固定底部、作者/朝代在标题下
