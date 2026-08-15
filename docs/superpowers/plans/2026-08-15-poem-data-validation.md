# 古诗数据校验与补充 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 编写 Python 脚本从网络检索 200 首古诗正文，深度校验后生成 `poems.json`，并更新前端适配新数据格式。

**Architecture:** 两阶段 Python 脚本（抓取+缓存 → 校验+生成），前端移除 `unit` 相关代码，统一年级格式。

**Tech Stack:** Python 3 (requests, json, re), TypeScript, Vue 3

---

### Task 1: 创建 200 首诗元数据文件

**Files:**
- Create: `scripts/poem_meta.py`

- [ ] **Step 1: 创建 `scripts/` 目录并编写元数据文件**

将用户提供的 200 首诗列表编码为 Python 数据结构，包含 `seq`（序号）、`title`（题目）、`grade`（年级）、`author_raw`（原始作者字符串，如"唐·李白"）。

```python
# scripts/poem_meta.py
POEMS = [
    {"seq": 1, "title": "咏鹅", "grade": "一年级", "author_raw": "唐·骆宾王"},
    {"seq": 2, "title": "江南", "grade": "一年级", "author_raw": "汉乐府"},
    # ... 全部 200 首
]
```

- [ ] **Step 2: 验证数据完整性**

Run: `python3 -c "from scripts.poem_meta import POEMS; print(f'Total: {len(POEMS)}'); print('Grades:', sorted(set(p['grade'] for p in POEMS)))"`
Expected: `Total: 200`, Grades 包含 一年级~六年级+配读篇目

---

### Task 2: 编写作者/朝代拆分逻辑

**Files:**
- Create: `scripts/fetch_poems.py` (主脚本框架)

- [ ] **Step 1: 编写 `parse_author` 函数**

```python
def parse_author(author_raw: str) -> tuple[str, str]:
    """解析 '唐·李白' -> ('李白', '唐'), '汉乐府' -> ('汉乐府', '汉')"""
    if '·' in author_raw:
        parts = author_raw.split('·', 1)
        dynasty = parts[0]
        author = parts[1]
        return author, dynasty
    # 特殊作者
    special = {
        '汉乐府': ('汉乐府', '汉'),
        '北朝民歌': ('北朝民歌', '北朝'),
        '《诗经》': ('《诗经》', '先秦'),
        '《古诗十九首》': ('《古诗十九首》', '汉'),
    }
    if author_raw in special:
        return special[author_raw]
    # 《xxx》格式
    if author_raw.startswith('《'):
        return author_raw, ''
    # 毛泽东
    if author_raw == '毛泽东':
        return '毛泽东', '现代'
    return author_raw, ''
```

- [ ] **Step 2: 测试拆分逻辑**

Run: `python3 -c "from scripts.fetch_poems import parse_author; print(parse_author('唐·李白')); print(parse_author('汉乐府')); print(parse_author('《韩非子·五蠹》')); print(parse_author('毛泽东'))"`
Expected: `('李白', '唐')` / `('汉乐府', '汉')` / `('《韩非子·五蠹》', '')` / `('毛泽东', '现代')`

---

### Task 3: 编写网络抓取逻辑（阶段一）

**Files:**
- Modify: `scripts/fetch_poems.py`

- [ ] **Step 1: 编写古诗文网抓取函数**

```python
import requests
import json
import os
import re
import time

CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', '.cache')

def fetch_from_gushiwen(title: str, author: str) -> dict | None:
    """从古诗文网检索古诗内容"""
    try:
        # 古诗文网搜索
        search_url = f"https://so.gushiwen.cn/search.aspx?value={title}&valuej={author}"
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        resp = requests.get(search_url, headers=headers, timeout=15)
        resp.encoding = 'utf-8'
        # 解析搜索结果页，找到匹配的诗链接
        # 提取正文内容
        ...
    except Exception as e:
        return None
```

- [ ] **Step 2: 编写缓存读写逻辑**

```python
def get_cache_path(seq: int) -> str:
    return os.path.join(CACHE_DIR, f'p{seq:03d}.json')

def load_cache(seq: int) -> dict | None:
    path = get_cache_path(seq)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

def save_cache(seq: int, data: dict) -> None:
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = get_cache_path(seq)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
```

