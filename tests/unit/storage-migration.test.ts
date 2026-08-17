import { describe, it, expect, beforeEach } from 'vitest'
import { loadData, importData } from '@/utils/storage'

beforeEach(() => {
  localStorage.clear()
})

describe('importData', () => {
  it('rejects null object', () => {
    expect(importData('null')).toBe(false)
  })

  it('rejects non-object', () => {
    expect(importData('42')).toBe(false)
    expect(importData('"string"')).toBe(false)
  })

  it('rejects object without records array', () => {
    expect(importData('{"settings":{}}')).toBe(false)
  })

  it('rejects object without settings', () => {
    expect(importData('{"records":[]}')).toBe(false)
  })

  it('rejects records that is not an array', () => {
    expect(importData('{"records":"not-array","settings":{}}')).toBe(false)
  })

  it('accepts valid data', () => {
    const data = {
      records: [],
      quizResults: [],
      reciteRecords: [],
      wrongBook: [],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
    }
    expect(importData(JSON.stringify(data))).toBe(true)
  })
})

describe('importData default value filling', () => {
  beforeEach(() => { localStorage.clear() })

  it('fills missing record fields with defaults', () => {
    const data = {
      records: [{ poemId: 'p001' }],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
    }
    expect(importData(JSON.stringify(data))).toBe(true)
    const loaded = loadData()
    expect(loaded.records[0].poemId).toBe('p001')
    expect(loaded.records[0].reviewCount).toBe(0)
    expect(loaded.records[0].correctness).toEqual([])
    expect(loaded.records[0].masteryLevel).toBe('新')
  })

  it('filters out records without poemId', () => {
    const data = {
      records: [{ poemId: '' }, { poemId: 'p001' }, {}],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
    }
    expect(importData(JSON.stringify(data))).toBe(true)
    const loaded = loadData()
    expect(loaded.records).toHaveLength(1)
    expect(loaded.records[0].poemId).toBe('p001')
  })

  it('fills missing wrongBook fields with defaults', () => {
    const data = {
      records: [],
      wrongBook: [{ poemId: 'p001', quizType: 'fillBlank' }],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
    }
    expect(importData(JSON.stringify(data))).toBe(true)
    const loaded = loadData()
    expect(loaded.wrongBook[0].wrongCount).toBe(0)
    expect(loaded.wrongBook[0].unproficient).toBe(false)
  })
})

describe('loadData with old poemId', () => {
  it('preserves data with old poemId (migration removed)', () => {
    const oldData = {
      records: [{ poemId: 'b001', lastReviewDate: '2026-01-01', reviewCount: 1, nextReviewDate: '2026-01-02', correctness: [1], masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0 }],
      quizResults: [],
      wrongBook: [],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
    }
    localStorage.setItem('poem-quiz-data', JSON.stringify(oldData))
    const data = loadData()
    // Migration code removed — data is preserved
    expect(data.records).toHaveLength(1)
    expect(data.records[0].poemId).toBe('b001')
  })

  it('preserves data with valid poemIds', () => {
    const validData = {
      records: [{ poemId: 'p001', lastReviewDate: '2026-01-01', reviewCount: 1, nextReviewDate: '2026-01-02', correctness: [1], reciteCorrectness: [], masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0 }],
      quizResults: [],
      reciteRecords: [],
      wrongBook: [],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
    }
    localStorage.setItem('poem-quiz-data', JSON.stringify(validData))
    const data = loadData()
    expect(data.records).toHaveLength(1)
    expect(data.records[0].poemId).toBe('p001')
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('poem-quiz-data', 'not-json{{{')
    const data = loadData()
    expect(data.records).toEqual([])
  })

  it('merges partial data with defaults', () => {
    const partial = {
      records: [],
      settings: { quizCount: 10 },
    }
    localStorage.setItem('poem-quiz-data', JSON.stringify(partial))
    const data = loadData()
    expect(data.settings.quizCount).toBe(10)
    expect(data.quizResults).toEqual([])
  })
})
