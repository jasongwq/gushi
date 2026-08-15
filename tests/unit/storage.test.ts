import { describe, it, expect, beforeEach } from 'vitest'
import { loadData, saveData, exportData, importData, clearData } from '@/utils/storage'
import type { UserData } from '@/types'

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns default data when localStorage is empty', () => {
    const data = loadData()
    expect(data).toEqual({
      records: [],
      quizResults: [],
      reciteRecords: [],
      wrongBook: [],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] },
    })
  })

  it('saves and loads data', () => {
    const data: UserData = {
      records: [],
      quizResults: [],
      reciteRecords: [],
      wrongBook: [],
      settings: { enabledPoems: ['一年级'], quizCount: 10, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] },
    }
    saveData(data)
    const loaded = loadData()
    expect(loaded).toEqual(data)
  })

  it('exports data as JSON string', () => {
    const data: UserData = {
      records: [],
      quizResults: [],
      reciteRecords: [],
      wrongBook: [],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] },
    }
    saveData(data)
    const exported = exportData()
    expect(exported).toBe(JSON.stringify(data, null, 2))
  })

  it('imports valid JSON data', () => {
    const data: UserData = {
      records: [],
      quizResults: [],
      reciteRecords: [],
      wrongBook: [],
      settings: { enabledPoems: ['二年级'], quizCount: 8, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] },
    }
    const json = JSON.stringify(data)
    expect(importData(json)).toBe(true)
    expect(loadData()).toEqual(data)
  })

  it('rejects invalid JSON', () => {
    expect(importData('not json')).toBe(false)
    expect(importData('{bad')).toBe(false)
  })

  it('clears data', () => {
    saveData({
      records: [],
      quizResults: [],
      reciteRecords: [],
      wrongBook: [],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] },
    })
    clearData()
    expect(loadData()).toEqual({
      records: [],
      quizResults: [],
      reciteRecords: [],
      wrongBook: [],
      settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] },
    })
  })
})
