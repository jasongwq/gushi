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
  <div class="max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-4">抽查结果</h2>

    <div class="text-center mb-2">
      <span class="text-5xl font-bold text-indigo-500">{{ score }}</span>
      <span class="text-lg text-gray-500">分</span>
    </div>

    <div class="text-center text-sm text-gray-500 mb-6">
      {{ quizStore.correctCount }} / {{ quizStore.totalQuestions }} 正确
    </div>

    <div class="mb-6">
      <div v-for="item in answers" :key="item.index" :class="['p-3 rounded-lg mb-2 border-l-4', item.isCorrect ? 'bg-green-50 border-l-green-500' : 'bg-red-50 border-l-red-500']">
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
      </div>
    </div>

    <button class="w-full p-4 bg-indigo-500 text-white rounded-lg text-lg font-medium cursor-pointer hover:bg-indigo-600 transition" @click="goHome">
      返回首页
    </button>
  </div>
</template>
