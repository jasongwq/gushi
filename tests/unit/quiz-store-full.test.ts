import { describe, it, expect, beforeEach } from 'vitest'
import { useQuizStore } from '@/stores/quiz'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import { createPinia, setActivePinia } from 'pinia'

// Mock poem data
const mockPoems = [
  { id: 'p001', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级', text: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'], textType: '五言' as const, yiwen: '译文' },
  { id: 'p002', title: '春晓', author: '孟浩然', dynasty: '唐', grade: '一年级', text: ['春眠不觉晓', '处处闻啼鸟', '夜来风雨声', '花落知多少'], textType: '五言' as const, yiwen: '译文' },
  { id: 'p003', title: '咏鹅', author: '骆宾王', dynasty: '唐', grade: '一年级', text: ['鹅鹅鹅', '曲项向天歌', '白毛浮绿水', '红掌拨清波'], textType: '其他' as const, yiwen: '译文' },
  { id: 'p004', title: '江南', author: '汉乐府', dynasty: '汉', grade: '一年级', text: ['江南可采莲', '莲叶何田田', '鱼戏莲叶间', '鱼戏莲叶东'], textType: '五言' as const, yiwen: '译文' },
  { id: 'p005', title: '悯农', author: '李绅', dynasty: '唐', grade: '二年级', text: ['锄禾日当午', '汗滴禾下土', '谁知盘中餐', '粒粒皆辛苦'], textType: '五言' as const, yiwen: '译文' },
  { id: 'p006', title: '登鹳雀楼', author: '王之涣', dynasty: '唐', grade: '二年级', text: ['白日依山尽', '黄河入海流', '欲穷千里目', '更上一层楼'], textType: '五言' as const, yiwen: '译文' },
]

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  // Pre-load poems into poemStore
  const poemStore = usePoemStore()
  poemStore.$patch({ poems: mockPoems } as any)
})

describe('startQuiz', () => {
  it('starts a quiz with fillBlank questions', () => {
    const store = useQuizStore()
    const result = store.startQuiz('all', ['fillBlank'], 5)
    expect(result).toBe(true)
    expect(store.session).not.toBeNull()
    expect(store.session!.mode).toBe('quiz')
    expect(store.session!.questions.length).toBeGreaterThan(0)
    expect(store.session!.questions[0].quizType).toBe('fillBlank')
  })

  it('starts a quiz with nextLine questions', () => {
    const store = useQuizStore()
    const result = store.startQuiz('all', ['nextLine'], 3)
    expect(result).toBe(true)
    expect(store.session!.questions.length).toBeGreaterThan(0)
  })

  it('starts a quiz with multiple quiz types', () => {
    const store = useQuizStore()
    const result = store.startQuiz('all', ['fillBlank', 'nextLine'], 3)
    expect(result).toBe(true)
    // Each poem should have 2 questions
    expect(store.session!.questions.length).toBeGreaterThan(3)
  })

  it('returns false when no poems available', () => {
    const store = useQuizStore()
    const poemStore = usePoemStore()
    poemStore.$patch({ poems: [] } as any)
    const result = store.startQuiz('all', ['fillBlank'], 5)
    expect(result).toBe(false)
  })

  it('uses smart source correctly', () => {
    const store = useQuizStore()
    const result = store.startQuiz('smart', ['fillBlank'], 3)
    expect(result).toBe(true)
  })

  it('uses grade source with grades filter', () => {
    const store = useQuizStore()
    const result = store.startQuiz('grade', ['fillBlank'], 3, ['一年级'])
    expect(result).toBe(true)
  })

  it('uses review source', () => {
    const store = useQuizStore()
    const learningStore = useLearningStore()
    // Create a record that's due for review
    const today = new Date().toISOString().split('T')[0]
    learningStore.data.records.push({
      poemId: 'p001', lastReviewDate: '2020-01-01', reviewCount: 1,
      nextReviewDate: today, correctness: [1], reciteCorrectness: [],
      masteryLevel: '学', unproficient: false, unproficientCorrectStreak: 0,
    })
    const result = store.startQuiz('review', ['fillBlank'], 3)
    expect(result).toBe(true)
  })

  it('uses wrong source', () => {
    const store = useQuizStore()
    const learningStore = useLearningStore()
    learningStore.data.wrongBook.push({
      poemId: 'p001', quizType: 'fillBlank' as const, wrongCount: 1,
      lastWrongDate: '2026-01-01', unproficient: false,
    })
    const result = store.startQuiz('wrong', ['fillBlank'], 3)
    expect(result).toBe(true)
  })

  it('uses unproficient source', () => {
    const store = useQuizStore()
    const learningStore = useLearningStore()
    learningStore.data.records.push({
      poemId: 'p001', lastReviewDate: '2026-01-01', reviewCount: 1,
      nextReviewDate: '2026-01-02', correctness: [1], reciteCorrectness: [],
      masteryLevel: '学', unproficient: true, unproficientCorrectStreak: 0,
    })
    const result = store.startQuiz('unproficient', ['fillBlank'], 3)
    expect(result).toBe(true)
  })
})

