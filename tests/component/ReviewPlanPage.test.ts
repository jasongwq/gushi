import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useLearningStore } from '@/stores/learning'
import ReviewPlanPage from '@/views/ReviewPlanPage.vue'
import type { Poem, LearningRecord } from '@/types'

const mockPoems: Poem[] = [
  { id: 'p001', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级', text: ['床前明月光'], textType: '五言', yiwen: '' },
  { id: 'p002', title: '咏鹅', author: '骆宾王', dynasty: '唐', grade: '一年级', text: ['鹅鹅鹅'], textType: '其他', yiwen: '' },
]

// 可变的 poem store mock 状态
let poems = [...mockPoems]
let loading = false

vi.mock('@/stores/poem', () => ({
  usePoemStore: () => ({
    poems,
    loading,
    enabledPoems: poems,
    fetchPoems: vi.fn(async () => {}),
    getPoemById: (id: string) => poems.find(p => p.id === id),
  }),
}))

const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

let pinia: ReturnType<typeof createPinia>

beforeEach(() => {
  localStorage.clear()
  poems = [...mockPoems]
  loading = false
  pushMock.mockClear()
  pinia = createPinia()
  setActivePinia(pinia)
})

function mountPage() {
  return mount(ReviewPlanPage, {
    global: {
      plugins: [pinia],
      stubs: {
        'router-link': { template: '<a><slot /></a>' },
      },
    },
  })
}

function makeRecord(poemId: string, nextReviewDate: string, overrides: Partial<LearningRecord> = {}): LearningRecord {
  return {
    poemId, lastReviewDate: '2026-08-01', reviewCount: 1,
    nextReviewDate, correctness: [1], reciteCorrectness: [],
    charMarkStats: [], masteryLevel: '学',
    unproficient: false, unproficientCorrectStreak: 0,
    ...overrides,
  }
}

describe('ReviewPlanPage', () => {
  it('renders title and subtitle', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('复习计划')
    expect(wrapper.text()).toContain('未来 30 天复习安排')
  })

  it('shows loading state when poems are loading', async () => {
    loading = true
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('加载中…')
    expect(wrapper.text()).not.toContain('暂无复习安排')
  })

  it('shows empty state when no poems data', async () => {
    poems = []
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('暂无复习安排')
  })

  it('shows today section expanded by default with reason tags', async () => {
    const store = useLearningStore()
    store.data.records = [makeRecord('p001', '2026-08-20', { unproficient: true })]
    const wrapper = mountPage()
    await flushPromises()
    // 今天区块标题
    expect(wrapper.text()).toContain('今天')
    // 今天的诗：p001 不熟练
    expect(wrapper.text()).toContain('不熟练')
    // 未学的 p002 是"新增学习"
    expect(wrapper.text()).toContain('新增学习')
  })

  it('shows reason tags for due poem on a future day when expanded', async () => {
    const store = useLearningStore()
    store.data.records = [makeRecord('p001', '2026-08-20')]
    const wrapper = mountPage()
    await flushPromises()
    // 未来某天有 due 诗，默认折叠（看不到诗名）
    expect(wrapper.text()).not.toContain('到期复习')
    // 但日期标题可见（如 08-20）
    expect(wrapper.text()).toContain('08-20')
  })

  it('toggles calc tip on clicking the help icon', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).not.toContain('复习计划按以下规则计算')
    await wrapper.find('h2 span').trigger('click')
    expect(wrapper.text()).toContain('复习计划按以下规则计算')
    await wrapper.find('h2 span').trigger('click')
    expect(wrapper.text()).not.toContain('复习计划按以下规则计算')
  })

  it('expands and collapses a future day when clicking the day header', async () => {
    const store = useLearningStore()
    store.data.records = [makeRecord('p001', '2026-08-20')]
    const wrapper = mountPage()
    await flushPromises()
    // 点击包含 08-20 的日期标题展开
    const dayHeader = wrapper.findAll('.p-3.bg-white').find(d => d.text().includes('08-20'))
    expect(dayHeader).toBeDefined()
    await dayHeader!.trigger('click')
    expect(wrapper.text()).toContain('到期复习')
    // 再点折叠
    await dayHeader!.trigger('click')
    expect(wrapper.text()).not.toContain('到期复习')
  })

  it('shows multiple reason tags for the same poem', async () => {
    const store = useLearningStore()
    // p002 逾期未复习 + 不熟练 → 今天同时命中 due 和 unproficient
    store.data.records = [makeRecord('p002', '2026-08-01', { unproficient: true })]
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('到期复习')
    expect(wrapper.text()).toContain('不熟练')
  })

  it('navigates to poem detail when clicking a poem', async () => {
    const store = useLearningStore()
    store.data.records = [makeRecord('p001', '2026-08-01')]
    const wrapper = mountPage()
    await flushPromises()
    // 用 poem item 的具体 class 精确定位（避免匹配到外层 day header）
    const poemItem = wrapper.find('.flex.items-center.gap-2')
    expect(poemItem.exists()).toBe(true)
    await poemItem.trigger('click')
    expect(pushMock).toHaveBeenCalledWith({ name: 'poem-detail', params: { id: 'p001' } })
  })
})
