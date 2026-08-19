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

## 待办事项（另行处理，不在当前实施范围）

- （已完成）~~**快速配置已学**：计划页支持快速标记某首诗为"已学"，从学习队列移除，不再排入"新增学习"。用户已确认需要，交互方式待定，另行设计实现。~~ → 见下方「快速配置已学」章节

## 快速配置已学（2026-08-19 追加，已确认）

### 需求

- **存储**：不新增存储字段，复用现有学习记录检查（有 LearningRecord 即"已学"）
- **入口**：计划页顶部节奏选择器旁加「批量配置」按钮，进入批量勾选界面（覆盖式列表）
- **列表**：显示所有未学的诗（无学习记录），按年级分组，多选勾选
- **年级全选**：每个年级标题旁一个复选框，勾选/取消该年级全部诗；部分选中时显示半选态（indeterminate）；子项独立可再调整
- **确认**：勾选后点「确认标记」提交，给勾选的诗创建**最小学习记录**（reviewCount=0、masteryLevel='新'、lastReviewDate/nextReviewDate=今天），不触发复习调度
- **排程联动**：标记已学的诗同时从排程 schedule 中移除，计划表不再显示（不算待学/未学）

### 复习摊开（2026-08-19 追加，已确认）

**问题**：批量标记已学后所有标记诗的 `nextReviewDate: today` 立即到期，今日待复习飙升，且一次性 50 首同时复习不符合记忆曲线。

**方案**：
- **markLearned 占位**：创建记录时 `nextReviewDate` 设为 `'2099-01-01'`（占位，标记已学但待排复习），不再设为今天。标记的诗**不进待复习队列**，直到重排分配实际日期
- **重排双参数**：重排界面两个参数——
  - 每天学习新诗数（现有节奏 8 档：每天 1-5 首 / 每 2/3/5 天 1 首）
  - **每天最多复习数 N**（新增，如 1/3/5/10 首）
- **复习摊开算法（全局配额）**：重排时遍历已标记已学且 `nextReviewDate === '2099-01-01'` 的诗，按每天复习名额 N 摊开：
  1. 从今天起逐天检查
  2. 每天先放艾宾浩斯到期的诗（`nextReviewDate <= today` 且非 2099 占位），这些占用当天名额
  3. 当天剩余名额（N - 艾宾浩斯到期数）给标记已学的诗，满则顺延下一天
  4. 分配到的诗设 `nextReviewDate` 为对应日期
- **艾宾浩斯优先级高于标记已学**（先算到期，剩余名额给标记已学）

### 实现要点

- `learning.ts` 新增方法 `markLearned(poemIds: string[])`：批量创建最小记录（nextReviewDate='2099-01-01'）+ 从 schedule 移除
- `learning.ts` 新增/扩展 `rebuildSchedule`：接收两个参数（pace + 每天复习数 N），未学诗按 pace 排 schedule，标记已学诗按 N 摊开 nextReviewDate
- `ReviewPlanPage.vue` 新增批量配置界面（覆盖式列表 + 年级分组 + 勾选 + 确认/取消）+ 重排区复习数选择

## 学习计划排程（2026-08-19 追加，已确认）

### 背景

"新增学习"把所有未学的诗（200 首中大部分）都堆在"今天"，导致计划表爆表。需要**学习计划排程**：未学的诗按节奏排入未来日期，区分"待学"（已排入且未学）、"已学"（排入但已有学习记录）、"未学"（未排入）。

### 需求（已确认）

- **节奏档位**：每天 1-5 首 / 每 2/3/5 天 1 首，共 8 档
- **排程顺序**：未学的诗按年级从低到高、同年级按诗库顺序
- **排程起点**：从今天开始连续排
- **持久化**：localStorage（UserData 新增 `schedule` 字段，诗→日期映射 `{ poemId: 'YYYY-MM-DD' }`）
- **重排**：「重排」按钮清空排程，未学的重新从今天开始排
- **切换档位**：只改存储配置，需手动点「重排」才生效
- **首次进入**：无排程时自动按默认节奏（每天 3 首）生成
- **已学标记**：排程中的诗若有学习记录 → 保留在排程中但标记"已学"
- **30 天外排程**：排到 30 天后的诗归入底部"未学"区块，但标注"已排期"，与真正未排的分组显示

### 数据层 — `src/utils/schedule.ts`（纯函数）

```typescript
export type PaceOption =
  | { type: 'perDay'; count: number }      // 每天 count 首，count ∈ 1..5
  | { type: 'perDays'; days: number }       // 每 days 天 1 首，days ∈ 2/3/5

export const PACE_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '每天 1 首' },
  { value: '2', label: '每天 2 首' },
  { value: '3', label: '每天 3 首' },
  { value: '4', label: '每天 4 首' },
  { value: '5', label: '每天 5 首' },
  { value: 'every2', label: '每 2 天 1 首' },
  { value: 'every3', label: '每 3 天 1 首' },
  { value: 'every5', label: '每 5 天 1 首' },
]

// 未学的诗按节奏排到日期映射
export function buildSchedule(
  unlearnedPoems: Poem[],   // 已按年级低→高排序
  pace: PaceOption,
  today: string,
): Record<string, string>   // { poemId: 'YYYY-MM-DD' }
```

排程规则：
- `perDay count`：今天排前 count 首，明天排接下来 count 首，依此类推
- `perDays days`：今天学第 1 首，第 days 天学第 2 首，第 2*days 天学第 3 首……

### store 扩展 — `learning.ts`

- `UserData` 新增 `schedule: Record<string, string>`（默认 `{}`）
- 方法：
  - `getSchedule(): Record<string, string>`
  - `setSchedule(schedule: Record<string, string>)` → 保存并 persist
  - `clearSchedule()` → 清空并 persist
  - `rebuildSchedule(unlearnedPoems: Poem[], pace: PaceOption, today: string)` → 用 buildSchedule 重算并保存
- `storage.ts` loadData 兼容旧数据（`schedule: parsed.schedule ?? {}`）

### 页面 — `ReviewPlanPage.vue`

- 顶部节奏选择器（8 档）+ 「重排」按钮
- 首次进入无排程 → 自动按默认节奏（每天 3 首）生成
- 切换档位 → 只存配置，需手动「重排」生效
- 计划表按天分组：
  - **待学**（排程中且未学）：正常显示，原因标签"新增学习"
  - **已学**（排程中已有学习记录）：保留显示，标记"已学"
- 底部**"未学"区块**，折叠展示，分两组：
  - **未排期**：未排进排程的诗（无 schedule 映射）
  - **已排期（30 天后）**：排程日期超出 30 天计划显示范围的诗
- 原因判定逻辑中 `new`（新增学习）改为：**仅排程到当天的未学诗**归入当天（不再把所有未学诗堆今天）

### 测试

- 单测 `tests/unit/schedule.test.ts`：
  - perDay 排程：每天 N 首、连续排、日期正确
  - perDays 排程：每 N 天 1 首、间隔正确
  - 空未学诗 → 空排程
  - 可注入 today
- 单测 schedule 迁移：loadData 兼容无 schedule 旧数据
- 组件测试 ReviewPlanPage 更新：节奏选择器、重排按钮、待学/已学/未学分组
- e2e：计划页节奏切换+重排流程、已学标记展示

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
