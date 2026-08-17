import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LearningRecord, QuizResult, WrongEntry, UserData, MasteryLevel, CharMarkMap, CharMarkStats } from '@/types'
import { loadData, saveData, importData as importDataUtil } from '@/utils/storage'
import { calculateNextReview } from '@/utils/ebbinghaus'
import { checkAutoUnmark } from '@/utils/unproficient'
import { parseLine } from '@/utils/charMark'

export const useLearningStore = defineStore('learning', () => {
  const data = ref<UserData>(loadData())

  const records = computed(() => data.value.records)
  const wrongBook = computed(() => data.value.wrongBook)
  const settings = computed(() => data.value.settings)

  function persist() { saveData(data.value) }

  // 当前会话的字级标记（不持久化，切换诗时重置）
  const charMarks = ref<CharMarkMap>({})

  function initCharMarks() {
    charMarks.value = {}
  }

  function toggleCharMark(lineIndex: number, charIndex: number) {
    const key = `${lineIndex}-${charIndex}`
    const current = charMarks.value[key]
    if (current === 'fuzzy') charMarks.value[key] = 'wrong'
    else if (current === 'wrong') delete charMarks.value[key]
    else charMarks.value[key] = 'fuzzy'
  }

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
        unproficient: false, unproficientCorrectStreak: 0, charMarkStats: [],
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
    } else if (quizType === 'recite') {
      // 背诵正确时清除该诗所有 wrongBook 条目（包括 line/author/dynasty）
      data.value.wrongBook = data.value.wrongBook.filter(w => w.poemId !== poemId)
    } else {
      data.value.wrongBook = data.value.wrongBook.filter(w => !(w.poemId === poemId && w.quizType === quizType))
    }
    persist()
  }

  function recordDetail(poemId: string, detailType: 'line' | 'author' | 'dynasty', wrongInfo?: string) {
    const today = new Date().toISOString().split('T')[0]
    // 同类型同备注视为同一条目（不同卡顿句各自计数）
    const existing = data.value.wrongBook.find(w => w.poemId === poemId && w.quizType === detailType && w.note === wrongInfo)
    if (existing) {
      existing.wrongCount++
      existing.lastWrongDate = today
    } else {
      data.value.wrongBook.push({
        poemId,
        quizType: detailType,
        wrongCount: 1,
        lastWrongDate: today,
        unproficient: false,
        ...(wrongInfo ? { note: wrongInfo } : {}),
      })
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
    data.value.reciteRecords.push({ poemId, date: today, correct, charMarks: {} })

    persist()
  }

  // 提交背诵时附带字级标记：保存快照并聚合统计
  function recordReciteWithCharMarks(poemId: string, correct: boolean, poemText: string[], charMarksSnapshot: CharMarkMap) {
    recordRecite(poemId, correct)

    // 保存快照到 reciteRecords（覆盖刚 push 的默认空对象）
    const reciteRecords = data.value.reciteRecords
    const lastIdx = reciteRecords.length - 1
    if (lastIdx >= 0) {
      reciteRecords[lastIdx] = { ...reciteRecords[lastIdx], charMarks: charMarksSnapshot }
    }

    // 聚合统计
    if (Object.keys(charMarksSnapshot).length > 0) {
      const record = getRecord(poemId)
      if (record) {
        const stats = [...record.charMarkStats]
        // 用 parseLine 将诗行拆成段，通过 charIdx 找到对应汉字（跳过标点）
        const lineSegments = poemText.map(line => parseLine(line))
        for (const [key, status] of Object.entries(charMarksSnapshot)) {
          const [lineIndex, charIndex] = key.split('-').map(Number)
          const seg = lineSegments[lineIndex]?.find(s => s.type === 'char' && s.charIdx === charIndex)
          const char = seg?.char ?? ''
          const existing = stats.find(s => s.poemId === poemId && s.lineIndex === lineIndex && s.charIndex === charIndex)
          if (existing) {
            if (status === 'fuzzy') existing.fuzzyCount++
            else existing.wrongCount++
          } else {
            stats.push({
              poemId, lineIndex, charIndex, char,
              fuzzyCount: status === 'fuzzy' ? 1 : 0,
              wrongCount: status === 'wrong' ? 1 : 0,
            })
          }
        }
        record.charMarkStats = stats
      }
    }
    persist()
  }

  function getCharMarkStats(poemId: string, poemText?: string[]): CharMarkStats[] {
    const stats = getRecord(poemId)?.charMarkStats ?? []
    // 若 poemText 提供，校验存储的 char 与当前诗行解析结果一致；不一致说明内容变化，跳过
    if (!poemText || stats.length === 0) return stats
    const lineSegments = poemText.map(line => parseLine(line))
    return stats.filter(s => {
      if (s.poemId !== poemId) return false
      const seg = lineSegments[s.lineIndex]?.find(seg => seg.type === 'char' && seg.charIdx === s.charIndex)
      return seg?.char === s.char
    })
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
    const success = importDataUtil(json)
    if (success) data.value = loadData()
    return success
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
    getRecord, getOrCreateRecord, getMasteryLevel, recordAnswer, recordDetail, recordRecite, toggleUnproficient, removeWrongEntry,
    updateSettings, importUserData, exportUserData, clearAllData, persist,
    charMarks, initCharMarks, toggleCharMark, recordReciteWithCharMarks, getCharMarkStats,
  }
})
