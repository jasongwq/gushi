# 自助练习新增「古诗背诵」题型设计

日期：2026-08-19
状态：已获用户批准（设计决策已确认）

## 背景

自助练习（`QuizSetupPage` 的 `mode=self`）目前只有「补字选择」「上下句接龙」两种题型，流程走 `QuizPlayPage` → `QuizResultPage`。家长抽查里的「古诗抽背」使用 `RecitationCard` 展示全诗并逐句自评，但与自助练习是完全独立的流程。

本次需求：在自助练习的题目类型中新增「古诗背诵」。显示效果同家长抽查里的古诗详情（即 `RecitationCard` 的布局），但**默认隐藏内容只显示古诗题目**，点击卡片任意处依次揭示：**作者 → 译文 → 正文**。

## 已确认的设计决策

1. **保留自评按钮**：揭示全部内容后，仍显示「熟练 / 完全不会」自评按钮（与家长抽查一致），点击后记录背诵结果（进学习记录/错题本）。
2. **点击卡片任意处**：点一下卡片任意位置即揭示下一层（作者→译文→正文），不依赖专门按钮。
3. **同场混排**：古诗背诵题与补字/接龙题在同一个 session 中混合穿插，共用一套答题/结果流程。
4. **统一队列逐个推进**：所有题目（背诵+选择）打散成一条队列。背诵题靠自评按钮提交后进入下一题；选择题选完自动进入下一题；进度圆点统一显示。
5. **沿用圆点+可回顾**：保留现有 `QuizPlayPage` 的进度圆点，已答题目可点击跳回查看。
6. **熟练=正确**：背诵题自评「熟练」计入正确率（答对），「完全不会/下一首（有标注）」计入答错，与选择题同场显示统计。

## 揭示层级

背诵题卡片按以下顺序逐步揭示，每层均有明确顺序：

| 层数 | 揭示内容 | 说明 |
|------|----------|------|
| 0 | 仅古诗标题 | 初始状态 |
| 1 | + 作者（朝代·作者） | 点击一次 |
| 2 | + 译文 | 再点击一次 |
| 3 | + 正文（含逐句自评按钮、字级标记） | 最后点击，成为完整详情 |

点击揭示在**揭示前**进行，即点击卡片空白区域（非按钮）触发下一步揭示。作者和译文揭示后即固定显示，不会再次隐藏。正文揭示后展示完整 `RecitationCard` 布局。

### 揭示后的自评

正文揭示后（第 3 层），底部出现「熟练」「完全不会」两个自评按钮，与家长抽查 `RecitationCard` 一致：
- 「熟练」= mastered → 计入答对。
- 「完全不会」= not-mastered（所有行标"不会"）→ 计入答错。
- 自评前用户可像家长抽查一样逐句标「卡顿/不会」、标作者/朝代「不会」、点击字做字级标记。提交时按 `RecitationResult` 收集，`hasAnyIssue` 判断与现有 `RecitationCard` 相同。

注意：第 2 层（+译文）后正文尚未揭示，此时**不显示自评按钮**；第 3 层揭示正文后才显示。作者/译文揭示后若用户直接点击自评按钮（在正文未揭示前），不可提交——自评按钮仅在正文揭示后才出现。

### 揭示状态重置

每首背诵题切换时（下一题/回看上一题），揭示状态重置为第 0 层（仅标题）。

## 架构设计

### 1. `RecitationCard` 增加揭示模式

无需新建组件文件，直接在 `RecitationCard.vue` 内部增加揭示能力（方案 A）。

实现方式两种选一（实现时择优）：
- **A. 参数化 RecitationCard**：给 `RecitationCard` 增加 `revealMode`/`initialRevealStep` prop，内部用 `v-if`/`v-show` 控制各区块（作者区、译文区、正文区、自评按钮）的显隐。自评逻辑完全复用。
- **B. 新组件包裹 RecitationCard**：新组件管理揭示状态，用 `v-show` 控制子组件 `RecitationCard` 的显隐，并在揭示未完成时用遮罩层拦截点击。但这样无法逐层显示作者/译文/正文（它们都在 RecitationCard 内部），不满足"逐层揭示"要求。