- [ ] **Step 3: 编写主抓取循环**

```python
def fetch_all():
    errors = []
    for poem in POEMS:
        seq = poem['seq']
        cached = load_cache(seq)
        if cached:
            print(f"[{seq:03d}] 缓存命中: {poem['title']}")
            continue
        author, dynasty = parse_author(poem['author_raw'])
        result = fetch_from_gushiwen(poem['title'], author)
        if result:
            save_cache(seq, {**poem, 'author': author, 'dynasty': dynasty, 'text': result['text'], 'source': result.get('source', '')})
            print(f"[{seq:03d}] 抓取成功: {poem['title']}")
        else:
            errors.append({'seq': seq, 'title': poem['title'], 'error': 'fetch_failed'})
            print(f"[{seq:03d}] 抓取失败: {poem['title']}")
        time.sleep(1)  # 请求间隔
    if errors:
        with open(os.path.join(CACHE_DIR, 'errors.json'), 'w', encoding='utf-8') as f:
            json.dump(errors, f, ensure_ascii=False, indent=2)
    print(f"\n完成: {len(POEMS) - len(errors)}/{len(POEMS)}, 失败: {len(errors)}")
```

- [ ] **Step 4: 运行抓取**

Run: `cd /root/古诗抽查 && python3 -m scripts.fetch_poems --fetch`
Expected: 缓存文件写入 `.cache/p001.json` ~ `.cache/p200.json`

---

### Task 4: 编写深度校验逻辑（阶段二）

**Files:**
- Modify: `scripts/fetch_poems.py`

- [ ] **Step 1: 编写校验函数**

```python
def validate_poem(poem: dict) -> list[dict]:
    """深度校验单首诗，返回问题列表"""
    issues = []
    # 1. 字段完整性
    for field in ['id', 'title', 'author', 'dynasty', 'grade', 'text', 'textType']:
        if not poem.get(field):
            if field == 'dynasty' and poem.get('author', '').startswith('《'):
                continue  # 古籍类无朝代
            issues.append({'level': 'FAIL', 'rule': '字段完整性', 'detail': f'{field} 为空'})
    # 2. 内容非空
    text = poem.get('text', [])
    if len(text) < 2:
        issues.append({'level': 'FAIL', 'rule': '内容非空', 'detail': f'text 仅 {len(text)} 行'})
    # 3. 标点规范
    for i, line in enumerate(text):
        if line and line[-1] not in '，。？！、；：""\'\'）':
            issues.append({'level': 'WARN', 'rule': '标点规范', 'detail': f'第{i+1}行末尾无标点: {line}'})
    # 4. 字数与 textType 一致
    text_type = poem.get('textType', '')
    if text_type in ('五言', '七言'):
        expected = 5 if text_type == '五言' else 7
        for i, line in enumerate(text):
            chars = re.sub(r'[，。？！、；：""\'\'（）\s]', '', line)
            if len(chars) != expected:
                issues.append({'level': 'WARN', 'rule': '字数与textType不一致', 'detail': f'第{i+1}行 {len(chars)}字 (期望{expected}): {line}'})
    # 5. 重复检查（在 validate_all 中处理）
    return issues
```

- [ ] **Step 2: 编写批量校验和生成函数**

```python
def validate_all():
    all_poems = []
    all_issues = []
    for poem in POEMS:
        seq = poem['seq']
        cached = load_cache(seq)
        if not cached:
            all_issues.append({'seq': seq, 'title': poem['title'], 'issues': [{'level': 'FAIL', 'rule': '缓存缺失', 'detail': ''}]})
            continue
        # 构建完整 poem 对象
        author, dynasty = parse_author(poem['author_raw'])
        text_type = cached.get('textType', determine_text_type(cached.get('text', [])))
        full_poem = {
            'id': f'p{seq:03d}',
            'title': poem['title'],
            'author': author,
            'dynasty': dynasty,
            'grade': poem['grade'],
            'unit': '',
            'text': cached.get('text', []),
            'textType': text_type,
        }
        issues = validate_poem(full_poem)
        if issues:
            all_issues.append({'seq': seq, 'title': poem['title'], 'issues': issues})
        all_poems.append(full_poem)
    # 重复检查
    seen = {}
    for p in all_poems:
        key = f"{p['title']}|{p['author']}"
        if key in seen:
            all_issues.append({'seq': p['id'], 'title': p['title'], 'issues': [{'level': 'FAIL', 'rule': '重复', 'detail': f'与 {seen[key]} 重复'}]})
        seen[key] = p['id']
    # 输出报告
    ...
    return all_poems, all_issues
```

