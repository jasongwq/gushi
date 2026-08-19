<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import { buildReviewPlan, type ReviewReason } from '@/utils/reviewPlan'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

onMounted(async () => {
  await poemStore.fetchPoems()
  initExpand()
})

const showCalcTip = ref(false)

const isLoading = computed(() => poemStore.loading)

const plan = computed(() => {
  if (poemStore.poems.length === 0) return []
  return buildReviewPlan(learningStore.records, learningStore.wrongBook, poemStore.enabledPoems, 30)
})

const activeDays = computed(() => plan.value.filter(d => d.items.length > 0))

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

    <div v-if="showCalcTip" class="text-xs text-gray-500 bg-indigo-50 rounded-lg p-3 mb-4 leading-relaxed">
      复习计划按以下规则计算：
      <ul class="list-disc pl-4 mt-1 space-y-0.5">
        <li><strong>到期复习</strong>：艾宾浩斯调度当天到期；逾期未复习的会落到今天</li>
        <li><strong>不熟练</strong>：标记了"不熟练"的诗，每天建议复习</li>
        <li><strong>错题本</strong>：最近答错的诗，错后第 2 天建议复习；逾期未复习的落到今天</li>
        <li><strong>新增学习</strong>：还没学过的诗，建议今天开始学</li>
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
          </div>
        </div>
      </div>
    </div>

    <router-link :to="{ name: 'home' }" class="block text-center text-indigo-500 no-underline text-sm mt-6">返回首页</router-link>
  </div>
</template>
