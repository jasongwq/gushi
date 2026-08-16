<template>
  <div class="next-line-quiz">
    <div class="text-center mb-4">
      <h2 class="text-2xl font-bold mb-1">
        <span class="cursor-pointer text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300" @click="popupVisible = !popupVisible">{{ poem?.title }}</span>
      </h2>
      <p class="text-gray-500">{{ poem?.dynasty }} · {{ poem?.author }}</p>
    </div>
    <p class="question-text">{{ question.prompt }}</p>
    <div class="options">
      <button
        v-for="(opt, i) in question.options"
        :key="i"
        :disabled="disabled && i !== selectedOption"
        :class="[
          'option-btn',
          optionClass(i),
        ]"
        @click="$emit('answer', i)"
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

const props = withDefaults(defineProps<{
  question: QuizQuestion
  selectedOption?: number | null
  disabled?: boolean
}>(), {
  selectedOption: null,
  disabled: false,
})

defineEmits<{ answer: [index: number] }>()
const poemStore = usePoemStore()
const poem = computed(() => poemStore.getPoemById(props.question.poemId))

const popupVisible = ref(false)
const popupPoemId = ref(props.question.poemId)

const popupPoem = computed<Poem | undefined>(() => {
  return poemStore.getPoemById(popupPoemId.value)
})

function optionClass(i: number): string {
  if (props.selectedOption === null) return ''
  if (i === props.question.correctIndex) return 'option-correct'
  if (i === props.selectedOption && i !== props.question.correctIndex) return 'option-wrong'
  if (props.disabled) return 'option-dimmed'
  return ''
}
</script>

<style scoped>
.option-correct {
  background: #22c55e !important;
  color: white !important;
  border-color: #22c55e !important;
}
.option-wrong {
  background: #ef4444 !important;
  color: white !important;
  border-color: #ef4444 !important;
}
.option-dimmed {
  opacity: 0.4;
}
</style>
