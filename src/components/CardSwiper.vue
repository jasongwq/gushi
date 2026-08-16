<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
  'swiperTouchStart': [event: Event]
}>()

const currentIndex = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// 背诵模式（slide effect）下禁用触摸滑动，防止与 RecitationCard 内部按钮冲突
const allowTouchMove = computed(() => props.effect === 'coverflow')

let swiperInstance: SwiperType | null = null

function onSwiperTouchStart(_swiper: SwiperType, event: Event) {
  emit('swiperTouchStart', event)
}

function onSwiper(swiper: SwiperType) {
  swiperInstance = swiper
}

function onSlideChange(swiper: SwiperType) {
  currentIndex.value = swiper.realIndex
}

// 外部 modelValue 变化时同步到 Swiper
watch(() => props.modelValue, (val) => {
  if (swiperInstance && swiperInstance.realIndex !== val) {
    swiperInstance.slideToLoop(val, 0)
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
      swiperInstance!.slideToLoop(targetIndex, 300)
      setTimeout(() => {
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
    setTimeout(animateStep, delay)
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
    @touch-start="onSwiperTouchStart"
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
