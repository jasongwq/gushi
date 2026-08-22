---
name: UniApp Migration
description: 古诗抽查迁移 uni-app 双端（H5+小程序），去滑动替代方案，语音不做，重建完整测试
type: project
---

# 古诗抽查 → uni-app 双端迁移设计

> 日期：2026-08-22
> 状态：已确认

---

## 一、背景与目标

当前项目是 Vue 3 + TypeScript + Pinia + Vite + PWA 的 Web 应用（约 5000 行源码，14 页面 + 7 组件），用户希望迁移到微信小程序，同时保留 Web 端。

**已确认决策：**

| 决策点 | 结论 |
|--------|------|
| 框架 | uni-app（Vue3 + TS + Pinia + Vite CLI 模式，`npx degit dcloudio/uni-preset-vue#vite-ts`） |
| 输出端 | 双端：H5 + 微信小程序（一套代码，条件编译） |
| 滑动 | 主体去滑动——浏览模式改为「列表 + 点击进入 + 上下一首按钮」；滑动功能单独拉分支做 |
| 语音背诵 | 本期不做（原 WebGPU 计划搁置，保持现状） |
| 测试 | 重建完整测试：纯 TS 单测保留 + 组件/E2E 在 uni-app 端重建 |

**Why:** Swiper coverflow + 手势在小程序端还原风险高（最大单项工作量），用户宁可先交付可用版本，滑动作为独立后续迭代。

## 二、技术栈

- uni-app Vue3 版本（`uni-preset-vue#vite-ts` 模板）
- Pinia 状态管理（uni-app 官方支持）
- Vue Router 替换为 uni-app 路由（`pages.json` + `uni.navigateTo`）
- Tailwind CSS **不迁移**——小程序端用原生 WXSS，H5 端用 scoped CSS 统一（双端样式差异通过条件编译处理）
- 测试：Vitest（纯 TS 逻辑）+ uni-app 组件测试（`@dcloudio/uni-app` 的 testing 方案）+ 小程序 E2E（miniprogram-simulate 或真机云测）
- PWA（VitePWA）**仅 H5 端保留**，小程序端天然具备「添加到桌面/离线」能力

## 三、目录结构

```
（uni-app 项目根）
├── src/
│   ├── pages/               # 页面（由原 views/ 迁移）
│   │   ├── home/index.vue
│   │   ├── quiz/setup.vue / play.vue / result.vue
│   │   ├── recitation/setup.vue / play.vue / result.vue
│   │   ├── wrong-book/index.vue
│   │   ├── progress/index.vue
│   │   ├── settings/index.vue
│   │   ├── poem-collection/index.vue
│   │   ├── poem-config/index.vue
│   │   ├── poem-card/index.vue      # 去滑动版
│   │   ├── review-plan/index.vue
│   │   └── poem-detail/index.vue
│   ├── components/          # 迁移原 components/
│   │   ├── PoemPopup.vue
│   │   ├── RecitationCard.vue
│   │   ├── MysteryBox.vue
│   │   ├── NextLineQuiz.vue
│   │   ├── FillBlankQuiz.vue
│   │   └── PoemCard.vue
│   ├── stores/              # 原样迁移（Pinia）
│   │   ├── poem.ts
│   │   ├── learning.ts
│   │   └── quiz.ts
│   ├── utils/               # 纯 TS 逻辑原样迁移
│   │   ├── ebbinghaus.ts / retention.ts / quiz.ts
│   │   ├── distractor.ts / charMark.ts / unproficient.ts
│   │   ├── search.ts / storage.ts（改 wx.storage）
│   │   └── swipe.ts / CardSwiper.vue 不迁移（去滑动）
│   ├── types/index.ts       # 原样迁移
│   ├── static/              # poems.json、characters.json（由 public/ 迁入）
│   ├── pages.json           # 路由配置（替换 vue-router）
│   ├── manifest.json        # 应用配置（H5 + 小程序）
│   └── App.vue
└── tests/
    ├── unit/                # 纯 TS 单测（直接复用原 tests/unit）
    └── component/           # 组件测试（重建）
```

## 四、迁移分块

### 4.1 原样迁移（零改动或近乎零改动）

- `src/types/index.ts` —— 全部类型
- `src/utils/` 纯 TS 逻辑：`ebbinghaus`、`retention`、`quiz`、`distractor`、`charMark`、`unproficient`、`search`（约 1000 行）
- `src/stores/` 三个 Pinia store
- `public/poems.json`（200 首）、`characters.json` → `src/static/`（uni-app 静态资源打包）
- 对应纯 TS 单测（tests/unit）

### 4.2 适配层改造

