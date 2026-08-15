# 古诗抽背功能设计

## 概述

在现有古诗抽查 PWA 中新增"古诗抽背"模式。家长念标题，孩子口头背诵，家长对照原文逐句判定对错。支持整首熟练、逐句标记（卡顿/不会）、作者/朝代单独标记。

## 核心交互

- **家长念标题，孩子背全诗**：显示古诗标题+作者，孩子口头背诵，家长对照原文判定
- **判定粒度**：
  - 整首诗：熟练 ✓
  - 逐句：不会 / 卡顿（默认全部熟练，家长只需点异常的句子）
  - 附加项：作者、朝代可单独标记对/错
- **流程**：逐首翻页，一首判完点下一首，全部完成后看汇总
- **筛选**：复用现有筛选逻辑（年级、来源、数量）

## 数据模型

```typescript
interface RecitationLineResult {
  lineIndex: number                          // 诗句在 text[] 中的索引
  status: 'ok' | 'stuck' | 'forgot'         // 熟练/卡顿/不会
}

interface RecitationResult {
  poemId: string
  overallStatus: 'mastered' | 'not-mastered' // 整首诗：熟练/不熟练
  lines: RecitationLineResult[]              // 逐句判定（仅 not-mastered 时填写）
  authorCorrect: boolean | null              // 作者是否正确（null=未问）
  dynastyCorrect: boolean | null             // 朝代是否正确（null=未问）
}
```

- `overallStatus = mastered` 时，lines 为空，不需要逐句判定
- `authorCorrect` / `dynastyCorrect` 为 null 表示没问，区分"问了但答错"

## 页面与交互流程

### 路由

- `/recitation/play` → RecitationPlayPage
- `/recitation/result` → RecitationResultPage

### 首页入口

在现有"开始抽查"按钮旁新增"开始抽背"按钮，跳转到 `/recitation/play`。复用首页已有的筛选配置。

### 逐首翻页

1. 顶部：进度条 + "第 N / M 首"
2. 中间：大字显示古诗标题 + 作者
3. 点击"开始背诵" → 展开原文逐句显示
4. 每句右侧三个按钮：✓ 熟练 / ⏸ 卡顿 / ✗ 不会（默认 ✓）
5. 底部附加项：作者对/错、朝代对/错（可选，默认不问）
6. "整首熟练"按钮在最醒目位置，一键跳过逐句判定
7. 点"下一首"提交当前结果，进入下一首

### 结果页

- 汇总：N 首熟练 / M 首不熟练
- 不熟练的诗展开显示：哪些句子卡顿/不会，作者/朝代是否正确
- "再来一轮" / "返回首页"

### 关键交互细节

- "整首熟练"按钮最醒目，因为理想情况大部分诗都熟练
- 逐句判定默认全部为"熟练"，家长只需点卡顿/不会的句子，减少操作量
- 展开原文后，"整首熟练"按钮仍可见

## 状态管理

### QuizStore 扩展

```typescript
session: {
  ...existing,
  mode: 'quiz' | 'recitation'  // 区分模式
}

// 新增
recitationResults: RecitationResult[]
currentRecitation: {
  overallStatus: 'mastered' | 'not-mastered' | null
  lineStatuses: RecitationLineResult[]
  authorCorrect: boolean | null
  dynastyCorrect: boolean | null
}
```

### 出题逻辑

复用现有 `generateQuestions`，recitation 模式下：
- 不需要生成选项（无 distractor）
- 每题只需 poemId + poem 数据
- `quizType` 统一为 `'recitation'`

### 学习记录

抽背结果写入 learningStore：
- `overallStatus = mastered` → 记录一次正确
- `overallStatus = not-mastered` → 记录一次错误，卡顿/不会的句子记入错题
- 作者/朝代错误 → 记入错题，quizType 分别为 `'author'` / `'dynasty'`

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/components/RecitationCard.vue` | 抽背判定卡片（标题+逐句+附加项） |
| `src/views/RecitationPlayPage.vue` | 抽背答题页 |
| `src/views/RecitationResultPage.vue` | 抽背结果页 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/types/index.ts` | 新增 RecitationResult, RecitationLineResult |
| `src/stores/quiz.ts` | 扩展 mode, recitationResults, currentRecitation |
| `src/utils/quiz.ts` | generateQuestions 支持 recitation 模式 |
| `src/views/HomePage.vue` | 新增"开始抽背"入口按钮 |
| `src/router/index.ts` | 新增 recitation 路由 |

### 组件职责

**RecitationCard.vue**：核心交互组件
- Props: `poem`, `currentRecitation`
- Emits: `submit(result)`
- 展示标题 → 点击展开原文 → 逐句判定 → 整首熟练快捷按钮 → 作者/朝代附加项

**RecitationPlayPage.vue**：页面容器
- 进度条 + 引用 RecitationCard
- 每次提交后翻到下一首
- 最后一首完成后跳转结果页

**RecitationResultPage.vue**：结果汇总
- 熟练/不熟练统计
- 不熟练的诗展开详情
- 再来一轮 / 返回首页
