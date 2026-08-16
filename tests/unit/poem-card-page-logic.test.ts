import { describe, it, expect } from 'vitest'
import { usePoemCardPageLogic } from '@/composables/usePoemCardPageLogic'

// Mock poems
const mockPoems = [
  { id: 'p1', title: '静夜思', grade: '一年级', text: ['床前明月光', '疑是地上霜'], author: '李白', dynasty: '唐', yiwen: '译' },
  { id: 'p2', title: '春晓', grade: '一年级', text: ['春眠不觉晓', '处处闻啼鸟'], author: '孟浩然', dynasty: '唐', yiwen: '译' },
  { id: 'p3', title: '咏鹅', grade: '一年级', text: ['鹅鹅鹅', '曲项向天歌'], author: '骆宾王', dynasty: '唐', yiwen: '译' },
]

function setupLogic(overrides: Record<string, unknown> = {}) {
  const poems = overrides.poems as typeof mockPoems ?? mockPoems
  const fromMystery = overrides.fromMystery as boolean ?? false
  const mysteryRevealedPoems = overrides.mysteryRevealedPoems as typeof mockPoems ?? []

  const logic = usePoemCardPageLogic({
    poems,
    fromMystery,
    mysteryRevealedPoems,
  })

  return logic
}

describe('usePoemCardPageLogic', () => {
  it('initial viewMode is swiper', () => {
    const { viewMode } = setupLogic()
    expect(viewMode.value).toBe('swiper')
  })

  it('enterRecite sets viewMode to recite and keeps currentIndex', () => {
    const { viewMode, currentIndex, enterRecite } = setupLogic()
    currentIndex.value = 1
    enterRecite()
    expect(viewMode.value).toBe('recite')
    expect(currentIndex.value).toBe(1)
  })

  it('exitRecite sets viewMode back to swiper', () => {
    const { viewMode, enterRecite, exitRecite } = setupLogic()
    enterRecite()
    expect(viewMode.value).toBe('recite')
    exitRecite()
    expect(viewMode.value).toBe('swiper')
  })

  it('currentPoem is derived from currentIndex', () => {
    const { currentPoem, currentIndex } = setupLogic()
    currentIndex.value = 0
    expect(currentPoem.value?.id).toBe('p1')
    currentIndex.value = 2
    expect(currentPoem.value?.id).toBe('p3')
  })

  it('onDetailSubmit advances to next poem', () => {
    const { currentIndex, onDetailSubmit } = setupLogic()
    currentIndex.value = 0
    onDetailSubmit({ poemId: 'p1', overallStatus: 'mastered', lines: [], authorCorrect: null, dynastyCorrect: null })
    expect(currentIndex.value).toBe(1)
  })

  it('onDetailSubmit on last poem returns to swiper', () => {
    const { viewMode, currentIndex, enterRecite, onDetailSubmit } = setupLogic()
    enterRecite()
    currentIndex.value = 2 // last poem
    onDetailSubmit({ poemId: 'p3', overallStatus: 'mastered', lines: [], authorCorrect: null, dynastyCorrect: null })
    expect(viewMode.value).toBe('swiper')
  })

  it('onDetailGoPrev decrements currentIndex', () => {
    const { currentIndex, onDetailGoPrev } = setupLogic()
    currentIndex.value = 2
    onDetailGoPrev()
    expect(currentIndex.value).toBe(1)
  })

  it('onDetailGoPrev does not go below 0', () => {
    const { currentIndex, onDetailGoPrev } = setupLogic()
    currentIndex.value = 0
    onDetailGoPrev()
    expect(currentIndex.value).toBe(0)
  })

  it('canGoPrev is true when not at first poem', () => {
    const { canGoPrev, currentIndex } = setupLogic()
    currentIndex.value = 0
    expect(canGoPrev.value).toBe(false)
    currentIndex.value = 1
    expect(canGoPrev.value).toBe(true)
  })

  it('detailProgress shows correct position', () => {
    const { detailProgress, currentIndex } = setupLogic()
    currentIndex.value = 0
    expect(detailProgress.value.text).toBe('1/3')
    expect(detailProgress.value.percent).toBeCloseTo(100 / 3)
    currentIndex.value = 2
    expect(detailProgress.value.text).toBe('3/3')
    expect(detailProgress.value.percent).toBe(100)
  })
})