| 原实现 | uni-app 替代 | 说明 |
|--------|-------------|------|
| `localStorage`（`src/utils/storage.ts`） | `uni.getStorageSync` / `uni.setStorageSync` | 封装 storage adapter，保持 `loadData/saveData/importData` 接口不变 |
| `fetch('/poems.json')`（`poem.ts`） | 直接 `import poems from '@/static/poems.json'` | 打包内联，无网络请求 |
| vue-router（`router/index.ts`） | `pages.json` + `uni.navigateTo` | 14 个路由重配；restorable 路由（quiz-play、recitation-play）用 storage 保存/恢复 |
| Tailwind class | 原生 WXSS + scoped CSS | 14 个页面样式重写；`h-dvh` 等特殊值条件编译处理 |
| `import.meta.env` / `__GIT_HASH__` | uni-app 条件编译 `#ifdef H5` | 版本信息仅 H5 展示 |

### 4.3 删除（去滑动）

- `src/components/CardSwiper.vue` —— 整文件删除，不进 uni-app
- `src/utils/swipe.ts` —— 删除（上滑缩回手势不再需要）
- `PoemCardPage.vue` 中的 Swiper/滑动相关逻辑

**替代交互（PoemCardPage 去滑动版）：**
- 浏览模式：改为列表（每首诗的标题/作者/年级列表项），点击进入背诵
- 背诵模式：全屏 RecitationCard + 底部「上一首/下一首」按钮 + 进度条
- 盲盒模式：保留 MysteryBox，点击已开盒进入背诵
- `viewMode: 'swiper' | 'recite' | 'mystery'` 中的 `swiper` 语义变为「列表浏览」，状态模型保留

### 4.4 重建

- 组件测试：原 `tests/component/`（基于 @vue/test-utils）作废，用 uni-app 测试方案重建
- E2E：原 Playwright 作废，小程序端用 miniprogram-simulate / 真机云测，H5 端可保留 Playwright
- 语音：不做

## 五、数据流

数据流与现状一致（Pinia store 层驱动），唯一变化是存储层从 `localStorage` 换成 `uni.storage`（接口不变），数据源从 `fetch` 换成静态 import。**现有用户数据（localStorage JSON）无法自动同步到小程序**，保留导出/导入 JSON 功能作为数据迁移通道。

## 六、错误处理

- 存储层：`uni.getStorageSync` 失败时返回默认数据（与现状 `loadData` 的 try/catch 语义一致）
- 数据 import：沿用现有 `importData` 校验逻辑（JSON schema 校验）
- 双端差异：H5 端 PWA 自动更新，小程序端走微信审核版本发布

## 七、测试策略

1. **纯 TS 单测**（复用）：ebbinghaus / retention / quiz / distractor / charMark / storage 等原 tests/unit 直接搬入，改用 Vitest 跑
2. **组件测试**（重建）：RecitationCard / MysteryBox / FillBlankQuiz / NextLineQuiz / PoemPopup 等，用 uni-app testing 方案
3. **E2E**（重建）：H5 端保留 Playwright 关键流程（quiz-flow、recitation-flow、wrongbook）；小程序端用 miniprogram-simulate 覆盖核心流程
4. **人工回归**：H5 浏览器预览 + 微信开发者工具真机预览

## 八、工作量与风险

- 总工作量（去滑动后）：约 1-1.5 周（单人熟练开发者）
  - 纯 TS 逻辑 + 数据迁移：0.5-1 天
  - 视图层 + 样式重写：2-3 天
  - 存储适配 + 路由 + 版本信息：1 天
  - 组件测试重建 + E2E：2-3 天
  - 微信审核 + 真机调试：1-2 天

**主要风险：**

1. **双端样式差异**：Tailwind 特性（`h-dvh`、`max-w-md`）在 WXSS 不完全支持，需要条件编译或手写兼容。中风险。
2. **组件测试工具链**：uni-app 测试方案相对 Vue 生态不成熟，重建成本可能超预期。中风险。
3. **小程序包体**：主包 2MB 限制，poems(133KB) + characters(74KB) + 代码，当前规模没问题；后续加语音/素材需分包。低风险。
4. **微信审核**：教育类目资质、审核周期 1-7 天。低风险但需提前准备。
5. **数据迁移**：现有 localStorage 数据需手动导出/导入到小程序。低风险。

## 九、后续（单独分支）

- 滑动功能（CardSwiper coverflow）——独立分支探索，用小程序原生 swiper 或自定义组件，不影响主体交付
- 语音背诵（微信录音 API）——另行规划

## 十、验收标准

1. H5 端可运行全部现有功能（除滑动、语音），行为与现 Web 版一致
2. 微信小程序端可通过微信开发者工具编译运行
3. 纯 TS 单测全部通过；组件测试重建并通过；E2E 覆盖核心流程
4. 现有用户数据可导出/导入迁移
5. 无 Swiper / swipe 相关代码残留
