import { describe, it, expect } from 'vitest'
import type {
  QuizType,
  MasteryLevel,
  TextType,
  SourceType,
  Poem,
  LearningRecord,
  QuizResult,
  WrongEntry,
  UserSettings,
  UserData,
  QuizQuestion,
  QuizSession,
} from '@/types'

describe('Type definitions', () => {
  it('should allow valid QuizType values', () => {
    const types: QuizType[] = ['fillBlank', 'nextLine', 'recite']
    expect(types).toHaveLength(3)
  })

  it('should allow valid MasteryLevel values', () => {
    const levels: MasteryLevel[] = ['新', '学', '熟', '固']
    expect(levels).toHaveLength(4)
  })

  it('should allow valid TextType values', () => {
    const types: TextType[] = ['五言', '七言', '其他']
    expect(types).toHaveLength(3)
  })

  it('should allow valid SourceType values', () => {
    const types: SourceType[] = ['smart', 'grade', 'unit', 'all', 'review', 'wrong', 'unproficient']
    expect(types).toHaveLength(7)
  })

  it('should construct a valid Poem object', () => {
    const poem: Poem = {
      id: '1',
      title: '静夜思',
      author: '李白',
      dynasty: '唐',
      grade: '一上',
      unit: '1',
      text: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'],
      textType: '五言',
    }
    expect(poem.id).toBe('1')
    expect(poem.text).toHaveLength(4)
    expect(poem.textType).toBe('五言')
  })

  it('should construct a valid LearningRecord object', () => {
    const record: LearningRecord = {
      poemId: '1',
      lastReviewDate: '2026-01-01',
      reviewCount: 5,
      nextReviewDate: '2026-01-08',
      correctness: [1, 1, 0, 1, 1],
      masteryLevel: '熟',
      unproficient: false,
      unproficientCorrectStreak: 0,
      lastLearnDate: '2025-12-01',
    }
    expect(record.masteryLevel).toBe('熟')
    expect(record.unproficient).toBe(false)
  })

  it('should construct a valid QuizResult object', () => {
    const result: QuizResult = {
      poemId: '1',
      quizType: 'fillBlank',
      date: '2026-01-01',
      correct: false,
      wrongAnswer: '床前明月光',
    }
    expect(result.correct).toBe(false)
    expect(result.wrongAnswer).toBe('床前明月光')
  })

  it('should construct a valid WrongEntry object', () => {
    const entry: WrongEntry = {
      poemId: '1',
      quizType: 'nextLine',
      wrongCount: 3,
      lastWrongDate: '2026-01-01',
      unproficient: true,
    }
    expect(entry.wrongCount).toBe(3)
    expect(entry.unproficient).toBe(true)
  })

  it('should construct a valid UserSettings object', () => {
    const settings: UserSettings = {
      enabledGrades: ['一上', '一下'],
      quizCount: 10,
    }
    expect(settings.enabledGrades).toHaveLength(2)
    expect(settings.quizCount).toBe(10)
  })

  it('should construct a valid UserData object', () => {
    const data: UserData = {
      records: [],
      quizResults: [],
      wrongBook: [],
      settings: { enabledGrades: [], quizCount: 5 },
    }
    expect(data.records).toEqual([])
    expect(data.settings.quizCount).toBe(5)
  })

  it('should construct a valid QuizQuestion object', () => {
    const question: QuizQuestion = {
      poemId: '1',
      quizType: 'fillBlank',
      prompt: '床前明月光，疑是地上霜',
      options: ['静夜思', '春晓', '登鹳雀楼', '望庐山瀑布'],
      correctIndex: 0,
      blankPositions: [2],
    }
    expect(question.options).toHaveLength(4)
    expect(question.correctIndex).toBe(0)
  })

  it('should construct a valid QuizSession object', () => {
    const session: QuizSession = {
      source: 'smart',
      quizTypes: ['fillBlank', 'nextLine'],
      questions: [],
      currentIndex: 0,
      answers: [],
      startTime: '2026-01-01T10:00:00Z',
    }
    expect(session.source).toBe('smart')
    expect(session.quizTypes).toHaveLength(2)
  })
})
