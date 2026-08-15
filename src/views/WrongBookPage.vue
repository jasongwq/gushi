<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLearningStore } from '@/stores/learning'
import { usePoemStore } from '@/stores/poem'
import PoemPopup from '@/components/PoemPopup.vue'
import type { Poem } from '@/types'

const learningStore = useLearningStore()
const poemStore = usePoemStore()

const popupVisible = ref(false)
const popupPoemId = ref('')

const popupPoem = computed<Poem | undefined>(() => {
  if (!popupPoemId.value) return undefined
  return poemStore.getPoemById(popupPoemId.value)
})

function togglePopup(poemId: string) {
  if (popupPoemId.value === poemId && popupVisible.value) {
    popupVisible.value = false
  } else {
    popupPoemId.value = poemId
    popupVisible.value = true
  }
}

const quizTypeLabels: Record<string, string> = {
  fillBlank: '补字选择',
  nextLine: '上下句接龙',
  recite: '背诵',
}

function getPoemTitle(poemId: string): string {
  return poemStore.getPoemById(poemId)?.title ?? ''
}
</script>

<template>
  <div class="max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-6">错题本</h2>

    <div v-if="learningStore.wrongBook.length === 0" class="text-center text-gray-400 py-12">
      暂无错题
    </div>

    <div v-else class="mb-6">
      <div v-for="entry in learningStore.wrongBook" :key="entry.poemId + entry.quizType" class="p-3 bg-white border border-gray-200 rounded-lg mb-2 shadow-sm">
        <div class="flex items-center gap-2 mb-2">
          <span class="font-bold flex-1 cursor-pointer text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300" @click="togglePopup(entry.poemId)">{{ getPoemTitle(entry.poemId) }}</span>
          <span class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{{ quizTypeLabels[entry.quizType] ?? entry.quizType }}</span>
          <span class="text-xs text-red-500">错 {{ entry.wrongCount }} 次</span>
        </div>
        <div class="flex gap-2">
          <button
            :class="['px-3 py-1 text-xs border rounded transition', entry.unproficient ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 bg-white text-gray-600']"
            @click="learningStore.toggleUnproficient(entry.poemId)"
          >
            {{ entry.unproficient ? '已标不熟练' : '标不熟练' }}
          </button>
          <button class="px-3 py-1 text-xs border border-gray-200 rounded bg-white text-gray-500 hover:bg-gray-50 transition" @click="learningStore.removeWrongEntry(entry.poemId, entry.quizType)">
            移除
          </button>
        </div>
      </div>
    </div>

    <PoemPopup v-if="popupPoem" :poem="popupPoem" v-model:visible="popupVisible" />

    <router-link :to="{ name: 'home' }" class="block text-center text-indigo-500 no-underline text-sm">返回首页</router-link>
  </div>
</template>
