import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PoemCardPage from '@/views/PoemCardPage.vue'

const mockPoems = [
  { id: 'p1', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级', text: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'], textType: '五言' as const, yiwen: '译' },
  { id: 'p2', title: '春晓', author: '孟浩然', dynasty: '唐', grade: '一年级', text: ['春眠不觉晓', '处处闻啼鸟', '夜来风雨声', '花落知多少'], textType: '五言' as const, yiwen: '译' },
]

vi.mock('@/stores/poem', () => ({
  usePoemStore: () => ({
    fetchPoems: vi.fn(),
    enabledPoems: mockPoems,
    grades: ['一年级'],
  }),
}))

vi.mock('@/stores/learning', () => ({
  useLearningStore: () => ({
    settings: { showYiwen: false },
    updateSettings: vi.fn(),
    recordAnswer: vi.fn(),
    records: {},
    wrongBook: [],
    charMarks: {},
    initCharMarks: vi.fn(),
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {} }),
}))

function mountPage() {
  setActivePinia(createPinia())
  return mount(PoemCardPage, {
    global: { plugins: [createPinia()], stubs: {} },
  })
}

describe('PoemCardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mounts with swiper mode and poem cards', async () => {
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.poem-card-page').exists()).toBe(true)
    expect(wrapper.find('.poem-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('点击卡片进入详情')
  })

  it('clicking a poem card enters recite mode', async () => {
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    const card = wrapper.find('.poem-card')
    expect(card.exists()).toBe(true)
    await card.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.recitation-card').exists()).toBe(true)
    expect(wrapper.find('[data-testid="recite-back"]').exists()).toBe(true)
  })

  it('recite mode shows progress and hides mode-switch buttons', async () => {
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    await wrapper.find('.poem-card').trigger('click')
    await wrapper.vm.$nextTick()
    // 背诵模式显示进度 testid
    expect(wrapper.find('[data-testid="detail-progress"]').exists()).toBe(true)
    // 背诵模式隐藏模式切换按钮（📇 滑动 / 🎁 盲盒）
    expect(wrapper.text()).not.toContain('📇 滑动')
    expect(wrapper.text()).not.toContain('🎁 盲盒')
    // 顶部返回条存在
    expect(wrapper.find('[data-testid="recite-back"]').exists()).toBe(true)
  })

  it('recite back button returns to browse mode', async () => {
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    await wrapper.find('.poem-card').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="recite-back"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.recitation-card').exists()).toBe(false)
    expect(wrapper.find('.poem-card').exists()).toBe(true)
    // 浏览模式恢复模式切换按钮
    expect(wrapper.text()).toContain('📇 滑动')
  })

  it('source filter buttons switch source', async () => {
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    // 点击"智能混合"
    const smartBtn = wrapper.findAll('button').find(b => b.text() === '智能混合')
    expect(smartBtn).toBeTruthy()
    await smartBtn!.trigger('click')
    await wrapper.vm.$nextTick()
    // 仍显示 PoemCard
    expect(wrapper.find('.poem-card').exists()).toBe(true)
  })
})

describe('PoemCardPage detail interactions', () => {
  it('submitting mastered result records answer and navigates', async () => {
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    await wrapper.find('.poem-card').trigger('click')
    await wrapper.vm.$nextTick()

    // 点击"熟练"按钮触发 submit
    const masterBtn = wrapper.findAll('.recitation-card button').find(b => b.text() === '熟练')
    expect(masterBtn).toBeTruthy()
    await masterBtn!.trigger('click')
    // nextTick + 导航定时器（350ms）
    await new Promise(r => setTimeout(r, 400))
    await wrapper.vm.$nextTick()

    // 已查计数更新
    expect(wrapper.text()).toContain('已查 1')
  })

  it('switching to mystery mode shows mystery box', async () => {
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    // 点击"盲盒"模式按钮
    const mysteryBtn = wrapper.findAll('button').find(b => b.text() === '🎁 盲盒')
    expect(mysteryBtn).toBeTruthy()
    await mysteryBtn!.trigger('click')
    await wrapper.vm.$nextTick()
    // 显示盲盒
    expect(wrapper.find('.mystery-boxes').exists() || wrapper.find('.mystery-box').exists()).toBe(true)
  })

  it('switching back to swiper mode from mystery', async () => {
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    await wrapper.findAll('button').find(b => b.text() === '🎁 盲盒')!.trigger('click')
    await wrapper.vm.$nextTick()
    // 切回滑动模式
    await wrapper.findAll('button').find(b => b.text() === '📇 滑动')!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.poem-card').exists()).toBe(true)
  })
})
