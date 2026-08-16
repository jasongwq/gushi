import { describe, it, expect } from 'vitest'
import { createSwipeState, swipeStart, swipeMove, swipeEnd, SWIPE_UP_THRESHOLD } from '@/utils/swipe'

describe('swipe gesture detection', () => {
  it('SWIPE_UP_THRESHOLD is 50', () => {
    expect(SWIPE_UP_THRESHOLD).toBe(50)
  })

  it('initial state has null start', () => {
    const state = createSwipeState()
    expect(state.startY).toBeNull()
    expect(state.startX).toBeNull()
  })

  it('swipeStart records coordinates', () => {
    const state = createSwipeState()
    swipeStart(state, 100, 400)
    expect(state.startY).toBe(400)
    expect(state.startX).toBe(100)
  })

  it('returns false when no start point recorded', () => {
    const state = createSwipeState()
    expect(swipeMove(state, 100, 300)).toBe(false)
  })

  it('detects swipe up beyond threshold', () => {
    const state = createSwipeState()
    swipeStart(state, 100, 400)
    // 上移 100px（超过阈值 50）
    expect(swipeMove(state, 100, 300)).toBe(true)
  })

  it('does not trigger when vertical move is within threshold', () => {
    const state = createSwipeState()
    swipeStart(state, 100, 400)
    // 上移 30px（未达阈值）
    expect(swipeMove(state, 100, 370)).toBe(false)
    // 起点应保留（允许继续累积位移）
    expect(state.startY).toBe(400)
  })

  it('does not trigger for horizontal move even if large', () => {
    const state = createSwipeState()
    swipeStart(state, 100, 400)
    // 水平移动 100px，垂直不动
    expect(swipeMove(state, 200, 400)).toBe(false)
  })

  it('does not trigger when horizontal displacement dominates', () => {
    const state = createSwipeState()
    swipeStart(state, 100, 400)
    // 上移 60px 但水平移 100px（水平占主导）
    expect(swipeMove(state, 200, 340)).toBe(false)
  })

  it('does not trigger for swipe down', () => {
    const state = createSwipeState()
    swipeStart(state, 100, 400)
    // 下移 100px
    expect(swipeMove(state, 100, 500)).toBe(false)
  })

  it('resets start point after successful swipe up', () => {
    const state = createSwipeState()
    swipeStart(state, 100, 400)
    expect(swipeMove(state, 100, 300)).toBe(true)
    expect(state.startY).toBeNull()
    expect(state.startX).toBeNull()
  })

  it('swipeEnd resets start point', () => {
    const state = createSwipeState()
    swipeStart(state, 100, 400)
    swipeEnd(state)
    expect(state.startY).toBeNull()
    expect(state.startX).toBeNull()
  })

  it('requires both X and Y start points', () => {
    const state = createSwipeState()
    // 只设 Y 不设 X（模拟异常状态）
    state.startY = 400
    state.startX = null
    expect(swipeMove(state, 100, 300)).toBe(false)
  })
})
