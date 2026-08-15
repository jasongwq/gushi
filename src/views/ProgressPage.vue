<script setup lang="ts">
import { computed } from 'vue'
import { useLearningStore } from '@/stores/learning'
import { usePoemStore } from '@/stores/poem'
import type { MasteryLevel } from '@/types'

const learningStore = useLearningStore()
const poemStore = usePoemStore()

const totalPoems = computed(() => poemStore.poems.length)

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
</script>

<template>
  <div class="progress-page">
    <h2>学习进度</h2>

    <div class="stat-card">
      <div class="stat-value">{{ learnedCount }} / {{ totalPoems }}</div>
      <div class="stat-label">已学 / 总数</div>
    </div>

    <div class="mastery-section">
      <h3>掌握程度分布</h3>
      <div class="mastery-list">
        <div v-for="item in masteryDistribution" :key="item.level" class="mastery-item">
          <span :class="['mastery-level', 'level-' + item.level]">{{ item.level }}</span>
          <span class="mastery-count">{{ item.count }}</span>
        </div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-value">{{ learningStore.unproficientCount }}</div>
      <div class="stat-label">不熟练</div>
    </div>

    <router-link :to="{ name: 'home' }" class="back-link">返回首页</router-link>
  </div>
</template>

<style scoped>
.progress-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px 16px;
}

h2 {
  text-align: center;
  margin-bottom: 24px;
}

.stat-card {
  text-align: center;
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 16px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #1976d2;
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

.mastery-section {
  margin-bottom: 16px;
}

.mastery-section h3 {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.mastery-list {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.mastery-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  min-width: 60px;
}

.mastery-level {
  font-size: 20px;
  font-weight: bold;
}

.level-新 { color: #9e9e9e; }
.level-学 { color: #1976d2; }
.level-熟 { color: #388e3c; }
.level-固 { color: #e65100; }

.mastery-count {
  font-size: 18px;
  font-weight: bold;
}

.back-link {
  display: block;
  text-align: center;
  color: #1976d2;
  text-decoration: none;
  font-size: 14px;
  margin-top: 24px;
}
</style>
