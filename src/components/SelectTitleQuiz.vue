<template>
  <div class="select-title-quiz">
    <p class="question-text">{{ question.prompt }}</p>
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
import type { QuizQuestion } from '@/types'

defineProps<{ question: QuizQuestion }>()
defineEmits<{ answer: [index: number] }>()
</script>
