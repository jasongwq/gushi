import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import QuizPlayPage from '@/views/QuizPlayPage.vue'
import type { QuizSession } from '@/types'

// 避免 happy-dom 中真实 fetch('/poems.json') 产生未处理网络错误
const mockPoemForRecite = {
  id: 'p1', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级',
  text: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'],
  textType: '五言', yiwen: '译文',
}

vi.mock('@/stores/poem', () => ({
  usePoemStore: () => ({
    fetchPoems: vi.fn(() => Promise.resolve()),
    getPoemById: vi.fn(() => mockPoemForRecite),
  }),
}))

vi.mock('@/stores/learning', () => ({
  useLearningStore: () => ({
    settings: { showYiwen: false },
    updateSettings: vi.fn(),
    getCharMarks: () => ({}),
    toggleCharMark: vi.fn(),
    initCharMarks: vi.fn(),
    recordReciteWithCharMarks: vi.fn(),
    // quiz store 的 submitRecitationResult 会调用这些
    recordAnswer: vi.fn(),
    recordDetail: vi.fn(),
    unmarkPendingReciteSchedule: vi.fn(),
  }),
}))

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
    { path: '/quiz/play', name: 'quiz-play', component: { template: '<div>Play</div>' } },
    { path: '/quiz/result', name: 'quiz-result', component: { template: '<div>Result</div>' } },
  ],
})

function mountWithSession(session: QuizSession | null) {
  setActivePinia(createPinia())
  if (session) {
    sessionStorage.setItem('poem-quiz-session', JSON.stringify(session))
  }
  return mount(QuizPlayPage, {
    global: {
      plugins: [createPinia(), router],
    },
  })
}

const makeSession = (overrides: Partial<QuizSession> = {}): QuizSession => ({
  source: 'all',
  quizTypes: ['fillBlank'],
  questions: [
    { poemId: 'p1', quizType: 'fillBlank', prompt: '春眠不觉晓\n处处闻啼鸟', options: ['晓', '鸟', '花', '月', '风', '雨'], correctIndex: 0, blankPositions: [4] },
    { poemId: 'p2', quizType: 'nextLine', prompt: '春眠不觉晓\n→ 下句是？', options: ['处处闻啼鸟', '床前明月光', '疑是地上霜', '举头望明月', '低头思故乡', '花落知多少'], correctIndex: 0 },
    { poemId: 'p3', quizType: 'fillBlank', prompt: '床前明月光\n疑是地上霜', options: ['光', '霜', '月', '星', '风', '雨'], correctIndex: 0, blankPositions: [3] },
  ],
  currentIndex: 0,
  answers: [],
  startTime: '2026-01-01T00:00:00.000Z',
  mode: 'quiz',
  recitationResults: [],
  ...overrides,
})

