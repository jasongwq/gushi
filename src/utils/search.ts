import type { Poem } from '@/types'

/**
 * Fuzzy match: checks if query characters appear as a subsequence in target.
 * Also matches exact substrings. Case-insensitive.
 */
export function fuzzyMatch(target: string, query: string): boolean {
  if (!query) return true
  if (!target) return false
  const t = target.toLowerCase()
  const q = query.toLowerCase()
  let ti = 0
  for (let qi = 0; qi < q.length; qi++) {
    const found = t.indexOf(q[qi], ti)
    if (found === -1) return false
    ti = found + 1
  }
  return true
}

/**
 * Search poems by query across title, author, and content fields.
 * Returns results sorted by priority: title matches > author matches = content matches.
 * Within the same priority level, preserves original array order.
 * Each poem appears at most once, at its highest priority position.
 */
export function searchPoems(poems: Poem[], query: string): Poem[] {
  if (!query) return [...poems]

  const titleMatches: Poem[] = []
  const authorMatches: Poem[] = []
  const contentMatches: Poem[] = []
  const seenIds = new Set<string>()

  for (const poem of poems) {
    if (fuzzyMatch(poem.title, query)) {
      titleMatches.push(poem)
      seenIds.add(poem.id)
    }
  }

  for (const poem of poems) {
    if (seenIds.has(poem.id)) continue
    if (fuzzyMatch(poem.author, query)) {
      authorMatches.push(poem)
      seenIds.add(poem.id)
    }
  }

  for (const poem of poems) {
    if (seenIds.has(poem.id)) continue
    const fullText = poem.text.join('')
    if (fuzzyMatch(fullText, query)) {
      contentMatches.push(poem)
      seenIds.add(poem.id)
    }
  }

  return [...titleMatches, ...authorMatches, ...contentMatches]
}
