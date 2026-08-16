import { ref, computed } from 'vue'
import type { RecitationResult, Poem } from '@/types'

export type ViewMode = 'swiper' | 'recite' | 'mystery'

export interface PoemLike {
  id: string
  [key: string]: unknown
}

export function usePoemCardPageLogic(options: {
  poems: PoemLike[]
  allPoems: PoemLike[]
  getLearningStore: () => {
    recordAnswer: (poemId: string, type: string, correct: boolean, detail?: string) => void
  }
}) {
  const viewMode = ref<ViewMode>('swiper')
  const expandedPoemId = ref<string | null>(null)
  const currentIndex = ref(0)
  const fromMystery = ref(false)
  const mysteryRevealedPoems = ref<PoemLike[]>([])

  const currentPoem = computed(() => options.poems[currentIndex.value] ?? null)

  // Navigate callback - set by the component to handle DOM + swiper
  let onNavigateCallback: ((targetIndex: number) => void) | null = null

  function setOnNavigateCallback(cb: (targetIndex: number) => void) {
    onNavigateCallback = cb
  }

  function isSlideExpanded(poemId: string) {
    return expandedPoemId.value === poemId && viewMode.value === 'recite'
  }

  function expandSlide(poemId: string) {
    expandedPoemId.value = poemId
    viewMode.value = 'recite'
  }

  function collapseSlide() {
    if (!expandedPoemId.value) return
    expandedPoemId.value = null
    viewMode.value = 'swiper'
  }

  function navigateToPoem(targetIndex: number) {
    collapseSlide()
    currentIndex.value = targetIndex
    // The component will handle DOM expansion after transition
    if (onNavigateCallback) {
      onNavigateCallback(targetIndex)
    }
  }

  function onDetailSubmit(result: RecitationResult) {
    saveResult(result)

    if (fromMystery.value) {
      const navList = mysteryRevealedPoems.value
      const idx = navList.findIndex(p => p.id === currentPoem.value?.id)
      if (idx >= 0 && idx < navList.length - 1) {
        navigateToPoem(idx + 1)
      } else {
        collapseSlide()
        viewMode.value = 'mystery'
      }
      return
    }

    const idx = options.poems.findIndex(p => p.id === currentPoem.value?.id)
    if (idx >= 0 && idx < options.poems.length - 1) {
      navigateToPoem(idx + 1)
    } else {
      collapseSlide()
    }
  }

  function onDetailGoPrev() {
    if (fromMystery.value) {
      const navList = mysteryRevealedPoems.value
      const idx = navList.findIndex(p => p.id === currentPoem.value?.id)
      if (idx > 0) {
        navigateToPoem(idx - 1)
      }
      return
    }
    const idx = options.poems.findIndex(p => p.id === currentPoem.value?.id)
    if (idx > 0) {
      navigateToPoem(idx - 1)
    }
  }

  function goBackToBrowse() {
    collapseSlide()
  }

  function switchToGlobal() {
    fromMystery.value = false
    if (currentPoem.value) {
      const idx = options.allPoems.findIndex(p => p.id === currentPoem.value?.id)
      if (idx >= 0) currentIndex.value = idx
    }
  }

  function onMysterySelectAndEnter(poem: PoemLike, revealedPoems: PoemLike[]) {
    fromMystery.value = true
    mysteryRevealedPoems.value = [...revealedPoems]
    const idx = mysteryRevealedPoems.value.findIndex(p => p.id === poem.id)
    if (idx >= 0) currentIndex.value = idx
    viewMode.value = 'swiper'
    // The component will handle expandSlide after nextTick
  }

  const detailProgress = computed(() => {
    if (!currentPoem.value) return { text: '', percent: 0 }
    const navList = options.poems
    const idx = navList.findIndex(p => p.id === currentPoem.value?.id)
    const total = navList.length
    if (idx < 0) return { text: '', percent: 0 }
    return {
      text: `${idx + 1}/${total}`,
      percent: ((idx + 1) / total) * 100,
    }
  })

  const checkedPoemIds = ref(new Set<string>())

  function saveResult(result: RecitationResult) {
    checkedPoemIds.value.add(result.poemId)

    const learningStore = options.getLearningStore()
    if (result.overallStatus === 'mastered') {
      learningStore.recordAnswer(result.poemId, 'recite', true)
    } else {
      learningStore.recordAnswer(result.poemId, 'recite', false)
      for (const line of result.lines) {
        if (line.status === 'stuck' || line.status === 'forgot') {
          learningStore.recordAnswer(result.poemId, 'recite', false, `第${line.lineIndex + 1}句:${line.status}`)
        }
      }
    }
    if (result.authorCorrect === false) {
      learningStore.recordAnswer(result.poemId, 'author', false)
    }
    if (result.dynastyCorrect === false) {
      learningStore.recordAnswer(result.poemId, 'dynasty', false)
    }
  }

  return {
    viewMode,
    expandedPoemId,
    currentIndex,
    fromMystery,
    mysteryRevealedPoems,
    currentPoem,
    isSlideExpanded,
    expandSlide,
    collapseSlide,
    navigateToPoem,
    onDetailSubmit,
    onDetailGoPrev,
    goBackToBrowse,
    switchToGlobal,
    onMysterySelectAndEnter,
    detailProgress,
    checkedPoemIds,
    saveResult,
    setOnNavigateCallback,
  }
}
