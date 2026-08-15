import { describe, it, expect } from 'vitest'
import {
  shuffleArray,
  getPoemsBySource,
  getReviewPoems,
  getUnproficientPoems,
  getWrongPoems,
  getRecentlyLearnedPoems,
  smartMix,
} from '@/utils/quiz'
import type { Poem, LearningRecord, WrongEntry } from '@/types'

function makePoem(overrides: Partial<Poem> = {}): Poem {
  return {
    id: 'p1',
    title: '静夜思',
    author: '李白',
    dynasty: '唐',
    grade: '一年级',
    text: ['床前明月光', '疑是地上霜'],
    textType: '五言',
    ...overrides,
  }
}

function makeRecord(overrides: Partial<LearningRecord> = {}): LearningRecord {
  return {
    poemId: 'p1',
    lastReviewDate: '2026-01-01',
    reviewCount: 0,
    nextReviewDate: '2026-01-01',
    correctness: [],
    reciteCorrectness: [],
    masteryLevel: '新',
    unproficient: false,
    unproficientCorrectStreak: 0,
    ...overrides,
  }
}

function makeWrongEntry(overrides: Partial<WrongEntry> = {}): WrongEntry {
  return {
    poemId: 'p1',
    quizType: 'fillBlank',
    wrongCount: 1,
    lastWrongDate: '2026-01-01',
    unproficient: false,
    ...overrides,
  }
}

const today = '2026-01-15'

describe('shuffleArray', () => {
  it('returns a new array with the same elements', () => {
    const arr = [1, 2, 3, 4, 5]
    const result = shuffleArray(arr)
    expect(result.sort()).toEqual(arr.sort())
    expect(result).not.toBe(arr)
  })

  it('handles empty array', () => {
    expect(shuffleArray([])).toEqual([])
  })

  it('handles single element', () => {
    expect(shuffleArray([42])).toEqual([42])
  })
})

describe('getPoemsBySource', () => {
  const poems = [
    makePoem({ id: 'p1', grade: '一年级' }),
    makePoem({ id: 'p2', grade: '二年级' }),
    makePoem({ id: 'p3', grade: '一年级' }),
  ]

  it('returns all poems for "all" source', () => {
    expect(getPoemsBySource(poems, 'all', today)).toHaveLength(3)
  })

  it('filters by grade', () => {
    const result = getPoemsBySource(poems, 'grade', today, { grades: ['一年级'] })
    expect(result).toHaveLength(2)
    expect(result.every(p => p.grade === '一年级')).toBe(true)
  })

  it('returns all for other source types', () => {
    expect(getPoemsBySource(poems, 'review', today)).toHaveLength(3)
    expect(getPoemsBySource(poems, 'wrong', today)).toHaveLength(3)
  })
})

describe('getReviewPoems', () => {
  it('returns poems due for review', () => {
    const poems = [makePoem({ id: 'p1' }), makePoem({ id: 'p2' })]
    const records = [
      makeRecord({ poemId: 'p1', nextReviewDate: '2026-01-10' }), // due
      makeRecord({ poemId: 'p2', nextReviewDate: '2026-12-31' }), // not due
    ]
    const result = getReviewPoems(poems, records, today)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
  })

  it('excludes poems without records', () => {
    const poems = [makePoem({ id: 'p1' })]
    const result = getReviewPoems(poems, [], today)
    expect(result).toHaveLength(0)
  })
})

describe('getUnproficientPoems', () => {
  it('returns poems marked as unproficient', () => {
    const poems = [makePoem({ id: 'p1' }), makePoem({ id: 'p2' })]
    const records = [
      makeRecord({ poemId: 'p1', unproficient: true }),
      makeRecord({ poemId: 'p2', unproficient: false }),
    ]
    const result = getUnproficientPoems(poems, records)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
  })
})

