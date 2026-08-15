# 抽查结果页改进 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改进抽查结果页展示题目信息，并让答题完成后自动跳转结果页

**Architecture:** 修改两个 Vue 组件：QuizResultPage 增加题目文本和用户选择展示，QuizPlayPage 去除中间页面并自动跳转

**Tech Stack:** Vue 3, TypeScript, Tailwind CSS

---

### Task 1: 结果页展示题目文本+你的选择+正确答案

**Files:**
- Modify: `src/views/QuizResultPage.vue`

- [ ] **Step 1: 修改 QuizResultPage.vue 模板，为每道题增加 prompt 和用户选择展示**

将 `<div v-for="item in answers">` 的卡片内容从：

```html
<div class="flex items-center gap-2">
  <span class="font-bold">{{ item.index }}.</span>
  <span class="flex-1 text-sm">{{ item.poemTitle }}</span>
  <span :class="['text-lg font-bold', item.isCorrect ? 'text-green-600' : 'text-red-500']">
    {{ item.isCorrect ? '✓' : '✗' }}
  </span>
</div>
<div v-if="!item.isCorrect" class="mt-2 text-xs text-gray-500">
  <p>你的答案：{{ item.selected }}</p>
  <p>正确答案：{{ item.correct }}</p>
</div>
```

改为：

```html
<div class="flex items-center gap-2">
  <span class="font-bold">{{ item.index }}.</span>
  <span class="flex-1 text-sm">{{ item.poemTitle }}</span>
  <span :class="['text-lg font-bold', item.isCorrect ? 'text-green-600' : 'text-red-500']">
    {{ item.isCorrect ? '✓' : '✗' }}
  </span>
</div>
<p class="text-sm text-gray-600 mt-1">{{ item.prompt }}</p>
<div class="mt-1 text-xs">
  <p :class="item.isCorrect ? 'text-green-600' : 'text-red-500'">你的答案：{{ item.selected }}</p>
  <p v-if="!item.isCorrect" class="text-green-600">正确答案：{{ item.correct }}</p>
</div>
```

- [ ] **Step 2: 验证结果页展示**

Run: `npx vite build`
Expected: 构建成功，无编译错误

- [ ] **Step 3: 提交**

```bash
git add src/views/QuizResultPage.vue
git commit -m "feat: show prompt and user answer on result page for all questions"
```

---

### Task 2: 答完最后一题直接显示结果

**Files:**
- Modify: `src/views/QuizPlayPage.vue`

- [ ] **Step 1: 修改 QuizPlayPage.vue，删除中间页面并自动跳转**

模板部分：删除 `isFinished` 时的"答题完成"中间页面（第24-27行），仅保留"没有题目"和"未开始答题"的分支。

将模板从：

```html
<div v-if="quizStore.currentQuestion && !quizStore.isFinished">
  ...
</div>
<div v-else-if="quizStore.isFinished && quizStore.totalQuestions > 0">
  <p>答题完成！</p>
  <button @click="$router.push({ name: 'quiz-result' })">查看结果</button>
</div>
<div v-else-if="quizStore.isFinished && quizStore.totalQuestions === 0">
  ...
</div>
```

改为：

```html
<div v-if="quizStore.currentQuestion && !quizStore.isFinished">
  ...
</div>
<div v-else-if="quizStore.isFinished && quizStore.totalQuestions === 0">
  ...
</div>
```

脚本部分：在 `selectAnswer` 函数中，1.5秒反馈结束后检查是否答完，自动跳转结果页。

将 `selectAnswer` 从：

```typescript
function selectAnswer(index: number) {
  lastCorrect.value = index === quizStore.currentQuestion?.correctIndex
  quizStore.answerQuestion(index)
  showFeedback.value = true
  setTimeout(() => { showFeedback.value = false }, 1500)
}
```

改为：

```typescript
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import FillBlankQuiz from '@/components/FillBlankQuiz.vue'
import NextLineQuiz from '@/components/NextLineQuiz.vue'

const router = useRouter()
const quizStore = useQuizStore()
const showFeedback = ref(false)
const lastCorrect = ref(false)

// ... (progressPercent, correctAnswerText unchanged)

function selectAnswer(index: number) {
  lastCorrect.value = index === quizStore.currentQuestion?.correctIndex
  quizStore.answerQuestion(index)
  showFeedback.value = true
  setTimeout(() => {
    showFeedback.value = false
    if (quizStore.isFinished) {
      router.push({ name: 'quiz-result' })
    }
  }, 1500)
}
```

- [ ] **Step 2: 验证构建**

Run: `npx vite build`
Expected: 构建成功

- [ ] **Step 3: 提交**

```bash
git add src/views/QuizPlayPage.vue
git commit -m "feat: auto-navigate to result page after last question"
```
