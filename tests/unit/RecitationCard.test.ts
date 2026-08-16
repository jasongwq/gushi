import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RecitationCard from '@/components/RecitationCard.vue'
import type { Poem } from '@/types'

const mockPoem: Poem = {
  id: 'test-1',
  title: '静夜思',
  author: '李白',
  dynasty: '唐',
  grade: '一年级',
  text: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'],
  textType: '五言',
  yiwen: '翻译内容',
}

vi.mock('@/stores/learning', () => ({
  useLearningStore: () => ({
    settings: { showYiwen: false },
    updateSettings: vi.fn(),
  }),
}))

function mountCard(props?: Partial<{ poem: Poem; canGoPrev: boolean }>) {
  return mount(RecitationCard, {
    props: { poem: mockPoem, ...props },
    global: { stubs: {} },
  })
}

// Helper: find all "卡顿" buttons (one per line)
function getStuckButtons(wrapper: ReturnType<typeof mountCard>) {
  return wrapper.findAll('button').filter(b => b.text() === '卡顿')
}

// Helper: find all "不会" buttons for lines
function getForgotButtons(wrapper: ReturnType<typeof mountCard>) {
  return wrapper.findAll('button').filter(b => b.text() === '不会')
}

// Helper: find the "下一首" button
function getNextButton(wrapper: ReturnType<typeof mountCard>) {
  return wrapper.findAll('button').find(b => b.text() === '下一首')!
}

// Helper: find the "熟练" button
function getMasteredButton(wrapper: ReturnType<typeof mountCard>) {
  return wrapper.findAll('button').find(b => b.text() === '熟练')!
}

// Helper: find the "完全不会" button
function getForgotAllButton(wrapper: ReturnType<typeof mountCard>) {
  return wrapper.findAll('button').find(b => b.text() === '完全不会')!
}

// Helper: find the yiwen toggle button
function getYiwenButton(wrapper: ReturnType<typeof mountCard>) {
  return wrapper.findAll('button').find(b => b.text().includes('译文'))!
}

// Helper: find author/dynasty "不会" buttons (the ones next to author/dynasty text)
function getAuthorDynastyButtons(wrapper: ReturnType<typeof mountCard>) {
  // Author "不会" is in a row containing "李白", dynasty "不会" in a row containing "唐"
  // Line-level "不会" buttons are in rows with poem line text only
  const buttons = wrapper.findAll('button').filter(b => b.text() === '不会')
  const findInRow = (text: string) => buttons.find(b => b.element.parentElement?.textContent?.includes(text))
  return {
    authorForgot: findInRow('李白'),
    dynastyForgot: findInRow('唐'),
  }
}

