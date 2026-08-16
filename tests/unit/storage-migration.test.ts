import { describe, it, expect, beforeEach } from 'vitest'
import { loadData, saveData, importData, clearData } from '@/utils/storage'

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

describe('loadData migration', () => {
  it('resets data when old poemId starts with b', () => {
    const oldData = {
      records: [{ poemId: 'b001', lastReviewDate: '2026-01-01', reviewCount: 1, nextReviewDate: '2026-01-02', correctness: [1], masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0 }],
      quizResults: [],
      wrongBook: [],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
    }
    localStorage.setItem('poem-quiz-data', JSON.stringify(oldData))
    const data = loadData()
    expect(data.records).toHaveLength(0)
  })

  it('resets data when quizResults have old poemId', () => {
    const oldData = {
      records: [],
      quizResults: [{ poemId: 'b001', quizType: 'fillBlank', date: '2026-01-01', correct: true }],
      wrongBook: [],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
    }
    localStorage.setItem('poem-quiz-data', JSON.stringify(oldData))
    const data = loadData()
    expect(data.quizResults).toHaveLength(0)
  })

  it('resets data when wrongBook has old poemId', () => {
    const oldData = {
      records: [],
      quizResults: [],
      wrongBook: [{ poemId: 'b001', quizType: 'fillBlank', wrongCount: 1, lastWrongDate: '2026-01-01', unproficient: false }],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank'], selectedGrades: [] },
    }
    localStorage.setItem('poem-quiz-data', JSON.stringify(oldData))
    const data = loadData()
    expect(data.wrongBook).toHaveLength(0)
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
