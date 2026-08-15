<template>
  <div class="next-line-quiz">
    <p class="poem-title">
      <span class="cursor-pointer text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300" @click="popupVisible = !popupVisible">{{ poem?.title }}</span>
      — {{ poem?.dynasty }}·{{ poem?.author }}
    </p>
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
    <PoemPopup v-if="popupPoem" :poem="popupPoem" v-model:visible="popupVisible" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import PoemPopup from '@/components/PoemPopup.vue'
import type { QuizQuestion } from '@/types'
import type { Poem } from '@/types'
import { usePoemStore } from '@/stores/poem'

const props = defineProps<{ question: QuizQuestion }>()
defineEmits<{ answer: [index: number] }>()
const poemStore = usePoemStore()
const poem = computed(() => poemStore.getPoemById(props.question.poemId))

const popupVisible = ref(false)
const popupPoemId = ref(props.question.poemId)

const popupPoem = computed<Poem | undefined>(() => {
  return poemStore.getPoemById(popupPoemId.value)
})
</script>
