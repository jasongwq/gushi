<template>
  <div class="home-page max-w-md mx-auto p-4">
    <h1 class="text-2xl font-bold text-center mb-6">古诗抽查</h1>

    <div v-if="reviewDueCount > 0" class="review-banner mb-4 p-4 bg-indigo-50 rounded-lg cursor-pointer" @click="startReview">
      <p class="text-indigo-700 font-medium">今日待复习：{{ reviewDueCount }} 首</p>
      <p class="text-indigo-500 text-sm">点击进入复习 →</p>
    </div>

    <div class="grid grid-cols-3 gap-4 mb-6">
      <button class="mode-btn p-6 bg-white rounded-lg shadow hover:shadow-md transition" @click="startQuiz('parent')">
        <div class="text-3xl mb-2">👨‍👩‍👧</div>
        <div class="font-medium">家长抽查</div>
      </button>
      <button class="mode-btn p-6 bg-white rounded-lg shadow hover:shadow-md transition" @click="startQuiz('self')">
        <div class="text-3xl mb-2">📝</div>
        <div class="font-medium">自主练习</div>
      </button>
      <button class="mode-btn p-6 bg-white rounded-lg shadow hover:shadow-md transition" @click="startRecitation">
        <div class="text-3xl mb-2">📖</div>
        <div class="font-medium">古诗抽背</div>
      </button>
    </div>

    <div class="grid grid-cols-4 gap-3">
      <router-link to="/poems" class="shortcut-btn p-3 bg-white rounded-lg shadow text-center hover:shadow-md transition">
        <div class="text-sm">古诗集合</div>
        <div class="text-lg font-bold text-indigo-500">{{ poemStore.poems.length }}</div>
      </router-link>
      <router-link to="/wrong" class="shortcut-btn p-3 bg-white rounded-lg shadow text-center hover:shadow-md transition">
        <div class="text-sm">错题本</div>
        <div class="text-lg font-bold text-red-500">{{ wrongCount }}</div>
      </router-link>
      <router-link to="/progress" class="shortcut-btn p-3 bg-white rounded-lg shadow text-center hover:shadow-md transition">
        <div class="text-sm">学习进度</div>
        <div class="text-lg font-bold text-green-500">{{ learnedCount }}</div>
      </router-link>
      <router-link to="/settings" class="shortcut-btn p-3 bg-white rounded-lg shadow text-center hover:shadow-md transition">
        <div class="text-sm">设置</div>
        <div class="text-lg">⚙️</div>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

const reviewDueCount = computed(() => learningStore.reviewDueCount)
const wrongCount = computed(() => learningStore.wrongCount)
const learnedCount = computed(() => learningStore.records.filter(r => r.reviewCount > 0).length)

onMounted(() => poemStore.fetchPoems())

function startReview() {
  router.push({ name: 'quiz-setup', query: { source: 'review' } })
}

function startRecitation() {
  router.push({ name: 'recitation-setup' })
}

function startQuiz(mode: string) {
  router.push({ name: 'quiz-setup', query: { mode } })
}
</script>
