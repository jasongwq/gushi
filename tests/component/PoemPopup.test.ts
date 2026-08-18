import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PoemPopup from '@/components/PoemPopup.vue'
import type { Poem, CharMarkStats } from '@/types'

const mockPoem: Poem = {
  id: 'p1',
  title: '静夜思',
  author: '李白',
  dynasty: '唐',
  grade: '一年级',
  text: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'],
  textType: '五言',
  yiwen: '译文内容',
}

let activeWrapper: VueWrapper | null = null

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(() => {
  activeWrapper?.unmount()
  activeWrapper = null
})

function mountPopup(props: { poem?: Poem; visible?: boolean; charMarkStats?: CharMarkStats[] } = {}) {
  activeWrapper = mount(PoemPopup, {
    props: { poem: mockPoem, visible: false, ...props },
    global: {
      plugins: [createPinia()],
      stubs: {
        Teleport: { template: '<div><slot /></div>' },
      },
    },
  })
  return activeWrapper
}

describe('PoemPopup', () => {
  it('renders poem title, dynasty and author', async () => {
    const wrapper = mountPopup({ visible: true })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('静夜思')
    expect(wrapper.text()).toContain('唐·李白')
  })

  it('has role dialog and aria-modal when visible', async () => {
    const wrapper = mountPopup({ visible: true })
    await wrapper.vm.$nextTick()
    const overlay = wrapper.find('.popup-overlay')
    expect(overlay.attributes('role')).toBe('dialog')
    expect(overlay.attributes('aria-modal')).toBe('true')
    expect(overlay.attributes('aria-label')).toBe('古诗详情')
  })

  it('emits update:visible false when overlay clicked', async () => {
    const wrapper = mountPopup({ visible: true })
    await wrapper.vm.$nextTick()
    await wrapper.find('.popup-overlay').trigger('click')
    expect(wrapper.emitted('update:visible')).toBeTruthy()
    expect(wrapper.emitted('update:visible')![0]).toEqual([false])
  })

  it('emits update:visible false on Escape keydown', async () => {
    const wrapper = mountPopup({ visible: true })
    await wrapper.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('update:visible')).toBeTruthy()
    expect(wrapper.emitted('update:visible')![0]).toEqual([false])
  })

  it('toggles yiwen on button click', async () => {
    const wrapper = mountPopup({ visible: true })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.popup-yiwen').exists()).toBe(false)
    await wrapper.find('.yiwen-btn').trigger('click')
    expect(wrapper.find('.popup-yiwen').exists()).toBe(true)
    expect(wrapper.text()).toContain('译文内容')
  })

  it('persists yiwen setting through learning store', async () => {
    const wrapper = mountPopup({ visible: true })
    await wrapper.vm.$nextTick()
    await wrapper.find('.yiwen-btn').trigger('click')
    // 通过 store 持久化：showYiwen 为 true
    const { useLearningStore } = await import('@/stores/learning')
    const store = useLearningStore()
    expect(store.settings.showYiwen).toBe(true)
  })

  it('removes document keydown listener on unmount', async () => {
    const wrapper = mountPopup({ visible: true })
    await wrapper.vm.$nextTick()
    const spy = vi.spyOn(document, 'removeEventListener')
    wrapper.unmount()
    expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function))
    spy.mockRestore()
  })

  it('trapFocus wraps Tab from last element back to first', async () => {
    const wrapper = mountPopup({ visible: true })
    await wrapper.vm.$nextTick()
    const contentEl = wrapper.find('.popup-content').element as HTMLElement
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus')
    const keyEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    contentEl.dispatchEvent(keyEvent)
    // activeElement 不在 content 内（happy-dom 限制）→ 走 wrap 分支调用 focus
    expect(focusSpy).toHaveBeenCalled()
    focusSpy.mockRestore()
  })

  it('trapFocus with shift+Tab wraps', async () => {
    const wrapper = mountPopup({ visible: true })
    await wrapper.vm.$nextTick()
    const contentEl = wrapper.find('.popup-content').element as HTMLElement
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus')
    const keyEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    Object.defineProperty(keyEvent, 'shiftKey', { value: true })
    contentEl.dispatchEvent(keyEvent)
    expect(focusSpy).toHaveBeenCalled()
    focusSpy.mockRestore()
  })

  it('trapFocus does not call focus when no focusable elements', async () => {
    const wrapper = mountPopup({ visible: true })
    await wrapper.vm.$nextTick()
    // 删除唯一的可聚焦按钮
    wrapper.find('.yiwen-btn').element.remove()
    await wrapper.vm.$nextTick()
    const contentEl = wrapper.find('.popup-content').element as HTMLElement
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus')
    const keyEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    contentEl.dispatchEvent(keyEvent)
    // 无可聚焦元素时不应调用 focus（preventDefault 由 .prevent 修饰符无条件触发，不在此断言）
    expect(focusSpy).not.toHaveBeenCalled()
    focusSpy.mockRestore()
  })
})

describe('PoemPopup char mark highlighting', () => {
  const charMarkStats: CharMarkStats[] = [
    { poemId: 'p1', lineIndex: 0, charIndex: 2, char: '明', fuzzyCount: 0, wrongCount: 3 },
    { poemId: 'p1', lineIndex: 0, charIndex: 3, char: '月', fuzzyCount: 2, wrongCount: 0 },
  ]

  it('renders highlighted chars when charMarkStats provided', async () => {
    const wrapper = mountPopup({ visible: true, charMarkStats })
    await wrapper.vm.$nextTick()
    const fuzzySpans = wrapper.findAll('.popup-char-fuzzy')
    const wrongSpans = wrapper.findAll('.popup-char-wrong')
    expect(fuzzySpans.length).toBe(1)
    expect(fuzzySpans[0].text()).toContain('月')
    expect(wrongSpans.length).toBe(1)
    expect(wrongSpans[0].text()).toContain('明')
  })

  it('shows wrong count as superscript on highlighted chars', async () => {
    const wrapper = mountPopup({ visible: true, charMarkStats })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.popup-char-wrong').text()).toContain('3')
    expect(wrapper.find('.popup-char-fuzzy').text()).toContain('2')
  })

  it('renders plain text when no charMarkStats', async () => {
    const wrapper = mountPopup({ visible: true })
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.popup-char-fuzzy').length).toBe(0)
    expect(wrapper.findAll('.popup-char-wrong').length).toBe(0)
    expect(wrapper.text()).toContain('床前明月光')
  })

  it('renders plain text when charMarkStats is empty array', async () => {
    const wrapper = mountPopup({ visible: true, charMarkStats: [] })
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.popup-char-fuzzy').length).toBe(0)
    expect(wrapper.findAll('.popup-char-wrong').length).toBe(0)
  })

  it('renders punctuation normally with highlighting', async () => {
    const poemWithPunct: Poem = { ...mockPoem, text: ['床前明月光，'] }
    const stats: CharMarkStats[] = [
      { poemId: 'p1', lineIndex: 0, charIndex: 4, char: '光', fuzzyCount: 0, wrongCount: 1 },
    ]
    const wrapper = mountPopup({ visible: true, poem: poemWithPunct, charMarkStats: stats })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.popup-char-wrong').text()).toContain('光')
    expect(wrapper.text()).toContain('，')
  })
})
