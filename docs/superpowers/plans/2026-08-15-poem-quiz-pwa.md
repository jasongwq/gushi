# 古诗抽查 PWA 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个面向小学生的古诗背诵抽查 PWA，支持四种选择题抽查方式、错题本、艾宾浩斯遗忘曲线复习、不熟练标注，离线可用。

**Architecture:** Vue 3 + TypeScript + Pinia + Vite PWA。单页应用，localStorage 存储学习数据，支持导出/导入。语音背诵为 v2 功能。核心业务逻辑（遗忘曲线、抽题算法、干扰项生成）为纯函数，与 UI 解耦，便于测试。

**Tech Stack:** Vue 3, TypeScript, Pinia, Vite, vite-plugin-pwa, Vitest, Vue Test Utils, Playwright, Tailwind CSS

---

## 文件结构

```
src/
├── main.ts                          # 应用入口
├── App.vue                          # 根组件 + 路由
├── types/
│   └── index.ts                     # 所有 TypeScript 类型定义
├── utils/
│   ├── ebbinghaus.ts                # 遗忘曲线算法
│   ├── quiz.ts                      # 抽题算法（智能混合 + 各来源筛选）
│   ├── distractor.ts                # 干扰项生成
│   ├── storage.ts                   # localStorage 读写 + 导出/导入
│   └── unproficient.ts              # 不熟练标注逻辑
├── stores/
│   ├── poem.ts                      # 古诗数据 store
│   ├── learning.ts                  # 学习记录 store
│   └── quiz.ts                      # 答题会话 store
├── views/
│   ├── HomePage.vue                 # 首页
│   ├── QuizSetupPage.vue            # 抽查设置页
│   ├── QuizPlayPage.vue             # 答题页
│   ├── QuizResultPage.vue           # 结果页
│   ├── WrongBookPage.vue            # 错题本
│   ├── ProgressPage.vue             # 学习进度
│   └── SettingsPage.vue             # 设置
├── components/
│   ├── FillBlankQuiz.vue            # 补字选择题组件
│   ├── NextLineQuiz.vue             # 上下句接龙选择题组件
│   ├── SelectTitleQuiz.vue          # 选标题/作者/朝代组件
│   ├── QuizProgress.vue             # 答题进度条
│   ├── ReviewBanner.vue             # 今日待复习提示条
│   └── MasteryBadge.vue             # 掌握度标签
├── router/
│   └── index.ts                     # Vue Router 配置
public/
├── poems.json                       # 古诗数据
├── favicon.ico
└── icons/                           # PWA 图标
tests/
├── unit/
│   ├── ebbinghaus.test.ts
│   ├── quiz.test.ts
│   ├── distractor.test.ts
│   ├── storage.test.ts
│   └── unproficient.test.ts
├── component/
│   ├── FillBlankQuiz.test.ts
│   ├── NextLineQuiz.test.ts
│   ├── SelectTitleQuiz.test.ts
│   ├── WrongBookPage.test.ts
│   └── SettingsPage.test.ts
└── e2e/
    └── quiz-flow.spec.ts
```

---

### Task 1: 项目初始化与基础配置

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.ts`, `src/App.vue`
- Create: `tailwind.config.js`, `postcss.config.js`

- [ ] **Step 1: 初始化 Vite + Vue 3 + TypeScript 项目**

```bash
cd /root/古诗抽查
npm create vite@latest . -- --template vue-ts
```

- [ ] **Step 2: 安装依赖**

```bash
npm install
npm install pinia vue-router@4
npm install -D vitest @vue/test-utils happy-dom @pinia/testing
npm install -D vite-plugin-pwa
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 3: 配置 vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'poems.json'],
      manifest: {
        name: '古诗抽查',
        short_name: '古诗抽查',
        description: '小学生古诗背诵抽查工具',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'happy-dom',
  },
})
```

- [ ] **Step 4: 配置 tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

- [ ] **Step 5: 创建 src/style.css 引入 Tailwind**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #4f46e5;
  --color-success: #10b981;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;
  --color-bg: #f9fafb;
  --color-card: #ffffff;
  --color-text: #111827;
  --color-text-secondary: #6b7280;
}
```

- [ ] **Step 6: 在 main.ts 中引入样式和插件**

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

- [ ] **Step 7: 在 package.json 中添加测试脚本**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 8: 验证项目启动**

```bash
npm run dev -- --host 0.0.0.0 &
sleep 3
curl -s http://localhost:5173 | head -5
kill %1
```

Expected: HTML 输出包含 `<div id="app">`

- [ ] **Step 9: 验证测试框架**

```bash
echo 'import { describe, it, expect } from "vitest"; describe("smoke", () => { it("works", () => { expect(1 + 1).toBe(2) }) })' > tests/unit/smoke.test.ts
npm run test
```

Expected: 1 test passed

- [ ] **Step 10: Commit**

```bash
git init
git add -A
git commit -m "feat: init Vite + Vue 3 + TypeScript + PWA project"
```

---

### Task 2: 类型定义

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: 写类型定义测试**

```typescript
// tests/unit/types.test.ts
import { describe, it, expect } from 'vitest'
import type { Poem, LearningRecord, QuizResult, WrongEntry, UserData, UserSettings, QuizType, MasteryLevel, SourceType } from '@/types'

describe('type exports', () => {
  it('should export Poem type', () => {
    const poem: Poem = {
      id: 'b1-01',
      title: '春晓',
      author: '孟浩然',
      dynasty: '唐',
      grade: '一年级下',
      unit: '第一单元',
      text: ['春眠不觉晓', '处处闻啼鸟', '夜来风雨声', '花落知多少'],
      textType: '五言',
    }
    expect(poem.id).toBe('b1-01')
  })

  it('should export LearningRecord type', () => {
    const record: LearningRecord = {
      poemId: 'b1-01',
      lastReviewDate: '2026-08-15',
      reviewCount: 0,
      nextReviewDate: '2026-08-15',
      correctness: [],
      masteryLevel: '新',
      unproficient: false,
      unproficientCorrectStreak: 0,
    }
    expect(record.masteryLevel).toBe('新')
  })

  it('should export UserData type', () => {
    const data: UserData = {
      records: [],
      quizResults: [],
      wrongBook: [],
      settings: { enabledGrades: ['一年级上'], quizCount: 5 },
    }
    expect(data.records).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm run test -- tests/unit/types.test.ts
```

Expected: FAIL — cannot find module `@/types`

- [ ] **Step 3: 写类型定义**

```typescript
// src/types/index.ts
export type QuizType = 'fillBlank' | 'nextLine' | 'selectTitle' | 'recite'
export type MasteryLevel = '新' | '学' | '熟' | '固'
export type TextType = '五言' | '七言' | '其他'
export type SourceType = 'smart' | 'grade' | 'unit' | 'all' | 'review' | 'wrong' | 'unproficient'

export interface Poem {
  id: string
  title: string
  author: string
  dynasty: string
  grade: string
  unit: string
  text: string[]
  textType: TextType
}

export interface LearningRecord {
  poemId: string
  lastReviewDate: string
  reviewCount: number
  nextReviewDate: string
  correctness: number[]
  masteryLevel: MasteryLevel
  unproficient: boolean
  unproficientCorrectStreak: number
  lastLearnDate?: string
}

export interface QuizResult {
  poemId: string
  quizType: QuizType
  date: string
  correct: boolean
  wrongAnswer?: string
}

export interface WrongEntry {
  poemId: string
  quizType: QuizType
  wrongCount: number
  lastWrongDate: string
  unproficient: boolean
}

export interface UserSettings {
  enabledGrades: string[]
  quizCount: number
}

export interface UserData {
  records: LearningRecord[]
  quizResults: QuizResult[]
  wrongBook: WrongEntry[]
  settings: UserSettings
}

export interface QuizQuestion {
  poemId: string
  quizType: QuizType
  prompt: string
  options: string[]
  correctIndex: number
  blankPositions?: number[]  // fillBlank: 哪些位置被挖空
}

export interface QuizSession {
  source: SourceType
  quizTypes: QuizType[]
  questions: QuizQuestion[]
  currentIndex: number
  answers: { questionIndex: number; selectedIndex: number; correct: boolean }[]
  startTime: string
}
```

- [ ] **Step 4: 配置路径别名 (vite.config.ts 加 resolve + tsconfig.json 加 paths)**

在 `vite.config.ts` 添加:
```typescript
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // ... existing config
})
```

在 `tsconfig.json` 添加:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 5: 运行测试验证通过**

```bash
npm run test -- tests/unit/types.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add TypeScript type definitions"
```

---

### Task 3: 古诗数据

**Files:**
- Create: `public/poems.json`

- [ ] **Step 1: 编写古诗数据（至少包含一年级上下册全部古诗）**