**推荐 A**：直接在 `RecitationCard` 内部增加揭示支持，因为它天然拥有各区块的 DOM 结构，且自评逻辑无需复制。

具体改动（方案 A）：
- `RecitationCard` 新增 props：
  - `revealMode?: boolean`（默认 false，家长抽查行为不变）
  - `revealStep?: number`（当前揭示层，0-3，仅 revealMode 下生效，由父组件 QuizPlayPage 持有）
  - `@reveal-step-change` 事件：点击卡片空白区域时触发，父组件更新 revealStep。
- `revealMode` 下：
  - 作者行（`poem.dynasty · poem.author`）：仅当 `revealStep >= 1` 时显示。揭示前用占位（如「作者 · ？？」）或隐藏，视觉上用占位灰字更好。
  - 译文按钮 + 译文区块：仅当 `revealStep >= 2` 时显示。注意：家长抽查里译文按钮是"显示/隐藏"开关；自助练习的揭示模式里，第 2 层揭示的译文**默认直接显示**（不需要再点按钮切换），且正文未揭示。
  - 正文区（逐句标注 + 卡顿/不会按钮 + 字级标记）：仅当 `revealStep >= 3` 时显示。
  - 自评按钮「熟练/完全不会」：仅当 `revealStep >= 3` 时显示。
  - 上一首/下一首按钮：在自助练习队列里由 `QuizPlayPage` 的圆点统一导航，不需要在卡内显示"下一首"按钮。卡内按钮仅保留自评。
  - 点击卡片空白处（非按钮、非字级标记字符）时 `@click` 触发 `revealStep++`（上限 3）。可用一个覆盖层或根节点 click 处理 + 对按钮 `@click.stop`。
  - 所有自评相关按钮（卡顿/不会/熟练/完全不会/作者/朝代「不会」、字级标记字符）都 `@click.stop` 防止误触触发揭示。
- **revealStep 状态归属**：由 `QuizPlayPage` 持有（ref），prop 传入组件，组件通过 `@reveal-step-change` 请求父组件增加。切换题目（displayIndex 变化）时重置为 0；`isReviewing`（已答题回顾）时强制传 3。这样回顾已答背诵题能显示完整内容。
- 家长抽查（revealMode=false）行为完全不变。

### 2. 题库生成：`generateQuestion` 支持 recite

`src/stores/quiz.ts` 的 `generateQuestion` 目前 `default` 分支把 recite fallback 为 nextLine。需新增 `case 'recite'`：

```ts
case 'recite': {
  return {
    poemId: poem.id,
    quizType: 'recite',
    prompt: poem.title,   // 供结果页显示
    options: [],
    correctIndex: 0,
  }
}
```

这样 `startQuiz(source, ['recite', 'fillBlank'], ...)` 能生成混合题目队列，`shuffleArray(questions)` 已存在，天然混排。

### 3. `QuizPlayPage` 渲染背诵题

`QuizPlayPage.vue` 模板增加分支：

```html
<RecitationCard
  v-else-if="currentDisplayQuestion.quizType === 'recite'"
  :key="'q-' + displayIndex"
  :poem="poem"
  reveal-mode
  :reveal-step="isReviewing ? 3 : revealStep"
  @reveal-step-change="revealStep++"
  @submit="onReciteSubmit"
/>
```

- `poem` 由 `poemStore.getPoemById(question.poemId)` 计算。
- `onReciteSubmit(result)`：
  - 调用 `quizStore.submitRecitationResult(result)`（负责记录 `recitationResults`、`learningStore.recordAnswer('recite', ...)`、细节记录、`currentIndex++`）。
  - 字级标记统计：与 `RecitationPlayPage.onSubmit` 相同，调用 `learningStore.recordReciteWithCharMarks(result.poemId, result.overallStatus === 'mastered', poem.text, result.charMarks)`。
  - 若 `quizStore.isFinished` 跳转 `quiz-result`。
