import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useSwipeHandoff } from '@/composables/useSwipeHandoff'

function createMockSwiper(translate = 0) {
  return {
    touches: {
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      previousX: 0,
      previousY: 0,
      diff: 0,
    },
    touchEventsData: {
      isTouched: false,
      isMoved: false,
      allowTouchCallbacks: false,
      isScrolling: undefined,
      startMoving: undefined,
      touchStartTime: 0,
      touchId: 0,
      startTranslate: 0,
      currentTranslate: 0,
      allowThresholdMove: undefined,
      allowMomentumBounce: false,
      loopSwapReset: undefined,
    },
    translate,
    isHorizontal: () => true,
  }
}

function createMockTouch(overrides: Partial<TouchInit> = {}) {
  return new Touch({
    identifier: 1,
    target: document.createElement('div'),
    clientX: 220,
    clientY: 300,
    pageX: 220,
    pageY: 300,
    radiusX: 0,
    radiusY: 0,
    rotationAngle: 0,
    force: 1,
    ...overrides,
  })
}

function setupHandoff(overrides: Record<string, unknown> = {}) {
  const dragPhase = ref('handed-off')
  const viewLayer = ref('detail')
  const currentIndex = ref(0)
  const poems = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]
  const mockSwiper = createMockSwiper(-500)

  const state = {
    dragPhase,
    viewLayer,
    currentIndex,
    dragStartX: 100,
    dragStartY: 200,
    currentPoemId: 'p2' as string | undefined,
    poems,
    getSwiperInstance: vi.fn(() => mockSwiper),
    ...overrides,
  }

  const { handOffToSwiper } = useSwipeHandoff(state as any)
  return { state, mockSwiper, handOffToSwiper }
}

