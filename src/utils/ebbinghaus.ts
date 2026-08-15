import type { LearningRecord, MasteryLevel } from '@/types'

const INTERVALS = [1, 2, 4, 7, 15, 30]

export function getNextInterval(reviewCount: number): number {
  const index = Math.min(reviewCount, INTERVALS.length - 1)
  return INTERVALS[index]
}

export function getMasteryLevel(reviewCount: number): MasteryLevel {
  if (reviewCount === 0) return '新'
  if (reviewCount <= 2) return '学'
  if (reviewCount <= 4) return '熟'
  return '固'
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00')
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function handleWrongAnswer(record: LearningRecord): LearningRecord {
  // The interval currently in effect is INTERVALS[reviewCount - 1]
  // (or INTERVALS[0] if reviewCount is 0)
  // Back off one level from that
  const currentIndex = Math.max(0, record.reviewCount - 1)
  const currentIntervalIndex = Math.min(currentIndex, INTERVALS.length - 1)
  const backoffIndex = Math.max(0, currentIntervalIndex - 1)
  const backoffInterval = INTERVALS[backoffIndex]

  return {
    ...record,
    nextReviewDate: addDays(record.lastReviewDate, backoffInterval),
    correctness: [...record.correctness, 0],
    unproficientCorrectStreak: 0,
  }
}

export function calculateNextReview(record: LearningRecord, correct: boolean): LearningRecord {
  if (correct) {
    const newCount = record.reviewCount + 1
    const interval = getNextInterval(record.reviewCount)
    return {
      ...record,
      reviewCount: newCount,
      nextReviewDate: addDays(record.lastReviewDate, interval),
      masteryLevel: getMasteryLevel(newCount),
      correctness: [...record.correctness, 1],
      lastReviewDate: record.lastReviewDate,
    }
  }
  return handleWrongAnswer(record)
}

export function isDueForReview(record: LearningRecord): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return record.nextReviewDate <= today
}
