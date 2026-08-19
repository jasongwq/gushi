# 背诵标注即时保存 + 作者/朝代按钮文字 设计

## 背景

当前三种背诵场景（单诗背诵、抽背流程、家长抽查卡片）中，标注状态（卡顿/不会/作者/朝代）都存在 `RecitationCard.vue` 组件的本地 ref 里，只有点「下一首 / 熟练 / 完全不会」提交时才写入学习记录（错题本 + 遗忘曲线调度）。

问题：只抽选一首古诗时，标注后不点「下一首」直接返回，标注状态丢失，学习记录未保存。

需求：
1. 标注状态应自动保存（不点「下一首」也要保存）
2. 作者和朝代的"不会"按钮文字应分别写为「作者不会」「朝代不会」，不共用"不会"

## 决策

- **保存时机**：每次点击标注时即时保存（用户选择，而非离开页面时保存）
- **保存范围**：所有背诵场景统一（单诗、抽背流程、家长抽查卡片）
- **作者/朝代按钮**：卡片按钮文字改为「作者不会」「朝代不会」（用户选择只改卡片按钮文字，不改错题本/结果页文案）

## 核心改动

### 1. RecitationCard.vue：标注即时写入 learningStore

每次标注状态变化立即反映到 `learningStore`（错误细节进错题本），撤销时立即移除：

| 操作 | 写入 |
|------|------|
| 逐句标记「卡顿」 | `recordDetail(poemId, 'line', '第N句:stuck')` |
| 逐句标记「不会」 | `recordDetail(poemId, 'line', '第N句:forgot')` |
| 逐句撤销（回 ok） | `removeWrongEntry(poemId, 'line', '第N句:stuck'/'第N句:forgot')` |
| 点「作者不会」 | `recordDetail(poemId, 'author')` |
| 撤销作者 | `removeWrongEntry(poemId, 'author')` |
| 点「朝代不会」 | `recordDetail(poemId, 'dynasty')` |
| 撤销朝代 | `removeWrongEntry(poemId, 'dynasty')` |

**关键点**：
- `recordDetail` 不触发遗忘曲线调度、不生成 quizResult（已有单测保证），只往错题本写细节条目。
- 撤销用 `removeWrongEntry(poemId, quizType, note)` 精确移除单条，不会误删兄弟条目（已有单测保证）。
- 「熟练」提交时 `recordAnswer(poemId, 'recite', true)` 会清空该诗全部错题条目（已有行为），天然覆盖「标记后又点熟练」的清理。
- 点标注仅写细节，**不触发 recordAnswer 调度**；整体背诵调度（遗忘曲线）仍由提交路径 `submitRecitationResult` / `PoemCardPage.saveResult` 调用 `recordAnswer` 一次，遵守「背诵提交只调度一次」的既有约定。

### 2. 移除提交路径中的重复细节写入

`submitRecitationResult`（quiz store）和 `PoemCardPage.saveResult` 中现有的 `recordDetail` 细节写入逻辑删除，避免与即时保存重复。整体调度 `recordAnswer` 保留。

注：`recordReciteWithCharMarks`（字级标记快照 + 聚合统计）在提交路径保留——它位于页面层（`QuizPlayPage.onReciteSubmit`、`RecitationPlayPage.onSubmit`、`PoemCardPage.saveResult`），store 的 `submitRecitationResult` 本身不含该调用。

### 3. 按钮文字

`RecitationCard.vue` 标题区两个按钮：
- 「不会」→「作者不会」
- 「不会」→「朝代不会」

## 范围限制

- **字级标记（点单个汉字）不在本次即时保存范围**：它走 `recordReciteWithCharMarks` 的「快照 + 聚合统计」模型，即时保存需要新增增量增/减统计接口，且会话内高亮恢复语义复杂。字级标记维持提交时快照。
- 错题本标签、结果页详情文案维持现状（`作者`/`朝代`、`作者不正确`/`朝代不正确`）。

## 测试计划

### 单测

- `tests/unit/RecitationCard.test.ts`：
  - 点「卡顿」→ `recordDetail(poemId, 'line', '第1句:stuck')` 被调用
  - 点「不会」→ `recordDetail(poemId, 'line', '第1句:forgot')`
  - 点「作者不会」→ `recordDetail(poemId, 'author')`
  - 点「朝代不会」→ `recordDetail(poemId, 'dynasty')`
  - 撤销卡顿 → `removeWrongEntry(poemId, 'line', '第1句:stuck')`
  - 撤销作者/朝代 → `removeWrongEntry(poemId, 'author'/'dynasty')`
  - 按钮文字断言：「作者不会」「朝代不会」
  - 现有提交逻辑（熟练/完全不会/下一首 emit submit）保持不变
- `tests/unit/quiz-store-full.test.ts`：更新 detail 相关测试——submit 只调度 recordAnswer 一次，不再写 detail
- `tests/component/poem-card-page.test.ts`：更新 saveResult 断言——recordDetail 不再被调用（由组件即时保存），recordAnswer/recordReciteWithCharMarks 保留

### e2e

新增单诗场景测试（`tests/e2e/review-plan.spec.ts` 或 `recitation-flow.spec.ts`）：
- 古诗详情 →「背诵复习」→ 标记一行「卡顿」→ 直接返回（不点下一首）
- 验证 localStorage 中错题本已含该诗 `line: 第1句:stuck` 条目
- 多首抽背流程（`recitation-flow.spec.ts` 现有用例）不回归

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/components/RecitationCard.vue` | 标注即时写入/移除；按钮文字 |
| `src/stores/quiz.ts` | `submitRecitationResult` 移除重复 recordDetail |
| `src/views/PoemCardPage.vue` | `saveResult` 移除重复 recordDetail |
| `tests/unit/RecitationCard.test.ts` | 即时保存单测 + 按钮文字断言 |
| `tests/unit/quiz-store-full.test.ts` | 更新 detail 断言 |
| `tests/component/poem-card-page.test.ts` | 更新 saveResult 断言 |
| `tests/e2e/*` | 单诗即时保存 e2e |
