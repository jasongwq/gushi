<script setup lang="ts">
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'

const poemStore = usePoemStore()
const learningStore = useLearningStore()

poemStore.fetchPoems()
</script>

<template>
  <div class="home-page">
    <h1>古诗抽查</h1>

    <div v-if="learningStore.reviewDueCount > 0" class="review-banner" @click="$router.push({ name: 'quiz-setup' })">
      有 {{ learningStore.reviewDueCount }} 首诗待复习，点击开始复习
    </div>

    <div class="mode-buttons">
      <button class="mode-btn" @click="$router.push({ name: 'quiz-setup', query: { mode: 'parent' } })">
        家长抽查
      </button>
      <button class="mode-btn" @click="$router.push({ name: 'quiz-setup', query: { mode: 'self' } })">
        自主练习
      </button>
    </div>

    <div class="shortcuts">
      <button class="shortcut-btn" @click="$router.push({ name: 'wrong-book' })">
        错题本 ({{ learningStore.wrongCount }})
      </button>
      <button class="shortcut-btn" @click="$router.push({ name: 'progress' })">
        学习进度
      </button>
      <button class="shortcut-btn" @click="$router.push({ name: 'settings' })">
        设置
      </button>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px 16px;
  text-align: center;
}

h1 {
  font-size: 28px;
  margin-bottom: 24px;
}

.review-banner {
  background: #fff3e0;
  border: 1px solid #ffb74d;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 24px;
  cursor: pointer;
  color: #e65100;
  font-size: 14px;
}

.mode-buttons {
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
}

.mode-btn {
  flex: 1;
  padding: 20px;
  font-size: 18px;
  border: 2px solid #1976d2;
  border-radius: 12px;
  background: #e3f2fd;
  color: #1565c0;
  cursor: pointer;
  transition: background 0.2s;
}

.mode-btn:active {
  background: #bbdefb;
}

.shortcuts {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.shortcut-btn {
  padding: 10px 16px;
  font-size: 14px;
  border: 1px solid #90a4ae;
  border-radius: 8px;
  background: #fff;
  color: #37474f;
  cursor: pointer;
  transition: background 0.2s;
}

.shortcut-btn:active {
  background: #eceff1;
}
</style>
