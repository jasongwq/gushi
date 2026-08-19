import { describe, it, expect } from 'vitest'
import { buildSchedule, parsePace, PACE_OPTIONS, type PaceOption } from '@/utils/schedule'
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
