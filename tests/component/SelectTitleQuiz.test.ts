import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SelectTitleQuiz from '@/components/SelectTitleQuiz.vue'
import type { QuizQuestion } from '@/types'

const mockQuestion: QuizQuestion = {
  poemId: 'p1',
  quizType: 'selectTitle',
  prompt: '春眠不觉晓\n处处闻啼鸟\n夜来风雨声\n花落知多少\n\n这首诗的诗名是？',
  options: ['春晓', '静夜思', '咏鹅', '画', '悯农', '风'],
  correctIndex: 0,
}

describe('SelectTitleQuiz', () => {
  it('renders 6 options', () => {
    setActivePinia(createPinia())
    const wrapper = mount(SelectTitleQuiz, {
      props: { question: mockQuestion },
      global: { plugins: [createPinia()] },
    })
    const buttons = wrapper.findAll('.option-btn')
    expect(buttons.length).toBe(6)
  })

  it('emits answer when option clicked', () => {
    setActivePinia(createPinia())
    const wrapper = mount(SelectTitleQuiz, {
      props: { question: mockQuestion },
      global: { plugins: [createPinia()] },
    })
    wrapper.findAll('.option-btn')[0].trigger('click')
    expect(wrapper.emitted('answer')![0]).toEqual([0])
  })
})
