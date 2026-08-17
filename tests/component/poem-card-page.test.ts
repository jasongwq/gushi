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

describe('PoemCardPage touch gesture handling', () => {
  // 在背诵模式下分派触摸事件到页面根容器（pageRootRef 上绑定了 capture 阶段监听）
  function dispatchTouch(wrapper: ReturnType<typeof mountPage>, type: 'touchstart' | 'touchmove' | 'touchend', x: number, y: number) {
    const root = wrapper.find('.poem-card-page').element as HTMLElement
    const event = new Event(type, { bubbles: true, cancelable: true }) as any
    if (type === 'touchend' || type === 'touchcancel') {
      event.touches = []
      event.changedTouches = []
    } else {
      event.touches = [{ clientX: x, clientY: y }]
      event.changedTouches = [{ clientX: x, clientY: y }]
    }
    // 用 elementFromPoint 无法在 happy-dom 模拟命中；直接分派到根容器，
    // target 用参数指定——通过 dispatchEvent 的 target 是 root 本身，
    // closest('.card-swiper') 会失败，因此需要手动构造 target。
    // 改用 component 暴露的内部实现：直接触发 capture 监听，target 指向卡片内元素。
    Object.defineProperty(event, 'target', {
      value: createTarget(root, x, y),
      configurable: true,
    })
    root.dispatchEvent(event)
  }

  // 构造一个带 closest 的伪目标元素（模拟命中点）
  function createTarget(root: HTMLElement, x: number, y: number) {
    // happy-dom 不支持 elementFromPoint，这里直接基于命中点 y 推断：
    // 顶部标题区（不在滚动区内） vs 中部（在 data-scroll-area 滚动区内）
    const cardArea = root.querySelector('.recitation-card')
    const fake = document.createElement('div')
    // 根据坐标构造 closest 行为
    fake.closest = ((selector: string) => {
      if (!cardArea) return null
      const scrollArea = cardArea.querySelector('[data-scroll-area]')!
      const rect = { top: 0, bottom: 0 }
      // 简化：y < 100 视为标题区（滚动区外），否则视为滚动区内
      const inScroll = y >= 100
      if (selector === '.card-swiper') return root.querySelector('.card-swiper')
      if (selector === '[data-scroll-area]') return inScroll ? scrollArea : null
      if (selector === '.recitation-card') return cardArea
      return null
    }) as any
    return fake as any
  }

  async function enterRecite(wrapper: ReturnType<typeof mountPage>) {
    await wrapper.find('.poem-card').trigger('click')
    await wrapper.vm.$nextTick()
    return wrapper
  }

  it('滚动区内上滑：不缩回（正文滚动接管）', async () => {
    const wrapper = await enterRecite(mountPage())
    const beforeCount = wrapper.find('.recitation-card').exists()

    // touchstart 在滚动区内（y=300）→ 不记录起点
    dispatchTouch(wrapper, 'touchstart', 195, 300)
    // 上滑 100px
    dispatchTouch(wrapper, 'touchmove', 195, 200)
    dispatchTouch(wrapper, 'touchend', 195, 200)
    await wrapper.vm.$nextTick()

    // 仍处于背诵模式（未缩回）
    expect(wrapper.find('.recitation-card').exists()).toBe(true)
    expect(beforeCount).toBe(true)
  })

  it('滚动区外（标题区）上滑：缩回浏览模式', async () => {
    const wrapper = await enterRecite(mountPage())

    // touchstart 在标题区（y=50，滚动区外）→ 记录起点
    dispatchTouch(wrapper, 'touchstart', 195, 50)
    // 上滑 100px（超过阈值 50）
    dispatchTouch(wrapper, 'touchmove', 195, -50)
    dispatchTouch(wrapper, 'touchend', 195, -50)
    await wrapper.vm.$nextTick()

    // 缩回浏览模式
    expect(wrapper.find('.recitation-card').exists()).toBe(false)
    expect(wrapper.find('.poem-card').exists()).toBe(true)
  })

  it('滚动区内点击（位移小）不触发缩回', async () => {
    const wrapper = await enterRecite(mountPage())

    dispatchTouch(wrapper, 'touchstart', 195, 300)
    // 小位移（dy = 10px，低于阈值）
    dispatchTouch(wrapper, 'touchmove', 196, 290)
    dispatchTouch(wrapper, 'touchend', 196, 290)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.recitation-card').exists()).toBe(true)
  })
})
