<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import { calculatePoemRetentionTimeline } from '@/utils/retention'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const route = useRoute()
const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

const poemId = computed(() => route.params.id as string)
const poem = computed(() => poemStore.getPoemById(poemId.value))
const record = computed(() => learningStore.getRecord(poemId.value))

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null
const showYiwen = ref(learningStore.settings.showYiwen ?? false)

function toggleYiwen() {
  showYiwen.value = !showYiwen.value
  learningStore.updateSettings({ showYiwen: showYiwen.value })
}

const quizCorrectRate = computed(() => {
  if (!record.value || record.value.correctness.length === 0) return null
  const correct = record.value.correctness.filter(c => c === 1).length
  return Math.round((correct / record.value.correctness.length) * 100)
})

const reciteCorrectRate = computed(() => {
  if (!record.value || record.value.reciteCorrectness.length === 0) return null
  const correct = record.value.reciteCorrectness.filter(c => c === 1).length
  return Math.round((correct / record.value.reciteCorrectness.length) * 100)
})

const nextReviewDate = computed(() => record.value?.nextReviewDate ?? '—')
const masteryLevel = computed(() => record.value?.masteryLevel ?? '新')

function renderChart() {
  if (!chartCanvas.value || !record.value) return

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  const timeline = calculatePoemRetentionTimeline(record.value, new Date().toISOString().slice(0, 10))
  if (timeline.length === 0) return

  chartInstance = new Chart(chartCanvas.value, {
    type: 'line',
    data: {
      labels: timeline.map(p => p.date),
      datasets: [
        {
          label: '答题',
          data: timeline.map(p => p.type === 'quiz' ? (p.correct ? 1 : 0.3) : null),
          borderColor: '#4f46e5',
          backgroundColor: '#4f46e5',
          pointRadius: 6,
          pointStyle: 'circle',
          spanGaps: false,
          showLine: false,
        },
        {
          label: '背诵',
          data: timeline.map(p => p.type === 'recite' ? (p.correct ? 1 : 0.3) : null),
          borderColor: '#22c55e',
          backgroundColor: '#22c55e',
          pointRadius: 6,
          pointStyle: 'circle',
          spanGaps: false,
          showLine: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 1,
          ticks: {
            callback: (value) => `${(Number(value) * 100).toFixed(0)}%`,
          },
        },
        x: {
          ticks: {
            maxRotation: 45,
          },
        },
      },
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const point = timeline[context.dataIndex]
              if (!point) return ''
              return `${point.type === 'quiz' ? '答题' : '背诵'}：${point.correct ? '正确' : '错误'}`
            },
          },
        },
      },
    },
  })
}

onMounted(() => {
  if (poem.value) renderChart()
})

watch(poemId, () => {
  if (poem.value) renderChart()
})
</script>

<template>
  <div class="max-w-md mx-auto p-4">
    <template v-if="poem">
      <h2 class="text-xl font-bold text-center mb-2">{{ poem.title }}</h2>
      <p class="text-center text-gray-500 mb-4">{{ poem.dynasty }} · {{ poem.author }} · {{ poem.grade }}</p>

      <!-- 基本信息 -->
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="text-center p-3 bg-white border border-gray-200 rounded-lg">
          <div class="text-lg font-bold text-indigo-500">{{ masteryLevel }}</div>
          <div class="text-xs text-gray-500">掌握等级</div>
        </div>
        <div class="text-center p-3 bg-white border border-gray-200 rounded-lg">
          <div class="text-lg font-bold text-orange-500">{{ nextReviewDate }}</div>
          <div class="text-xs text-gray-500">下次复习</div>
        </div>
        <div class="text-center p-3 bg-white border border-gray-200 rounded-lg">
          <div class="text-lg font-bold text-gray-500">{{ record?.reviewCount ?? 0 }}</div>
          <div class="text-xs text-gray-500">复习次数</div>
        </div>
      </div>

      <!-- 正确率 -->
      <div class="flex gap-3 mb-4">
        <div v-if="quizCorrectRate !== null" class="flex-1 text-center p-3 bg-indigo-50 rounded-lg">
          <div class="text-lg font-bold text-indigo-600">{{ quizCorrectRate }}%</div>
          <div class="text-xs text-gray-500">答题正确率</div>
        </div>
        <div v-if="reciteCorrectRate !== null" class="flex-1 text-center p-3 bg-green-50 rounded-lg">
          <div class="text-lg font-bold text-green-600">{{ reciteCorrectRate }}%</div>
          <div class="text-xs text-gray-500">背诵正确率</div>
        </div>
      </div>

      <!-- 遗忘曲线图 -->
      <div class="mb-4 p-4 bg-white border border-gray-200 rounded-lg">
        <h3 class="text-sm text-gray-500 mb-2">遗忘曲线</h3>
        <div style="height: 250px; position: relative;">
          <canvas ref="chartCanvas"></canvas>
        </div>
        <p v-if="!record || record.reviewCount === 0" class="text-center text-gray-400 text-sm py-8">暂无学习数据</p>
      </div>

      <!-- 原文 -->
      <div class="p-4 bg-white border border-gray-200 rounded-lg mb-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm text-gray-500">原文</h3>
          <button
            :class="['px-3 py-1.5 text-xs rounded-lg border-2 cursor-pointer transition', showYiwen ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-indigo-200 bg-indigo-50 text-indigo-600']"
            @click="toggleYiwen"
          >
            {{ showYiwen ? '隐藏译文 ▴' : '显示译文 ▾' }}
          </button>
        </div>
        <p v-for="(line, i) in poem.text" :key="i" class="text-lg leading-relaxed text-center">{{ line }}</p>
      </div>

      <!-- 译文 -->
      <div v-if="showYiwen" class="p-4 bg-white border border-gray-200 rounded-lg mb-4">
        <h3 class="text-sm text-gray-500 mb-2">译文</h3>
        <p class="text-sm leading-relaxed text-center text-gray-500">{{ poem.yiwen }}</p>
      </div>
    </template>

    <div v-else class="text-center text-gray-500 py-8">古诗不存在</div>

    <button class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-500 text-sm cursor-pointer hover:bg-gray-50 transition" @click="router.back()">
      返回
    </button>
  </div>
</template>
