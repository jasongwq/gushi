# 架构问题修复设计

## 背景

AI 代码审查发现 7 个需要架构决策的问题，经头脑风暴确定方案如下。

## 1. 背诵结果分离记录

### 问题

`submitRecitationResult` 和 `PoemCardPage.saveResult` 为一首诗调用多次 `recordAnswer`（1次整体 + N次卡顿句 + 作者/朝代），每次都追加 correctness、生成 quizResult、影响复习调度。一首 not-mastered 的诗（2句卡顿 + 作者错 + 朝代错）产生 5 次 `recordAnswer`，导致：

- `reviewCount` 虚高（1→5），`getMasteryLevel` 返回 `'固'` 但实际没背出来
- `getNextInterval` 返回 15 天，但应 1 天后复习
- wrongBook 产生 3 条条目（recite/author/dynasty），正确回答时只清 1 条
- quizResult 膨胀，统计虚高

### 方案

**分离记录**：整体对错用 `recordAnswer` 一次调用，细节用新函数 `recordDetail` 单独记录。

#### 新增 `recordDetail` 函数

```ts
// learning.ts
function recordDetail(poemId: string, detailType: 'line' | 'author' | 'dynasty', wrongInfo?: string) {
  // 只更新 wrongBook，不进 correctness、不影响 reviewCount、不生成 quizResult
  const existing = data.value.wrongBook.find(w => w.poemId === poemId && w.quizType === detailType)
  if (existing) {
    existing.wrongCount++
    existing.lastWrongDate = new Date().toISOString().split('T')[0]
  } else {
    data.value.wrongBook.push({
      poemId,
      quizType: detailType,
      wrongCount: 1,
      lastWrongDate: new Date().toISOString().split('T')[0],
      unproficient: false,
    })
  }
  persist()
}
```

#### 修改 `submitRecitationResult`

```ts
// quiz.ts
function submitRecitationResult(result: RecitationResult) {
  if (!session.value) return
  session.value.recitationResults.push(result)

  const learningStore = useLearningStore()

  // 整体只调用一次 recordAnswer
  learningStore.recordAnswer(result.poemId, 'recite', result.overallStatus === 'mastered')

  // 细节用 recordDetail，不影响复习调度
  if (result.overallStatus !== 'mastered') {
    for (const line of result.lines) {
      if (line.status === 'stuck' || line.status === 'forgot') {
        learningStore.recordDetail(result.poemId, 'line', `第${line.lineIndex + 1}句:${line.status}`)
      }
    }
  }
  if (result.authorCorrect === false) {
    learningStore.recordDetail(result.poemId, 'author')
  }
  if (result.dynastyCorrect === false) {
    learningStore.recordDetail(result.poemId, 'dynasty')
  }

  session.value.currentIndex++
  resetCurrentRecitation()
}
```

#### 修改 `PoemCardPage.saveResult`

同上模式，与 `submitRecitationResult` 保持一致。

#### wrongBook 类型扩展

`WrongEntry.quizType` 当前为 `'fillBlank' | 'nextLine' | 'recite'`，需扩展为 `'fillBlank' | 'nextLine' | 'recite' | 'line' | 'author' | 'dynasty'`。

#### recordAnswer 中 correct=true 时清除 wrongBook

当前 `recordAnswer` 正确时清除对应 `quizType` 的 wrongBook 条目。`recordDetail` 不处理清除逻辑 — 卡顿句/作者/朝代的 wrongBook 条目只在整体背诵正确时通过 `recordAnswer('recite', true)` 清除 `quizType='recite'` 条目。`line/author/dynasty` 条目需要手动清除或保留（用户可以从错题本查看具体哪些句卡顿）。

**决策**：`recordDetail` 产生的 wrongBook 条目（line/author/dynasty）在整体背诵正确时一并清除。在 `recordAnswer` 中，当 `quizType='recite' && correct=true` 时，清除该诗所有 wrongBook 条目（包括 line/author/dynasty）。

---

## 2. 新增 firstLearnDate 字段

### 问题

`calculatePoemRetentionTimeline` 用 `lastReviewDate` 作为起始日期向前推算，但 `lastReviewDate` 是最近一次复习日期，不是首次学习日期。历史日期全部错误。

### 方案

- `LearningRecord` 新增 `firstLearnDate?: string`（可选，兼容旧数据）
- `getOrCreateRecord` 首次创建时设置 `firstLearnDate = today`
- `calculatePoemRetentionTimeline` 从 `firstLearnDate` 开始推算，无此字段时 fallback 到 `lastReviewDate`
- 不需要特殊数据迁移 — 旧数据首次 `recordAnswer` 时会自动填充

---

## 3. 移除迁移代码

### 问题

