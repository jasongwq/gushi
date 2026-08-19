import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useLearningStore } from '@/stores/learning'
import ReviewPlanPage from '@/views/ReviewPlanPage.vue'
import type { Poem, LearningRecord } from '@/types'

const mockPoems: Poem[] = [
  { id: 'p001', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级', text: ['床前明月光'], textType: '五言', yiwen: '' },
  { id: 'p002', title: '咏鹅', author: '骆宾王', dynasty: '唐', grade: '一年级', text: ['鹅鹅鹅'], textType: '其他', yiwen: '' },
  { id: 'p003', title: '春晓', author: '孟浩然', dynasty: '唐', grade: '二年级', text: ['春眠不觉晓'], textType: '五言', yiwen: '' },
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

  it('auto-generates schedule on first visit with default pace', async () => {
    const store = useLearningStore()
    const wrapper = mountPage()
    await flushPromises()
    // 首次进入无排程 → 自动生成，今天应有新增学习的诗
    expect(store.getSchedule()).not.toEqual({})
    expect(wrapper.text()).toContain('新增学习')
  })

  it('shows pace selector and rebuild button', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.text()).toContain('重排')
  })

  it('rebuild reschedules unlearned poems from today', async () => {
    const store = useLearningStore()
    // 预先设置一个"错误"的排程
    store.setSchedule({ p001: '2030-01-01' })
    const wrapper = mountPage()
    await flushPromises()
    // 点重排
    await wrapper.findAll('button').find(b => b.text().includes('重排'))!.trigger('click')
    await flushPromises()
    // 排程被重建，p001 应在今天（每天3首，第1首）
    const today = new Date().toISOString().slice(0, 10)
    expect(store.getSchedule()['p001']).toBe(today)
  })

  it('shows learned marker for scheduled poems with records', async () => {
    const store = useLearningStore()
    store.data.records = [makeRecord('p001', '2026-08-20')]
    store.setSchedule({ p001: new Date().toISOString().slice(0, 10) })
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('已学')
  })

  it('shows today section expanded by default', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('今天')
    expect(wrapper.text()).toContain('新增学习')
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

  it('shows not-learned section with unlearned poems', async () => {
    const wrapper = mountPage()
    await flushPromises()
    // 切换为每天1首并重排后，3 首诗排到今天/明天/后天
    const select = wrapper.find('select')
    await select.setValue('1')
    await wrapper.findAll('button').find(b => b.text().includes('重排'))!.trigger('click')
    await flushPromises()
    // 未学区块存在
    expect(wrapper.text()).toContain('未学')
  })

  it('navigates to poem detail when clicking a poem', async () => {
    const store = useLearningStore()
    store.setSchedule({ p001: new Date().toISOString().slice(0, 10) })
    const wrapper = mountPage()
    await flushPromises()
    // 用诗行的精确 class 定位（选择器行也有 flex items-center gap-2）
    const poemItem = wrapper.find('.hover\\:bg-gray-50')
    expect(poemItem.exists()).toBe(true)
    await poemItem.trigger('click')
    expect(pushMock).toHaveBeenCalledWith({ name: 'poem-detail', params: { id: 'p001' } })
  })

  it('opens batch config and marks poems as learned', async () => {
    const store = useLearningStore()
    const wrapper = mountPage()
    await flushPromises()
    // 打开批量配置
    await wrapper.findAll('button').find(b => b.text().includes('批量配置'))!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('批量配置已学')
    // 勾选第一首并确认
    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.trigger('change')
    await wrapper.findAll('button').find(b => b.text().includes('确认标记'))!.trigger('click')
    await flushPromises()
    // 该诗已有学习记录
    const learned = store.records.filter(r => r.reviewCount === 0)
    expect(learned.length).toBeGreaterThan(0)
  })

  it('cancel closes batch config without changes', async () => {
    const store = useLearningStore()
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text().includes('批量配置'))!.trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text() === '取消')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('批量配置已学')
    expect(store.records.length).toBe(0)
  })
})
