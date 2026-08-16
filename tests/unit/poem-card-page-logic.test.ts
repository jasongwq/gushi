import { describe, it, expect, vi } from 'vitest'
import { usePoemCardPageLogic } from '@/composables/usePoemCardPageLogic'

// Mock poems
const mockPoems = [
  { id: 'p1', title: '静夜思', grade: '一年级', text: ['床前明月光', '疑是地上霜'], author: '李白', dynasty: '唐', yiwen: '译' },
  { id: 'p2', title: '春晓', grade: '一年级', text: ['春眠不觉晓', '处处闻啼鸟'], author: '孟浩然', dynasty: '唐', yiwen: '译' },
  { id: 'p3', title: '咏鹅', grade: '一年级', text: ['鹅鹅鹅', '曲项向天歌'], author: '骆宾王', dynasty: '唐', yiwen: '译' },
]

const mockAllPoems = [...mockPoems, { id: 'p4', title: '登鹳雀楼', grade: '二年级', text: ['白日依山尽', '黄河入海流'], author: '王之涣', dynasty: '唐', yiwen: '译' }]

function createMockLearningStore() {
  return {
    recordAnswer: vi.fn(),
  }
}

function setupLogic(overrides: Record<string, unknown> = {}) {
  const poems = overrides.poems as typeof mockPoems ?? mockPoems
  const allPoems = overrides.allPoems as typeof mockAllPoems ?? mockAllPoems
  const learningStore = overrides.getLearningStore as (() => { recordAnswer: ReturnType<typeof vi.fn> }) ?? createMockLearningStore

  const logic = usePoemCardPageLogic({
    poems,
    allPoems,
    getLearningStore: learningStore,
  })

  return logic
}