`loadData` 中检测 `'b'` 前缀 poemId 时清除所有用户数据，过于破坏性。

### 方案

- 删除 `loadData` 中第 28-33 行的迁移检测逻辑
- 保留 `getDefaultData()` 和 try/catch 错误处理

---

## 4. 宽松验证 + 默认值填充

### 问题

`importData` 只验证顶层结构，不验证内部字段。畸形数据会被存储并导致运行时错误。

### 方案

- 对每条 record 用 `{ ...defaultRecord, ...record }` 填充缺失字段
- `defaultRecord`：`{ poemId: '', lastReviewDate: '', reviewCount: 0, nextReviewDate: '', correctness: [], reciteCorrectness: [], masteryLevel: '新' as MasteryLevel, unproficient: false, unproficientCorrectStreak: 0 }`
- 对 `wrongBook` 条目同理用默认值填充
- `settings` 继续用 `{ ...defaultSettings, ...parsed.settings }` 合并
- 无 poemId 的记录跳过（`!record.poemId` 时 filter 掉）

---

## 5. 基于种子排序

### 问题

`allPoems` computed 在 `source === 'smart'` 时每次重新求值都调用 `shuffleArray`，导致依赖变化时卡片顺序突变。

### 方案

- smart 模式不再调用 `shuffleArray`
- 改为按优先级排序：到期需复习 → wrongBook 有记录 → reviewCount 低 → poemId 字母序
- 其他 source 模式（all/grade/review/wrong/unproficient）也移除 `shuffleArray`，改为稳定排序
- 如果需要随机性，在用户切换 source 时洗一次并缓存（ref），而非每次 computed 重新计算

```ts
const allPoems = computed(() => {
  const enabled = poemStore.enabledPoems
  if (source.value === 'all') return [...enabled].sort((a, b) => a.id.localeCompare(b.id))
  if (source.value === 'smart') {
    return [...enabled].sort((a, b) => {
      // 优先级：到期需复习 > wrongBook > reviewCount 低 > poemId
      const aDue = isDueForReview(a.id) ? 0 : 1
      const bDue = isDueForReview(b.id) ? 0 : 1
      if (aDue !== bDue) return aDue - bDue
      const aWrong = learningStore.wrongBook.some(w => w.poemId === a.id) ? 0 : 1
      const bWrong = learningStore.wrongBook.some(w => w.poemId === b.id) ? 0 : 1
      if (aWrong !== bWrong) return aWrong - bWrong
      const aCount = learningStore.getRecord(a.id)?.reviewCount ?? 0
      const bCount = learningStore.getRecord(b.id)?.reviewCount ?? 0
      if (aCount !== bCount) return aCount - bCount
      return a.id.localeCompare(b.id)
    })
  }
  // ... 其他 source
})
```

---

## 6. PoemPopup 无障碍

### 问题

缺少 `role="dialog"`、`aria-modal`、焦点陷阱、Escape 键关闭。

### 方案

- 安装 `vue-focus-lock`
- overlay div 加 `role="dialog" aria-modal="true" aria-label="古诗详情"`
- popup-content 用 `<FocusLock>` 包裹
- 加 `@keydown.escape="$emit('update:visible', false)"`
- 打开时 `nextTick(() => contentRef.focus())`
- 关闭时恢复焦点到触发按钮（通过 `returnFocus` prop 或手动记录）

---

## 7. PoemCardPage.saveResult 重复模式

与 #1 同方案 — 分离记录，统一使用 `recordAnswer` + `recordDetail`。

---

## 影响范围

| 文件 | 变更 |
|------|------|
| `src/types/index.ts` | LearningRecord 新增 firstLearnDate；WrongEntry.quizType 扩展 |
| `src/stores/learning.ts` | 新增 recordDetail；recordAnswer 处理 recite 正确时清除全部 wrongBook |
| `src/stores/quiz.ts` | submitRecitationResult 改用分离记录 |
| `src/views/PoemCardPage.vue` | saveResult 改用分离记录；allPoems 改用优先级排序 |
| `src/utils/retention.ts` | calculatePoemRetentionTimeline 使用 firstLearnDate |
| `src/utils/storage.ts` | 移除迁移代码；importData 加默认值填充 |
| `src/components/PoemPopup.vue` | 加 vue-focus-lock + ARIA + Escape |
| `package.json` | 新增 vue-focus-lock 依赖 |

## 测试策略

- 单元测试：recordDetail、importData 默认值填充、firstLearnDate 时间线、优先级排序
- 更新现有单元测试：recordAnswer 不再产生多条 wrongBook 条目
- 组件测试：PoemPopup Escape 键关闭、焦点陷阱
- E2E：背诵结果不再产生多条 wrongBook 条目
