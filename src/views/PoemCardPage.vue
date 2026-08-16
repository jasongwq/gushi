<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import CardSwiper from '@/components/CardSwiper.vue'
import PoemCard from '@/components/PoemCard.vue'
import MysteryBox from '@/components/MysteryBox.vue'
import RecitationCard from '@/components/RecitationCard.vue'
import { SwiperSlide } from 'swiper/vue'
import type { Poem, RecitationResult, SourceType } from '@/types'
import { getReviewPoems, getWrongPoems, getUnproficientPoems, shuffleArray } from '@/utils/quiz'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

onMounted(() => poemStore.fetchPoems())

// ========== 视图状态 ==========
type ViewMode = 'swiper' | 'mystery'
type ViewLayer = 'browse' | 'detail'

const viewMode = ref<ViewMode>('swiper')
const viewLayer = ref<ViewLayer>('browse')

// 当前正在查看的古诗
const currentPoem = ref<Poem | null>(null)

// 盲盒来源标记：从盲盒进入详情时，滑动只显示盲盒4首
const mysteryPoems = ref<Poem[]>([])
const mysteryRevealedPoems = ref<Poem[]>([]) // 仅已开盲盒中的诗
const fromMystery = ref(false)

// ========== 筛选 ==========
const source = ref<SourceType>('all')
const selectedGrades = ref<string[]>([])

const sourceOptions: { value: SourceType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'smart', label: '智能混合' },
  { value: 'grade', label: '按年级' },
  { value: 'review', label: '待复习' },
  { value: 'wrong', label: '错题本' },
  { value: 'unproficient', label: '不熟练' },
]

const showGradeSelector = computed(() => source.value === 'grade')

function toggleGrade(grade: string) {
  const idx = selectedGrades.value.indexOf(grade)
  if (idx >= 0) selectedGrades.value.splice(idx, 1)
  else selectedGrades.value.push(grade)
}

// ========== 古诗列表 ==========
const today = new Date().toISOString().split('T')[0]

const allPoems = computed(() => {
  const enabled = poemStore.enabledPoems
  if (source.value === 'all') return enabled
  if (source.value === 'smart') return shuffleArray(enabled)
  if (source.value === 'grade') return enabled.filter(p => selectedGrades.value.includes(p.grade))
  if (source.value === 'review') return getReviewPoems(enabled, learningStore.records, today)
  if (source.value === 'wrong') return getWrongPoems(enabled, learningStore.wrongBook)
  if (source.value === 'unproficient') return getUnproficientPoems(enabled, learningStore.records)
  return enabled
})

// 滑动中的诗列表：从盲盒来时只显示盲盒4首，否则显示全部
const poems = computed(() => fromMystery.value ? mysteryPoems.value : allPoems.value)

// 当前卡片索引
const currentIndex = ref(0)

// ========== 已抽查 ==========
const checkedPoemIds = ref(new Set<string>())

function saveResult(result: RecitationResult) {
  checkedPoemIds.value.add(result.poemId)

  if (result.overallStatus === 'mastered') {
    learningStore.recordAnswer(result.poemId, 'recite', true)
  } else {
    learningStore.recordAnswer(result.poemId, 'recite', false)
    for (const line of result.lines) {
      if (line.status === 'stuck' || line.status === 'forgot') {
        learningStore.recordAnswer(result.poemId, 'recite', false, `第${line.lineIndex + 1}句:${line.status}`)
      }
    }
  }
  if (result.authorCorrect === false) {
    learningStore.recordAnswer(result.poemId, 'author', false)
  }
  if (result.dynastyCorrect === false) {
    learningStore.recordAnswer(result.poemId, 'dynasty', false)
  }
}

// ========== 进入详情 ==========
const detailEnterAnim = ref(false)

function enterDetail(poem: Poem) {
  currentPoem.value = poem
  // 同步浏览层索引到当前诗
  const idx = poems.value.findIndex(p => p.id === poem.id)
  if (idx >= 0) currentIndex.value = idx

  // 进入动画：初始 scale(0.85) opacity(0)，nextTick 后 transition 到正常
  detailEnterAnim.value = true
  viewLayer.value = 'detail'
  nextTick(() => {
    detailEnterAnim.value = false
  })
}

// 返回浏览层
function goBackToBrowse() {
  viewLayer.value = 'browse'
  const idx = poems.value.findIndex(p => p.id === currentPoem.value?.id)
  if (idx >= 0) currentIndex.value = idx
}

