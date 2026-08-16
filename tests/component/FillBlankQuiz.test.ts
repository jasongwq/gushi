import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FillBlankQuiz from '@/components/FillBlankQuiz.vue'
import type { QuizQuestion } from '@/types'

const mockQuestion: QuizQuestion = {
  poemId: 'p1',
  quizType: 'fillBlank',
  prompt: '春眠不觉晓\n处处闻啼鸟',
  options: ['晓', '鸟', '花', '月', '风', '雨'],
  correctIndex: 0,
  blankPositions: [4],
}

describe('FillBlankQuiz', () => {
  it('renders 6 options', () => {
    setActivePinia(createPinia())
    const wrapper = mount(FillBlankQuiz, {
      props: { question: mockQuestion },
      global: { plugins: [createPinia()] },
    })
    const buttons = wrapper.findAll('.option-btn')
    expect(buttons.length).toBe(6)
  })

  it('emits answer when option clicked', () => {
    setActivePinia(createPinia())
    const wrapper = mount(FillBlankQuiz, {
      props: { question: mockQuestion },
      global: { plugins: [createPinia()] },
    })
    wrapper.findAll('.option-btn')[0].trigger('click')
    expect(wrapper.emitted('answer')).toBeTruthy()
    expect(wrapper.emitted('answer')![0]).toEqual([0])
  })

  it('shows blanks in poem text', () => {
    setActivePinia(createPinia())
    const wrapper = mount(FillBlankQuiz, {
      props: { question: mockQuestion },
      global: { plugins: [createPinia()] },
    })
    const poemText = wrapper.find('.poem-text')
    expect(poemText.text()).toContain('____')
    expect(poemText.text()).toContain('处处闻啼鸟')
  })

  it('renders full text when no blankPositions', () => {
    setActivePinia(createPinia())
    const noBlankQuestion: QuizQuestion = {
      poemId: 'p1',
      quizType: 'fillBlank',
      prompt: '春眠不觉晓\n处处闻啼鸟',
      options: ['晓', '鸟', '花', '月', '风', '雨'],
      correctIndex: 0,
    }
    const wrapper = mount(FillBlankQuiz, {
      props: { question: noBlankQuestion },
      global: { plugins: [createPinia()] },
    })
    const poemText = wrapper.find('.poem-text')
    expect(poemText.text()).toContain('春眠不觉晓')
    expect(poemText.text()).toContain('处处闻啼鸟')
  })

  it('highlights correct option green when selectedOption is set', () => {
    setActivePinia(createPinia())
    const wrapper = mount(FillBlankQuiz, {
      props: { question: mockQuestion, selectedOption: 0 },
      global: { plugins: [createPinia()] },
    })
    // correctIndex is 0, selectedOption is 0 → correct
    const correctBtn = wrapper.findAll('.option-btn')[0]
    expect(correctBtn.classes()).toContain('option-correct')
  })

  it('highlights wrong option red and correct option green', () => {
    setActivePinia(createPinia())
    const wrapper = mount(FillBlankQuiz, {
      props: { question: mockQuestion, selectedOption: 1 },
      global: { plugins: [createPinia()] },
    })
    // correctIndex is 0, selectedOption is 1 → wrong
    const wrongBtn = wrapper.findAll('.option-btn')[1]
    const correctBtn = wrapper.findAll('.option-btn')[0]
    expect(wrongBtn.classes()).toContain('option-wrong')
    expect(correctBtn.classes()).toContain('option-correct')
  })

  it('disables options when disabled prop is true', () => {
    setActivePinia(createPinia())
    const wrapper = mount(FillBlankQuiz, {
      props: { question: mockQuestion, selectedOption: 0, disabled: true },
      global: { plugins: [createPinia()] },
    })
    // The selected option should NOT be disabled (it's already highlighted)
    // Other options should be disabled
    const buttons = wrapper.findAll('.option-btn')
    expect((buttons[0].element as HTMLButtonElement).disabled).toBe(false)
    expect((buttons[1].element as HTMLButtonElement).disabled).toBe(true)
  })
})
