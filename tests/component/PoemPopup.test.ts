import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PoemPopup from '@/components/PoemPopup.vue'
import type { Poem } from '@/types'

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

vi.mock('vue-focus-lock', () => ({
  default: {
    inheritAttrs: false,
    props: ['returnFocus'],
    template: '<div><slot /></div>',
  },
}))

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

function mountPopup(props: { poem?: Poem; visible?: boolean } = {}) {
  return mount(PoemPopup, {
    props: { poem: mockPoem, visible: false, ...props },
    global: {
      plugins: [createPinia()],
      stubs: {
        Teleport: { template: '<div><slot /></div>' },
      },
    },
  })
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
    await wrapper.find('.popup-overlay').trigger('keydown.escape')
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
})
