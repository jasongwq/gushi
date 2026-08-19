<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import { usePoemStore } from '@/stores/poem'
import PoemPopup from '@/components/PoemPopup.vue'
import type { Poem } from '@/types'

const router = useRouter()
const quizStore = useQuizStore()
const poemStore = usePoemStore()

onMounted(() => poemStore.fetchPoems())

const score = computed(() => {
  if (!quizStore.session) return 0
  return Math.round((quizStore.correctCount / quizStore.totalQuestions) * 100)
})

const answers = computed(() => {
  if (!quizStore.session) return []
  return quizStore.session.answers.map((a, i) => {
    const question = quizStore.session!.questions[a.questionIndex]
    // 防御：session 恢复后 questionIndex 可能越界（旧 session 数据）
    if (!question) {
      return {
        index: i + 1,
        poemId: '',
        poemTitle: '（题目数据缺失）',
        prompt: '',
        selected: '',
        correct: '',
        isCorrect: false,
        isRecite: false,
      }
    }
    const poem = poemStore.getPoemById(question.poemId)
    const isRecite = question.quizType === 'recite'
    return {
      index: i + 1,
      poemId: question.poemId,
      poemTitle: poem?.title ?? '',
      prompt: question.prompt,
      selected: isRecite
        ? (a.correct ? '熟练' : '不熟练')
        : question.options[a.selectedIndex],
      correct: isRecite ? '熟练' : question.options[question.correctIndex],
      isCorrect: a.correct,
      isRecite,
    }
  })
})

function goHome() {
  quizStore.resetSession()
  router.push({ name: 'home' })
}

const popupVisible = ref(false)
const popupPoemId = ref('')

const popupPoem = computed<Poem | undefined>(() => {
  if (!popupPoemId.value) return undefined
  return poemStore.getPoemById(popupPoemId.value)
})

function togglePopup(poemId: string) {
  if (popupPoemId.value === poemId && popupVisible.value) {
    popupVisible.value = false
  } else {
    popupPoemId.value = poemId
    popupVisible.value = true
  }
}
</script>

<template>
  <div class="w-full max-w-md mx-auto p-4">
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
          <span class="flex-1 text-sm cursor-pointer text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300" @click="togglePopup(item.poemId)">{{ item.poemTitle }}</span>
          <span :class="['text-lg font-bold', item.isCorrect ? 'text-green-600' : 'text-red-500']">
            {{ item.isCorrect ? '✓' : '✗' }}
          </span>
        </div>
        <p class="text-sm text-gray-600 mt-1">{{ item.prompt }}</p>
        <div v-if="!item.isRecite" class="mt-1 text-xs">
          <p :class="item.isCorrect ? 'text-green-600' : 'text-red-500'">你的答案：{{ item.selected }}</p>
          <p v-if="!item.isCorrect" class="text-green-600">正确答案：{{ item.correct }}</p>
        </div>
      </div>
    </div>

    <PoemPopup v-if="popupPoem" :poem="popupPoem" v-model:visible="popupVisible" />

    <button class="w-full p-4 bg-indigo-500 text-white rounded-lg text-lg font-medium cursor-pointer hover:bg-indigo-600 transition" @click="goHome">
      返回首页
    </button>
  </div>
</template>
