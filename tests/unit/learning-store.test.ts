import { describe, it, expect, beforeEach } from 'vitest'
import { useLearningStore } from '@/stores/learning'
import { createPinia, setActivePinia } from 'pinia'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('recordAnswer', () => {
  it('creates a new record on correct answer', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', true)
    const record = store.getRecord('p001')
    expect(record).toBeDefined()
    expect(record!.reviewCount).toBe(1)
    expect(record!.masteryLevel).toBe('学')
    expect(record!.correctness).toEqual([1])
  })

  it('creates a new record on wrong answer', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', false, 'wrong char')
    const record = store.getRecord('p001')
    expect(record).toBeDefined()
    expect(record!.correctness).toEqual([0])
  })

  it('updates lastReviewDate to today', () => {
    const store = useLearningStore()
    const today = new Date().toISOString().split('T')[0]
    store.recordAnswer('p001', 'fillBlank', true)
    const record = store.getRecord('p001')
    expect(record!.lastReviewDate).toBe(today)
  })

  it('adds quiz result to quizResults', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', true)
    expect(store.data.quizResults).toHaveLength(1)
    expect(store.data.quizResults[0].poemId).toBe('p001')
    expect(store.data.quizResults[0].quizType).toBe('fillBlank')
    expect(store.data.quizResults[0].correct).toBe(true)
  })

  it('adds wrong answer to wrongBook', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', false, 'wrong')
    expect(store.data.wrongBook).toHaveLength(1)
    expect(store.data.wrongBook[0].poemId).toBe('p001')
    expect(store.data.wrongBook[0].wrongCount).toBe(1)
  })

  it('removes from wrongBook when correct', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', false)
    expect(store.data.wrongBook).toHaveLength(1)
    store.recordAnswer('p001', 'fillBlank', true)
    expect(store.data.wrongBook).toHaveLength(0)
  })

  it('increments wrongCount on repeated wrong answers', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', false)
    store.recordAnswer('p001', 'fillBlank', false)
    expect(store.data.wrongBook).toHaveLength(1)
    expect(store.data.wrongBook[0].wrongCount).toBe(2)
  })

  it('advances reviewCount on correct answer', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', true)
    store.recordAnswer('p001', 'nextLine', true)
    const record = store.getRecord('p001')
    expect(record!.reviewCount).toBe(2)
  })

  it('clears all wrongBook entries for poem when recite correct', () => {
    const store = useLearningStore()
    // Simulate: poem had line/author/dynasty wrong entries
    store.data.wrongBook.push(
      { poemId: 'p001', quizType: 'line' as const, wrongCount: 1, lastWrongDate: '2026-01-01', unproficient: false },
      { poemId: 'p001', quizType: 'author' as const, wrongCount: 1, lastWrongDate: '2026-01-01', unproficient: false },
      { poemId: 'p001', quizType: 'dynasty' as const, wrongCount: 1, lastWrongDate: '2026-01-01', unproficient: false },
    )
    expect(store.data.wrongBook).toHaveLength(3)
    // Correct recite answer clears all entries for this poem
    store.recordAnswer('p001', 'recite', true)
    expect(store.data.wrongBook).toHaveLength(0)
  })

  it('nextReviewDate is based on today, not stale lastReviewDate', () => {
    const store = useLearningStore()
    // Create a record with a stale lastReviewDate
    store.data.records.push({
      poemId: 'p001',
      lastReviewDate: '2020-01-01',
      reviewCount: 1,
      nextReviewDate: '2020-01-03',
      correctness: [1],
      reciteCorrectness: [],
      charMarkStats: [],
      masteryLevel: '学',
      unproficient: false,
      unproficientCorrectStreak: 0,
    })
    store.recordAnswer('p001', 'fillBlank', true)
    const record = store.getRecord('p001')
    const today = new Date().toISOString().split('T')[0]
    // nextReviewDate should be today + interval, not 2020-01-01 + interval
    expect(record!.lastReviewDate).toBe(today)
    expect(record!.nextReviewDate > '2020-01-01').toBe(true)
  })
})

describe('getOrCreateRecord', () => {
  it('sets firstLearnDate to today on creation', () => {
    const store = useLearningStore()
    const today = new Date().toISOString().split('T')[0]
    store.recordAnswer('p001', 'fillBlank', true)
    const record = store.getRecord('p001')
    expect(record!.firstLearnDate).toBe(today)
  })

  it('preserves firstLearnDate on subsequent answers', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', true)
    const firstDate = store.getRecord('p001')!.firstLearnDate
    store.recordAnswer('p001', 'nextLine', true)
    expect(store.getRecord('p001')!.firstLearnDate).toBe(firstDate)
  })
})