```json
[
  {
    "id": "b1-01",
    "title": "咏鹅",
    "author": "骆宾王",
    "dynasty": "唐",
    "grade": "一年级上",
    "unit": "课文",
    "text": ["鹅，鹅，鹅，", "曲项向天歌。", "白毛浮绿水，", "红掌拨清波。"],
    "textType": "其他"
  },
  {
    "id": "b1-02",
    "title": "江南",
    "author": "汉乐府",
    "dynasty": "汉",
    "grade": "一年级上",
    "unit": "课文",
    "text": ["江南可采莲，", "莲叶何田田。", "鱼戏莲叶间，", "鱼戏莲叶东，", "鱼戏莲叶西，", "鱼戏莲叶南，", "鱼戏莲叶北。"],
    "textType": "其他"
  },
  {
    "id": "b1-03",
    "title": "画",
    "author": "王维",
    "dynasty": "唐",
    "grade": "一年级上",
    "unit": "课文",
    "text": ["远看山有色，", "近听水无声。", "春去花还在，", "人来鸟不惊。"],
    "textType": "五言"
  },
  {
    "id": "b1-04",
    "title": "悯农（其二）",
    "author": "李绅",
    "dynasty": "唐",
    "grade": "一年级上",
    "unit": "课文",
    "text": ["锄禾日当午，", "汗滴禾下土。", "谁知盘中餐，", "粒粒皆辛苦。"],
    "textType": "五言"
  },
  {
    "id": "b1-05",
    "title": "古朗月行（节选）",
    "author": "李白",
    "dynasty": "唐",
    "grade": "一年级上",
    "unit": "课文",
    "text": ["小时不识月，", "呼作白玉盘。", "又疑瑶台镜，", "飞在青云端。"],
    "textType": "五言"
  },
  {
    "id": "b1-06",
    "title": "风",
    "author": "李峤",
    "dynasty": "唐",
    "grade": "一年级上",
    "unit": "课文",
    "text": ["解落三秋叶，", "能开二月花。", "过江千尺浪，", "入竹万竿斜。"],
    "textType": "五言"
  },
  {
    "id": "b2-01",
    "title": "春晓",
    "author": "孟浩然",
    "dynasty": "唐",
    "grade": "一年级下",
    "unit": "课文",
    "text": ["春眠不觉晓，", "处处闻啼鸟。", "夜来风雨声，", "花落知多少。"],
    "textType": "五言"
  },
  {
    "id": "b2-02",
    "title": "赠汪伦",
    "author": "李白",
    "dynasty": "唐",
    "grade": "一年级下",
    "unit": "课文",
    "text": ["李白乘舟将欲行，", "忽闻岸上踏歌声。", "桃花潭水深千尺，", "不及汪伦送我情。"],
    "textType": "七言"
  },
  {
    "id": "b2-03",
    "title": "静夜思",
    "author": "李白",
    "dynasty": "唐",
    "grade": "一年级下",
    "unit": "课文",
    "text": ["床前明月光，", "疑是地上霜。", "举头望明月，", "低头思故乡。"],
    "textType": "五言"
  },
  {
    "id": "b2-04",
    "title": "寻隐者不遇",
    "author": "贾岛",
    "dynasty": "唐",
    "grade": "一年级下",
    "unit": "课文",
    "text": ["松下问童子，", "言师采药去。", "只在此山中，", "云深不知处。"],
    "textType": "五言"
  },
  {
    "id": "b2-05",
    "title": "池上",
    "author": "白居易",
    "dynasty": "唐",
    "grade": "一年级下",
    "unit": "课文",
    "text": ["小娃撑小艇，", "偷采白莲回。", "不解藏踪迹，", "浮萍一道开。"],
    "textType": "五言"
  },
  {
    "id": "b2-06",
    "title": "小池",
    "author": "杨万里",
    "dynasty": "宋",
    "grade": "一年级下",
    "unit": "课文",
    "text": ["泉眼无声惜细流，", "树阴照水爱晴柔。", "小荷才露尖尖角，", "早有蜻蜓立上头。"],
    "textType": "七言"
  }
]
```

> 注：实际实现时需包含小学 1-6 年级全部部编版古诗（约 75+80 首），此处仅展示示例格式。完整数据需按部编版教材逐册录入。

- [ ] **Step 2: 验证 JSON 格式正确**

```bash
node -e "const d = require('./public/poems.json'); console.log('Total poems:', d.length); console.log('Grades:', [...new Set(d.map(p => p.grade))].sort())"
```

Expected: 输出古诗数量和年级列表

- [ ] **Step 3: Commit**

```bash
git add public/poems.json
git commit -m "feat: add poem data (partial, grades 1-2)"
```

---

### Task 4: 遗忘曲线算法

**Files:**
- Create: `src/utils/ebbinghaus.ts`
- Create: `tests/unit/ebbinghaus.test.ts`

- [ ] **Step 1: 写遗忘曲线测试**

```typescript
// tests/unit/ebbinghaus.test.ts
import { describe, it, expect } from 'vitest'
import {
  getNextInterval,
  getMasteryLevel,
  calculateNextReview,
  handleWrongAnswer,
} from '@/utils/ebbinghaus'

describe('getNextInterval', () => {
  it('returns 1 for review count 0→1', () => {
    expect(getNextInterval(0)).toBe(1)
  })
  it('returns 2 for review count 1→2', () => {
    expect(getNextInterval(1)).toBe(2)
  })
  it('returns 4 for review count 2→3', () => {
    expect(getNextInterval(2)).toBe(4)
  })
  it('returns 7 for review count 3→4', () => {
    expect(getNextInterval(3)).toBe(7)
  })
  it('returns 15 for review count 4→5', () => {
    expect(getNextInterval(4)).toBe(15)
  })
  it('returns 30 for review count 5→6', () => {
    expect(getNextInterval(5)).toBe(30)
  })
  it('returns 30 for review count 10→11', () => {
    expect(getNextInterval(10)).toBe(30)
  })
})

describe('getMasteryLevel', () => {
  it('returns 新 for count 0', () => expect(getMasteryLevel(0)).toBe('新'))
  it('returns 学 for count 1-2', () => {
    expect(getMasteryLevel(1)).toBe('学')
    expect(getMasteryLevel(2)).toBe('学')
  })
  it('returns 熟 for count 3-4', () => {
    expect(getMasteryLevel(3)).toBe('熟')
    expect(getMasteryLevel(4)).toBe('熟')
  })
  it('returns 固 for count 5+', () => {
    expect(getMasteryLevel(5)).toBe('固')
    expect(getMasteryLevel(10)).toBe('固')
  })
})

describe('calculateNextReview (correct answer)', () => {
  it('advances review count and sets next date', () => {
    const record = {
      poemId: 'b1-01',
      lastReviewDate: '2026-08-15',
      reviewCount: 0,
      nextReviewDate: '2026-08-15',
      correctness: [],
      masteryLevel: '新' as const,
      unproficient: false,
      unproficientCorrectStreak: 0,
    }
    const result = calculateNextReview(record, true)
    expect(result.reviewCount).toBe(1)
    expect(result.nextReviewDate).toBe('2026-08-16') // +1 day
    expect(result.masteryLevel).toBe('学')
    expect(result.correctness).toEqual([1])
  })
})

describe('handleWrongAnswer', () => {
  it('backs off interval by one level (4→2 days)', () => {
    const record = {
      poemId: 'b1-01',
      lastReviewDate: '2026-08-15',
      reviewCount: 3,
      nextReviewDate: '2026-08-19',
      correctness: [1, 1, 1],
      masteryLevel: '熟' as const,
      unproficient: false,
      unproficientCorrectStreak: 0,
    }
    const result = handleWrongAnswer(record)
    // reviewCount 3 → interval was 4, back off to 2
    expect(result.nextReviewDate).toBe('2026-08-17') // +2 days
    expect(result.correctness).toEqual([1, 1, 1, 0])
    expect(result.masteryLevel).toBe('学') // demoted from 熟
  })

  it('does not go below 1 day interval', () => {
    const record = {
      poemId: 'b1-01',
      lastReviewDate: '2026-08-15',
      reviewCount: 1,
      nextReviewDate: '2026-08-17',
      correctness: [1],
      masteryLevel: '学' as const,
      unproficient: false,
      unproficientCorrectStreak: 0,
    }
    const result = handleWrongAnswer(record)
    expect(result.nextReviewDate).toBe('2026-08-16') // +1 day minimum
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm run test -- tests/unit/ebbinghaus.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现遗忘曲线算法**

```typescript
// src/utils/ebbinghaus.ts
import type { LearningRecord, MasteryLevel } from '@/types'

const INTERVALS = [1, 2, 4, 7, 15, 30]

export function getNextInterval(reviewCount: number): number {
  if (reviewCount < INTERVALS.length) {
    return INTERVALS[reviewCount]
  }
  return INTERVALS[INTERVALS.length - 1]
}