// 滑动模式点击卡片
function onCardClick(poem: Poem) {
  enterDetail(poem)
}

// 盲盒揭示时记录
function onMysteryRevealed(_poem: Poem) {
  // 盲盒揭示时不做跳转，等用户点击
}

// ========== 详情页 ==========
function onDetailSubmit(result: RecitationResult) {
  saveResult(result)
  // 盲盒模式下，只在已开盲盒之间切换，不跳到未开盲盒
  if (fromMystery.value) {
    const navList = mysteryRevealedPoems.value
    const idx = navList.findIndex(p => p.id === currentPoem.value?.id)
    if (idx >= 0 && idx < navList.length - 1) {
      currentPoem.value = navList[idx + 1]
    } else {
      // 已开盲盒都查完了，返回盲盒页面
      viewLayer.value = 'browse'
      viewMode.value = 'mystery'
    }
    return
  }
  // 标记后自动进入下一首
  const idx = poems.value.findIndex(p => p.id === currentPoem.value?.id)
  if (idx >= 0 && idx < poems.value.length - 1) {
    currentPoem.value = poems.value[idx + 1]
  } else {
    // 最后一首，返回浏览
    viewLayer.value = 'browse'
  }
}

function onDetailGoPrev() {
  if (fromMystery.value) {
    const navList = mysteryRevealedPoems.value
    const idx = navList.findIndex(p => p.id === currentPoem.value?.id)
    if (idx > 0) {
      currentPoem.value = navList[idx - 1]
    }
    return
  }
  const idx = poems.value.findIndex(p => p.id === currentPoem.value?.id)
  if (idx > 0) {
    currentPoem.value = poems.value[idx - 1]
  }
}

// ========== 跟手拖拽返回 ==========
const SWIPE_THRESHOLD = 100

type DragPhase = 'idle' | 'pending' | 'dragging' | 'settling'
const dragPhase = ref<DragPhase>('idle')
const dragDeltaX = ref(0)
let dragStartX = 0
let dragStartY = 0
let dragDirection: 'h' | 'v' | null = null

const dragProgress = computed(() =>
  Math.min(Math.abs(dragDeltaX.value) / SWIPE_THRESHOLD, 1)
)

const dragScale = computed(() =>
  1 - dragProgress.value * 0.15 // 1.0 → 0.85
)

const dragOpacity = computed(() =>
  1 - dragProgress.value // 1.0 → 0.0
)

const detailLayerStyle = computed(() => {
  if (dragPhase.value === 'idle') {
    if (detailEnterAnim.value) {
      return { transform: 'scale(0.85)', opacity: '0', transition: 'none' }
    }
    return {}
  }
  if (dragPhase.value === 'settling') {
    // settling 时用 CSS transition，目标值由 dragDeltaX 决定
    return {
      transform: `scale(${dragScale.value})`,
      opacity: String(dragOpacity.value),
      transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.25s cubic-bezier(0.4,0,0.2,1)',
    }
  }
  // dragging 时无 transition，跟手
  return {
    transform: `scale(${dragScale.value})`,
    opacity: String(dragOpacity.value),
    transition: 'none',
  }
})

function onDetailTouchStart(e: TouchEvent) {
  if (dragPhase.value === 'settling') return
  const touch = e.touches[0]
  dragStartX = touch.clientX
  dragStartY = touch.clientY
  dragDirection = null
  dragPhase.value = 'pending'
  dragDeltaX.value = 0
}

function onDetailTouchMove(e: TouchEvent) {
  if (dragPhase.value !== 'pending' && dragPhase.value !== 'dragging') return
  const touch = e.touches[0]
  const deltaX = touch.clientX - dragStartX
  const deltaY = touch.clientY - dragStartY

  // 方向判断（仅首次）
  if (dragDirection === null) {
    if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) return
    dragDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'h' : 'v'
  }

  if (dragDirection === 'v') {
    // 垂直方向，放弃拖拽，恢复正常滚动
    dragPhase.value = 'idle'
    return
  }

  // 水平方向，阻止默认行为（防止滚动），进入拖拽
  e.preventDefault()
  dragPhase.value = 'dragging'
  dragDeltaX.value = deltaX
}

