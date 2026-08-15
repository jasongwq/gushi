<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Poem, RecitationResult, RecitationLineResult } from '@/types'

const props = defineProps<{
  poem: Poem
}>()

const emit = defineEmits<{
  submit: [result: RecitationResult]
}>()

const expanded = ref(false)
const overallStatus = ref<'mastered' | 'not-mastered' | null>(null)
const lineStatuses = ref<{ lineIndex: number; status: 'ok' | 'stuck' | 'forgot' }[]>(
  props.poem.text.map((_, i) => ({ lineIndex: i, status: 'ok' as const }))
)
const authorCorrect = ref<boolean | null>(null)
const dynastyCorrect = ref<boolean | null>(null)
const showAuthor = ref(false)
const showDynasty = ref(false)

// 当 poem 变化时重置状态
watch(() => props.poem.id, () => {
  expanded.value = false
  overallStatus.value = null
  lineStatuses.value = props.poem.text.map((_, i) => ({ lineIndex: i, status: 'ok' as const }))
  authorCorrect.value = null
  dynastyCorrect.value = null
  showAuthor.value = false
  showDynasty.value = false
})

function markMastered() {
  overallStatus.value = 'mastered'
  expanded.value = false
}

function markNotMastered() {
  overallStatus.value = 'not-mastered'
  expanded.value = true
}

function setLineStatus(index: number, status: 'ok' | 'stuck' | 'forgot') {
  lineStatuses.value[index] = { lineIndex: index, status }
}

const canSubmit = computed(() => overallStatus.value !== null)

function submit() {
  if (!overallStatus.value) return

  const result: RecitationResult = {
    poemId: props.poem.id,
    overallStatus: overallStatus.value,
    lines: overallStatus.value === 'not-mastered'
      ? lineStatuses.value.filter(l => l.status !== 'ok')
      : [],
    authorCorrect: showAuthor.value ? authorCorrect.value : null,
    dynastyCorrect: showDynasty.value ? dynastyCorrect.value : null,
  }
  emit('submit', result)
}
</script>

<template>
  <div class="recitation-card">
    <div class="text-center mb-6">
      <h2 class="text-3xl font-bold mb-2">{{ poem.title }}</h2>
      <p class="text-gray-500">{{ poem.dynasty }} · {{ poem.author }}</p>
    </div>

    <!-- 整首熟练 / 不熟练 -->
    <div v-if="!overallStatus" class="flex gap-3 mb-6">
      <button
        class="flex-1 p-4 bg-green-50 border-2 border-green-200 rounded-lg text-green-700 font-medium text-lg cursor-pointer hover:bg-green-100 transition"
        @click="markMastered"
      >
        ✓ 整首熟练
      </button>
      <button
        class="flex-1 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700 font-medium text-lg cursor-pointer hover:bg-red-100 transition"
        @click="markNotMastered"
      >
        ✗ 有不熟练
      </button>
    </div>

    <!-- 已选状态 -->
    <div v-else class="mb-4 text-center">
      <span v-if="overallStatus === 'mastered'" class="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium">
        ✓ 整首熟练
      </span>
      <span v-else class="inline-block px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium">
        ✗ 有不熟练
      </span>
    </div>

    <!-- 展开原文逐句判定 -->
    <div v-if="expanded" class="mb-6">
      <div
        v-for="(line, index) in poem.text"
        :key="index"
        class="flex items-center gap-2 py-3 border-b border-gray-100 last:border-b-0"
      >
        <span class="flex-1 text-lg">{{ line }}</span>
        <div class="flex gap-1 shrink-0">
          <button
            :class="['px-2 py-1 text-sm rounded border-2 cursor-pointer transition', lineStatuses[index].status === 'ok' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-400']"
            @click="setLineStatus(index, 'ok')"
          >✓</button>
          <button
            :class="['px-2 py-1 text-sm rounded border-2 cursor-pointer transition', lineStatuses[index].status === 'stuck' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 bg-white text-gray-400']"
            @click="setLineStatus(index, 'stuck')"
          >⏸</button>
          <button
            :class="['px-2 py-1 text-sm rounded border-2 cursor-pointer transition', lineStatuses[index].status === 'forgot' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
            @click="setLineStatus(index, 'forgot')"
          >✗</button>
        </div>
      </div>
    </div>

    <!-- 作者/朝代附加项 -->
    <div class="mb-6">
      <div class="flex gap-3 mb-3">
        <button
          v-if="!showAuthor"
          class="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-pointer hover:bg-gray-50 transition"
          @click="showAuthor = true; authorCorrect = null"
        >标记作者</button>
        <button
          v-if="!showDynasty"
          class="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-pointer hover:bg-gray-50 transition"
          @click="showDynasty = true; dynastyCorrect = null"
        >标记朝代</button>
      </div>

      <div v-if="showAuthor" class="flex items-center gap-2 mb-2">
        <span class="text-sm text-gray-600">作者（{{ poem.author }}）：</span>
        <button
          :class="['px-2 py-1 text-sm rounded border-2 cursor-pointer transition', authorCorrect === true ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-400']"
          @click="authorCorrect = true"
        >✓</button>
        <button
          :class="['px-2 py-1 text-sm rounded border-2 cursor-pointer transition', authorCorrect === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
          @click="authorCorrect = false"
        >✗</button>
      </div>

      <div v-if="showDynasty" class="flex items-center gap-2 mb-2">
        <span class="text-sm text-gray-600">朝代（{{ poem.dynasty }}）：</span>
        <button
          :class="['px-2 py-1 text-sm rounded border-2 cursor-pointer transition', dynastyCorrect === true ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-400']"
          @click="dynastyCorrect = true"
        >✓</button>
        <button
          :class="['px-2 py-1 text-sm rounded border-2 cursor-pointer transition', dynastyCorrect === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
          @click="dynastyCorrect = false"
        >✗</button>
      </div>
    </div>

    <!-- 提交 -->
    <button
      :disabled="!canSubmit"
      :class="['w-full p-4 rounded-lg text-lg font-medium cursor-pointer transition', canSubmit ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-gray-300 text-gray-500 cursor-not-allowed']"
      @click="submit"
    >
      下一首
    </button>
  </div>
</template>
