import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Poem } from '@/types'

export const usePoemStore = defineStore('poem', () => {
  const poems = ref<Poem[]>([])
  const loading = ref(false)

  const grades = computed(() => {
    return [...new Set(poems.value.map(p => p.grade))].sort()
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

  return { poems, loading, grades, poemsByGrade, fetchPoems, getPoemById }
})
