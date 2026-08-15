export type QuizType = 'fillBlank' | 'nextLine' | 'recite'
export type MasteryLevel = '新' | '学' | '熟' | '固'
export type TextType = '五言' | '七言' | '其他'
export type SourceType = 'smart' | 'grade' | 'unit' | 'all' | 'review' | 'wrong' | 'unproficient'

export interface Poem {
  id: string
  title: string
  author: string
  dynasty: string
  grade: string
  unit: string
  text: string[]
  textType: TextType
}

export interface LearningRecord {
  poemId: string
  lastReviewDate: string
  reviewCount: number
  nextReviewDate: string
  correctness: number[]
  masteryLevel: MasteryLevel
  unproficient: boolean
  unproficientCorrectStreak: number
  lastLearnDate?: string
}

export interface QuizResult {
  poemId: string
  quizType: QuizType
  date: string
  correct: boolean
  wrongAnswer?: string
}

export interface WrongEntry {
  poemId: string
  quizType: QuizType
  wrongCount: number
  lastWrongDate: string
  unproficient: boolean
}

export interface UserSettings {
  enabledGrades: string[]
  quizCount: number
}

export interface UserData {
  records: LearningRecord[]
  quizResults: QuizResult[]
  wrongBook: WrongEntry[]
  settings: UserSettings
}

export interface QuizQuestion {
  poemId: string
  quizType: QuizType
  prompt: string
  options: string[]
  correctIndex: number
  blankPositions?: number[]
}

export interface QuizSession {
  source: SourceType
  quizTypes: QuizType[]
  questions: QuizQuestion[]
  currentIndex: number
  answers: { questionIndex: number; selectedIndex: number; correct: boolean }[]
  startTime: string
}