export function getMasteryLevel(reviewCount: number): MasteryLevel {
  if (reviewCount === 0) return '新'
  if (reviewCount <= 2) return '学'
  if (reviewCount <= 4) return '熟'
  return '固'
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

export function calculateNextReview(record: LearningRecord, correct: boolean): LearningRecord {
  const today = new Date().toISOString().split('T')[0]
  if (correct) {
    const newCount = record.reviewCount + 1
    const interval = getNextInterval(record.reviewCount)
    return {
      ...record,
      lastReviewDate: today,
      reviewCount: newCount,
      nextReviewDate: addDays(today, interval),
      correctness: [...record.correctness, 1],
      masteryLevel: getMasteryLevel(newCount),
      unproficientCorrectStreak: record.unproficient ? record.unproficientCorrectStreak + 1 : 0,
    }
  }
  return handleWrongAnswer(record)
}

export function handleWrongAnswer(record: LearningRecord): LearningRecord {
  const today = new Date().toISOString().split('T')[0]
  // Back off one level: use interval for (reviewCount - 1), minimum 1 day
  const backLevel = Math.max(0, record.reviewCount - 1)
  const interval = backLevel > 0 ? getNextInterval(backLevel - 1) : 1
  const newCount = Math.max(1, record.reviewCount)
  return {
    ...record,
    lastReviewDate: today,
    reviewCount: newCount,
    nextReviewDate: addDays(today, interval),
    correctness: [...record.correctness, 0],
    masteryLevel: getMasteryLevel(newCount),
    unproficientCorrectStreak: 0,
  }
}

export function isDueForReview(record: LearningRecord): boolean {
  const today = new Date().toISOString().split('T')[0]
  return record.nextReviewDate <= today
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm run test -- tests/unit/ebbinghaus.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add ebbinghaus forgetting curve algorithm with tests"
```

---

### Task 5: 智能混合抽题算法

**Files:**
- Create: `src/utils/quiz.ts`
- Create: `tests/unit/quiz.test.ts`

- [ ] **Step 1: 写抽题算法测试**

```typescript
// tests/unit/quiz.test.ts
import { describe, it, expect } from 'vitest'
import { smartMix, getPoemsBySource, shuffleArray } from '@/utils/quiz'
import type { Poem, LearningRecord, WrongEntry } from '@/types'

const poems: Poem[] = [
  { id: 'p1', title: '春晓', author: '孟浩然', dynasty: '唐', grade: '一年级下', unit: '课文', text: ['春眠不觉晓', '处处闻啼鸟', '夜来风雨声', '花落知多少'], textType: '五言' },
  { id: 'p2', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级下', unit: '课文', text: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'], textType: '五言' },
  { id: 'p3', title: '咏鹅', author: '骆宾王', dynasty: '唐', grade: '一年级上', unit: '课文', text: ['鹅，鹅，鹅，', '曲项向天歌。', '白毛浮绿水，', '红掌拨清波。'], textType: '其他' },
  { id: 'p4', title: '画', author: '王维', dynasty: '唐', grade: '一年级上', unit: '课文', text: ['远看山有色', '近听水无声', '春去花还在', '人来鸟不惊'], textType: '五言' },
  { id: 'p5', title: '悯农', author: '李绅', dynasty: '唐', grade: '一年级上', unit: '课文', text: ['锄禾日当午', '汗滴禾下土', '谁知盘中餐', '粒粒皆辛苦'], textType: '五言' },
  { id: 'p6', title: '风', author: '李峤', dynasty: '唐', grade: '一年级上', unit: '课文', text: ['解落三秋叶', '能开二月花', '过江千尺浪', '入竹万竿斜'], textType: '五言' },
  { id: 'p7', title: '江南', author: '汉乐府', dynasty: '汉', grade: '一年级上', unit: '课文', text: ['江南可采莲', '莲叶何田田', '鱼戏莲叶间'], textType: '其他' },
  { id: 'p8', title: '赠汪伦', author: '李白', dynasty: '唐', grade: '一年级下', unit: '课文', text: ['李白乘舟将欲行', '忽闻岸上踏歌声', '桃花潭水深千尺', '不及汪伦送我情'], textType: '七言' },
  { id: 'p9', title: '寻隐者不遇', author: '贾岛', dynasty: '唐', grade: '一年级下', unit: '课文', text: ['松下问童子', '言师采药去', '只在此山中', '云深不知处'], textType: '五言' },
  { id: 'p10', title: '池上', author: '白居易', dynasty: '唐', grade: '一年级下', unit: '课文', text: ['小娃撑小艇', '偷采白莲回', '不解藏踪迹', '浮萍一道开'], textType: '五言' },
]

const today = new Date().toISOString().split('T')[0]

describe('smartMix', () => {
  it('returns correct number of poems', () => {
    const records: LearningRecord[] = poems.map((p, i) => ({
      poemId: p.id,
      lastReviewDate: today,
      reviewCount: i < 3 ? 0 : 2,
      nextReviewDate: i < 3 ? today : '2099-01-01',
      correctness: [],
      masteryLevel: '新' as const,
      unproficient: i < 2,
      unproficientCorrectStreak: 0,
    }))
    const wrongBook: WrongEntry[] = [{ poemId: 'p4', quizType: 'fillBlank', wrongCount: 1, lastWrongDate: today, unproficient: false }]

    const result = smartMix(poems, records, wrongBook, 5, today)
    expect(result.length).toBe(5)
    expect(new Set(result.map(p => p.id)).size).toBe(5) // no duplicates
  })

  it('falls back when sources are insufficient', () => {
    const records: LearningRecord[] = []
    const wrongBook: WrongEntry[] = []
    const result = smartMix(poems, records, wrongBook, 5, today)
    expect(result.length).toBe(5)
  })

  it('returns empty when no poems available', () => {
    const result = smartMix([], [], [], 5, today)
    expect(result).toEqual([])
  })
})

describe('getPoemsBySource', () => {
  it('filters by grade', () => {
    const result = getPoemsBySource(poems, 'grade', today, { grades: ['一年级上'] })
    expect(result.every(p => p.grade === '一年级上')).toBe(true)
  })

  it('returns all poems for "all" source', () => {
    const result = getPoemsBySource(poems, 'all', today)
    expect(result.length).toBe(poems.length)
  })
})

describe('shuffleArray', () => {
  it('returns same elements in possibly different order', () => {
    const arr = [1, 2, 3, 4, 5]
    const result = shuffleArray(arr)
    expect(result.sort()).toEqual(arr)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm run test -- tests/unit/quiz.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现抽题算法**

```typescript
// src/utils/quiz.ts
import type { Poem, LearningRecord, WrongEntry, SourceType } from '@/types'
import { isDueForReview } from './ebbinghaus'

export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

interface SourceOptions {
  grades?: string[]
  unit?: string
}

export function getPoemsBySource(
  poems: Poem[],
  source: SourceType,
  today: string,
  options?: SourceOptions
): Poem[] {
  const records: LearningRecord[] = [] // will be passed from store in real usage
  switch (source) {
    case 'all':
      return poems
    case 'grade':
      return poems.filter(p => options?.grades?.includes(p.grade))
    case 'unit':
      return poems.filter(p => p.unit === options?.unit)
    default:
      return poems
  }
}

export function getReviewPoems(
  poems: Poem[],
  records: LearningRecord[],
  today: string
): Poem[] {
  const dueIds = new Set(
    records.filter(r => isDueForReview(r)).map(r => r.poemId)
  )
  return poems.filter(p => dueIds.has(p.id))
}

export function getUnproficientPoems(
  poems: Poem[],
  records: LearningRecord[]
): Poem[] {
  const ids = new Set(
    records.filter(r => r.unproficient).map(r => r.poemId)
  )
  return poems.filter(p => ids.has(p.id))
}

export function getWrongPoems(
  poems: Poem[],
  wrongBook: WrongEntry[]
): Poem[] {
  const ids = new Set(wrongBook.map(w => w.poemId))
  return poems.filter(p => ids.has(p.id))
}

export function getRecentlyLearnedPoems(
  poems: Poem[],
  records: LearningRecord[],
  today: string
): Poem[] {
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const agoStr = sevenDaysAgo.toISOString().split('T')[0]
  const ids = new Set(
    records
      .filter(r => r.lastLearnDate && r.lastLearnDate >= agoStr && r.lastLearnDate <= today)
      .map(r => r.poemId)
  )
  return poems.filter(p => ids.has(p.id))
}

export function smartMix(
  poems: Poem[],
  records: LearningRecord[],
  wrongBook: WrongEntry[],
  count: number,
  today: string
): Poem[] {
  if (poems.length === 0) return []

  const sources = [
    { get: () => getReviewPoems(poems, records, today), ratio: 0.30 },
    { get: () => getUnproficientPoems(poems, records), ratio: 0.25 },
    { get: () => getWrongPoems(poems, wrongBook), ratio: 0.20 },
    { get: () => getRecentlyLearnedPoems(poems, records, today), ratio: 0.15 },
    { get: () => poems, ratio: 0.10 },
  ]

  const selected: Poem[] = []
  const selectedIds = new Set<string>()

  for (const source of sources) {
    const available = shuffleArray(source.get()).filter(p => !selectedIds.has(p.id))
    const targetCount = Math.round(count * source.ratio)
    const remaining = count - selected.length
    const toTake = Math.min(targetCount, available.length, remaining)

    for (const poem of available.slice(0, toTake)) {
      selected.push(poem)
      selectedIds.add(poem.id)
    }
  }

  // Fill remaining with random from all poems
  if (selected.length < count) {
    const remaining = shuffleArray(poems.filter(p => !selectedIds.has(p.id)))
    for (const poem of remaining) {
      if (selected.length >= count) break
      selected.push(poem)
      selectedIds.add(poem.id)
    }
  }

  return shuffleArray(selected)
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm run test -- tests/unit/quiz.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add smart quiz mixing algorithm with tests"
```

---

### Task 6: 干扰项生成

**Files:**
- Create: `src/utils/distractor.ts`
- Create: `tests/unit/distractor.test.ts`

- [ ] **Step 1: 写干扰项生成测试**

```typescript
// tests/unit/distractor.test.ts
import { describe, it, expect } from 'vitest'
import {
  generateFillBlankOptions,
  generateNextLineOptions,
  generateSelectOptions,
} from '@/utils/distractor'
import type { Poem } from '@/types'

const poems: Poem[] = [
  { id: 'p1', title: '春晓', author: '孟浩然', dynasty: '唐', grade: '一年级下', unit: '课文', text: ['春眠不觉晓', '处处闻啼鸟', '夜来风雨声', '花落知多少'], textType: '五言' },
  { id: 'p2', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级下', unit: '课文', text: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'], textType: '五言' },
  { id: 'p3', title: '咏鹅', author: '骆宾王', dynasty: '唐', grade: '一年级上', unit: '课文', text: ['鹅，鹅，鹅，', '曲项向天歌。', '白毛浮绿水，', '红掌拨清波。'], textType: '其他' },
  { id: 'p4', title: '画', author: '王维', dynasty: '唐', grade: '一年级上', unit: '课文', text: ['远看山有色', '近听水无声', '春去花还在', '人来鸟不惊'], textType: '五言' },
  { id: 'p5', title: '悯农', author: '李绅', dynasty: '唐', grade: '一年级上', unit: '课文', text: ['锄禾日当午', '汗滴禾下土', '谁知盘中餐', '粒粒皆辛苦'], textType: '五言' },
  { id: 'p6', title: '风', author: '李峤', dynasty: '唐', grade: '一年级上', unit: '课文', text: ['解落三秋叶', '能开二月花', '过江千尺浪', '入竹万竿斜'], textType: '五言' },
  { id: 'p7', title: '江南', author: '汉乐府', dynasty: '汉', grade: '一年级上', unit: '课文', text: ['江南可采莲', '莲叶何田田', '鱼戏莲叶间'], textType: '其他' },
]

describe('generateFillBlankOptions', () => {
  it('generates 6 options with correct answer included', () => {
    const poem = poems[0] // 春晓
    const result = generateFillBlankOptions(poem, poems, '晓', 0)
    expect(result.length).toBe(6)
    expect(result).toContain('晓')
  })

  it('all options are unique', () => {
    const poem = poems[0]
    const result = generateFillBlankOptions(poem, poems, '晓', 0)
    expect(new Set(result).size).toBe(result.length)
  })
})

describe('generateNextLineOptions', () => {
  it('generates 6 options with correct line included', () => {
    const poem = poems[0] // 春晓
    const correctLine = '处处闻啼鸟'
    const result = generateNextLineOptions(poem, poems, correctLine, '一年级下')
    expect(result.length).toBe(6)
    expect(result).toContain(correctLine)
  })

  it('all options are unique', () => {
    const poem = poems[0]
    const correctLine = '处处闻啼鸟'
    const result = generateNextLineOptions(poem, poems, correctLine, '一年级下')
    expect(new Set(result).size).toBe(result.length)
  })
})

describe('generateSelectOptions', () => {
  it('generates 6 title options with correct title included', () => {
    const poem = poems[0]
    const result = generateSelectOptions(poems, poem.grade, 'title', poem.title)
    expect(result.length).toBe(6)
    expect(result).toContain('春晓')
  })

  it('generates 6 author options with correct author included', () => {
    const poem = poems[0]
    const result = generateSelectOptions(poems, poem.grade, 'author', poem.author)
    expect(result.length).toBe(6)
    expect(result).toContain('孟浩然')
  })

  it('generates 6 dynasty options with correct dynasty included', () => {
    const poem = poems[0]
    const result = generateSelectOptions(poems, poem.grade, 'dynasty', poem.dynasty)
    expect(result.length).toBe(6)
    expect(result).toContain('唐')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm run test -- tests/unit/distractor.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现干扰项生成**

```typescript
// src/utils/distractor.ts
import type { Poem } from '@/types'
import { shuffleArray } from './quiz'

export function generateFillBlankOptions(
  poem: Poem,
  allPoems: Poem[],
  correctChar: string,
  _position: number
): string[] {
  const allChars = new Set<string>()
  // Collect characters from same poem
  poem.text.forEach(line => {
    for (const ch of line) {
      if (ch.match(/[\u4e00-\u9fff]/)) allChars.add(ch)
    }
  })
  // Collect characters from same grade poems
  const sameGrade = allPoems.filter(p => p.grade === poem.grade)
  sameGrade.forEach(p => {
    p.text.forEach(line => {
      for (const ch of line) {
        if (ch.match(/[\u4e00-\u9fff]/)) allChars.add(ch)
      }
    })
  })

  allChars.delete(correctChar)
  const distractors = shuffleArray([...allChars]).slice(0, 5)
  return shuffleArray([correctChar, ...distractors])
}

export function generateNextLineOptions(
  poem: Poem,
  allPoems: Poem[],
  correctLine: string,
  grade: string
): string[] {
  const candidates = new Set<string>()
  // Lines from same grade poems
  const sameGrade = allPoems.filter(p => p.grade === grade)
  sameGrade.forEach(p => {
    p.text.forEach(line => {
      if (line !== correctLine) candidates.add(line)
    })
  })

  const distractors = shuffleArray([...candidates]).slice(0, 5)
  return shuffleArray([correctLine, ...distractors])
}

export function generateSelectOptions(
  allPoems: Poem[],
  grade: string,
  field: 'title' | 'author' | 'dynasty',
  correctValue: string
): string[] {
  const values = new Set<string>()
  const sameGrade = allPoems.filter(p => p.grade === grade)
  sameGrade.forEach(p => {
    values.add(p[field])
  })
  // If not enough, add from all poems
  if (values.size < 6) {
    allPoems.forEach(p => values.add(p[field]))
  }

  values.delete(correctValue)
  const distractors = shuffleArray([...values]).slice(0, 5)
  return shuffleArray([correctValue, ...distractors])
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm run test -- tests/unit/distractor.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add distractor generation for quiz options with tests"
```

---

### Task 7: 不熟练标注逻辑

**Files:**
- Create: `src/utils/unproficient.ts`
- Create: `tests/unit/unproficient.test.ts`

- [ ] **Step 1: 写不熟练标注测试**

```typescript
// tests/unit/unproficient.test.ts
import { describe, it, expect } from 'vitest'
import { markUnproficient, unmarkUnproficient, checkAutoUnmark } from '@/utils/unproficient'
import type { LearningRecord } from '@/types'

const baseRecord: LearningRecord = {
  poemId: 'p1',
  lastReviewDate: '2026-08-15',
  reviewCount: 1,
  nextReviewDate: '2026-08-16',
  correctness: [1],
  masteryLevel: '学',
  unproficient: false,
  unproficientCorrectStreak: 0,
}

describe('markUnproficient', () => {
  it('marks a record as unproficient', () => {
    const result = markUnproficient(baseRecord)
    expect(result.unproficient).toBe(true)
    expect(result.unproficientCorrectStreak).toBe(0)
  })
})

describe('unmarkUnproficient', () => {
  it('unmarks a record as unproficient', () => {
    const record = { ...baseRecord, unproficient: true, unproficientCorrectStreak: 2 }
    const result = unmarkUnproficient(record)
    expect(result.unproficient).toBe(false)
    expect(result.unproficientCorrectStreak).toBe(0)
  })
})

describe('checkAutoUnmark', () => {
  it('auto-unmarks after 3 consecutive correct answers', () => {
    const record = { ...baseRecord, unproficient: true, unproficientCorrectStreak: 2 }
    const result = checkAutoUnmark(record, true)
    expect(result.unproficient).toBe(false)
    expect(result.unproficientCorrectStreak).toBe(0)
  })

  it('does not auto-unmark before 3 consecutive correct', () => {
    const record = { ...baseRecord, unproficient: true, unproficientCorrectStreak: 1 }
    const result = checkAutoUnmark(record, true)
    expect(result.unproficient).toBe(true)
    expect(result.unproficientCorrectStreak).toBe(2)
  })

  it('resets streak on wrong answer', () => {
    const record = { ...baseRecord, unproficient: true, unproficientCorrectStreak: 2 }
    const result = checkAutoUnmark(record, false)
    expect(result.unproficient).toBe(true)
    expect(result.unproficientCorrectStreak).toBe(0)
  })

  it('does nothing if not unproficient', () => {
    const result = checkAutoUnmark(baseRecord, true)
    expect(result.unproficient).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm run test -- tests/unit/unproficient.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现不熟练标注逻辑**

```typescript
// src/utils/unproficient.ts
import type { LearningRecord } from '@/types'

const AUTO_UNMARK_THRESHOLD = 3

export function markUnproficient(record: LearningRecord): LearningRecord {
  return {
    ...record,
    unproficient: true,
    unproficientCorrectStreak: 0,
  }
}

export function unmarkUnproficient(record: LearningRecord): LearningRecord {
  return {
    ...record,
    unproficient: false,
    unproficientCorrectStreak: 0,
  }
}

export function checkAutoUnmark(record: LearningRecord, correct: boolean): LearningRecord {
  if (!record.unproficient) return record

  if (correct) {
    const newStreak = record.unproficientCorrectStreak + 1
    if (newStreak >= AUTO_UNMARK_THRESHOLD) {
      return unmarkUnproficient(record)
    }
    return {
      ...record,
      unproficientCorrectStreak: newStreak,
    }
  }

  return {
    ...record,
    unproficientCorrectStreak: 0,
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm run test -- tests/unit/unproficient.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add unproficient marking logic with tests"
```

---

### Task 8: 数据存储与导入导出

**Files:**
- Create: `src/utils/storage.ts`
- Create: `tests/unit/storage.test.ts`

- [ ] **Step 1: 写存储测试**

```typescript
// tests/unit/storage.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadData, saveData, exportData, importData, clearData } from '@/utils/storage'
import type { UserData } from '@/types'

const mockData: UserData = {
  records: [],
  quizResults: [],
  wrongBook: [],
  settings: { enabledGrades: ['一年级上'], quizCount: 5 },
}

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and loads data', () => {
    saveData(mockData)
    const loaded = loadData()
    expect(loaded.settings.enabledGrades).toEqual(['一年级上'])
  })

  it('returns default data when localStorage is empty', () => {
    const loaded = loadData()
    expect(loaded.records).toEqual([])
    expect(loaded.settings.quizCount).toBe(5)
  })

  it('exports data as JSON string', () => {
    saveData(mockData)
    const exported = exportData()
    const parsed = JSON.parse(exported)
    expect(parsed.settings.enabledGrades).toEqual(['一年级上'])
  })

  it('imports valid JSON data', () => {
    const json = JSON.stringify(mockData)
    const result = importData(json)
    expect(result).toBe(true)
    const loaded = loadData()
    expect(loaded.settings.enabledGrades).toEqual(['一年级上'])
  })

  it('rejects invalid JSON', () => {
    const result = importData('not json')
    expect(result).toBe(false)
  })

  it('clears data', () => {
    saveData(mockData)
    clearData()
    const loaded = loadData()
    expect(loaded.records).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm run test -- tests/unit/storage.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现存储逻辑**

```typescript
// src/utils/storage.ts
import type { UserData } from '@/types'

const STORAGE_KEY = 'poem-quiz-data'

function getDefaultData(): UserData {
  return {
    records: [],
    quizResults: [],
    wrongBook: [],
    settings: {
      enabledGrades: [],
      quizCount: 5,
    },
  }
}

export function loadData(): UserData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultData()
    const data = JSON.parse(raw) as UserData
    return {
      records: data.records ?? [],
      quizResults: data.quizResults ?? [],
      wrongBook: data.wrongBook ?? [],
      settings: {
        ...getDefaultData().settings,
        ...data.settings,
      },
    }
  } catch {
    return getDefaultData()
  }
}

export function saveData(data: UserData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function exportData(): string {
  const data = loadData()
  return JSON.stringify(data, null, 2)
}

export function importData(json: string): boolean {
  try {
    const data = JSON.parse(json) as UserData
    if (!data.settings || !Array.isArray(data.records)) return false
    saveData(data)
    return true
  } catch {
    return false
  }
}

export function clearData(): void {
  localStorage.removeItem(STORAGE_KEY)
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm run test -- tests/unit/storage.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add localStorage storage with import/export and tests"
```

---

### Task 9: Pinia Stores

**Files:**
- Create: `src/stores/poem.ts`
- Create: `src/stores/learning.ts`
- Create: `src/stores/quiz.ts`

- [ ] **Step 1: 实现古诗数据 store**

```typescript
// src/stores/poem.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Poem } from '@/types'

export const usePoemStore = defineStore('poem', () => {
  const poems = ref<Poem[]>([])
  const loading = ref(false)

  const grades = computed(() => {
    return [...new Set(poems.value.map(p => p.grade))].sort()
  })

  const poemsByGrade = computed(() => {
    const map = new Map<string, Poem[]>()
    for (const poem of poems.value) {
      const list = map.get(poem.grade) ?? []
      list.push(poem)
      map.set(poem.grade, list)
    }
    return map
  })

  async function fetchPoems() {
    if (poems.value.length > 0) return
    loading.value = true
    try {
      const resp = await fetch('/poems.json')
      poems.value = await resp.json()
    } finally {
      loading.value = false
    }
  }

  function getPoemById(id: string): Poem | undefined {
    return poems.value.find(p => p.id === id)
  }

  return { poems, loading, grades, poemsByGrade, fetchPoems, getPoemById }
})
```

- [ ] **Step 2: 实现学习记录 store**

```typescript
// src/stores/learning.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LearningRecord, QuizResult, WrongEntry, UserData } from '@/types'
import { loadData, saveData } from '@/utils/storage'
import { calculateNextReview, handleWrongAnswer } from '@/utils/ebbinghaus'
import { checkAutoUnmark } from '@/utils/unproficient'

export const useLearningStore = defineStore('learning', () => {
  const data = ref<UserData>(loadData())

  const records = computed(() => data.value.records)
  const wrongBook = computed(() => data.value.wrongBook)
  const settings = computed(() => data.value.settings)

  function persist() {
    saveData(data.value)
  }

  function getRecord(poemId: string): LearningRecord | undefined {
    return data.value.records.find(r => r.poemId === poemId)
  }

  function getOrCreateRecord(poemId: string): LearningRecord {
    let record = getRecord(poemId)
    if (!record) {
      const today = new Date().toISOString().split('T')[0]
      record = {
        poemId,
        lastReviewDate: today,
        reviewCount: 0,
        nextReviewDate: today,
        correctness: [],
        masteryLevel: '新',
        unproficient: false,
        unproficientCorrectStreak: 0,
      }
      data.value.records.push(record)
    }
    return record
  }

  function recordAnswer(poemId: string, quizType: string, correct: boolean, wrongAnswer?: string) {
    const record = getOrCreateRecord(poemId)

    // Update learning record
    const updated = calculateNextReview(record, correct)
    const afterUnproficient = checkAutoUnmark(updated, correct)
    const idx = data.value.records.findIndex(r => r.poemId === poemId)
    data.value.records[idx] = { ...afterUnproficient, lastLearnDate: new Date().toISOString().split('T')[0] }

    // Add quiz result
    const result: QuizResult = {
      poemId,
      quizType: quizType as QuizResult['quizType'],
      date: new Date().toISOString().split('T')[0],
      correct,
      wrongAnswer,
    }
    data.value.quizResults.push(result)

    // Update wrong book
    if (!correct) {
      const existing = data.value.wrongBook.find(w => w.poemId === poemId && w.quizType === quizType)
      if (existing) {
        existing.wrongCount++
        existing.lastWrongDate = result.date
      } else {
        data.value.wrongBook.push({
          poemId,
          quizType: quizType as WrongEntry['quizType'],
          wrongCount: 1,
          lastWrongDate: result.date,
          unproficient: false,
        })
      }
    } else {
      // Remove from wrong book if answered correctly
      data.value.wrongBook = data.value.wrongBook.filter(
        w => !(w.poemId === poemId && w.quizType === quizType)
      )
    }

    persist()
  }

  function toggleUnproficient(poemId: string, value?: boolean) {
    const record = getOrCreateRecord(poemId)
    record.unproficient = value ?? !record.unproficient
    record.unproficientCorrectStreak = 0
    persist()
  }

  function removeWrongEntry(poemId: string, quizType: string) {
    data.value.wrongBook = data.value.wrongBook.filter(
      w => !(w.poemId === poemId && w.quizType === quizType)
    )
    persist()
  }

  function updateSettings(settings: Partial<UserData['settings']>) {
    data.value.settings = { ...data.value.settings, ...settings }
    persist()
  }

  function importUserData(json: string): boolean {
    try {
      const imported = JSON.parse(json) as UserData
      if (!imported.settings || !Array.isArray(imported.records)) return false
      data.value = imported
      persist()
      return true
    } catch {
      return false
    }
  }

  function exportUserData(): string {
    return JSON.stringify(data.value, null, 2)
  }

  function clearAllData() {
    data.value = {
      records: [],
      quizResults: [],
      wrongBook: [],
      settings: { enabledGrades: [], quizCount: 5 },
    }
    persist()
  }

  const reviewDueCount = computed(() => {
    const today = new Date().toISOString().split('T')[0]
    return data.value.records.filter(r => r.nextReviewDate <= today).length
  })

  const unproficientCount = computed(() => {
    return data.value.records.filter(r => r.unproficient).length
  })

  const wrongCount = computed(() => data.value.wrongBook.length)

  return {
    data, records, wrongBook, settings,
    reviewDueCount, unproficientCount, wrongCount,
    getRecord, getOrCreateRecord, recordAnswer,
    toggleUnproficient, removeWrongEntry, updateSettings,
    importUserData, exportUserData, clearAllData, persist,
  }
})
```

- [ ] **Step 3: 实现答题会话 store**

```typescript
// src/stores/quiz.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { QuizQuestion, QuizSession, QuizType, SourceType } from '@/types'
import { smartMix, getPoemsBySource, shuffleArray } from '@/utils/quiz'
import { generateFillBlankOptions, generateNextLineOptions, generateSelectOptions } from '@/utils/distractor'
import { usePoemStore } from './poem'
import { useLearningStore } from './learning'

export const useQuizStore = defineStore('quiz', () => {
  const session = ref<QuizSession | null>(null)
  const currentIndex = computed(() => session.value?.currentIndex ?? 0)
  const currentQuestion = computed(() => session.value?.questions[session.value.currentIndex] ?? null)
  const isFinished = computed(() => session.value ? session.value.currentIndex >= session.value.questions.length : false)
  const totalQuestions = computed(() => session.value?.questions.length ?? 0)
  const correctCount = computed(() => session.value?.answers.filter(a => a.correct).length ?? 0)

  function generateQuestions(poemIds: string[], quizTypes: QuizType[]): QuizQuestion[] {
    const poemStore = usePoemStore()
    const questions: QuizQuestion[] = []

    for (const poemId of poemIds) {
      const poem = poemStore.getPoemById(poemId)
      if (!poem) continue

      for (const quizType of quizTypes) {
        questions.push(generateQuestion(poem, quizType, poemStore.poems))
      }
    }

    return shuffleArray(questions)
  }

  function generateQuestion(poem: import('@/types').Poem, quizType: QuizType, allPoems: import('@/types').Poem[]): QuizQuestion {
    switch (quizType) {
      case 'fillBlank': {
        const fullText = poem.text.join('')
        const chars = [...fullText.replace(/[，。、！？；：""''（）\s]/g, '')]
        const blankCount = Math.min(3, Math.max(1, Math.floor(chars.length / 5)))
        const positions = shuffleArray(chars.map((_, i) => i)).slice(0, blankCount).sort((a, b) => a - b)
        const blankChars = positions.map(i => chars[i])
        const prompt = poem.text.join('\n')
        const options = blankChars.map(ch => generateFillBlankOptions(poem, allPoems, ch, 0))
        return {
          poemId: poem.id,
          quizType: 'fillBlank',
          prompt,
          options: options[0], // simplified: one blank per question
          correctIndex: options[0].indexOf(blankChars[0]),
          blankPositions: positions,
        }
      }
      case 'nextLine': {
        const isForward = Math.random() > 0.5
        const lineIndex = Math.floor(Math.random() * (poem.text.length - 1))
        const givenLine = isForward ? poem.text[lineIndex] : poem.text[lineIndex + 1]
        const correctLine = isForward ? poem.text[lineIndex + 1] : poem.text[lineIndex]
        const options = generateNextLineOptions(poem, allPoems, correctLine, poem.grade)
        return {
          poemId: poem.id,
          quizType: 'nextLine',
          prompt: `${givenLine}\n${isForward ? '→ 下句是？' : '→ 上句是？'}`,
          options,
          correctIndex: options.indexOf(correctLine),
        }
      }
      case 'selectTitle': {
        const subType = (['title', 'author', 'dynasty'] as const)[Math.floor(Math.random() * 3)]
        const correctValue = poem[subType]
        const options = generateSelectOptions(allPoems, poem.grade, subType, correctValue)
        const labels: Record<string, string> = { title: '诗名', author: '作者', dynasty: '朝代' }
        return {
          poemId: poem.id,
          quizType: 'selectTitle',
          prompt: `${poem.text.join('\n')}\n\n这首诗的${labels[subType]}是？`,
          options,
          correctIndex: options.indexOf(correctValue),
        }
      }
      default:
        // recite is v2, skip for now
        return {
          poemId: poem.id,
          quizType: 'selectTitle',
          prompt: poem.text.join('\n'),
          options: [poem.title],
          correctIndex: 0,
        }
    }
  }

  function startQuiz(source: SourceType, quizTypes: QuizType[], count: number, grades?: string[]) {
    const poemStore = usePoemStore()
    const learningStore = useLearningStore()
    const today = new Date().toISOString().split('T')[0]

    let selectedPoems: import('@/types').Poem[]
    if (source === 'smart') {
      selectedPoems = smartMix(poemStore.poems, learningStore.records, learningStore.wrongBook, count, today)
    } else if (source === 'review') {
      const { getReviewPoems } = require('@/utils/quiz')
      selectedPoems = getReviewPoems(poemStore.poems, learningStore.records, today)
      selectedPoems = shuffleArray(selectedPoems).slice(0, count)
    } else if (source === 'wrong') {
      const { getWrongPoems } = require('@/utils/quiz')
      selectedPoems = getWrongPoems(poemStore.poems, learningStore.wrongBook)
      selectedPoems = shuffleArray(selectedPoems).slice(0, count)
    } else if (source === 'unproficient') {
      const { getUnproficientPoems } = require('@/utils/quiz')
      selectedPoems = getUnproficientPoems(poemStore.poems, learningStore.records)
      selectedPoems = shuffleArray(selectedPoems).slice(0, count)
    } else {
      selectedPoems = getPoemsBySource(poemStore.poems, source, today, { grades })
      selectedPoems = shuffleArray(selectedPoems).slice(0, count)
    }

    const questions = generateQuestions(selectedPoems.map(p => p.id), quizTypes)

    session.value = {
      source,
      quizTypes,
      questions,
      currentIndex: 0,
      answers: [],
      startTime: new Date().toISOString(),
    }
  }

  function answerQuestion(selectedIndex: number) {
    if (!session.value || !currentQuestion.value) return
    const correct = selectedIndex === currentQuestion.value.correctIndex
    session.value.answers.push({
      questionIndex: session.value.currentIndex,
      selectedIndex,
      correct,
    })

    // Record answer in learning store
    const learningStore = useLearningStore()
    learningStore.recordAnswer(
      currentQuestion.value.poemId,
      currentQuestion.value.quizType,
      correct,
      correct ? undefined : currentQuestion.value.options[selectedIndex]
    )

    session.value.currentIndex++
  }

  function resetSession() {
    session.value = null
  }

  return {
    session, currentIndex, currentQuestion, isFinished,
    totalQuestions, correctCount,
    startQuiz, answerQuestion, resetSession,
  }
})
```

- [ ] **Step 4: 验证 stores 无 TypeScript 错误**

```bash
npx vue-tsc --noEmit
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Pinia stores for poems, learning records, and quiz sessions"
```

---

### Task 10: Vue Router 与页面骨架

**Files:**
- Create: `src/router/index.ts`
- Modify: `src/App.vue`
- Create: `src/views/HomePage.vue`, `src/views/QuizSetupPage.vue`, `src/views/QuizPlayPage.vue`, `src/views/QuizResultPage.vue`, `src/views/WrongBookPage.vue`, `src/views/ProgressPage.vue`, `src/views/SettingsPage.vue`

- [ ] **Step 1: 创建路由配置**

```typescript
// src/router/index.ts
import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('@/views/HomePage.vue') },
  { path: '/quiz/setup', name: 'quiz-setup', component: () => import('@/views/QuizSetupPage.vue') },
  { path: '/quiz/play', name: 'quiz-play', component: () => import('@/views/QuizPlayPage.vue') },
  { path: '/quiz/result', name: 'quiz-result', component: () => import('@/views/QuizResultPage.vue') },
  { path: '/wrong', name: 'wrong-book', component: () => import('@/views/WrongBookPage.vue') },
  { path: '/progress', name: 'progress', component: () => import('@/views/ProgressPage.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsPage.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
```

- [ ] **Step 2: 创建各页面骨架组件**

```vue
<!-- src/views/HomePage.vue -->
<template>
  <div class="home-page">
    <h1>古诗抽查</h1>
    <p>今日待复习：{{ reviewDueCount }} 首</p>
    <button v-if="reviewDueCount > 0" @click="startReview">点击进入复习</button>
    <div class="mode-select">
      <button @click="startQuiz('parent')">家长抽查</button>
      <button @click="startQuiz('self')">自主练习</button>
    </div>
    <div class="shortcuts">
      <router-link to="/wrong">错题本({{ wrongCount }})</router-link>
      <router-link to="/progress">学习进度</router-link>
      <router-link to="/settings">设置</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

const reviewDueCount = computed(() => learningStore.reviewDueCount)
const wrongCount = computed(() => learningStore.wrongCount)

onMounted(() => poemStore.fetchPoems())

function startReview() {
  router.push({ name: 'quiz-setup', query: { source: 'review' } })
}

function startQuiz(mode: string) {
  router.push({ name: 'quiz-setup', query: { mode } })
}
</script>
```

```vue
<!-- src/views/QuizSetupPage.vue -->
<template>
  <div class="quiz-setup">
    <h2>抽查设置</h2>
    <div>
      <label>抽题范围</label>
      <select v-model="source">
        <option value="smart">智能混合</option>
        <option value="grade">按年级</option>
        <option value="all">全部</option>
        <option value="review">仅待复习</option>
        <option value="wrong">错题本</option>
        <option value="unproficient">不熟练</option>
      </select>
    </div>
    <div>
      <label>抽查方式</label>
      <label v-for="qt in quizTypeOptions" :key="qt.value">
        <input type="checkbox" v-model="quizTypes" :value="qt.value" />
        {{ qt.label }}
      </label>
    </div>
    <div>
      <label>题目数量</label>
      <select v-model="count">
        <option :value="5">5</option>
        <option :value="10">10</option>
        <option :value="20">20</option>
      </select>
    </div>
    <button @click="startQuiz">开始答题</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import type { QuizType, SourceType } from '@/types'

const router = useRouter()
const quizStore = useQuizStore()

const source = ref<SourceType>('smart')
const quizTypes = ref<QuizType[]>(['fillBlank', 'nextLine', 'selectTitle'])
const count = ref(5)

const quizTypeOptions = [
  { value: 'fillBlank', label: '补字选择' },
  { value: 'nextLine', label: '上下句接龙' },
  { value: 'selectTitle', label: '选标题/作者/朝代' },
]

function startQuiz() {
  if (quizTypes.value.length === 0) return
  quizStore.startQuiz(source.value, quizTypes.value, count.value)
  router.push({ name: 'quiz-play' })
}
</script>
```

```vue
<!-- src/views/QuizPlayPage.vue -->
<template>
  <div class="quiz-play">
    <div v-if="quizStore.currentQuestion && !quizStore.isFinished">
      <div class="progress">{{ quizStore.currentIndex + 1 }} / {{ quizStore.totalQuestions }}</div>
      <div class="question">
        <p class="prompt">{{ quizStore.currentQuestion.prompt }}</p>
        <div class="options">
          <button
            v-for="(opt, i) in quizStore.currentQuestion.options"
            :key="i"
            @click="selectAnswer(i)"
            class="option-btn"
          >
            {{ opt }}
          </button>
        </div>
      </div>
    </div>
    <div v-else-if="quizStore.isFinished">
      <p>答题完成！</p>
      <button @click="$router.push({ name: 'quiz-result' })">查看结果</button>
    </div>
    <div v-else>
      <p>未开始答题</p>
      <button @click="$router.push({ name: 'home' })">返回首页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useQuizStore } from '@/stores/quiz'

const quizStore = useQuizStore()

function selectAnswer(index: number) {
  quizStore.answerQuestion(index)
}
</script>
```

```vue
<!-- src/views/QuizResultPage.vue -->
<template>
  <div class="quiz-result">
    <h2>答题结果</h2>
    <p>正确率：{{ quizStore.correctCount }} / {{ quizStore.totalQuestions }}</p>
    <div v-for="(answer, i) in quizStore.session?.answers" :key="i" class="result-item">
      <span :class="answer.correct ? 'correct' : 'wrong'">
        {{ answer.correct ? '✓' : '✗' }}
      </span>
    </div>
    <button @click="goHome">返回首页</button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'

const router = useRouter()
const quizStore = useQuizStore()

function goHome() {
  quizStore.resetSession()
  router.push({ name: 'home' })
}
</script>
```

```vue
<!-- src/views/WrongBookPage.vue -->
<template>
  <div class="wrong-book">
    <h2>错题本</h2>
    <div v-if="learningStore.wrongBook.length === 0">
      <p>暂无错题</p>
    </div>
    <div v-for="entry in learningStore.wrongBook" :key="entry.poemId + entry.quizType" class="wrong-entry">
      <span>{{ getPoemTitle(entry.poemId) }}</span>
      <span>{{ entry.quizType }}</span>
      <span>错误 {{ entry.wrongCount }} 次</span>
      <button @click="learningStore.removeWrongEntry(entry.poemId, entry.quizType)">移除</button>
      <button @click="learningStore.toggleUnproficient(entry.poemId)">
        {{ entry.unproficient ? '取消不熟练' : '标为不熟练' }}
      </button>
    </div>
    <button @click="$router.push({ name: 'home' })">返回首页</button>
  </div>
</template>

<script setup lang="ts">
import { useLearningStore } from '@/stores/learning'
import { usePoemStore } from '@/stores/poem'

const learningStore = useLearningStore()
const poemStore = usePoemStore()

function getPoemTitle(poemId: string): string {
  return poemStore.getPoemById(poemId)?.title ?? poemId
}
</script>
```

```vue
<!-- src/views/ProgressPage.vue -->
<template>
  <div class="progress-page">
    <h2>学习进度</h2>
    <p>已学：{{ learnedCount }} / {{ poemStore.poems.length }}</p>
    <p>不熟练：{{ learningStore.unproficientCount }}</p>
    <div class="mastery-distribution">
      <span>新：{{ masteryCount('新') }}</span>
      <span>学：{{ masteryCount('学') }}</span>
      <span>熟：{{ masteryCount('熟') }}</span>
      <span>固：{{ masteryCount('固') }}</span>
    </div>
    <button @click="$router.push({ name: 'home' })">返回首页</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLearningStore } from '@/stores/learning'
import { usePoemStore } from '@/stores/poem'
import type { MasteryLevel } from '@/types'

const learningStore = useLearningStore()
const poemStore = usePoemStore()

const learnedCount = computed(() => learningStore.records.filter(r => r.reviewCount > 0).length)

function masteryCount(level: MasteryLevel): number {
  return learningStore.records.filter(r => r.masteryLevel === level).length
}
</script>
```

```vue
<!-- src/views/SettingsPage.vue -->
<template>
  <div class="settings-page">
    <h2>设置</h2>
    <div>
      <button @click="exportData">导出数据</button>
    </div>
    <div>
      <button @click="triggerImport">导入数据</button>
      <input type="file" ref="fileInput" accept=".json" @change="importData" style="display:none" />
    </div>
    <div>
      <button @click="clearData">清除数据</button>
    </div>
    <button @click="$router.push({ name: 'home' })">返回首页</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useLearningStore } from '@/stores/learning'

const learningStore = useLearningStore()
const fileInput = ref<HTMLInputElement | null>(null)

function exportData() {
  const json = learningStore.exportUserData()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `poem-quiz-backup-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function triggerImport() {
  fileInput.value?.click()
}

function importData(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const success = learningStore.importUserData(reader.result as string)
    if (success) {
      alert('导入成功')
    } else {
      alert('导入失败，数据格式不正确')
    }
  }
  reader.readAsText(file)
}

function clearData() {
  if (confirm('确定要清除所有数据吗？此操作不可恢复。')) {
    learningStore.clearAllData()
  }
}
</script>
```

- [ ] **Step 3: 更新 App.vue**

```vue
<!-- src/App.vue -->
<template>
  <router-view />
</template>
```

- [ ] **Step 4: 验证项目构建**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 5: 验证开发服务器**

```bash
npm run dev -- --host 0.0.0.0 &
sleep 3
curl -s http://localhost:5173 | head -5
kill %1
```

Expected: HTML 输出

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add router and all page skeleton components"
```

---

### Task 11: 抽查组件实现

**Files:**
- Create: `src/components/FillBlankQuiz.vue`
- Create: `src/components/NextLineQuiz.vue`
- Create: `src/components/SelectTitleQuiz.vue`
- Modify: `src/views/QuizPlayPage.vue`

- [ ] **Step 1: 实现补字选择题组件**

```vue
<!-- src/components/FillBlankQuiz.vue -->
<template>
  <div class="fill-blank-quiz">
    <p class="poem-title">{{ poem?.title }} — {{ poem?.dynasty }}·{{ poem?.author }}</p>
    <div class="poem-text">
      <span v-for="(line, i) in poem?.text" :key="i">
        {{ line }}
      </span>
    </div>
    <p class="question-text">请选择正确的字填入空缺处：</p>
    <div class="options">
      <button
        v-for="(opt, i) in question.options"
        :key="i"
        @click="$emit('answer', i)"
        :class="['option-btn', { selected: answered === i }]"
        :disabled="answered !== undefined"
      >
        {{ opt }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { QuizQuestion } from '@/types'
import { usePoemStore } from '@/stores/poem'

const props = defineProps<{ question: QuizQuestion }>()
const emit = defineEmits<{ answer: [index: number] }>()
const poemStore = usePoemStore()
const answered = ref<number | undefined>(undefined)

const poem = computed(() => poemStore.getPoemById(props.question.poemId))
</script>
```

- [ ] **Step 2: 实现上下句接龙选择题组件**

```vue
<!-- src/components/NextLineQuiz.vue -->
<template>
  <div class="next-line-quiz">
    <p class="poem-title">{{ poem?.title }} — {{ poem?.dynasty }}·{{ poem?.author }}</p>
    <p class="question-text">{{ question.prompt }}</p>
    <div class="options">
      <button
        v-for="(opt, i) in question.options"
        :key="i"
        @click="$emit('answer', i)"
        :class="['option-btn']"
      >
        {{ opt }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { QuizQuestion } from '@/types'
import { usePoemStore } from '@/stores/poem'

const props = defineProps<{ question: QuizQuestion }>()
defineEmits<{ answer: [index: number] }>()
const poemStore = usePoemStore()

const poem = computed(() => poemStore.getPoemById(props.question.poemId))
</script>
```

- [ ] **Step 3: 实现选标题/作者/朝代组件**

```vue
<!-- src/components/SelectTitleQuiz.vue -->
<template>
  <div class="select-title-quiz">
    <p class="question-text">{{ question.prompt }}</p>
    <div class="options">
      <button
        v-for="(opt, i) in question.options"
        :key="i"
        @click="$emit('answer', i)"
        :class="['option-btn']"
      >
        {{ opt }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { QuizQuestion } from '@/types'

const props = defineProps<{ question: QuizQuestion }>()
defineEmits<{ answer: [index: number] }>()
</script>
```

- [ ] **Step 4: 更新 QuizPlayPage.vue 使用组件**

```vue
<!-- src/views/QuizPlayPage.vue -->
<template>
  <div class="quiz-play">
    <div v-if="quizStore.currentQuestion && !quizStore.isFinished">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <p class="progress-text">{{ quizStore.currentIndex + 1 }} / {{ quizStore.totalQuestions }}</p>

      <FillBlankQuiz
        v-if="quizStore.currentQuestion.quizType === 'fillBlank'"
        :question="quizStore.currentQuestion"
        @answer="selectAnswer"
      />
      <NextLineQuiz
        v-else-if="quizStore.currentQuestion.quizType === 'nextLine'"
        :question="quizStore.currentQuestion"
        @answer="selectAnswer"
      />
      <SelectTitleQuiz
        v-else-if="quizStore.currentQuestion.quizType === 'selectTitle'"
        :question="quizStore.currentQuestion"
        @answer="selectAnswer"
      />

      <div v-if="showFeedback" class="feedback" :class="lastCorrect ? 'correct' : 'wrong'">
        {{ lastCorrect ? '正确！' : '错误，正确答案是：' + quizStore.session?.questions[quizStore.currentIndex - 1]?.options[quizStore.session?.questions[quizStore.currentIndex - 1]?.correctIndex] }}
      </div>
    </div>
    <div v-else-if="quizStore.isFinished">
      <p>答题完成！</p>
      <button @click="$router.push({ name: 'quiz-result' })">查看结果</button>
    </div>
    <div v-else>
      <p>未开始答题</p>
      <button @click="$router.push({ name: 'home' })">返回首页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuizStore } from '@/stores/quiz'
import FillBlankQuiz from '@/components/FillBlankQuiz.vue'
import NextLineQuiz from '@/components/NextLineQuiz.vue'
import SelectTitleQuiz from '@/components/SelectTitleQuiz.vue'

const quizStore = useQuizStore()
const showFeedback = ref(false)
const lastCorrect = ref(false)

const progressPercent = computed(() =>
  quizStore.totalQuestions > 0
    ? ((quizStore.currentIndex) / quizStore.totalQuestions) * 100
    : 0
)

function selectAnswer(index: number) {
  lastCorrect.value = index === quizStore.currentQuestion?.correctIndex
  quizStore.answerQuestion(index)
  showFeedback.value = true
  setTimeout(() => { showFeedback.value = false }, 1500)
}
</script>

<style scoped>
.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s;
}
.feedback.correct {
  color: var(--color-success);
  font-weight: bold;
}
.feedback.wrong {
  color: var(--color-danger);
  font-weight: bold;
}
</style>
```

- [ ] **Step 5: 验证构建**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add quiz components (fillBlank, nextLine, selectTitle) and integrate"
```

---

### Task 12: 组件测试

**Files:**
- Create: `tests/component/FillBlankQuiz.test.ts`
- Create: `tests/component/NextLineQuiz.test.ts`
- Create: `tests/component/SelectTitleQuiz.test.ts`

- [ ] **Step 1: 写补字选择题组件测试**

```typescript
// tests/component/FillBlankQuiz.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FillBlankQuiz from '@/components/FillBlankQuiz.vue'
import type { QuizQuestion } from '@/types'

const mockQuestion: QuizQuestion = {
  poemId: 'p1',
  quizType: 'fillBlank',
  prompt: '春眠不觉晓\n处处闻啼鸟',
  options: ['晓', '鸟', '花', '月', '风', '雨'],
  correctIndex: 0,
}

describe('FillBlankQuiz', () => {
  it('renders 6 options', () => {
    setActivePinia(createPinia())
    const wrapper = mount(FillBlankQuiz, {
      props: { question: mockQuestion },
      global: { plugins: [createPinia()] },
    })
    const buttons = wrapper.findAll('.option-btn')
    expect(buttons.length).toBe(6)
  })

  it('emits answer when option clicked', () => {
    setActivePinia(createPinia())
    const wrapper = mount(FillBlankQuiz, {
      props: { question: mockQuestion },
      global: { plugins: [createPinia()] },
    })
    wrapper.findAll('.option-btn')[0].trigger('click')
    expect(wrapper.emitted('answer')).toBeTruthy()
    expect(wrapper.emitted('answer')![0]).toEqual([0])
  })
})
```

- [ ] **Step 2: 写接龙选择题组件测试**

```typescript
// tests/component/NextLineQuiz.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import NextLineQuiz from '@/components/NextLineQuiz.vue'
import type { QuizQuestion } from '@/types'

const mockQuestion: QuizQuestion = {
  poemId: 'p1',
  quizType: 'nextLine',
  prompt: '春眠不觉晓\n→ 下句是？',
  options: ['处处闻啼鸟', '床前明月光', '疑是地上霜', '举头望明月', '低头思故乡', '花落知多少'],
  correctIndex: 0,
}

describe('NextLineQuiz', () => {
  it('renders 6 options', () => {
    setActivePinia(createPinia())
    const wrapper = mount(NextLineQuiz, {
      props: { question: mockQuestion },
      global: { plugins: [createPinia()] },
    })
    const buttons = wrapper.findAll('.option-btn')
    expect(buttons.length).toBe(6)
  })

  it('emits answer when option clicked', () => {
    setActivePinia(createPinia())
    const wrapper = mount(NextLineQuiz, {
      props: { question: mockQuestion },
      global: { plugins: [createPinia()] },
    })
    wrapper.findAll('.option-btn')[2].trigger('click')
    expect(wrapper.emitted('answer')![0]).toEqual([2])
  })
})
```

- [ ] **Step 3: 写选标题/作者/朝代组件测试**

```typescript
// tests/component/SelectTitleQuiz.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SelectTitleQuiz from '@/components/SelectTitleQuiz.vue'
import type { QuizQuestion } from '@/types'

const mockQuestion: QuizQuestion = {
  poemId: 'p1',
  quizType: 'selectTitle',
  prompt: '春眠不觉晓\n处处闻啼鸟\n夜来风雨声\n花落知多少\n\n这首诗的诗名是？',
  options: ['春晓', '静夜思', '咏鹅', '画', '悯农', '风'],
  correctIndex: 0,
}

describe('SelectTitleQuiz', () => {
  it('renders 6 options', () => {
    setActivePinia(createPinia())
    const wrapper = mount(SelectTitleQuiz, {
      props: { question: mockQuestion },
      global: { plugins: [createPinia()] },
    })
    const buttons = wrapper.findAll('.option-btn')
    expect(buttons.length).toBe(6)
  })

  it('emits answer when option clicked', () => {
    setActivePinia(createPinia())
    const wrapper = mount(SelectTitleQuiz, {
      props: { question: mockQuestion },
      global: { plugins: [createPinia()] },
    })
    wrapper.findAll('.option-btn')[0].trigger('click')
    expect(wrapper.emitted('answer')![0]).toEqual([0])
  })
})
```

- [ ] **Step 4: 运行所有组件测试**

```bash
npm run test -- tests/component/
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add component tests for quiz components"
```

---

### Task 13: 完善首页与全局样式

**Files:**
- Modify: `src/views/HomePage.vue`
- Modify: `src/style.css`

- [ ] **Step 1: 完善首页样式**

```vue
<!-- src/views/HomePage.vue -->
<template>
  <div class="home-page max-w-md mx-auto p-4">
    <h1 class="text-2xl font-bold text-center mb-6">古诗抽查</h1>

    <div v-if="reviewDueCount > 0" class="review-banner mb-4 p-4 bg-indigo-50 rounded-lg cursor-pointer" @click="startReview">
      <p class="text-indigo-700 font-medium">今日待复习：{{ reviewDueCount }} 首</p>
      <p class="text-indigo-500 text-sm">点击进入复习 →</p>
    </div>

    <div class="grid grid-cols-2 gap-4 mb-6">
      <button class="mode-btn p-6 bg-white rounded-lg shadow hover:shadow-md transition" @click="startQuiz('parent')">
        <div class="text-3xl mb-2">👨‍👩‍👧</div>
        <div class="font-medium">家长抽查</div>
      </button>
      <button class="mode-btn p-6 bg-white rounded-lg shadow hover:shadow-md transition" @click="startQuiz('self')">
        <div class="text-3xl mb-2">📝</div>
        <div class="font-medium">自主练习</div>
      </button>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <router-link to="/wrong" class="shortcut-btn p-3 bg-white rounded-lg shadow text-center hover:shadow-md transition">
        <div class="text-sm">错题本</div>
        <div class="text-lg font-bold text-red-500">{{ wrongCount }}</div>
      </router-link>
      <router-link to="/progress" class="shortcut-btn p-3 bg-white rounded-lg shadow text-center hover:shadow-md transition">
        <div class="text-sm">学习进度</div>
        <div class="text-lg font-bold text-green-500">{{ learnedCount }}</div>
      </router-link>
      <router-link to="/settings" class="shortcut-btn p-3 bg-white rounded-lg shadow text-center hover:shadow-md transition">
        <div class="text-sm">设置</div>
        <div class="text-lg">⚙️</div>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

const reviewDueCount = computed(() => learningStore.reviewDueCount)
const wrongCount = computed(() => learningStore.wrongCount)
const learnedCount = computed(() => learningStore.records.filter(r => r.reviewCount > 0).length)

onMounted(() => poemStore.fetchPoems())

function startReview() {
  router.push({ name: 'quiz-setup', query: { source: 'review' } })
}

function startQuiz(mode: string) {
  router.push({ name: 'quiz-setup', query: { mode } })
}
</script>
```

- [ ] **Step 2: 完善全局样式**

```css
/* src/style.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #4f46e5;
  --color-success: #10b981;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;
  --color-bg: #f9fafb;
  --color-card: #ffffff;
  --color-text: #111827;
  --color-text-secondary: #6b7280;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--color-bg);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
}

.option-btn {
  @apply w-full p-3 mb-2 bg-white border-2 border-gray-200 rounded-lg text-left hover:border-indigo-300 hover:bg-indigo-50 transition;
}

.option-btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.option-btn.selected {
  @apply border-indigo-500 bg-indigo-50;
}
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: polish home page and global styles"
```

---

### Task 14: PWA 配置与图标

**Files:**
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`
- Modify: `vite.config.ts` (已在 Task 1 完成)

- [ ] **Step 1: 生成 PWA 图标**

```bash
mkdir -p public/icons
# Generate simple SVG-based icons
cat > public/icons/icon-192.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="24" fill="#4f46e5"/>
  <text x="96" y="120" font-size="96" text-anchor="middle" fill="white" font-family="serif">诗</text>
</svg>
EOF
```

> 注：实际部署时需将 SVG 转为 PNG。可用 `npx svg2png` 或在线工具。开发阶段可先跳过图标验证。

- [ ] **Step 2: 验证 PWA manifest 配置**

```bash
npm run build
ls dist/
```

Expected: Build output 包含 `manifest.webmanifest` 或类似文件

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add PWA icons and verify manifest"
```

---

### Task 15: 完善古诗数据

**Files:**
- Modify: `public/poems.json`

- [ ] **Step 1: 补充小学全年级部编版古诗数据**

按部编版教材录入 1-6 年级全部古诗（约 75+80 首）。每首诗需包含：id, title, author, dynasty, grade, unit, text, textType。

数据来源：部编版小学语文教材。

> 注：此步骤需人工校对古诗文本准确性。建议按年级分批录入并验证。

- [ ] **Step 2: 验证数据完整性**

```bash
node -e "
const d = require('./public/poems.json');
const grades = [...new Set(d.map(p => p.grade))];
console.log('Total:', d.length);
console.log('Grades:', grades);
grades.forEach(g => console.log(g + ':', d.filter(p => p.grade === g).length));
"
```

Expected: 每年级有对应数量的古诗

- [ ] **Step 3: Commit**

```bash
git add public/poems.json
git commit -m "feat: add complete poem data for grades 1-6"
```

---

### Task 16: E2E 测试

**Files:**
- Create: `tests/e2e/quiz-flow.spec.ts`
- Create: `playwright.config.ts`

- [ ] **Step 1: 安装 Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: 创建 Playwright 配置**

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  baseURL: 'http://localhost:4173',
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: true,
  },
})
```

- [ ] **Step 3: 写 E2E 测试**

```typescript
// tests/e2e/quiz-flow.spec.ts
import { test, expect } from '@playwright/test'

test('complete quiz flow', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('古诗抽查')

  // Start self-practice quiz
  await page.click('text=自主练习')

  // Select smart mix (default)
  await page.selectOption('select', 'smart')

  // Start quiz
  await page.click('text=开始答题')

  // Answer a question (click first option)
  const optionBtn = page.locator('.option-btn').first()
  await expect(optionBtn).toBeVisible()
  await optionBtn.click()

  // Should show feedback or next question
  await page.waitForTimeout(2000)
})

test('wrong book page', async ({ page }) => {
  await page.goto('/wrong')
  await expect(page.locator('h2')).toContainText('错题本')
})

test('settings page', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.locator('h2')).toContainText('设置')
})

test('export and import data', async ({ page }) => {
  await page.goto('/settings')
  const downloadPromise = page.waitForEvent('download')
  await page.click('text=导出数据')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('poem-quiz-backup')
})
```

- [ ] **Step 4: 运行 E2E 测试**

```bash
npm run build
npm run test:e2e
```

Expected: All E2E tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Playwright E2E tests for quiz flow"
```

---

### Task 17: 最终集成与验证

**Files:**
- All files

- [ ] **Step 1: 运行全部单元测试 + 组件测试**

```bash
npm run test
```

Expected: All tests pass

- [ ] **Step 2: 运行构建**

```bash
npm run build
```

Expected: Build succeeds with no errors

- [ ] **Step 3: 运行 E2E 测试**

```bash
npm run test:e2e
```

Expected: All E2E tests pass

- [ ] **Step 4: 启动开发服务器手动验证**

```bash
npm run dev -- --host 0.0.0.0
```

验证：
- 首页正确显示待复习数量
- 家长抽查/自主练习流程完整
- 三种抽查方式正常工作
- 错题本记录正确
- 学习进度展示正确
- 设置页导出/导入/清除功能正常

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "feat: complete poem quiz PWA v1"
```

---

## 自审清单

### Spec 覆盖度

| Spec 需求 | 对应 Task |
|-----------|----------|
| 四种抽查方式 | Task 11 (补字/接龙/选标题), v2 语音待后续 |
| 错题记录 | Task 9 (learning store), Task 12 (WrongBookPage) |
| 艾宾浩斯遗忘曲线 | Task 4 |
| 智能混合抽题 | Task 5 |
| 不熟练标注 | Task 7 |
| 数据导入导出 | Task 8, Task 9 |
| PWA 离线 | Task 1, Task 14 |
| 家长抽查/自主练习 | Task 10, Task 11 |
| 单元测试 | Task 4-8, Task 12 |
| 组件测试 | Task 12 |
| E2E 测试 | Task 16 |
| 古诗数据 | Task 3, Task 15 |
| 简约现代界面 | Task 13 |

### 未覆盖项

- **语音背诵 (v2)**: 需 WebGPU 语音模型集成，作为后续迭代
- **PWA 离线模拟测试**: 需 Playwright 离线模式，可后续补充
- **复习日历**: ProgressPage 中仅展示统计，日历视图可后续完善
