import { describe, it, expect } from 'vitest'
import {
  getNextInterval,
  getMasteryLevel,
  addDays,
  calculateNextReview,
  handleWrongAnswer,
  isDueForReview,
} from '@/utils/ebbinghaus'
import type { LearningRecord } from '@/types'

function makeRecord(overrides: Partial<LearningRecord> = {}): LearningRecord {
  return {
    poemId: 'poem-1',
    lastReviewDate: '2026-01-01',
    reviewCount: 0,
    nextReviewDate: '2026-01-01',
    correctness: [],
    masteryLevel: '新',
    unproficient: false,
    unproficientCorrectStreak: 0,
    ...overrides,
  }
}

describe('getNextInterval', () => {
  it('returns correct intervals for each review count', () => {
    expect(getNextInterval(0)).toBe(1)
    expect(getNextInterval(1)).toBe(2)
    expect(getNextInterval(2)).toBe(4)
    expect(getNextInterval(3)).toBe(7)
    expect(getNextInterval(4)).toBe(15)
    expect(getNextInterval(5)).toBe(30)
    expect(getNextInterval(10)).toBe(30)
  })
})

describe('getMasteryLevel', () => {
  it('returns correct mastery levels for each review count', () => {
    expect(getMasteryLevel(0)).toBe('新')
    expect(getMasteryLevel(1)).toBe('学')
    expect(getMasteryLevel(2)).toBe('学')
    expect(getMasteryLevel(3)).toBe('熟')
    expect(getMasteryLevel(4)).toBe('熟')
    expect(getMasteryLevel(5)).toBe('固')
    expect(getMasteryLevel(10)).toBe('固')
  })
})

describe('addDays', () => {
  it('adds days to a date string', () => {
    expect(addDays('2026-01-01', 1)).toBe('2026-01-02')
    expect(addDays('2026-01-01', 7)).toBe('2026-01-08')
    expect(addDays('2026-01-30', 5)).toBe('2026-02-04')
    expect(addDays('2026-12-28', 5)).toBe('2027-01-02')
  })
})

describe('calculateNextReview (correct)', () => {
  it('advances reviewCount, sets next date, updates mastery', () => {
    const record = makeRecord({ reviewCount: 0, lastReviewDate: '2026-01-01' })
    const result = calculateNextReview(record, true)

    expect(result.reviewCount).toBe(1)
    expect(result.nextReviewDate).toBe('2026-01-02') // interval for count 0 → 1 day
    expect(result.masteryLevel).toBe('学')
    expect(result.correctness).toEqual([1])
    expect(result.lastReviewDate).toBe('2026-01-01')
  })

  it('advances through multiple correct answers', () => {
    let record = makeRecord({ reviewCount: 0, lastReviewDate: '2026-01-01' })
    record = calculateNextReview(record, true)
    expect(record.reviewCount).toBe(1)

    record = calculateNextReview(record, true)
    expect(record.reviewCount).toBe(2)
    expect(record.nextReviewDate).toBe(addDays('2026-01-01', 2))
    expect(record.masteryLevel).toBe('学')
  })
})

describe('handleWrongAnswer', () => {
  it('backs off interval by one level', () => {
    const record = makeRecord({ reviewCount: 4, lastReviewDate: '2026-01-01' })
    const result = handleWrongAnswer(record)
    // reviewCount 4 → interval was 7, back off one level → 4 days
    expect(result.nextReviewDate).toBe(addDays('2026-01-01', 4))
  })

  it('does not go below 1 day', () => {
    const record = makeRecord({ reviewCount: 1, lastReviewDate: '2026-01-01' })
    const result = handleWrongAnswer(record)
    // reviewCount 1 → interval was 2, back off one level → 1 day
    expect(result.nextReviewDate).toBe(addDays('2026-01-01', 1))
  })

  it('never resets to 0 days', () => {
    const record = makeRecord({ reviewCount: 0, lastReviewDate: '2026-01-01' })
    const result = handleWrongAnswer(record)
    expect(result.nextReviewDate).toBe(addDays('2026-01-01', 1))
  })

  it('records 0 in correctness and resets unproficientCorrectStreak', () => {
    const record = makeRecord({
      reviewCount: 3,
      correctness: [1, 1, 0],
      unproficientCorrectStreak: 2,
      lastReviewDate: '2026-01-01',
    })
    const result = handleWrongAnswer(record)
    expect(result.correctness).toEqual([1, 1, 0, 0])
    expect(result.unproficientCorrectStreak).toBe(0)
  })
})

describe('calculateNextReview (wrong)', () => {
  it('delegates to handleWrongAnswer when incorrect', () => {
    const record = makeRecord({ reviewCount: 3, lastReviewDate: '2026-01-01' })
    const result = calculateNextReview(record, false)
    // reviewCount 3 → interval was 4, back off one level → 2 days
    expect(result.nextReviewDate).toBe(addDays('2026-01-01', 2))
    expect(result.correctness).toEqual([0])
  })
})

describe('isDueForReview', () => {
  it('returns true when nextReviewDate is today', () => {
    const today = new Date().toISOString().slice(0, 10)
    const record = makeRecord({ nextReviewDate: today })
    expect(isDueForReview(record)).toBe(true)
  })

  it('returns true when nextReviewDate is in the past', () => {
    const record = makeRecord({ nextReviewDate: '2020-01-01' })
    expect(isDueForReview(record)).toBe(true)
  })

  it('returns false when nextReviewDate is in the future', () => {
    const record = makeRecord({ nextReviewDate: '2099-12-31' })
    expect(isDueForReview(record)).toBe(false)
  })
})
