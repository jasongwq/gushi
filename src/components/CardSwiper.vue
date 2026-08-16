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
const offsetX = ref(0)
const isDragging = ref(false)
const isAnimating = ref(false)

// 速度追踪：记录最近几帧的位置和时间，用于计算瞬时速度
let startX = 0
let startY = 0
let isHorizontal: boolean | null = null
const velocityTracker: { x: number; t: number }[] = []

function onTouchStart(e: TouchEvent) {
  if (isAnimating.value) return
  const touch = e.touches[0]
  startX = touch.clientX
  startY = touch.clientY
  isDragging.value = true
  isHorizontal = null
  offsetX.value = 0
  velocityTracker.length = 0
  velocityTracker.push({ x: touch.clientX, t: Date.now() })
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value) return
  const touch = e.touches[0]
  const dx = touch.clientX - startX
  const dy = touch.clientY - startY

  if (isHorizontal === null) {
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      isHorizontal = Math.abs(dx) > Math.abs(dy)
    }
    return
  }
  if (!isHorizontal) return

  e.preventDefault()
  offsetX.value = dx

  // 记录速度采样（最多保留最近 5 帧）
  velocityTracker.push({ x: touch.clientX, t: Date.now() })
  if (velocityTracker.length > 5) velocityTracker.shift()
}

function onTouchEnd() {
  if (!isDragging.value) return
  isDragging.value = false

  // 计算瞬时速度 (px/ms)
  const velocity = getVelocity()
  const containerWidth = containerRef.value?.offsetWidth ?? 320

  // 速度阈值：0.3 px/ms ≈ 轻滑，1.0+ ≈ 快速甩
  // 惯性跳卡数：速度越快跳越多
  const skipCount = velocity > 1.5 ? 3 : velocity > 0.8 ? 2 : 1
  const distanceThreshold = containerWidth * 0.15 // 距离阈值降低到 15%

  if (Math.abs(offsetX.value) > distanceThreshold || velocity > 0.2) {
    const direction = offsetX.value < 0 ? 1 : -1
    let targetIndex = currentIndex.value + direction * skipCount

    // 快速甩的时候根据速度额外跳
    if (velocity > 2.0) {
      targetIndex = currentIndex.value + direction * Math.min(5, props.count - 1)
    }

    targetIndex = Math.max(0, Math.min(props.count - 1, targetIndex))

    if (targetIndex !== currentIndex.value) {
      goTo(targetIndex)
    } else {
      snapBack()
    }
  } else {
    snapBack()
  }
}

function getVelocity(): number {
  if (velocityTracker.length < 2) return 0
  const first = velocityTracker[0]
  const last = velocityTracker[velocityTracker.length - 1]
  const dt = last.t - first.t
  if (dt === 0) return 0
  return Math.abs(last.x - first.x) / dt
}

function snapBack() {
  offsetX.value = 0
}

function goTo(index: number) {
  isAnimating.value = true
  currentIndex.value = index
  offsetX.value = 0
  // 动画时长根据跳卡距离缩短
  setTimeout(() => {
    isAnimating.value = false
  }, 250)
}

// 洗牌动画
const isShuffling = ref(false)

function shuffle() {
  if (isShuffling.value || props.count === 0) return
  isShuffling.value = true

  const targetIndex = Math.floor(Math.random() * props.count)
  const steps = 8 + Math.floor(Math.random() * 6)
  let step = 0

  function animateStep() {
    if (step >= steps) {
      currentIndex.value = targetIndex
      offsetX.value = 0
      isShuffling.value = false
      return
    }

    const direction = step % 2 === 0 ? 1 : -1
    const jumpSize = Math.min(2, props.count - 1)
    let next = currentIndex.value + direction * jumpSize
    next = Math.max(0, Math.min(props.count - 1, next))
    currentIndex.value = next
    offsetX.value = 0

    step++
    const delay = 60 + (step / steps) * 100
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
  // 用连续值做平滑缩放
  const scale = absDiff === 0 ? 1 : absDiff <= 1 ? 1 - absDiff * 0.12 : 0.76 - (absDiff - 1) * 0.08
  const opacity = absDiff === 0 ? 1 : absDiff <= 1 ? 1 - absDiff * 0.3 : 0.4 - (absDiff - 1) * 0.15
  const translateX = effectiveDiff * 70

  return {
    transform: `translateX(${translateX}%) scale(${scale})`,
    opacity: absDiff > 2.5 ? 0 : opacity,
    transition: isDragging.value ? 'none' : 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease',
    zIndex: 10 - Math.round(absDiff),
    position: 'absolute' as const,
    left: '50%',
    top: '0',
    width: '70%',
    marginLeft: '-35%',
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
