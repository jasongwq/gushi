import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { QuizQuestion, QuizSession, QuizType, SourceType, Poem, RecitationResult } from '@/types'
import { smartMix, getPoemsBySource, getReviewPoems, getWrongPoems, getUnproficientPoems, shuffleArray } from '@/utils/quiz'
import { generateFillBlankOptions, generateNextLineOptions, CJK_CHAR_REGEX, cjkCharCount, stripPunctuation } from '@/utils/distractor'
import { usePoemStore } from './poem'
import { useLearningStore } from './learning'

const SESSION_STORAGE_KEY = 'poem-quiz-session'
const RECITATION_STORAGE_KEY = 'poem-quiz-recitation'

function saveSessionToStorage(session: QuizSession | null) {
  if (session) {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  } else {
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
  }
}

function loadSessionFromStorage(): QuizSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveCurrentRecitationToStorage(recitation: {
  overallStatus: 'mastered' | 'not-mastered' | null
  lineStatuses: { lineIndex: number; status: 'ok' | 'stuck' | 'forgot' }[]
  authorCorrect: boolean | null
  dynastyCorrect: boolean | null
}) {
  if (recitation.overallStatus !== null || recitation.lineStatuses.length > 0) {
    sessionStorage.setItem(RECITATION_STORAGE_KEY, JSON.stringify(recitation))
  } else {
    sessionStorage.removeItem(RECITATION_STORAGE_KEY)
  }
}

