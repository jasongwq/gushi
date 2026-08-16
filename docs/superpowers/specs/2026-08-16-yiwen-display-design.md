# 译文展示功能设计

## 概述

在古诗抽查 PWA 中添加译文（yiwen）展示功能，用户可切换显示/隐藏译文，偏好保存到 localStorage。

## 背景

- 200 首古诗的 `yiwen` 字段已有数据（100% 覆盖），但 UI 中从未展示
- 用户希望在背诵和学习过程中查看译文辅助理解

## 设计

### 1. 译文偏好存储

在 `UserSettings` 中新增 `showYiwen: boolean` 字段，默认 `false`（收起）。

- `UserSettings` 接口添加 `showYiwen?: boolean`（可选，兼容旧数据）
- `storage.ts` 的 `getDefaultData()` 中 `settings` 默认不包含此字段（undefined 视为 false）
- learningStore 的 `updateSettings()` 已支持 `Partial<UserSettings>`，无需额外改动

### 2. 译文切换组件

不新建独立组件，在以下四个位置各加一个切换按钮 + 译文展示区域：

#### 2.1 PoemPopup.vue

- 在原文下方添加"译文"切换按钮
- 点击后展开/收起译文区域，显示 `poem.yiwen` 文本
- 切换状态由组件内部 `ref` 控制，初始值从 `learningStore.settings.showYiwen` 读取
- 切换时同步更新 `learningStore.settings.showYiwen`

#### 2.2 PoemDetailPage.vue

- 在"原文"区块下方添加"译文"区块
- 区块标题右侧有切换按钮，控制译文显示/隐藏
- 初始状态从 `learningStore.settings.showYiwen` 读取
- 切换时同步更新偏好

#### 2.3 RecitationCard.vue

- 在全诗原文下方添加"查看译文"按钮
- 点击后展开译文区域，显示 `poem.yiwen`
- 初始状态从偏好读取，切换时同步更新

#### 2.4 RecitePage.vue

- 在展开原文后，原文区块下方添加"查看译文"按钮
- 点击后展开译文，辅助自评
- 初始状态从偏好读取，切换时同步更新

### 3. 交互细节

- 切换按钮样式：文字链接风格，如"显示译文 ▾" / "隐藏译文 ▴"
- 译文区域：与原文区块样式一致，浅灰背景，文本居中
- 任何一处切换都会更新全局偏好，其他页面下次打开时自动应用
- 不在当前已打开的页面间实时同步（避免复杂度），仅在页面加载时读取偏好

### 4. 不做的事

- 不做逐句对照（yiwen 是整段文本，非逐行对应）
- 不做译文编辑功能
- 不在设置页添加单独的译文开关（四处切换按钮已足够）

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/types/index.ts` | `UserSettings` 添加 `showYiwen?: boolean` |
| `src/components/PoemPopup.vue` | 添加译文切换按钮 + 译文展示区域 |
| `src/views/PoemDetailPage.vue` | 添加译文区块 |
| `src/components/RecitationCard.vue` | 添加译文切换按钮 + 译文展示区域 |
| `src/views/RecitePage.vue` | 添加译文切换按钮 + 译文展示区域 |
