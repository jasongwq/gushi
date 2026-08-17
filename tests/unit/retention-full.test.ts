import { describe, it, expect } from 'vitest'
import { calculateRetention, calculateOverallRetention, calculateDailyRetention, calculatePoemRetentionTimeline } from '@/utils/retention'
import type { LearningRecord } from '@/types'

function makeRecord(overrides: Partial<LearningRecord> = {}): LearningRecord {
  return {
    poemId: 'p001',
    lastReviewDate: '2026-01-01',
    reviewCount: 1,
    nextReviewDate: '2026-01-02',
    correctness: [1],
    reciteCorrectness: [],
    charMarkStats: [],
    masteryLevel: '学',
    unproficient: false,
    unproficientCorrectStreak: 0,
    ...overrides,
  }
}

describe('calculateRetention', () => {
  it('returns 0 for unreviewed poem', () => {
    const record = makeRecord({ reviewCount: 0, correctness: [] })
    expect(calculateRetention(record, '2026-01-01')).toBe(0)
  })

  it('returns 1 for same-day review', () => {
    const record = makeRecord({ lastReviewDate: '2026-01-01', reviewCount: 1 })
    expect(calculateRetention(record, '2026-01-01')).toBeCloseTo(1)
  })

  it('returns 1 for future date relative to review', () => {
    const record = makeRecord({ lastReviewDate: '2026-01-05', reviewCount: 1 })
    expect(calculateRetention(record, '2026-01-03')).toBeCloseTo(1)
  })

  it('decreases over time', () => {
    const record = makeRecord({ lastReviewDate: '2026-01-01', reviewCount: 1 })
    const r1 = calculateRetention(record, '2026-01-01')
    const r2 = calculateRetention(record, '2026-01-02')
    expect(r1).toBeGreaterThan(r2)
  })

  it('returns 0 when fully decayed', () => {
    const record = makeRecord({ lastReviewDate: '2026-01-01', reviewCount: 1 })
    // Interval for reviewCount=1 is 2 days, so 100 days later should be 0
    expect(calculateRetention(record, '2026-05-01')).toBe(0)
  })

  it('higher reviewCount means slower decay', () => {
    const r1 = makeRecord({ lastReviewDate: '2026-01-01', reviewCount: 1 })
    const r5 = makeRecord({ lastReviewDate: '2026-01-01', reviewCount: 5 })
    // 5 days later: reviewCount=1 has interval 2, reviewCount=5 has interval 15
    const retention1 = calculateRetention(r1, '2026-01-06')
    const retention5 = calculateRetention(r5, '2026-01-06')
    expect(retention5).toBeGreaterThan(retention1)
  })
})

describe('calculateOverallRetention', () => {
  it('returns 0 for empty records', () => {
    expect(calculateOverallRetention([], '2026-01-01')).toBe(0)
  })

  it('returns 0 when all records are unreviewed', () => {
    const records = [makeRecord({ reviewCount: 0, correctness: [] })]
    expect(calculateOverallRetention(records, '2026-01-01')).toBe(0)
  })

  it('returns average retention', () => {
    const records = [
      makeRecord({ poemId: 'p001', lastReviewDate: '2026-01-01', reviewCount: 1 }),
      makeRecord({ poemId: 'p002', lastReviewDate: '2025-12-01', reviewCount: 1 }),
    ]
    const retention = calculateOverallRetention(records, '2026-01-01')
    expect(retention).toBeGreaterThan(0)
    expect(retention).toBeLessThanOrEqual(1)
  })
})

describe('calculateDailyRetention', () => {
  it('returns correct number of days', () => {
    const records = [makeRecord({ lastReviewDate: '2026-01-01', reviewCount: 1 })]
    const result = calculateDailyRetention(records, '2026-01-01', '2026-01-05')
    expect(result).toHaveLength(5)
    expect(result[0].date).toBe('2026-01-01')
    expect(result[4].date).toBe('2026-01-05')
  })

  it('retention decreases over days', () => {
    const records = [makeRecord({ lastReviewDate: '2026-01-01', reviewCount: 1 })]
    const result = calculateDailyRetention(records, '2026-01-01', '2026-01-03')
    expect(result[0].retention).toBeGreaterThan(result[2].retention)
  })

  it('returns 0 retention for all unreviewed', () => {
    const records = [makeRecord({ reviewCount: 0, correctness: [] })]
    const result = calculateDailyRetention(records, '2026-01-01', '2026-01-03')
    result.forEach(d => expect(d.retention).toBe(0))
  })
})

describe('calculatePoemRetentionTimeline', () => {
  it('returns empty for unreviewed poem', () => {
    const record = makeRecord({ reviewCount: 0, correctness: [] })
    expect(calculatePoemRetentionTimeline(record, '2026-01-10')).toEqual([])
  })

  it('returns quiz points from correctness array', () => {
    const record = makeRecord({
      lastReviewDate: '2026-01-01',
      reviewCount: 3,
      correctness: [1, 0, 1],
    })
    const points = calculatePoemRetentionTimeline(record, '2026-01-10')
    expect(points.length).toBe(3)
    expect(points[0].type).toBe('quiz')
    expect(points[0].correct).toBe(true)
    expect(points[1].correct).toBe(false)
    expect(points[2].correct).toBe(true)
  })

  it('returns recite points from reciteCorrectness array', () => {
    const record = makeRecord({
      lastReviewDate: '2026-01-01',
      reviewCount: 1,
      correctness: [1],
      reciteCorrectness: [1, 0],
    })
    const points = calculatePoemRetentionTimeline(record, '2026-01-10')
    expect(points.length).toBe(3) // 1 quiz + 2 recite
    expect(points[0].type).toBe('quiz')
    expect(points[1].type).toBe('recite')
    expect(points[2].type).toBe('recite')
    expect(points[2].correct).toBe(false)
  })

  it('dates advance by intervals', () => {
    const record = makeRecord({
      lastReviewDate: '2026-01-01',
      reviewCount: 2,
      correctness: [1, 1],
    })
    const points = calculatePoemRetentionTimeline(record, '2026-01-10')
    expect(points[0].date).toBe('2026-01-01')
    // Second point should be at 2026-01-01 + interval(1) = 2026-01-02
    expect(points[1].date).toBe('2026-01-02')
  })
})
