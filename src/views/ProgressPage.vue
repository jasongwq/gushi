<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLearningStore } from '@/stores/learning'
import { usePoemStore } from '@/stores/poem'
import { calculateDailyRetention } from '@/utils/retention'
import type { MasteryLevel } from '@/types'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const router = useRouter()
const learningStore = useLearningStore()
const poemStore = usePoemStore()

const totalPoems = computed(() => poemStore.enabledPoems.length)

const learnedCount = computed(() => {
  return learningStore.records.filter(r => r.masteryLevel !== '新').length
})

const masteryDistribution = computed(() => {
  const levels: MasteryLevel[] = ['新', '学', '熟', '固']
  return levels.map(level => ({
    level,
    count: learningStore.records.filter(r => r.masteryLevel === level).length,
  }))
})

const masteryColors: Record<string, string> = {
  '新': 'bg-gray-100 text-gray-500',
  '学': 'bg-blue-100 text-blue-600',
  '熟': 'bg-green-100 text-green-600',
  '固': 'bg-orange-100 text-orange-600',
}

// 遗忘曲线总览
const overviewCanvas = ref<HTMLCanvasElement | null>(null)
let overviewChart: Chart | null = null

function renderOverviewChart() {
  if (!overviewCanvas.value) return

  if (overviewChart) {
    overviewChart.destroy()
    overviewChart = null
  }

  const today = new Date()
  const endStr = today.toISOString().slice(0, 10)
  const start = new Date(today)
  start.setDate(start.getDate() - 29)
  const startStr = start.toISOString().slice(0, 10)

  const dailyData = calculateDailyRetention(learningStore.records, startStr, endStr)

  overviewChart = new Chart(overviewCanvas.value, {
    type: 'line',
    data: {
      labels: dailyData.map(d => d.date.slice(5)),
      datasets: [{
        label: '记忆保持率',
        data: dailyData.map(d => Math.round(d.retention * 100)),
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { callback: (v) => `${v}%` },
        },
      },
      plugins: {
        legend: { display: false },
      },
    },
  })
}

const showMasteryTip = ref(false)
const showRetentionTip = ref(false)

// 古诗列表
const poemList = computed(() => {
  return poemStore.enabledPoems.map(p => {
    const record = learningStore.getRecord(p.id)
    return {
      id: p.id,
      title: p.title,
      author: p.author,
      masteryLevel: record?.masteryLevel ?? '新',
      nextReviewDate: record?.nextReviewDate ?? '—',
    }
  }).sort((a, b) => {
    const order: Record<string, number> = { '新': 0, '学': 1, '熟': 2, '固': 3 }
    return order[a.masteryLevel] - order[b.masteryLevel]
  })
})

function goToDetail(poemId: string) {
  router.push({ name: 'poem-detail', params: { id: poemId } })
}

onMounted(() => {
  poemStore.fetchPoems()
  renderOverviewChart()
})
</script>

<template>
  <div class="w-full max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-6">学习进度</h2>

    <div class="text-center p-4 bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
      <div class="text-3xl font-bold text-indigo-500">{{ learnedCount }} / {{ totalPoems }}</div>
      <div class="text-sm text-gray-500 mt-1">已学 / 总数</div>
    </div>

    <div class="mb-4">
      <h3 class="text-sm text-gray-500 mb-2 flex items-center gap-1">
        掌握程度分布
        <span class="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-indigo-500 bg-indigo-100 rounded-full cursor-pointer select-none" @click="showMasteryTip = !showMasteryTip">!</span>
      </h3>
      <div v-if="showMasteryTip" class="text-xs text-gray-500 bg-indigo-50 rounded-lg p-3 mb-2 leading-relaxed">
        掌握程度分为四个等级：<strong>新</strong>（未学习）、<strong>学</strong>（已开始学习，复习1次）、<strong>熟</strong>（较熟悉，复习2次）、<strong>固</strong>（已巩固，复习3次及以上）。等级越高，说明复习次数越多，记忆越牢固。建议优先关注「新」和「学」的诗词，及时复习。
      </div>
      <div class="flex gap-3 justify-center">
        <div v-for="item in masteryDistribution" :key="item.level" class="flex flex-col items-center gap-1 p-3 bg-white border border-gray-200 rounded-lg shadow-sm min-w-[60px]">
          <span :class="['text-xl font-bold px-2 py-0.5 rounded', masteryColors[item.level]]">{{ item.level }}</span>
          <span class="text-lg font-bold">{{ item.count }}</span>
        </div>
      </div>
    </div>

    <!-- 遗忘曲线总览 -->
    <div class="mb-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h3 class="text-sm text-gray-500 mb-2 flex items-center gap-1">
        记忆保持率趋势（近30天）
        <span class="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-indigo-500 bg-indigo-100 rounded-full cursor-pointer select-none" @click="showRetentionTip = !showRetentionTip">!</span>
      </h3>
      <div v-if="showRetentionTip" class="text-xs text-gray-500 bg-indigo-50 rounded-lg p-3 mb-2 leading-relaxed">
        记忆保持率基于艾宾浩斯遗忘曲线计算，反映所有已学诗词的平均记忆强度。100% 表示完全记忆，0% 表示完全遗忘。曲线下降说明记忆正在衰退，需要及时复习；曲线上升说明复习有效，记忆得到了巩固。保持率越高，说明复习越及时。
      </div>
      <div style="height: 200px; position: relative;">
        <canvas ref="overviewCanvas"></canvas>
      </div>
    </div>

    <div class="text-center p-4 bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
      <div class="text-3xl font-bold text-orange-500">{{ learningStore.unproficientCount }}</div>
      <div class="text-sm text-gray-500 mt-1">不熟练</div>
    </div>

    <!-- 古诗列表 -->
    <div class="mb-4">
      <h3 class="text-sm text-gray-500 mb-2">古诗列表（点击查看详情）</h3>
      <div class="max-h-96 overflow-y-auto">
        <div
          v-for="item in poemList"
          :key="item.id"
          data-testid="poem-list-item"
          class="p-3 bg-white border border-gray-200 rounded-lg mb-1 cursor-pointer hover:bg-gray-50 transition flex items-center gap-2"
          @click="goToDetail(item.id)"
        >
          <span :class="['text-xs font-bold px-2 py-0.5 rounded', masteryColors[item.masteryLevel]]">{{ item.masteryLevel }}</span>
          <span class="flex-1 text-sm">{{ item.title }}</span>
          <span class="text-xs text-gray-400">{{ item.author }}</span>
        </div>
      </div>
    </div>

    <router-link :to="{ name: 'home' }" class="block text-center text-indigo-500 no-underline text-sm mt-6">返回首页</router-link>
  </div>
</template>
