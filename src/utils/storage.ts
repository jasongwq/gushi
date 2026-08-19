import type { UserData } from '@/types'

const STORAGE_KEY = 'poem-quiz-data'

function getDefaultData(): UserData {
  return {
    records: [],
    quizResults: [],
    reciteRecords: [],
    wrongBook: [],
    schedule: {},
    settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] },
  }
}

export function loadData(): UserData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultData()
    const parsed = JSON.parse(raw) as Partial<UserData>
    const defaults = getDefaultData()
    const data = {
      records: (parsed.records ?? defaults.records).map(r => ({
        ...r,
        reciteCorrectness: r.reciteCorrectness ?? [],
        charMarkStats: r.charMarkStats ?? [],
      })),
      quizResults: parsed.quizResults ?? defaults.quizResults,
      reciteRecords: (parsed.reciteRecords ?? defaults.reciteRecords).map(r => ({
        ...r,
        charMarks: r.charMarks ?? {},
      })),
      wrongBook: parsed.wrongBook ?? defaults.wrongBook,
      schedule: parsed.schedule ?? defaults.schedule,
      settings: { ...defaults.settings, ...parsed.settings },
    }
    return data
  } catch {
    return getDefaultData()
  }
}

export function saveData(data: UserData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function exportData(): string {
  return JSON.stringify(loadData(), null, 2)
}

const defaultRecord = {
  poemId: '',
  lastReviewDate: '',
  reviewCount: 0,
  nextReviewDate: '',
  correctness: [] as number[],
  reciteCorrectness: [] as number[],
  masteryLevel: '新' as const,
  unproficient: false,
  unproficientCorrectStreak: 0,
}

const defaultWrongEntry = {
  poemId: '',
  quizType: 'fillBlank' as const,
  wrongCount: 0,
  lastWrongDate: '',
  unproficient: false,
}

export function importData(json: string): boolean {
  try {
    const parsed = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null) return false
    if (!Array.isArray(parsed.records)) return false
    if (!parsed.settings || typeof parsed.settings !== 'object') return false

    const defaults = getDefaultData()
    const data: UserData = {
      records: parsed.records
        .map((r: any) => ({ ...defaultRecord, ...r }))
        .filter((r: any) => r.poemId),
      quizResults: parsed.quizResults ?? defaults.quizResults,
      reciteRecords: parsed.reciteRecords ?? defaults.reciteRecords,
      wrongBook: (parsed.wrongBook ?? []).map((w: any) => ({ ...defaultWrongEntry, ...w })),
      schedule: parsed.schedule ?? defaults.schedule,
      settings: { ...defaults.settings, ...parsed.settings },
    }
    saveData(data)
    return true
  } catch {
    return false
  }
}

export function clearData(): void {
  localStorage.removeItem(STORAGE_KEY)
}
