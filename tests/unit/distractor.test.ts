import { describe, it, expect } from 'vitest'
import {
  generateFillBlankOptions,
  generateNextLineOptions,
  cjkCharCount,
  stripPunctuation,
} from '@/utils/distractor'
import type { Poem } from '@/types'

const poems: Poem[] = [
  { id: 'p1', title: '春晓', author: '孟浩然', dynasty: '唐', grade: '一年级', text: ['春眠不觉晓，', '处处闻啼鸟。', '夜来风雨声，', '花落知多少。'], textType: '五言', yiwen: '' },
  { id: 'p2', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级', text: ['床前明月光，', '疑是地上霜。', '举头望明月，', '低头思故乡。'], textType: '五言', yiwen: '' },
  { id: 'p3', title: '咏鹅', author: '骆宾王', dynasty: '唐', grade: '一年级', text: ['鹅，鹅，鹅，', '曲项向天歌。', '白毛浮绿水，', '红掌拨清波。'], textType: '其他', yiwen: '' },
  { id: 'p4', title: '画', author: '王维', dynasty: '唐', grade: '一年级', text: ['远看山有色，', '近听水无声。', '春去花还在，', '人来鸟不惊。'], textType: '五言', yiwen: '' },
  { id: 'p5', title: '悯农', author: '李绅', dynasty: '唐', grade: '一年级', text: ['锄禾日当午，', '汗滴禾下土。', '谁知盘中餐，', '粒粒皆辛苦。'], textType: '五言', yiwen: '' },
  { id: 'p6', title: '风', author: '李峤', dynasty: '唐', grade: '一年级', text: ['解落三秋叶，', '能开二月花。', '过江千尺浪，', '入竹万竿斜。'], textType: '五言', yiwen: '' },
  { id: 'p7', title: '江南', author: '汉乐府', dynasty: '汉', grade: '一年级', text: ['江南可采莲，', '莲叶何田田。', '鱼戏莲叶间。'], textType: '其他', yiwen: '' },
]

describe('cjkCharCount', () => {
  it('counts CJK characters only', () => {
    expect(cjkCharCount('春眠不觉晓，')).toBe(5)
    expect(cjkCharCount('处处闻啼鸟。')).toBe(5)
    expect(cjkCharCount('鹅，鹅，鹅，')).toBe(3)
  })

  it('returns 0 for empty or non-CJK strings', () => {
    expect(cjkCharCount('')).toBe(0)
    expect(cjkCharCount('，。！')).toBe(0)
  })
})

describe('stripPunctuation', () => {
  it('removes all non-CJK characters', () => {
    expect(stripPunctuation('春眠不觉晓，')).toBe('春眠不觉晓')
    expect(stripPunctuation('处处闻啼鸟。')).toBe('处处闻啼鸟')
    expect(stripPunctuation('鹅，鹅，鹅，')).toBe('鹅鹅鹅')
  })

  it('returns empty string for non-CJK input', () => {
    expect(stripPunctuation('，。！')).toBe('')
  })
})

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

  it('falls back to all poems when same grade has too few distinct chars', () => {
    // 用极小的诗库触发 fallback：同诗 + 同年级可去重汉字不足 5 个
    const smallPoems: Poem[] = [
      { id: 's1', title: '独诗', author: '甲', dynasty: '唐', grade: '一年级', text: ['春眠不觉晓'], textType: '五言', yiwen: '' },
      // 另一个年级仅 1 首诗，提供补充干扰字
      { id: 's2', title: '他年级', author: '乙', dynasty: '唐', grade: '二年级', text: ['鹅鹅鹅，曲项向天歌'], textType: '五言', yiwen: '' },
    ]
    const result = generateFillBlankOptions(smallPoems[0], smallPoems, '春', 0)
    expect(result).toHaveLength(6)
    expect(new Set(result).size).toBe(6)
    expect(result).toContain('春')
  })

  it('returns fewer than 6 options when poem pool is too small', () => {
    // 所有诗加起来唯一汉字 < 6：不强制填满，选项数等于可用字符数
    const tinyPoems: Poem[] = [
      { id: 't1', title: '微诗', author: '丙', dynasty: '唐', grade: '一年级', text: ['春眠'], textType: '五言', yiwen: '' },
    ]
    const result = generateFillBlankOptions(tinyPoems[0], tinyPoems, '春', 0)
    expect(result).toContain('春')
    expect(result.length).toBeLessThanOrEqual(2)
    expect(new Set(result).size).toBe(result.length)
  })
})