describe('recordRecite', () => {
  it('creates a new record on correct recite', () => {
    const store = useLearningStore()
    store.recordRecite('p001', true)
    const record = store.getRecord('p001')
    expect(record).toBeDefined()
    expect(record!.reciteCorrectness).toEqual([1])
    expect(record!.reviewCount).toBeGreaterThan(0)
  })

  it('updates lastReviewDate to today', () => {
    const store = useLearningStore()
    const today = new Date().toISOString().split('T')[0]
    store.recordRecite('p001', true)
    const record = store.getRecord('p001')
    expect(record!.lastReviewDate).toBe(today)
  })

  it('adds reciteRecord', () => {
    const store = useLearningStore()
    store.recordRecite('p001', false)
    expect(store.data.reciteRecords).toHaveLength(1)
    expect(store.data.reciteRecords[0].correct).toBe(false)
  })
})

describe('toggleUnproficient', () => {
  it('toggles unproficient flag on', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', false)
    store.toggleUnproficient('p001')
    const record = store.getRecord('p001')
    expect(record!.unproficient).toBe(true)
  })

  it('toggles unproficient flag off', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', false)
    store.toggleUnproficient('p001')
    store.toggleUnproficient('p001')
    const record = store.getRecord('p001')
    expect(record!.unproficient).toBe(false)
  })

  it('syncs wrongBook unproficient flag', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', false)
    store.toggleUnproficient('p001')
    expect(store.data.wrongBook[0].unproficient).toBe(true)
  })
})

describe('removeWrongEntry', () => {
  it('removes wrong book entry', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', false)
    expect(store.data.wrongBook).toHaveLength(1)
    store.removeWrongEntry('p001', 'fillBlank')
    expect(store.data.wrongBook).toHaveLength(0)
  })

  it('removes only the matching note when note is provided', () => {
    const store = useLearningStore()
    store.data.wrongBook.push(
      { poemId: 'p001', quizType: 'line' as const, wrongCount: 1, lastWrongDate: '2026-08-18', unproficient: false, note: '第1句:stuck' },
      { poemId: 'p001', quizType: 'line' as const, wrongCount: 1, lastWrongDate: '2026-08-18', unproficient: false, note: '第2句:forgot' },
    )
    store.removeWrongEntry('p001', 'line', '第1句:stuck')
    expect(store.data.wrongBook).toHaveLength(1)
    expect(store.data.wrongBook[0].note).toBe('第2句:forgot')
  })

  it('removes only note-less entries of poem+quizType when note is not provided', () => {
    const store = useLearningStore()
    store.data.wrongBook.push(
      { poemId: 'p001', quizType: 'line' as const, wrongCount: 1, lastWrongDate: '2026-08-18', unproficient: false, note: '第1句:stuck' },
      { poemId: 'p001', quizType: 'line' as const, wrongCount: 1, lastWrongDate: '2026-08-18', unproficient: false, note: '第2句:forgot' },
      { poemId: 'p001', quizType: 'line' as const, wrongCount: 1, lastWrongDate: '2026-08-18', unproficient: false },
      { poemId: 'p001', quizType: 'author' as const, wrongCount: 1, lastWrongDate: '2026-08-18', unproficient: false },
    )
    store.removeWrongEntry('p001', 'line')
    // note 省略只删除无 note 的同 poem+quizType 条目，不误删带 note 的兄弟条目
    expect(store.data.wrongBook).toHaveLength(3)
    expect(store.data.wrongBook.filter(w => w.quizType === 'line' && w.note).map(w => w.note)).toEqual(['第1句:stuck', '第2句:forgot'])
  })

  it('does not remove entries with different poem or quizType', () => {
    const store = useLearningStore()
    store.data.wrongBook.push(
      { poemId: 'p001', quizType: 'line' as const, wrongCount: 1, lastWrongDate: '2026-08-18', unproficient: false, note: '第1句:stuck' },
      { poemId: 'p002', quizType: 'line' as const, wrongCount: 1, lastWrongDate: '2026-08-18', unproficient: false, note: '第1句:stuck' },
    )
    store.removeWrongEntry('p001', 'line', '第1句:stuck')
    expect(store.data.wrongBook).toHaveLength(1)
    expect(store.data.wrongBook[0].poemId).toBe('p002')
  })
})

describe('updateSettings', () => {
  it('updates settings partially', () => {
    const store = useLearningStore()
    store.updateSettings({ quizCount: 10 })
    expect(store.settings.quizCount).toBe(10)
  })
})