describe('useSwipeHandoff', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('initializes Swiper touches with original drag start position and current touch position', async () => {
    const { mockSwiper, handOffToSwiper } = setupHandoff()
    const touch = createMockTouch({ clientX: 220, clientY: 300 })

    await handOffToSwiper(touch)

    expect(mockSwiper.touches.startX).toBe(100) // dragStartX
    expect(mockSwiper.touches.startY).toBe(200) // dragStartY
    expect(mockSwiper.touches.currentX).toBe(220) // touch.clientX
    expect(mockSwiper.touches.currentY).toBe(300) // touch.clientY
    // previousX/Y 必须和 currentX/Y 一致，防止 Swiper 计算 touchesDiff 异常
    expect(mockSwiper.touches.previousX).toBe(220)
    expect(mockSwiper.touches.previousY).toBe(300)
  })

  it('sets isTouched to true so Swiper processes touchmove', async () => {
    const { mockSwiper, handOffToSwiper } = setupHandoff()
    const touch = createMockTouch()

    await handOffToSwiper(touch)

    expect(mockSwiper.touchEventsData.isTouched).toBe(true)
  })

  it('sets isMoved to true to skip Swiper first-move initialization', async () => {
    const { mockSwiper, handOffToSwiper } = setupHandoff()
    const touch = createMockTouch()

    await handOffToSwiper(touch)

    // isMoved=true 跳过 Swiper 的 !data.isMoved 分支，该分支会调用
    // loopFix() 和 getTranslate() 覆盖我们设的 startTranslate
    expect(mockSwiper.touchEventsData.isMoved).toBe(true)
  })

  it('sets isScrolling to false to prevent Swiper from dropping the gesture', async () => {
    const { mockSwiper, handOffToSwiper } = setupHandoff()
    const touch = createMockTouch()

    await handOffToSwiper(touch)

    // 如果留 undefined，Swiper 会根据 touchAngle 重新计算，
    // 角度偏大时判定为垂直滚动，设 isTouched=false 丢弃手势
    expect(mockSwiper.touchEventsData.isScrolling).toBe(false)
  })

  it('sets startMoving to true to skip Swiper startMoving check', async () => {
    const { mockSwiper, handOffToSwiper } = setupHandoff()
    const touch = createMockTouch()

    await handOffToSwiper(touch)

    // startMoving=true 跳过 Swiper 的 !data.startMoving 检查，
    // 否则 onTouchMove 会直接 return 不处理手势
    expect(mockSwiper.touchEventsData.startMoving).toBe(true)
  })

  it('sets allowThresholdMove to true to prevent Swiper from resetting startX', async () => {
    const { mockSwiper, handOffToSwiper } = setupHandoff()
    const touch = createMockTouch()

    await handOffToSwiper(touch)

    expect(mockSwiper.touchEventsData.allowThresholdMove).toBe(true)
  })

  it('preserves Swiper current translate as startTranslate and currentTranslate', async () => {
    const { mockSwiper, handOffToSwiper } = setupHandoff()
    const touch = createMockTouch()

    await handOffToSwiper(touch)

    expect(mockSwiper.touchEventsData.startTranslate).toBe(-500)
    expect(mockSwiper.touchEventsData.currentTranslate).toBe(-500)
  })

  it('switches viewLayer to browse', async () => {
    const { state, handOffToSwiper } = setupHandoff()
    const touch = createMockTouch()

    await handOffToSwiper(touch)

    expect(state.viewLayer.value).toBe('browse')
  })

  it('does not dispatch any synthetic touch events', async () => {
    const dispatchSpy = vi.spyOn(EventTarget.prototype, 'dispatchEvent')
    const { handOffToSwiper } = setupHandoff()
    const touch = createMockTouch()

    await handOffToSwiper(touch)

    const syntheticCalls = dispatchSpy.mock.calls.filter(
      (call) => call[0] instanceof TouchEvent || call[0] instanceof PointerEvent
    )
    expect(syntheticCalls).toHaveLength(0)
    dispatchSpy.mockRestore()
  })

  it('handles right swipe (positive dragDeltaX)', async () => {
    const { mockSwiper, handOffToSwiper } = setupHandoff({
      dragStartX: 100,
    })
    const touch = createMockTouch({ clientX: 220 })

    await handOffToSwiper(touch)

    expect(mockSwiper.touches.startX).toBe(100)
    expect(mockSwiper.touches.currentX).toBe(220)
  })

  it('handles left swipe (negative dragDeltaX)', async () => {
    const { mockSwiper, handOffToSwiper } = setupHandoff({
      dragStartX: 300,
    })
    const touch = createMockTouch({ clientX: 180 })

    await handOffToSwiper(touch)

    expect(mockSwiper.touches.startX).toBe(300)
    expect(mockSwiper.touches.currentX).toBe(180)
  })

  it('gracefully handles null Swiper instance', async () => {
    const { state, handOffToSwiper } = setupHandoff({
      getSwiperInstance: vi.fn(() => null),
    })
    const touch = createMockTouch()

    await handOffToSwiper(touch)

    expect(state.dragPhase.value).toBe('idle')
  })

  it('does not update currentIndex when poem is not found in list', async () => {
    const { state, handOffToSwiper } = setupHandoff({
      currentPoemId: 'nonexistent',
    })
    const touch = createMockTouch()

    await handOffToSwiper(touch)

    // currentIndex should remain at its initial value (0), not be updated
    expect(state.currentIndex.value).toBe(0)
  })

  it('works with minimal HandoffTouch from pointer events', async () => {
    const { mockSwiper, handOffToSwiper } = setupHandoff()
    // Simulate what onDetailPointerMove passes: { clientX, clientY, identifier }
    const pointerTouch = { clientX: 250, clientY: 350, identifier: 0 }

    await handOffToSwiper(pointerTouch)

    expect(mockSwiper.touches.startX).toBe(100)
    expect(mockSwiper.touches.startY).toBe(200)
    expect(mockSwiper.touches.currentX).toBe(250)
    expect(mockSwiper.touches.currentY).toBe(350)
    expect(mockSwiper.touchEventsData.touchId).toBe(0)
  })

  it('records touchStartTime as a recent timestamp', async () => {
    const { mockSwiper, handOffToSwiper } = setupHandoff()
    const touch = createMockTouch()
    const before = Date.now()

    await handOffToSwiper(touch)

    const after = Date.now()
    expect(mockSwiper.touchEventsData.touchStartTime).toBeGreaterThanOrEqual(before)
    expect(mockSwiper.touchEventsData.touchStartTime).toBeLessThanOrEqual(after)
  })

  it('sets allowMomentumBounce to false and loopSwapReset to undefined', async () => {
    const { mockSwiper, handOffToSwiper } = setupHandoff()
    const touch = createMockTouch()

    await handOffToSwiper(touch)

    expect(mockSwiper.touchEventsData.allowMomentumBounce).toBe(false)
    expect(mockSwiper.touchEventsData.loopSwapReset).toBeUndefined()
  })
})