- `selectAnswer` 仅对选择题生效；背诵题不经过它。

关键点：`submitRecitationResult` 已实现 `currentIndex++`，而选择题 `answerQuestion` 也是 `currentIndex++`，所以混排推进天然一致。背诵题额外推 `answers` 条目是为了统一圆点/统计。

**注意**：`submitRecitationResult` 内 `session.value.currentIndex++` 后，`session.answers.push` 必须在 `currentIndex++` 前用当前索引，或在 `submitRecitationResult` 中直接整合。实现时需仔细处理索引顺序。

**实现建议（最终采用）**：**修改 `submitRecitationResult`**，当收到背诵提交时在 `currentIndex++` **之前**同步推一条 answers 条目：
```ts
session.value.answers.push({
  questionIndex: session.value.currentIndex,
  selectedIndex: 0,   // recite 无选项，占位
  correct: result.overallStatus === 'mastered',
})
```
这样混排计数统一，且 `RecitationPlayPage`/`PoemCardPage` 不受影响（它们不读 answers）。需检查现有测试是否断言 `submitRecitationResult` 后 `answers` 长度并相应更新。

### 4. `QuizSetupPage` 增加「古诗背诵」选项

`selfQuizTypeOptions` 增加：
```ts
{ value: 'recite', label: '古诗背诵' }
```

`startQuiz` 流程调整：
- 当前逻辑：`if (quizTypes.value.includes('recite'))` → 走 `startRecitation`（独立背诵流程）。这在自选模式下需区分。
- 修改为：`mode=self`（自主练习）时，如果勾选了 recite，**进入 `startQuiz` 混排流程**（不再走独立背诵流程）；`mode=parent`（家长抽查）时保留现状（`recite` → `poem-card`）。
- 即：把 `isParentMode.value && quizTypes.value.includes('recite')` 分支保留，删除后面的 `if (quizTypes.value.includes('recite'))` 独立背诵分支，或仅当非 parent 时直接走 `startQuiz`（startQuiz 现在能生成 recite 题目）。

`saveSettings` 里现有 `quizTypes: isParentMode.value ? selfQuizTypes.value : quizTypes.value` 有可疑逻辑（家长模式保存自选值），本次不改动，避免范围蔓延。

### 5. 结果页 `QuizResultPage`

现有结果页遍历 `session.answers` 展示每题。背诵题 push 的 answers 条目已含 `correct`，因此：
- 背诵题会出现在结果列表中。
- `question.prompt` = 诗标题（generateQuestion 已设置），`selected`/`correct` 为 options 空数组的索引，会显示空串。需处理：
  - 对 `quizType === 'recite'` 的条目，显示「熟练 ✓ / 不熟练 ✗」而非「你的答案：/ 正确答案：」。
  - `answers` computed 中为 recite 条目设置显示文本：`selected: isCorrect ? '熟练' : '不熟练'`、`correct: '熟练'`（基于 answers 条目的 `correct` 布尔，无需整体状态）。
  - 模板对 recite 条目隐藏「你的答案/正确答案」两行（因 options 为空，无实际选项文本）。
- `score` = `correctCount / totalQuestions`，背诵题计入。与决策 6 一致。

### 6. 进度圆点

`QuizPlayPage` 的圆点状态来自 `getAnswerStatus(index)` 查询 `session.answers`。背诵题提交后 answers 有条目 → 圆点正确显示绿/红，可点击回顾。回顾时 `RecitationCard` 以 `revealStep=3`（完整揭示）渲染，展示已提交的自评结果。

实现：`QuizPlayPage` 持有 `revealStep` ref，`watch(displayIndex)` 重置为 0；但 `isReviewing`（已答题）时强制传 3。渲染时 `:reveal-step="isReviewing ? 3 : revealStep"`。

## 数据流

