import { nextTick, type Ref } from 'vue'

interface SwipeHandoffState {
  dragPhase: Ref<string>
  dragStartX: number
  dragStartY: number
  viewLayer: Ref<string>
  currentIndex: Ref<number>
  currentPoemId: string | undefined
  poems: { id: string }[]
  getSwiperInstance: () => SwiperLike | null
}

/** 最小化的触摸信息接口，Touch 和 PointerEvent 都可满足 */
export interface HandoffTouch {
  clientX: number
  clientY: number
  identifier: number
}

interface SwiperLike {
  touches: {
    startX: number
    startY: number
    currentX: number
    currentY: number
    previousX: number | undefined
    previousY: number | undefined
    diff: number
  }
  touchEventsData: {
    isTouched: boolean
    isMoved: boolean
    allowTouchCallbacks: boolean
    isScrolling: boolean | undefined
    startMoving: boolean | undefined
    touchStartTime: number
    touchId: number | null
    startTranslate: number
    currentTranslate: number | undefined
    allowThresholdMove: boolean | undefined
    allowMomentumBounce: boolean | undefined
    loopSwapReset: boolean | undefined
  }
  translate: number
}

export function useSwipeHandoff(state: SwipeHandoffState) {
  async function handOffToSwiper(touch: HandoffTouch) {
    state.dragPhase.value = 'handed-off'
    state.viewLayer.value = 'browse'

    // 同步当前诗索引
    const idx = state.poems.findIndex(p => p.id === state.currentPoemId)
    if (idx >= 0) state.currentIndex.value = idx

    await nextTick()

    const swiper = state.getSwiperInstance()
    if (!swiper) {
      state.dragPhase.value = 'idle'
      return
    }

    // 初始化 Swiper 的内部触摸追踪状态。
    // 将 touches.startX 设为原始拖拽起点，Swiper 的 onTouchMove
    // 计算的 diffX = currentX - startX 将包含详情层的全部累计拖拽距离。
    swiper.touches.startX = state.dragStartX
    swiper.touches.startY = state.dragStartY
    swiper.touches.currentX = touch.clientX
    swiper.touches.currentY = touch.clientY
    // previousX/Y 必须和 currentX/Y 一致，否则 Swiper 计算的
    // touchesDiff（currentX - previousX）会很大，导致速度异常
    swiper.touches.previousX = touch.clientX
    swiper.touches.previousY = touch.clientY

    swiper.touchEventsData.isTouched = true
    // 关键：设为 true 跳过 Swiper 的 !data.isMoved 首次移动分支，
    // 该分支会调用 loopFix() 和 getTranslate() 覆盖我们设的 startTranslate。
    // 我们已经设好了 startTranslate，不需要 Swiper 的首次初始化。
    swiper.touchEventsData.isMoved = true
    swiper.touchEventsData.allowTouchCallbacks = true
    // 关键：设为 false 防止 Swiper 将手势判定为垂直滚动并丢弃。
    // 如果留 undefined，Swiper 会根据 touchAngle 重新计算，
    // 对于从详情层拖过来的手势，角度可能偏大导致被误判。
    swiper.touchEventsData.isScrolling = false
    // 关键：设为 true 跳过 Swiper 的 !data.startMoving 检查，
    // 否则 onTouchMove 会直接 return 不处理手势。
    swiper.touchEventsData.startMoving = true
    swiper.touchEventsData.touchStartTime = Date.now()
    swiper.touchEventsData.touchId = touch.identifier
    swiper.touchEventsData.startTranslate = swiper.translate
    swiper.touchEventsData.currentTranslate = swiper.translate
    // 关键：设为 true 防止 Swiper 在首次 touchmove 时重置 startX。
    // Swiper 默认 threshold=5px，首次超过时会把 startX 重置为 currentX，
    // 这会丢失我们累积的拖拽距离。
    swiper.touchEventsData.allowThresholdMove = true
    swiper.touchEventsData.allowMomentumBounce = false
    swiper.touchEventsData.loopSwapReset = undefined

    // 用户的真实 touchmove/touchend 事件由 Swiper 的 document 级监听器自然处理
    state.dragPhase.value = 'idle'
  }

  return { handOffToSwiper }
}
