<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import type { QuizType, SourceType } from '@/types'

const router = useRouter()
const quizStore = useQuizStore()

const source = ref<SourceType>('smart')
const quizTypes = ref<QuizType[]>(['fillBlank', 'nextLine'])
const count = ref(10)

const sourceOptions: { value: SourceType; label: string }[] = [
  { value: 'smart', label: '智能混合' },
  { value: 'grade', label: '按年级' },
  { value: 'all', label: '全部' },
  { value: 'review', label: '仅待复习' },
  { value: 'wrong', label: '错题本' },
  { value: 'unproficient', label: '不熟练' },
]

const quizTypeOptions: { value: QuizType; label: string }[] = [
  { value: 'fillBlank', label: '补字选择' },
  { value: 'nextLine', label: '上下句接龙' },
  { value: 'selectTitle', label: '选标题/作者/朝代' },
]

const countOptions = [5, 10, 20]

function toggleQuizType(type: QuizType) {
  const idx = quizTypes.value.indexOf(type)
  if (idx >= 0) quizTypes.value.splice(idx, 1)
  else quizTypes.value.push(type)
}

function startQuiz() {
  if (quizTypes.value.length === 0) return
  quizStore.startQuiz(source.value, quizTypes.value, count.value)
  router.push({ name: 'quiz-play' })
}
</script>

<template>
  <div class="max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-6">抽查设置</h2>

    <section class="mb-6">
      <h3 class="text-sm text-gray-500 mb-2">题目来源</h3>
      <select v-model="source" class="w-full p-3 border border-gray-200 rounded-lg text-base bg-white focus:border-indigo-300 focus:outline-none">
        <option v-for="opt in sourceOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </section>

    <section class="mb-6">
      <h3 class="text-sm text-gray-500 mb-2">题目类型</h3>
      <div class="flex flex-col gap-2">
        <label v-for="opt in quizTypeOptions" :key="opt.value" class="flex items-center gap-2 text-base cursor-pointer">
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

    <button
      :disabled="quizTypes.length === 0"
      :class="['w-full p-4 rounded-lg text-lg font-medium cursor-pointer mb-3 transition', quizTypes.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-500 text-white hover:bg-indigo-600']"
      @click="startQuiz"
    >
      开始抽查
    </button>

    <button class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-500 text-sm cursor-pointer hover:bg-gray-50 transition" @click="router.push({ name: 'home' })">
      返回首页
    </button>
  </div>
</template>