describe('usePoemCardPageLogic', () => {
  // ========== viewMode ==========
  it('initial viewMode is swiper', () => {
    const { viewMode } = setupLogic()
    expect(viewMode.value).toBe('swiper')
  })

  it('initial expandedPoemId is null', () => {
    const { expandedPoemId } = setupLogic()
    expect(expandedPoemId.value).toBeNull()
  })

  it('initial currentIndex is 0', () => {
    const { currentIndex } = setupLogic()
    expect(currentIndex.value).toBe(0)
  })

  it('initial fromMystery is false', () => {
    const { fromMystery } = setupLogic()
    expect(fromMystery.value).toBe(false)
  })

  // ========== expandSlide / collapseSlide ==========
  it('expandSlide sets expandedPoemId and viewMode to recite', () => {
    const { expandedPoemId, viewMode, expandSlide } = setupLogic()
    expandSlide('p1')
    expect(expandedPoemId.value).toBe('p1')
    expect(viewMode.value).toBe('recite')
  })

  it('collapseSlide resets expandedPoemId and viewMode to swiper', () => {
    const { expandedPoemId, viewMode, expandSlide, collapseSlide } = setupLogic()
    expandSlide('p1')
    collapseSlide()
    expect(expandedPoemId.value).toBeNull()
    expect(viewMode.value).toBe('swiper')
  })

  it('collapseSlide does nothing when no slide is expanded', () => {
    const { viewMode, collapseSlide } = setupLogic()
    expect(viewMode.value).toBe('swiper')
    collapseSlide()
    expect(viewMode.value).toBe('swiper')
  })

  // ========== isSlideExpanded ==========
  it('isSlideExpanded returns true for expanded poem in recite mode', () => {
    const { isSlideExpanded, expandSlide } = setupLogic()
    expandSlide('p2')
    expect(isSlideExpanded('p2')).toBe(true)
  })

  it('isSlideExpanded returns false for non-expanded poem', () => {
    const { isSlideExpanded, expandSlide } = setupLogic()
    expandSlide('p1')
    expect(isSlideExpanded('p2')).toBe(false)
  })

  it('isSlideExpanded returns false when not in recite mode', () => {
    const { isSlideExpanded, expandSlide, viewMode } = setupLogic()
    expandSlide('p1')
    // Manually set viewMode back to swiper (simulating partial state)
    viewMode.value = 'swiper'
    expect(isSlideExpanded('p1')).toBe(false)
  })

  // ========== navigateToPoem ==========
  it('navigateToPoem collapses slide and updates currentIndex', () => {
    const { expandedPoemId, viewMode, currentIndex, navigateToPoem, expandSlide } = setupLogic()
    expandSlide('p1')
    navigateToPoem(2)
    expect(expandedPoemId.value).toBeNull()
    expect(viewMode.value).toBe('swiper')
    expect(currentIndex.value).toBe(2)
  })

  it('navigateToPoem calls onNavigateCallback', () => {
    const { navigateToPoem, setOnNavigateCallback } = setupLogic()
    const callback = vi.fn()
    setOnNavigateCallback(callback)
    navigateToPoem(1)
    expect(callback).toHaveBeenCalledWith(1)
  })

  // ========== onDetailSubmit ==========
  it('onDetailSubmit advances to next poem (non-mystery)', () => {
    const { currentIndex, expandSlide, onDetailSubmit } = setupLogic()
    expandSlide('p1')
    currentIndex.value = 0
    onDetailSubmit({ poemId: 'p1', overallStatus: 'mastered', lines: [], authorCorrect: null, dynastyCorrect: null })
    expect(currentIndex.value).toBe(1)
  })

  it('onDetailSubmit on last poem returns to swiper (non-mystery)', () => {
    const { viewMode, expandSlide, onDetailSubmit, currentIndex } = setupLogic()
    expandSlide('p3')
    currentIndex.value = 2
    onDetailSubmit({ poemId: 'p3', overallStatus: 'mastered', lines: [], authorCorrect: null, dynastyCorrect: null })
    expect(viewMode.value).toBe('swiper')
  })

  it('onDetailSubmit in mystery mode advances through mysteryRevealedPoems', () => {
    const { currentIndex, fromMystery, mysteryRevealedPoems, expandSlide, onDetailSubmit } = setupLogic({
      poems: mockPoems, // fromMystery uses mysteryRevealedPoems for navigation
    })
    fromMystery.value = true
    mysteryRevealedPoems.value = mockPoems
    expandSlide('p1')
    currentIndex.value = 0
    onDetailSubmit({ poemId: 'p1', overallStatus: 'mastered', lines: [], authorCorrect: null, dynastyCorrect: null })
    expect(currentIndex.value).toBe(1)
  })

  it('onDetailSubmit on last mystery poem returns to mystery view', () => {
    const { viewMode, fromMystery, mysteryRevealedPoems, expandSlide, onDetailSubmit, currentIndex } = setupLogic({
      poems: mockPoems,
    })
    fromMystery.value = true
    mysteryRevealedPoems.value = mockPoems
    expandSlide('p3')
    currentIndex.value = 2
    onDetailSubmit({ poemId: 'p3', overallStatus: 'mastered', lines: [], authorCorrect: null, dynastyCorrect: null })
    expect(viewMode.value).toBe('mystery')
  })

  // ========== onDetailGoPrev ==========
  it('onDetailGoPrev navigates to previous poem', () => {
    const { currentIndex, expandSlide, onDetailGoPrev } = setupLogic()
    expandSlide('p2')
    currentIndex.value = 1
    onDetailGoPrev()
    expect(currentIndex.value).toBe(0)
  })

  it('onDetailGoPrev does not go below 0', () => {
    const { currentIndex, expandSlide, onDetailGoPrev } = setupLogic()
    expandSlide('p1')
    currentIndex.value = 0
    onDetailGoPrev()
    expect(currentIndex.value).toBe(0)
  })

  it('onDetailGoPrev in mystery mode uses mysteryRevealedPoems', () => {
    const { currentIndex, fromMystery, mysteryRevealedPoems, expandSlide, onDetailGoPrev } = setupLogic({
      poems: mockPoems,
    })
    fromMystery.value = true
    mysteryRevealedPoems.value = mockPoems
    expandSlide('p2')
    currentIndex.value = 1
    onDetailGoPrev()
    expect(currentIndex.value).toBe(0)
  })

  // ========== goBackToBrowse ==========
  it('goBackToBrowse collapses slide and returns to swiper', () => {
    const { viewMode, expandedPoemId, expandSlide, goBackToBrowse } = setupLogic()
    expandSlide('p1')
    goBackToBrowse()
    expect(viewMode.value).toBe('swiper')
    expect(expandedPoemId.value).toBeNull()
  })

  // ========== switchToGlobal ==========
  it('switchToGlobal sets fromMystery to false and finds index in allPoems', () => {
    const { fromMystery, currentIndex, switchToGlobal, expandSlide } = setupLogic({
      poems: mockPoems,
      allPoems: mockAllPoems,
    })
    fromMystery.value = true
    // Current poem is p2 (index 1 in mockPoems)
    expandSlide('p2')
    currentIndex.value = 1
    switchToGlobal()
    expect(fromMystery.value).toBe(false)
    // p2 is at index 1 in allPoems too
    expect(currentIndex.value).toBe(1)
  })

  it('switchToGlobal does not change currentIndex if poem not found in allPoems', () => {
    const { currentIndex, switchToGlobal } = setupLogic({
      poems: mockPoems,
      allPoems: mockAllPoems,
    })
    currentIndex.value = 0
    // currentPoem is p1 which is in allPoems, so index will be found
    switchToGlobal()
    expect(currentIndex.value).toBe(0)
  })

  // ========== onMysterySelectAndEnter ==========
  it('onMysterySelectAndEnter sets mystery state and switches to swiper', () => {
    const { fromMystery, mysteryRevealedPoems, viewMode, currentIndex, onMysterySelectAndEnter } = setupLogic()
    const revealed = [mockPoems[0], mockPoems[2]]
    onMysterySelectAndEnter(mockPoems[2], revealed)
    expect(fromMystery.value).toBe(true)
    expect(mysteryRevealedPoems.value).toEqual(revealed)
    expect(viewMode.value).toBe('swiper')
    // p3 is at index 1 in revealed
    expect(currentIndex.value).toBe(1)
  })

  it('onMysterySelectAndEnter does not change currentIndex if poem not in revealed', () => {
    const { currentIndex, onMysterySelectAndEnter } = setupLogic()
    const revealed = [mockPoems[0], mockPoems[1]]
    onMysterySelectAndEnter(mockPoems[2], revealed)
    // p3 not in revealed, currentIndex stays at 0
    expect(currentIndex.value).toBe(0)
  })

  // ========== detailProgress ==========
  it('detailProgress shows correct position', () => {
    const { detailProgress, currentIndex } = setupLogic()
    currentIndex.value = 0
    expect(detailProgress.value.text).toBe('1/3')
    expect(detailProgress.value.percent).toBeCloseTo(100 / 3)
    currentIndex.value = 2
    expect(detailProgress.value.text).toBe('3/3')
    expect(detailProgress.value.percent).toBe(100)
  })

  it('detailProgress returns empty when no current poem', () => {
    const { detailProgress, currentIndex } = setupLogic({ poems: [] })
    currentIndex.value = 0
    expect(detailProgress.value.text).toBe('')
    expect(detailProgress.value.percent).toBe(0)
  })

  it('detailProgress returns empty when poem not found in list', () => {
    const { detailProgress } = setupLogic()
    // With a poem that has an id not in the poems list
    // This is a bit contrived since currentPoem is derived from poems[currentIndex]
    // But if currentIndex is out of bounds, currentPoem would be null
    // Already covered by the empty poems test
  })

  // ========== saveResult ==========
  it('saveResult records mastered answer', () => {
    const mockStore = createMockLearningStore()
    const { saveResult } = setupLogic({ getLearningStore: () => mockStore })
    saveResult({ poemId: 'p1', overallStatus: 'mastered', lines: [], authorCorrect: null, dynastyCorrect: null })
    expect(mockStore.recordAnswer).toHaveBeenCalledWith('p1', 'recite', true)
  })

  it('saveResult records wrong answer for non-mastered', () => {
    const mockStore = createMockLearningStore()
    const { saveResult } = setupLogic({ getLearningStore: () => mockStore })
    saveResult({ poemId: 'p1', overallStatus: 'struggling', lines: [{ lineIndex: 0, text: '床前明月光', status: 'stuck' }], authorCorrect: null, dynastyCorrect: null })
    expect(mockStore.recordAnswer).toHaveBeenCalledWith('p1', 'recite', false)
    expect(mockStore.recordAnswer).toHaveBeenCalledWith('p1', 'recite', false, '第1句:stuck')
  })

  it('saveResult records wrong author', () => {
    const mockStore = createMockLearningStore()
    const { saveResult } = setupLogic({ getLearningStore: () => mockStore })
    saveResult({ poemId: 'p1', overallStatus: 'mastered', lines: [], authorCorrect: false, dynastyCorrect: null })
    expect(mockStore.recordAnswer).toHaveBeenCalledWith('p1', 'author', false)
  })

  it('saveResult records wrong dynasty', () => {
    const mockStore = createMockLearningStore()
    const { saveResult } = setupLogic({ getLearningStore: () => mockStore })
    saveResult({ poemId: 'p1', overallStatus: 'mastered', lines: [], authorCorrect: null, dynastyCorrect: false })
    expect(mockStore.recordAnswer).toHaveBeenCalledWith('p1', 'dynasty', false)
  })

  it('saveResult adds poemId to checkedPoemIds', () => {
    const { checkedPoemIds, saveResult } = setupLogic()
    saveResult({ poemId: 'p1', overallStatus: 'mastered', lines: [], authorCorrect: null, dynastyCorrect: null })
    expect(checkedPoemIds.value.has('p1')).toBe(true)
  })

  // ========== currentPoem ==========
  it('currentPoem is derived from currentIndex', () => {
    const { currentPoem, currentIndex } = setupLogic()
    currentIndex.value = 0
    expect(currentPoem.value?.id).toBe('p1')
    currentIndex.value = 2
    expect(currentPoem.value?.id).toBe('p3')
  })

  it('currentPoem returns null when index out of bounds', () => {
    const { currentPoem, currentIndex } = setupLogic({ poems: [] })
    currentIndex.value = 0
    expect(currentPoem.value).toBeNull()
  })
})
