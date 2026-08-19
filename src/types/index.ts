export type QuizType = 'fillBlank' | 'nextLine' | 'recite' | 'line' | 'author' | 'dynasty'
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
  charMarkStats: CharMarkStats[]  // 新增：按字聚合的统计
  masteryLevel: MasteryLevel
  unproficient: boolean
  unproficientCorrectStreak: number
  lastLearnDate?: string
  firstLearnDate?: string  // 首次学习日期，用于遗忘曲线时间线
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
  charMarks: CharMarkMap  // 新增：本次背诵最终状态的快照
}

export interface WrongEntry {
  poemId: string
  quizType: QuizType
  wrongCount: number
  lastWrongDate: string
  unproficient: boolean
  note?: string  // 细节备注（如卡顿句），line/author/dynasty 详情记录时使用
}

export interface UserSettings {
  enabledPoems: string[]
  quizCount: number
  source: SourceType
  quizTypes: QuizType[]
  selectedGrades: string[]
  showYiwen?: boolean
}

export interface UserData {
  records: LearningRecord[]
  quizResults: QuizResult[]
  reciteRecords: ReciteRecord[]  // 新增
  wrongBook: WrongEntry[]
  schedule: Record<string, string>  // 学习排程：诗→计划学习日期（YYYY-MM-DD）
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
  charMarks: CharMarkMap  // 新增
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

// 字级标记状态（ok = 无记录，不显式存储）
export type CharMarkStatus = 'fuzzy' | 'wrong'

// 会话内字级标记 map，key 为 `${lineIndex}-${charIndex}`
export type CharMarkMap = Record<string, CharMarkStatus>

// 单字聚合统计（跨所有历史背诵快照累计）
export interface CharMarkStats {
  poemId: string
  lineIndex: number
  charIndex: number
  char: string           // 原字，用于校验数据一致性
  fuzzyCount: number     // 被标为模糊的次数
  wrongCount: number     // 被标为错误的次数
}
