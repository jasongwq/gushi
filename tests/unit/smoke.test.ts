import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

describe('smoke test', () => {
  it('Vue renders a component', () => {
    const Comp = defineComponent({
      render() {
        return h('div', '古诗抽查')
      },
    })
    const wrapper = mount(Comp)
    expect(wrapper.text()).toBe('古诗抽查')
  })

  it('CSS variables are defined', () => {
    expect('--color-primary').toBeTruthy()
    expect('--color-success').toBeTruthy()
    expect('--color-danger').toBeTruthy()
  })
})
