/**
 * 上滑手势检测：判断一段触摸移动（起点→当前点）是否构成"上滑缩回"手势。
 * 规则：垂直向上位移超过阈值，且垂直位移大于水平位移。
 */
export const SWIPE_UP_THRESHOLD = 50

export interface SwipeState {
  startY: number | null
  startX: number | null
}

export function createSwipeState(): SwipeState {
  return { startY: null, startX: null }
}

/** 记录触摸起点 */
export function swipeStart(state: SwipeState, x: number, y: number) {
  state.startY = y
  state.startX = x
}

/** 判断当前触摸位置是否构成上滑缩回，命中则重置起点 */
export function swipeMove(state: SwipeState, x: number, y: number): boolean {
  if (state.startY === null || state.startX === null) return false
  const dy = y - state.startY
  const dx = x - state.startX
  if (dy < -SWIPE_UP_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
    state.startY = null
    state.startX = null
    return true
  }
  return false
}

/** 重置触摸起点（touchend / touchcancel） */
export function swipeEnd(state: SwipeState) {
  state.startY = null
  state.startX = null
}
