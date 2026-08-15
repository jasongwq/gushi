import type { LearningRecord } from '@/types'
import { getNextInterval } from '@/utils/ebbinghaus'

/**
 * 计算单首古诗在某天的记忆保持率
 * 保持率 = max(0, 1 - 距上次复习天数 / 当前复习间隔)
 * reviewCount=0 时返回 0（未学习）
 */
export function calculateRetention(record: LearningRecord, date: string): number {
  if (record.reviewCount === 0) return 0

  const lastReview = new Date(record.lastReviewDate + 'T00:00:00')
  const targetDate = new Date(date + 'T00:00:00')
  const daysSinceReview = Math.floor((targetDate.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24))

  if (daysSinceReview <= 0) return 1

  const interval = getNextInterval(record.reviewCount)
  return Math.max(0, 1 - daysSinceReview / interval)
}

/**
 * 计算所有已学习古诗在某天的平均保持率
 */
export function calculateOverallRetention(records: LearningRecord[], date: string): number {
  const learned = records.filter(r => r.reviewCount > 0)
  if (learned.length === 0) return 0
  const sum = learned.reduce((acc, r) => acc + calculateRetention(r, date), 0)
  return sum / learned.length
}

/**
 * 生成日期范围内的每日保持率数据
 */
export function calculateDailyRetention(
  records: LearningRecord[],
  startDate: string,
  endDate: string,
): { date: string; retention: number }[] {
  const result: { date: string; retention: number }[] = []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10)
    result.push({ date: dateStr, retention: calculateOverallRetention(records, dateStr) })
  }
  return result
}

/**
 * 计算单首古诗的遗忘曲线时间线数据点
 * 基于 correctness 和 reciteCorrectness 重建每次复习后的保持率
 */
export function calculatePoemRetentionTimeline(
  record: LearningRecord,
  _endDate: string,
): { date: string; retention: number; type: 'quiz' | 'recite'; correct: boolean }[] {
  if (record.reviewCount === 0) return []

  const points: { date: string; retention: number; type: 'quiz' | 'recite'; correct: boolean }[] = []
  const startDate = new Date(record.lastReviewDate + 'T00:00:00')

  let reviewCount = 0
  let lastDate = startDate

  // 答题记录
  for (const correct of record.correctness) {
    reviewCount++
    const interval = getNextInterval(reviewCount - 1)
    const retention = correct ? 1 : 0.5
    points.push({
      date: lastDate.toISOString().slice(0, 10),
      retention,
      type: 'quiz',
      correct: correct === 1,
    })
    const nextDate = new Date(lastDate)
    nextDate.setDate(nextDate.getDate() + interval)
    lastDate = nextDate
  }

  // 背诵记录
  for (const correct of record.reciteCorrectness) {
    const retention = correct ? 1 : 0.5
    points.push({
      date: lastDate.toISOString().slice(0, 10),
      retention,
      type: 'recite',
      correct: correct === 1,
    })
  }

  return points
}
