import type { CharMarkStats } from '@/types'

/** Regex matching Chinese characters (CJK Unified Ideographs). */
export const CJK_CHAR_REGEX = /[\u4e00-\u9fff]/

export interface CharSegment {
  type: 'char' | 'punct'
  char: string
  /** 汉字索引（跳过标点）；punct 段无该属性 */
  charIdx?: number
}

/** 将一行诗拆分为字符段，汉字带递增的 charIdx（跳过标点）。 */
export function parseLine(line: string): CharSegment[] {
  const segments: CharSegment[] = []
  let charIdx = 0
  for (const ch of line) {
    if (CJK_CHAR_REGEX.test(ch)) {
      segments.push({ type: 'char', char: ch, charIdx: charIdx++ })
    } else {
      segments.push({ type: 'punct', char: ch })
    }
  }
  return segments
}

/** 单字统计查找表条目 */
export interface CharMarkStatEntry {
  char: string
  fuzzyCount: number
  wrongCount: number
}

/** 从 CharMarkStats[] 构建 `${lineIndex}-${charIndex}` 查找表 */
export function buildCharMarkLookup(stats: CharMarkStats[]): Record<string, CharMarkStatEntry> {
  const lookup: Record<string, CharMarkStatEntry> = {}
  for (const s of stats) {
    lookup[`${s.lineIndex}-${s.charIndex}`] = { char: s.char, fuzzyCount: s.fuzzyCount, wrongCount: s.wrongCount }
  }
  return lookup
}

/** 某诗的字词统计摘要（用于角标）。一个字同时有 fuzzy/wrong 记录时优先计入 wrong */
export interface CharMarkSummary {
  wrongCount: number
  fuzzyCount: number
}

export function summarizeCharMarks(stats: CharMarkStats[]): CharMarkSummary {
  let wrongCount = 0
  let fuzzyCount = 0
  for (const s of stats) {
    if (s.wrongCount > 0) wrongCount++
    else if (s.fuzzyCount > 0) fuzzyCount++
  }
  return { wrongCount, fuzzyCount }
}
