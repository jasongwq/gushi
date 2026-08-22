<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Poem, RecitationResult } from '@/types'
import { useLearningStore } from '@/stores/learning'
import { parseLine } from '@/utils/charMark'

const props = defineProps<{
  poem: Poem
  canGoPrev?: boolean
  revealMode?: boolean
  revealStep?: number
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [result: RecitationResult]
  goPrev: []
  revealStepChange: []
}>()

const revealStep = computed(() => {
  if (!props.revealMode) return 3 // 非揭示模式一切照常
  return Math.max(0, Math.min(3, props.revealStep ?? 0))
})

const revealHint = computed(() => {
  if (!props.revealMode) return ''
  switch (revealStep.value) {
    case 0: return '点击查看作者'
    case 1: return '点击查看译文'
    case 2: return '点击查看正文'
    default: return ''
  }
})

function handleBackgroundClick() {
  if (!props.revealMode) return
  if (props.disabled) return
  if (revealStep.value >= 3) return
  emit('revealStepChange')
}

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

// 当前诗的字级标记状态（按诗隔离，直接读 store）
function charMarkClass(lineIndex: number, charIdx: number): string {
  const status = learningStore.getCharMarks(props.poem.id)[`${lineIndex}-${charIdx}`]
  if (status === 'fuzzy') return 'char-fuzzy'
  if (status === 'wrong') return 'char-wrong'
  return ''
}

function toggleCharMark(lineIndex: number, charIdx: number) {
  if (props.disabled) return
  learningStore.toggleCharMark(props.poem.id, lineIndex, charIdx)
  // 字级标记即时保存：同步待聚合快照 + 待调度标记
  learningStore.syncPendingCharMarks(props.poem.id, { ...learningStore.getCharMarks(props.poem.id) })
  syncPending()
}

// 当 poem 变化时重置状态
watch(() => props.poem.id, () => {
  lineStatuses.value = props.poem.text.map((_, i) => ({ lineIndex: i, status: 'ok' as const }))
  authorCorrect.value = null
  dynastyCorrect.value = null
  showYiwen.value = learningStore.settings.showYiwen ?? false
  // 切换古诗时仅重置当前诗的字级标记（不影响其他诗）
  learningStore.initCharMarks(props.poem.id)
})

// 整首熟练：所有行都ok，作者/朝代都没标错
function markMastered() {
  if (props.disabled) return
  lineStatuses.value = props.poem.text.map((_, i) => ({ lineIndex: i, status: 'ok' as const }))
  authorCorrect.value = null
  dynastyCorrect.value = null
  submitResult('mastered')
}

// 完全不会：所有行都标不会
function markForgot() {
  if (props.disabled) return
  lineStatuses.value = props.poem.text.map((_, i) => ({ lineIndex: i, status: 'forgot' as const }))
  authorCorrect.value = false
  dynastyCorrect.value = false
  submitResult('not-mastered')
}

function setLineStatus(index: number, status: 'ok' | 'stuck' | 'forgot') {
  if (props.disabled) return
  const prev = lineStatuses.value[index].status
  lineStatuses.value[index] = { lineIndex: index, status }
  const note = `第${index + 1}句:${status}`
  const prevNote = `第${index + 1}句:${prev}`
  if (status === 'stuck' || status === 'forgot') {
    if (prev !== status) learningStore.recordDetail(props.poem.id, 'line', note)
  } else {
    learningStore.removeWrongEntry(props.poem.id, 'line', prevNote)
  }
  syncPending()
}

function toggleAuthorCorrect() {
  if (props.disabled) return
  if (authorCorrect.value === null) authorCorrect.value = false
  else if (authorCorrect.value === false) authorCorrect.value = true
  else authorCorrect.value = null
  if (authorCorrect.value === false) {
    learningStore.recordDetail(props.poem.id, 'author')
  } else {
    learningStore.removeWrongEntry(props.poem.id, 'author')
  }
  syncPending()
}

function toggleDynastyCorrect() {
  if (props.disabled) return
  if (dynastyCorrect.value === null) dynastyCorrect.value = false
  else if (dynastyCorrect.value === false) dynastyCorrect.value = true
  else dynastyCorrect.value = null
  if (dynastyCorrect.value === false) {
    learningStore.recordDetail(props.poem.id, 'dynasty')
  } else {
    learningStore.removeWrongEntry(props.poem.id, 'dynasty')
  }
  syncPending()
}

// 显式计算当前是否有异常（computed 惰性求值，函数内同步调用需用显式计算）
function computeHasIssue(): boolean {
  const hasLineIssue = lineStatuses.value.some(l => l.status !== 'ok')
  const hasAuthorIssue = authorCorrect.value === false
  const hasDynastyIssue = dynastyCorrect.value === false
  const hasCharIssue = Object.keys(learningStore.getCharMarks(props.poem.id)).length > 0
  return hasLineIssue || hasAuthorIssue || hasDynastyIssue || hasCharIssue
}

// 同步待调度标记：有异常则记入，全清则移除
function syncPending() {
  learningStore.syncPendingReciteSchedule(props.poem.id, computeHasIssue())
}

const hasAnyIssue = computed(() => computeHasIssue())

function submit() {
  if (props.disabled) return
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
    charMarks: { ...learningStore.getCharMarks(props.poem.id) },
  }
  emit('submit', result)
  // 提交后重置当前诗的字级标记（不影响其他诗）
  learningStore.initCharMarks(props.poem.id)
}
</script>

