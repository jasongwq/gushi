<template>
  <div class="next-line-quiz">
    <p class="poem-title">{{ poem?.title }} — {{ poem?.dynasty }}·{{ poem?.author }}</p>
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
import { computed } from 'vue'
import type { QuizQuestion } from '@/types'
import { usePoemStore } from '@/stores/poem'

const props = defineProps<{ question: QuizQuestion }>()
defineEmits<{ answer: [index: number] }>()
const poemStore = usePoemStore()
const poem = computed(() => poemStore.getPoemById(props.question.poemId))
</script>
