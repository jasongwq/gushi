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
})