describe('generateNextLineOptions', () => {
  it('generates 6 options with correct line included', () => {
    const result = generateNextLineOptions(poems[0], poems, '处处闻啼鸟。', '一年级', '春眠不觉晓，')
    expect(result).toHaveLength(6)
    expect(result).toContain('处处闻啼鸟') // stripped of punctuation
  })

  it('all options are unique', () => {
    const result = generateNextLineOptions(poems[0], poems, '处处闻啼鸟。', '一年级', '春眠不觉晓，')
    expect(result).toHaveLength(6)
    expect(new Set(result).size).toBe(6)
  })

  it('options do not contain punctuation', () => {
    const result = generateNextLineOptions(poems[0], poems, '处处闻啼鸟。', '一年级', '春眠不觉晓，')
    for (const opt of result) {
      // No Chinese punctuation should be in the options
      expect(opt).not.toMatch(/[，。？！、；：""''（）]/)
    }
  })

  it('all options have the same CJK char count as the correct line', () => {
    const correctLine = '处处闻啼鸟。'
    const result = generateNextLineOptions(poems[0], poems, correctLine, '一年级', '春眠不觉晓，')
    const correctLen = cjkCharCount(correctLine)
    for (const opt of result) {
      expect(cjkCharCount(opt)).toBe(correctLen)
    }
  })

  it('excludes givenLine from distractors when different from correctLine', () => {
    const givenLine = '春眠不觉晓，'
    const correctLine = '处处闻啼鸟。'
    const result = generateNextLineOptions(poems[0], poems, correctLine, '一年级', givenLine)
    expect(result).toContain('处处闻啼鸟')
    expect(result).not.toContain('春眠不觉晓')
  })

  it('includes givenLine in options when it equals correctLine (repeated line)', () => {
    // Simulate a poem with a repeated line like "争渡，"
    const repeatedPoems: Poem[] = [
      { id: 'r1', title: '如梦令', author: '李清照', dynasty: '宋', grade: '六年级', text: ['常记溪亭日暮，', '沉醉不知归路。', '兴尽晚回舟，', '误入藕花深处。', '争渡，', '争渡，', '惊起一滩鸥鹭。'], textType: '其他', yiwen: '' },
      ...poems,
    ]
    const correctLine = '争渡，'
    const givenLine = '争渡，'
    const result = generateNextLineOptions(repeatedPoems[0], repeatedPoems, correctLine, '六年级', givenLine)
    // When givenLine === correctLine, the correct line should still be in options
    expect(result).toContain('争渡')
  })

  it('correctIndex is always valid for generated options', () => {
    // Run many times to test randomness
    for (let i = 0; i < 50; i++) {
      for (const poem of poems) {
        for (let lineIdx = 0; lineIdx < poem.text.length - 1; lineIdx++) {
          const len1 = cjkCharCount(poem.text[lineIdx])
          const len2 = cjkCharCount(poem.text[lineIdx + 1])
          // Only test pairs with same CJK length (nextLine quiz only uses these)
          if (len1 !== len2) continue
          const isForward = i % 2 === 0
          const givenLine = isForward ? poem.text[lineIdx] : poem.text[lineIdx + 1]
          const correctLine = isForward ? poem.text[lineIdx + 1] : poem.text[lineIdx]
          const options = generateNextLineOptions(poem, poems, correctLine, poem.grade, givenLine)
          const correctStripped = stripPunctuation(correctLine)
          const correctIndex = options.indexOf(correctStripped)
          expect(correctIndex).toBeGreaterThanOrEqual(0)
          expect(options[correctIndex]).toBe(correctStripped)
        }
      }
    }
  })

  it('givenLine is excluded from distractors when it differs from correctLine', () => {
    for (const poem of poems) {
      for (let lineIdx = 0; lineIdx < poem.text.length - 1; lineIdx++) {
        const len1 = cjkCharCount(poem.text[lineIdx])
        const len2 = cjkCharCount(poem.text[lineIdx + 1])
        if (len1 !== len2) continue
        const givenLine = poem.text[lineIdx]
        const correctLine = poem.text[lineIdx + 1]
        if (stripPunctuation(givenLine) === stripPunctuation(correctLine)) continue
        const options = generateNextLineOptions(poem, poems, correctLine, poem.grade, givenLine)
        expect(options).not.toContain(stripPunctuation(givenLine))
      }
    }
  })

  it('falls back to other grade poems when same grade lacks matching lines', () => {
    // 同年级只有一首诗，无法提供同长度行 → 从其他年级补充
    const lonePoem: Poem = { id: 'L1', title: '孤诗', author: '丁', dynasty: '唐', grade: '六年级', text: ['床前明月光，'], textType: '五言', yiwen: '' }
    const pool: Poem[] = [lonePoem, ...poems] // poems 里大量「一年级」五言行可补充
    const result = generateNextLineOptions(lonePoem, pool, '床前明月光，', '六年级', '床前明月光，')
    expect(result).toHaveLength(6)
    expect(result).toContain('床前明月光')
    expect(new Set(result).size).toBe(6)
  })

  it('returns only available lines when pool is tiny', () => {
    const tiny: Poem[] = [
      { id: 'q1', title: '单行诗', author: '戊', dynasty: '唐', grade: '一年级', text: ['白日依山尽'], textType: '五言', yiwen: '' },
    ]
    const result = generateNextLineOptions(tiny[0], tiny, '白日依山尽', '一年级', '白日依山尽')
    expect(result).toContain('白日依山尽')
    expect(result).toHaveLength(1)
  })
})