function onDetailTouchEnd() {
  if (dragPhase.value !== 'dragging' && dragPhase.value !== 'pending') return

  if (dragPhase.value === 'pending' || Math.abs(dragDeltaX.value) < SWIPE_THRESHOLD) {
    // 未达阈值，弹回
    dragPhase.value = 'settling'
    dragDeltaX.value = 0
    setTimeout(() => {
      dragPhase.value = 'idle'
    }, 260)
    return
  }

  // 达到阈值，完成返回
  dragPhase.value = 'settling'
  dragDeltaX.value = dragDeltaX.value > 0 ? SWIPE_THRESHOLD : -SWIPE_THRESHOLD
  setTimeout(() => {
    dragPhase.value = 'idle'
    dragDeltaX.value = 0
    goBackToBrowse()
  }, 260)
}

// ========== 盲盒相关 ==========
const mysteryBoxRef = ref<InstanceType<typeof MysteryBox> | null>(null)

function onMysterySelectAndEnter(poem: Poem) {
  fromMystery.value = true
  // 记录盲盒中的诗列表
  if (mysteryBoxRef.value) {
    mysteryPoems.value = [...mysteryBoxRef.value.revealedPoems]
  }
  // 只记录已开盲盒中的诗（用于详情页导航）
  mysteryRevealedPoems.value = mysteryBoxRef.value?.boxes
    ? mysteryBoxRef.value.boxes
        .filter((b: { state: string; poem: Poem | null }) => b.state === 'revealed' && b.poem)
        .map((b: { poem: Poem | null }) => b.poem!)
    : []
  // 同步当前诗到已开盲盒列表索引
  const idx = mysteryRevealedPoems.value.findIndex(p => p.id === poem.id)
  if (idx >= 0) currentIndex.value = idx
  enterDetail(poem)
}

// 从盲盒模式切换到全局古诗
function switchToGlobal() {
  fromMystery.value = false
  // 定位到当前诗在全局列表中的位置
  if (currentPoem.value) {
    const idx = allPoems.value.findIndex(p => p.id === currentPoem.value?.id)
    if (idx >= 0) currentIndex.value = idx
  }
}

// ========== 统计 ==========
const checkedCount = computed(() => checkedPoemIds.value.size)
const totalCount = computed(() => allPoems.value.length)

// ========== 进度条 ==========
const currentPoemTitle = computed(() => {
  const poem = poems.value[currentIndex.value]
  if (!poem) return ''
  return poem.title.slice(0, 2)
})

const progressPercent = computed(() =>
  poems.value.length > 0 ? ((currentIndex.value + 1) / poems.value.length) * 100 : 0
)

// 详情页的进度信息
const detailProgress = computed(() => {
  if (!currentPoem.value) return { text: '', percent: 0 }
  const navList = fromMystery.value ? mysteryRevealedPoems.value : poems.value
  const idx = navList.findIndex(p => p.id === currentPoem.value?.id)
  const total = navList.length
  return {
    text: `${idx + 1}/${total}`,
    percent: ((idx + 1) / total) * 100,
  }
})
</script>

