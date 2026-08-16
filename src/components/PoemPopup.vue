<template>
  <Teleport to="body">
    <Transition name="popup">
      <div
        v-if="visible"
        class="popup-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="古诗详情"
        @keydown.tab.prevent="trapFocus"
        @click.self="$emit('update:visible', false)"
      >
        <div class="popup-content" ref="contentRef" tabindex="-1">
          <div class="popup-header">
            <h3 class="popup-title">{{ poem.title }}</h3>
            <span class="popup-meta">{{ poem.dynasty }}·{{ poem.author }}</span>
          </div>
          <div class="popup-body">
            <p v-for="(line, i) in poem.text" :key="i" class="popup-line">{{ line }}</p>
          </div>
          <div class="popup-yiwen-toggle">
            <button
              :class="['yiwen-btn', showYiwen ? 'yiwen-btn-active' : '']"
              @click="toggleYiwen"
            >
              {{ showYiwen ? '隐藏译文 ▴' : '显示译文 ▾' }}
            </button>
          </div>
          <div v-if="showYiwen" class="popup-yiwen">
            <p class="yiwen-text">{{ poem.yiwen }}</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import type { Poem } from '@/types'
import { useLearningStore } from '@/stores/learning'

const props = defineProps<{
  poem: Poem
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const learningStore = useLearningStore()
const showYiwen = ref(learningStore.settings.showYiwen ?? false)
const contentRef = ref<HTMLElement | null>(null)

watch(() => props.visible, (v) => {
  if (v) {
    showYiwen.value = learningStore.settings.showYiwen ?? false
    nextTick(() => contentRef.value?.focus())
    document.addEventListener('keydown', onDocumentKeydown)
  } else {
    document.removeEventListener('keydown', onDocumentKeydown)
  }
}, { immediate: true })

// 文档级 Escape 监听：弹窗打开时按 Escape 关闭（无论焦点在何处）
function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.visible) {
    emit('update:visible', false)
  }
}

onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKeydown))

// 焦点陷阱：Tab 循环限制在弹窗内
function trapFocus(e: KeyboardEvent) {
  const content = contentRef.value
  if (!content) return
  const focusables = content.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (e.shiftKey) {
    if (active === first || !content.contains(active)) {
      e.preventDefault()
      last.focus()
    }
  } else {
    if (active === last || !content.contains(active)) {
      e.preventDefault()
      first.focus()
    }
  }
}

function toggleYiwen() {
  showYiwen.value = !showYiwen.value
  learningStore.updateSettings({ showYiwen: showYiwen.value })
}
</script>

<style scoped>
.popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}
.popup-content {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 320px;
  width: 100%;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
  outline: none;
}
.popup-header {
  text-align: center;
  margin-bottom: 1rem;
}
.popup-title {
  font-size: 1.125rem;
  font-weight: bold;
  color: var(--color-text);
}
.popup-meta {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-top: 0.25rem;
  display: block;
}
.popup-body {
  text-align: center;
}
.popup-line {
  font-size: 1rem;
  line-height: 2;
  color: var(--color-text);
}
.popup-yiwen-toggle {
  text-align: center;
  margin-top: 0.75rem;
}
.yiwen-btn {
  font-size: 0.8125rem;
  color: #6366f1;
  background: #eef2ff;
  border: 2px solid #c7d2fe;
  border-radius: 6px;
  cursor: pointer;
  padding: 0.375rem 1rem;
  transition: all 0.15s;
}
.yiwen-btn:hover {
  background: #e0e7ff;
}
.yiwen-btn-active {
  background: #6366f1;
  color: white;
  border-color: #6366f1;
}
.yiwen-btn-active:hover {
  background: #4f46e5;
}
.popup-yiwen {
  text-align: center;
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid #f0f0f0;
}
.yiwen-text {
  font-size: 0.875rem;
  line-height: 1.8;
  color: var(--color-text-secondary);
}
.popup-enter-active,
.popup-leave-active {
  transition: opacity 0.2s ease;
}
.popup-enter-from,
.popup-leave-to {
  opacity: 0;
}
</style>
