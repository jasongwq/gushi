export type QuizType = 'fillBlank' | 'nextLine' | 'recite'
export type MasteryLevel = '新' | '学' | '熟' | '固'
export type TextType = '五言' | '七言' | '其他'
export type SourceType = 'smart' | 'grade' | 'all' | 'review' | 'wrong' | 'unproficient'

export interface Poem {
  id: string
  title: string
  author: string
  dynasty: string
  grade: string
  text: string[]
  textType: TextType
  yiwen: string  // 译文/释义
}

export interface LearningRecord {
  poemId: string
  lastReviewDate: string
  reviewCount: number
  nextReviewDate: string
  correctness: number[]
  reciteCorrectness: number[]   // 新增：背诵正确性历史
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

export interface ReciteRecord {
  poemId: string
  date: string           // YYYY-MM-DD
  correct: boolean       // 自评"会"=true，"不会"=false
}

export interface WrongEntry {
  poemId: string
  quizType: QuizType
  wrongCount: number
  lastWrongDate: string
  unproficient: boolean
}

export interface UserSettings {
  enabledPoems: string[]
  quizCount: number
  source: SourceType
  quizTypes: QuizType[]
  selectedGrades: string[]
}

export interface UserData {
  records: LearningRecord[]
  quizResults: QuizResult[]
  reciteRecords: ReciteRecord[]  // 新增
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

export interface RecitationLineResult {
  lineIndex: number
  status: 'ok' | 'stuck' | 'forgot'
}

export interface RecitationResult {
  poemId: string
  overallStatus: 'mastered' | 'not-mastered'
  lines: RecitationLineResult[]
  authorCorrect: boolean | null
  dynastyCorrect: boolean | null
}

export interface QuizSession {
  source: SourceType
  quizTypes: QuizType[]
  questions: QuizQuestion[]
  currentIndex: number
  answers: { questionIndex: number; selectedIndex: number; correct: boolean }[]
  startTime: string
  mode: 'quiz' | 'recitation'
  recitationResults: RecitationResult[]
}
