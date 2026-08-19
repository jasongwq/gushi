import type { LearningRecord, WrongEntry, Poem } from '@/types'
import { addDays } from '@/utils/ebbinghaus'

export type ReviewReason = 'due' | 'unproficient' | 'wrongBook' | 'new'

export interface ReviewPlanItem {
  poemId: string
  reasons: ReviewReason[]
}

export interface ReviewPlanDay {
  date: string
  items: ReviewPlanItem[]
}

/**
 * 生成未来 days 天的复习计划。
 * 归组规则：
 * - due: nextReviewDate === date；逾期（< today）落回今天
 * - unproficient: 归入今天（持续状态）
 * - new: 无学习记录的诗归入今天
 * - wrongBook: lastWrongDate + 1 天；逾期落回今天；多条目取最近 lastWrongDate
 */
export function buildReviewPlan(
  records: LearningRecord[],
  wrongBook: WrongEntry[],
  poems: Poem[],
  days: number = 30,
  today?: string,
  schedule?: Record<string, string>,
): ReviewPlanDay[] {
  const baseDate = today ?? new Date().toISOString().slice(0, 10)
  const recordMap = new Map(records.map(r => [r.poemId, r]))
  const learnedIds = new Set(recordMap.keys())

  // 每首诗最近一次错题日期（取 max lastWrongDate）
  const wrongByPoem = new Map<string, string>()
  for (const entry of wrongBook) {
    const cur = wrongByPoem.get(entry.poemId)
    if (!cur || entry.lastWrongDate > cur) {
      wrongByPoem.set(entry.poemId, entry.lastWrongDate)
    }
  }

  const plan: ReviewPlanDay[] = []
  for (let i = 0; i < days; i++) {
    const date = addDays(baseDate, i)
    const items: ReviewPlanItem[] = []

    for (const poem of poems) {
      const record = recordMap.get(poem.id)
      const reasons: ReviewReason[] = []

      // due：到期当天，或逾期落回今天
      if (record) {
        if (record.nextReviewDate === date) {
          reasons.push('due')
        } else if (record.nextReviewDate < baseDate && date === baseDate) {
          reasons.push('due')
        }
      }

      // unproficient：仅今天
      if (date === baseDate && record?.unproficient) {
        reasons.push('unproficient')
      }

      // wrongBook：lastWrongDate+1 天；逾期落回今天
      const lastWrong = wrongByPoem.get(poem.id)
      if (lastWrong) {
        const suggested = addDays(lastWrong, 1)
        if (suggested === date) {
          reasons.push('wrongBook')
        } else if (suggested < baseDate && date === baseDate) {
          reasons.push('wrongBook')
        }
      }

      // new：排程到当天的未学诗；排程日期已过（逾期未学）落回今天
      if (!learnedIds.has(poem.id)) {
        const scheduledDate = schedule?.[poem.id]
        if (scheduledDate) {
          if (scheduledDate === date) {
            reasons.push('new')
          } else if (scheduledDate < baseDate && date === baseDate) {
            reasons.push('new')
          }
        }
      }

      if (reasons.length > 0) {
        items.push({ poemId: poem.id, reasons })
      }
    }

    plan.push({ date, items })
  }

  return plan
}
