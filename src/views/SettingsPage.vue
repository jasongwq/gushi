<script setup lang="ts">
import { ref } from 'vue'
import { useLearningStore } from '@/stores/learning'

const learningStore = useLearningStore()

const importInput = ref<HTMLInputElement | null>(null)

function exportData() {
  const json = learningStore.exportUserData()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `古诗抽查_${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importData() {
  importInput.value?.click()
}

function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const success = learningStore.importUserData(reader.result as string)
    if (success) {
      alert('导入成功')
    } else {
      alert('导入失败，文件格式不正确')
    }
  }
  reader.readAsText(file)
  input.value = ''
}

function clearData() {
  if (confirm('确定要清除所有数据吗？此操作不可恢复。')) {
    learningStore.clearAllData()
    alert('数据已清除')
  }
}
</script>

<template>
  <div class="settings-page">
    <h2>设置</h2>

    <div class="settings-list">
      <button class="setting-btn" @click="exportData">
        导出数据
      </button>

      <button class="setting-btn" @click="importData">
        导入数据
      </button>
      <input ref="importInput" type="file" accept=".json" style="display: none" @change="handleImport" />

      <button class="setting-btn danger" @click="clearData">
        清除数据
      </button>
    </div>

    <router-link :to="{ name: 'home' }" class="back-link">返回首页</router-link>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px 16px;
}

h2 {
  text-align: center;
  margin-bottom: 24px;
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.setting-btn {
  padding: 14px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  font-size: 16px;
  cursor: pointer;
  text-align: left;
}

.setting-btn:active {
  background: #f5f5f5;
}

.setting-btn.danger {
  color: #d32f2f;
  border-color: #ffcdd2;
}

.setting-btn.danger:active {
  background: #ffebee;
}

.back-link {
  display: block;
  text-align: center;
  color: #1976d2;
  text-decoration: none;
  font-size: 14px;
}
</style>
