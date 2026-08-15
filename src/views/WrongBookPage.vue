<script setup lang="ts">
import { useLearningStore } from '@/stores/learning'
import { usePoemStore } from '@/stores/poem'

const learningStore = useLearningStore()
const poemStore = usePoemStore()

const quizTypeLabels: Record<string, string> = {
  fillBlank: '补字选择',
  nextLine: '上下句接龙',
  selectTitle: '选标题/作者/朝代',
  recite: '背诵',
}

function getPoemTitle(poemId: string): string {
  return poemStore.getPoemById(poemId)?.title ?? ''
}
</script>

<template>
  <div class="wrong-book-page">
    <h2>错题本</h2>

    <div v-if="learningStore.wrongBook.length === 0" class="empty">
      暂无错题
    </div>

    <div v-else class="wrong-list">
      <div v-for="entry in learningStore.wrongBook" :key="entry.poemId + entry.quizType" class="wrong-item">
        <div class="wrong-info">
          <span class="poem-title">{{ getPoemTitle(entry.poemId) }}</span>
          <span class="quiz-type">{{ quizTypeLabels[entry.quizType] ?? entry.quizType }}</span>
          <span class="wrong-count">错 {{ entry.wrongCount }} 次</span>
        </div>
        <div class="wrong-actions">
          <button
            :class="['unproficient-btn', { active: entry.unproficient }]"
            @click="learningStore.toggleUnproficient(entry.poemId)"
          >
            {{ entry.unproficient ? '已标不熟练' : '标不熟练' }}
          </button>
          <button class="remove-btn" @click="learningStore.removeWrongEntry(entry.poemId, entry.quizType)">
            移除
          </button>
        </div>
      </div>
    </div>

    <router-link :to="{ name: 'home' }" class="back-link">返回首页</router-link>
  </div>
</template>

<style scoped>
.wrong-book-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px 16px;
}

h2 {
  text-align: center;
  margin-bottom: 24px;
}

.empty {
  text-align: center;
  color: #999;
  padding: 48px;
}

.wrong-list {
  margin-bottom: 24px;
}

.wrong-item {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 8px;
}

.wrong-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.poem-title {
  font-weight: bold;
  flex: 1;
}

.quiz-type {
  font-size: 12px;
  color: #666;
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 4px;
}

.wrong-count {
  font-size: 12px;
  color: #d32f2f;
}

.wrong-actions {
  display: flex;
  gap: 8px;
}

.unproficient-btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}

.unproficient-btn.active {
  border-color: #ff9800;
  background: #fff3e0;
  color: #e65100;
}

.remove-btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  color: #666;
  cursor: pointer;
}

.back-link {
  display: block;
  text-align: center;
  color: #1976d2;
  text-decoration: none;
  font-size: 14px;
}
</style>
