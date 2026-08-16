<template>
  <div class="w-full max-w-md mx-auto p-4 overflow-x-hidden">
    <h2 class="text-xl font-bold text-center mb-4">古诗配置</h2>

    <div class="grade-tabs flex overflow-x-auto gap-1 mb-3 pb-1">
      <button
        v-for="grade in poemStore.grades"
        :key="grade"
        :class="['px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition', activeGrade === grade ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600']"
        @click="activeGrade = grade"
      >
        {{ grade }}
      </button>
    </div>

    <div class="flex gap-2 mb-3">
      <button
        class="px-3 py-1 text-sm border border-indigo-200 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
        @click="enableAllGrade"
      >
        全选
      </button>
      <button
        class="px-3 py-1 text-sm border border-gray-200 rounded bg-white text-gray-600 hover:bg-gray-50 transition"
        @click="disableAllGrade"
      >
        全不选
      </button>
    </div>

    <div v-if="currentPoems.length === 0" class="text-center text-gray-400 py-12">
      暂无古诗
    </div>

    <div v-else class="space-y-2">
      <div v-for="poem in currentPoems" :key="poem.id" class="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div class="flex items-center gap-2">
          <span
            class="font-bold flex-1 cursor-pointer text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300"
            @click="togglePopup(poem.id)"
          >
            {{ poem.title }}
          </span>
          <span class="text-sm text-gray-500">{{ poem.dynasty }}·{{ poem.author }}</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" class="sr-only peer" :checked="poemStore.isEnabled(poem.id)" @change="poemStore.togglePoem(poem.id)">
            <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
          </label>
        </div>
      </div>
    </div>

    <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 text-center text-sm text-gray-600">
      已启用 {{ poemStore.enabledCount }} / 共 {{ poemStore.poems.length }} 首
    </div>

    <PoemPopup
      v-if="popupPoem"
      :poem="popupPoem"
      v-model:visible="popupVisible"
    />

    <router-link :to="{ name: 'settings' }" class="block text-center text-indigo-500 no-underline text-sm mt-6 pb-16">返回设置</router-link>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePoemStore } from '@/stores/poem'
import PoemPopup from '@/components/PoemPopup.vue'
import type { Poem } from '@/types'

const poemStore = usePoemStore()

const activeGrade = ref('')

onMounted(async () => {
  await poemStore.fetchPoems()
  if (poemStore.grades.length > 0) {
    activeGrade.value = poemStore.grades[0]
  }
})

const currentPoems = computed(() => {
  return poemStore.poemsByGrade.get(activeGrade.value) ?? []
})

function enableAllGrade() {
  poemStore.toggleGrade(activeGrade.value, true)
}

function disableAllGrade() {
  poemStore.toggleGrade(activeGrade.value, false)
}

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
</script>
