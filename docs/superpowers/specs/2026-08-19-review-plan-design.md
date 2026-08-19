# 复习计划表 设计文档

**日期:** 2026-08-19
**状态:** 已确认

## 背景与目标

家长和孩子共用本 PWA。家长需要提前规划接下来几天的复习安排，孩子也需要一个入口直接了解今天该复习什么、为什么。当前首页只有"今日待复习"横幅（仅覆盖艾宾浩斯到期），缺乏前瞻性计划和原因说明。

本功能新增**复习计划表**：按天分组展示未来 30 天每天要复习的古诗，并为每首标注**复习原因**。家长据此规划，孩子可直接从首页进入并按天复习。

## 需求摘要（已与用户确认）

- **入口**：首页底部快捷栏新增「复习计划」入口（4 列变 5 列）
- **展示**：按天分组列表，今天起未来 30 天；今天区块默认展开，未来日期默认折叠
- **原因分类**：到期该复习 / 不熟练标记 / 错题本 / 新增学习，同一首命中多个原因时**并列显示全部标签**
- **点击行为**：点击某首诗 → 进入现有古诗详情页（/poem/:id）
- **详情页复习**：详情页新增「背诵复习」按钮，点击直接进入该首诗的背诵流程
- **一键复习**：不需要，纯计划展示
- **归组规则**（已确认）：
  - 到期该复习：按 `nextReviewDate === 当天` 归入对应日期
  - 不熟练标记：归入今天（持续状态）
  - 新增学习：归入今天（未学过的诗，建议开始学）
  - 错题本：按 `lastWrongDate + 1 天` 排期归入对应日期；若该日期已过（逾期未复习）则落回今天；同诗多条目取最近 `lastWrongDate`

## 架构

复用现有模式：**纯函数工具（可单测）+ 页面组件**，与 `retention.ts` / `ProgressPage.vue` 的既有结构一致。

```
HomePage.vue ──(快捷栏入口)──> ReviewPlanPage.vue ──(点击诗)──> PoemDetailPage.vue
                                        │                          │
                                        │                          └──(背诵复习按钮)──> startRecitation(single)
                                        └── buildReviewPlan()      [utils/reviewPlan.ts, 纯函数]
```

### 组件与职责

| 单元 | 职责 |
|------|------|
| `src/utils/reviewPlan.ts` | 纯函数 `buildReviewPlan`，把 records/wrongBook/poems 转成 30 天计划 |
| `src/views/ReviewPlanPage.vue` | 渲染计划：日期分组、折叠、原因标签、点击跳详情 |
| `src/stores/quiz.ts` | `startRecitation` 支持单诗（新增可选 `poemId` 参数） |
| `src/views/PoemDetailPage.vue` | 新增「背诵复习」按钮，进入单诗背诵流程 |
| `src/views/HomePage.vue` | 快捷栏新增「复习计划」入口 |

## 数据模型

### `src/utils/reviewPlan.ts`

```typescript
export type ReviewReason = 'due' | 'unproficient' | 'wrongBook' | 'new'

export interface ReviewPlanItem {
  poemId: string
  reasons: ReviewReason[]
}

export interface ReviewPlanDay {
  date: string            // YYYY-MM-DD
  items: ReviewPlanItem[]
}

export function buildReviewPlan(
  records: LearningRecord[],
  wrongBook: WrongEntry[],
  poems: Poem[],
  days: number = 30,
  today?: string,          // 可注入日期，便于测试；缺省用当天
): ReviewPlanDay[]
```

### 原因判定逻辑

对每首**已启用的诗**（`poems` 传入的即视为启用），按当天日期逐天计算：

1. **due（到期该复习）**
   - 有 `record` 且 `record.nextReviewDate === date` → 归入该日
   - 若 `record.nextReviewDate < today`（逾期未复习）→ 归入**今天**，避免从计划中消失
2. **unproficient（不熟练）**
   - `record.unproficient === true`，归入**今天**
3. **wrongBook（错题本）**
   - `wrongBook` 中存在该诗条目，取最近 `lastWrongDate`
   - 建议复习日 = `lastWrongDate + 1 天`
   - 若建议复习日 == date → 归入该日；若建议复习日 < 今天（逾期）→ 归入今天
