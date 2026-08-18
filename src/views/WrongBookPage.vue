<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useLearningStore } from '@/stores/learning'
import { usePoemStore } from '@/stores/poem'
import PoemPopup from '@/components/PoemPopup.vue'
import { summarizeCharMarks } from '@/utils/charMark'
import type { CharMarkSummary } from '@/utils/charMark'
import type { Poem, WrongEntry, CharMarkStats } from '@/types'

interface GroupedWrongEntry {
  poemId: string
  poem?: Poem
  entries: WrongEntry[]
  quizTypeLabels: string[]
  totalWrongCount: number
  charSummary: CharMarkSummary | null
}

const learningStore = useLearningStore()
const poemStore = usePoemStore()

onMounted(() => poemStore.fetchPoems())

const popupVisible = ref(false)
const popupPoemId = ref('')
const actionEntry = ref<WrongEntry | null>(null)

const popupPoem = computed<Poem | undefined>(() => {
  if (!popupPoemId.value) return undefined
  return poemStore.getPoemById(popupPoemId.value)
})

const popupCharMarkStats = computed<CharMarkStats[] | undefined>(() => {
  if (!popupPoem.value) return undefined
  return learningStore.getCharMarkStats(popupPoem.value.id, popupPoem.value.text)
})

function togglePopup(poemId: string) {
  if (popupPoemId.value === poemId && popupVisible.value) {
    popupVisible.value = false
  } else {
    popupPoemId.value = poemId
    popupVisible.value = true
  }
}

const quizTypeLabels: Record<string, string> = {
  fillBlank: '补字选择',
  nextLine: '上下句接龙',
  recite: '背诵',
  line: '卡顿句',
  author: '作者',
  dynasty: '朝代',
}

function getPoemTitle(poemId: string): string {
  return poemStore.getPoemById(poemId)?.title ?? ''
}

const enabledWrongBook = computed(() => {
  return learningStore.wrongBook.filter(entry => poemStore.isEnabled(entry.poemId))
})

const groupedEntries = computed<GroupedWrongEntry[]>(() => {
  const map = new Map<string, GroupedWrongEntry>()
  for (const entry of enabledWrongBook.value) {
    let group = map.get(entry.poemId)
    if (!group) {
      const poem = poemStore.getPoemById(entry.poemId)
      const stats = poem
        ? learningStore.getCharMarkStats(entry.poemId, poem.text)
        : []
      group = {
        poemId: entry.poemId,
        poem,
        entries: [],
        quizTypeLabels: [],
        totalWrongCount: 0,
        charSummary: stats.length > 0 ? summarizeCharMarks(stats) : null,
      }
      map.set(entry.poemId, group)
    }
    group.entries.push(entry)
    const label = quizTypeLabels[entry.quizType] ?? entry.quizType
    if (!group.quizTypeLabels.includes(label)) group.quizTypeLabels.push(label)
    group.totalWrongCount += entry.wrongCount
  }
  return Array.from(map.values())
})

function mergedNotes(group: GroupedWrongEntry): string {
  return group.entries.filter(e => e.note).map(e => e.note).join('；')
}

function openMenu(entry: WrongEntry) {
  actionEntry.value = entry
}

function closeMenu() {
  actionEntry.value = null
}

function markUnproficient(entry: WrongEntry) {
  learningStore.toggleUnproficient(entry.poemId)
  closeMenu()
}

function removeEntry(entry: WrongEntry) {
  learningStore.removeWrongEntry(entry.poemId, entry.quizType, entry.note)
  closeMenu()
}
</script>

<template>
  <div class="w-full max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-6">错题本</h2>

    <div v-if="groupedEntries.length === 0" class="text-center text-gray-400 py-12">
      暂无错题
    </div>

    <div v-else class="mb-6">
      <div v-for="group in groupedEntries" :key="group.poemId" class="wrong-card p-3 bg-white border border-gray-200 rounded-lg mb-2 shadow-sm">
        <div class="flex items-center gap-2 mb-2">
          <span
            class="font-bold flex-1 cursor-pointer text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300"
            data-testid="poem-title"
            @click="togglePopup(group.poemId)"
          >{{ group.poem?.title ?? group.poemId }}</span>
          <span
            v-if="group.charSummary && group.charSummary.wrongCount + group.charSummary.fuzzyCount > 0"
            data-testid="char-summary"
            class="text-xs px-2 py-0.5 rounded bg-gray-50"
          >
            <span class="text-red-500">错{{ group.charSummary.wrongCount }}字</span>
            <span class="text-gray-400"> · </span>
            <span class="text-amber-500">模糊{{ group.charSummary.fuzzyCount }}字</span>
          </span>
          <span class="text-xs text-red-500">错 {{ group.totalWrongCount }} 次</span>
        </div>
        <div class="flex flex-wrap gap-1.5 mb-2">
          <span
            v-for="entry in group.entries"
            :key="entry.quizType + entry.note"
            data-testid="wrong-entry-label"
            class="cursor-pointer text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded"
            @click="openMenu(entry)"
          >{{ quizTypeLabels[entry.quizType] ?? entry.quizType }}</span>
        </div>
        <p v-if="mergedNotes(group)" class="text-xs text-gray-400 mb-2">{{ mergedNotes(group) }}</p>
      </div>
    </div>

    <div
      v-if="actionEntry"
      data-testid="entry-action-menu"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      @click.self="closeMenu"
    >
      <div class="bg-white rounded-lg p-4 w-56 shadow-lg">
        <div class="text-sm text-gray-500 text-center mb-3">
          {{ getPoemTitle(actionEntry.poemId) }} · {{ quizTypeLabels[actionEntry.quizType] ?? actionEntry.quizType }}
        </div>
        <div class="flex flex-col gap-2">
          <button
            data-testid="entry-mark-unproficient"
            class="px-3 py-2 text-xs border border-orange-400 bg-orange-50 text-orange-600 rounded"
            @click="markUnproficient(actionEntry)"
          >标不熟练</button>
          <button
            data-testid="entry-remove"
            class="px-3 py-2 text-xs border border-red-200 bg-red-50 text-red-500 rounded"
            @click="removeEntry(actionEntry)"
          >移除</button>
          <button
            data-testid="entry-cancel"
            class="px-3 py-2 text-xs border border-gray-200 rounded bg-white text-gray-500"
            @click="closeMenu"
          >取消</button>
        </div>
      </div>
    </div>

    <PoemPopup v-if="popupPoem" :poem="popupPoem" :char-mark-stats="popupCharMarkStats" v-model:visible="popupVisible" />

    <router-link :to="{ name: 'home' }" class="block text-center text-indigo-500 no-underline text-sm">返回首页</router-link>
  </div>
</template>
