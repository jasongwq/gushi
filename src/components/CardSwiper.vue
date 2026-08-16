<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<{
  count: number
  modelValue: number
}>(), {
  count: 0,
  modelValue: 0,
})

const emit = defineEmits<{
  'update:modelValue': [index: number]
}>()

const currentIndex = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// 滑动状态
const containerRef = ref<HTMLElement | null>(null)
const offsetX = ref(0) // 当前拖拽偏移量 (px)
const isDragging = ref(false)
const isAnimating = ref(false)

// Touch 事件处理
let startX = 0
let startY = 0
let startTime = 0
let isHorizontal: boolean | null = null

function onTouchStart(e: TouchEvent) {
  if (isAnimating.value) return
  const touch = e.touches[0]
  startX = touch.clientX
  startY = touch.clientY
  startTime = Date.now()
  isDragging.value = true
  isHorizontal = null
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value) return
  const touch = e.touches[0]
  const dx = touch.clientX - startX
  const dy = touch.clientY - startY

  // 判断滑动方向（只判断一次）
  if (isHorizontal === null) {
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      isHorizontal = Math.abs(dx) > Math.abs(dy)
    }
    return
  }
  if (!isHorizontal) return

  e.preventDefault()
  offsetX.value = dx
}

function onTouchEnd() {
  if (!isDragging.value) return
  isDragging.value = false

  const velocity = Math.abs(offsetX.value) / (Date.now() - startTime)
  const threshold = containerRef.value ? containerRef.value.offsetWidth * 0.2 : 80

  if (Math.abs(offsetX.value) > threshold || velocity > 0.3) {
    if (offsetX.value < 0 && currentIndex.value < props.count - 1) {
      goTo(currentIndex.value + 1)
    } else if (offsetX.value > 0 && currentIndex.value > 0) {
      goTo(currentIndex.value - 1)
    } else {
      snapBack()
    }
  } else {
    snapBack()
  }
}

function snapBack() {
  offsetX.value = 0
}

function goTo(index: number) {
  isAnimating.value = true
  currentIndex.value = index
  offsetX.value = 0
  setTimeout(() => {
    isAnimating.value = false
  }, 350)
}

// 洗牌动画
const isShuffling = ref(false)

function shuffle() {
  if (isShuffling.value || props.count === 0) return
  isShuffling.value = true

  const targetIndex = Math.floor(Math.random() * props.count)
  const steps = 8 + Math.floor(Math.random() * 6) // 8-13 步
  let step = 0

  function animateStep() {
    if (step >= steps) {
      // 最后一步：跳到目标
      currentIndex.value = targetIndex
      offsetX.value = 0
      isShuffling.value = false
      return
    }

    // 来回快速移动
    const direction = step % 2 === 0 ? 1 : -1
    const jumpSize = Math.min(2, props.count - 1)
    let next = currentIndex.value + direction * jumpSize
    next = Math.max(0, Math.min(props.count - 1, next))
    currentIndex.value = next
    offsetX.value = 0

    step++
    // 速度递减：从 80ms 到 200ms
    const delay = 80 + (step / steps) * 120
    setTimeout(animateStep, delay)
  }

  animateStep()
}

// 计算卡片样式
function cardStyle(index: number) {
  const diff = index - currentIndex.value
  const dragRatio = containerRef.value ? offsetX.value / containerRef.value.offsetWidth : 0
  const effectiveDiff = diff - dragRatio

  const absDiff = Math.abs(effectiveDiff)
  const scale = absDiff === 0 ? 1 : absDiff === 1 ? 0.85 : 0.7
  const opacity = absDiff === 0 ? 1 : absDiff === 1 ? 0.6 : 0.3
  const translateX = effectiveDiff * 75 // 75% of card width spacing

  return {
    transform: `translateX(${translateX}%) scale(${scale})`,
    opacity: absDiff > 2 ? 0 : opacity,
    transition: isDragging.value ? 'none' : 'transform 0.35s ease, opacity 0.35s ease',
    zIndex: 10 - Math.round(absDiff),
    position: 'absolute' as const,
    left: '50%',
    top: '0',
    width: '80%',
    marginLeft: '-40%',
  }
}

defineExpose({ shuffle, goTo })
</script>

<template>
  <div
    ref="containerRef"
    class="card-swiper relative w-full overflow-hidden"
    style="touch-action: pan-y;"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div
      v-for="i in count"
      :key="i - 1"
      :style="cardStyle(i - 1)"
      class="card-swiper-item"
    >
      <slot :index="i - 1" />
    </div>
  </div>
</template>

<style scoped>
.card-swiper {
  height: 100%;
}
.card-swiper-item {
  height: 100%;
}
</style>
