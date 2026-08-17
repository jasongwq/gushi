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
