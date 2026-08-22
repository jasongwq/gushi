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
- **未提交标记的存储**：localStorage 持久化（用户选择，而非 sessionStorage）——标注时记录 poemId → 待调度标记；关闭页面/浏览器后重开仍可修复，与学习数据同寿命
- **整体调度的补全**：进入错题本页面时自动补 recordAnswer 调度（用户选择，而非离开页面时补）

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
- 点标注仅写细节，**不触发 recordAnswer 调度**；整体背诵调度（遗忘曲线）由以下两条路径补全，遵守「背诵提交只调度一次」的既有约定：
  1. 正常提交：`submitRecitationResult` / `PoemCardPage.saveResult` 调用 `recordAnswer` 一次
  2. 未提交（关闭页面/直接返回）：进入错题本时自动补一次

### 1b. 待调度标记（localStorage）

标注变化时同步维护 `pendingReciteSchedules: string[]`（poemId 列表，存于 localStorage）：

| 时机 | 操作 |
|------|------|
| 首次标记某诗任何异常（卡顿/不会/作者/朝代从无到有） | 将该 poemId 加入待调度列表 |
| 撤销该诗所有异常（回全 ok + 无作者/朝代错误） | 从待调度列表移除该 poemId |
| 正常提交（`submitRecitationResult` / `saveResult` 调 `recordAnswer` 成功） | 从待调度列表移除该 poemId |
| 点「熟练」提交 mastered | recordAnswer(true) 清错题 + 从待调度列表移除 |

**进入错题本页面时**（`WrongBookPage` onMounted）：
- 遍历待调度列表，对每个 poemId 调 `recordAnswer(poemId, 'recite', hasWrong ? false : true)`——`hasWrong` 由该诗在错题本中是否存在异常条目判定（含 line/author/dynasty/recite 条目）
- 调度完成后从待调度列表移除

**为什么进错题本时补而非离开页面时补**：用户选择的模型——detail 即时入错题本，整体调度延迟到「进入错题本」这个自然的复习动作前补上，避免 `beforeunload` 的可靠性问题（移动端/浏览器可随时杀进程，beforeunload 不可靠）。

### 2. 移除提交路径中的重复细节写入

`submitRecitationResult`（quiz store）和 `PoemCardPage.saveResult` 中现有的 `recordDetail` 细节写入逻辑删除，避免与即时保存重复。整体调度 `recordAnswer` 保留。

注：`recordReciteWithCharMarks`（字级标记快照 + 聚合统计）在提交路径保留——它位于页面层（`QuizPlayPage.onReciteSubmit`、`RecitationPlayPage.onSubmit`、`PoemCardPage.saveResult`），store 的 `submitRecitationResult` 本身不含该调用。

### 3. 按钮文字

`RecitationCard.vue` 标题区两个按钮：
- 「不会」→「作者不会」
- 「不会」→「朝代不会」

### 4. 待调度标记的维护位置

`learningStore` 是唯一写入学习数据的地方，待调度标记归它管理最合适：

- 新增 `pendingReciteSchedules: ref<string[]>`（从 localStorage 初始化，`loadPendingReciteSchedules` / `savePendingReciteSchedules`）
- 新增 `markPendingReciteSchedule(poemId)` / `unmarkPendingReciteSchedule(poemId)` 内部辅助
- `recordDetail` / `removeWrongEntry` 不直接管待调度标记；由 `RecitationCard` 在标注变化时统一调用 `learningStore.syncPendingReciteSchedule(poemId, hasAnyIssue)`（有异常则标记，全清则移除）
- `recordAnswer` 成功（背诵路径）后自动从待调度列表移除该 poemId（在 `recordAnswer` 内对 `quizType === 'recite'` 分支处理，或由调用方 `submitRecitationResult` / `saveResult` 显式移除——实施时选一种，避免重复）
- `WrongBookPage` onMounted：遍历待调度列表补 `recordAnswer`

## 范围限制

- **字级标记（点单个汉字）采用方案 A：临时会话标记 + 进错题本时聚合**（而非增量增/减统计接口）。点字/撤销字时把当前字级标记快照写入 localStorage 待聚合列表（`pendingCharMarks: { poemId: CharMarkMap }`）；正常提交（下一首/熟练/完全不会）时 `recordReciteWithCharMarks` 聚合后清除该 poemId 的 pending；进错题本时对剩余 pending 诗聚合到 `charMarkStats` 后清除。同一批标记只聚合一次（提交过的不会在错题本重复聚合），避免 `charMarkStats` 重复计数。
- 错题本标签、结果页详情文案维持现状（`作者`/`朝代`、`作者不正确`/`朝代不正确`）。

### 1c. 字级标记待聚合（方案 A）

