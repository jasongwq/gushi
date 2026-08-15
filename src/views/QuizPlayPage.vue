<template>
  <div class="quiz-play">
    <div v-if="(quizStore.currentQuestion && !quizStore.isFinished) || showFeedback">
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
        v-else
        :question="quizStore.currentQuestion"
        @answer="selectAnswer"
      />

      <div v-if="showFeedback" class="feedback" :class="lastCorrect ? 'correct' : 'wrong'">
        {{ lastCorrect ? '正确！' : '错误，正确答案是：' + correctAnswerText }}
      </div>
    </div>
    <div v-else-if="quizStore.isFinished && quizStore.totalQuestions === 0">
      <p>没有题目</p>
      <button @click="$router.push({ name: 'home' })">返回首页</button>
    </div>
    <div v-else>
      <p>未开始答题</p>
      <button @click="$router.push({ name: 'home' })">返回首页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import FillBlankQuiz from '@/components/FillBlankQuiz.vue'
import NextLineQuiz from '@/components/NextLineQuiz.vue'

const quizStore = useQuizStore()
const router = useRouter()
const showFeedback = ref(false)
const lastCorrect = ref(false)

const progressPercent = computed(() =>
  quizStore.totalQuestions > 0
    ? ((quizStore.currentIndex) / quizStore.totalQuestions) * 100
    : 0
)

const correctAnswerText = computed(() => {
  const q = quizStore.session?.questions[quizStore.currentIndex - 1]
  return q ? q.options[q.correctIndex] : ''
})

let feedbackTimer: ReturnType<typeof setTimeout> | null = null

function selectAnswer(index: number) {
  lastCorrect.value = index === quizStore.currentQuestion?.correctIndex
  quizStore.answerQuestion(index)
  showFeedback.value = true
  feedbackTimer = setTimeout(() => {
    showFeedback.value = false
    if (quizStore.isFinished) {
      router.push({ name: 'quiz-result' })
    }
  }, 1500)
}

onUnmounted(() => { if (feedbackTimer) clearTimeout(feedbackTimer) })
</script>

<style scoped>
.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}
.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s;
}
.feedback.correct {
  color: var(--color-success);
  font-weight: bold;
  margin-top: 16px;
}
.feedback.wrong {
  color: var(--color-danger);
  font-weight: bold;
  margin-top: 16px;
}
</style>