- [ ] **Step 3: 编写 textType 自动推断函数**

```python
def determine_text_type(text: list[str]) -> str:
    if not text:
        return '其他'
    # 检查所有行字数
    char_counts = []
    for line in text:
        chars = re.sub(r'[，。？！、；：""\'\'（）\s]', '', line)
        char_counts.append(len(chars))
    non_zero = [c for c in char_counts if c > 0]
    if not non_zero:
        return '其他'
    if all(c == 5 for c in non_zero):
        return '五言'
    if all(c == 7 for c in non_zero):
        return '七言'
    return '其他'
```

- [ ] **Step 4: 编写 poems.json 生成函数**

```python
def generate_poems_json():
    all_poems, issues = validate_all()
    output_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'poems.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_poems, f, ensure_ascii=False, indent=2)
    print(f"\n生成 public/poems.json: {len(all_poems)} 首")
    return all_poems, issues
```

---

### Task 5: 运行抓取+校验+生成完整流程

**Files:**
- Modify: `scripts/fetch_poems.py` (添加 CLI 入口)
- Modify: `.gitignore` (添加 `.cache/`)

- [ ] **Step 1: 添加 CLI 入口**

```python
if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: python -m scripts.fetch_poems [--fetch|--validate|--generate]")
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == '--fetch':
        fetch_all()
    elif cmd == '--validate':
        validate_all()
    elif cmd == '--generate':
        generate_poems_json()
```

- [ ] **Step 2: 添加 `.cache/` 到 `.gitignore`**

- [ ] **Step 3: 运行完整流程**

Run: `cd /root/古诗抽查 && python3 -m scripts.fetch_poems --fetch`
Run: `cd /root/古诗抽查 && python3 -m scripts.fetch_poems --generate`

- [ ] **Step 4: 验证生成的 poems.json**

Run: `python3 -c "import json; d=json.load(open('public/poems.json')); print(f'Total: {len(d)}'); print('Grades:', sorted(set(p['grade'] for p in d))); print('IDs:', d[0]['id'], d[-1]['id'])"`
Expected: `Total: 200`, Grades 含 一年级~六年级+配读篇目, IDs: p001 p200

- [ ] **Step 5: 手动修复校验失败的诗（如有）**

检查校验报告，手动修正 `.cache/` 中有问题的缓存文件，重新运行 `--generate`。

---

### Task 6: 更新 TypeScript 类型定义

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 移除 `unit` 字段和 `SourceType` 的 `'unit'`**

```typescript
// 修改前:
export type SourceType = 'smart' | 'grade' | 'unit' | 'all' | 'review' | 'wrong' | 'unproficient'

export interface Poem {
  id: string
  title: string
  author: string
  dynasty: string
  grade: string
  unit: string    // 删除此行
  text: string[]
  textType: TextType
}

// 修改后:
export type SourceType = 'smart' | 'grade' | 'all' | 'review' | 'wrong' | 'unproficient'

export interface Poem {
  id: string
  title: string
  author: string
  dynasty: string
  grade: string
  text: string[]
  textType: TextType
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "refactor: remove unit field from Poem type and SourceType"
```

---

### Task 7: 更新前端代码适配新数据格式

**Files:**
- Modify: `src/utils/quiz.ts` (移除 unit 相关逻辑)
- Modify: `src/stores/quiz.ts` (移除 unit 相关引用)
- Modify: `src/views/QuizSetupPage.vue` (无需改动，无 unit 选项)
- Modify: `src/utils/storage.ts` (添加旧数据迁移)

- [ ] **Step 1: 更新 `src/utils/quiz.ts`**

移除 `SourceOptions` 中的 `unit` 字段和 `getPoemsBySource` 中 `source === 'unit'` 分支：

