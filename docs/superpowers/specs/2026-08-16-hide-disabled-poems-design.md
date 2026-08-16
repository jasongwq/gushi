# 未启用古诗全面隐藏

## 背景

在设置中取消选择（disable）的古诗，目前在古诗集合页面和其他地方仍然可见/可交互。用户期望：未启用的古诗在所有场景下都不应该出现。

## 设计

### 核心改动：poemStore 计算属性

将 `grades`、`poemsByGrade`、`poemsByAuthor`、`authors` 改为基于 `enabledPoems` 计算，而非 `poems`。

- `grades` → 从 `enabledPoems` 提取年级
- `poemsByGrade` → 从 `enabledPoems` 按年级分组
- `poemsByAuthor` → 从 `enabledPoems` 按诗人分组
- `authors` → 从 `enabledPoems` 提取诗人

新增 `allGrades` 计算属性：从全量 `poems` 提取年级，供 PoemConfigPage 使用。

`toggleGrade()` 内部改为直接从 `poems` 过滤获取某年级古诗 ID，不再依赖 `poemsByGrade`。

### 页面改动

| 页面 | 改动 |
|------|------|
| PoemConfigPage | 使用 `poems` + `allGrades` 代替 `poemStore.grades` + `poemsByGrade`，手动按年级分组 |
| PoemCollectionPage | 无需改动（搜索已用 `enabledPoems`，分类改用改造后的 `poemsByGrade`/`poemsByAuthor`） |
| HomePage | `poemStore.poems.length` → `poemStore.enabledPoems.length` |
| WrongBookPage | 过滤 `wrongBook`，只显示已启用古诗的条目 |
| PoemCardPage | 年级选择器使用改造后的 `poemStore.grades`，自动只显示有启用古诗的年级 |

### 不需要改动的

- 抽查选诗逻辑（已基于 `enabledPoems`）
- ProgressPage（已基于 `enabledPoems`）
- 遗忘曲线/学习记录逻辑（数据层不变，只是不展示未启用的）
