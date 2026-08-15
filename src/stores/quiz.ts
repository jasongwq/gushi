import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { QuizQuestion, QuizSession, QuizType, SourceType, Poem } from '@/types'
import { smartMix, getPoemsBySource, getReviewPoems, getWrongPoems, getUnproficientPoems, shuffleArray } from '@/utils/quiz'
import { generateFillBlankOptions, generateNextLineOptions } from '@/utils/distractor'
import { usePoemStore } from './poem'
import { useLearningStore } from './learning'

export const useQuizStore = defineStore('quiz', () => {
  const session = ref<QuizSession | null>(null)
  const currentIndex = computed(() => session.value?.currentIndex ?? 0)
  const currentQuestion = computed(() => session.value?.questions[session.value.currentIndex] ?? null)
  const isFinished = computed(() => session.value ? session.value.currentIndex >= session.value.questions.length : false)
  const totalQuestions = computed(() => session.value?.questions.length ?? 0)
  const correctCount = computed(() => session.value?.answers.filter(a => a.correct).length ?? 0)

  function generateQuestions(poemIds: string[], quizTypes: QuizType[]): QuizQuestion[] {
    const poemStore = usePoemStore()
    const questions: QuizQuestion[] = []
    for (const poemId of poemIds) {
      const poem = poemStore.getPoemById(poemId)
      if (!poem) continue
      for (const quizType of quizTypes) {
        questions.push(generateQuestion(poem, quizType, poemStore.poems))
      }
    }
    return shuffleArray(questions)
  }

  function generateQuestion(poem: Poem, quizType: QuizType, allPoems: Poem[]): QuizQuestion {
    switch (quizType) {
      case 'fillBlank': {
        const fullText = poem.text.join('')
        const chars = [...fullText.replace(/[，。、！？；：""''（）\s]/g, '')]
        const blankCount = Math.min(3, Math.max(1, Math.floor(chars.length / 5)))
        const positions = shuffleArray(chars.map((_, i) => i)).slice(0, blankCount).sort((a, b) => a - b)
        const blankChar = chars[positions[0]]
        const prompt = poem.text.join('\n')
        const options = generateFillBlankOptions(poem, allPoems, blankChar, 0)
        return {
          poemId: poem.id, quizType: 'fillBlank', prompt, options,
          correctIndex: options.indexOf(blankChar), blankPositions: positions,
        }
      }
      case 'nextLine': {
        const isForward = Math.random() > 0.5
        const lineIndex = Math.floor(Math.random() * (poem.text.length - 1))
        const givenLine = isForward ? poem.text[lineIndex] : poem.text[lineIndex + 1]
        const correctLine = isForward ? poem.text[lineIndex + 1] : poem.text[lineIndex]
        const options = generateNextLineOptions(poem, allPoems, correctLine, poem.grade)
        return {
          poemId: poem.id, quizType: 'nextLine',
          prompt: `${givenLine}\n${isForward ? '→ 下句是？' : '→ 上句是？'}`,
          options, correctIndex: options.indexOf(correctLine),
        }
      }
      default:
        // recite is v2, fallback to nextLine
        return generateQuestion(poem, 'nextLine', allPoems)
    }
  }

  function startQuiz(source: SourceType, quizTypes: QuizType[], count: number, grades?: string[]) {
    const poemStore = usePoemStore()
    const learningStore = useLearningStore()
    const today = new Date().toISOString().split('T')[0]

    let selectedPoems: Poem[]
    if (source === 'smart') {
      selectedPoems = smartMix(poemStore.poems, learningStore.records, learningStore.wrongBook, count, today)
    } else if (source === 'review') {
      selectedPoems = shuffleArray(getReviewPoems(poemStore.poems, learningStore.records, today)).slice(0, count)
    } else if (source === 'wrong') {
      selectedPoems = shuffleArray(getWrongPoems(poemStore.poems, learningStore.wrongBook)).slice(0, count)
    } else if (source === 'unproficient') {
      selectedPoems = shuffleArray(getUnproficientPoems(poemStore.poems, learningStore.records)).slice(0, count)
    } else {
      selectedPoems = getPoemsBySource(poemStore.poems, source, today, { grades })
      selectedPoems = shuffleArray(selectedPoems).slice(0, count)
    }

    const questions = generateQuestions(selectedPoems.map(p => p.id), quizTypes)
    session.value = {
      source, quizTypes, questions, currentIndex: 0, answers: [],
      startTime: new Date().toISOString(),
    }
  }

  function answerQuestion(selectedIndex: number) {
    if (!session.value || !currentQuestion.value) return
    const correct = selectedIndex === currentQuestion.value.correctIndex
    session.value.answers.push({ questionIndex: session.value.currentIndex, selectedIndex, correct })
    const learningStore = useLearningStore()
    learningStore.recordAnswer(currentQuestion.value.poemId, currentQuestion.value.quizType, correct, correct ? undefined : currentQuestion.value.options[selectedIndex])
    session.value.currentIndex++
  }

  function resetSession() { session.value = null }

  return {
    session, currentIndex, currentQuestion, isFinished, totalQuestions, correctCount,
    startQuiz, answerQuestion, resetSession,
  }
})
