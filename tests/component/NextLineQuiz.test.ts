import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import NextLineQuiz from '@/components/NextLineQuiz.vue'
import type { QuizQuestion } from '@/types'

const mockQuestion: QuizQuestion = {
  poemId: 'p1',
  quizType: 'nextLine',
  prompt: '春眠不觉晓\n→ 下句是？',
  options: ['处处闻啼鸟', '床前明月光', '疑是地上霜', '举头望明月', '低头思故乡', '花落知多少'],
  correctIndex: 0,
}

describe('NextLineQuiz', () => {
  it('renders 6 options', () => {
    setActivePinia(createPinia())
    const wrapper = mount(NextLineQuiz, {
      props: { question: mockQuestion },
      global: { plugins: [createPinia()] },
    })
    const buttons = wrapper.findAll('.option-btn')
    expect(buttons.length).toBe(6)
  })

  it('emits answer when option clicked', () => {
    setActivePinia(createPinia())
    const wrapper = mount(NextLineQuiz, {
      props: { question: mockQuestion },
      global: { plugins: [createPinia()] },
    })
    wrapper.findAll('.option-btn')[2].trigger('click')
    expect(wrapper.emitted('answer')![0]).toEqual([2])
  })
})
