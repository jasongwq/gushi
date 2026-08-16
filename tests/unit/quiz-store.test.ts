import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useQuizStore } from '@/stores/quiz'
import type { QuizSession } from '@/types'

describe('quiz store persistence', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('session is null by default', () => {
    const store = useQuizStore()
    expect(store.session).toBeNull()
  })

  it('restores session from sessionStorage on init', () => {
    const mockSession: QuizSession = {
      source: 'all',
      quizTypes: ['fillBlank'],
      questions: [
        { poemId: 'p1', quizType: 'fillBlank', prompt: 'test', options: ['A', 'B', 'C', 'D', 'E', 'F'], correctIndex: 0 },
      ],
      currentIndex: 0,
      answers: [],
      startTime: '2026-01-01T00:00:00.000Z',
      mode: 'quiz',
      recitationResults: [],
    }
    sessionStorage.setItem('poem-quiz-session', JSON.stringify(mockSession))

    // Create a new Pinia instance to simulate page reload
    setActivePinia(createPinia())
    const store = useQuizStore()
    expect(store.session).not.toBeNull()
    expect(store.session!.source).toBe('all')
    expect(store.session!.questions).toHaveLength(1)
    expect(store.session!.currentIndex).toBe(0)
  })

  it('persists session to sessionStorage when set', async () => {
    const store = useQuizStore()
    // Manually set session (simulating what startQuiz would do)
    store.session = {
      source: 'smart',
      quizTypes: ['nextLine'],
      questions: [
        { poemId: 'p1', quizType: 'nextLine', prompt: 'test', options: ['A', 'B'], correctIndex: 0 },
      ],
      currentIndex: 0,
      answers: [],
      startTime: '2026-01-01T00:00:00.000Z',
      mode: 'quiz',
      recitationResults: [],
    }

    // Wait for the watch to trigger
    await nextTick()

    const stored = sessionStorage.getItem('poem-quiz-session')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.source).toBe('smart')
    expect(parsed.questions).toHaveLength(1)
  })

  it('clears sessionStorage when session is reset', async () => {
    const store = useQuizStore()
    store.session = {
      source: 'all',
      quizTypes: ['fillBlank'],
      questions: [],
      currentIndex: 0,
      answers: [],
      startTime: '2026-01-01T00:00:00.000Z',
      mode: 'quiz',
      recitationResults: [],
    }
    await nextTick()

    store.resetSession()
    await nextTick()
    expect(sessionStorage.getItem('poem-quiz-session')).toBeNull()
  })

  it('handles corrupted sessionStorage gracefully', () => {
    sessionStorage.setItem('poem-quiz-session', 'not-valid-json{{{')
    setActivePinia(createPinia())
    const store = useQuizStore()
    expect(store.session).toBeNull()
  })

  it('currentRecitation is restored from sessionStorage', () => {
    const recitation = {
      overallStatus: 'mastered' as const,
      lineStatuses: [{ lineIndex: 0, status: 'ok' as const }],
      authorCorrect: true,
      dynastyCorrect: null,
    }
    sessionStorage.setItem('poem-quiz-recitation', JSON.stringify(recitation))

    setActivePinia(createPinia())
    const store = useQuizStore()
    expect(store.currentRecitation.overallStatus).toBe('mastered')
    expect(store.currentRecitation.lineStatuses).toHaveLength(1)
  })

  it('currentRecitation is cleared when session is reset', async () => {
    const store = useQuizStore()
    store.currentRecitation = {
      overallStatus: 'not-mastered',
      lineStatuses: [{ lineIndex: 0, status: 'forgot' }],
      authorCorrect: false,
      dynastyCorrect: null,
    }
    await nextTick()

    store.resetSession()
    await nextTick()
    expect(store.currentRecitation.overallStatus).toBeNull()
    expect(store.currentRecitation.lineStatuses).toHaveLength(0)
  })
})

describe('quiz store computed properties', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('isFinished returns true when currentIndex >= questions.length', () => {
    const store = useQuizStore()
    store.session = {
      source: 'all',
      quizTypes: ['fillBlank'],
      questions: [
        { poemId: 'p1', quizType: 'fillBlank', prompt: 'test', options: ['A'], correctIndex: 0 },
      ],
      currentIndex: 1,
      answers: [{ questionIndex: 0, selectedIndex: 0, correct: true }],
      startTime: '2026-01-01T00:00:00.000Z',
      mode: 'quiz',
      recitationResults: [],
    }
    expect(store.isFinished).toBe(true)
  })

  it('isFinished returns false when currentIndex < questions.length', () => {
    const store = useQuizStore()
    store.session = {
      source: 'all',
      quizTypes: ['fillBlank'],
      questions: [
        { poemId: 'p1', quizType: 'fillBlank', prompt: 'test', options: ['A'], correctIndex: 0 },
      ],
      currentIndex: 0,
      answers: [],
      startTime: '2026-01-01T00:00:00.000Z',
      mode: 'quiz',
      recitationResults: [],
    }
    expect(store.isFinished).toBe(false)
  })

  it('correctCount counts only correct answers', () => {
    const store = useQuizStore()
    store.session = {
      source: 'all',
      quizTypes: ['fillBlank'],
      questions: [
        { poemId: 'p1', quizType: 'fillBlank', prompt: 'q1', options: ['A'], correctIndex: 0 },
        { poemId: 'p2', quizType: 'fillBlank', prompt: 'q2', options: ['B'], correctIndex: 0 },
      ],
      currentIndex: 2,
      answers: [
        { questionIndex: 0, selectedIndex: 0, correct: true },
        { questionIndex: 1, selectedIndex: 0, correct: false },
      ],
      startTime: '2026-01-01T00:00:00.000Z',
      mode: 'quiz',
      recitationResults: [],
    }
    expect(store.correctCount).toBe(1)
    expect(store.totalQuestions).toBe(2)
  })
})