function loadCurrentRecitationFromStorage() {
  try {
    const raw = sessionStorage.getItem(RECITATION_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const useQuizStore = defineStore('quiz', () => {
  const session = ref<QuizSession | null>(loadSessionFromStorage())
  const currentIndex = computed(() => session.value?.currentIndex ?? 0)
  const currentQuestion = computed(() => session.value?.questions[session.value.currentIndex] ?? null)
  const isFinished = computed(() => session.value ? session.value.currentIndex >= session.value.questions.length : false)
  const totalQuestions = computed(() => session.value?.questions.length ?? 0)
  const correctCount = computed(() => session.value?.answers.filter(a => a.correct).length ?? 0)

  const savedRecitation = loadCurrentRecitationFromStorage()
  const currentRecitation = ref<{
    overallStatus: 'mastered' | 'not-mastered' | null
    lineStatuses: { lineIndex: number; status: 'ok' | 'stuck' | 'forgot' }[]
    authorCorrect: boolean | null
    dynastyCorrect: boolean | null
  }>(savedRecitation ?? {
    overallStatus: null,
    lineStatuses: [],
    authorCorrect: null,
    dynastyCorrect: null,
  })

  // Auto-persist session and currentRecitation to sessionStorage
  watch(session, (val) => saveSessionToStorage(val), { deep: true })
  watch(currentRecitation, (val) => saveCurrentRecitationToStorage(val), { deep: true })

  function resetCurrentRecitation() {
    currentRecitation.value = {
      overallStatus: null,
      lineStatuses: [],
      authorCorrect: null,
      dynastyCorrect: null,
    }
  }

  function generateQuestions(poemIds: string[], quizTypes: QuizType[]): QuizQuestion[] {
    const poemStore = usePoemStore()
    const questions: QuizQuestion[] = []
    for (const poemId of poemIds) {
      const poem = poemStore.getPoemById(poemId)
      if (!poem) continue
      for (const quizType of quizTypes) {
        questions.push(generateQuestion(poem, quizType, poemStore.enabledPoems))
      }
    }
    return shuffleArray(questions)
  }

  function generateQuestion(poem: Poem, quizType: QuizType, allPoems: Poem[]): QuizQuestion {
    switch (quizType) {
      case 'fillBlank': {
        const fullText = poem.text.join('')
        const chars = [...fullText].filter(ch => CJK_CHAR_REGEX.test(ch))
        const blankPosition = Math.floor(Math.random() * chars.length)
        const blankChar = chars[blankPosition]
        const prompt = poem.text.join('\n')
        const options = generateFillBlankOptions(poem, allPoems, blankChar, 0)
        return {
          poemId: poem.id, quizType: 'fillBlank', prompt, options,
          correctIndex: options.indexOf(blankChar), blankPositions: [blankPosition],
        }
      }
      case 'nextLine': {
        // Find adjacent line pairs where both lines have the same CJK char count
        const validPairs: { lineIndex: number; isForward: boolean }[] = []
        for (let i = 0; i < poem.text.length - 1; i++) {
          const len1 = cjkCharCount(poem.text[i])
          const len2 = cjkCharCount(poem.text[i + 1])
          if (len1 === len2 && len2 >= 4) {
            validPairs.push({ lineIndex: i, isForward: true })
            validPairs.push({ lineIndex: i, isForward: false })
          }
        }
        if (validPairs.length === 0) {
          // Fallback to fillBlank if no valid nextLine pairs
          return generateQuestion(poem, 'fillBlank', allPoems)
        }
        const pair = validPairs[Math.floor(Math.random() * validPairs.length)]
        const givenLine = pair.isForward ? poem.text[pair.lineIndex] : poem.text[pair.lineIndex + 1]
        const correctLine = pair.isForward ? poem.text[pair.lineIndex + 1] : poem.text[pair.lineIndex]
        const givenStripped = stripPunctuation(givenLine)
        const options = generateNextLineOptions(poem, allPoems, correctLine, poem.grade, givenLine)
        return {
          poemId: poem.id, quizType: 'nextLine',
          prompt: `${givenStripped}\n${pair.isForward ? '→ 下句是？' : '→ 上句是？'}`,
          options, correctIndex: options.indexOf(stripPunctuation(correctLine)),
        }
      }
      case 'recite': {
        return {
          poemId: poem.id,
          quizType: 'recite',
          prompt: poem.title,
          options: [],
          correctIndex: 0,
        }
      }
      default:
        // 未知类型兜底为 nextLine
        return generateQuestion(poem, 'nextLine', allPoems)
    }
  }

  function startRecitation(source: SourceType, count: number, grades?: string[], poemId?: string): boolean {
    const poemStore = usePoemStore()
    const learningStore = useLearningStore()
    const today = new Date().toISOString().split('T')[0]

    const enabledPoems = poemStore.enabledPoems

    // 单诗模式：直接以指定诗构造 session
    if (poemId) {
      const poem = poemStore.getPoemById(poemId)
      if (!poem || !enabledPoems.some(p => p.id === poemId)) return false
      session.value = {
        source,
        quizTypes: ['recite'],
        questions: [{
          poemId: poem.id,
          quizType: 'recite' as QuizType,
          prompt: poem.title,
          options: [],
          correctIndex: 0,
        }],
        currentIndex: 0,
        answers: [],
        startTime: new Date().toISOString(),
        mode: 'recitation',
        recitationResults: [],
      }
      resetCurrentRecitation()
      return true
    }

    let selectedPoems: Poem[]
    if (source === 'smart') {
      selectedPoems = smartMix(enabledPoems, learningStore.records, learningStore.wrongBook, count, today)
    } else if (source === 'review') {
      selectedPoems = shuffleArray(getReviewPoems(enabledPoems, learningStore.records, today)).slice(0, count)
    } else if (source === 'wrong') {
      selectedPoems = shuffleArray(getWrongPoems(enabledPoems, learningStore.wrongBook)).slice(0, count)
    } else if (source === 'unproficient') {
      selectedPoems = shuffleArray(getUnproficientPoems(enabledPoems, learningStore.records)).slice(0, count)
    } else {
      selectedPoems = getPoemsBySource(enabledPoems, source, today, { grades })
      selectedPoems = shuffleArray(selectedPoems).slice(0, count)
    }

    if (selectedPoems.length === 0) return false

    const questions: QuizQuestion[] = selectedPoems.map(p => ({
      poemId: p.id,
      quizType: 'recite' as QuizType,
      prompt: p.title,
      options: [],
      correctIndex: 0,
    }))

    session.value = {
      source,
      quizTypes: ['recite'],
      questions,
      currentIndex: 0,
      answers: [],
      startTime: new Date().toISOString(),
      mode: 'recitation',
      recitationResults: [],
    }
    resetCurrentRecitation()
    return true
  }

  function goToPrevRecitation() {
    if (!session.value || session.value.currentIndex === 0) return
    session.value.currentIndex--
    const poemId = session.value.questions[session.value.currentIndex].poemId
    // 移除当前诗的结果（回退时重新判定）
    const resultIndex = session.value.recitationResults.findIndex(r => r.poemId === poemId)
    if (resultIndex >= 0) {
      session.value.recitationResults.splice(resultIndex, 1)
    }
  }

  function submitRecitationResult(result: RecitationResult) {
    if (!session.value) return
    session.value.recitationResults.push(result)

    // 混排统一：背诵题也推一条 answers 条目，使进度圆点/计分/结果页统一工作
    session.value.answers.push({
      questionIndex: session.value.currentIndex,
      selectedIndex: 0, // recite 无选项，占位
      correct: result.overallStatus === 'mastered',
    })

    const learningStore = useLearningStore()

    // 整体只调用一次 recordAnswer
    learningStore.recordAnswer(result.poemId, 'recite', result.overallStatus === 'mastered')
    // 正常提交，移除待调度标记（细节已由 RecitationCard 即时保存）
    learningStore.unmarkPendingReciteSchedule(result.poemId)

    session.value.currentIndex++
    resetCurrentRecitation()
  }

  function startQuiz(source: SourceType, quizTypes: QuizType[], count: number, grades?: string[]): boolean {
    const poemStore = usePoemStore()
    const learningStore = useLearningStore()
    const today = new Date().toISOString().split('T')[0]

    const enabledPoems = poemStore.enabledPoems

    let selectedPoems: Poem[]
    if (source === 'smart') {
      selectedPoems = smartMix(enabledPoems, learningStore.records, learningStore.wrongBook, count, today)
    } else if (source === 'review') {
      selectedPoems = shuffleArray(getReviewPoems(enabledPoems, learningStore.records, today)).slice(0, count)
    } else if (source === 'wrong') {
      selectedPoems = shuffleArray(getWrongPoems(enabledPoems, learningStore.wrongBook)).slice(0, count)
    } else if (source === 'unproficient') {
      selectedPoems = shuffleArray(getUnproficientPoems(enabledPoems, learningStore.records)).slice(0, count)
    } else {
      selectedPoems = getPoemsBySource(enabledPoems, source, today, { grades })
      selectedPoems = shuffleArray(selectedPoems).slice(0, count)
    }

    const questions = generateQuestions(selectedPoems.map(p => p.id), quizTypes)
    if (questions.length === 0) return false
    session.value = {
      source, quizTypes, questions, currentIndex: 0, answers: [],
      startTime: new Date().toISOString(),
      mode: 'quiz',
      recitationResults: [],
    }
    return true
  }

  function answerQuestion(selectedIndex: number) {
    if (!session.value || !currentQuestion.value) return
    const correct = selectedIndex === currentQuestion.value.correctIndex
    session.value.answers.push({ questionIndex: session.value.currentIndex, selectedIndex, correct })
    const learningStore = useLearningStore()
    learningStore.recordAnswer(currentQuestion.value.poemId, currentQuestion.value.quizType, correct, correct ? undefined : currentQuestion.value.options[selectedIndex])
    session.value.currentIndex++
  }

  function resetSession() {
    session.value = null
    resetCurrentRecitation()
  }

  return {
    session, currentIndex, currentQuestion, isFinished, totalQuestions, correctCount,
    currentRecitation, resetCurrentRecitation,
    startQuiz, startRecitation, answerQuestion, submitRecitationResult, goToPrevRecitation, resetSession,
  }
})