<template>
  <div
    class="recitation-card py-2 w-full flex flex-col h-full"
    :class="{ 'reveal-dashed': revealMode && revealStep < 3 }"
    @click="handleBackgroundClick"
  >
    <div class="text-center mb-4 shrink-0">
      <h2 class="text-2xl font-bold mb-1">{{ poem.title }}</h2>
      <div v-if="revealStep >= 1" class="flex items-center justify-center gap-4 text-gray-500 text-sm">
        <span>{{ poem.dynasty }} · {{ poem.author }}</span>
        <div class="flex items-center gap-2">
          <button
            data-testid="btn-author-forgot"
            :disabled="disabled"
            :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', authorCorrect === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
            @click.stop="toggleAuthorCorrect"
          >作者不会</button>
          <button
            data-testid="btn-dynasty-forgot"
            :disabled="disabled"
            :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', dynastyCorrect === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
            @click.stop="toggleDynastyCorrect"
          >朝代不会</button>
        </div>
      </div>
      <p v-else class="text-gray-400 text-sm mt-1">作者 · ？？</p>
    </div>

    <!-- 正文区：全诗原文 + 逐句标记 + 译文，独立滚动 -->
    <!-- data-scroll-area：语义标记，供 PoemCardPage 手势逻辑识别滚动区（避免依赖展示类名） -->
    <div v-if="revealStep >= 3" data-scroll-area class="flex-1 min-h-0 overflow-y-auto mb-4">
      <div class="mb-4">
        <div
          v-for="(line, index) in poem.text"
          :key="index"
          class="flex items-center gap-2 py-2 border-b border-gray-100 last:border-b-0"
        >
          <span :class="['flex-1 text-lg min-w-0 break-all', lineStatuses[index].status === 'forgot' ? 'text-red-400' : lineStatuses[index].status === 'stuck' ? 'text-yellow-600' : '']">
            <template v-for="(segment, i) in parseLine(line)" :key="i">
              <span
                v-if="segment.type === 'char'"
                class="char-mark"
                :class="charMarkClass(index, segment.charIdx ?? 0)"
                @click.stop="toggleCharMark(index, segment.charIdx ?? 0)"
              >{{ segment.char }}</span>
              <span v-else class="punct">{{ segment.char }}</span>
            </template>
          </span>
          <div class="flex gap-1 shrink-0">
            <button
              :disabled="disabled"
              :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', lineStatuses[index].status === 'stuck' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 bg-white text-gray-400']"
              @click.stop="setLineStatus(index, lineStatuses[index].status === 'stuck' ? 'ok' : 'stuck')"
            >卡顿</button>
            <button
              :disabled="disabled"
              :class="['px-2 py-1 text-xs rounded border-2 cursor-pointer transition', lineStatuses[index].status === 'forgot' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-400']"
              @click.stop="setLineStatus(index, lineStatuses[index].status === 'forgot' ? 'ok' : 'forgot')"
            >不会</button>
          </div>
        </div>
      </div>

      <!-- 译文 -->
      <div v-if="!revealMode" class="mb-3 text-center">
        <button
          :class="['px-3 py-1.5 text-xs rounded-lg border-2 cursor-pointer transition', showYiwen ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-indigo-200 bg-indigo-50 text-indigo-600']"
          @click.stop="toggleYiwen"
        >
          {{ showYiwen ? '隐藏译文 ▴' : '显示译文 ▾' }}
        </button>
      </div>
      <!-- 非揭示模式：译文仍在正文滚动区内，行为不变 -->
      <div v-if="!revealMode && showYiwen" class="mb-3 p-3 bg-gray-50 rounded-lg text-center">
        <p class="text-sm leading-relaxed text-gray-500">{{ poem.yiwen }}</p>
      </div>
    </div>

    <!-- 揭示模式：译文在 step 2 直接显示（滚动区外） -->
    <div v-if="revealMode && revealStep >= 2" class="mb-3 p-3 bg-gray-50 rounded-lg text-center">
      <p class="text-sm leading-relaxed text-gray-500">{{ poem.yiwen }}</p>
    </div>

    <!-- 揭示提示 -->
    <div v-if="revealMode && revealStep < 3" class="text-center text-indigo-500 text-sm mt-3 shrink-0">
      {{ revealHint }}
    </div>

    <!-- 操作按钮 -->
    <div v-if="revealStep >= 3" class="flex gap-3 mb-3 shrink-0">
      <button
        data-testid="btn-mastered"
        :disabled="disabled"
        class="flex-1 p-3 bg-green-50 border-2 border-green-200 rounded-lg text-green-700 font-medium text-base cursor-pointer hover:bg-green-100 transition"
        @click.stop="markMastered"
      >
        熟练
      </button>
      <button
        data-testid="btn-forgot"
        :disabled="disabled"
        class="flex-1 p-3 bg-red-50 border-2 border-red-200 rounded-lg text-red-700 font-medium text-base cursor-pointer hover:bg-red-100 transition"
        @click.stop="markForgot"
      >
        完全不会
      </button>
    </div>

    <!-- 上一首 / 下一首 -->
    <div v-if="!revealMode" class="flex gap-3 shrink-0">
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

<style scoped>
.reveal-dashed {
  border: 2px dashed var(--color-primary, #6366f1);
  border-radius: 12px;
  padding: 16px;
  background: #fafbff;
  cursor: pointer;
  transition: border-color 0.2s;
}
.char-fuzzy {
  background: #fef3c7;
  color: #d97706;
  border-radius: 3px;
  padding: 0 1px;
}
.char-wrong {
  background: #fecaca;
  color: #dc2626;
  border-radius: 3px;
  padding: 0 1px;
}
.punct {
  pointer-events: none;
  user-select: none;
}
</style>
