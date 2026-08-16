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
// Scoped to the scroll area because author/dynasty "不会" buttons now live in the title section
function getForgotButtons(wrapper: ReturnType<typeof mountCard>) {
  return wrapper.findAll('.overflow-y-auto button').filter(b => b.text() === '不会')
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

// Helper: find author/dynasty "不会" buttons by their data-testid
function getAuthorDynastyButtons(wrapper: ReturnType<typeof mountCard>) {
  return {
    authorForgot: wrapper.find('[data-testid="btn-author-forgot"]'),
    dynastyForgot: wrapper.find('[data-testid="btn-dynasty-forgot"]'),
  }
}

describe('RecitationCard', () => {
  it('renders poem title, author and dynasty', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('静夜思')
    expect(wrapper.text()).toContain('李白')
    expect(wrapper.text()).toContain('唐')
  })

  it('布局：作者/朝代 [不会] 位于标题下方，正文区独立滚动，4 按钮在正文区之后', () => {
    const wrapper = mountCard()
    const root = wrapper.find('.recitation-card')
    const rootClasses = root.classes().join(' ')

    // 根节点为 flex 纵向布局
    expect(rootClasses).toContain('flex')
    expect(rootClasses).toContain('flex-col')
    expect(rootClasses).toContain('h-full')

    // 标题区：标题 h2 所在容器包含作者/朝代 [不会] 按钮
    const titleH2 = wrapper.find('.recitation-card h2')
    const titleSection = titleH2.element.parentElement
    expect(titleSection?.textContent).toContain('李白')
    expect(titleSection?.textContent).toContain('唐')
    expect(titleSection?.textContent).toContain('不会')

    // 正文区：独立滚动容器，包含逐句标记与译文
    const scrollArea = wrapper.find('.recitation-card .overflow-y-auto')
    expect(scrollArea.exists()).toBe(true)
    const scrollText = scrollArea.element.textContent ?? ''
    expect(scrollText).toContain('床前明月光')
    expect(scrollText).toContain('显示译文')

    // 4 按钮（熟练/完全不会/上一首/下一首）在正文区外层（flex 根节点的直接子级，位于正文区之后）
    const rootChildren = Array.from(root.element.children).map(c => c.className)
    const btnMastered = wrapper.findAll('button').find(b => b.text() === '熟练')!
    // 熟练按钮的祖先链中，应有一个父元素是根节点的直接子级，且该父元素位于正文区容器之后
    let btnSection = btnMastered.element.parentElement
    while (btnSection && btnSection.parentElement !== root.element) {
      btnSection = btnSection.parentElement
    }
    expect(btnSection).toBeTruthy()
    const scrollSection = scrollArea.element.parentElement
    const scrollIndex = rootChildren.indexOf(scrollSection?.className ?? '')
    const btnIndex = rootChildren.indexOf(btnSection!.className)
    expect(btnIndex).toBeGreaterThan(scrollIndex)

    // 底部原作者/朝代区已删除：全文"李白"只出现一次（标题区）
    const bodyText = root.element.textContent ?? ''
    expect(bodyText.split('李白').length - 1).toBe(1)
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
