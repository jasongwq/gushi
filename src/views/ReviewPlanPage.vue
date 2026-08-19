<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import { buildReviewPlan, type ReviewReason } from '@/utils/reviewPlan'
import { PACE_OPTIONS, parsePace } from '@/utils/schedule'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

const paceValue = ref('3')
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
  if (unlearnedPoems.value.length === 0) return
  const pace = parsePace(paceValue.value)
  learningStore.rebuildSchedule(unlearnedPoems.value, pace, new Date().toISOString().slice(0, 10))
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

// 底部未学区块分组
const notScheduled = computed(() =>
  unlearnedPoems.value.filter(p => !(p.id in schedule.value))
)
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
      <select v-model="paceValue" class="flex-1 p-2 border border-gray-200 rounded-lg text-sm bg-white focus:border-indigo-300 focus:outline-none">
        <option v-for="opt in PACE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <button
        class="px-3 py-2 bg-indigo-500 text-white rounded-lg text-sm cursor-pointer hover:bg-indigo-600 transition"
        @click="rebuild"
      >重排</button>
    </div>
    <p class="text-xs text-gray-400 text-center mb-3">切换节奏后点「重排」生效</p>

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
          <div class="font-medium">未学（{{ notScheduled.length + scheduledBeyond30.length }} 首）</div>
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
          <div v-if="notScheduled.length > 0" class="mt-1">
            <div class="text-xs text-gray-400 mb-1">未排期</div>
            <div
              v-for="p in notScheduled"
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
  </div>
</template>
