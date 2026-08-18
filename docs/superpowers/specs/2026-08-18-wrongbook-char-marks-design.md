# 错题本字词标注展示设计

## 概述

在错题本页面展示字词级背诵标注。列表卡片按诗合并显示错题类型标签与字词角标，弹窗内古诗原文逐字高亮（黄=模糊、红=错误）并显示错误次数。数据来自已持久化的 `LearningRecord.charMarkStats`（当前无任何视图消费，本设计补上展示层）。

## 核心决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 展示位置 | 卡片角标 + 弹窗高亮 两者都要 | 列表快速概览 + 弹窗完整查看 |
| 卡片展示 | 诗题 + 所有错题类型标签 | 按诗合并后一目了然 |
| 字词角标 | 「错X字 · 模糊Y字」分别显示 | 区分模糊/错误两种状态 |
| 角标计数 | 有标注的字总数（wrong/fuzzy 分别计） | 每个字只要有过标注即计入 |
| 列表去重 | 卡片按诗合并显示（展示层合并） | 同诗多条目不重复展示 |
| 原条目操作 | 标签可点击，弹出该条目操作 | 移除/标不熟练仍按原条目 |
| 无字词数据 | 角标隐藏，弹窗保持纯文本 | 无数据不干扰现有行为 |
| 实现方案 | 扩展现有组件（PoemPopup + WrongBookPage） | 数据已就绪，只缺展示层 |

## 数据层

### 新增工具函数（`src/utils/charMark.ts`）

```typescript
// 从 CharMarkStats[] 构建 lineIndex-charIndex 查找表
export interface CharMarkStatEntry {
  char: string
  fuzzyCount: number
  wrongCount: number
}

export function buildCharMarkLookup(stats: CharMarkStats[]): Record<string, CharMarkStatEntry>

// 某诗的字词统计摘要（用于角标）
export interface CharMarkSummary {
  wrongCount: number  // 有 wrong 记录的字数
  fuzzyCount: number  // 有 fuzzy 记录的字数
}

export function summarizeCharMarks(stats: CharMarkStats[]): CharMarkSummary
```

- 一个 `(lineIndex, charIndex)` 位置在 `charMarkStats` 中只有一条记录（累计计数），无重复条目
- `summarizeCharMarks`：某字 `wrongCount > 0` 则计入 `wrongCount`；否则 `fuzzyCount > 0` 计入 `fuzzyCount`（一个字只归入一类）
- 角标显示条件：`wrongCount + fuzzyCount === 0` 时隐藏

### 数据获取

- `learningStore.getCharMarkStats(poemId, poem.text)` — 现有方法，校验内容变化
- `buildCharMarkLookup(stats)` → 弹窗逐字渲染用
- `summarizeCharMarks(stats)` → 卡片角标用

## 组件设计

### PoemPopup 增强

新增可选 prop：

```typescript
interface Props {
  poem: Poem
  visible: boolean
  charMarkStats?: CharMarkStats[]  // 可选：提供时逐字渲染高亮
}
```

渲染逻辑：
- 无 `charMarkStats` 或为空 → 保持现状（纯文本 `<p class="popup-line">`）
- 有数据 → 用 `parseLine(line)` 逐字拆分，按 `buildCharMarkLookup` 查找每个汉字：
  - `fuzzyCount > 0 && wrongCount === 0` → 黄色高亮（`char-fuzzy`）
  - `wrongCount > 0` → 红色高亮（`char-wrong`）
  - 无记录 → 正常显示
- 标点正常显示，不可点击
- 次数标注：每个高亮字旁显示 `×N` 上标（N = 该字的 fuzzyCount 或 wrongCount）

样式：`char-fuzzy` / `char-wrong` 类从 RecitationCard scoped style 提取为全局样式（或复制），复用同一视觉。

兼容性：`charMarkStats` 为可选 prop，QuizResultPage 等现有使用方不受影响。

### WrongBookPage 聚合展示

数据转换：

```typescript
interface GroupedWrongEntry {
  poemId: string
  poem?: Poem
  entries: WrongEntry[]           // 原条目列表（保留操作数据）
  quizTypeLabels: string[]        // 所有错题类型标签（去重）
  totalWrongCount: number         // 所有条目 wrongCount 之和
  charSummary: CharMarkSummary | null  // 字词角标，null 表示无数据
}

const groupedEntries = computed<GroupedWrongEntry[]>(() => {
  // 对 enabledWrongBook 按 poemId 分组
  // 每组：收集 entries、标签（去重）、总错误次数
  // 用 getCharMarkStats(poemId, poem.text) 计算 charSummary
})
```

卡片渲染：
- **诗题**：可点击，打开 PoemPopup（传入 `poem` + `getCharMarkStats(poemId, poem.text)`）
- **错题类型标签**：多个并排，每个可点击弹出该条目的操作菜单
- **字词角标**：「错X字 · 模糊Y字」（无数据隐藏）
- **总错误次数**：「错N次」

标签点击操作：点击某标签 → 弹出该原条目的操作菜单（移除 / 标不熟练）：
- 移除 → `learningStore.removeWrongEntry(poemId, quizType)`（现有方法）
- 标不熟练 → `learningStore.toggleUnproficient(poemId)`（现有方法，作用于整首诗所有条目）

## 数据流

```
WrongBookPage 渲染
  → enabledWrongBook（现有过滤）
  → 按 poemId 分组 → GroupedWrongEntry[]
    → 卡片：诗题 + 标签 + 角标（summarizeCharMarks）+ 总错误次数
    → 弹窗：getCharMarkStats(poemId, poem.text)
      → PoemPopup charMarkStats prop
        → parseLine 逐字渲染 + buildCharMarkLookup 查状态
        → char-fuzzy/char-wrong 高亮 + ×N 次数标注
```

## 边界情况与错误处理

| 场景 | 处理 |
|------|------|
| 无字词数据 | 角标隐藏；弹窗纯文本（现状） |
| 内容变化 | `getCharMarkStats(poemId, poemText)` 校验 char，不一致条目过滤 |
| 诗被禁用 | `enabledWrongBook` 先过滤，再聚合 |
| 同诗多条目 | 聚合为一个卡片，标签多个；移除单条目后仍有条目则保留卡片 |
| 单诗单条目 | 退化为单标签卡片，行为与现状一致 |
| 弹窗无数据 | `charMarkStats` 空数组/undefined → 纯文本 |

## 测试

- **单元测试**（`charMark.test.ts`）：`buildCharMarkLookup`、`summarizeCharMarks`（含 fuzzy/wrong 混合、仅 fuzzy、仅 wrong）
- **组件测试**（`PoemPopup.test.ts`）：有 `charMarkStats` 渲染高亮 + 次数标注；无数据纯文本；标点正常
- **组件测试**（`WrongBookPage`）：同诗多条目聚合为一卡片、标签数量正确、角标显示/隐藏、标签点击弹出操作、移除单条目后卡片更新
- **e2e**：错题本字词标注场景 — 角标可见、弹窗高亮、标签可操作
