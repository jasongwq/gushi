import { describe, it, expect } from 'vitest'
import { buildReviewPlan } from '@/utils/reviewPlan'
import type { LearningRecord, WrongEntry, Poem } from '@/types'

const poems: Poem[] = [
  { id: 'p001', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级', text: ['床前明月光'], textType: '五言', yiwen: '' },
  { id: 'p002', title: '春晓', author: '孟浩然', dynasty: '唐', grade: '一年级', text: ['春眠不觉晓'], textType: '五言', yiwen: '' },
  { id: 'p003', title: '咏鹅', author: '骆宾王', dynasty: '唐', grade: '一年级', text: ['鹅鹅鹅'], textType: '其他', yiwen: '' },
  { id: 'p004', title: '江南', author: '汉乐府', dynasty: '汉', grade: '一年级', text: ['江南可采莲'], textType: '五言', yiwen: '' },
]

function makeRecord(poemId: string, nextReviewDate: string, overrides: Partial<LearningRecord> = {}): LearningRecord {
  return {
    poemId, lastReviewDate: '2026-08-01', reviewCount: 1,
    nextReviewDate, correctness: [1], reciteCorrectness: [],
    charMarkStats: [], masteryLevel: '学',
    unproficient: false, unproficientCorrectStreak: 0,
    ...overrides,
  }
}

const TODAY = '2026-08-19'

describe('buildReviewPlan', () => {
  it('returns an array covering the requested number of days starting today', () => {
    const plan = buildReviewPlan([], [], poems, 30, TODAY)
    expect(plan).toHaveLength(30)
    expect(plan[0].date).toBe(TODAY)
    expect(plan[29].date).toBe('2026-09-17')
  })

  it('places due poems on their nextReviewDate', () => {
    const records = [makeRecord('p001', '2026-08-20')]
    const plan = buildReviewPlan(records, [], poems, 30, TODAY)
    const day20 = plan.find(d => d.date === '2026-08-20')
    const item = day20!.items.find(i => i.poemId === 'p001')
    expect(item?.reasons).toContain('due')
  })

  it('does not include a poem on a day that is not its nextReviewDate', () => {
    const records = [makeRecord('p001', '2026-08-25')]
    const plan = buildReviewPlan(records, [], poems, 30, TODAY)
    const day20 = plan.find(d => d.date === '2026-08-20')!
    expect(day20.items.some(i => i.poemId === 'p001')).toBe(false)
  })

  it('moves overdue due poems to today', () => {
    const records = [makeRecord('p001', '2026-08-10')]
    const plan = buildReviewPlan(records, [], poems, 30, TODAY)
    const today = plan[0]
    const item = today.items.find(i => i.poemId === 'p001')
    expect(item?.reasons).toContain('due')
  })

  it('puts unproficient poems on today', () => {
    const records = [makeRecord('p001', '2026-09-10', { unproficient: true })]
    const plan = buildReviewPlan(records, [], poems, 30, TODAY)
    const today = plan[0]
    expect(today.items.find(i => i.poemId === 'p001')?.reasons).toContain('unproficient')
  })

  it('does not mark unlearned poems as new when no schedule is provided', () => {
    // 无排程时未学诗不归入任何日期（由计划页自动生成排程）
    const plan = buildReviewPlan([], [], poems, 30, TODAY)
    const today = plan[0]
    expect(today.items.some(i => i.poemId === 'p004')).toBe(false)
  })

  it('marks new poems only on their scheduled day, not all on today', () => {
    // p001、p002 排程到今天，p003、p004 排程到 2026-08-20
    const schedule = { p001: TODAY, p002: TODAY, p003: '2026-08-20', p004: '2026-08-20' }
    const plan = buildReviewPlan([], [], poems, 30, TODAY, schedule)
    const today = plan[0]
    const todayIds = today.items.map(i => i.poemId)
    expect(todayIds).toContain('p001')
    expect(todayIds).toContain('p002')
    expect(todayIds).not.toContain('p003')
    expect(todayIds).not.toContain('p004')
    const day20 = plan.find(d => d.date === '2026-08-20')!
    expect(day20.items.map(i => i.poemId)).toEqual(expect.arrayContaining(['p003', 'p004']))
  })

  it('does not add new reason for poems already learned', () => {
    // p001 已学（有记录），p002 未学且排程今天
    const records = [makeRecord('p001', '2026-08-25')]
    const schedule = { p001: TODAY, p002: TODAY }
    const plan = buildReviewPlan(records, [], poems, 30, TODAY, schedule)
    const today = plan[0]
    // p001 已有记录 → 今天不出现（也不标 new）
    const p001Item = today.items.find(i => i.poemId === 'p001')
    expect(p001Item?.reasons ?? []).not.toContain('new')
    // p002 未学且排程今天 → new
    expect(today.items.find(i => i.poemId === 'p002')?.reasons).toContain('new')
  })

  it('moves overdue scheduled poems to today', () => {
    // p003 排程到 2026-08-10（已过），未学 → 落回今天
    const schedule = { p003: '2026-08-10' }
    const plan = buildReviewPlan([], [], poems, 30, TODAY, schedule)
    const today = plan[0]
    expect(today.items.find(i => i.poemId === 'p003')?.reasons).toContain('new')
  })

  it('schedules wrong-book poems for the day after lastWrongDate', () => {
    const wrongBook: WrongEntry[] = [
      { poemId: 'p002', quizType: 'fillBlank', wrongCount: 1, lastWrongDate: '2026-08-20', unproficient: false },
    ]
    const plan = buildReviewPlan([], wrongBook, poems, 30, TODAY)
    const day21 = plan.find(d => d.date === '2026-08-21')!
    expect(day21.items.find(i => i.poemId === 'p002')?.reasons).toContain('wrongBook')
  })

  it('moves overdue wrong-book poems to today', () => {
    const wrongBook: WrongEntry[] = [
      { poemId: 'p002', quizType: 'fillBlank', wrongCount: 1, lastWrongDate: '2026-08-10', unproficient: false },
    ]
    const plan = buildReviewPlan([], wrongBook, poems, 30, TODAY)
    const today = plan[0]
    expect(today.items.find(i => i.poemId === 'p002')?.reasons).toContain('wrongBook')
  })

  it('uses the most recent lastWrongDate for poems with multiple entries', () => {
    const wrongBook: WrongEntry[] = [
      { poemId: 'p002', quizType: 'fillBlank', wrongCount: 1, lastWrongDate: '2026-08-10', unproficient: false },
      { poemId: 'p002', quizType: 'line', wrongCount: 1, lastWrongDate: '2026-08-21', unproficient: false },
    ]
    const plan = buildReviewPlan([], wrongBook, poems, 30, TODAY)
    const day22 = plan.find(d => d.date === '2026-08-22')!
    expect(day22.items.find(i => i.poemId === 'p002')?.reasons).toContain('wrongBook')
  })

  it('combines multiple reasons for the same poem on the same day', () => {
    const records = [makeRecord('p001', '2026-08-20', { unproficient: true })]
    const wrongBook: WrongEntry[] = [
      { poemId: 'p001', quizType: 'fillBlank', wrongCount: 1, lastWrongDate: '2026-08-19', unproficient: false },
    ]
    const plan = buildReviewPlan(records, wrongBook, poems, 30, TODAY)
    // 今天：unproficient + wrongBook（错于 08-19 建议 08-20 复习，未逾期；今天只含 unproficient）
    const today = plan[0]
    const todayItem = today.items.find(i => i.poemId === 'p001')
    expect(todayItem?.reasons).toContain('unproficient')

    // 08-20：due + wrongBook（错于 08-19，次日复习）合并为一条
    const day20 = plan.find(d => d.date === '2026-08-20')!
    const item = day20.items.find(i => i.poemId === 'p001')
    expect(item?.reasons).toContain('due')
    expect(item?.reasons).not.toContain('unproficient')
    expect(item?.reasons).toContain('wrongBook')
  })

  it('merges due and wrongBook into a single item with both reasons', () => {
    const records = [makeRecord('p001', '2026-08-20')]
    const wrongBook: WrongEntry[] = [
      { poemId: 'p001', quizType: 'fillBlank', wrongCount: 1, lastWrongDate: '2026-08-19', unproficient: false },
    ]
    const plan = buildReviewPlan(records, wrongBook, poems, 30, TODAY)
    const day20 = plan.find(d => d.date === '2026-08-20')!
    const items = day20.items.filter(i => i.poemId === 'p001')
    expect(items).toHaveLength(1)
    expect(items[0].reasons).toEqual(expect.arrayContaining(['due', 'wrongBook']))
  })

  it('does not add an unproficient poem to future due days as unproficient', () => {
    // unproficient 只归今天；future due day 上该诗 reasons 不应含 unproficient
    const records = [makeRecord('p001', '2026-08-20', { unproficient: true })]
    const plan = buildReviewPlan(records, [], poems, 30, TODAY)
    const day20 = plan.find(d => d.date === '2026-08-20')!
    const item = day20.items.find(i => i.poemId === 'p001')
    expect(item?.reasons).toEqual(['due'])
  })
})