describe('getWrongPoems', () => {
  it('returns poems that appear in wrong book', () => {
    const poems = [makePoem({ id: 'p1' }), makePoem({ id: 'p2' })]
    const wrongBook = [makeWrongEntry({ poemId: 'p1' })]
    const result = getWrongPoems(poems, wrongBook)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
  })
})

describe('getRecentlyLearnedPoems', () => {
  it('returns poems learned within last 7 days', () => {
    const poems = [makePoem({ id: 'p1' }), makePoem({ id: 'p2' }), makePoem({ id: 'p3' })]
    const records = [
      makeRecord({ poemId: 'p1', lastLearnDate: '2026-01-10' }), // 5 days ago
      makeRecord({ poemId: 'p2', lastLearnDate: '2026-01-07' }), // 8 days ago
      makeRecord({ poemId: 'p3', lastLearnDate: '2026-01-15' }), // today
    ]
    const result = getRecentlyLearnedPoems(poems, records, today)
    expect(result).toHaveLength(2)
    expect(result.map(p => p.id).sort()).toEqual(['p1', 'p3'])
  })

  it('excludes poems without lastLearnDate', () => {
    const poems = [makePoem({ id: 'p1' })]
    const records = [makeRecord({ poemId: 'p1' })] // no lastLearnDate
    const result = getRecentlyLearnedPoems(poems, records, today)
    expect(result).toHaveLength(0)
  })
})

describe('smartMix', () => {
  it('returns correct number of poems', () => {
    const poems = Array.from({ length: 20 }, (_, i) =>
      makePoem({ id: `p${i}`, grade: '一年级' })
    )
    const records = poems.map(p =>
      makeRecord({ poemId: p.id, nextReviewDate: '2026-01-01', unproficient: false, lastLearnDate: '2020-01-01' })
    )
    const result = smartMix(poems, records, [], 10, today)
    expect(result).toHaveLength(10)
  })

  it('returns no duplicates', () => {
    const poems = Array.from({ length: 20 }, (_, i) =>
      makePoem({ id: `p${i}`, grade: '一年级' })
    )
    const records = poems.map(p =>
      makeRecord({ poemId: p.id, nextReviewDate: '2026-01-01', unproficient: true, lastLearnDate: '2026-01-10' })
    )
    const wrongBook = poems.map(p => makeWrongEntry({ poemId: p.id }))
    const result = smartMix(poems, records, wrongBook, 10, today)
    const ids = result.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('falls back when sources insufficient', () => {
    // Only 1 review poem, 0 others - should still get 5 poems
    const poems = Array.from({ length: 5 }, (_, i) =>
      makePoem({ id: `p${i}` })
    )
    const records = [
      makeRecord({ poemId: 'p0', nextReviewDate: '2026-01-01' }),
      ...poems.slice(1).map(p => makeRecord({ poemId: p.id, nextReviewDate: '2099-12-31' })),
    ]
    const result = smartMix(poems, records, [], 5, today)
    expect(result).toHaveLength(5)
  })

  it('returns empty when no poems', () => {
    const result = smartMix([], [], [], 5, today)
    expect(result).toHaveLength(0)
  })

  it('returns fewer than requested if not enough poems', () => {
    const poems = [makePoem({ id: 'p1' })]
    const records = [makeRecord({ poemId: 'p1' })]
    const result = smartMix(poems, records, [], 5, today)
    expect(result).toHaveLength(1)
  })

  it('selects from all sources by ratio', () => {
    const poems = Array.from({ length: 20 }, (_, i) =>
      makePoem({ id: `p${i}` })
    )
    const records = poems.map(p =>
      makeRecord({
        poemId: p.id,
        nextReviewDate: '2026-01-01',       // due for review
        unproficient: true,                   // unproficient
        lastLearnDate: '2026-01-10',          // recently learned
      })
    )
    const wrongBook = poems.map(p => makeWrongEntry({ poemId: p.id }))
    const result = smartMix(poems, records, wrongBook, 10, today)
    expect(result).toHaveLength(10)
    // All should be from the pool since all qualify for every source
    const ids = result.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
