<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import { buildReviewPlan, type ReviewReason } from '@/utils/reviewPlan'
import { PACE_OPTIONS, parsePace } from '@/utils/schedule'
import type { Poem } from '@/types'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

const paceValue = ref('3')
const reviewPerDayValue = ref('3')
const showCalcTip = ref(false)

const isLoading = computed(() => poemStore.loading)

// 未学诗（无学习记录），按年级低→高、同年级按诗库顺序
const unlearnedPoems = computed(() => {
  const learnedIds = new Set(learningStore.records.map(r => r.poemId))
  const order: Record<string, number> = {
    '一年级': 1, '二年级': 2, '三年级': 3,
    '四年级': 4, '五年级': 5, '六年级': 6, '配读篇目': 7,
  }
  return poemStore.enabledPoems
    .filter(p => !learnedIds.has(p.id))
    .sort((a, b) => (order[a.grade] ?? 99) - (order[b.grade] ?? 99) || a.id.localeCompare(b.id))
})

const schedule = computed(() => learningStore.getSchedule())

const plan = computed(() => {
  if (poemStore.poems.length === 0) return []
  return buildReviewPlan(
    learningStore.records,
    learningStore.wrongBook,
    poemStore.enabledPoems,
    30,
    undefined,
    schedule.value,
  )
})

const activeDays = computed(() => plan.value.filter(d => d.items.length > 0))

// 已学标记：有学习记录的诗
function isLearned(poemId: string): boolean {
  return !!learningStore.getRecord(poemId)
}

// 展开状态：今天默认展开
const expandedDates = ref<Set<string>>(new Set())

function toggleDay(date: string) {
  const next = new Set(expandedDates.value)
  if (next.has(date)) next.delete(date)
  else next.add(date)
  expandedDates.value = next
}

function isExpanded(date: string): boolean {
  return expandedDates.value.has(date)
}

function initExpand() {
  const first = activeDays.value[0]
  if (first) expandedDates.value = new Set([first.date])
}

function rebuild() {
  const pendingReviews = learningStore.records.filter(r => r.nextReviewDate === '2099-01-01').length
  if (unlearnedPoems.value.length === 0 && pendingReviews === 0) return
  const pace = parsePace(paceValue.value)
  learningStore.rebuildSchedule(unlearnedPoems.value, pace, new Date().toISOString().slice(0, 10), parseInt(reviewPerDayValue.value, 10))
  initExpand()
}

onMounted(async () => {
  await poemStore.fetchPoems()
  // 无排程时自动生成（默认每天 3 首）
  if (Object.keys(learningStore.getSchedule()).length === 0) {
    rebuild()
  }
  initExpand()
})

