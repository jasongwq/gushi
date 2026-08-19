<template>
  <div class="quiz-play">
    <div v-if="quizStore.session && quizStore.totalQuestions > 0">
      <!-- Progress dots -->
      <div class="progress-dots" role="group" aria-label="题目进度">
        <button
          v-for="(_, i) in quizStore.session.questions"
          :key="i"
          :class="[
            'dot',
            i === displayIndex ? 'current' : '',
            getAnswerStatus(i) === 'correct' ? 'correct' : '',
            getAnswerStatus(i) === 'wrong' ? 'wrong' : '',
            getAnswerStatus(i) === 'unanswered' ? 'unanswered' : '',
          ]"
          :disabled="!canNavigateTo(i)"
          :aria-label="'第' + (i + 1) + '题' + (getAnswerStatus(i) === 'correct' ? '（正确）' : getAnswerStatus(i) === 'wrong' ? '（错误）' : '')"
          @click="goToQuestion(i)"
        >
          {{ i + 1 }}
        </button>
      </div>

      <!-- Current question area -->
      <template v-if="currentDisplayQuestion">
        <FillBlankQuiz
          v-if="currentDisplayQuestion.quizType === 'fillBlank'"
          :key="'q-' + displayIndex"
          :question="currentDisplayQuestion"
          :selected-option="currentSelectedOption"
          :disabled="isReviewing"
          @answer="selectAnswer"
        />
        <NextLineQuiz
          v-else-if="currentDisplayQuestion.quizType === 'nextLine'"
          :key="'q-' + displayIndex"
          :question="currentDisplayQuestion"
          :selected-option="currentSelectedOption"
          :disabled="isReviewing"
          @answer="selectAnswer"
        />
        <RecitationCard
          v-else-if="currentDisplayQuestion.quizType === 'recite' && currentPoem"
          :key="'q-' + displayIndex"
          :poem="currentPoem"
          reveal-mode
          :reveal-step="isReviewing ? 3 : revealStep"
          :disabled="isReviewing"
          @reveal-step-change="revealStep++"
          @submit="onReciteSubmit"
        />
      </template>
    </div>
    <div v-else-if="quizStore.session && quizStore.totalQuestions === 0">
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
import { ref, computed, onUnmounted, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import FillBlankQuiz from '@/components/FillBlankQuiz.vue'
import NextLineQuiz from '@/components/NextLineQuiz.vue'
import RecitationCard from '@/components/RecitationCard.vue'
import type { RecitationResult } from '@/types'

const quizStore = useQuizStore()
const poemStore = usePoemStore()
const learningStore = useLearningStore()
const router = useRouter()

onMounted(() => poemStore.fetchPoems())

// The index of the question currently displayed
const reviewingIndex = ref<number | null>(null)
const displayIndex = computed(() => reviewingIndex.value ?? quizStore.currentIndex)

const currentDisplayQuestion = computed(() => {
  if (!quizStore.session) return null
  return quizStore.session.questions[displayIndex.value] ?? null
})

const revealStep = ref(0)

// 切换题目时重置揭示状态
watch(displayIndex, () => { revealStep.value = 0 })

const currentPoem = computed(() => {
  if (!currentDisplayQuestion.value) return null
  return poemStore.getPoemById(currentDisplayQuestion.value.poemId) ?? null
})

function onReciteSubmit(result: RecitationResult) {
  if (!quizStore.session || !currentDisplayQuestion.value) return
  // 字级标记统计（与 RecitationPlayPage 一致，仅在有字级标记时记录）
  if (result.charMarks && Object.keys(result.charMarks).length > 0) {
    const poem = poemStore.getPoemById(result.poemId)
    if (poem) {
      learningStore.recordReciteWithCharMarks(result.poemId, result.overallStatus === 'mastered', poem.text, result.charMarks)
    }
  }
  quizStore.submitRecitationResult(result)
  if (quizStore.isFinished) {
    router.push({ name: 'quiz-result' })
  }
}

// Whether we are viewing an already-answered question
const isReviewing = computed(() => {
  if (!quizStore.session) return false
  // If we're looking at a question that has been answered
  const answer = quizStore.session.answers.find(a => a.questionIndex === displayIndex.value)
  return !!answer
})

// The selected option for the currently displayed question (for highlighting)
const currentSelectedOption = computed(() => {
  if (!quizStore.session) return null
  const answer = quizStore.session.answers.find(a => a.questionIndex === displayIndex.value)
  return answer ? answer.selectedIndex : null
})

function getAnswerStatus(index: number): 'correct' | 'wrong' | 'unanswered' {
  if (!quizStore.session) return 'unanswered'
  const answer = quizStore.session.answers.find(a => a.questionIndex === index)
  if (!answer) return 'unanswered'
  return answer.correct ? 'correct' : 'wrong'
}

function canNavigateTo(index: number): boolean {
  // Can navigate to answered questions
  if (getAnswerStatus(index) !== 'unanswered') return true
  // Can navigate to the current unanswered question
  if (index === quizStore.currentIndex) return true
  return false
}

function goToQuestion(index: number) {
  if (!quizStore.session) return
  if (!canNavigateTo(index)) return
  reviewingIndex.value = index
}

let feedbackTimer: ReturnType<typeof setTimeout> | null = null

function selectAnswer(index: number) {
  if (!quizStore.currentQuestion) return
  const isCorrect = index === quizStore.currentQuestion.correctIndex

  // Clear any existing timer
  if (feedbackTimer) {
    clearTimeout(feedbackTimer)
    feedbackTimer = null
  }

  // Pin the current question for display during feedback
  reviewingIndex.value = quizStore.currentIndex

  if (isCorrect) {
    // Correct: record answer, stay on question briefly, then advance
    quizStore.answerQuestion(index)
    // Small delay so the user sees the green highlight
    feedbackTimer = setTimeout(() => {
      reviewingIndex.value = null
      if (quizStore.isFinished) {
        router.push({ name: 'quiz-result' })
      }
    }, 400)
  } else {
    // Wrong: record answer, stay on question for 1.5s so user sees the feedback
    quizStore.answerQuestion(index)
    feedbackTimer = setTimeout(() => {
      reviewingIndex.value = null
      if (quizStore.isFinished) {
        router.push({ name: 'quiz-result' })
      }
    }, 1500)
  }
}

onUnmounted(() => { if (feedbackTimer) clearTimeout(feedbackTimer) })
</script>

<style scoped>
.progress-dots {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
  justify-content: center;
}
.dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #e5e7eb;
  background: #f9fafb;
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dot.current {
  border-color: var(--color-primary, #6366f1);
  background: var(--color-primary, #6366f1);
  color: white;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3);
}
.dot.correct {
  border-color: #22c55e;
  background: #22c55e;
  color: white;
  cursor: pointer;
}
.dot.correct:hover {
  background: #16a34a;
}
.dot.wrong {
  border-color: #ef4444;
  background: #ef4444;
  color: white;
  cursor: pointer;
}
.dot.wrong:hover {
  background: #dc2626;
}
.dot.unanswered {
  cursor: default;
  opacity: 0.5;
}
.dot:disabled {
  cursor: default;
}
</style>
