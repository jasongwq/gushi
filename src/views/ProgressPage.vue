<script setup lang="ts">
import { computed } from 'vue'
import { useLearningStore } from '@/stores/learning'
import { usePoemStore } from '@/stores/poem'
import type { MasteryLevel } from '@/types'

const learningStore = useLearningStore()
const poemStore = usePoemStore()

const totalPoems = computed(() => poemStore.poems.length)

const learnedCount = computed(() => {
  return learningStore.records.filter(r => r.masteryLevel !== '新').length
})

const masteryDistribution = computed(() => {
  const levels: MasteryLevel[] = ['新', '学', '熟', '固']
  return levels.map(level => ({
    level,
    count: learningStore.records.filter(r => r.masteryLevel === level).length,
  }))
})

const masteryColors: Record<string, string> = {
  '新': 'bg-gray-100 text-gray-500',
  '学': 'bg-blue-100 text-blue-600',
  '熟': 'bg-green-100 text-green-600',
  '固': 'bg-orange-100 text-orange-600',
}
</script>

<template>
  <div class="max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-6">学习进度</h2>

    <div class="text-center p-4 bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
      <div class="text-3xl font-bold text-indigo-500">{{ learnedCount }} / {{ totalPoems }}</div>
      <div class="text-sm text-gray-500 mt-1">已学 / 总数</div>
    </div>

    <div class="mb-4">
      <h3 class="text-sm text-gray-500 mb-2">掌握程度分布</h3>
      <div class="flex gap-3 justify-center">
        <div v-for="item in masteryDistribution" :key="item.level" class="flex flex-col items-center gap-1 p-3 bg-white border border-gray-200 rounded-lg shadow-sm min-w-[60px]">
          <span :class="['text-xl font-bold px-2 py-0.5 rounded', masteryColors[item.level]]">{{ item.level }}</span>
          <span class="text-lg font-bold">{{ item.count }}</span>
        </div>
      </div>
    </div>

    <div class="text-center p-4 bg-white border border-gray-200 rounded-lg shadow-sm mb-6">
      <div class="text-3xl font-bold text-orange-500">{{ learningStore.unproficientCount }}</div>
      <div class="text-sm text-gray-500 mt-1">不熟练</div>
    </div>

    <router-link :to="{ name: 'home' }" class="block text-center text-indigo-500 no-underline text-sm mt-6">返回首页</router-link>
  </div>
</template>
