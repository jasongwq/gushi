# 古诗背诵及遗忘曲线数据功能设计

日期：2026-08-15

## 概述

为古诗抽查 PWA 新增两个核心功能：
1. **古诗背诵（自评模式）** — 独立模块，学生看标题后自行背诵，展开原文对照，自评"会/不会"
2. **遗忘曲线效果数据** — 背诵结果纳入遗忘曲线调度，背诵和答题记录分开存储，进度页可查看遗忘曲线可视化

## 一、数据模型

### 新增 ReciteRecord 类型

```typescript
interface ReciteRecord {
  poemId: string
  date: string           // YYYY-MM-DD
  correct: boolean       // 自评"会"=true，"不会"=false
}
```

### 修改 LearningRecord

```typescript
interface LearningRecord {
  poemId: string
  lastReviewDate: string
  reviewCount: number
  nextReviewDate: string
  correctness: number[]          // 答题正确性历史 [1,0,1,1]
  reciteCorrectness: number[]   // 新增：背诵正确性历史 [1,0,1,1]
  masteryLevel: MasteryLevel
  unproficient: boolean
  unproficientCorrectStreak: number
  lastLearnDate?: string
}
```

### 修改 UserData

```typescript
interface UserData {
  records: LearningRecord[]
  quizResults: QuizResult[]
  reciteRecords: ReciteRecord[]  // 新增
  wrongBook: WrongEntry[]
  settings: UserSettings
}
```

### 数据迁移

- `loadData()` 检测旧版 `LearningRecord` 缺少 `reciteCorrectness` 字段时，自动初始化为空数组 `[]`
- `reciteRecords` 缺失时初始化为空数组 `[]`

## 二、背诵页面交互

### 路由

| 路径 | 组件 | 说明 |
|------|------|------|
| `/recite` | RecitePage | 背诵入口+卡片流 |
| `/recite/result` | ReciteResultPage | 背诵结果 |

### RecitePage 交互流程

1. **来源选择阶段**
   - 顶部显示"今日待复习"数量（从遗忘曲线筛选 nextReviewDate <= 今天）
   - 两个来源选项：
     - **待复习** — 仅显示到期古诗
     - **全部古诗** — 按年级分组浏览选择
   - 选择后进入背诵卡片流

2. **背诵卡片流阶段**（同一页面内）
   - 卡片正面：显示标题、作者、朝代
   - 学生自行背诵后，点击"查看原文"展开
   - 展开后显示完整诗文，底部两个按钮：
     - **会了**（绿色）→ 记录 correct=true，调用 `calculateNextReview` 更新遗忘曲线
     - **不会**（红色）→ 记录 correct=false，调用 `handleWrongAnswer` 更新遗忘曲线
   - 选择后自动进入下一首，卡片切换有过渡动画
   - 顶部进度条显示"3/12"进度
   - 全部完成后跳转 ReciteResultPage

3. **遗忘曲线调度**
   - 背诵"会"→ 调用 `calculateNextReview(correct=true)`
   - 背诵"不会"→ 调用 `handleWrongAnswer()`
   - 复用现有 `ebbinghaus.ts`，不重复实现

### ReciteResultPage

- 统计：总数、会了、不会
- 不会的古诗列表，可点击查看原文
- "再来一轮"按钮（只复习不会的）
- "返回首页"按钮

## 三、遗忘曲线可视化

### 依赖

- 新增 Chart.js 作为项目依赖

### 进度页总览（ProgressPage 增强）

- 顶部新增总体遗忘曲线概览图
- 图表类型：Chart.js line chart
- 横轴：日期（最近30天）
- 纵轴：记忆保持率（0-100%）
- 两条线：
  - 答题保持率（蓝色）— 基于 `correctness` 数组
  - 背诵保持率（绿色）— 基于 `reciteCorrectness` 数组
- 计算方式：
  - 单首保持率 = `1 - (距上次复习天数 / 当前复习间隔)`，上限1，下限0
  - 每日总体保持率 = 所有已学习古诗保持率的加权平均
- 支持交互：hover 显示数据点详情

### 单首古诗详情页（PoemDetailPage）

- 路由：`/poem/:id`
- 从进度页古诗列表点击进入
- 展示内容：
  - 古诗基本信息（标题、作者、朝代、年级）
  - 遗忘曲线图（Chart.js line chart）：
    - 横轴：复习时间线（日期）
    - 纵轴：记忆保持率
    - 数据点样式：答题（蓝色圆点）、背诵（绿色圆点）
    - 答错/不会的点用红色标记
  - 当前掌握等级、下次复习日期
  - 答题正确率统计（正确次数/总次数）
  - 背诵正确率统计（正确次数/总次数）
- 遗忘曲线数据点计算：
  - 将 `correctness` 和 `reciteCorrectness` 的历史记录按时间排序
  - 每次答题/背诵后，根据遗忘曲线公式计算保持率
  - 保持率 = `e^(-t/S)` 其中 t=距上次复习天数，S=当前间隔

## 四、路由与导航

### 新增路由

| 路径 | 组件 | 说明 |
|------|------|------|
| `/recite` | RecitePage | 背诵入口+卡片流 |
| `/recite/result` | ReciteResultPage | 背诵结果 |
| `/poem/:id` | PoemDetailPage | 单首古诗详情+遗忘曲线 |

### 首页导航

- HomePage 新增"背诵"入口按钮，与现有"家长模式""自学模式"并列
- ProgressPage 古诗列表每首增加点击事件，跳转 PoemDetailPage

## 五、文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/views/RecitePage.vue` | 背诵入口+卡片流页面 |
| `src/views/ReciteResultPage.vue` | 背诵结果页面 |
| `src/views/PoemDetailPage.vue` | 单首古诗详情+遗忘曲线页面 |
| `src/utils/retention.ts` | 记忆保持率计算工具 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/types/index.ts` | 新增 ReciteRecord，LearningRecord 增加 reciteCorrectness |
| `src/utils/storage.ts` | 数据迁移逻辑，新增 reciteRecords |
| `src/stores/learning.ts` | 新增背诵记录方法，背诵遗忘曲线调度 |
| `src/router/index.ts` | 新增3个路由 |
| `src/views/HomePage.vue` | 新增"背诵"入口按钮 |
| `src/views/ProgressPage.vue` | 新增总览遗忘曲线图，古诗列表可点击 |
| `package.json` | 新增 chart.js 依赖 |

### 不变文件

- `src/utils/ebbinghaus.ts` — 遗忘曲线算法复用，无需修改
- `src/utils/quiz.ts` — 抽查逻辑不变
- `src/stores/quiz.ts` — 抽查 store 不变
- 现有3个 Quiz 组件不变

## 六、已知限制与后续

- 背诵功能为自评模式，依赖学生自觉性，无法验证是否真正背诵
- 遗忘曲线可视化基于艾宾浩斯模型简化计算，实际记忆保持受多种因素影响
- 后续可考虑：语音背诵（recite 类型）、复习功能（独立复习页面/智能复习计划）