<template>
  <div class="poem-card-page max-w-md mx-auto h-dvh flex flex-col bg-gray-50 relative overflow-hidden">
    <!-- ====== 详情层（始终渲染，z-index 覆盖） ====== -->
    <div
      v-if="viewLayer === 'detail' && currentPoem"
      class="detail-layer absolute inset-0 flex flex-col bg-gray-50 z-10"
      :style="detailLayerStyle"
      @touchstart="onDetailTouchStart"
      @touchmove="onDetailTouchMove"
      @touchend="onDetailTouchEnd"
      @touchcancel="onDetailTouchEnd"
    >
      <!-- 顶部标题栏 - 固定高度 -->
      <div class="shrink-0 p-4 pb-2">
        <div class="flex items-center justify-between mb-2">
          <button class="text-gray-400 text-sm" @click="goBackToBrowse">← 返回</button>
          <span class="text-xs text-gray-400">{{ detailProgress.text }}</span>
        </div>
        <!-- 进度条 -->
        <div class="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full bg-indigo-500 rounded-full transition-all duration-300" :style="{ width: detailProgress.percent + '%' }"></div>
        </div>
      </div>
      <!-- 古诗正文区域 - flex-1 占剩余空间，内部可滚动 -->
      <RecitationCard
        class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4"
        :poem="currentPoem"
        :can-go-prev="fromMystery ? mysteryRevealedPoems.findIndex(p => p.id === currentPoem?.id) > 0 : poems.findIndex(p => p.id === currentPoem?.id) > 0"
        @submit="onDetailSubmit"
        @go-prev="onDetailGoPrev"
      />
      <!-- 底部区域 - 固定高度 -->
      <div class="shrink-0 p-3 bg-white border-t border-gray-100 text-center">
        <span class="text-xs text-gray-300">左右滑动返回卡片浏览</span>
        <button
          v-if="fromMystery"
          class="ml-3 text-xs text-purple-400 cursor-pointer"
          @click="viewLayer = 'browse'; viewMode = 'mystery'"
        >返回盲盒</button>
        <button
          v-if="fromMystery"
          class="ml-2 text-xs text-indigo-400 cursor-pointer"
          @click="switchToGlobal"
        >全部古诗</button>
      </div>
    </div>

    <!-- ====== 浏览层（始终渲染，在详情层下方） ====== -->
    <div class="flex flex-col flex-1 min-h-0">
      <!-- 顶部筛选栏 -->
      <div class="p-3 bg-white border-b border-gray-100">
        <div class="flex items-center gap-2 mb-2">
          <button class="text-gray-400 text-sm" @click="router.push({ name: 'home' })">← 返回</button>
          <span class="text-sm text-gray-500 ml-auto">已查 {{ checkedCount }} / {{ totalCount }} 首</span>
        </div>
        <div class="flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="opt in sourceOptions"
            :key="opt.value"
            :class="['px-3 py-1.5 text-xs rounded-full border whitespace-nowrap cursor-pointer transition', source === opt.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500']"
            @click="source = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
        <div v-if="showGradeSelector" class="flex flex-wrap gap-2 mt-2">
          <button
            v-for="grade in poemStore.grades"
            :key="grade"
            :class="['px-2 py-1 text-xs rounded border cursor-pointer transition', selectedGrades.includes(grade) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-400']"
            @click="toggleGrade(grade)"
          >
            {{ grade }}
          </button>
        </div>
      </div>

      <!-- 卡片区域 -->
      <div class="flex-1 min-h-0 p-4">
        <!-- 盲盒模式 -->
        <MysteryBox
          v-if="viewMode === 'mystery' && allPoems.length > 0"
          ref="mysteryBoxRef"
          :poems="allPoems"
          @revealed="onMysteryRevealed"
          @select="onMysterySelectAndEnter"
        />

        <!-- 滑动模式 -->
        <CardSwiper v-else-if="viewMode === 'swiper' && poems.length > 0" v-model="currentIndex" :count="poems.length">
          <SwiperSlide v-for="(poem, index) in poems" :key="poem.id + '-' + index">
            <PoemCard
              :poem="poem"
              :checked="checkedPoemIds.has(poem.id)"
              @click="onCardClick(poem)"
            />
          </SwiperSlide>
        </CardSwiper>

        <div v-else class="h-full flex items-center justify-center text-gray-400">
          没有符合条件的古诗
        </div>
      </div>

      <!-- 底部工具栏 -->
      <div class="bg-white border-t border-gray-100">
        <!-- 滑动模式：进度条 -->
        <div v-if="viewMode === 'swiper' && poems.length > 0" class="px-4 pt-2 pb-1">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs text-gray-400">{{ currentIndex + 1 }}/{{ poems.length }} {{ currentPoemTitle }}</span>
            <span v-if="fromMystery" class="text-xs text-purple-400 cursor-pointer" @click="viewMode = 'mystery'">返回盲盒</span>
          </div>
          <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div class="h-full bg-indigo-500 rounded-full transition-all duration-300" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <p class="text-center text-xs text-gray-300 mt-1">点击卡片进入详情</p>
        </div>

        <!-- 模式切换按钮 -->
        <div class="p-3 flex gap-3">
          <button
            :disabled="allPoems.length === 0"
            :class="['flex-1 py-3 rounded-xl text-base font-medium cursor-pointer transition', viewMode === 'swiper' ? 'bg-indigo-500 text-white' : allPoems.length > 0 ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed']"
            @click="viewMode = 'swiper'; fromMystery = false"
          >
            📇 滑动
          </button>
          <button
            :disabled="allPoems.length === 0"
            :class="['flex-1 py-3 rounded-xl text-base font-medium cursor-pointer transition', viewMode === 'mystery' ? 'bg-purple-500 text-white' : allPoems.length > 0 ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed']"
            @click="viewMode = 'mystery'"
          >
            🎁 盲盒
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-layer {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