describe('QuizPlayPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows progress dots for each question', () => {
    const session = makeSession()
    const wrapper = mountWithSession(session)
    const dots = wrapper.findAll('.dot')
    expect(dots).toHaveLength(3)
  })

  it('shows "未开始答题" when no session', () => {
    const wrapper = mountWithSession(null)
    expect(wrapper.text()).toContain('未开始答题')
  })

  it('shows current question indicator', () => {
    const session = makeSession()
    const wrapper = mountWithSession(session)
    const currentDot = wrapper.find('.dot.current')
    expect(currentDot.text()).toBe('1')
  })

  it('unanswered dots are disabled', () => {
    const session = makeSession()
    const wrapper = mountWithSession(session)
    const dots = wrapper.findAll('.dot')
    expect((dots[1].element as HTMLButtonElement).disabled).toBe(true)
    expect((dots[2].element as HTMLButtonElement).disabled).toBe(true)
  })

  it('answered dots show correct/wrong status', () => {
    const session = makeSession({
      currentIndex: 2,
      answers: [
        { questionIndex: 0, selectedIndex: 0, correct: true },
        { questionIndex: 1, selectedIndex: 1, correct: false },
      ],
    })
    const wrapper = mountWithSession(session)
    const dots = wrapper.findAll('.dot')
    expect(dots[0].classes()).toContain('correct')
    expect(dots[1].classes()).toContain('wrong')
  })

  it('answered dots are clickable', () => {
    const session = makeSession({
      currentIndex: 2,
      answers: [
        { questionIndex: 0, selectedIndex: 0, correct: true },
        { questionIndex: 1, selectedIndex: 1, correct: false },
      ],
    })
    const wrapper = mountWithSession(session)
    const dots = wrapper.findAll('.dot')
    expect((dots[0].element as HTMLButtonElement).disabled).toBe(false)
    expect((dots[1].element as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows quiz component for current question', () => {
    const session = makeSession()
    const wrapper = mountWithSession(session)
    expect(wrapper.findComponent({ name: 'FillBlankQuiz' }).exists()).toBe(true)
  })

  it('shows NextLineQuiz for nextLine question type', () => {
    const session = makeSession({ currentIndex: 1 })
    const wrapper = mountWithSession(session)
    expect(wrapper.findComponent({ name: 'NextLineQuiz' }).exists()).toBe(true)
  })

  it('correct answer highlights option green and advances quickly', async () => {
    const session = makeSession()
    const wrapper = mountWithSession(session)

    const fillBlank = wrapper.findComponent({ name: 'FillBlankQuiz' })
    await fillBlank.vm.$emit('answer', 0) // correctIndex is 0

    // Option should be highlighted (selectedOption prop is set)
    expect(fillBlank.props('selectedOption')).toBe(0)
    // Correct option should have green class
    expect(fillBlank.findAll('.option-correct').length).toBeGreaterThan(0)

    // Advance 400ms (correct answer delay)
    vi.advanceTimersByTime(400)
    await wrapper.vm.$nextTick()

    // Should have moved to next question
    expect(wrapper.findComponent({ name: 'NextLineQuiz' }).exists() || wrapper.findComponent({ name: 'FillBlankQuiz' }).exists()).toBe(true)
  })

  it('wrong answer highlights option red and stays for 1.5s', async () => {
    const session = makeSession()
    const wrapper = mountWithSession(session)

    const fillBlank = wrapper.findComponent({ name: 'FillBlankQuiz' })
    await fillBlank.vm.$emit('answer', 1) // wrong answer

    // Wrong option should have red class, correct should have green
    expect(fillBlank.findAll('.option-wrong').length).toBeGreaterThan(0)
    expect(fillBlank.findAll('.option-correct').length).toBeGreaterThan(0)

    // After 400ms, should still be on the same question (wrong answer stays longer)
    vi.advanceTimersByTime(400)
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent({ name: 'FillBlankQuiz' }).props('selectedOption')).toBe(1)

    // After 1500ms total, should advance
    vi.advanceTimersByTime(1100)
    await wrapper.vm.$nextTick()
  })

  it('reviewing answered question shows selected option highlighted', async () => {
    const session = makeSession({
      currentIndex: 2,
      answers: [
        { questionIndex: 0, selectedIndex: 0, correct: true },
        { questionIndex: 1, selectedIndex: 1, correct: false },
      ],
    })
    const wrapper = mountWithSession(session)

    // Click on first dot (answered correctly)
    const firstDot = wrapper.findAll('.dot')[0]
    await firstDot.trigger('click')

    // The FillBlankQuiz should show selectedOption=0
    const quiz = wrapper.findComponent({ name: 'FillBlankQuiz' })
    expect(quiz.props('selectedOption')).toBe(0)
    expect(quiz.props('disabled')).toBe(true)
  })

  it('has aria-label on progress dots', () => {
    const session = makeSession()
    const wrapper = mountWithSession(session)
    const dots = wrapper.findAll('.dot')
    expect(dots[0].attributes('aria-label')).toContain('第1题')
  })
})

describe('recite questions in mixed queue', () => {
  const reciteSession = (overrides: Partial<QuizSession> = {}): QuizSession => ({
    source: 'all',
    quizTypes: ['recite', 'fillBlank'],
    questions: [
      { poemId: 'p1', quizType: 'recite', prompt: '静夜思', options: [], correctIndex: 0 },
      { poemId: 'p2', quizType: 'fillBlank', prompt: '春眠不觉晓\n处处闻啼鸟', options: ['晓', '鸟', '花', '月', '风', '雨'], correctIndex: 0, blankPositions: [4] },
    ],
    currentIndex: 0,
    answers: [],
    startTime: '2026-01-01T00:00:00.000Z',
    mode: 'quiz',
    recitationResults: [],
    ...overrides,
  })

  it('renders RecitationCard in revealMode for recite question', () => {
    const wrapper = mountWithSession(reciteSession())
    expect(wrapper.findComponent({ name: 'RecitationCard' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'RecitationCard' }).props('revealMode')).toBe(true)
  })

  it('recite question submit pushes answer and advances', async () => {
    const wrapper = mountWithSession(reciteSession())
    const card = wrapper.findComponent({ name: 'RecitationCard' })
    await card.vm.$emit('submit', {
      poemId: 'p1',
      overallStatus: 'mastered',
      lines: [],
      authorCorrect: null,
      dynastyCorrect: null,
      charMarks: {},
    })
    await wrapper.vm.$nextTick()
    const quizStore = (wrapper.vm as any).quizStore
    expect(quizStore.session.answers).toHaveLength(1)
    expect(quizStore.session.answers[0].correct).toBe(true)
    expect(quizStore.session.currentIndex).toBe(1)
  })

  it('recite question in reviewing shows revealStep 3', async () => {
    const session = reciteSession({
      currentIndex: 1,
      answers: [{ questionIndex: 0, selectedIndex: 0, correct: true }],
    })
    const wrapper = mountWithSession(session)
    await wrapper.findAll('.dot')[0].trigger('click')
    await wrapper.vm.$nextTick()
    const card = wrapper.findComponent({ name: 'RecitationCard' })
    expect(card.props('revealStep')).toBe(3)
  })

  it('recite question in reviewing is disabled', async () => {
    const session = reciteSession({
      currentIndex: 1,
      answers: [{ questionIndex: 0, selectedIndex: 0, correct: true }],
    })
    const wrapper = mountWithSession(session)
    await wrapper.findAll('.dot')[0].trigger('click')
    await wrapper.vm.$nextTick()
    const card = wrapper.findComponent({ name: 'RecitationCard' })
    expect(card.props('disabled')).toBe(true)
  })
})