describe('answerQuestion', () => {
  it('records correct answer and advances', () => {
    const store = useQuizStore()
    store.startQuiz('all', ['fillBlank'], 3)
    const question = store.currentQuestion!
    store.answerQuestion(question.correctIndex)
    expect(store.session!.answers).toHaveLength(1)
    expect(store.session!.answers[0].correct).toBe(true)
    expect(store.session!.currentIndex).toBe(1)
  })

  it('records wrong answer and advances', () => {
    const store = useQuizStore()
    store.startQuiz('all', ['fillBlank'], 3)
    const question = store.currentQuestion!
    // Pick a wrong index
    const wrongIndex = question.correctIndex === 0 ? 1 : 0
    store.answerQuestion(wrongIndex)
    expect(store.session!.answers).toHaveLength(1)
    expect(store.session!.answers[0].correct).toBe(false)
  })

  it('updates learning store on correct answer', () => {
    const store = useQuizStore()
    const learningStore = useLearningStore()
    store.startQuiz('all', ['fillBlank'], 3)
    const poemId = store.currentQuestion!.poemId
    const question = store.currentQuestion!
    store.answerQuestion(question.correctIndex)
    const record = learningStore.getRecord(poemId)
    expect(record).toBeDefined()
    expect(record!.reviewCount).toBeGreaterThan(0)
  })
})

describe('startRecitation', () => {
  it('starts a recitation session', () => {
    const store = useQuizStore()
    const result = store.startRecitation('all', 3)
    expect(result).toBe(true)
    expect(store.session).not.toBeNull()
    expect(store.session!.mode).toBe('recitation')
    expect(store.session!.questions[0].quizType).toBe('recite')
  })

  it('uses enabledPoems (not all poems)', () => {
    const store = useQuizStore()
    const poemStore = usePoemStore()
    // Disable some poems by setting enabledPoems in settings
    const learningStore = useLearningStore()
    learningStore.updateSettings({ enabledPoems: ['p001', 'p002'] })
    // The poemStore should reflect enabledPoems
    // Since poemStore.enabledPoems depends on settings, this should work
    const result = store.startRecitation('all', 10)
    expect(result).toBe(true)
    // Should only use enabled poems
    const poemIds = store.session!.questions.map(q => q.poemId)
    expect(poemIds.every(id => ['p001', 'p002'].includes(id))).toBe(true)
  })

  it('returns false when no poems available', () => {
    const store = useQuizStore()
    const poemStore = usePoemStore()
    poemStore.$patch({ poems: [] } as any)
    const result = store.startRecitation('all', 3)
    expect(result).toBe(false)
  })
})

describe('submitRecitationResult', () => {
  it('records mastered result and advances', () => {
    const store = useQuizStore()
    store.startRecitation('all', 3)
    const poemId = store.currentQuestion!.poemId
    store.submitRecitationResult({
      poemId,
      overallStatus: 'mastered',
      lines: [],
      authorCorrect: null,
      dynastyCorrect: null,
    })
    expect(store.session!.recitationResults).toHaveLength(1)
    expect(store.session!.currentIndex).toBe(1)
  })

  it('records not-mastered result with stuck lines', () => {
    const store = useQuizStore()
    const learningStore = useLearningStore()
    store.startRecitation('all', 3)
    const poemId = store.currentQuestion!.poemId
    store.submitRecitationResult({
      poemId,
      overallStatus: 'not-mastered',
      lines: [
        { lineIndex: 0, status: 'stuck' },
        { lineIndex: 1, status: 'forgot' },
      ],
      authorCorrect: false,
      dynastyCorrect: false,
    })
    expect(store.session!.recitationResults).toHaveLength(1)
    // Check that wrong book entries were created
    expect(learningStore.wrongBook.length).toBeGreaterThan(0)
  })
})

describe('goToPrevRecitation', () => {
  it('goes back to previous poem', () => {
    const store = useQuizStore()
    store.startRecitation('all', 3)
    const poemId = store.currentQuestion!.poemId
    store.submitRecitationResult({
      poemId,
      overallStatus: 'mastered',
      lines: [],
      authorCorrect: null,
      dynastyCorrect: null,
    })
    expect(store.session!.currentIndex).toBe(1)
    store.goToPrevRecitation()
    expect(store.session!.currentIndex).toBe(0)
  })

  it('does nothing at index 0', () => {
    const store = useQuizStore()
    store.startRecitation('all', 3)
    store.goToPrevRecitation()
    expect(store.session!.currentIndex).toBe(0)
  })
})

describe('resetSession', () => {
  it('clears session and recitation', () => {
    const store = useQuizStore()
    store.startQuiz('all', ['fillBlank'], 3)
    store.resetSession()
    expect(store.session).toBeNull()
    expect(store.currentRecitation.overallStatus).toBeNull()
  })
})

describe('currentRecitation', () => {
  it('resets current recitation', () => {
    const store = useQuizStore()
    store.currentRecitation = {
      overallStatus: 'mastered',
      lineStatuses: [{ lineIndex: 0, status: 'ok' }],
      authorCorrect: true,
      dynastyCorrect: null,
    }
    store.resetCurrentRecitation()
    expect(store.currentRecitation.overallStatus).toBeNull()
    expect(store.currentRecitation.lineStatuses).toHaveLength(0)
  })
})
