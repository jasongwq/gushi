<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import { isDueForReview } from '@/utils/ebbinghaus'
import { shuffleArray } from '@/utils/quiz'
import type { Poem } from '@/types'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

onMounted(() => poemStore.fetchPoems())

const source = ref<'review' | 'all'>('review')
const selectedGrades = ref<string[]>([])
const phase = ref<'setup' | 'cards'>('setup')
const poems = ref<Poem[]>([])
const currentIndex = ref(0)
const expanded = ref(false)
const showYiwen = ref(learningStore.settings.showYiwen ?? false)
const results = ref<{ poemId: string; correct: boolean }[]>([])

function toggleYiwen() {
  showYiwen.value = !showYiwen.value
  learningStore.updateSettings({ showYiwen: showYiwen.value })
}

const reviewDuePoems = computed(() => {
  const records = learningStore.records.filter(r => isDueForReview(r))
  return poemStore.enabledPoems.filter(p => records.some(r => r.poemId === p.id))
})

const reviewDueCount = computed(() => reviewDuePoems.value.length)

const currentPoem = computed(() => poems.value[currentIndex.value] ?? null)
const progressText = computed(() => `${currentIndex.value + 1} / ${poems.value.length}`)
const progressPercent = computed(() => poems.value.length > 0 ? ((currentIndex.value) / poems.value.length) * 100 : 0)

function toggleGrade(grade: string) {
  const idx = selectedGrades.value.indexOf(grade)
  if (idx >= 0) selectedGrades.value.splice(idx, 1)
  else selectedGrades.value.push(grade)
}

function startRecite() {
  let selected: Poem[] = []
  if (source.value === 'review') {
    selected = shuffleArray(reviewDuePoems.value)
  } else {
    if (selectedGrades.value.length > 0) {
      selected = poemStore.enabledPoems.filter(p => selectedGrades.value.includes(p.grade))
    } else {
      selected = [...poemStore.enabledPoems]
    }
    selected = shuffleArray(selected)
  }

  if (selected.length === 0) return
  poems.value = selected.slice(0, 20)
  currentIndex.value = 0
  expanded.value = false
  showYiwen.value = learningStore.settings.showYiwen ?? false
  results.value = []
  phase.value = 'cards'
}

function selfEvaluate(correct: boolean) {
  if (!currentPoem.value) return
  learningStore.recordRecite(currentPoem.value.id, correct)
  results.value.push({ poemId: currentPoem.value.id, correct })

  if (currentIndex.value < poems.value.length - 1) {
    currentIndex.value++
    expanded.value = false
    showYiwen.value = learningStore.settings.showYiwen ?? false
  } else {
    sessionStorage.setItem('recite-results', JSON.stringify(results.value))
    router.push({ name: 'recite-result' })
  }
}
</script>

<template>
  <div class="max-w-md mx-auto p-4">
    <!-- 设置阶段 -->
    <template v-if="phase === 'setup'">
      <h2 class="text-xl font-bold text-center mb-6">古诗背诵</h2>

      <div v-if="reviewDueCount > 0" class="mb-4 p-4 bg-indigo-50 rounded-lg">
        <p class="text-indigo-700 font-medium">今日待复习：{{ reviewDueCount }} 首</p>
      </div>

      <section class="mb-6">
        <h3 class="text-sm text-gray-500 mb-2">背诵来源</h3>
        <div class="flex gap-3">
          <button
            :class="['flex-1 p-3 border-2 rounded-lg cursor-pointer transition', source === 'review' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white']"
            @click="source = 'review'"
          >待复习</button>
          <button
            :class="['flex-1 p-3 border-2 rounded-lg cursor-pointer transition', source === 'all' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white']"
            @click="source = 'all'"
          >全部古诗</button>
        </div>
      </section>

      <section v-if="source === 'all'" class="mb-6">
        <h3 class="text-sm text-gray-500 mb-2">选择年级（不选则为全部）</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="grade in poemStore.grades"
            :key="grade"
            :class="['px-3 py-2 border-2 rounded-lg text-sm cursor-pointer transition', selectedGrades.includes(grade) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white']"
            @click="toggleGrade(grade)"
          >{{ grade }}</button>
        </div>
      </section>

      <button
        :disabled="source === 'review' && reviewDueCount === 0"
        :class="['w-full p-4 rounded-lg text-lg font-medium cursor-pointer transition mb-3', (source === 'review' && reviewDueCount === 0) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-500 text-white hover:bg-indigo-600']"
        @click="startRecite"
      >开始背诵</button>

      <button class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-500 text-sm cursor-pointer hover:bg-gray-50 transition" @click="router.push({ name: 'home' })">
        返回首页
      </button>
    </template>

    <!-- 背诵卡片阶段 -->
    <template v-else-if="currentPoem">
      <div class="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
        <div class="h-full bg-indigo-500 transition-all duration-300" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <p class="text-sm text-gray-500 text-center mb-4">{{ progressText }}</p>

      <div class="text-center mb-6">
        <h2 class="text-3xl font-bold mb-2">{{ currentPoem.title }}</h2>
        <p v-if="expanded" class="text-gray-500">{{ currentPoem.dynasty }} · {{ currentPoem.author }}</p>
      </div>

      <!-- 查看原文 -->
      <div v-if="!expanded" class="text-center mb-6">
        <button
          class="px-6 py-3 bg-white border-2 border-indigo-200 rounded-lg text-indigo-600 font-medium cursor-pointer hover:bg-indigo-50 transition"
          @click="expanded = true"
        >查看原文</button>
      </div>

      <!-- 展开原文 -->
      <div v-else class="mb-6">
        <div class="p-4 bg-white border border-gray-200 rounded-lg mb-4">
          <p v-for="(line, i) in currentPoem.text" :key="i" class="text-lg leading-relaxed text-center">{{ line }}</p>
          <div class="text-center mt-2">
            <button
              :class="['px-3 py-1.5 text-xs rounded-lg border-2 cursor-pointer transition', showYiwen ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-indigo-200 bg-indigo-50 text-indigo-600']"
              @click="toggleYiwen"
            >
              {{ showYiwen ? '隐藏译文 ▴' : '显示译文 ▾' }}
            </button>
          </div>
        </div>
        <div v-if="showYiwen" class="p-3 bg-gray-50 rounded-lg mb-4 text-center">
          <p class="text-sm leading-relaxed text-gray-500">{{ currentPoem.yiwen }}</p>
        </div>
        <div class="flex gap-3">
          <button
            class="flex-1 p-4 bg-green-50 border-2 border-green-200 rounded-lg text-green-700 font-medium text-lg cursor-pointer hover:bg-green-100 transition"
            @click="selfEvaluate(true)"
          >会了</button>
          <button
            class="flex-1 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700 font-medium text-lg cursor-pointer hover:bg-red-100 transition"
            @click="selfEvaluate(false)"
          >不会</button>
        </div>
      </div>
    </template>
  </div>
</template>
