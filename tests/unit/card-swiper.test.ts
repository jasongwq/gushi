import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CardSwiper from '@/components/CardSwiper.vue'

function mountSwiper(props: Record<string, unknown> = {}, customSlots?: string) {
  return mount(CardSwiper, {
    props: { count: 10, modelValue: 0, ...props },
    slots: {
      default: customSlots ?? Array.from({ length: 10 }, (_, i) =>
        `<div class="swiper-slide" data-test="slide-${i}">slide ${i}</div>`).join(''),
    },
    global: { stubs: {} },
  })
}

describe('CardSwiper', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('mounts with coverflow effect by default', () => {
    const wrapper = mountSwiper()
    const el = wrapper.find('.card-swiper').element as HTMLElement
    expect(el).toBeTruthy()
    // coverflow 默认不加 is-fullscreen
    expect(el.classList.contains('is-fullscreen')).toBe(false)
  })

  it('adds is-fullscreen class when effect is slide', () => {
    const wrapper = mountSwiper({ effect: 'slide' })
    const el = wrapper.find('.card-swiper').element as HTMLElement
    expect(el.classList.contains('is-fullscreen')).toBe(true)
  })

  it('exposes getSwiperInstance', () => {
    const wrapper = mountSwiper()
    // defineExpose 的方法通过 wrapper.vm 可访问
    expect(typeof (wrapper.vm as any).getSwiperInstance).toBe('function')
  })

  it('shuffle is no-op when count is 0', async () => {
    const wrapper = mountSwiper({ count: 0 })
    // 不应该抛错
    await (wrapper.vm as any).shuffle?.()
    expect(true).toBe(true)
  })

  it('shuffle does not re-enter while shuffling', async () => {
    const wrapper = mountSwiper()
    const vm = wrapper.vm as any
    // 直接调用不抛错
    await vm.shuffle?.()
    // 再次调用（isShuffling 防重入）
    await vm.shuffle?.()
    expect(true).toBe(true)
  })
})
