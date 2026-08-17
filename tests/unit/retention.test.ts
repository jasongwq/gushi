import { describe, it, expect } from 'vitest'
import { calculateRetention, calculateOverallRetention, calculateDailyRetention } from '@/utils/retention'
import type { LearningRecord } from '@/types'

describe('calculateRetention', () => {
  it('returns 1 for a poem just reviewed today', () => {
    const today = new Date().toISOString().slice(0, 10)
    const record: LearningRecord = {
      poemId: 'p001', lastReviewDate: today, reviewCount: 1,
      nextReviewDate: today, correctness: [1], reciteCorrectness: [],
      charMarkStats: [],
      masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0,
    }
    expect(calculateRetention(record, today)).toBeCloseTo(1)
  })

  it('returns 0 for a poem never reviewed', () => {
    const today = new Date().toISOString().slice(0, 10)
    const record: LearningRecord = {
      poemId: 'p001', lastReviewDate: today, reviewCount: 0,
      nextReviewDate: today, correctness: [], reciteCorrectness: [],
      charMarkStats: [],
      masteryLevel: '新', unproficient: false, unproficientCorrectStreak: 0,
    }
    expect(calculateRetention(record, today)).toBe(0)
  })

  it('decreases as days pass since last review', () => {
    const today = '2026-08-15'
    const record: LearningRecord = {
      poemId: 'p001', lastReviewDate: '2026-08-13', reviewCount: 2,
      nextReviewDate: '2026-08-15', correctness: [1, 1], reciteCorrectness: [],
      charMarkStats: [],
      masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0,
    }
    const retention = calculateRetention(record, today)
    expect(retention).toBeGreaterThan(0)
    expect(retention).toBeLessThan(1)
  })
})

describe('calculateOverallRetention', () => {
  it('returns 0 for empty records', () => {
    expect(calculateOverallRetention([], '2026-08-15')).toBe(0)
  })

  it('returns average retention across records', () => {
    const today = '2026-08-15'
    const records: LearningRecord[] = [
      { poemId: 'p001', lastReviewDate: today, reviewCount: 1, nextReviewDate: '2026-08-17', correctness: [1], reciteCorrectness: [], charMarkStats: [], masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0 },
      { poemId: 'p002', lastReviewDate: today, reviewCount: 1, nextReviewDate: '2026-08-17', correctness: [1], reciteCorrectness: [], charMarkStats: [], masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0 },
    ]
    expect(calculateOverallRetention(records, today)).toBeCloseTo(1)
  })
})

describe('calculateDailyRetention', () => {
  it('returns array of retention values for date range', () => {
    const records: LearningRecord[] = [
      { poemId: 'p001', lastReviewDate: '2026-08-10', reviewCount: 1, nextReviewDate: '2026-08-12', correctness: [1], reciteCorrectness: [], charMarkStats: [], masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0 },
    ]
    const result = calculateDailyRetention(records, '2026-08-10', '2026-08-12')
    expect(result).toHaveLength(3)
    expect(result[0].retention).toBeCloseTo(1)
    expect(result[2].retention).toBeLessThan(1)
  })
})
