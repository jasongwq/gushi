<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Poem, RecitationResult } from '@/types'
import { useLearningStore } from '@/stores/learning'

const props = defineProps<{
  poem: Poem
  canGoPrev?: boolean
}>()

const emit = defineEmits<{
  submit: [result: RecitationResult]
  goPrev: []
}>()

const learningStore = useLearningStore()
const showYiwen = ref(learningStore.settings.showYiwen ?? false)

function toggleYiwen() {
  showYiwen.value = !showYiwen.value
  learningStore.updateSettings({ showYiwen: showYiwen.value })
}

// 每行状态：默认熟练，可标记为卡顿/不会
const lineStatuses = ref<{ lineIndex: number; status: 'ok' | 'stuck' | 'forgot' }[]>(
  props.poem.text.map((_, i) => ({ lineIndex: i, status: 'ok' as const }))
)
const authorCorrect = ref<boolean | null>(null)
const dynastyCorrect = ref<boolean | null>(null)

// 当 poem 变化时重置状态
watch(() => props.poem.id, () => {
  lineStatuses.value = props.poem.text.map((_, i) => ({ lineIndex: i, status: 'ok' as const }))
  authorCorrect.value = null
  dynastyCorrect.value = null
  showYiwen.value = learningStore.settings.showYiwen ?? false
})

// 整首熟练：所有行都ok，作者/朝代都没标错
function markMastered() {
  lineStatuses.value = props.poem.text.map((_, i) => ({ lineIndex: i, status: 'ok' as const }))
  authorCorrect.value = null
  dynastyCorrect.value = null
  submitResult('mastered')
}

// 完全不会：所有行都标不会
function markForgot() {
  lineStatuses.value = props.poem.text.map((_, i) => ({ lineIndex: i, status: 'forgot' as const }))
  authorCorrect.value = false
  dynastyCorrect.value = false
  submitResult('not-mastered')
}

function setLineStatus(index: number, status: 'ok' | 'stuck' | 'forgot') {
  lineStatuses.value[index] = { lineIndex: index, status }
}

function toggleAuthorCorrect() {
  if (authorCorrect.value === null) authorCorrect.value = false
  else if (authorCorrect.value === false) authorCorrect.value = true
  else authorCorrect.value = null
}

function toggleDynastyCorrect() {
  if (dynastyCorrect.value === null) dynastyCorrect.value = false
  else if (dynastyCorrect.value === false) dynastyCorrect.value = true
  else dynastyCorrect.value = null
}

const hasAnyIssue = computed(() => {
  const hasLineIssue = lineStatuses.value.some(l => l.status !== 'ok')
  const hasAuthorIssue = authorCorrect.value === false
  const hasDynastyIssue = dynastyCorrect.value === false
  return hasLineIssue || hasAuthorIssue || hasDynastyIssue
})

function submit() {
  submitResult(hasAnyIssue.value ? 'not-mastered' : 'mastered')
}

function submitResult(overallStatus: 'mastered' | 'not-mastered') {
  const result: RecitationResult = {
    poemId: props.poem.id,
    overallStatus,
    lines: overallStatus === 'not-mastered'
      ? lineStatuses.value.filter(l => l.status !== 'ok')
      : [],
    authorCorrect: authorCorrect.value,
    dynastyCorrect: dynastyCorrect.value,
  }
  emit('submit', result)
}
</script>

<template>
  <div class="recitation-card py-2 w-full">
    <div class="text-center mb-4">
      <h2 class="text-2xl font-bold mb-1">{{ poem.title }}</h2>
      <p class="text-gray-500 text-sm">{{ poem.dynasty }} · {{ poem.author }}</p>
    </div>

    <!-- 全诗原文 + 逐句标记 -->
    <div class="mb-4">
      <div
        v-for="(line, index) in poem.text"
        :key="index"
        class="flex items-center gap-2 py-2 border-b border-gray-100 last:border-b-0"
      >
        <span :class="['flex-1 text-lg min-w-0 break-all', lineStatuses[index].status === 'forgot' ? 'text-red-400' : lineStatuses[index].status === 'stuck' ? 'text-yellow-600' : '']">{{ line }}</span>
        <div class="flex gap-1 shrink-0">
          <button
            :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', lineStatuses[index].status === 'stuck' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 bg-white text-gray-400']"
            @click="setLineStatus(index, lineStatuses[index].status === 'stuck' ? 'ok' : 'stuck')"
          >卡顿</button>
          <button
            :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', lineStatuses[index].status === 'forgot' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
            @click="setLineStatus(index, lineStatuses[index].status === 'forgot' ? 'ok' : 'forgot')"
          >不会</button>
        </div>
      </div>
    </div>

    <!-- 译文 -->
    <div class="mb-3 text-center">
      <button
        :class="['px-3 py-1.5 text-xs rounded-lg border-2 cursor-pointer transition', showYiwen ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-indigo-200 bg-indigo-50 text-indigo-600']"
        @click="toggleYiwen"
      >
        {{ showYiwen ? '隐藏译文 ▴' : '显示译文 ▾' }}
      </button>
    </div>
    <div v-if="showYiwen" class="mb-3 p-3 bg-gray-50 rounded-lg text-center">
      <p class="text-sm leading-relaxed text-gray-500">{{ poem.yiwen }}</p>
    </div>

    <!-- 作者/朝代标记 -->
    <div class="mb-4 flex items-center gap-4">
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-600">{{ poem.author }}</span>
        <button
          data-testid="btn-author-forgot"
          :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', authorCorrect === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
          @click="toggleAuthorCorrect"
        >不会</button>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-600">{{ poem.dynasty }}</span>
        <button
          data-testid="btn-dynasty-forgot"
          :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', dynastyCorrect === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
          @click="toggleDynastyCorrect"
        >不会</button>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="flex gap-3 mb-3">
      <button
        data-testid="btn-mastered"
        class="flex-1 p-3 bg-green-50 border-2 border-green-200 rounded-lg text-green-700 font-medium text-base cursor-pointer hover:bg-green-100 transition"
        @click="markMastered"
      >
        熟练
      </button>
      <button
        data-testid="btn-forgot"
        class="flex-1 p-3 bg-red-50 border-2 border-red-200 rounded-lg text-red-700 font-medium text-base cursor-pointer hover:bg-red-100 transition"
        @click="markForgot"
      >
        完全不会
      </button>
    </div>

    <!-- 上一首 / 下一首 -->
    <div class="flex gap-3">
      <button
        :disabled="!props.canGoPrev"
        :class="['flex-1 p-3 rounded-lg text-base font-medium cursor-pointer transition', props.canGoPrev ? 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-gray-100 text-gray-300 cursor-not-allowed']"
        @click="emit('goPrev')"
      >上一首</button>
      <button
        :disabled="!hasAnyIssue"
        :class="['flex-1 p-3 rounded-lg text-base font-medium cursor-pointer transition', hasAnyIssue ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-gray-300 text-gray-500 cursor-not-allowed']"
        @click="submit"
      >下一首</button>
    </div>
  </div>
</template>
