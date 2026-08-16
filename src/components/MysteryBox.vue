<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Poem } from '@/types'

const props = defineProps<{
  poems: Poem[]
}>()

const emit = defineEmits<{
  revealed: [poem: Poem]
}>()

// 盲盒状态
type BoxState = 'closed' | 'opening' | 'revealed'
const boxes = ref<{ poem: Poem | null; state: BoxState }[]>([])

const isReady = ref(false)

function initBoxes() {
  if (props.poems.length === 0) return
  // 从诗列表中随机选4首（不重复）
  const available = [...props.poems]
  const selected: Poem[] = []
  for (let i = 0; i < 4 && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length)
    selected.push(available.splice(idx, 1)[0])
  }
  // 不够4首则用已有的循环填充
  while (selected.length < 4) {
    selected.push(props.poems[Math.floor(Math.random() * props.poems.length)])
  }
  boxes.value = selected.map(poem => ({ poem, state: 'closed' as BoxState }))
  isReady.value = true
}

// 初始化
initBoxes()

function openBox(index: number) {
  const box = boxes.value[index]
  if (!box || box.state !== 'closed') return

  box.state = 'opening'

  // 动画结束后显示结果
  setTimeout(() => {
    box.state = 'revealed'
    if (box.poem) {
      emit('revealed', box.poem)
    }
  }, 800)
}

function refresh() {
  initBoxes()
}

const allRevealed = computed(() => boxes.value.length > 0 && boxes.value.every(b => b.state === 'revealed'))
</script>

<template>
  <div class="mystery-boxes flex flex-col items-center justify-center h-full gap-4">
    <div class="grid grid-cols-2 gap-4 w-full max-w-xs">
      <button
        v-for="(box, index) in boxes"
        :key="index"
        class="aspect-square rounded-2xl flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 cursor-pointer"
        :class="{
          'bg-gradient-to-br from-indigo-400 to-purple-500 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95': box.state === 'closed',
          'bg-gradient-to-br from-indigo-300 to-purple-400 animate-pulse': box.state === 'opening',
          'bg-gradient-to-br from-amber-50 to-yellow-50 shadow-md ring-2 ring-amber-300': box.state === 'revealed',
        }"
        :disabled="box.state !== 'closed'"
        @click="openBox(index)"
      >
        <!-- 关闭状态：问号盒子 -->
        <template v-if="box.state === 'closed'">
          <span class="text-5xl text-white font-bold drop-shadow-lg">?</span>
          <span class="text-xs text-white/70 mt-1">第{{ index + 1 }}盒</span>
        </template>

        <!-- 开启动画：闪烁 -->
        <template v-if="box.state === 'opening'">
          <div class="sparkle-card">
            <div class="sparkle"></div>
            <div class="sparkle"></div>
            <div class="sparkle"></div>
            <div class="sparkle"></div>
            <span class="text-4xl text-white font-bold">✨</span>
          </div>
        </template>

        <!-- 揭示状态：古诗标题 -->
        <template v-if="box.state === 'revealed' && box.poem">
          <div class="flex flex-col items-center gap-1 p-2">
            <span class="text-2xl mb-1">📜</span>
            <span class="text-sm font-bold text-gray-800 text-center leading-tight">{{ box.poem.title }}</span>
            <span class="text-xs text-gray-400">{{ box.poem.dynasty }} · {{ box.poem.author }}</span>
          </div>
        </template>
      </button>
    </div>

    <button
      v-if="allRevealed"
      class="px-6 py-2 bg-indigo-500 text-white rounded-xl text-sm font-medium cursor-pointer hover:bg-indigo-600 active:scale-95 transition"
      @click="refresh"
    >
      再抽一轮
    </button>
  </div>
</template>

<style scoped>
@keyframes sparkle-burst {
  0% { transform: scale(0) rotate(0deg); opacity: 1; }
  50% { transform: scale(1.5) rotate(180deg); opacity: 0.8; }
  100% { transform: scale(0) rotate(360deg); opacity: 0; }
}

.sparkle-card {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sparkle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
  animation: sparkle-burst 0.8s ease-out infinite;
}

.sparkle:nth-child(1) { top: 15%; left: 20%; animation-delay: 0s; }
.sparkle:nth-child(2) { top: 25%; right: 15%; animation-delay: 0.15s; }
.sparkle:nth-child(3) { bottom: 20%; left: 15%; animation-delay: 0.3s; }
.sparkle:nth-child(4) { bottom: 15%; right: 20%; animation-delay: 0.45s; }
</style>
