import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Poem } from '@/types'
import { useLearningStore } from './learning'

export const usePoemStore = defineStore('poem', () => {
  const poems = ref<Poem[]>([])
  const loading = ref(false)

  const GRADE_ORDER: Record<string, number> = {
    '一年级': 1, '二年级': 2, '三年级': 3,
    '四年级': 4, '五年级': 5, '六年级': 6, '配读篇目': 7,
  }

  const grades = computed(() => {
    return [...new Set(poems.value.map(p => p.grade))].sort((a, b) => (GRADE_ORDER[a] ?? 99) - (GRADE_ORDER[b] ?? 99))
  })

  const poemsByGrade = computed(() => {
    const map = new Map<string, Poem[]>()
    for (const poem of poems.value) {
      const list = map.get(poem.grade) ?? []
      list.push(poem)
      map.set(poem.grade, list)
    }
    return map
  })

  const enabledPoems = computed(() => {
    const learningStore = useLearningStore()
    const enabledSet = learningStore.settings.enabledPoems
    if (enabledSet.length === 0) return poems.value
    const ids = new Set(enabledSet)
    return poems.value.filter(p => ids.has(p.id))
  })

  function isEnabled(poemId: string): boolean {
    const learningStore = useLearningStore()
    const enabledSet = learningStore.settings.enabledPoems
    if (enabledSet.length === 0) return true
    return enabledSet.includes(poemId)
  }

  function togglePoem(poemId: string) {
    const learningStore = useLearningStore()
    const current = learningStore.settings.enabledPoems
    if (current.length === 0) {
      const allIds = poems.value.map(p => p.id)
      learningStore.updateSettings({ enabledPoems: allIds.filter(id => id !== poemId) })
    } else {
      const idx = current.indexOf(poemId)
      if (idx >= 0) {
        const next = [...current]
        next.splice(idx, 1)
        learningStore.updateSettings({ enabledPoems: next })
      } else {
        learningStore.updateSettings({ enabledPoems: [...current, poemId] })
      }
    }
  }

  function toggleGrade(grade: string, enabled: boolean) {
    const learningStore = useLearningStore()
    const current = learningStore.settings.enabledPoems
    const gradeIds = (poemsByGrade.value.get(grade) ?? []).map(p => p.id)

    if (current.length === 0) {
      if (!enabled) {
        const excludeSet = new Set(gradeIds)
        learningStore.updateSettings({ enabledPoems: poems.value.filter(p => !excludeSet.has(p.id)).map(p => p.id) })
      }
    } else {
      if (enabled) {
        const existingSet = new Set(current)
        const toAdd = gradeIds.filter(id => !existingSet.has(id))
        learningStore.updateSettings({ enabledPoems: [...current, ...toAdd] })
      } else {
        const excludeSet = new Set(gradeIds)
        learningStore.updateSettings({ enabledPoems: current.filter((id: string) => !excludeSet.has(id)) })
      }
    }
  }

  const enabledCount = computed(() => enabledPoems.value.length)

  function gradeEnabledCount(grade: string): number {
    const learningStore = useLearningStore()
    const enabledSet = learningStore.settings.enabledPoems
    const gradePoems = poemsByGrade.value.get(grade) ?? []
    if (enabledSet.length === 0) return gradePoems.length
    const ids = new Set(enabledSet)
    return gradePoems.filter(p => ids.has(p.id)).length
  }

  const poemsByAuthor = computed(() => {
    const map = new Map<string, Poem[]>()
    for (const poem of poems.value) {
      const list = map.get(poem.author) ?? []
      list.push(poem)
      map.set(poem.author, list)
    }
    // Group single-poem authors into "其他"
    const otherPoems: Poem[] = []
    const toRemove: string[] = []
    for (const [author, poems] of map) {
      if (poems.length <= 1) {
        otherPoems.push(...poems)
        toRemove.push(author)
      }
    }
    for (const author of toRemove) {
      map.delete(author)
    }
    if (otherPoems.length > 0) {
      map.set('其他', otherPoems)
    }
    return map
  })

  const authors = computed(() => {
    const countMap = new Map<string, number>()
    for (const poem of poems.value) {
      countMap.set(poem.author, (countMap.get(poem.author) ?? 0) + 1)
    }
    const multiAuthor = [...countMap.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([author]) => author)
    const hasSingle = [...countMap.entries()].some(([, count]) => count <= 1)
    return hasSingle ? [...multiAuthor, '其他'] : multiAuthor
  })

  async function fetchPoems() {
    if (poems.value.length > 0) return
    loading.value = true
    try {
      const resp = await fetch('/poems.json')
      poems.value = await resp.json()
    } finally {
      loading.value = false
    }
  }

  function getPoemById(id: string): Poem | undefined {
    return poems.value.find(p => p.id === id)
  }

  return { poems, loading, grades, poemsByGrade, poemsByAuthor, authors, enabledPoems, enabledCount, fetchPoems, getPoemById, isEnabled, togglePoem, toggleGrade, gradeEnabledCount }
})
