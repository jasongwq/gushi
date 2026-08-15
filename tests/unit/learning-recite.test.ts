import { describe, it, expect, beforeEach } from 'vitest'
import { useLearningStore } from '@/stores/learning'
import { createPinia, setActivePinia } from 'pinia'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('recordRecite', () => {
  it('creates a new record with reciteCorrectness on correct answer', () => {
    const store = useLearningStore()
    store.recordRecite('p001', true)
    const record = store.getRecord('p001')
    expect(record).toBeDefined()
    expect(record!.reciteCorrectness).toEqual([1])
    expect(record!.reviewCount).toBeGreaterThan(0)
  })

  it('appends to reciteCorrectness on subsequent answers', () => {
    const store = useLearningStore()
    store.recordRecite('p001', true)
    store.recordRecite('p001', false)
    const record = store.getRecord('p001')
    expect(record!.reciteCorrectness).toEqual([1, 0])
  })

  it('adds reciteRecord to reciteRecords array', () => {
    const store = useLearningStore()
    store.recordRecite('p001', true)
    expect(store.data.reciteRecords).toHaveLength(1)
    expect(store.data.reciteRecords[0].poemId).toBe('p001')
    expect(store.data.reciteRecords[0].correct).toBe(true)
  })

  it('updates nextReviewDate via ebbinghaus on correct answer', () => {
    const store = useLearningStore()
    store.recordRecite('p001', true)
    const record = store.getRecord('p001')
    expect(record!.nextReviewDate).not.toBe(record!.lastReviewDate)
  })
})
