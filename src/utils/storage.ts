import type { UserData } from '@/types'

const STORAGE_KEY = 'poem-quiz-data'

function getDefaultData(): UserData {
  return {
    records: [],
    quizResults: [],
    wrongBook: [],
    settings: { enabledGrades: [], quizCount: 5 },
  }
}

export function loadData(): UserData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultData()
    const parsed = JSON.parse(raw) as Partial<UserData>
    const defaults = getDefaultData()
    return {
      records: parsed.records ?? defaults.records,
      quizResults: parsed.quizResults ?? defaults.quizResults,
      wrongBook: parsed.wrongBook ?? defaults.wrongBook,
      settings: { ...defaults.settings, ...parsed.settings },
    }
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

export function importData(json: string): boolean {
  try {
    const parsed = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null) return false
    if (!Array.isArray(parsed.records)) return false
    if (!parsed.settings || typeof parsed.settings !== 'object') return false
    saveData(parsed as UserData)
    return true
  } catch {
    return false
  }
}

export function clearData(): void {
  localStorage.removeItem(STORAGE_KEY)
}
