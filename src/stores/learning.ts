import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LearningRecord, QuizResult, WrongEntry, UserData, MasteryLevel } from '@/types'
import { loadData, saveData } from '@/utils/storage'
import { calculateNextReview } from '@/utils/ebbinghaus'
import { checkAutoUnmark } from '@/utils/unproficient'

export const useLearningStore = defineStore('learning', () => {
  const data = ref<UserData>(loadData())

  const records = computed(() => data.value.records)
  const wrongBook = computed(() => data.value.wrongBook)
  const settings = computed(() => data.value.settings)

  function persist() { saveData(data.value) }

  function getRecord(poemId: string): LearningRecord | undefined {
    return data.value.records.find(r => r.poemId === poemId)
  }

  function getOrCreateRecord(poemId: string): LearningRecord {
    let record = getRecord(poemId)
    if (!record) {
      const today = new Date().toISOString().split('T')[0]
      record = {
        poemId, lastReviewDate: today, reviewCount: 0,
        nextReviewDate: today, correctness: [], reciteCorrectness: [], masteryLevel: '新',
        unproficient: false, unproficientCorrectStreak: 0,
        firstLearnDate: today,
      }
      data.value.records.push(record)
    }
    return record
  }

  function recordAnswer(poemId: string, quizType: string, correct: boolean, wrongAnswer?: string) {
    const record = getOrCreateRecord(poemId)
    const today = new Date().toISOString().split('T')[0]
    // 更新 lastReviewDate 为当天，确保 nextReviewDate 基于当前日期计算
    const updated = calculateNextReview({ ...record, lastReviewDate: today }, correct)
    const afterUnproficient = checkAutoUnmark(updated, correct)
    const idx = data.value.records.findIndex(r => r.poemId === poemId)
    data.value.records[idx] = { ...afterUnproficient, lastLearnDate: today }

    const result: QuizResult = {
      poemId, quizType: quizType as QuizResult['quizType'],
      date: new Date().toISOString().split('T')[0], correct, wrongAnswer,
    }
    data.value.quizResults.push(result)

    if (!correct) {
      const existing = data.value.wrongBook.find(w => w.poemId === poemId && w.quizType === quizType)
      if (existing) { existing.wrongCount++; existing.lastWrongDate = result.date }
      else { data.value.wrongBook.push({ poemId, quizType: quizType as WrongEntry['quizType'], wrongCount: 1, lastWrongDate: result.date, unproficient: false }) }
    } else {
      data.value.wrongBook = data.value.wrongBook.filter(w => !(w.poemId === poemId && w.quizType === quizType))
    }
    persist()
  }

  function recordRecite(poemId: string, correct: boolean) {
    const record = getOrCreateRecord(poemId)
    const today = new Date().toISOString().split('T')[0]

    // 更新 lastReviewDate 为当天
    const updated = { ...record, lastReviewDate: today, lastLearnDate: today }

    // 调用遗忘曲线调度
    const scheduled = calculateNextReview(updated, correct)
    const afterUnproficient = checkAutoUnmark(scheduled, correct)

    // 更新背诵正确性历史
    const finalRecord = {
      ...afterUnproficient,
      reciteCorrectness: [...afterUnproficient.reciteCorrectness, correct ? 1 : 0],
    }

    const idx = data.value.records.findIndex(r => r.poemId === poemId)
    data.value.records[idx] = finalRecord

    // 记录背诵记录
    data.value.reciteRecords.push({ poemId, date: today, correct })

    persist()
  }

  function toggleUnproficient(poemId: string, value?: boolean) {
    const record = getOrCreateRecord(poemId)
    const newValue = value ?? !record.unproficient
    record.unproficient = newValue
    record.unproficientCorrectStreak = 0

    // Sync wrong book entries for this poem
    for (const entry of data.value.wrongBook) {
      if (entry.poemId === poemId) {
        entry.unproficient = newValue
      }
    }

    persist()
  }

  function removeWrongEntry(poemId: string, quizType: string) {
    data.value.wrongBook = data.value.wrongBook.filter(w => !(w.poemId === poemId && w.quizType === quizType))
    persist()
  }

  function updateSettings(settings: Partial<UserData['settings']>) {
    data.value.settings = { ...data.value.settings, ...settings }
    persist()
  }

  function importUserData(json: string): boolean {
    try {
      const imported = JSON.parse(json) as UserData
      if (!imported.settings || !Array.isArray(imported.records)) return false
      data.value = imported
      persist()
      return true
    } catch { return false }
  }

  function exportUserData(): string {
    return JSON.stringify(data.value, null, 2)
  }

  function getMasteryLevel(poemId: string): MasteryLevel {
    const record = getRecord(poemId)
    return record?.masteryLevel ?? '新'
  }

  function clearAllData() {
    data.value = { records: [], quizResults: [], reciteRecords: [], wrongBook: [], settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] } }
    persist()
  }

  const reviewDueCount = computed(() => {
    const today = new Date().toISOString().split('T')[0]
    return data.value.records.filter(r => r.nextReviewDate <= today).length
  })
  const unproficientCount = computed(() => data.value.records.filter(r => r.unproficient).length)
  const wrongCount = computed(() => data.value.wrongBook.length)

  return {
    data, records, wrongBook, settings, reviewDueCount, unproficientCount, wrongCount,
    getRecord, getOrCreateRecord, getMasteryLevel, recordAnswer, recordRecite, toggleUnproficient, removeWrongEntry,
    updateSettings, importUserData, exportUserData, clearAllData, persist,
  }
})
