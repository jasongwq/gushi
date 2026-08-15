<template>
  <div class="quiz-play">
    <div v-if="quizStore.currentQuestion && !quizStore.isFinished">
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
        v-else-if="quizStore.currentQuestion.quizType === 'nextLine'"
        :question="quizStore.currentQuestion"
        @answer="selectAnswer"
      />
      <SelectTitleQuiz
        v-else-if="quizStore.currentQuestion.quizType === 'selectTitle'"
        :question="quizStore.currentQuestion"
        @answer="selectAnswer"
      />

      <div v-if="showFeedback" class="feedback" :class="lastCorrect ? 'correct' : 'wrong'">
        {{ lastCorrect ? '正确！' : '错误，正确答案是：' + correctAnswerText }}
      </div>
    </div>
    <div v-else-if="quizStore.isFinished">
      <p>答题完成！</p>
      <button @click="$router.push({ name: 'quiz-result' })">查看结果</button>
    </div>
    <div v-else>
      <p>未开始答题</p>
      <button @click="$router.push({ name: 'home' })">返回首页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuizStore } from '@/stores/quiz'
import FillBlankQuiz from '@/components/FillBlankQuiz.vue'
import NextLineQuiz from '@/components/NextLineQuiz.vue'
import SelectTitleQuiz from '@/components/SelectTitleQuiz.vue'

const quizStore = useQuizStore()
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

function selectAnswer(index: number) {
  lastCorrect.value = index === quizStore.currentQuestion?.correctIndex
  quizStore.answerQuestion(index)
  showFeedback.value = true
  setTimeout(() => { showFeedback.value = false }, 1500)
}
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
