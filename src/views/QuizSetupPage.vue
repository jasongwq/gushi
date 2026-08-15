<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import type { QuizType, SourceType } from '@/types'

const router = useRouter()
const quizStore = useQuizStore()

const source = ref<SourceType>('smart')
const quizTypes = ref<QuizType[]>(['fillBlank', 'nextLine'])
const count = ref(10)

const sourceOptions: { value: SourceType; label: string }[] = [
  { value: 'smart', label: '智能混合' },
  { value: 'grade', label: '按年级' },
  { value: 'all', label: '全部' },
  { value: 'review', label: '仅待复习' },
  { value: 'wrong', label: '错题本' },
  { value: 'unproficient', label: '不熟练' },
]

const quizTypeOptions: { value: QuizType; label: string }[] = [
  { value: 'fillBlank', label: '补字选择' },
  { value: 'nextLine', label: '上下句接龙' },
  { value: 'selectTitle', label: '选标题/作者/朝代' },
]

const countOptions = [5, 10, 20]

function toggleQuizType(type: QuizType) {
  const idx = quizTypes.value.indexOf(type)
  if (idx >= 0) quizTypes.value.splice(idx, 1)
  else quizTypes.value.push(type)
}

function startQuiz() {
  if (quizTypes.value.length === 0) return
  quizStore.startQuiz(source.value, quizTypes.value, count.value)
  router.push({ name: 'quiz-play' })
}
</script>

<template>
  <div class="quiz-setup-page">
    <h2>抽查设置</h2>

    <section class="setting-section">
      <h3>题目来源</h3>
      <select v-model="source" class="select-input">
        <option v-for="opt in sourceOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </section>

    <section class="setting-section">
      <h3>题目类型</h3>
      <div class="checkbox-group">
        <label v-for="opt in quizTypeOptions" :key="opt.value" class="checkbox-label">
          <input
            type="checkbox"
            :checked="quizTypes.includes(opt.value)"
            @change="toggleQuizType(opt.value)"
          />
          {{ opt.label }}
        </label>
      </div>
    </section>

    <section class="setting-section">
      <h3>题目数量</h3>
      <div class="count-group">
        <button
          v-for="n in countOptions"
          :key="n"
          :class="['count-btn', { active: count === n }]"
          @click="count = n"
        >
          {{ n }}
        </button>
      </div>
    </section>

    <button class="start-btn" :disabled="quizTypes.length === 0" @click="startQuiz">
      开始抽查
    </button>

    <button class="back-btn" @click="router.push({ name: 'home' })">返回首页</button>
  </div>
</template>

<style scoped>
.quiz-setup-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px 16px;
}

h2 {
  text-align: center;
  margin-bottom: 24px;
}

.setting-section {
  margin-bottom: 24px;
}

.setting-section h3 {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.select-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 16px;
  background: #fff;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  cursor: pointer;
}

.count-group {
  display: flex;
  gap: 12px;
}

.count-btn {
  flex: 1;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background: #fff;
  font-size: 16px;
  cursor: pointer;
}

.count-btn.active {
  border-color: #1976d2;
  background: #e3f2fd;
  color: #1565c0;
}

.start-btn {
  width: 100%;
  padding: 14px;
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  margin-bottom: 12px;
}

.start-btn:disabled {
  background: #bdbdbd;
  cursor: not-allowed;
}

.back-btn {
  width: 100%;
  padding: 10px;
  background: #fff;
  color: #666;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
</style>
