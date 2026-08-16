import { describe, it, expect } from 'vitest'
import { fuzzyMatch, searchPoems } from '@/utils/search'
import type { Poem } from '@/types'

describe('fuzzyMatch', () => {
  it('matches exact substring', () => {
    expect(fuzzyMatch('静夜思', '夜思')).toBe(true)
  })

  it('matches subsequence characters', () => {
    expect(fuzzyMatch('静夜思', '静思')).toBe(true)
  })

  it('returns false when characters are out of order', () => {
    expect(fuzzyMatch('静夜思', '思静')).toBe(false)
  })

  it('returns false when character not found', () => {
    expect(fuzzyMatch('静夜思', '李白')).toBe(false)
  })

  it('matches case-insensitively', () => {
    expect(fuzzyMatch('Hello World', 'hlo')).toBe(true)
  })

  it('returns true for empty query', () => {
    expect(fuzzyMatch('静夜思', '')).toBe(true)
  })
})

describe('searchPoems', () => {
  const poems: Poem[] = [
    { id: 'p001', title: '静夜思', author: '李白', dynasty: '唐', grade: '一年级', text: ['床前明月光，', '疑是地上霜。', '举头望明月，', '低头思故乡。'], textType: '五言', yiwen: '译文' },
    { id: 'p002', title: '春晓', author: '孟浩然', dynasty: '唐', grade: '一年级', text: ['春眠不觉晓，', '处处闻啼鸟。'], textType: '五言', yiwen: '译文' },
    { id: 'p003', title: '望庐山瀑布', author: '李白', dynasty: '唐', grade: '二年级', text: ['日照香炉生紫烟，', '遥看瀑布挂前川。'], textType: '七言', yiwen: '译文' },
    { id: 'p004', title: '咏鹅', author: '骆宾王', dynasty: '唐', grade: '一年级', text: ['鹅，鹅，鹅，', '曲项向天歌。', '白毛浮绿水，', '红掌拨清波。'], textType: '其他', yiwen: '译文' },
  ]

  it('returns title matches first, then author=content', () => {
    const results = searchPoems(poems, '李白')
    expect(results.map(p => p.id)).toEqual(['p001', 'p003'])
  })

  it('title matches rank higher than author/content matches', () => {
    const results = searchPoems(poems, '望')
    // p003 matches by title, p001 matches by content (举头望明月)
    expect(results.map(p => p.id)).toEqual(['p003', 'p001'])
  })

  it('does not duplicate poems that match in multiple fields', () => {
    const results = searchPoems(poems, '静思')
    expect(results.filter(p => p.id === 'p001').length).toBe(1)
  })

  it('returns empty array when no matches', () => {
    const results = searchPoems(poems, '杜甫')
    expect(results).toEqual([])
  })

  it('returns all poems for empty query', () => {
    const results = searchPoems(poems, '')
    expect(results.length).toBe(4)
  })

  it('matches content text', () => {
    const results = searchPoems(poems, '明月')
    expect(results.map(p => p.id)).toEqual(['p001'])
  })

  it('preserves original order within same priority level', () => {
    const results = searchPoems(poems, '李白')
    expect(results.map(p => p.id)).toEqual(['p001', 'p003'])
  })
})
