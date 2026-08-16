# 字词标记功能设计

## 概述

在 RecitationCard 背诵模式中，支持点击汉字标记背诵错误。字词级标记与现有行级「卡顿/不会」标记独立并存。标记数据持久化到 localStorage，预留未来出题概率分析扩展。

## 核心决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 交互方式 | 单击点选 | 简单直觉，适合标记个别错字 |
| 标记行为 | 三态循环（ok→模糊→错误→ok） | 与行级「卡顿/不会」对应 |
| 可用场景 | 仅 RecitationCard | 背诵交互时标记，其他场景只读 |
| 视觉呈现 | 行内高亮 | 错字直接在行内显示黄/红底色 |
| 标点处理 | 不可标记 | 背诵错误只涉及汉字 |
| 实现方案 | 逐字拆分渲染 | 每字独立 span，点击精确，样式灵活 |
| 数据持久化 | localStorage | 支持跨会话分析 |

## 数据模型

### 字级标记状态

```typescript
type CharMarkStatus = 'fuzzy' | 'wrong'  // ok = 无记录

// 会话内：当前状态 map，可增删
// key: "lineIndex-charIndex"
type CharMarkMap = Record<string, CharMarkStatus>
```

### 每次背诵提交

```typescript
interface ReciteRecord {
  // ...existing fields...
  charMarks: CharMarkMap  // 本次背诵最终状态的快照
}
```

### 聚合统计

```typescript
interface CharMarkStats {
  poemId: string
  lineIndex: number
  charIndex: number
  char: string           // 原字，用于校验数据一致性
  fuzzyCount: number     // 历史快照中被标为模糊的次数
  wrongCount: number     // 历史快照中被标为错误的次数
  totalSessions: number  // 该诗参与背诵次数
}
```

### LearningRecord 新增字段

```typescript
interface LearningRecord {
  // ...existing fields...
  charMarkStats: CharMarkStats[]  // 按字聚合的累计统计
}
```

### 数据行为

- **会话内**：CharMarkMap 是可变状态，点击循环 ok→fuzzy→wrong→ok，回到 ok 时删除条目（误标记）
- **提交时**：将当前 CharMarkMap 快照存入 `ReciteRecord.charMarks`，追加到历史
- **提交后**：遍历本次快照更新 `CharMarkStats` 计数（fuzzyCount/wrongCount++），totalSessions 也 +1
- **未来分析**：从 `ReciteRecord[]` 或 `CharMarkStats` 计算某字的错误率

## 组件设计

### 逐字拆分渲染

当前行渲染：
```html
<span class="flex-1 text-lg">{{ line }}</span>
```

改为逐字拆分：
```html
<span class="flex-1 text-lg">
  <template v-for="(segment, i) in parseLine(line)" :key="i">
    <span v-if="segment.type === 'punct'" class="punct">{{ segment.char }}</span>
    <span v-else
      class="char-mark"
      :class="charMarkClass(lineIndex, segment.charIdx)"
      @click="toggleCharMark(lineIndex, segment.charIdx)"
    >{{ segment.char }}</span>
  </template>
</span>
```

### parseLine 工具函数

```typescript
function parseLine(line: string) {
  const segments = []
  let charIdx = 0  // 汉字索引（跳过标点）
  for (const char of line) {
    if (isCJK(char)) {
      segments.push({ type: 'char', char, charIdx: charIdx++ })
    } else {
      segments.push({ type: 'punct', char })
    }
  }
  return segments
}
```

### 样式

- 默认：无特殊样式
- `fuzzy`：`background: #fef3c7; color: #d97706; border-radius: 3px;`
- `wrong`：`background: #fecaca; color: #dc2626; border-radius: 3px;`
- 标点：`pointer-events: none; user-select: none;`

### 交互

- 点击汉字 → 三态循环：ok(无样式) → fuzzy(黄) → wrong(红) → ok(删条目)
- 标点不可点击
- 行级「卡顿/不会」按钮逻辑不变，字词标记是完全独立的交互层

## 数据流

```
用户点击汉字
  → toggleCharMark(lineIndex, charIdx)
    → 三态循环更新 CharMarkMap
    → 视觉即时更新（CSS class）

用户提交背诵结果
  → RecitationCard emit('result', { ...existing, charMarks })
    → learning store recordRecite()
      → 保存 ReciteRecord（含 charMarks 快照）到 reciteRecords
      → 更新 CharMarkStats（按字聚合计数）
      → 持久化到 localStorage
```

### store 层改动

- **learning store** 新增：
  - `charMarks: CharMarkMap` — 当前会话状态（响应式，组件绑定）
  - `initCharMarks(poemId)` — 切换古诗时重置
  - `toggleCharMark(lineIndex, charIdx)` — 三态循环
  - `updateCharMarkStats(poemId, charMarks)` — 提交时聚合统计
  - `getCharMarkStats(poemId)` — 获取某诗的字级统计

- **RecitationCard** 改动：
  - 提交结果时附带 `charMarks` 字段
  - 从 store 读取/更新字级状态

## 边界情况与错误处理

### 标点判定

- 使用 `isCJK()` 判断汉字，范围覆盖 CJK Unified Ideographs（U+4E00-U+9FFF）+ 兼容区
- 诗句中的逗号、句号、感叹号等一律不响应点击

### 古诗内容变化

- `CharMarkStats` 和 `ReciteRecord.charMarks` 中存储 `char` 原字用于校验
- 读取时若 `poem.text[lineIndex]` 对应的汉字与存储的 `char` 不一致，则该条统计失效，跳过

### 空数据兼容

- 旧版 `ReciteRecord` 无 `charMarks` 字段 → 默认 `{}`
- 旧版 `LearningRecord` 无 `charMarkStats` 字段 → 默认 `[]`
- `storage.ts` 的 `loadData()` 在反序列化时补全缺失字段

### 切换古诗

- RecitationCard 切换到新古诗时，`initCharMarks()` 重置 `CharMarkMap` 为空
- 上一首未提交的标记不会丢失——提交动作在切换前已触发

### 性能

- 每行最多 7 字 × 最多 8 行 = 56 个 span，DOM 开销可忽略
- `parseLine()` 结果可缓存，但每行字数极少，无需优化
