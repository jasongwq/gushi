<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Swiper } from 'swiper/vue'
import { EffectCoverflow, FreeMode } from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper/types'
import 'swiper/css'
import 'swiper/css/effect-coverflow'
import 'swiper/css/free-mode'

const props = withDefaults(defineProps<{
  count: number
  modelValue: number
  effect?: 'coverflow' | 'slide'
}>(), {
  count: 0,
  modelValue: 0,
  effect: 'coverflow',
})

const emit = defineEmits<{
  'update:modelValue': [index: number]
}>()

const currentIndex = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// 两种模式都允许水平滑动（浏览切卡 / 背诵切诗）
const allowTouchMove = true

let swiperInstance: SwiperType | null = null
// 标记 Swiper 是否完成初始化（emit('swiper') 已触发）。
// init 阶段 slideTo(initial-slide) 会触发 slide-change，但此时 loop 尚未创建，
// realIndex 不可靠，写回 currentIndex 会污染目标索引（盲盒点击最后一首时错位）。
let isReady = false

// 洗牌动画定时器，用于组件卸载时清理
let shuffleTimer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (shuffleTimer) clearTimeout(shuffleTimer)
  // 卸载后禁止再写回 currentIndex：旧实例即将销毁时 Swiper.destroy 可能触发
  // slide-change，若仍写回会把外部设置的目标索引覆盖成旧 Swiper 的 realIndex
  isReady = false
})

function onSwiper(swiper: SwiperType) {
  swiperInstance = swiper
  isReady = true
  // Swiper init 时先 slideTo(initial-slide) 再创建 loop，当 initial-slide 指向最后一个
  // 真实 slide 时，loopFix 会重排 DOM 导致 realIndex 漂移（详情显示错位）。
  // 这里用官方 slideToLoop 在 loop 创建完成后对齐到真实索引。
  if (swiper.realIndex !== props.modelValue) {
    swiper.slideToLoop(props.modelValue, 0, false)
  }
}

function onSlideChange(swiper: SwiperType) {
  // 初始化完成前忽略 slide-change：init 阶段的 realIndex 在 loop 下不可靠，
  // 写回会覆盖外部设置的目标索引（盲盒点最后一首进入错位）。
  if (!isReady) return
  currentIndex.value = swiper.realIndex
}

// 外部 modelValue 变化时同步到 Swiper
watch(() => props.modelValue, (val) => {
  if (swiperInstance && swiperInstance.realIndex !== val) {
    // runCallbacks=false：程序性定位不触发 slide-change 回调，
    // 避免定位过程把 realIndex 写回 currentIndex（反向污染目标索引）
    swiperInstance.slideToLoop(val, 0, false)
  }
})

// 洗牌动画
const isShuffling = ref(false)

function shuffle() {
  if (isShuffling.value || props.count === 0 || !swiperInstance) return
  isShuffling.value = true

  const targetIndex = Math.floor(Math.random() * props.count)
  const steps = 8 + Math.floor(Math.random() * 6)
  let step = 0

  function animateStep() {
    if (step >= steps) {
      // 洗牌动画需要 slide-change 回调更新 currentIndex，因此保留 runCallbacks=true
      swiperInstance!.slideToLoop(targetIndex, 300)
      shuffleTimer = setTimeout(() => {
        isShuffling.value = false
      }, 350)
      return
    }

    const direction = step % 2 === 0 ? 1 : -1
    const jumpSize = Math.min(2, props.count - 1)
    let next = currentIndex.value + direction * jumpSize
    next = ((next % props.count) + props.count) % props.count
    swiperInstance!.slideToLoop(next, 150)

    step++
    const delay = 60 + (step / steps) * 100
    shuffleTimer = setTimeout(animateStep, delay)
  }

  animateStep()
}

function goTo(index: number) {
  swiperInstance?.slideToLoop(index, 0)
}

function getSwiperInstance() {
  return swiperInstance
}

defineExpose({ shuffle, goTo, getSwiperInstance })
</script>

<template>
  <Swiper
    :modules="[EffectCoverflow, FreeMode]"
    :effect="effect"
    :coverflow-effect="{ rotate: 0, stretch: 30, depth: 150, modifier: 1, scale: 1, slideShadows: false }"
    :free-mode="effect === 'coverflow' ? { enabled: true, sticky: true, minimumVelocity: 0.2 } : false"
    :slides-per-view="effect === 'coverflow' ? 'auto' : 1"
    :centered-slides="true"
    :loop="true"
    :loop-additional-slides="2"
    :speed="300"
    :initial-slide="modelValue"
    :allow-touch-move="allowTouchMove"
    class="card-swiper h-full"
    :class="effect === 'slide' ? 'is-fullscreen' : ''"
    @swiper="onSwiper"
    @slide-change="onSlideChange"
  >
    <slot />
  </Swiper>
</template>

<style scoped>
.card-swiper :deep(.swiper-slide) {
  width: 65%;
  height: 100%;
  transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 全屏模式（slide effect）下 slide 宽度为 100% */
.card-swiper.is-fullscreen :deep(.swiper-slide) {
  width: 100%;
}

.card-swiper {
  overflow: hidden;
}
</style>
