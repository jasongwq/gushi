<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import CardSwiper from '@/components/CardSwiper.vue'
import PoemCard from '@/components/PoemCard.vue'
import MysteryBox from '@/components/MysteryBox.vue'
import { SwiperSlide } from 'swiper/vue'
import type { Poem, RecitationResult, SourceType } from '@/types'
import { getReviewPoems, getWrongPoems, getUnproficientPoems, shuffleArray } from '@/utils/quiz'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

onMounted(() => poemStore.fetchPoems())

// 模式切换：swiper / mystery
type ViewMode = 'swiper' | 'mystery'
const viewMode = ref<ViewMode>('swiper')

// 筛选
const source = ref<SourceType>('all')
const selectedGrades = ref<string[]>([])

const sourceOptions: { value: SourceType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'smart', label: '智能混合' },
  { value: 'grade', label: '按年级' },
  { value: 'review', label: '待复习' },
  { value: 'wrong', label: '错题本' },
  { value: 'unproficient', label: '不熟练' },
]

const showGradeSelector = computed(() => source.value === 'grade')

function toggleGrade(grade: string) {
  const idx = selectedGrades.value.indexOf(grade)
  if (idx >= 0) selectedGrades.value.splice(idx, 1)
  else selectedGrades.value.push(grade)
}

// 当前古诗列表
const today = new Date().toISOString().split('T')[0]

const poems = computed(() => {
  const enabled = poemStore.enabledPoems
  if (source.value === 'all') return enabled
  if (source.value === 'smart') return shuffleArray(enabled)
  if (source.value === 'grade') return enabled.filter(p => selectedGrades.value.includes(p.grade))
  if (source.value === 'review') return getReviewPoems(enabled, learningStore.records, today)
  if (source.value === 'wrong') return getWrongPoems(enabled, learningStore.wrongBook)
  if (source.value === 'unproficient') return getUnproficientPoems(enabled, learningStore.records)
  return enabled
})

// 当前卡片索引
const currentIndex = ref(0)

// 已抽查过的诗 ID 集合
const checkedPoemIds = ref(new Set<string>())

// PoemCard refs
const poemCardRefs = ref<InstanceType<typeof PoemCard>[]>([])

// 索引变化时，保存上一首诗的标记结果
watch(currentIndex, (_newIdx, oldIdx) => {
  if (oldIdx !== undefined && oldIdx < poems.value.length) {
    const prevPoem = poems.value[oldIdx]
    if (prevPoem) {
      const card = poemCardRefs.value[oldIdx]
      if (card && card.expanded) {
        const result = card.getResult()
        saveResult(result)
      }
    }
  }
})

function saveResult(result: RecitationResult) {
  checkedPoemIds.value.add(result.poemId)

  if (result.overallStatus === 'mastered') {
    learningStore.recordAnswer(result.poemId, 'recite', true)
  } else {
    learningStore.recordAnswer(result.poemId, 'recite', false)
    for (const line of result.lines) {
      if (line.status === 'stuck' || line.status === 'forgot') {
        learningStore.recordAnswer(result.poemId, 'recite', false, `第${line.lineIndex + 1}句:${line.status}`)
      }
    }
  }
  if (result.authorCorrect === false) {
    learningStore.recordAnswer(result.poemId, 'author', false)
  }
  if (result.dynastyCorrect === false) {
    learningStore.recordAnswer(result.poemId, 'dynasty', false)
  }
}

// 盲盒模式：抽到诗后跳转到 swiper 对应位置
const mysteryBoxRef = ref<InstanceType<typeof MysteryBox> | null>(null)

function onMysteryRevealed(poem: Poem) {
  const idx = poems.value.findIndex(p => p.id === poem.id)
  if (idx >= 0) {
    currentIndex.value = idx
  }
}

// 统计
const checkedCount = computed(() => checkedPoemIds.value.size)
const totalCount = computed(() => poems.value.length)
</script>

<template>
  <div class="poem-card-page max-w-md mx-auto h-screen flex flex-col bg-gray-50">
    <!-- 顶部筛选栏 -->
    <div class="p-3 bg-white border-b border-gray-100">
      <div class="flex items-center gap-2 mb-2">
        <button class="text-gray-400 text-sm" @click="router.push({ name: 'home' })">← 返回</button>
        <span class="text-sm text-gray-500 ml-auto">已查 {{ checkedCount }} / {{ totalCount }} 首</span>
      </div>
      <div class="flex gap-2 overflow-x-auto pb-1">
        <button
          v-for="opt in sourceOptions"
          :key="opt.value"
          :class="['px-3 py-1.5 text-xs rounded-full border whitespace-nowrap cursor-pointer transition', source === opt.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500']"
          @click="source = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
      <div v-if="showGradeSelector" class="flex flex-wrap gap-2 mt-2">
        <button
          v-for="grade in poemStore.grades"
          :key="grade"
          :class="['px-2 py-1 text-xs rounded border cursor-pointer transition', selectedGrades.includes(grade) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-400']"
          @click="toggleGrade(grade)"
        >
          {{ grade }}
        </button>
      </div>
    </div>

    <!-- 卡片区域 -->
    <div class="flex-1 min-h-0 p-4">
      <!-- 盲盒模式 -->
      <MysteryBox
        v-if="viewMode === 'mystery' && poems.length > 0"
        ref="mysteryBoxRef"
        :poems="poems"
        @revealed="onMysteryRevealed"
      />

      <!-- 滑动模式 -->
      <CardSwiper v-else-if="viewMode === 'swiper' && poems.length > 0" ref="swiperRef" v-model="currentIndex" :count="poems.length">
        <SwiperSlide v-for="(poem, index) in poems" :key="poem.id">
          <PoemCard
            :ref="(el: any) => { if (el) poemCardRefs[index] = el }"
            :poem="poem"
            :checked="checkedPoemIds.has(poem.id)"
          />
        </SwiperSlide>
      </CardSwiper>

      <div v-else class="h-full flex items-center justify-center text-gray-400">
        没有符合条件的古诗
      </div>
    </div>

    <!-- 底部工具栏 -->
    <div class="p-4 bg-white border-t border-gray-100 flex gap-3">
      <button
        :disabled="poems.length === 0"
        :class="['flex-1 py-3 rounded-xl text-base font-medium cursor-pointer transition', viewMode === 'swiper' ? 'bg-indigo-500 text-white' : poems.length > 0 ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed']"
        @click="viewMode = 'swiper'"
      >
        📇 滑动
      </button>
      <button
        :disabled="poems.length === 0"
        :class="['flex-1 py-3 rounded-xl text-base font-medium cursor-pointer transition', viewMode === 'mystery' ? 'bg-purple-500 text-white' : poems.length > 0 ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed']"
        @click="viewMode = 'mystery'"
      >
        🎁 盲盒
      </button>
    </div>
  </div>
</template>
