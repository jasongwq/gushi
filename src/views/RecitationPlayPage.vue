<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import { usePoemStore } from '@/stores/poem'
import RecitationCard from '@/components/RecitationCard.vue'
import type { RecitationResult } from '@/types'

const router = useRouter()
const quizStore = useQuizStore()
const poemStore = usePoemStore()

onMounted(() => poemStore.fetchPoems())

const currentPoem = computed(() => {
  if (!quizStore.session || !quizStore.currentQuestion) return null
  return poemStore.getPoemById(quizStore.currentQuestion.poemId) ?? null
})

const progressPercent = computed(() =>
  quizStore.totalQuestions > 0
    ? (quizStore.currentIndex / quizStore.totalQuestions) * 100
    : 0
)

const canGoPrev = computed(() => quizStore.currentIndex > 0)

function onSubmit(result: RecitationResult) {
  quizStore.submitRecitationResult(result)
  if (quizStore.isFinished) {
    router.push({ name: 'recitation-result' })
  }
}

function goPrev() {
  quizStore.goToPrevRecitation()
}
</script>

<template>
  <div class="recitation-play max-w-md mx-auto p-4">
    <template v-if="currentPoem && !quizStore.isFinished">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <p class="progress-text text-sm text-gray-500 text-center mb-4">
        第 {{ quizStore.currentIndex + 1 }} / {{ quizStore.totalQuestions }} 首
      </p>
      <RecitationCard :poem="currentPoem" :can-go-prev="canGoPrev" @submit="onSubmit" @go-prev="goPrev" />
    </template>
    <div v-else>
      <p>未开始抽背</p>
      <button @click="router.push({ name: 'home' })">返回首页</button>
    </div>
  </div>
</template>

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
</style>
