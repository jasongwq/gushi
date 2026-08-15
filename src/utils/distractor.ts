import type { Poem } from '@/types'
import { shuffleArray } from './quiz'

/**
 * Extract unique Chinese characters from a poem's text.
 */
function extractChars(poem: Poem): string[] {
  const chars = new Set<string>()
  for (const line of poem.text) {
    for (const ch of line) {
      if (/[\u4e00-\u9fff]/.test(ch)) {
        chars.add(ch)
      }
    }
  }
  return [...chars]
}

export function generateFillBlankOptions(
  poem: Poem,
  allPoems: Poem[],
  correctChar: string,
  _position: number
): string[] {
  // Collect distractor characters from same poem first
  const samePoemChars = extractChars(poem).filter(ch => ch !== correctChar)

  // Then from same grade poems
  const sameGradePoems = allPoems.filter(p => p.grade === poem.grade && p.id !== poem.id)
  const sameGradeChars = new Set<string>()
  for (const p of sameGradePoems) {
    for (const ch of extractChars(p)) {
      if (ch !== correctChar) {
        sameGradeChars.add(ch)
      }
    }
  }

  // Combine: same poem first, then same grade, then all poems
  const seen = new Set<string>()
  const distractors: string[] = []

  for (const ch of samePoemChars) {
    if (!seen.has(ch)) {
      seen.add(ch)
      distractors.push(ch)
    }
  }
  for (const ch of sameGradeChars) {
    if (!seen.has(ch)) {
      seen.add(ch)
      distractors.push(ch)
    }
  }

  // If still not enough, fall back to all poems
  if (distractors.length < 5) {
    for (const p of allPoems) {
      if (p.grade === poem.grade) continue
      for (const ch of extractChars(p)) {
        if (ch !== correctChar && !seen.has(ch)) {
          seen.add(ch)
          distractors.push(ch)
          if (distractors.length >= 5) break
        }
      }
      if (distractors.length >= 5) break
    }
  }

  const selected = distractors.slice(0, 5)
  const options = [correctChar, ...selected]
  return shuffleArray(options)
}

export function generateNextLineOptions(
  poem: Poem,
  allPoems: Poem[],
  correctLine: string,
  grade: string
): string[] {
  // Collect lines from same grade poems, excluding the correct line
  const sameGradePoems = allPoems.filter(p => p.grade === grade)
  const candidateLines: string[] = []
  for (const p of sameGradePoems) {
    for (const line of p.text) {
      if (line !== correctLine && !candidateLines.includes(line)) {
        candidateLines.push(line)
      }
    }
  }

  // If not enough, fall back to all poems
  if (candidateLines.length < 5) {
    for (const p of allPoems) {
      if (p.grade === grade) continue
      for (const line of p.text) {
        if (line !== correctLine && !candidateLines.includes(line)) {
          candidateLines.push(line)
          if (candidateLines.length >= 5) break
        }
      }
      if (candidateLines.length >= 5) break
    }
  }

  const selected = candidateLines.slice(0, 5)
  const options = [correctLine, ...selected]
  return shuffleArray(options)
}

export function generateSelectOptions(
  allPoems: Poem[],
  grade: string,
  field: 'title' | 'author' | 'dynasty',
  correctValue: string
): string[] {
  // Collect values from same grade poems first
  const sameGradePoems = allPoems.filter(p => p.grade === grade)
  const sameGradeValues = new Set<string>()
  for (const p of sameGradePoems) {
    const val = p[field]
    if (val !== correctValue) {
      sameGradeValues.add(val)
    }
  }

  // Combine same grade values
  const distractors: string[] = [...sameGradeValues]

  // If not enough, fall back to all poems
  if (distractors.length < 5) {
    const seen = new Set(distractors)
    seen.add(correctValue)
    for (const p of allPoems) {
      const val = p[field]
      if (val !== correctValue && !seen.has(val)) {
        seen.add(val)
        distractors.push(val)
        if (distractors.length >= 5) break
      }
    }
  }

  const selected = distractors.slice(0, 5)
  const options = [correctValue, ...selected]
  return shuffleArray(options)
}
