import type { Poem } from '@/types'
import { addDays } from '@/utils/ebbinghaus'

export type PaceOption =
  | { type: 'perDay'; count: number }      // 每天 count 首，count ∈ 1..5
  | { type: 'perDays'; days: number }       // 每 days 天 1 首，days ∈ 2/3/5

export const PACE_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '每天 1 首' },
  { value: '2', label: '每天 2 首' },
  { value: '3', label: '每天 3 首' },
  { value: '4', label: '每天 4 首' },
  { value: '5', label: '每天 5 首' },
  { value: 'every2', label: '每 2 天 1 首' },
  { value: 'every3', label: '每 3 天 1 首' },
  { value: 'every5', label: '每 5 天 1 首' },
]

// 把节奏档位 value 解析为 PaceOption
export function parsePace(value: string): PaceOption {
  if (value === 'every2') return { type: 'perDays', days: 2 }
  if (value === 'every3') return { type: 'perDays', days: 3 }
  if (value === 'every5') return { type: 'perDays', days: 5 }
  const count = parseInt(value, 10)
  if (count >= 1 && count <= 5) return { type: 'perDay', count }
  return { type: 'perDay', count: 3 } // 默认每天 3 首
}

/**
 * 把未学的诗按节奏排到日期映射 { poemId: 'YYYY-MM-DD' }。
 * 传入顺序决定排程顺序（调用方需按年级低→高排序）。
 * perDay: 每天 count 首，连续排
 * perDays: 每 days 天 1 首
 */
export function buildSchedule(
  unlearnedPoems: Poem[],
  pace: PaceOption,
  today: string,
): Record<string, string> {
  const result: Record<string, string> = {}
  if (pace.type === 'perDay') {
    for (let i = 0; i < unlearnedPoems.length; i++) {
      const dayIndex = Math.floor(i / pace.count)
      result[unlearnedPoems[i].id] = addDays(today, dayIndex)
    }
  } else {
    for (let i = 0; i < unlearnedPoems.length; i++) {
      result[unlearnedPoems[i].id] = addDays(today, i * pace.days)
    }
  }
  return result
}

/**
 * 把已标记已学但待排复习的诗（nextReviewDate === '2099-01-01'）按每天复习名额 N 摊开。
 * 全局配额算法：
 * 1. 从今天起逐天检查
 * 2. 每天先放艾宾浩斯到期的诗（占用当天名额）
 * 3. 当天剩余名额（N - 艾宾浩斯到期数）给标记已学的诗，满则顺延下一天
 * 已分配实际日期的诗（非 2099 占位）保持不变。
 */
export function spreadReviews(
  markedLearned: Record<string, string>,  // poemId → 当前 nextReviewDate
  ebbinghausDue: Record<string, string>,   // poemId → nextReviewDate（今天或已过，当天到期）
  reviewPerDay: number,                    // 每天最多复习数 N
  today: string,
): Record<string, string> {
  const result: Record<string, string> = {}
  // 待排的标记已学诗（按 poemId 顺序稳定）
  const pending = Object.entries(markedLearned).filter(([, date]) => date === '2099-01-01')
  if (pending.length === 0) return result

  // 每天艾宾浩斯到期数（占名额）
  const dueCountByDay = new Map<string, number>()
  for (const date of Object.values(ebbinghausDue)) {
    const d = date <= today ? today : date
    dueCountByDay.set(d, (dueCountByDay.get(d) ?? 0) + 1)
  }

  let pendingIdx = 0
  let dayOffset = 0
  while (pendingIdx < pending.length) {
    const date = addDays(today, dayOffset)
    const dueCount = dueCountByDay.get(date) ?? 0
    const available = Math.max(0, reviewPerDay - dueCount)
    for (let i = 0; i < available && pendingIdx < pending.length; i++) {
      const [poemId] = pending[pendingIdx]
      result[poemId] = date
      pendingIdx++
    }
    dayOffset++
  }

  // 保留已分配实际日期的诗
  for (const [poemId, date] of Object.entries(markedLearned)) {
    if (date !== '2099-01-01' && !(poemId in result)) {
      result[poemId] = date
    }
  }
  return result
}
