<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Poem, RecitationResult } from '@/types'
import { useLearningStore } from '@/stores/learning'

const props = defineProps<{
  poem: Poem
  checked?: boolean
}>()

defineEmits<{
  checkedChange: [result: RecitationResult]
}>()

const learningStore = useLearningStore()

// 展开/收起状态
const expanded = ref(false)

// 译文
const showYiwen = ref(learningStore.settings.showYiwen ?? false)

// 每行标记状态
const lineStatuses = ref<{ lineIndex: number; status: 'ok' | 'stuck' | 'forgot' }[]>(
  props.poem.text.map((_, i) => ({ lineIndex: i, status: 'ok' as const }))
)
const authorCorrect = ref<boolean | null>(null)
const dynastyCorrect = ref<boolean | null>(null)

// 当 poem 变化时重置状态
watch(() => props.poem.id, () => {
  expanded.value = false
  lineStatuses.value = props.poem.text.map((_, i) => ({ lineIndex: i, status: 'ok' as const }))
  authorCorrect.value = null
  dynastyCorrect.value = null
  showYiwen.value = learningStore.settings.showYiwen ?? false
})

function toggleExpand() {
  expanded.value = !expanded.value
}

function toggleYiwen() {
  showYiwen.value = !showYiwen.value
  learningStore.updateSettings({ showYiwen: showYiwen.value })
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

// 获取当前标记结果（滑走时调用）
function getResult(): RecitationResult {
  const hasAnyIssue = lineStatuses.value.some(l => l.status !== 'ok')
    || authorCorrect.value === false
    || dynastyCorrect.value === false

  return {
    poemId: props.poem.id,
    overallStatus: hasAnyIssue ? 'not-mastered' : 'mastered',
    lines: hasAnyIssue ? lineStatuses.value.filter(l => l.status !== 'ok') : [],
    authorCorrect: authorCorrect.value,
    dynastyCorrect: dynastyCorrect.value,
  }
}

defineExpose({ getResult, expanded })
</script>

<template>
  <div class="poem-card h-full flex flex-col rounded-2xl overflow-hidden select-none" :class="expanded ? 'bg-white shadow-xl' : 'bg-gradient-to-br from-indigo-50 to-white shadow-lg'" @click="toggleExpand">
    <!-- 收起状态：只显示标题 -->
    <div v-if="!expanded" class="flex-1 flex flex-col items-center justify-center p-6 gap-3">
      <div class="w-12 h-1 rounded-full bg-indigo-200"></div>
      <h2 class="text-2xl font-bold text-center text-gray-800 tracking-wide">{{ poem.title }}</h2>
      <div class="w-8 h-1 rounded-full bg-indigo-100"></div>
      <span v-if="checked" class="text-xs text-indigo-400 mt-1">已查</span>
    </div>

    <!-- 展开状态：完整诗文 + 标记 -->
    <div v-else class="flex-1 flex flex-col overflow-y-auto p-5" @click.stop>
      <div class="text-center mb-3">
        <h2 class="text-xl font-bold text-gray-800 mb-1">{{ poem.title }}</h2>
        <p class="text-gray-400 text-sm">{{ poem.dynasty }} · {{ poem.author }}</p>
      </div>

      <!-- 逐行标记 -->
      <div class="flex-1 mb-3">
        <div
          v-for="(line, index) in poem.text"
          :key="index"
          class="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-b-0"
        >
          <span :class="['flex-1 text-sm leading-relaxed', lineStatuses[index].status === 'forgot' ? 'text-red-400 font-medium' : lineStatuses[index].status === 'stuck' ? 'text-amber-500' : 'text-gray-700']">{{ line }}</span>
          <div class="flex gap-1 shrink-0">
            <button
              :class="['px-1.5 py-0.5 text-xs rounded-md cursor-pointer transition-all', lineStatuses[index].status === 'stuck' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' : 'bg-gray-50 text-gray-300']"
              @click.stop="setLineStatus(index, lineStatuses[index].status === 'stuck' ? 'ok' : 'stuck')"
            >卡顿</button>
            <button
              :class="['px-1.5 py-0.5 text-xs rounded-md cursor-pointer transition-all', lineStatuses[index].status === 'forgot' ? 'bg-red-100 text-red-600 ring-1 ring-red-300' : 'bg-gray-50 text-gray-300']"
              @click.stop="setLineStatus(index, lineStatuses[index].status === 'forgot' ? 'ok' : 'forgot')"
            >不会</button>
          </div>
        </div>
      </div>

      <!-- 译文 -->
      <div class="text-center mb-2">
        <button
          :class="['px-3 py-1 text-xs rounded-lg cursor-pointer transition-all', showYiwen ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-400']"
          @click.stop="toggleYiwen"
        >
          {{ showYiwen ? '隐藏译文' : '显示译文' }}
        </button>
      </div>
      <div v-if="showYiwen" class="mb-2 p-3 bg-gray-50 rounded-xl text-center">
        <p class="text-xs leading-relaxed text-gray-400">{{ poem.yiwen }}</p>
      </div>

      <!-- 作者/朝代标记 -->
      <div class="flex items-center gap-3 justify-center pt-2 border-t border-gray-50">
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-gray-500">{{ poem.author }}</span>
          <button
            :class="['px-1.5 py-0.5 text-xs rounded-md cursor-pointer transition-all', authorCorrect === false ? 'bg-red-100 text-red-600 ring-1 ring-red-300' : 'bg-gray-50 text-gray-300']"
            @click.stop="toggleAuthorCorrect"
          >不会</button>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-gray-500">{{ poem.dynasty }}</span>
          <button
            :class="['px-1.5 py-0.5 text-xs rounded-md cursor-pointer transition-all', dynastyCorrect === false ? 'bg-red-100 text-red-600 ring-1 ring-red-300' : 'bg-gray-50 text-gray-300']"
            @click.stop="toggleDynastyCorrect"
          >不会</button>
        </div>
      </div>
    </div>
  </div>
</template>
