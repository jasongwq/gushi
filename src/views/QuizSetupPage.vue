<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import type { QuizType, SourceType } from '@/types'

const router = useRouter()
const route = useRoute()
const quizStore = useQuizStore()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

onMounted(() => poemStore.fetchPoems())

const isParentMode = computed(() => route.query.mode === 'parent')

// 支持 HomePage「今日待复习」横幅通过 ?source=review 直达复习模式
const source = ref<SourceType>(route.query.source as SourceType || learningStore.settings.source || 'smart')
const count = ref(learningStore.settings.quizCount || 10)
const selectedGrades = ref<string[]>(learningStore.settings.selectedGrades || [])
const errorMsg = ref('')

// 家长抽查：古诗抽背 + 上下句接龙；自主练习：补字选择 + 上下句接龙
const parentQuizTypes = ref<QuizType[]>(['recite'])
const selfQuizTypes = ref<QuizType[]>(learningStore.settings.quizTypes.length > 0 ? learningStore.settings.quizTypes : ['fillBlank', 'nextLine'])

const quizTypes = computed(() => isParentMode.value ? parentQuizTypes.value : selfQuizTypes.value)

function saveSettings() {
  learningStore.updateSettings({
    source: source.value,
    quizTypes: isParentMode.value ? selfQuizTypes.value : quizTypes.value,
    quizCount: count.value,
    selectedGrades: selectedGrades.value,
  })
}

watch([source, selfQuizTypes, count, selectedGrades], saveSettings, { deep: true })

const sourceOptions: { value: SourceType; label: string }[] = [
  { value: 'smart', label: '智能混合' },
  { value: 'grade', label: '按年级' },
  { value: 'all', label: '全部' },
  { value: 'review', label: '仅待复习' },
  { value: 'wrong', label: '错题本' },
  { value: 'unproficient', label: '不熟练' },
]

const parentQuizTypeOptions: { value: QuizType; label: string }[] = [
  { value: 'recite', label: '古诗抽背' },
  { value: 'nextLine', label: '上下句接龙' },
]

const selfQuizTypeOptions: { value: QuizType; label: string }[] = [
  { value: 'fillBlank', label: '补字选择' },
  { value: 'nextLine', label: '上下句接龙' },
  { value: 'recite', label: '古诗背诵' },
]

const countOptions = [5, 10, 20]

const showGradeSelector = computed(() => source.value === 'grade')

const canStart = computed(() => {
  if (quizTypes.value.length === 0) return false
  if (source.value === 'grade' && selectedGrades.value.length === 0) return false
  return true
})

function toggleQuizType(type: QuizType) {
  if (isParentMode.value) {
    const idx = parentQuizTypes.value.indexOf(type)
    if (idx >= 0) parentQuizTypes.value.splice(idx, 1)
    else parentQuizTypes.value.push(type)
  } else {
    const idx = selfQuizTypes.value.indexOf(type)
    if (idx >= 0) selfQuizTypes.value.splice(idx, 1)
    else selfQuizTypes.value.push(type)
  }
}

function toggleGrade(grade: string) {
  const idx = selectedGrades.value.indexOf(grade)
  if (idx >= 0) selectedGrades.value.splice(idx, 1)
  else selectedGrades.value.push(grade)
}

function startQuiz() {
  if (!canStart.value) return
  errorMsg.value = ''
  const grades = source.value === 'grade' ? selectedGrades.value : undefined

  // 家长模式下若勾选了古诗抽背，跳转到抽卡页面
  if (isParentMode.value && quizTypes.value.includes('recite')) {
    router.push({ name: 'poem-card' })
    return
  }

  // 自助练习：走统一混排流程（startQuiz 现可生成 recite 题目）
  const success = quizStore.startQuiz(source.value, quizTypes.value, count.value, grades)
  if (!success) {
    errorMsg.value = '没有符合条件的题目，请调整设置'
    return
  }
  router.push({ name: 'quiz-play' })
}
</script>

<template>
  <div class="w-full max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-6">{{ isParentMode ? '家长抽查' : '抽查设置' }}</h2>

    <section class="mb-6">
      <h3 class="text-sm text-gray-500 mb-2">题目来源</h3>
      <select v-model="source" class="w-full p-3 border border-gray-200 rounded-lg text-base bg-white focus:border-indigo-300 focus:outline-none">
        <option v-for="opt in sourceOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </section>

    <section v-if="showGradeSelector" class="mb-6">
      <h3 class="text-sm text-gray-500 mb-2">选择年级</h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="grade in poemStore.grades"
          :key="grade"
          :class="['px-3 py-2 border-2 rounded-lg text-sm cursor-pointer transition', selectedGrades.includes(grade) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white']"
          @click="toggleGrade(grade)"
        >
          {{ grade }}
        </button>
      </div>
    </section>

    <section class="mb-6">
      <h3 class="text-sm text-gray-500 mb-2">题目类型</h3>
      <div class="flex flex-col gap-2">
        <label v-for="opt in (isParentMode ? parentQuizTypeOptions : selfQuizTypeOptions)" :key="opt.value" class="flex items-center gap-2 text-base cursor-pointer">
          <input
            type="checkbox"
            :checked="quizTypes.includes(opt.value)"
            @change="toggleQuizType(opt.value)"
            class="w-4 h-4 text-indigo-500"
          />
          {{ opt.label }}
        </label>
      </div>
    </section>

    <section class="mb-6">
      <h3 class="text-sm text-gray-500 mb-2">题目数量</h3>
      <div class="flex gap-3">
        <button
          v-for="n in countOptions"
          :key="n"
          :class="['flex-1 p-3 border-2 rounded-lg text-base cursor-pointer transition', count === n ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white']"
          @click="count = n"
        >
          {{ n }}
        </button>
      </div>
    </section>

    <p v-if="errorMsg" class="text-red-500 text-sm text-center mb-3">{{ errorMsg }}</p>

    <button
      :disabled="!canStart"
      :class="['w-full p-4 rounded-lg text-lg font-medium cursor-pointer mb-3 transition', canStart ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-gray-300 text-gray-500 cursor-not-allowed']"
      @click="startQuiz"
    >
      开始抽查
    </button>

    <button class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-500 text-sm cursor-pointer hover:bg-gray-50 transition" @click="router.push({ name: 'home' })">
      返回首页
    </button>
  </div>
</template>
