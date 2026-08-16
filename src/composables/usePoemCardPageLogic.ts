import { ref, computed } from 'vue'
import type { RecitationResult } from '@/types'

interface PoemLike {
  id: string
  title: string
  grade: string
  text: string[]
  author: string
  dynasty: string
  yiwen: string
}

export function usePoemCardPageLogic(options: {
  poems: PoemLike[]
  fromMystery: boolean
  mysteryRevealedPoems: PoemLike[]
}) {
  type ViewMode = 'swiper' | 'recite' | 'mystery'

  const viewMode = ref<ViewMode>('swiper')
  const currentIndex = ref(0)

  const currentPoem = computed(() => options.poems[currentIndex.value] ?? null)

  const canGoPrev = computed(() => currentIndex.value > 0)

  const detailProgress = computed(() => {
    const total = options.poems.length
    const idx = currentIndex.value
    return {
      text: `${idx + 1}/${total}`,
      percent: total > 0 ? ((idx + 1) / total) * 100 : 0,
    }
  })

  function enterRecite() {
    viewMode.value = 'recite'
  }

  function exitRecite() {
    viewMode.value = 'swiper'
  }

  function onDetailSubmit(_result: RecitationResult) {
    // 最后一首 → 返回浏览
    if (currentIndex.value >= options.poems.length - 1) {
      viewMode.value = 'swiper'
      return
    }
    // 自动进入下一首
    currentIndex.value++
  }

  function onDetailGoPrev() {
    if (currentIndex.value > 0) {
      currentIndex.value--
    }
  }

  return {
    viewMode,
    currentIndex,
    currentPoem,
    canGoPrev,
    detailProgress,
    enterRecite,
    exitRecite,
    onDetailSubmit,
    onDetailGoPrev,
  }
}
