import type { UserData } from '@/types'

const STORAGE_KEY = 'poem-quiz-data'

function getDefaultData(): UserData {
  return {
    records: [],
    quizResults: [],
    wrongBook: [],
    settings: { enabledGrades: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] },
  }
}

export function loadData(): UserData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultData()
    const parsed = JSON.parse(raw) as Partial<UserData>
    const defaults = getDefaultData()
    const data = {
      records: parsed.records ?? defaults.records,
      quizResults: parsed.quizResults ?? defaults.quizResults,
      wrongBook: parsed.wrongBook ?? defaults.wrongBook,
      settings: { ...defaults.settings, ...parsed.settings },
    }
    // 迁移：检测旧版 poemId（b 开头），清除旧记录
    if (data.records.some(r => r.poemId.startsWith('b')) ||
        data.quizResults.some(r => r.poemId.startsWith('b')) ||
        data.wrongBook.some(w => w.poemId.startsWith('b'))) {
      return getDefaultData()
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