`pendingCharMarks`（localStorage，`poem-quiz-pending-char-marks`）：

| 时机 | 操作 |
|------|------|
| 点字/撤销字（`toggleCharMark` 后） | 将当前 `charMarks` 快照写入 `pendingCharMarks[poemId]`；快照为空则删除该键 |
| 点字后有异常 | 同时 `syncPendingReciteSchedule(poemId, true)`（字级标记计入待调度，进错题本补 recordAnswer） |
| 正常提交（三个页面调 `recordReciteWithCharMarks`） | 聚合后删除 `pendingCharMarks[poemId]` |
| 进错题本（`WrongBookPage` onMounted） | 对剩余 `pendingCharMarks` 每首诗聚合到 `charMarkStats` 后删除 |

**进错题本聚合复用 `recordReciteWithCharMarks` 的聚合逻辑**（`parseLine` 解析 + fuzzyCount/wrongCount 增量），但**不追加 reciteCorrectness、不推 reciteRecords 快照、不触调度**——只聚合统计。实现为内部辅助 `aggregateCharMarks(poemId, poemText, charMarkMap)`，`recordReciteWithCharMarks` 与进错题本路径共用。

**去重保障**：提交路径聚合后删除 pending，错题本只处理未提交的 pending——同批标记不会聚合两次。撤销全清后快照为空，pending 键删除，无残留。`syncPending` 在字级标记变化后同样调用（`computeHasIssue` 已含 `hasCharIssue`）。

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
  - 待调度标记：首次标记 → `syncPendingReciteSchedule(poemId, true)`；全清 → `(poemId, false)`
  - 现有提交逻辑（熟练/完全不会/下一首 emit submit）保持不变
- `tests/unit/learning-store.test.ts`：
  - `syncPendingReciteSchedule` 有异常标记 / 全清移除
  - `recordAnswer`（recite 路径）后自动移除待调度标记
  - 待调度列表 localStorage 持久化（初始化读、变化写）
  - `pendingCharMarks`：点字写入快照 / 撤销清空删除键 / localStorage 持久化 / 进错题本聚合后清除
  - `recordReciteWithCharMarks` 聚合后清除 `pendingCharMarks[poemId]`（去重）
- `tests/unit/quiz-store-full.test.ts`：更新 detail 相关测试——submit 只调度 recordAnswer 一次，不再写 detail
- `tests/component/poem-card-page.test.ts`：更新 saveResult 断言——recordDetail 不再被调用（由组件即时保存），recordAnswer/recordReciteWithCharMarks 保留
- `tests/component/WrongBookPage.test.ts`：onMounted 时对待调度列表补 recordAnswer；对 pendingCharMarks 聚合字级统计
- `tests/unit/RecitationCard.test.ts`：点字后 `syncPendingReciteSchedule(poemId, true)` 且 `pendingCharMarks[poemId]` 快照同步

### e2e

新增单诗场景测试（`tests/e2e/review-plan.spec.ts` 或 `recitation-flow.spec.ts`）：
- 古诗详情 →「背诵复习」→ 标记一行「卡顿」→ 直接返回（不点下一首）
- 验证 localStorage 中错题本已含该诗 `line: 第1句:stuck` 条目
- 验证 localStorage 中待调度标记含该 poemId
- 进入错题本页 → 验证 recordAnswer 已补（records 中有该诗记录）
- 多首抽背流程（`recitation-flow.spec.ts` 现有用例）不回归

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/components/RecitationCard.vue` | 标注即时写入/移除；按钮文字；待调度标记同步；点字同步 pendingCharMarks |
| `src/stores/learning.ts` | `pendingReciteSchedules` + localStorage 持久化 + `syncPendingReciteSchedule`；`pendingCharMarks` 待聚合；`aggregateCharMarks` 辅助；recordReciteWithCharMarks 聚合后清 pending；recordAnswer recite 路径移除待调度 |
| `src/views/WrongBookPage.vue` | onMounted 补未提交的 recordAnswer 调度 + 聚合 pendingCharMarks |
| `src/stores/quiz.ts` | `submitRecitationResult` 移除重复 recordDetail |
| `src/views/PoemCardPage.vue` | `saveResult` 移除重复 recordDetail |
| `tests/unit/RecitationCard.test.ts` | 即时保存单测 + 按钮文字断言 + 待调度标记 |
| `tests/unit/learning-store.test.ts` | 待调度标记持久化/移除 |
| `tests/unit/quiz-store-full.test.ts` | 更新 detail 断言 |
| `tests/component/poem-card-page.test.ts` | 更新 saveResult 断言 |
| `tests/component/WrongBookPage.test.ts` | 错题本补调度测试 |
| `tests/e2e/*` | 单诗即时保存 e2e |
