<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import { usePoemStore } from '@/stores/poem'


const router = useRouter()
const quizStore = useQuizStore()
const poemStore = usePoemStore()

const results = computed(() => {
  if (!quizStore.session) return []
  return quizStore.session.recitationResults
})

const masteredCount = computed(() => results.value.filter(r => r.overallStatus === 'mastered').length)
const notMasteredCount = computed(() => results.value.filter(r => r.overallStatus === 'not-mastered').length)

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
  quizStore.resetSession()
  router.push({ name: 'home' })
}

function tryAgain() {
  quizStore.resetSession()
  router.push({ name: 'recitation-setup' })
}
</script>

<template>
  <div class="max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-4">抽背结果</h2>

    <div class="text-center mb-6">
      <div class="flex justify-center gap-6">
        <div>
          <div class="text-3xl font-bold text-green-500">{{ masteredCount }}</div>
          <div class="text-sm text-gray-500">熟练</div>
        </div>
        <div>
          <div class="text-3xl font-bold text-red-500">{{ notMasteredCount }}</div>
          <div class="text-sm text-gray-500">不熟练</div>
        </div>
      </div>
    </div>

    <div class="mb-6">
      <div v-for="result in results" :key="result.poemId" class="mb-2">
        <div
          :class="['p-3 rounded-lg border-l-4 cursor-pointer', result.overallStatus === 'mastered' ? 'bg-green-50 border-l-green-500' : 'bg-red-50 border-l-red-500']"
          @click="result.overallStatus === 'not-mastered' && toggleExpand(result.poemId)"
        >
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ getPoemTitle(result.poemId) }}</span>
            <span :class="['ml-auto text-lg font-bold', result.overallStatus === 'mastered' ? 'text-green-600' : 'text-red-500']">
              {{ result.overallStatus === 'mastered' ? '熟练' : '不熟练' }}
            </span>
          </div>
        </div>

        <!-- 展开不熟练详情 -->
        <div v-if="expandedIds.has(result.poemId) && result.overallStatus === 'not-mastered'" class="ml-4 mt-1 p-3 bg-white rounded-lg border border-gray-100">
          <div v-for="line in result.lines" :key="line.lineIndex" class="flex items-center gap-2 py-1">
            <span class="text-sm text-gray-600">{{ getPoemText(result.poemId)[line.lineIndex] }}</span>
            <span :class="['text-xs px-2 py-0.5 rounded', line.status === 'stuck' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700']">
              {{ line.status === 'stuck' ? '卡顿' : '不会' }}
            </span>
          </div>
          <div v-if="result.authorCorrect === false" class="text-sm text-red-500 mt-1">作者不正确</div>
          <div v-if="result.dynastyCorrect === false" class="text-sm text-red-500 mt-1">朝代不正确</div>
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
