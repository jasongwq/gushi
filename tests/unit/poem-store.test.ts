import { describe, it, expect } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import type { Poem } from '@/types'

const mockPoems: Poem[] = [
  { id: 'p001', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级', text: ['床前明月光'], textType: '五言', yiwen: '译文' },
  { id: 'p002', title: '春晓', author: '孟浩然', dynasty: '唐', grade: '一年级', text: ['春眠不觉晓'], textType: '五言', yiwen: '译文' },
  { id: 'p003', title: '望庐山瀑布', author: '李白', dynasty: '唐', grade: '二年级', text: ['日照香炉生紫烟'], textType: '七言', yiwen: '译文' },
  { id: 'p004', title: '咏鹅', author: '骆宾王', dynasty: '唐', grade: '二年级', text: ['鹅鹅鹅'], textType: '其他', yiwen: '译文' },
  { id: 'p005', title: '登鹳雀楼', author: '王之涣', dynasty: '唐', grade: '三年级', text: ['白日依山尽'], textType: '五言', yiwen: '译文' },
]

function setupStore(poems: Poem[] = mockPoems, enabledPoems: string[] = []) {
  localStorage.clear()
  const pinia = createPinia()
  setActivePinia(pinia)
  const poemStore = usePoemStore()
  const learningStore = useLearningStore()
  // Directly set poems (skip fetchPoems)
  poemStore.poems = poems
  if (enabledPoems.length > 0) {
    learningStore.updateSettings({ enabledPoems })
  }
  return { poemStore, learningStore }
}

// === allGrades ===

describe('poemStore.allGrades', () => {
  it('returns all grades sorted by grade order', () => {
    const { poemStore } = setupStore()
    expect(poemStore.allGrades).toEqual(['一年级', '二年级', '三年级'])
  })

  it('includes grades even if all poems in that grade are disabled', () => {
    const { poemStore } = setupStore(mockPoems, ['p001', 'p002'])
    expect(poemStore.allGrades).toEqual(['一年级', '二年级', '三年级'])
  })

  it('returns empty array when no poems loaded', () => {
    const { poemStore } = setupStore([])
    expect(poemStore.allGrades).toEqual([])
  })
})

// === enabledPoems ===

describe('poemStore.enabledPoems', () => {
  it('returns all poems when enabledPoems setting is empty', () => {
    const { poemStore } = setupStore()
    expect(poemStore.enabledPoems).toHaveLength(5)
  })

  it('returns only enabled poems when enabledPoems setting is set', () => {
    const { poemStore } = setupStore(mockPoems, ['p001', 'p003'])
    expect(poemStore.enabledPoems).toHaveLength(2)
    expect(poemStore.enabledPoems.map(p => p.id)).toEqual(['p001', 'p003'])
  })

  it('returns empty array when all poems are disabled', () => {
    const { poemStore, learningStore } = setupStore(mockPoems, ['p001'])
    learningStore.updateSettings({ enabledPoems: ['nonexistent'] })
    expect(poemStore.enabledPoems).toHaveLength(0)
  })
})

// === grades ===

describe('poemStore.grades', () => {
  it('returns all grades when all poems enabled', () => {
    const { poemStore } = setupStore()
    expect(poemStore.grades).toEqual(['一年级', '二年级', '三年级'])
  })

  it('only returns grades that have enabled poems', () => {
    const { poemStore } = setupStore(mockPoems, ['p001', 'p002'])
    // Only 一年级 has enabled poems
    expect(poemStore.grades).toEqual(['一年级'])
  })

  it('returns empty when no poems enabled', () => {
    const { poemStore, learningStore } = setupStore(mockPoems, ['p001'])
    learningStore.updateSettings({ enabledPoems: ['nonexistent'] })
    expect(poemStore.grades).toEqual([])
  })
})

// === poemsByGrade ===

describe('poemStore.poemsByGrade', () => {
  it('groups all poems by grade when all enabled', () => {
    const { poemStore } = setupStore()
    expect(poemStore.poemsByGrade.get('一年级')?.map(p => p.id)).toEqual(['p001', 'p002'])
    expect(poemStore.poemsByGrade.get('二年级')?.map(p => p.id)).toEqual(['p003', 'p004'])
    expect(poemStore.poemsByGrade.get('三年级')?.map(p => p.id)).toEqual(['p005'])
  })

  it('only groups enabled poems', () => {
    const { poemStore } = setupStore(mockPoems, ['p001', 'p003'])
    expect(poemStore.poemsByGrade.get('一年级')?.map(p => p.id)).toEqual(['p001'])
    expect(poemStore.poemsByGrade.get('二年级')?.map(p => p.id)).toEqual(['p003'])
    expect(poemStore.poemsByGrade.has('三年级')).toBe(false)
  })
})

// === poemsByAuthor ===

describe('poemStore.poemsByAuthor', () => {
  it('groups multi-poem authors and singles into 其他', () => {
    const { poemStore } = setupStore()
    // 李白 has 2 poems, others have 1 each
    expect(poemStore.poemsByAuthor.get('李白')?.map(p => p.id)).toEqual(['p001', 'p003'])
    expect(poemStore.poemsByAuthor.has('孟浩然')).toBe(false)
    expect(poemStore.poemsByAuthor.get('其他')?.map(p => p.id)).toEqual(['p002', 'p004', 'p005'])
  })

  it('only groups enabled poems', () => {
    const { poemStore } = setupStore(mockPoems, ['p001', 'p002', 'p003'])
    // 李白 has 2 enabled poems, 孟浩然 has 1 → 其他
    expect(poemStore.poemsByAuthor.get('李白')?.map(p => p.id)).toEqual(['p001', 'p003'])
    expect(poemStore.poemsByAuthor.get('其他')?.map(p => p.id)).toEqual(['p002'])
  })
})

// === authors ===

describe('poemStore.authors', () => {
  it('lists multi-poem authors sorted by count, plus 其他', () => {
    const { poemStore } = setupStore()
    expect(poemStore.authors).toEqual(['李白', '其他'])
  })

  it('only includes authors with enabled poems', () => {
    const { poemStore } = setupStore(mockPoems, ['p001', 'p002'])
    // 李白 has 1 enabled poem → 其他, 孟浩然 has 1 → 其他
    expect(poemStore.authors).toEqual(['其他'])
  })

  it('no 其他 when all enabled authors have multiple poems', () => {
    const poems: Poem[] = [
      { id: 'p1', title: 'A', author: '李白', dynasty: '唐', grade: '一年级', text: [''], textType: '五言', yiwen: '' },
      { id: 'p2', title: 'B', author: '李白', dynasty: '唐', grade: '一年级', text: [''], textType: '五言', yiwen: '' },
      { id: 'p3', title: 'C', author: '杜甫', dynasty: '唐', grade: '一年级', text: [''], textType: '五言', yiwen: '' },
      { id: 'p4', title: 'D', author: '杜甫', dynasty: '唐', grade: '一年级', text: [''], textType: '五言', yiwen: '' },
    ]
    const { poemStore } = setupStore(poems)
    expect(poemStore.authors).toEqual(['李白', '杜甫'])
  })
})

// === isEnabled ===

describe('poemStore.isEnabled', () => {
  it('returns true for all poems when enabledPoems is empty', () => {
    const { poemStore } = setupStore()
    expect(poemStore.isEnabled('p001')).toBe(true)
    expect(poemStore.isEnabled('p999')).toBe(true)
  })

  it('returns true only for enabled poems', () => {
    const { poemStore } = setupStore(mockPoems, ['p001', 'p003'])
    expect(poemStore.isEnabled('p001')).toBe(true)
    expect(poemStore.isEnabled('p003')).toBe(true)
    expect(poemStore.isEnabled('p002')).toBe(false)
  })
})

// === togglePoem ===

describe('poemStore.togglePoem', () => {
  it('disables a poem when all are enabled (materializes full list)', () => {
    const { poemStore, learningStore } = setupStore()
    poemStore.togglePoem('p001')
    expect(learningStore.settings.enabledPoems).toHaveLength(4)
    expect(learningStore.settings.enabledPoems).not.toContain('p001')
  })

  it('enables a previously disabled poem', () => {
    const { poemStore, learningStore } = setupStore(mockPoems, ['p001', 'p002'])
    poemStore.togglePoem('p003')
    expect(learningStore.settings.enabledPoems).toContain('p003')
    expect(learningStore.settings.enabledPoems).toHaveLength(3)
  })

  it('disables a previously enabled poem', () => {
    const { poemStore, learningStore } = setupStore(mockPoems, ['p001', 'p002', 'p003'])
    poemStore.togglePoem('p002')
    expect(learningStore.settings.enabledPoems).not.toContain('p002')
    expect(learningStore.settings.enabledPoems).toHaveLength(2)
  })
})

// === toggleGrade ===

describe('poemStore.toggleGrade', () => {
  it('disables a grade when all poems are enabled', () => {
    const { poemStore, learningStore } = setupStore()
    poemStore.toggleGrade('一年级', false)
    // 一年级 has p001, p002; remaining should be p003, p004, p005
    expect(learningStore.settings.enabledPoems).toHaveLength(3)
    expect(learningStore.settings.enabledPoems).not.toContain('p001')
    expect(learningStore.settings.enabledPoems).not.toContain('p002')
  })

  it('enables a previously disabled grade', () => {
    const { poemStore, learningStore } = setupStore(mockPoems, ['p003', 'p004', 'p005'])
    poemStore.toggleGrade('一年级', true)
    expect(learningStore.settings.enabledPoems).toContain('p001')
    expect(learningStore.settings.enabledPoems).toContain('p002')
    expect(learningStore.settings.enabledPoems).toHaveLength(5)
  })

  it('disables a previously enabled grade', () => {
    const { poemStore, learningStore } = setupStore(mockPoems, ['p001', 'p002', 'p003', 'p004'])
    poemStore.toggleGrade('二年级', false)
    expect(learningStore.settings.enabledPoems).not.toContain('p003')
    expect(learningStore.settings.enabledPoems).not.toContain('p004')
  })

  it('does nothing when enabling a grade with all already enabled', () => {
    const { poemStore, learningStore } = setupStore()
    const before = learningStore.settings.enabledPoems.length
    poemStore.toggleGrade('一年级', true)
    // enabledPoems still empty (= all enabled)
    expect(learningStore.settings.enabledPoems).toHaveLength(before)
  })
})

// === gradeEnabledCount ===

describe('poemStore.gradeEnabledCount', () => {
  it('returns full count when all poems enabled', () => {
    const { poemStore } = setupStore()
    expect(poemStore.gradeEnabledCount('一年级')).toBe(2)
    expect(poemStore.gradeEnabledCount('二年级')).toBe(2)
    expect(poemStore.gradeEnabledCount('三年级')).toBe(1)
  })

  it('returns only enabled count for a grade', () => {
    const { poemStore } = setupStore(mockPoems, ['p001', 'p003'])
    expect(poemStore.gradeEnabledCount('一年级')).toBe(1)
    expect(poemStore.gradeEnabledCount('二年级')).toBe(1)
    expect(poemStore.gradeEnabledCount('三年级')).toBe(0)
  })

  it('returns 0 for grade with no enabled poems', () => {
    const { poemStore } = setupStore(mockPoems, ['p005'])
    expect(poemStore.gradeEnabledCount('一年级')).toBe(0)
  })
})

// === enabledCount ===

describe('poemStore.enabledCount', () => {
  it('returns total count when all enabled', () => {
    const { poemStore } = setupStore()
    expect(poemStore.enabledCount).toBe(5)
  })

  it('returns enabled count', () => {
    const { poemStore } = setupStore(mockPoems, ['p001', 'p003'])
    expect(poemStore.enabledCount).toBe(2)
  })
})

// === getPoemById ===

describe('poemStore.getPoemById', () => {
  it('returns poem by id', () => {
    const { poemStore } = setupStore()
    expect(poemStore.getPoemById('p001')?.title).toBe('静夜思')
  })

  it('returns undefined for nonexistent id', () => {
    const { poemStore } = setupStore()
    expect(poemStore.getPoemById('nonexistent')).toBeUndefined()
  })
})

// === Integration: disabling a poem affects all derived properties ===

describe('poemStore integration: disabling poem hides from all views', () => {
  it('disabling a poem removes it from grades, poemsByGrade, poemsByAuthor, authors', () => {
    const { poemStore } = setupStore()
    expect(poemStore.grades).toContain('三年级')
    expect(poemStore.poemsByGrade.has('三年级')).toBe(true)

    // Disable the only poem in 三年级
    poemStore.togglePoem('p005')

    // After: 三年级 disappears from grades and poemsByGrade
    expect(poemStore.grades).not.toContain('三年级')
    expect(poemStore.poemsByGrade.has('三年级')).toBe(false)
    expect(poemStore.enabledCount).toBe(4)

    // allGrades still shows 三年级
    expect(poemStore.allGrades).toContain('三年级')
  })

  it('disabling all poems of an author removes author from authors list', () => {
    const { poemStore } = setupStore()
    // 李白 has 2 poems
    expect(poemStore.authors).toContain('李白')

    // Disable both 李白 poems
    poemStore.togglePoem('p001')
    poemStore.togglePoem('p003')

    // 李白 disappears
    expect(poemStore.authors).not.toContain('李白')
  })
})