describe('recordDetail', () => {
  it('adds line detail to wrongBook', () => {
    const store = useLearningStore()
    store.recordDetail('p001', 'line', '第1句:stuck')
    expect(store.data.wrongBook).toHaveLength(1)
    expect(store.data.wrongBook[0].quizType).toBe('line')
    expect(store.data.wrongBook[0].wrongCount).toBe(1)
  })

  it('adds author detail to wrongBook', () => {
    const store = useLearningStore()
    store.recordDetail('p001', 'author')
    expect(store.data.wrongBook).toHaveLength(1)
    expect(store.data.wrongBook[0].quizType).toBe('author')
  })

  it('increments wrongCount on repeated detail', () => {
    const store = useLearningStore()
    store.recordDetail('p001', 'line')
    store.recordDetail('p001', 'line')
    expect(store.data.wrongBook).toHaveLength(1)
    expect(store.data.wrongBook[0].wrongCount).toBe(2)
  })

  it('does not affect reviewCount or correctness', () => {
    const store = useLearningStore()
    store.recordDetail('p001', 'line')
    // No learning record should be created
    const record = store.getRecord('p001')
    expect(record).toBeUndefined()
  })

  it('does not generate quizResult', () => {
    const store = useLearningStore()
    store.recordDetail('p001', 'line')
    expect(store.data.quizResults).toHaveLength(0)
  })

  it('stores wrongInfo as note', () => {
    const store = useLearningStore()
    store.recordDetail('p001', 'line', '第1句:stuck')
    expect(store.data.wrongBook[0].note).toBe('第1句:stuck')
  })

  it('keys entries by note so different stuck lines count separately', () => {
    const store = useLearningStore()
    store.recordDetail('p001', 'line', '第1句:stuck')
    store.recordDetail('p001', 'line', '第2句:forgot')
    expect(store.data.wrongBook).toHaveLength(2)
    expect(store.data.wrongBook[0].wrongCount).toBe(1)
    expect(store.data.wrongBook[1].wrongCount).toBe(1)
    // 相同备注则累加
    store.recordDetail('p001', 'line', '第1句:stuck')
    expect(store.data.wrongBook).toHaveLength(2)
    expect(store.data.wrongBook[0].wrongCount).toBe(2)
  })
})

describe('importUserData', () => {
  it('imports valid data', () => {
    const store = useLearningStore()
    const data = {
      records: [],
      quizResults: [],
      reciteRecords: [],
      wrongBook: [],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart' as const, quizTypes: ['fillBlank' as const], selectedGrades: [] },
    }
    expect(store.importUserData(JSON.stringify(data))).toBe(true)
    expect(store.settings.quizCount).toBe(5)
  })

  it('rejects invalid JSON', () => {
    const store = useLearningStore()
    expect(store.importUserData('not json')).toBe(false)
  })

  it('rejects data without records array', () => {
    const store = useLearningStore()
    expect(store.importUserData('{"settings":{}}')).toBe(false)
  })

  it('rejects data without settings', () => {
    const store = useLearningStore()
    expect(store.importUserData('{"records":[]}')).toBe(false)
  })
})

describe('exportUserData', () => {
  it('returns valid JSON string', () => {
    const store = useLearningStore()
    const exported = store.exportUserData()
    const parsed = JSON.parse(exported)
    expect(parsed.records).toBeDefined()
    expect(parsed.settings).toBeDefined()
  })
})

describe('clearAllData', () => {
  it('resets all data to defaults', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', true)
    store.clearAllData()
    expect(store.data.records).toHaveLength(0)
    expect(store.data.quizResults).toHaveLength(0)
    expect(store.data.wrongBook).toHaveLength(0)
  })
})

describe('getMasteryLevel', () => {
  it('returns 新 for unknown poem', () => {
    const store = useLearningStore()
    expect(store.getMasteryLevel('unknown')).toBe('新')
  })

  it('returns correct level after reviews', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', true)
    expect(store.getMasteryLevel('p001')).toBe('学')
  })
})

describe('computed properties', () => {
  it('reviewDueCount counts due records', () => {
    const store = useLearningStore()
    const today = new Date().toISOString().split('T')[0]
    // Manually create a record that is due for review
    store.data.records.push({
      poemId: 'p001', lastReviewDate: '2020-01-01', reviewCount: 1,
      nextReviewDate: today, correctness: [1], reciteCorrectness: [],
      charMarkStats: [],
      masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0,
    })
    expect(store.reviewDueCount).toBeGreaterThanOrEqual(1)
  })

  it('unproficientCount counts unproficient records', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', false)
    store.toggleUnproficient('p001')
    expect(store.unproficientCount).toBe(1)
  })

  it('wrongCount counts wrong book entries', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'fillBlank', false)
    expect(store.wrongCount).toBe(1)
  })
})

