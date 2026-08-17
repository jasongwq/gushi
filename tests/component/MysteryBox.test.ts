import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MysteryBox from '@/components/MysteryBox.vue'
import type { Poem } from '@/types'

const poems: Poem[] = [
  { id: 'p1', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级', text: ['床前明月光'], textType: '五言', yiwen: '' },
  { id: 'p2', title: '春晓', author: '孟浩然', dynasty: '唐', grade: '一年级', text: ['春眠不觉晓'], textType: '五言', yiwen: '' },
  { id: 'p3', title: '咏鹅', author: '骆宾王', dynasty: '唐', grade: '一年级', text: ['鹅鹅鹅'], textType: '五言', yiwen: '' },
  { id: 'p4', title: '画', author: '王维', dynasty: '唐', grade: '一年级', text: ['远看山有色'], textType: '五言', yiwen: '' },
  { id: 'p5', title: '悯农', author: '李绅', dynasty: '唐', grade: '一年级', text: ['锄禾日当午'], textType: '五言', yiwen: '' },
  { id: 'p6', title: '风', author: '李峤', dynasty: '唐', grade: '一年级', text: ['解落三秋叶'], textType: '五言', yiwen: '' },
]

function mountBox(props: { poems: Poem[] } = { poems }) {
  return mount(MysteryBox, { props })
}

describe('MysteryBox', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes 4 closed boxes from poems', () => {
    const wrapper = mountBox()
    const boxes = (wrapper.vm as any).boxes
    expect(boxes).toHaveLength(4)
    for (const box of boxes) {
      expect(box.state).toBe('closed')
      expect(box.poem).toBeTruthy()
    }
    // 渲染 4 个问号盒
    expect(wrapper.findAll('button[data-state="closed"]')).toHaveLength(4)
  })

  it('renders nothing when poems prop is empty', () => {
    const wrapper = mountBox({ poems: [] })
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect((wrapper.vm as any).isReady).toBe(false)
  })

  it('openBox transitions closed → opening → revealed and emits revealed', async () => {
    const wrapper = mountBox()
    const boxes = (wrapper.vm as any).boxes
    const box = boxes[0]

    ;(wrapper.vm as any).openBox(0)
    expect(box.state).toBe('opening')

    await vi.advanceTimersByTimeAsync(800)
    expect(box.state).toBe('revealed')
    expect(wrapper.emitted('revealed')).toBeTruthy()
    expect(wrapper.emitted('revealed')![0][0]).toEqual(box.poem)
  })

  it('openBox ignores non-closed boxes', async () => {
    const wrapper = mountBox()
    const boxes = (wrapper.vm as any).boxes
    boxes[0].state = 'opening'
    ;(wrapper.vm as any).openBox(0)
    // state 不变，且无 revealed emit
    expect(boxes[0].state).toBe('opening')
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.emitted('revealed')).toBeFalsy()
  })

  it('openBox ignores out-of-range index', () => {
    const wrapper = mountBox()
    expect(() => (wrapper.vm as any).openBox(99)).not.toThrow()
    expect(wrapper.emitted('revealed')).toBeFalsy()
  })

  it('selectBox emits select only for revealed boxes', () => {
    const wrapper = mountBox()
    const boxes = (wrapper.vm as any).boxes as { poem: Poem | null; state: string }[]

    // closed box: no emit
    ;(wrapper.vm as any).selectBox(0)
    expect(wrapper.emitted('select')).toBeFalsy()

    // revealed box: emits select with poem
    boxes[1].state = 'revealed'
    ;(wrapper.vm as any).selectBox(1)
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0][0]).toEqual(boxes[1].poem)
  })

  it('selectBox emits nothing when poem is null', () => {
    const wrapper = mountBox()
    const boxes = (wrapper.vm as any).boxes as { poem: Poem | null; state: string }[]
    boxes[0].state = 'revealed'
    boxes[0].poem = null
    ;(wrapper.vm as any).selectBox(0)
    expect(wrapper.emitted('select')).toBeFalsy()
  })

  it('refresh re-randomizes boxes to closed state', () => {
    const wrapper = mountBox()
    const boxes = (wrapper.vm as any).boxes as { poem: Poem | null; state: string }[]
    boxes.forEach(b => (b.state = 'revealed'))
    ;(wrapper.vm as any).refresh()
    for (const box of (wrapper.vm as any).boxes as { poem: Poem | null; state: string }[]) {
      expect(box.state).toBe('closed')
    }
  })

  it('allRevealed is false until every box revealed, then true', async () => {
    const wrapper = mountBox()
    expect((wrapper.vm as any).allRevealed).toBe(false)
    // 打开全部 4 盒
    for (let i = 0; i < 4; i++) {
      ;(wrapper.vm as any).openBox(i)
    }
    await vi.advanceTimersByTimeAsync(800)
    expect((wrapper.vm as any).allRevealed).toBe(true)
    // 显示「再抽一轮」按钮
    const refreshBtn = wrapper.findAll('button').find(b => b.text() === '再抽一轮')
    expect(refreshBtn).toBeTruthy()
  })

  it('revealedPoems exposes box poems, filtering out null poems', () => {
    const wrapper = mountBox()
    const boxes = (wrapper.vm as any).boxes
    boxes[1].poem = null
    // 注意：revealedPoems 只按 poem 非空过滤，不检查 state（父组件通过 boxes 自行按 state 过滤）
    const revealed = (wrapper.vm as any).revealedPoems
    expect(revealed).toHaveLength(3)
    expect(revealed.map((p: Poem) => p.id)).not.toContain(boxes[1].id)
  })
})