```typescript
// 删除:
interface SourceOptions {
  grades?: string[]
  unit?: string
}

// 替换为:
interface SourceOptions {
  grades?: string[]
}

// 删除 getPoemsBySource 中的:
if (source === 'unit') return poems.filter(p => p.unit === options?.unit)
```

- [ ] **Step 2: 更新 `src/utils/storage.ts` 添加旧数据迁移**

在 `loadData` 函数中，检测旧版 poemId（以 `b` 开头）并清除：

```typescript
export function loadData(): UserData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultData()
    const parsed = JSON.parse(raw) as Partial<UserData>
    const defaults = getDefaultData()
    const data = {
      records: parsed.records ?? defaults.records,
      quizResults: parsed.quizResults ?? defaults.quizResults,
      wrongBook: parsed.wrongBook ?? defaults.wrongBook,
      settings: { ...defaults.settings, ...parsed.settings },
    }
    // 迁移：检测旧版 poemId（b 开头），清除旧记录
    if (data.records.some(r => r.poemId.startsWith('b')) ||
        data.quizResults.some(r => r.poemId.startsWith('b')) ||
        data.wrongBook.some(w => w.poemId.startsWith('b'))) {
      return getDefaultData()
    }
    return data
  } catch {
    return getDefaultData()
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/quiz.ts src/utils/storage.ts
git commit -m "refactor: remove unit source type, add data migration for new poem IDs"
```

---

### Task 8: 更新测试代码

**Files:**
- Modify: `tests/unit/types.test.ts`
- Modify: `tests/unit/quiz.test.ts`
- Modify: `tests/unit/distractor.test.ts`

- [ ] **Step 1: 更新 `tests/unit/types.test.ts`**

- 移除 `SourceType` 中的 `'unit'`
- 移除 Poem 构造中的 `unit` 字段
- 更新 `enabledGrades` 使用新格式

```typescript
// SourceType 测试:
const types: SourceType[] = ['smart', 'grade', 'all', 'review', 'wrong', 'unproficient']
expect(types).toHaveLength(6)

// Poem 构造:
const poem: Poem = {
  id: '1', title: '静夜思', author: '李白', dynasty: '唐',
  grade: '一年级', text: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'],
  textType: '五言',
}

// UserSettings:
enabledGrades: ['一年级', '二年级'],
```

- [ ] **Step 2: 更新 `tests/unit/quiz.test.ts`**

- `makePoem` 移除 `unit` 字段
- 移除 `filters by unit` 测试
- 更新 `grade` 值为新格式

```typescript
function makePoem(overrides: Partial<Poem> = {}): Poem {
  return {
    id: 'p1', title: '静夜思', author: '李白', dynasty: '唐',
    grade: '一年级', text: ['床前明月光', '疑是地上霜'],
    textType: '五言', ...overrides,
  }
}
```

- [ ] **Step 3: 更新 `tests/unit/distractor.test.ts`**

- 所有 Poem 对象移除 `unit` 字段
- 更新 `grade` 值为新格式（'一年级' 替代 '一年级上'/'一年级下'）

- [ ] **Step 4: 运行所有测试**

Run: `cd /root/古诗抽查 && npx vitest run`
Expected: 所有测试通过

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "test: update tests for new poem data format"
```

---

### Task 9: 最终验证

**Files:**
- 无修改

- [ ] **Step 1: 运行 TypeScript 类型检查**

Run: `cd /root/古诗抽查 && npx vue-tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 2: 运行完整测试套件**

Run: `cd /root/古诗抽查 && npx vitest run`
Expected: 所有测试通过

- [ ] **Step 3: 构建项目**

Run: `cd /root/古诗抽查 && npm run build`
Expected: 构建成功

- [ ] **Step 4: 验证 poems.json 数据质量**

Run: `cd /root/古诗抽查 && python3 -c "import json; d=json.load(open('public/poems.json')); print(f'Total: {len(d)}'); grades=sorted(set(p['grade'] for p in d)); print('Grades:', grades); print('Sample:', json.dumps(d[0], ensure_ascii=False))"`
Expected: 200 首，年级正确，字段完整

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "feat: replace 70 poems with 200 validated poems, update data format"
```
