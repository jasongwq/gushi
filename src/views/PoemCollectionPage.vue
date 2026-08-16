<template>
  <div class="max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-4">古诗集合</h2>

    <!-- 搜索框 -->
    <div class="relative mb-4">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索古诗…"
        class="w-full pl-9 pr-8 py-2 bg-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-300 transition"
      />
      <button
        v-if="searchQuery"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        @click="clearSearch"
      >
        <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- 分类切换 -->
    <div v-if="!isSearching" class="flex gap-2 mb-4">
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
    <template v-if="!isSearching && categoryMode === 'grade'">
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
    <template v-else-if="!isSearching">
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

    <div v-if="displayPoems.length === 0" class="text-center text-gray-400 py-12">
      {{ isSearching ? '未找到相关古诗' : '暂无古诗' }}
    </div>

    <div v-else class="space-y-2">
      <div v-for="poem in displayPoems" :key="poem.id" class="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
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
import { searchPoems } from '@/utils/search'

const poemStore = usePoemStore()
const learningStore = useLearningStore()

const categoryMode = ref<'grade' | 'author'>('grade')
const activeGrade = ref('')
const activeAuthor = ref('')

const searchQuery = ref('')

const isSearching = computed(() => searchQuery.value.trim().length > 0)

const searchResults = computed(() => {
  if (!isSearching.value) return []
  return searchPoems(poemStore.enabledPoems, searchQuery.value.trim())
})

const displayPoems = computed(() => {
  if (isSearching.value) return searchResults.value
  if (categoryMode.value === 'grade') {
    return poemStore.poemsByGrade.get(activeGrade.value) ?? []
  } else {
    return poemStore.poemsByAuthor.get(activeAuthor.value) ?? []
  }
})

function clearSearch() {
  searchQuery.value = ''
}

onMounted(async () => {
  await poemStore.fetchPoems()
  if (poemStore.grades.length > 0) {
    activeGrade.value = poemStore.grades[0]
  }
  if (poemStore.authors.length > 0) {
    activeAuthor.value = poemStore.authors[0]
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
