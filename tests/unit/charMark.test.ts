import { describe, it, expect } from 'vitest'
import { parseLine, buildCharMarkLookup, summarizeCharMarks } from '@/utils/charMark'
import type { CharMarkStats } from '@/types'

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

describe('buildCharMarkLookup', () => {
  it('builds lookup keyed by lineIndex-charIndex', () => {
    const stats: CharMarkStats[] = [
      { poemId: 'p1', lineIndex: 0, charIndex: 2, char: '清', fuzzyCount: 0, wrongCount: 3 },
      { poemId: 'p1', lineIndex: 1, charIndex: 0, char: '红', fuzzyCount: 2, wrongCount: 0 },
    ]
    const lookup = buildCharMarkLookup(stats)
    expect(lookup['0-2']).toEqual({ char: '清', fuzzyCount: 0, wrongCount: 3 })
    expect(lookup['1-0']).toEqual({ char: '红', fuzzyCount: 2, wrongCount: 0 })
    expect(lookup['9-9']).toBeUndefined()
  })
})

describe('summarizeCharMarks', () => {
  it('counts wrong and fuzzy separately', () => {
    const stats: CharMarkStats[] = [
      { poemId: 'p1', lineIndex: 0, charIndex: 0, char: '床', fuzzyCount: 0, wrongCount: 2 },
      { poemId: 'p1', lineIndex: 0, charIndex: 1, char: '前', fuzzyCount: 3, wrongCount: 0 },
      { poemId: 'p1', lineIndex: 0, charIndex: 2, char: '明', fuzzyCount: 1, wrongCount: 1 },
    ]
    // 一个字既有 fuzzy 又有 wrong 时优先计入 wrong
    expect(summarizeCharMarks(stats)).toEqual({ wrongCount: 2, fuzzyCount: 1 })
  })

  it('returns zeros for empty stats', () => {
    expect(summarizeCharMarks([])).toEqual({ wrongCount: 0, fuzzyCount: 0 })
  })
})