4. **new（新增学习）**
   - 该诗无任何 record（`getRecord` 返回 undefined），归入**今天**

同一首同一天命中多个原因 → 合并为一条 `ReviewPlanItem`，`reasons` 数组含全部原因。

### 日期工具

复用 `src/utils/ebbinghaus.ts` 的 `addDays(dateStr, days)` 计算错题建议复习日。

## 页面设计

### ReviewPlanPage.vue

布局（max-w-md 居中，与现有页面一致）：

- 标题「复习计划」，副标题「未来 30 天复习安排」
- **计算逻辑说明**：标题旁「!」帮助按钮（与 ProgressPage 的「!」提示风格一致，indigo 圆形），点击展开说明四种原因的计算逻辑：
  - 到期复习：艾宾浩斯调度当天到期；逾期未复习的诗会落到今天
  - 不熟练：标记了"不熟练"的诗，每天建议复习
  - 错题本：最近答错的诗，错后第 2 天建议复习；逾期未复习的落到今天
  - 新增学习：还没学过的诗，建议今天开始学
- **今日区块**（第一个，默认展开）：日期标"今天"，列出所有归入今天的诗，每行：
  - 诗标题 + 作者
  - 原因标签（多标签并列）
- **未来日期区块**（默认折叠）：日期标「明天 / 周X · MM-DD」，行首显示当日诗数；点击展开/收起
- 每首诗点击 → `router.push({ name: 'poem-detail', params: { id } })`
- 空状态：某天无任何诗时显示"无需复习"

原因标签样式：

| 原因 | 标签文案 | 颜色 |
|------|---------|------|
| due | 到期复习 | indigo |
| unproficient | 不熟练 | orange |
| wrongBook | 错题本 | red |
| new | 新增学习 | green |

### PoemDetailPage.vue 改造

在译文区块之后、返回按钮之前，新增「背诵复习」按钮：

- 点击 → 调用 `quizStore.startRecitation('review', 1, undefined, poemId)`（见下），成功后 `router.push({ name: 'recitation-play' })`
- 按钮文案「背诵复习」，主色样式（indigo 实心）

### quiz store 改造

`startRecitation(source, count, grades?, poemId?)` 增加可选第 4 参数：

- `poemId` 传入时，忽略 source/count，直接以该诗构造单首 session（`questions: [该诗]`）
- 该诗不存在或未启用 → 返回 false
- 既有调用不受影响（不传 poemId 行为不变）

## 测试策略

### 单元测试 `tests/unit/reviewPlan.test.ts`

- due：nextReviewDate 匹配对应日期归入；不匹配不归入；逾期（< today）归入今天
- unproficient：归入今天
- new：无记录的诗归入今天
- wrongBook：lastWrongDate+1 归入对应日；逾期落回今天；同诗多条目取最近日期
- 多原因：同诗同天命中多个原因 → reasons 含全部
- 30 天范围：返回数组长度 == days，首日为 today
- 可注入 today：同输入不同 today 结果不同

### 单元测试 `tests/unit/quiz-recite-single.test.ts`

- startRecitation 传 poemId：session 只有该诗一首，mode='recitation'
- 诗不存在/未启用 → false

### e2e 测试（playwright）

- 首页有「复习计划」入口
- 计划页展示今日区块和未来日期
- 「!」帮助按钮展示计算逻辑说明
- 点击诗 → 进入详情页
- 详情页「背诵复习」按钮 → 进入背诵播放页
- 完整背诵链路：提交后进结果页

### 验证命令

```
npx vue-tsc --noEmit
npx vitest run
npx vite build
npx playwright test
```

## 不做的事（YAGNI）

- 不新增"一键复习今天的计划"按钮
- 不做日历视图
- 不引入新的存储字段（错题排期用现有 `lastWrongDate`，不熟练用现有 `unproficient`）
- 不改变现有 今日待复习 横幅逻辑

## 风险与注意

- **逾期到期（due < today）归入今天**，与错题逾期同理，确保逾期该复习的诗不消失。原因标签仍为"到期复习"。
- **`nextReviewDate` 与 `lastWrongDate` 均为字符串日期**，比较用字典序（YYYY-MM-DD 格式保证正确）。
- 单诗背诵走现有 RecitationPlayPage，其进度显示"第 1 / 1 首"，无需改播放页。
