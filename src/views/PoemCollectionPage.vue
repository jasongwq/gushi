<template>
  <div class="max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-4">古诗集合</h2>

    <!-- 分类切换 -->
    <div class="flex gap-2 mb-4">
      <button
        :class="['flex-1 p-2 rounded-lg text-sm font-medium transition', categoryMode === 'grade' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600']"
        @click="categoryMode = 'grade'"
      >按年级</button>
      <button
        :class="['flex-1 p-2 rounded-lg text-sm font-medium transition', categoryMode === 'author' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600']"
        @click="categoryMode = 'author'"
      >按诗人</button>
    </div>

    <!-- 按年级 -->
    <template v-if="categoryMode === 'grade'">
      <div class="grade-tabs flex overflow-x-auto gap-1 mb-4 pb-1">
        <button
          v-for="grade in poemStore.grades"
          :key="grade"
          :class="['px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition', activeGrade === grade ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600']"
          @click="activeGrade = grade"
        >
          {{ grade }}
        </button>
      </div>
    </template>

    <!-- 按诗人 -->
    <template v-else>
      <div class="grade-tabs flex overflow-x-auto gap-1 mb-4 pb-1">
        <button
          v-for="author in poemStore.authors"
          :key="author"
          :class="['px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition', activeAuthor === author ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600']"
          @click="activeAuthor = author"
        >
          {{ author }}({{ poemStore.poemsByAuthor.get(author)?.length ?? 0 }})
        </button>
      </div>
    </template>

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
          <span :class="['text-xs px-1.5 py-0.5 rounded', masteryClass(poem.id)]">
            {{ learningStore.getMasteryLevel(poem.id) }}
          </span>
        </div>
      </div>
    </div>

    <PoemPopup
      v-if="popupPoem"
      :poem="popupPoem"
      v-model:visible="popupVisible"
    />

    <router-link :to="{ name: 'home' }" class="block text-center text-indigo-500 no-underline text-sm mt-6">返回首页</router-link>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import PoemPopup from '@/components/PoemPopup.vue'
import type { Poem } from '@/types'

const poemStore = usePoemStore()
const learningStore = useLearningStore()

const categoryMode = ref<'grade' | 'author'>('grade')
const activeGrade = ref('')
const activeAuthor = ref('')

onMounted(async () => {
  await poemStore.fetchPoems()
  if (poemStore.grades.length > 0) {
    activeGrade.value = poemStore.grades[0]
  }
  if (poemStore.authors.length > 0) {
    activeAuthor.value = poemStore.authors[0]
  }
})

const currentPoems = computed(() => {
  if (categoryMode.value === 'grade') {
    return poemStore.poemsByGrade.get(activeGrade.value) ?? []
  } else {
    return poemStore.poemsByAuthor.get(activeAuthor.value) ?? []
  }
})

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

function masteryClass(poemId: string): string {
  const level = learningStore.getMasteryLevel(poemId)
  switch (level) {
    case '新': return 'bg-gray-100 text-gray-500'
    case '学': return 'bg-blue-100 text-blue-600'
    case '熟': return 'bg-green-100 text-green-600'
    case '固': return 'bg-indigo-100 text-indigo-600'
    default: return 'bg-gray-100 text-gray-500'
  }
}
</script>
