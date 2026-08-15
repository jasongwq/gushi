<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import { usePoemStore } from '@/stores/poem'

const router = useRouter()
const quizStore = useQuizStore()
const poemStore = usePoemStore()

const score = computed(() => {
  if (!quizStore.session) return 0
  return Math.round((quizStore.correctCount / quizStore.totalQuestions) * 100)
})

const answers = computed(() => {
  if (!quizStore.session) return []
  return quizStore.session.answers.map((a, i) => {
    const question = quizStore.session!.questions[a.questionIndex]
    const poem = poemStore.getPoemById(question.poemId)
    return {
      index: i + 1,
      poemTitle: poem?.title ?? '',
      prompt: question.prompt,
      selected: question.options[a.selectedIndex],
      correct: question.options[question.correctIndex],
      isCorrect: a.correct,
    }
  })
})

function goHome() {
  quizStore.resetSession()
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="quiz-result-page">
    <h2>抽查结果</h2>

    <div class="score-display">
      <span class="score-number">{{ score }}</span>
      <span class="score-unit">分</span>
    </div>

    <div class="score-detail">
      {{ quizStore.correctCount }} / {{ quizStore.totalQuestions }} 正确
    </div>

    <div class="answer-list">
      <div v-for="item in answers" :key="item.index" :class="['answer-item', item.isCorrect ? 'correct' : 'wrong']">
        <div class="answer-header">
          <span class="answer-index">{{ item.index }}.</span>
          <span class="answer-poem">{{ item.poemTitle }}</span>
          <span :class="['answer-marker', item.isCorrect ? 'marker-correct' : 'marker-wrong']">
            {{ item.isCorrect ? '✓' : '✗' }}
          </span>
        </div>
        <div v-if="!item.isCorrect" class="answer-detail">
          <p>你的答案：{{ item.selected }}</p>
          <p>正确答案：{{ item.correct }}</p>
        </div>
      </div>
    </div>

    <button class="home-btn" @click="goHome">返回首页</button>
  </div>
</template>

<style scoped>
.quiz-result-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px 16px;
}

h2 {
  text-align: center;
  margin-bottom: 16px;
}

.score-display {
  text-align: center;
  margin-bottom: 8px;
}

.score-number {
  font-size: 48px;
  font-weight: bold;
  color: #1976d2;
}

.score-unit {
  font-size: 18px;
  color: #666;
}

.score-detail {
  text-align: center;
  font-size: 14px;
  color: #666;
  margin-bottom: 24px;
}

.answer-list {
  margin-bottom: 24px;
}

.answer-item {
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  border-left: 4px solid;
}

.answer-item.correct {
  background: #e8f5e9;
  border-left-color: #388e3c;
}

.answer-item.wrong {
  background: #ffebee;
  border-left-color: #d32f2f;
}

.answer-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.answer-index {
  font-weight: bold;
}

.answer-poem {
  flex: 1;
  font-size: 14px;
}

.answer-marker {
  font-size: 18px;
  font-weight: bold;
}

.marker-correct {
  color: #388e3c;
}

.marker-wrong {
  color: #d32f2f;
}

.answer-detail {
  margin-top: 8px;
  font-size: 13px;
  color: #666;
}

.answer-detail p {
  margin: 2px 0;
}

.home-btn {
  width: 100%;
  padding: 14px;
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
}
</style>
