<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Poem } from '@/types'

const props = defineProps<{
  poem: Poem
  checked?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

// 展开/收起状态
const expanded = ref(false)

// 当 poem 变化时重置状态
watch(() => props.poem.id, () => {
  expanded.value = false
})

function toggleExpand() {
  expanded.value = !expanded.value
  emit('click')
}

defineExpose({ expanded })
</script>

<template>
  <div class="poem-card h-full flex flex-col rounded-2xl overflow-hidden select-none" :class="expanded ? 'bg-white shadow-xl' : 'bg-gradient-to-br from-indigo-50 to-white shadow-lg'" @click="toggleExpand">
    <!-- 收起状态：只显示标题 -->
    <div v-if="!expanded" class="flex-1 flex flex-col items-center justify-center p-5 gap-2">
      <div class="w-10 h-1 rounded-full bg-indigo-200"></div>
      <h2 class="text-xl font-bold text-center text-gray-800 tracking-wide">{{ poem.title }}</h2>
      <div class="w-6 h-1 rounded-full bg-indigo-100"></div>
      <span v-if="checked" class="text-xs text-indigo-400 mt-1">已查</span>
    </div>

    <!-- 展开状态：标题 + 提示 -->
    <div v-else class="flex-1 flex flex-col items-center justify-center p-5 gap-2">
      <h2 class="text-xl font-bold text-center text-gray-800 tracking-wide">{{ poem.title }}</h2>
      <p class="text-gray-400 text-sm">{{ poem.dynasty }} · {{ poem.author }}</p>
      <div class="w-6 h-1 rounded-full bg-indigo-100"></div>
      <span class="text-xs text-indigo-400 mt-2">点击进入详情</span>
    </div>
  </div>
</template>