// 底部未学区块：排到 30 天后的未学诗
const scheduledBeyond30 = computed(() =>
  unlearnedPoems.value.filter(p => {
    const date = schedule.value[p.id]
    if (!date) return false
    const todayStr = new Date().toISOString().slice(0, 10)
    const diff = (new Date(date + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 30
  })
)

const showNotLearned = ref(false)

// 批量配置已学
const showBatchConfig = ref(false)
const selectedLearned = ref<Set<string>>(new Set())

// 按年级分组的未学诗
const unlearnedByGrade = computed(() => {
  const map = new Map<string, Poem[]>()
  for (const p of unlearnedPoems.value) {
    const list = map.get(p.grade) ?? []
    list.push(p)
    map.set(p.grade, list)
  }
  return [...map.entries()]
})

function openBatchConfig() {
  selectedLearned.value = new Set()
  showBatchConfig.value = true
}

function toggleSelect(poemId: string) {
  const next = new Set(selectedLearned.value)
  if (next.has(poemId)) next.delete(poemId)
  else next.add(poemId)
  selectedLearned.value = next
}

function isSelected(poemId: string): boolean {
  return selectedLearned.value.has(poemId)
}

// 年级全选状态：'all' | 'partial' | 'none'
function gradeSelectionState(list: Poem[]): 'all' | 'partial' | 'none' {
  const total = list.length
  if (total === 0) return 'none'
  const selectedCount = list.filter(p => selectedLearned.value.has(p.id)).length
  if (selectedCount === total) return 'all'
  if (selectedCount > 0) return 'partial'
  return 'none'
}

function toggleGrade(list: Poem[]) {
  const next = new Set(selectedLearned.value)
  const allSelected = gradeSelectionState(list) === 'all'
  for (const p of list) {
    if (allSelected) next.delete(p.id)
    else next.add(p.id)
  }
  selectedLearned.value = next
}

// 同步年级复选框的半选状态（Vue 不直接支持 :indeterminate 绑定）
const gradeCheckboxRefs: Record<string, HTMLInputElement | null> = {}
function setGradeCheckboxRef(el: unknown, grade: string) {
  gradeCheckboxRefs[grade] = el as HTMLInputElement | null
}

watch(selectedLearned, () => {
  for (const [grade, list] of unlearnedByGrade.value) {
    const el = gradeCheckboxRefs[grade]
    if (el) el.indeterminate = gradeSelectionState(list) === 'partial'
  }
}, { deep: true })

function confirmMarkLearned() {
  if (selectedLearned.value.size === 0) return
  learningStore.markLearned([...selectedLearned.value])
  showBatchConfig.value = false
  initExpand()
}

const reasonLabels: Record<ReviewReason, string> = {
  due: '到期复习',
  unproficient: '不熟练',
  wrongBook: '错题本',
  new: '新增学习',
}

const reasonColors: Record<ReviewReason, string> = {
  due: 'bg-indigo-100 text-indigo-600',
  unproficient: 'bg-orange-100 text-orange-600',
  wrongBook: 'bg-red-100 text-red-600',
  new: 'bg-green-100 text-green-600',
}

function formatDay(date: string, index: number): string {
  if (index === 0) return '今天'
  const d = new Date(date + 'T00:00:00')
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return `${weekday} ${date.slice(5)}`
}

function goToDetail(poemId: string) {
  router.push({ name: 'poem-detail', params: { id: poemId } })
}
</script>

<template>
  <div class="w-full max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-1 flex items-center justify-center gap-1">
      复习计划
      <span
        class="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-indigo-500 bg-indigo-100 rounded-full cursor-pointer select-none"
        @click="showCalcTip = !showCalcTip"
      >!</span>
    </h2>
    <p class="text-sm text-gray-500 text-center mb-4">未来 30 天复习安排</p>

    <div class="flex items-center gap-2 mb-2">
      <label class="w-20 text-sm text-gray-500">每天学习数</label>
      <select v-model="paceValue" class="flex-1 p-2 border border-gray-200 rounded-lg text-sm bg-white focus:border-indigo-300 focus:outline-none">
        <option v-for="opt in PACE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    </div>
    <div class="flex items-center gap-2 mb-2">
      <label class="w-20 text-sm text-gray-500">每天复习数</label>
      <select v-model="reviewPerDayValue" class="flex-1 p-2 border border-gray-200 rounded-lg text-sm bg-white focus:border-indigo-300 focus:outline-none">
        <option value="1">1 首</option>
        <option value="3">3 首</option>
        <option value="5">5 首</option>
        <option value="10">10 首</option>
      </select>
    </div>
    <div class="flex items-center gap-2 mb-2">
      <button
        class="flex-1 p-2 bg-indigo-500 text-white rounded-lg text-sm cursor-pointer hover:bg-indigo-600 transition"
        @click="rebuild"
      >重排</button>
      <button
        class="flex-1 p-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-sm cursor-pointer hover:bg-indigo-50 transition"
        @click="openBatchConfig"
      >标记已读篇目</button>
    </div>
    <p class="text-xs text-gray-400 text-center mb-3">切换参数后点「重排」生效</p>

    <div v-if="showCalcTip" class="text-xs text-gray-500 bg-indigo-50 rounded-lg p-3 mb-4 leading-relaxed">
      复习计划按以下规则计算：
      <ul class="list-disc pl-4 mt-1 space-y-0.5">
        <li><strong>到期复习</strong>：艾宾浩斯调度当天到期；逾期未复习的会落到今天</li>
        <li><strong>不熟练</strong>：标记了"不熟练"的诗，每天建议复习</li>
        <li><strong>错题本</strong>：最近答错的诗，错后第 2 天建议复习；逾期未复习的落到今天</li>
        <li><strong>新增学习</strong>：按学习节奏排程到今天该学的诗</li>
      </ul>
    </div>

    <div v-if="isLoading" class="text-center text-gray-400 text-sm py-10">
      加载中…
    </div>
    <div v-else-if="activeDays.length === 0" class="text-center text-gray-400 text-sm py-10">
      暂无复习安排
    </div>

    <div v-for="(day, index) in activeDays" :key="day.date" class="mb-3">
      <div
        class="p-3 bg-white border border-gray-200 rounded-lg shadow-sm cursor-pointer"
        @click="toggleDay(day.date)"
      >
        <div class="flex items-center justify-between">
          <div class="font-medium">{{ formatDay(day.date, index) }}</div>
          <div class="text-xs text-gray-400">{{ day.items.length }} 首 {{ isExpanded(day.date) ? '▴' : '▾' }}</div>
        </div>
        <div v-if="isExpanded(day.date)" class="mt-2 space-y-1">
          <div
            v-for="item in day.items"
            :key="item.poemId"
            class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
            @click.stop="goToDetail(item.poemId)"
          >
            <span class="flex-1 text-sm">{{ poemStore.getPoemById(item.poemId)?.title ?? item.poemId }}</span>
            <span v-if="poemStore.getPoemById(item.poemId)?.author" class="text-xs text-gray-400">{{ poemStore.getPoemById(item.poemId)?.author }}</span>
            <span
              v-for="reason in item.reasons"
              :key="reason"
              :class="['text-xs px-1.5 py-0.5 rounded', reasonColors[reason]]"
            >{{ reasonLabels[reason] }}</span>
            <span v-if="isLearned(item.poemId)" class="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">已学</span>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-6 mb-3">
      <div
        class="p-3 bg-white border border-gray-200 rounded-lg shadow-sm cursor-pointer"
        @click="showNotLearned = !showNotLearned"
      >
        <div class="flex items-center justify-between">
          <div class="font-medium">未学（{{ scheduledBeyond30.length }} 首）</div>
          <div class="text-xs text-gray-400">{{ showNotLearned ? '▴' : '▾' }}</div>
        </div>
        <div v-if="showNotLearned" class="mt-2 space-y-1">
          <div v-if="scheduledBeyond30.length > 0" class="mt-1">
            <div class="text-xs text-gray-400 mb-1">已排期（30 天后）</div>
            <div
              v-for="p in scheduledBeyond30"
              :key="p.id"
              class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
              @click.stop="goToDetail(p.id)"
            >
              <span class="flex-1 text-sm">{{ p.title }}</span>
              <span v-if="p.author" class="text-xs text-gray-400">{{ p.author }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <router-link :to="{ name: 'home' }" class="block text-center text-indigo-500 no-underline text-sm mt-6">返回首页</router-link>

    <!-- 标记已读篇目 覆盖层 -->
    <div v-if="showBatchConfig" class="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div class="max-w-md mx-auto p-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold">标记已读篇目</h3>
          <button class="text-sm text-gray-500 cursor-pointer" @click="showBatchConfig = false">关闭</button>
        </div>
        <p class="text-xs text-gray-400 mb-3">勾选已经读过的诗（从学习队列移除，不再排入新增学习）</p>

        <div v-for="[grade, list] in unlearnedByGrade" :key="grade" class="mb-4">
          <label class="flex items-center gap-2 text-sm font-medium text-gray-500 mb-1 cursor-pointer">
            <input
              type="checkbox"
              :checked="gradeSelectionState(list) === 'all'"
              :ref="(el) => setGradeCheckboxRef(el, grade)"
              @change="toggleGrade(list)"
              class="w-4 h-4"
            />
            {{ grade }}（{{ list.length }} 首）
          </label>
          <div class="space-y-1">
            <label
              v-for="p in list"
              :key="p.id"
              class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <input type="checkbox" :checked="isSelected(p.id)" @change="toggleSelect(p.id)" class="w-4 h-4" />
              <span class="flex-1 text-sm">{{ p.title }}</span>
              <span v-if="p.author" class="text-xs text-gray-400">{{ p.author }}</span>
            </label>
          </div>
        </div>

        <div v-if="unlearnedByGrade.length === 0" class="text-center text-gray-400 text-sm py-8">
          没有未学的诗
        </div>

        <button
          class="w-full p-4 text-white rounded-lg text-lg font-medium cursor-pointer hover:bg-indigo-600 transition mb-3"
          :disabled="selectedLearned.size === 0"
          :class="selectedLearned.size === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-500'"
          @click="confirmMarkLearned"
        >确认标记（{{ selectedLearned.size }}）</button>
        <button class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-500 text-sm cursor-pointer hover:bg-gray-50 transition" @click="showBatchConfig = false">
          取消
        </button>
      </div>
    </div>
  </div>
</template>