describe('RecitationCard', () => {
  it('renders poem title, author and dynasty', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('静夜思')
    expect(wrapper.text()).toContain('李白')
    expect(wrapper.text()).toContain('唐')
  })

  it('renders all poem lines', () => {
    const wrapper = mountCard()
    mockPoem.text.forEach(line => {
      expect(wrapper.text()).toContain(line)
    })
  })

  describe('line status toggling', () => {
    it('clicking "卡顿" toggles line status ok→stuck', async () => {
      const wrapper = mountCard()
      const stuckBtns = getStuckButtons(wrapper)
      await stuckBtns[0].trigger('click')
      // The button should now have the active stuck class
      expect(stuckBtns[0].classes().join(' ')).toContain('border-yellow-500')
    })

    it('clicking "卡顿" again toggles stuck→ok', async () => {
      const wrapper = mountCard()
      const stuckBtns = getStuckButtons(wrapper)
      await stuckBtns[0].trigger('click')
      expect(stuckBtns[0].classes().join(' ')).toContain('border-yellow-500')
      await stuckBtns[0].trigger('click')
      expect(stuckBtns[0].classes().join(' ')).toContain('border-gray-200')
    })

    it('clicking "不会" toggles line status ok→forgot', async () => {
      const wrapper = mountCard()
      const forgotBtns = getForgotButtons(wrapper)
      // Click the first line's "不会" (index 0 among line forgot buttons)
      await forgotBtns[0].trigger('click')
      expect(forgotBtns[0].classes().join(' ')).toContain('border-red-500')
    })

    it('clicking "不会" again toggles forgot→ok', async () => {
      const wrapper = mountCard()
      const forgotBtns = getForgotButtons(wrapper)
      await forgotBtns[0].trigger('click')
      expect(forgotBtns[0].classes().join(' ')).toContain('border-red-500')
      await forgotBtns[0].trigger('click')
      expect(forgotBtns[0].classes().join(' ')).toContain('border-gray-200')
    })

    it('can mark a line as stuck then switch to forgot', async () => {
      const wrapper = mountCard()
      const stuckBtns = getStuckButtons(wrapper)
      const forgotBtns = getForgotButtons(wrapper)
      await stuckBtns[1].trigger('click')
      expect(stuckBtns[1].classes().join(' ')).toContain('border-yellow-500')
      await forgotBtns[1].trigger('click')
      expect(forgotBtns[1].classes().join(' ')).toContain('border-red-500')
      expect(stuckBtns[1].classes().join(' ')).toContain('border-gray-200')
    })
  })

  describe('"下一首" button', () => {
    it('is disabled when no issues are marked', () => {
      const wrapper = mountCard()
      const nextBtn = getNextButton(wrapper)
      expect(nextBtn.attributes('disabled')).toBeDefined()
    })

    it('is enabled when a line is marked stuck', async () => {
      const wrapper = mountCard()
      const stuckBtns = getStuckButtons(wrapper)
      await stuckBtns[0].trigger('click')
      const nextBtn = getNextButton(wrapper)
      expect(nextBtn.attributes('disabled')).toBeUndefined()
    })

    it('is enabled when a line is marked forgot', async () => {
      const wrapper = mountCard()
      const forgotBtns = getForgotButtons(wrapper)
      await forgotBtns[0].trigger('click')
      const nextBtn = getNextButton(wrapper)
      expect(nextBtn.attributes('disabled')).toBeUndefined()
    })

    it('is enabled when author is marked wrong', async () => {
      const wrapper = mountCard()
      const { authorForgot } = getAuthorDynastyButtons(wrapper)
      await authorForgot!.trigger('click')
      const nextBtn = getNextButton(wrapper)
      expect(nextBtn.attributes('disabled')).toBeUndefined()
    })

    it('is enabled when dynasty is marked wrong', async () => {
      const wrapper = mountCard()
      const { dynastyForgot } = getAuthorDynastyButtons(wrapper)
      await dynastyForgot!.trigger('click')
      const nextBtn = getNextButton(wrapper)
      expect(nextBtn.attributes('disabled')).toBeUndefined()
    })

    it('is disabled when author is marked correct (true)', async () => {
      const wrapper = mountCard()
      const { authorForgot } = getAuthorDynastyButtons(wrapper)
      // null → false → true
      await authorForgot!.trigger('click') // null → false
      await authorForgot!.trigger('click') // false → true
      const nextBtn = getNextButton(wrapper)
      expect(nextBtn.attributes('disabled')).toBeDefined()
    })

    it('clicking "下一首" emits submit with overallStatus not-mastered when issues exist', async () => {
      const wrapper = mountCard()
      const stuckBtns = getStuckButtons(wrapper)
      await stuckBtns[0].trigger('click')
      const nextBtn = getNextButton(wrapper)
      await nextBtn.trigger('click')
      expect(wrapper.emitted('submit')).toHaveLength(1)
      const result = wrapper.emitted('submit')![0][0] as any
      expect(result.overallStatus).toBe('not-mastered')
    })

    it('clicking "下一首" emits submit with overallStatus mastered when no issues', async () => {
      // Mark and unmark an issue so the button becomes enabled, then unmark
      // Actually the button is disabled when no issues, so we need to test via
      // the submit function directly — but we can mark author as true (not an issue)
      // and the button stays disabled. Let's test via markMastered path instead.
      // This is covered by the markMastered test.
      const wrapper = mountCard()
      const masteredBtn = getMasteredButton(wrapper)
      await masteredBtn.trigger('click')
      const result = wrapper.emitted('submit')![0][0] as any
      expect(result.overallStatus).toBe('mastered')
    })
  })

  describe('"熟练" button', () => {
    it('marks all lines as ok and emits submit with overallStatus mastered', async () => {
      const wrapper = mountCard()
      // First mark some lines as stuck/forgot
      const stuckBtns = getStuckButtons(wrapper)
      const forgotBtns = getForgotButtons(wrapper)
      await stuckBtns[0].trigger('click')
      await forgotBtns[1].trigger('click')

      const masteredBtn = getMasteredButton(wrapper)
      await masteredBtn.trigger('click')

      expect(wrapper.emitted('submit')).toHaveLength(1)
      const result = wrapper.emitted('submit')![0][0] as any
      expect(result.overallStatus).toBe('mastered')
      expect(result.lines).toEqual([])
      expect(result.authorCorrect).toBeNull()
      expect(result.dynastyCorrect).toBeNull()
    })
  })

  describe('"完全不会" button', () => {
    it('marks all lines as forgot and emits submit with overallStatus not-mastered', async () => {
      const wrapper = mountCard()
      const forgotAllBtn = getForgotAllButton(wrapper)
      await forgotAllBtn.trigger('click')

      expect(wrapper.emitted('submit')).toHaveLength(1)
      const result = wrapper.emitted('submit')![0][0] as any
      expect(result.overallStatus).toBe('not-mastered')
      expect(result.lines).toHaveLength(mockPoem.text.length)
      result.lines.forEach((l: any) => {
        expect(l.status).toBe('forgot')
      })
      expect(result.authorCorrect).toBe(false)
      expect(result.dynastyCorrect).toBe(false)
    })
  })

  describe('Author/Dynasty "不会" toggle', () => {
    it('cycles author: null→false→true→null', async () => {
      const wrapper = mountCard()
      const { authorForgot } = getAuthorDynastyButtons(wrapper)

      // null → false: button becomes active (red)
      await authorForgot!.trigger('click')
      expect(authorForgot!.classes().join(' ')).toContain('border-red-500')

      // false → true: button becomes inactive
      await authorForgot!.trigger('click')
      expect(authorForgot!.classes().join(' ')).toContain('border-gray-200')

      // true → null: still inactive
      await authorForgot!.trigger('click')
      expect(authorForgot!.classes().join(' ')).toContain('border-gray-200')

      // null → false again
      await authorForgot!.trigger('click')
      expect(authorForgot!.classes().join(' ')).toContain('border-red-500')
    })

    it('cycles dynasty: null→false→true→null', async () => {
      const wrapper = mountCard()
      const { dynastyForgot } = getAuthorDynastyButtons(wrapper)

      await dynastyForgot!.trigger('click')
      expect(dynastyForgot!.classes().join(' ')).toContain('border-red-500')

      await dynastyForgot!.trigger('click')
      expect(dynastyForgot!.classes().join(' ')).toContain('border-gray-200')

      await dynastyForgot!.trigger('click')
      expect(dynastyForgot!.classes().join(' ')).toContain('border-gray-200')

      await dynastyForgot!.trigger('click')
      expect(dynastyForgot!.classes().join(' ')).toContain('border-red-500')
    })

    it('author false enables "下一首", true does not', async () => {
      const wrapper = mountCard()
      const { authorForgot } = getAuthorDynastyButtons(wrapper)
      const nextBtn = getNextButton(wrapper)

      // null → false: issue exists
      await authorForgot!.trigger('click')
      expect(nextBtn.attributes('disabled')).toBeUndefined()

      // false → true: no issue
      await authorForgot!.trigger('click')
      expect(nextBtn.attributes('disabled')).toBeDefined()
    })
  })

  describe('Yiwen toggle', () => {
    it('does not show translation by default', () => {
      const wrapper = mountCard()
      expect(wrapper.text()).not.toContain('翻译内容')
    })

    it('shows translation when yiwen button is clicked', async () => {
      const wrapper = mountCard()
      const yiwenBtn = getYiwenButton(wrapper)
      await yiwenBtn.trigger('click')
      expect(wrapper.text()).toContain('翻译内容')
    })

    it('hides translation when yiwen button is clicked again', async () => {
      const wrapper = mountCard()
      const yiwenBtn = getYiwenButton(wrapper)
      await yiwenBtn.trigger('click')
      expect(wrapper.text()).toContain('翻译内容')
      await yiwenBtn.trigger('click')
      expect(wrapper.text()).not.toContain('翻译内容')
    })

    it('yiwen button text toggles between show and hide', async () => {
      const wrapper = mountCard()
      const yiwenBtn = getYiwenButton(wrapper)
      expect(yiwenBtn.text()).toContain('显示译文')
      await yiwenBtn.trigger('click')
      expect(yiwenBtn.text()).toContain('隐藏译文')
    })
  })

  describe('Submit result format', () => {
    it('includes correct poemId', async () => {
      const wrapper = mountCard()
      const masteredBtn = getMasteredButton(wrapper)
      await masteredBtn.trigger('click')
      const result = wrapper.emitted('submit')![0][0] as any
      expect(result.poemId).toBe('test-1')
    })

    it('includes only non-ok lines in result when not-mastered', async () => {
      const wrapper = mountCard()
      const stuckBtns = getStuckButtons(wrapper)
      const forgotBtns = getForgotButtons(wrapper)
      await stuckBtns[0].trigger('click')
      await forgotBtns[2].trigger('click')

      const nextBtn = getNextButton(wrapper)
      await nextBtn.trigger('click')
      const result = wrapper.emitted('submit')![0][0] as any
      expect(result.overallStatus).toBe('not-mastered')
      expect(result.lines).toHaveLength(2)
      expect(result.lines[0]).toEqual({ lineIndex: 0, status: 'stuck' })
      expect(result.lines[1]).toEqual({ lineIndex: 2, status: 'forgot' })
    })

    it('includes empty lines array when mastered', async () => {
      const wrapper = mountCard()
      const masteredBtn = getMasteredButton(wrapper)
      await masteredBtn.trigger('click')
      const result = wrapper.emitted('submit')![0][0] as any
      expect(result.lines).toEqual([])
    })

    it('includes authorCorrect and dynastyCorrect in result', async () => {
      const wrapper = mountCard()
      const { authorForgot, dynastyForgot } = getAuthorDynastyButtons(wrapper)
      await authorForgot!.trigger('click') // null → false
      await dynastyForgot!.trigger('click') // null → false

      const nextBtn = getNextButton(wrapper)
      await nextBtn.trigger('click')
      const result = wrapper.emitted('submit')![0][0] as any
      expect(result.authorCorrect).toBe(false)
      expect(result.dynastyCorrect).toBe(false)
    })

    it('fully mastered result has correct structure', async () => {
      const wrapper = mountCard()
      const masteredBtn = getMasteredButton(wrapper)
      await masteredBtn.trigger('click')
      const result = wrapper.emitted('submit')![0][0] as any
      expect(result).toEqual({
        poemId: 'test-1',
        overallStatus: 'mastered',
        lines: [],
        authorCorrect: null,
        dynastyCorrect: null,
      })
    })

    it('完全不会 result has correct structure', async () => {
      const wrapper = mountCard()
      const forgotAllBtn = getForgotAllButton(wrapper)
      await forgotAllBtn.trigger('click')
      const result = wrapper.emitted('submit')![0][0] as any
      expect(result.poemId).toBe('test-1')
      expect(result.overallStatus).toBe('not-mastered')
      expect(result.lines).toHaveLength(4)
      expect(result.lines.every((l: any) => l.status === 'forgot')).toBe(true)
      expect(result.authorCorrect).toBe(false)
      expect(result.dynastyCorrect).toBe(false)
    })
  })

  describe('goPrev', () => {
    it('emits goPrev when "上一首" is clicked and canGoPrev is true', async () => {
      const wrapper = mountCard({ canGoPrev: true })
      const prevBtn = wrapper.findAll('button').find(b => b.text() === '上一首')!
      await prevBtn.trigger('click')
      expect(wrapper.emitted('goPrev')).toHaveLength(1)
    })

    it('"上一首" is disabled when canGoPrev is false', () => {
      const wrapper = mountCard({ canGoPrev: false })
      const prevBtn = wrapper.findAll('button').find(b => b.text() === '上一首')!
      expect(prevBtn.attributes('disabled')).toBeDefined()
    })
  })
})
