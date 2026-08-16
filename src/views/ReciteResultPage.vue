<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'

const router = useRouter()
const poemStore = usePoemStore()

onMounted(() => poemStore.fetchPoems())

interface ReciteResult {
  poemId: string
  correct: boolean
}

// 从 router state 或 sessionStorage 获取结果
function loadResults(): ReciteResult[] {
  const fromState = history.state?.results as ReciteResult[] | undefined
  if (fromState && fromState.length > 0) return fromState
  const fromSession = sessionStorage.getItem('recite-results')
  if (fromSession) {
    try { return JSON.parse(fromSession) } catch { /* ignore */ }
  }
  return []
}

const results = ref<ReciteResult[]>(loadResults())

const correctCount = computed(() => results.value.filter(r => r.correct).length)
const wrongCount = computed(() => results.value.filter(r => !r.correct).length)
const wrongResults = computed(() => results.value.filter(r => !r.correct))

const expandedIds = ref<Set<string>>(new Set())

function toggleExpand(poemId: string) {
  if (expandedIds.value.has(poemId)) {
    expandedIds.value.delete(poemId)
  } else {
    expandedIds.value.add(poemId)
  }
}

function getPoemTitle(poemId: string): string {
  return poemStore.getPoemById(poemId)?.title ?? ''
}

function getPoemText(poemId: string): string[] {
  return poemStore.getPoemById(poemId)?.text ?? []
}

function goHome() {
  sessionStorage.removeItem('poem-recite-state')
  router.push({ name: 'home' })
}

function tryAgain() {
  sessionStorage.removeItem('poem-recite-state')
  router.push({ name: 'recite' })
}
</script>

<template>
  <div class="max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-4">背诵结果</h2>

    <div class="text-center mb-6">
      <div class="flex justify-center gap-6">
        <div>
          <div class="text-3xl font-bold text-green-500">{{ correctCount }}</div>
          <div class="text-sm text-gray-500">会了</div>
        </div>
        <div>
          <div class="text-3xl font-bold text-red-500">{{ wrongCount }}</div>
          <div class="text-sm text-gray-500">不会</div>
        </div>
      </div>
    </div>

    <div v-if="wrongResults.length > 0" class="mb-6">
      <h3 class="text-sm text-gray-500 mb-2">不会的古诗</h3>
      <div v-for="result in wrongResults" :key="result.poemId" class="mb-2">
        <div
          class="p-3 rounded-lg border-l-4 cursor-pointer bg-red-50 border-l-red-500"
          @click="toggleExpand(result.poemId)"
        >
          <span class="font-medium">{{ getPoemTitle(result.poemId) }}</span>
        </div>
        <div v-if="expandedIds.has(result.poemId)" class="ml-4 mt-1 p-3 bg-white rounded-lg border border-gray-100">
          <p v-for="(line, i) in getPoemText(result.poemId)" :key="i" class="text-sm text-gray-600">{{ line }}</p>
        </div>
      </div>
    </div>

    <button class="w-full p-4 bg-indigo-500 text-white rounded-lg text-lg font-medium cursor-pointer hover:bg-indigo-600 transition mb-3" @click="tryAgain">
      再来一轮
    </button>
    <button class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-500 text-sm cursor-pointer hover:bg-gray-50 transition" @click="goHome">
      返回首页
    </button>
  </div>
</template>
