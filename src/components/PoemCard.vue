<script setup lang="ts">
import type { Poem } from '@/types'

defineProps<{
  poem: Poem
  checked?: boolean
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <div class="poem-card h-full flex flex-col items-center justify-center rounded-2xl overflow-hidden select-none bg-gradient-to-br from-indigo-50 to-white shadow-lg" @click="$emit('click')">
    <div class="flex-1 flex flex-col items-center justify-center p-5 gap-2">
      <div class="w-10 h-1 rounded-full bg-indigo-200"></div>
      <h2 class="text-xl font-bold text-center text-gray-800 tracking-wide">{{ poem.title }}</h2>
      <div class="w-6 h-1 rounded-full bg-indigo-100"></div>
      <p class="text-gray-400 text-sm">{{ poem.dynasty }} · {{ poem.author }}</p>
      <span v-if="checked" class="text-xs text-indigo-400 mt-1">已查</span>
    </div>
  </div>
</template>
