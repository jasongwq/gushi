# 古诗详情页拼音显示设计

日期：2026-08-22

## 背景

古诗详情页（`src/views/PoemDetailPage.vue`）当前只显示逐行纯文本原文（L190）。拼音数据已存在于 `public/poems.json`（200/200 首均有 `pinyin` 字段，与 `text` 逐字对应），但前端从未使用。目标是在详情页每个字上方显示拼音。

## 需求

1. 拼音默认显示，显示在每个字的上方（标准注音样式）
2. 提供"显示拼音/隐藏拼音"切换开关
3. 偏好持久化（localStorage），下次打开保持上次选择

## 方案

### 数据模型

`src/types/index.ts` 的 `UserSettings` 新增字段：

```ts
showPinyin?: boolean  // 拼音显示开关，默认 true
```

持久化复用现有 `learningStore.updateSettings()` 机制（已写入 localStorage），无需改动存储层。

### 渲染

`PoemDetailPage.vue` 原文卡片改造：

1. **按行切分拼音**：`poem.pinyin` 是展平数组（含标点，标点 pinyin 为空串），与 `poem.text.join('')` 逐字对应。新增 computed `pinyinByLine`，按 `text` 每行长度切分，得到 `string[][]`（每行每字的拼音，标点处为空串）。

2. **逐字 ruby 渲染**：原文每行由 `<p>` 改为逐字渲染：

```html
<p v-for="(line, i) in poem.text" :key="i" class="text-lg text-center leading-relaxed">
  <ruby v-for="(char, j) in line" :key="j">
    <rt v-if="showPinyin && pinyinByLine[i]?.[j]">{{ pinyinByLine[i][j] }}</rt>
    {{ char }}
  </ruby>
</p>
```

用 `<ruby><rt>` 实现字上注音。隐藏拼音时每个字退化为纯文本显示。

3. **开关按钮**：原文卡片头部（现译文按钮旁）加"隐藏拼音 ▴ / 显示拼音 ▾"按钮，复用 `showYiwen` 的按钮样式模式。

### 状态与持久化

```ts
const showPinyin = ref(learningStore.settings.showPinyin ?? true)

function togglePinyin() {
  showPinyin.value = !showPinyin.value
  learningStore.updateSettings({ showPinyin: showPinyin.value })
}
```

### 兼容性

- `poem.pinyin` 是可选字段（旧数据可能缺失）：切分逻辑在 `pinyin` 不存在时返回空数组，ruby 渲染自然回退为纯文本。
- 若某首诗 pinyin 长度与 text 不匹配（数据异常），切分按实际边界截断，不抛错。

## 测试

- 单元测试：`pinyinByLine` 切分逻辑（正常行、含标点、pinyin 缺失、长度不匹配）
- 详情页切换开关后拼音显示/隐藏、偏好持久化

## 不做的事

- 不改其他页面（列表、答题、背诵）的拼音显示
- 不引入 npm 拼音依赖（数据已就绪）
- 不新增配置项控制拼音显隐（固定默认显示）
