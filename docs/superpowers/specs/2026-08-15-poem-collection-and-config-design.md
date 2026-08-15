# 古诗集合浏览 & 启用配置 & 浮窗设计

## 概述

为古诗抽查 PWA 新增三个核心功能：
1. **古诗集合浏览页**：按年级标签页浏览全部古诗，点击标题弹出浮窗查看完整内容
2. **古诗启用配置页**：按年级批量启用/禁用古诗，也可单首调整，控制抽查范围
3. **古诗浮窗组件**：可复用的浮窗，在浏览页、配置页、错题本、答题结果等页面通用

## 方案

两个独立页面 + 复用浮窗组件：
- 浏览页和配置页职责分离，逻辑清晰
- 浮窗组件 `PoemPopup.vue` 全局复用
- 年级标签页可抽成公共组件

---

## 1. 古诗集合浏览页

**路由**：`/poems`
**入口**：首页新增"古诗集合"入口卡片

### 页面结构

- 顶部：年级标签页（一年级~六年级 + 配读篇目），可横向滚动
- 内容区：当前年级下的古诗列表，每首诗一行
  - 左侧：标题（可点击弹出浮窗）+ 作者·朝代
  - 右侧：掌握度标签（新/学/熟/固）
- 标签页之间切换时保持选中状态

### 数据来源

- `poemStore.poemsByGrade`：按年级分组的古诗列表
- `learningStore.records`：获取每首诗的掌握度

---

## 2. 古诗启用配置页

**路由**：`/settings/poems`
**入口**：设置页新增"古诗配置"入口，跳转到此页

### 页面结构

- 顶部：年级标签页（一年级~六年级 + 配读篇目），可横向滚动
- 标签页下方：年级级操作栏——"全选"和"全不选"按钮
- 内容区：当前年级下的古诗列表，每首诗一行
  - 左侧：标题（可点击弹出浮窗）+ 作者·朝代
  - 右侧：开关（toggle），控制该首诗是否启用
- 底部：固定统计栏——"已启用 X / 共 Y 首"

### 数据存储

- `UserSettings.enabledPoems: string[]` 存储启用的古诗ID列表
- `enabledPoems` 为空数组时视为全部启用（向后兼容）
- 切换开关实时保存到 localStorage

### 影响范围

- 抽查出题时过滤：只从启用的古诗中出题
- 所有出题模式（智能混合、待复习、错题本、不熟练等）都受启用范围限制

---

## 3. 古诗浮窗组件

**组件名**：`PoemPopup.vue`

### 功能

- 显示完整古诗信息：标题、作者·朝代、全文（逐行显示）
- 点击标题触发浮窗，再次点击标题或点击浮窗外部区域关闭
- 浮窗有半透明遮罩，点击遮罩关闭
- 浮窗有淡入淡出动画

### 接口

- Props：`poem: Poem`（古诗数据）、`visible: boolean`（显隐状态）
- Emit：`update:visible`（更新显隐状态）

### 交互

- 标题文字带下划线或颜色区分，提示可点击
- 点击标题 toggle 浮窗
- 点击遮罩关闭浮窗
- 浮窗定位在视口中央

### 复用位置

- 古诗集合浏览页（点击标题）
- 古诗启用配置页（点击标题）
- 错题本页（点击标题）
- 答题结果页（点击标题）
- 答题进行中（点击题目中的标题）

---

## 4. 数据层变更

### UserSettings 变更

- 新增 `enabledPoems: string[]`，存储启用的古诗ID
- `enabledPoems` 为空数组时视为全部启用（向后兼容旧数据）
- 移除原有的 `enabledGrades` 字段（已被 enabledPoems 替代）

### poemStore 变更

- 新增 `enabledPoems` 计算属性：返回启用的古诗列表
- 新增 `isEnabled(poemId: string): boolean` 方法：判断某首诗是否启用
- 新增 `togglePoem(poemId: string)` 方法：切换单首启用状态
- 新增 `toggleGrade(grade: string, enabled: boolean)` 方法：切换整个年级的启用状态
- 新增 `enabledCount` 计算属性：已启用古诗数量
- 新增 `gradeEnabledCount(grade: string)` 计算属性：某年级已启用数量

### learningStore 变更

- 新增 `getMasteryLevel(poemId: string): MasteryLevel` 方法：获取单首诗的掌握度

### quizStore 变更

- 出题时使用 `poemStore.enabledPoems` 替代 `poemStore.poems` 作为源数据
- 所有出题模式都受启用范围限制

---

## 5. 路由变更

| 路由 | 名称 | 组件 | 说明 |
|------|------|------|------|
| `/poems` | poem-collection | PoemCollectionPage.vue | 古诗集合浏览 |
| `/settings/poems` | poem-config | PoemConfigPage.vue | 古诗启用配置 |

---

## 6. 现有页面变更

### 首页（HomePage.vue）

- 新增"古诗集合"入口卡片，与错题本、进度等并列

### 设置页（SettingsPage.vue）

- 新增"古诗配置"入口，跳转到 `/settings/poems`

### 错题本页（WrongBookPage.vue）

- 古诗标题改为可点击，点击弹出浮窗

### 答题结果页（QuizResultPage.vue）

- 每题中的古诗标题改为可点击，点击弹出浮窗

### 答题页（QuizPlayPage.vue）

- 题目中的古诗标题改为可点击，点击弹出浮窗

---

## 7. 新增文件清单

| 文件 | 说明 |
|------|------|
| `src/views/PoemCollectionPage.vue` | 古诗集合浏览页 |
| `src/views/PoemConfigPage.vue` | 古诗启用配置页 |
| `src/components/PoemPopup.vue` | 古诗浮窗组件 |

## 8. 修改文件清单

| 文件 | 变更 |
|------|------|
| `src/types/index.ts` | UserSettings 新增 enabledPoems，移除 enabledGrades |
| `src/stores/poem.ts` | 新增启用相关计算属性和方法 |
| `src/stores/learning.ts` | 新增 getMasteryLevel 方法 |
| `src/stores/quiz.ts` | 出题源改为 enabledPoems |
| `src/utils/storage.ts` | 适配 enabledPoems 存储和迁移 |
| `src/router/index.ts` | 新增两条路由 |
| `src/views/HomePage.vue` | 新增古诗集合入口 |
| `src/views/SettingsPage.vue` | 新增古诗配置入口 |
| `src/views/WrongBookPage.vue` | 标题可点击弹出浮窗 |
| `src/views/QuizResultPage.vue` | 标题可点击弹出浮窗 |
| `src/views/QuizPlayPage.vue` | 标题可点击弹出浮窗 |