```
QuizSetupPage (self, 勾选古诗背诵)
  → startQuiz(source, ['recite', 'fillBlank', ...], count, grades)
    → generateQuestions → generateQuestion(poem, 'recite') → recite question
    → session = { questions: [mix], mode: 'quiz', ... }
  → QuizPlayPage
    → 渲染 FillBlankQuiz / NextLineQuiz / RecitationCard(revealMode)
    → 选择题: selectAnswer → answerQuestion → answers push → currentIndex++
    → 背诵题: RecitationCard(revealMode) @submit → submitRecitationResult
        → recitationResults push + recordAnswer('recite') + 细节 + answers push + currentIndex++
    → 全部完成后 → quiz-result
      → QuizResultPage 展示混合统计（score 含背诵）
```

## 边界情况

1. **只勾选古诗背诵**：`startQuiz` 只生成 recite 题目，无选择题，混排退化为纯背诵队列。行为：每首点开揭示→自评→下一首。仍走 `QuizPlayPage`/`QuizResultPage`（不跳 poem-card 也不跳 RecitationPlayPage）。这是"同场混排"决策的自然延伸。
2. **smartMix 选诗重复**：`generateQuestions` 对每首诗 × 每个 quizType 各生成一题，同一首诗可能同时有 recite 和 fillBlank 题。可接受，与现有补字/接龙混排行为一致。
3. **刷新恢复**：session 持久化到 sessionStorage，`RESTORABLE_ROUTES` 含 `quiz-play`。背诵题的 revealStep 为组件本地状态，刷新后回到第 0 层（仅标题），已答题回顾仍显示完整内容（isReviewing 判断基于 answers 条目）。可接受。
4. **空队列**：startQuiz 已有 `questions.length === 0` 返回 false 的逻辑，recite 生成不依赖 options，不会导致空队列。
5. **旧数据兼容**：session 恢复时 recite 题目 `prompt` 为标题，`options: []`，`correctIndex: 0`。结果页/圆点逻辑需对空 options 防御（recite 条目不走 selectedIndex 取 options）。已在结果页方案中处理。

## 测试计划

### 单元测试
- `quiz-store.test.ts` 扩展：
  - `generateQuestion('recite')` 返回 quizType='recite'、options=[] 的题目。
  - `startQuiz` 混合 recite+fillBlank 生成对应题目数量。
  - `submitRecitationResult` 同时推 answers 条目（correct=mastered）。
- 新 `RecitationCard.test.ts`（揭示模式用例）：
  - revealMode 默认仅显示标题，不显示作者/译文/正文/自评按钮。
  - 点击卡片 → emit reveal-step-change；再点 → 显示作者；revealStep>=2 → 显示译文；revealStep=3 → 显示正文+自评按钮。
  - 点击按钮不触发揭示。
  - 自评「熟练」emit submit(mastered)，「完全不会」emit submit(not-mastered)。
- `QuizPlayPage.test.ts` 扩展：
  - recite 题渲染 `RecitationCard`（revealMode）。
  - 提交 recite 后 answers 有条目、currentIndex 前进、圆点正确。

### 组件/E2E 测试
- e2e 新增：自助练习勾选古诗背诵 → 开始 → 背诵题默认仅标题 → 逐次点击显示作者/译文/正文 → 自评熟练 → 进入下一题 → 完成到结果页显示统计。
- e2e 新增：混合模式（背诵+接龙）混排、圆点回顾背诵题显示完整内容。
- 回归：家长抽查流程不受影响（revealMode=false 时 RecitationCard 行为不变）；现有 e2e 全部通过。

## 不做的事（YAGNI）

- 不做「逐层独立按钮」式任意揭示（决策 2 已选点击卡片任意处）。
- 不做背诵题在结果页的展开背诵详情（结果页只显示熟练/不熟练状态行）。
- 不改 `RecitationPlayPage`（独立抽背流程保持不变，家长抽查走 poem-card）。
- 不改家长抽查的 `RecitationCard` 现有行为。
