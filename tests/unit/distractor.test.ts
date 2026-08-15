import { describe, it, expect } from 'vitest'
import {
  generateFillBlankOptions,
  generateNextLineOptions,
} from '@/utils/distractor'
import type { Poem } from '@/types'

const poems: Poem[] = [
  { id: 'p1', title: '春晓', author: '孟浩然', dynasty: '唐', grade: '一年级', text: ['春眠不觉晓', '处处闻啼鸟', '夜来风雨声', '花落知多少'], textType: '五言' },
  { id: 'p2', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级', text: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'], textType: '五言' },
  { id: 'p3', title: '咏鹅', author: '骆宾王', dynasty: '唐', grade: '一年级', text: ['鹅，鹅，鹅，', '曲项向天歌。', '白毛浮绿水，', '红掌拨清波。'], textType: '其他' },
  { id: 'p4', title: '画', author: '王维', dynasty: '唐', grade: '一年级', text: ['远看山有色', '近听水无声', '春去花还在', '人来鸟不惊'], textType: '五言' },
  { id: 'p5', title: '悯农', author: '李绅', dynasty: '唐', grade: '一年级', text: ['锄禾日当午', '汗滴禾下土', '谁知盘中餐', '粒粒皆辛苦'], textType: '五言' },
  { id: 'p6', title: '风', author: '李峤', dynasty: '唐', grade: '一年级', text: ['解落三秋叶', '能开二月花', '过江千尺浪', '入竹万竿斜'], textType: '五言' },
  { id: 'p7', title: '江南', author: '汉乐府', dynasty: '汉', grade: '一年级', text: ['江南可采莲', '莲叶何田田', '鱼戏莲叶间'], textType: '其他' },
]

describe('generateFillBlankOptions', () => {
  it('generates 6 options with correct answer included', () => {
    const result = generateFillBlankOptions(poems[0], poems, '春', 0)
    expect(result).toHaveLength(6)
    expect(result).toContain('春')
  })

  it('all options are unique Chinese characters', () => {
    const result = generateFillBlankOptions(poems[0], poems, '眠', 1)
    expect(result).toHaveLength(6)
    expect(new Set(result).size).toBe(6)
  })

  it('prefers distractors from same poem and same grade', () => {
    const result = generateFillBlankOptions(poems[0], poems, '晓', 0)
    expect(result).toHaveLength(6)
    expect(result).toContain('晓')
    // All options should be single characters
    for (const opt of result) {
      expect(opt).toHaveLength(1)
    }
  })
})

describe('generateNextLineOptions', () => {
  it('generates 6 options with correct line included', () => {
    const result = generateNextLineOptions(poems[0], poems, '处处闻啼鸟', '一年级')
    expect(result).toHaveLength(6)
    expect(result).toContain('处处闻啼鸟')
  })

  it('all options are unique', () => {
    const result = generateNextLineOptions(poems[0], poems, '处处闻啼鸟', '一年级')
    expect(result).toHaveLength(6)
    expect(new Set(result).size).toBe(6)
  })

  it('distractors are from same grade poems', () => {
    const result = generateNextLineOptions(poems[0], poems, '处处闻啼鸟', '一年级')
    expect(result).toHaveLength(6)
    // The correct line should be included
    expect(result).toContain('处处闻啼鸟')
    // Other lines should be from the pool
    for (const opt of result) {
      if (opt !== '处处闻啼鸟') {
        // Distractor should be a line from some poem
        const allLines = poems.flatMap(p => p.text)
        expect(allLines).toContain(opt)
      }
    }
  })
})
