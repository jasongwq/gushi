import { describe, it, expect } from 'vitest'
import { parseLine } from '@/utils/charMark'

describe('parseLine', () => {
  it('splits line into char and punct segments with charIdx', () => {
    expect(parseLine('床前明月光，')).toEqual([
      { type: 'char', char: '床', charIdx: 0 },
      { type: 'char', char: '前', charIdx: 1 },
      { type: 'char', char: '明', charIdx: 2 },
      { type: 'char', char: '月', charIdx: 3 },
      { type: 'char', char: '光', charIdx: 4 },
      { type: 'punct', char: '，' },
    ])
  })

  it('skips punctuation when counting charIdx', () => {
    expect(parseLine('鹅，鹅，鹅，')).toEqual([
      { type: 'char', char: '鹅', charIdx: 0 },
      { type: 'punct', char: '，' },
      { type: 'char', char: '鹅', charIdx: 1 },
      { type: 'punct', char: '，' },
      { type: 'char', char: '鹅', charIdx: 2 },
      { type: 'punct', char: '，' },
    ])
  })

  it('handles multiple punctuation types', () => {
    expect(parseLine('举头望明月。')).toEqual([
      { type: 'char', char: '举', charIdx: 0 },
      { type: 'char', char: '头', charIdx: 1 },
      { type: 'char', char: '望', charIdx: 2 },
      { type: 'char', char: '明', charIdx: 3 },
      { type: 'char', char: '月', charIdx: 4 },
      { type: 'punct', char: '。' },
    ])
  })

  it('returns empty array for empty line', () => {
    expect(parseLine('')).toEqual([])
  })
})
