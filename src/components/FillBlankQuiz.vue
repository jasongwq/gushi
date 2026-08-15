<template>
  <div class="fill-blank-quiz">
    <p class="poem-title">{{ poem?.title }} — {{ poem?.dynasty }}·{{ poem?.author }}</p>
    <p class="question-text">请选择正确的字填入空缺处：</p>
    <p class="poem-text">{{ displayPrompt }}</p>
    <div class="options">
      <button
        v-for="(opt, i) in question.options"
        :key="i"
        @click="$emit('answer', i)"
        class="option-btn"
      >
        {{ opt }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { QuizQuestion } from '@/types'
import { usePoemStore } from '@/stores/poem'

const props = defineProps<{ question: QuizQuestion }>()
defineEmits<{ answer: [index: number] }>()
const poemStore = usePoemStore()
const poem = computed(() => poemStore.getPoemById(props.question.poemId))

const displayPrompt = computed(() => {
  if (!props.question.blankPositions || props.question.blankPositions.length === 0) {
    return props.question.prompt
  }
  const lines = props.question.prompt.split('\n')
  const blankSet = new Set(props.question.blankPositions)
  let charIndex = 0
  const result: string[] = []

  for (const line of lines) {
    let displayed = ''
    for (const ch of line) {
      if (/[\u4e00-\u9fff]/.test(ch)) {
        if (blankSet.has(charIndex)) {
          displayed += '____'
        } else {
          displayed += ch
        }
        charIndex++
      } else {
        displayed += ch
      }
    }
    result.push(displayed)
  }

  return result.join('\n')
})
</script>
