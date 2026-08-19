import { describe, it, expect } from 'vitest'
import { buildSchedule, parsePace, spreadReviews, PACE_OPTIONS, type PaceOption } from '@/utils/schedule'
import type { Poem } from '@/types'

const poems: Poem[] = [
  { id: 'p001', title: 'A1', author: '', dynasty: '唐', grade: '一年级', text: ['a'], textType: '五言', yiwen: '' },
  { id: 'p002', title: 'A2', author: '', dynasty: '唐', grade: '一年级', text: ['b'], textType: '五言', yiwen: '' },
  { id: 'p003', title: 'B1', author: '', dynasty: '唐', grade: '二年级', text: ['c'], textType: '五言', yiwen: '' },
  { id: 'p004', title: 'B2', author: '', dynasty: '唐', grade: '二年级', text: ['d'], textType: '五言', yiwen: '' },
  { id: 'p005', title: 'C1', author: '', dynasty: '唐', grade: '三年级', text: ['e'], textType: '五言', yiwen: '' },
]

const TODAY = '2026-08-19'

describe('buildSchedule', () => {
  it('schedules perDay count poems each day starting today', () => {
    const pace: PaceOption = { type: 'perDay', count: 2 }
    const result = buildSchedule(poems, pace, TODAY)
    expect(result['p001']).toBe('2026-08-19')
    expect(result['p002']).toBe('2026-08-19')
    expect(result['p003']).toBe('2026-08-20')
    expect(result['p004']).toBe('2026-08-20')
    expect(result['p005']).toBe('2026-08-21')
  })

  it('schedules perDays one poem every N days', () => {
    const pace: PaceOption = { type: 'perDays', days: 3 }
    const result = buildSchedule(poems, pace, TODAY)
    expect(result['p001']).toBe('2026-08-19')
    expect(result['p002']).toBe('2026-08-22')
    expect(result['p003']).toBe('2026-08-25')
    expect(result['p004']).toBe('2026-08-28')
    expect(result['p005']).toBe('2026-08-31')
  })

  it('returns empty object for empty poems', () => {
    const result = buildSchedule([], { type: 'perDay', count: 3 }, TODAY)
    expect(result).toEqual({})
  })

  it('preserves input order (grades low to high)', () => {
    // 传入顺序即年级低→高；验证输出按此顺序分配日期
    const result = buildSchedule(poems, { type: 'perDay', count: 3 }, TODAY)
    expect(result['p001']).toBe('2026-08-19')
    expect(result['p002']).toBe('2026-08-19')
    expect(result['p003']).toBe('2026-08-19')
    // 第 4、5 首排到明天
    expect(result['p004']).toBe('2026-08-20')
    expect(result['p005']).toBe('2026-08-20')
  })
})

describe('PACE_OPTIONS', () => {
  it('has 8 options covering perDay 1-5 and perDays 2/3/5', () => {
    expect(PACE_OPTIONS).toHaveLength(8)
    expect(PACE_OPTIONS.map(o => o.value)).toEqual(['1', '2', '3', '4', '5', 'every2', 'every3', 'every5'])
  })
})

describe('parsePace', () => {
  it('parses perDay values', () => {
    expect(parsePace('1')).toEqual({ type: 'perDay', count: 1 })
    expect(parsePace('5')).toEqual({ type: 'perDay', count: 5 })
  })

  it('parses perDays values', () => {
    expect(parsePace('every2')).toEqual({ type: 'perDays', days: 2 })
    expect(parsePace('every3')).toEqual({ type: 'perDays', days: 3 })
    expect(parsePace('every5')).toEqual({ type: 'perDays', days: 5 })
  })

  it('falls back to default pace for invalid values', () => {
    expect(parsePace('99')).toEqual({ type: 'perDay', count: 3 })
    expect(parsePace('abc')).toEqual({ type: 'perDay', count: 3 })
  })
})

describe('spreadReviews', () => {
  // 已标记已学诗：poemId → 当前 nextReviewDate（'2099-01-01' 表示待排）
  const markedLearned: Record<string, string> = {
    m01: '2099-01-01',
    m02: '2099-01-01',
    m03: '2099-01-01',
    m04: '2099-01-01',
    m05: '2099-01-01',
  }
  // 艾宾浩斯到期诗：poemId → nextReviewDate（今天或已过）
  const ebbinghausDue: Record<string, string> = {
    e01: '2026-08-19',
    e02: '2026-08-19',
    e03: '2026-08-18',
  }

  it('spreads marked-learned poems into future days with daily quota', () => {
    // 每天复习名额 2，但今天有 3 首艾宾浩斯到期 → 今天剩余 0，从明天开始排
    const result = spreadReviews(markedLearned, ebbinghausDue, 2, '2026-08-19')
    expect(result['m01']).toBe('2026-08-20')
    expect(result['m02']).toBe('2026-08-20')
    expect(result['m03']).toBe('2026-08-21')
    expect(result['m04']).toBe('2026-08-21')
    expect(result['m05']).toBe('2026-08-22')
  })

  it('uses today remaining quota when ebbinghaus due is below quota', () => {
    const due = { e01: '2026-08-19' }
    const result = spreadReviews(markedLearned, due, 2, '2026-08-19')
    // 今天 1 首到期，剩 1 名额 → m01 今天
    expect(result['m01']).toBe('2026-08-19')
    expect(result['m02']).toBe('2026-08-20')
    expect(result['m03']).toBe('2026-08-20')
  })

  it('returns empty when no marked-learned poems', () => {
    const result = spreadReviews({}, ebbinghausDue, 2, '2026-08-19')
    expect(result).toEqual({})
  })

  it('does not touch poems already assigned a real date', () => {
    // m01 已有实际日期，跳过
    const marked = { ...markedLearned, m01: '2026-08-25' }
    const result = spreadReviews(marked, {}, 2, '2026-08-19')
    expect(result['m01']).toBe('2026-08-25')
    expect(result['m02']).toBe('2026-08-19')
  })

  it('returns empty when reviewPerDay is zero or negative (no infinite loop)', () => {
    expect(spreadReviews(markedLearned, {}, 0, '2026-08-19')).toEqual({})
    expect(spreadReviews(markedLearned, {}, -1, '2026-08-19')).toEqual({})
  })
})
