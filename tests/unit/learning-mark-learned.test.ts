import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLearningStore } from '@/stores/learning'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('markLearned', () => {
  it('creates minimal records with placeholder nextReviewDate', () => {
    const store = useLearningStore()
    store.markLearned(['p001', 'p002'])
    const r1 = store.getRecord('p001')
    const r2 = store.getRecord('p002')
    expect(r1).toBeDefined()
    expect(r1!.reviewCount).toBe(0)
    expect(r1!.masteryLevel).toBe('新')
    expect(r1!.nextReviewDate).toBe('2099-01-01')
    expect(r2).toBeDefined()
    expect(r2!.nextReviewDate).toBe('2099-01-01')
  })

  it('placeholder date does not make poems due today', () => {
    const store = useLearningStore()
    store.markLearned(['p001'])
    expect(store.reviewDueCount).toBe(0)
  })

  it('rebuildSchedule spreads marked-learned poems with review quota', () => {
    const store = useLearningStore()
    store.markLearned(['p001', 'p002', 'p003'])
    // 每天复习名额 1，今天无艾宾浩斯到期 → p001 今天，p002 明天，p003 后天
    store.rebuildSchedule([], { type: 'perDay', count: 3 }, '2026-08-19', 1)
    expect(store.getRecord('p001')!.nextReviewDate).toBe('2026-08-19')
    expect(store.getRecord('p002')!.nextReviewDate).toBe('2026-08-20')
    expect(store.getRecord('p003')!.nextReviewDate).toBe('2026-08-21')
  })

  it('keeps existing records unchanged', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', true)
    const before = store.getRecord('p001')!.reviewCount
    store.markLearned(['p001'])
    expect(store.getRecord('p001')!.reviewCount).toBe(before)
  })

  it('removes marked poems from schedule', () => {
    const store = useLearningStore()
    store.setSchedule({ p001: '2026-08-19', p002: '2026-08-19' })
    store.markLearned(['p001'])
    expect(store.getSchedule()).toEqual({ p002: '2026-08-19' })
  })

  it('persists records to localStorage', () => {
    const store = useLearningStore()
    store.markLearned(['p001'])
    // 重新加载应保留
    const raw = localStorage.getItem('poem-quiz-data')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.records.some((r: any) => r.poemId === 'p001')).toBe(true)
  })
})