describe('pendingReciteSchedules', () => {
  it('syncPendingReciteSchedule adds poemId when hasIssue', () => {
    const store = useLearningStore()
    store.syncPendingReciteSchedule('p001', true)
    expect(store.pendingReciteSchedules).toContain('p001')
  })

  it('syncPendingReciteSchedule removes poemId when no issue', () => {
    const store = useLearningStore()
    store.syncPendingReciteSchedule('p001', true)
    store.syncPendingReciteSchedule('p001', false)
    expect(store.pendingReciteSchedules).not.toContain('p001')
  })

  it('is idempotent when adding same poemId twice', () => {
    const store = useLearningStore()
    store.syncPendingReciteSchedule('p001', true)
    store.syncPendingReciteSchedule('p001', true)
    expect(store.pendingReciteSchedules).toEqual(['p001'])
  })

  it('persists to localStorage and restores on new store', () => {
    const store = useLearningStore()
    store.syncPendingReciteSchedule('p001', true)
    const raw = localStorage.getItem('poem-quiz-pending-recite')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)).toEqual(['p001'])

    // 新 store 实例从 localStorage 恢复
    setActivePinia(createPinia())
    const store2 = useLearningStore()
    expect(store2.pendingReciteSchedules).toEqual(['p001'])
  })

  it('unmarkPendingReciteSchedule removes poemId', () => {
    const store = useLearningStore()
    store.syncPendingReciteSchedule('p001', true)
    store.syncPendingReciteSchedule('p002', true)
    store.unmarkPendingReciteSchedule('p001')
    expect(store.pendingReciteSchedules).toEqual(['p002'])
  })

  it('flushPendingReciteSchedules returns and clears list', () => {
    const store = useLearningStore()
    store.syncPendingReciteSchedule('p001', true)
    const flushed = store.flushPendingReciteSchedules()
    expect(flushed).toEqual(['p001'])
    expect(store.pendingReciteSchedules).toEqual([])
  })
})

describe('pendingCharMarks', () => {
  it('syncPendingCharMarks writes snapshot to localStorage and reads back', () => {
    const store = useLearningStore()
    store.syncPendingCharMarks('p001', { '0-2': 'wrong' })
    const raw = localStorage.getItem('poem-quiz-pending-char-marks')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)).toEqual({ p001: { '0-2': 'wrong' } })
    // 新 store 实例恢复
    setActivePinia(createPinia())
    const store2 = useLearningStore()
    expect(store2.pendingCharMarks).toEqual({ p001: { '0-2': 'wrong' } })
  })

  it('empty snapshot removes the poemId key', () => {
    const store = useLearningStore()
    store.syncPendingCharMarks('p001', { '0-2': 'wrong' })
    store.syncPendingCharMarks('p001', {})
    expect(store.pendingCharMarks).toEqual({})
    const raw = localStorage.getItem('poem-quiz-pending-char-marks')
    expect(JSON.parse(raw!)).toEqual({})
  })

  it('flushPendingCharMarks returns and clears list', () => {
    const store = useLearningStore()
    store.syncPendingCharMarks('p001', { '0-2': 'wrong' })
    const flushed = store.flushPendingCharMarks()
    expect(flushed).toEqual({ p001: { '0-2': 'wrong' } })
    expect(store.pendingCharMarks).toEqual({})
  })

  it('aggregateCharMarks increments charMarkStats counts', () => {
    const store = useLearningStore()
    // 先造记录
    store.recordAnswer('p001', 'recite', false)
    const poemText = ['床前明月光']
    store.aggregateCharMarks('p001', poemText, { '0-2': 'wrong', '0-3': 'fuzzy' })
    const stats = store.getRecord('p001')!.charMarkStats
    expect(stats).toHaveLength(2)
    const wrongStat = stats.find(s => s.charIndex === 2)!
    expect(wrongStat.char).toBe('明')
    expect(wrongStat.wrongCount).toBe(1)
    const fuzzyStat = stats.find(s => s.charIndex === 3)!
    expect(fuzzyStat.fuzzyCount).toBe(1)
    // 再聚合同字 → 计数累加
    store.aggregateCharMarks('p001', poemText, { '0-2': 'wrong' })
    expect(store.getRecord('p001')!.charMarkStats.find(s => s.charIndex === 2)!.wrongCount).toBe(2)
  })

  it('recordReciteWithCharMarks clears pendingCharMarks for poem', () => {
    const store = useLearningStore()
    store.syncPendingCharMarks('p001', { '0-2': 'wrong' })
    store.recordReciteWithCharMarks('p001', false, ['床前明月光'], { '0-2': 'wrong' })
    expect(store.pendingCharMarks).toEqual({})
  })

  it('aggregateCharMarks does not append reciteCorrectness or push reciteRecords', () => {
    const store = useLearningStore()
    store.recordAnswer('p001', 'recite', false)
    const reciteRecordsBefore = store.data.reciteRecords.length
    store.aggregateCharMarks('p001', ['床前明月光'], { '0-2': 'wrong' })
    expect(store.data.reciteRecords).toHaveLength(reciteRecordsBefore)
    const record = store.getRecord('p001')!
    // recordAnswer(false) 不追加 reciteCorrectness；aggregate 也不应追加
    expect(record.reciteCorrectness).toEqual([])
  })
})
