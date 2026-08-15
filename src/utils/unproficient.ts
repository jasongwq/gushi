import type { LearningRecord } from '@/types'

const AUTO_UNMARK_THRESHOLD = 3

export function markUnproficient(record: LearningRecord): LearningRecord {
  return { ...record, unproficient: true, unproficientCorrectStreak: 0 }
}

export function unmarkUnproficient(record: LearningRecord): LearningRecord {
  return { ...record, unproficient: false, unproficientCorrectStreak: 0 }
}

export function checkAutoUnmark(record: LearningRecord, correct: boolean): LearningRecord {
  if (!record.unproficient) return record

  if (correct) {
    const newStreak = record.unproficientCorrectStreak + 1
    if (newStreak >= AUTO_UNMARK_THRESHOLD) {
      return { ...record, unproficient: false, unproficientCorrectStreak: 0 }
    }
    return { ...record, unproficientCorrectStreak: newStreak }
  }

  return { ...record, unproficientCorrectStreak: 0 }
}
