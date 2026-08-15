import type { Poem, LearningRecord, WrongEntry, SourceType } from '@/types'

export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

interface SourceOptions {
  grades?: string[]
  unit?: string
}

export function getPoemsBySource(
  poems: Poem[],
  source: SourceType,
  today: string,
  options?: SourceOptions
): Poem[] {
  if (source === 'all') return poems
  if (source === 'grade') return poems.filter(p => options?.grades?.includes(p.grade) ?? false)
  if (source === 'unit') return poems.filter(p => p.unit === options?.unit)
  return poems
}

export function getReviewPoems(
  poems: Poem[],
  records: LearningRecord[],
  today: string
): Poem[] {
  const recordMap = new Map(records.map(r => [r.poemId, r]))
  return poems.filter(p => {
    const record = recordMap.get(p.id)
    return record ? record.nextReviewDate <= today : false
  })
}

export function getUnproficientPoems(
  poems: Poem[],
  records: LearningRecord[]
): Poem[] {
  const recordMap = new Map(records.map(r => [r.poemId, r]))
  return poems.filter(p => {
    const record = recordMap.get(p.id)
    return record ? record.unproficient : false
  })
}

export function getWrongPoems(
  poems: Poem[],
  wrongBook: WrongEntry[]
): Poem[] {
  const wrongIds = new Set(wrongBook.map(w => w.poemId))
  return poems.filter(p => wrongIds.has(p.id))
}

export function getRecentlyLearnedPoems(
  poems: Poem[],
  records: LearningRecord[],
  today: string
): Poem[] {
  const todayDate = new Date(today + 'T00:00:00')
  const recordMap = new Map(records.map(r => [r.poemId, r]))
  return poems.filter(p => {
    const record = recordMap.get(p.id)
    if (!record?.lastLearnDate) return false
    const learnedDate = new Date(record.lastLearnDate + 'T00:00:00')
    const diffDays = (todayDate.getTime() - learnedDate.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays >= 0 && diffDays <= 7
  })
}

export function smartMix(
  poems: Poem[],
  records: LearningRecord[],
  wrongBook: WrongEntry[],
  count: number,
  today: string
): Poem[] {
  if (poems.length === 0) return []

  const reviewPoems = getReviewPoems(poems, records, today)
  const unproficientPoems = getUnproficientPoems(poems, records)
  const wrongPoems = getWrongPoems(poems, wrongBook)
  const recentlyLearnedPoems = getRecentlyLearnedPoems(poems, records, today)

  const sources = [
    { poems: reviewPoems, ratio: 0.30 },
    { poems: unproficientPoems, ratio: 0.25 },
    { poems: wrongPoems, ratio: 0.20 },
    { poems: recentlyLearnedPoems, ratio: 0.15 },
    { poems: poems, ratio: 0.10 },
  ]

  const selectedIds = new Set<string>()
  const selected: Poem[] = []
  let remaining = count

  // First pass: allocate by ratio from each source
  for (const source of sources) {
    if (remaining <= 0) break
    const target = Math.min(Math.round(count * source.ratio), remaining)
    const available = shuffleArray(source.poems).filter(p => !selectedIds.has(p.id))
    const taken = available.slice(0, target)
    for (const poem of taken) {
      selectedIds.add(poem.id)
      selected.push(poem)
    }
    remaining = count - selected.length
  }

  // Second pass: fill remaining slots by priority order
  if (remaining > 0) {
    for (const source of sources) {
      if (remaining <= 0) break
      const available = source.poems.filter(p => !selectedIds.has(p.id))
      for (const poem of available) {
        if (remaining <= 0) break
        selectedIds.add(poem.id)
        selected.push(poem)
        remaining--
      }
    }
  }

  return shuffleArray(selected)
}
