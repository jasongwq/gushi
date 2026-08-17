import { describe, it, expect } from 'vitest'
import { markUnproficient, unmarkUnproficient, checkAutoUnmark } from '@/utils/unproficient'
import type { LearningRecord } from '@/types'

const baseRecord: LearningRecord = {
  poemId: 'p1',
  lastReviewDate: '2026-08-15',
  reviewCount: 1,
  nextReviewDate: '2026-08-16',
  correctness: [1],
  reciteCorrectness: [],
  charMarkStats: [],
  masteryLevel: '学',
  unproficient: false,
  unproficientCorrectStreak: 0,
}

describe('markUnproficient', () => {
  it('marks a record as unproficient', () => {
    const result = markUnproficient(baseRecord)
    expect(result.unproficient).toBe(true)
    expect(result.unproficientCorrectStreak).toBe(0)
  })
})

describe('unmarkUnproficient', () => {
  it('unmarks a record as unproficient', () => {
    const record = { ...baseRecord, unproficient: true, unproficientCorrectStreak: 2 }
    const result = unmarkUnproficient(record)
    expect(result.unproficient).toBe(false)
    expect(result.unproficientCorrectStreak).toBe(0)
  })
})

describe('checkAutoUnmark', () => {
  it('auto-unmarks after 3 consecutive correct answers', () => {
    let record = { ...baseRecord, unproficient: true, unproficientCorrectStreak: 0 }
    record = checkAutoUnmark(record, true)
    expect(record.unproficient).toBe(true)
    expect(record.unproficientCorrectStreak).toBe(1)

    record = checkAutoUnmark(record, true)
    expect(record.unproficient).toBe(true)
    expect(record.unproficientCorrectStreak).toBe(2)

    record = checkAutoUnmark(record, true)
    expect(record.unproficient).toBe(false)
    expect(record.unproficientCorrectStreak).toBe(0)
  })

  it('does not auto-unmark before 3 consecutive correct', () => {
    let record = { ...baseRecord, unproficient: true, unproficientCorrectStreak: 0 }
    record = checkAutoUnmark(record, true)
    expect(record.unproficient).toBe(true)
    record = checkAutoUnmark(record, true)
    expect(record.unproficient).toBe(true)
  })

  it('resets streak on wrong answer', () => {
    const record = { ...baseRecord, unproficient: true, unproficientCorrectStreak: 2 }
    const result = checkAutoUnmark(record, false)
    expect(result.unproficient).toBe(true)
    expect(result.unproficientCorrectStreak).toBe(0)
  })

  it('does nothing if not unproficient', () => {
    const record = { ...baseRecord, unproficient: false, unproficientCorrectStreak: 0 }
    const result = checkAutoUnmark(record, true)
    expect(result).toEqual(record)
  })
})
