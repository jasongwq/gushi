import { describe, it, expect, beforeEach } from 'vitest'
import { useLearningStore } from '@/stores/learning'
import { createPinia, setActivePinia } from 'pinia'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('char marks in learning store', () => {
  it('initCharMarks resets current char marks', () => {
    const store = useLearningStore()
    store.toggleCharMark(0, 2)
    expect(Object.keys(store.charMarks)).toHaveLength(1)
    store.initCharMarks()
    expect(Object.keys(store.charMarks)).toHaveLength(0)
  })

  it('toggleCharMark cycles ok→fuzzy→wrong→ok', () => {
    const store = useLearningStore()
    // ok → fuzzy
    store.toggleCharMark(0, 0)
    expect(store.charMarks['0-0']).toBe('fuzzy')
    // fuzzy → wrong
    store.toggleCharMark(0, 0)
    expect(store.charMarks['0-0']).toBe('wrong')
    // wrong → ok (删除条目)
    store.toggleCharMark(0, 0)
    expect(store.charMarks['0-0']).toBeUndefined()
  })

  it('toggleCharMark key format is lineIndex-charIndex', () => {
    const store = useLearningStore()
    store.toggleCharMark(2, 5)
    expect(store.charMarks['2-5']).toBe('fuzzy')
  })

  it('recordReciteWithCharMarks saves charMarks snapshot and updates stats', () => {
    const store = useLearningStore()
    store.recordReciteWithCharMarks('p001', false, ['床前明月光', '疑是地上霜'], { '0-0': 'wrong', '1-3': 'fuzzy' })

    const reciteRecord = store.data.reciteRecords[0]
    expect(reciteRecord.charMarks).toEqual({ '0-0': 'wrong', '1-3': 'fuzzy' })

    const record = store.getRecord('p001')
    expect(record!.charMarkStats).toEqual([
      { poemId: 'p001', lineIndex: 0, charIndex: 0, char: '床', fuzzyCount: 0, wrongCount: 1 },
      { poemId: 'p001', lineIndex: 1, charIndex: 3, char: '上', fuzzyCount: 1, wrongCount: 0 },
    ])
  })

  it('recordReciteWithCharMarks updates existing stats incrementally', () => {
    const store = useLearningStore()
    store.recordReciteWithCharMarks('p001', false, ['床前明月光'], { '0-0': 'fuzzy' }) // 1st: fuzzy
    store.recordReciteWithCharMarks('p001', false, ['床前明月光'], { '0-0': 'wrong' }) // 2nd: wrong

    const record = store.getRecord('p001')
    expect(record!.charMarkStats).toEqual([
      { poemId: 'p001', lineIndex: 0, charIndex: 0, char: '床', fuzzyCount: 1, wrongCount: 1 },
    ])
  })

  it('recordReciteWithCharMarks without marks keeps empty stats', () => {
    const store = useLearningStore()
    store.recordReciteWithCharMarks('p001', true, ['床前明月光'], {})
    const record = store.getRecord('p001')
    expect(record!.charMarkStats).toEqual([])
    expect(store.data.reciteRecords[0].charMarks).toEqual({})
  })

  it('recordReciteWithCharMarks does not double-schedule after recordAnswer', () => {
    const store = useLearningStore()
    // 背诵流程中 submitRecitationResult 已调用 recordAnswer 完成遗忘曲线调度
    store.recordAnswer('p001', 'recite', true)
    const reviewCountAfterAnswer = store.getRecord('p001')!.reviewCount
    const nextReviewDateAfterAnswer = store.getRecord('p001')!.nextReviewDate

    // 再附带字级标记提交，不应重复调度（reviewCount / nextReviewDate 不变）
    store.recordReciteWithCharMarks('p001', true, ['床前明月光'], { '0-0': 'fuzzy' })
    const record = store.getRecord('p001')
    expect(record!.reviewCount).toBe(reviewCountAfterAnswer)
    expect(record!.nextReviewDate).toBe(nextReviewDateAfterAnswer)
    // 背诵历史与字级统计仍应记录
    expect(record!.reciteCorrectness).toEqual([1])
    expect(store.data.reciteRecords).toHaveLength(1)
    expect(record!.charMarkStats).toHaveLength(1)
  })

  it('getCharMarkStats skips stale stats when poem text changed', () => {
    const store = useLearningStore()
    store.recordReciteWithCharMarks('p001', false, ['床前明月光'], { '0-0': 'fuzzy' })
    // 原 stats: lineIndex=0, charIndex=0, char='床'
    // 诗文本变化后（'床' 不再是第一个汉字），校验应过滤该条
    const filtered = store.getCharMarkStats('p001', ['疑是地上霜'])
    expect(filtered).toEqual([])
    // 不传 poemText 时不做校验，返回原始统计
    const raw = store.getCharMarkStats('p001')
    expect(raw).toHaveLength(1)
  })
})
