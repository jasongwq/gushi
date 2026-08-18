import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useLearningStore } from '@/stores/learning'
import WrongBookPage from '@/views/WrongBookPage.vue'
import type { Poem, WrongEntry } from '@/types'

const mockPoems: Poem[] = [
  { id: 'p1', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级', text: ['床前明月光', '疑是地上霜'], textType: '五言', yiwen: '' },
  { id: 'p2', title: '咏鹅', author: '骆宾王', dynasty: '唐', grade: '一年级', text: ['鹅，鹅，鹅，', '曲项向天歌。'], textType: '五言', yiwen: '' },
]

vi.mock('@/stores/poem', () => ({
  usePoemStore: () => ({
    fetchPoems: vi.fn(),
    getPoemById: (id: string) => mockPoems.find(p => p.id === id),
    isEnabled: () => true,
  }),
}))

let pinia: ReturnType<typeof createPinia>

beforeEach(() => {
  localStorage.clear()
  pinia = createPinia()
  setActivePinia(pinia)
})

function mountPage() {
  return mount(WrongBookPage, {
    global: {
      plugins: [pinia],
      stubs: {
        Teleport: { template: '<div><slot /></div>' },
        'router-link': { template: '<a><slot /></a>' },
      },
    },
  })
}

function seed(store: ReturnType<typeof useLearningStore>, entries: Partial<WrongEntry>[]) {
  store.data = {
    records: store.data.records,
    quizResults: [],
    reciteRecords: [],
    wrongBook: entries.map(e => ({
      poemId: 'p1', quizType: 'line' as const, wrongCount: 1,
      lastWrongDate: '2026-08-18', unproficient: false, ...e,
    })) as WrongEntry[],
    settings: { enabledPoems: [], quizCount: 5, source: 'smart', quizTypes: ['fillBlank', 'nextLine'], selectedGrades: [] },
  }
}

describe('WrongBookPage', () => {
  it('groups multiple entries of same poem into one card', () => {
    const store = useLearningStore()
    seed(store, [
      { poemId: 'p1', quizType: 'fillBlank', wrongCount: 2 },
      { poemId: 'p1', quizType: 'nextLine', wrongCount: 1 },
    ])
    const wrapper = mountPage()
    const cards = wrapper.findAll('.wrong-card')
    expect(cards).toHaveLength(1)
    // 卡片内包含所有错题类型标签
    expect(wrapper.text()).toContain('补字选择')
    expect(wrapper.text()).toContain('上下句接龙')
    // 总错误次数为各条目之和
    expect(wrapper.text()).toContain('错 3 次')
  })

  it('shows all quiz type labels as separate tags', () => {
    const store = useLearningStore()
    seed(store, [
      { poemId: 'p1', quizType: 'fillBlank', wrongCount: 1 },
      { poemId: 'p1', quizType: 'recite', wrongCount: 1 },
    ])
    const wrapper = mountPage()
    const labels = wrapper.findAll('[data-testid="wrong-entry-label"]')
    expect(labels).toHaveLength(2)
    expect(labels.map(l => l.text())).toEqual(['补字选择', '背诵'])
  })

  it('formats line notes as 第 N 句·状态 in labels', () => {
    const store = useLearningStore()
    seed(store, [
      { poemId: 'p1', quizType: 'line', wrongCount: 1, note: '第1句:stuck' },
      { poemId: 'p1', quizType: 'line', wrongCount: 1, note: '第2句:forgot' },
    ])
    const wrapper = mountPage()
    const labels = wrapper.findAll('[data-testid="wrong-entry-label"]')
    expect(labels).toHaveLength(2)
    expect(labels.map(l => l.text())).toEqual(['第 1 句·卡顿', '第 2 句·不会'])
  })

  it('hides char summary badge when no char mark stats', () => {
    const store = useLearningStore()
    seed(store, [{ poemId: 'p1', quizType: 'line', wrongCount: 1 }])
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="char-summary"]').exists()).toBe(false)
  })

  it('shows char summary badge with wrong/fuzzy counts when char mark stats exist', () => {
    const store = useLearningStore()
    store.recordReciteWithCharMarks('p1', false, mockPoems[0].text, { '0-2': 'wrong', '1-1': 'fuzzy' })
    seed(store, [{ poemId: 'p1', quizType: 'line', wrongCount: 1 }])
    const wrapper = mountPage()
    const badge = wrapper.find('[data-testid="char-summary"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('错1字')
    expect(badge.text()).toContain('模糊1字')
  })

  it('hides char summary badge when stats exist but all counts are zero', () => {
    const store = useLearningStore()
    seed(store, [{ poemId: 'p1', quizType: 'line', wrongCount: 1 }])
    // 无 charMarkStats 记录，无角标
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="char-summary"]').exists()).toBe(false)
  })

  it('opens entry action menu when clicking a label', async () => {
    const store = useLearningStore()
    seed(store, [{ poemId: 'p1', quizType: 'line', wrongCount: 1 }])
    const wrapper = mountPage()
    await wrapper.find('[data-testid="wrong-entry-label"]').trigger('click')
    expect(wrapper.find('[data-testid="entry-action-menu"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="entry-mark-unproficient"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="entry-remove"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="entry-cancel"]').exists()).toBe(true)
  })

  it('shows 已标不熟练 on the mark button when entry is unproficient', async () => {
    const store = useLearningStore()
    seed(store, [{ poemId: 'p1', quizType: 'line', wrongCount: 1, unproficient: true }])
    const wrapper = mountPage()
    await wrapper.find('[data-testid="wrong-entry-label"]').trigger('click')
    const btn = wrapper.find('[data-testid="entry-mark-unproficient"]')
    expect(btn.text()).toBe('已标不熟练')
  })

  it('removes one entry but keeps the card when other entries remain', async () => {
    const store = useLearningStore()
    seed(store, [
      { poemId: 'p1', quizType: 'fillBlank', wrongCount: 2 },
      { poemId: 'p1', quizType: 'line', wrongCount: 1 },
    ])
    const wrapper = mountPage()
    // 打开第二条目的操作菜单并移除
    const labels = wrapper.findAll('[data-testid="wrong-entry-label"]')
    await labels[1].trigger('click')
    await wrapper.find('[data-testid="entry-remove"]').trigger('click')
    await wrapper.vm.$nextTick()
    // 卡片保留，且只剩一个标签
    const cards = wrapper.findAll('.wrong-card')
    expect(cards).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="wrong-entry-label"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('补字选择')
    expect(wrapper.text()).not.toContain('卡顿句')
  })

  it('opens poem popup when clicking the poem title', async () => {
    const store = useLearningStore()
    seed(store, [{ poemId: 'p1', quizType: 'line', wrongCount: 1 }])
    const wrapper = mountPage()
    await wrapper.find('[data-testid="poem-title"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('静夜思')
  })

  it('passes line statuses extracted from wrong book notes to the popup', async () => {
    const store = useLearningStore()
    seed(store, [
      { poemId: 'p1', quizType: 'line', wrongCount: 1, note: '第1句:stuck' },
      { poemId: 'p1', quizType: 'line', wrongCount: 1, note: '第2句:forgot' },
    ])
    const wrapper = mountPage()
    await wrapper.find('[data-testid="poem-title"]').trigger('click')
    await wrapper.vm.$nextTick()
    const lines = wrapper.findAll('.popup-line')
    expect(lines).toHaveLength(2)
    expect(lines[0].classes()).toContain('popup-line-stuck')
    expect(lines[0].classes()).not.toContain('popup-line-forgot')
    expect(lines[1].classes()).toContain('popup-line-forgot')
    expect(lines[1].classes()).not.toContain('popup-line-stuck')
  })

  it('removes only the clicked entry when same quizType but different note', async () => {
    const store = useLearningStore()
    seed(store, [
      { poemId: 'p1', quizType: 'line', wrongCount: 1, note: '第1句:stuck' },
      { poemId: 'p1', quizType: 'line', wrongCount: 1, note: '第2句:forgot' },
    ])
    const wrapper = mountPage()
    // 点击第一个标签（第1句:stuck）并移除
    const labels = wrapper.findAll('[data-testid="wrong-entry-label"]')
    await labels[0].trigger('click')
    await wrapper.find('[data-testid="entry-remove"]').trigger('click')
    await wrapper.vm.$nextTick()
    // 只剩一个标签，且是第2句:forgot 的条目
    expect(store.data.wrongBook).toHaveLength(1)
    expect(store.data.wrongBook[0].note).toBe('第2句:forgot')
    expect(wrapper.findAll('[data-testid="wrong-entry-label"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('第 2 句·不会')
    expect(wrapper.text()).not.toContain('第 1 句·卡顿')
  })
})
