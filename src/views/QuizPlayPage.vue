<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'

const router = useRouter()
const quizStore = useQuizStore()

const answered = ref(false)
const selectedIndex = ref(-1)

const progress = computed(() => {
  if (!quizStore.session) return 0
  return ((quizStore.currentIndex) / quizStore.totalQuestions) * 100
})

const isCorrect = computed(() => {
  if (!quizStore.session || selectedIndex.value < 0) return false
  return selectedIndex.value === quizStore.currentQuestion?.correctIndex
})

function selectAnswer(index: number) {
  if (answered.value) return
  selectedIndex.value = index
  answered.value = true
}

function nextQuestion() {
  if (!quizStore.currentQuestion) return
  quizStore.answerQuestion(selectedIndex.value)
  answered.value = false
  selectedIndex.value = -1

  if (quizStore.isFinished) {
    router.push({ name: 'quiz-result' })
  }
}

function quitQuiz() {
  quizStore.resetSession()
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="quiz-play-page">
    <div v-if="quizStore.currentQuestion" class="quiz-content">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <div class="progress-text">
        {{ quizStore.currentIndex + 1 }} / {{ quizStore.totalQuestions }}
      </div>

      <div class="question-prompt">
        <pre>{{ quizStore.currentQuestion.prompt }}</pre>
      </div>

      <div class="options">
        <button
          v-for="(opt, i) in quizStore.currentQuestion.options"
          :key="i"
          :class="['option-btn', {
            selected: selectedIndex === i,
            correct: answered && i === quizStore.currentQuestion?.correctIndex,
            wrong: answered && selectedIndex === i && i !== quizStore.currentQuestion?.correctIndex,
          }]"
          :disabled="answered"
          @click="selectAnswer(i)"
        >
          {{ opt }}
        </button>
      </div>

      <div v-if="answered" class="feedback">
        <p v-if="isCorrect" class="correct-text">回答正确！</p>
        <p v-else class="wrong-text">回答错误</p>
        <button class="next-btn" @click="nextQuestion">
          {{ quizStore.currentIndex + 1 < quizStore.totalQuestions ? '下一题' : '查看结果' }}
        </button>
      </div>
    </div>

    <div v-else class="no-question">
      <p>没有题目</p>
      <button @click="quitQuiz">返回首页</button>
    </div>

    <button class="quit-btn" @click="quitQuiz">退出</button>
  </div>
</template>

<style scoped>
.quiz-play-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 16px;
}

.progress-bar {
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: #1976d2;
  transition: width 0.3s;
}

.progress-text {
  text-align: center;
  font-size: 14px;
  color: #666;
  margin-bottom: 16px;
}

.question-prompt {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  font-size: 18px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.question-prompt pre {
  margin: 0;
  font-family: inherit;
  white-space: pre-wrap;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.option-btn {
  padding: 12px 16px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background: #fff;
  font-size: 16px;
  text-align: left;
  cursor: pointer;
}

.option-btn.selected {
  border-color: #1976d2;
  background: #e3f2fd;
}

.option-btn.correct {
  border-color: #388e3c;
  background: #e8f5e9;
  color: #2e7d32;
}

.option-btn.wrong {
  border-color: #d32f2f;
  background: #ffebee;
  color: #c62828;
}

.option-btn:disabled {
  cursor: default;
}

.feedback {
  text-align: center;
  margin-bottom: 16px;
}

.correct-text {
  color: #2e7d32;
  font-size: 18px;
  font-weight: bold;
}

.wrong-text {
  color: #c62828;
  font-size: 18px;
  font-weight: bold;
}

.next-btn {
  margin-top: 12px;
  padding: 10px 32px;
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

.quit-btn {
  position: fixed;
  bottom: 16px;
  right: 16px;
  padding: 8px 16px;
  background: #fff;
  color: #666;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.no-question {
  text-align: center;
  padding: 48px;
}
</style>
