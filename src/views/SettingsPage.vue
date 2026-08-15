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
  <div class="max-w-md mx-auto p-4">
    <h2 class="text-xl font-bold text-center mb-6">设置</h2>

    <div class="flex flex-col gap-3 mb-6">
      <router-link to="/settings/poems" class="w-full p-4 border border-gray-200 rounded-lg bg-white text-base text-left cursor-pointer hover:bg-gray-50 transition block no-underline text-inherit">
        古诗配置
      </router-link>

      <button class="w-full p-4 border border-gray-200 rounded-lg bg-white text-base text-left cursor-pointer hover:bg-gray-50 transition" @click="exportData">
        导出数据
      </button>

      <button class="w-full p-4 border border-gray-200 rounded-lg bg-white text-base text-left cursor-pointer hover:bg-gray-50 transition" @click="importData">
        导入数据
      </button>
      <input ref="importInput" type="file" accept=".json" style="display: none" @change="handleImport" />

      <button class="w-full p-4 border border-red-200 rounded-lg bg-white text-base text-left cursor-pointer text-red-500 hover:bg-red-50 transition" @click="clearData">
        清除数据
      </button>
    </div>

    <router-link :to="{ name: 'home' }" class="block text-center text-indigo-500 no-underline text-sm">返回首页</router-link>
  </div>
</template>
