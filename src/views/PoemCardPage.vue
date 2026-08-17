<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { usePoemStore } from '@/stores/poem'
import { useLearningStore } from '@/stores/learning'
import CardSwiper from '@/components/CardSwiper.vue'
import PoemCard from '@/components/PoemCard.vue'
import MysteryBox from '@/components/MysteryBox.vue'
import RecitationCard from '@/components/RecitationCard.vue'
import { SwiperSlide } from 'swiper/vue'
import type { Poem, RecitationResult, SourceType } from '@/types'
import { getReviewPoems, getWrongPoems, getUnproficientPoems, compareSmartPriority } from '@/utils/quiz'
import { createSwipeState, swipeStart, swipeMove, swipeEnd } from '@/utils/swipe'

const router = useRouter()
const poemStore = usePoemStore()
const learningStore = useLearningStore()

onMounted(() => poemStore.fetchPoems())

// ========== 视图状态 ==========
type ViewMode = 'swiper' | 'recite' | 'mystery'

const viewMode = ref<ViewMode>('swiper')

// 当前展开的诗 ID，null 表示没有展开
const expandedPoemId = ref<string | null>(null)

// 盲盒来源标记
const mysteryRevealedPoems = ref<Poem[]>([])
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
  if (source.value === 'all') return [...enabled].sort((a, b) => a.id.localeCompare(b.id))
  if (source.value === 'smart') {
    return [...enabled].sort((a, b) => compareSmartPriority(a, b, learningStore.records, learningStore.wrongBook, today))
  }
  if (source.value === 'grade') return enabled.filter(p => selectedGrades.value.includes(p.grade))
  if (source.value === 'review') return getReviewPoems(enabled, learningStore.records, today)
  if (source.value === 'wrong') return getWrongPoems(enabled, learningStore.wrongBook)
  if (source.value === 'unproficient') return getUnproficientPoems(enabled, learningStore.records)
  return [...enabled].sort((a, b) => a.id.localeCompare(b.id))
})

// 当前诗列表：从盲盒来时只显示已开盒的诗，否则显示全部
const poems = computed(() => fromMystery.value ? mysteryRevealedPoems.value : allPoems.value)

// 当前卡片索引
const currentIndex = ref(0)

// 当前诗（computed，不再需要 ref）
const currentPoem = computed(() => poems.value[currentIndex.value] ?? null)

// ========== 已抽查 ==========
const checkedPoemIds = ref(new Set<string>())

function saveResult(result: RecitationResult) {
  checkedPoemIds.value.add(result.poemId)

  // 整体只调用一次 recordAnswer
  learningStore.recordAnswer(result.poemId, 'recite', result.overallStatus === 'mastered')

  // 细节用 recordDetail，不影响复习调度
  if (result.overallStatus !== 'mastered') {
    for (const line of result.lines) {
      if (line.status === 'stuck' || line.status === 'forgot') {
        learningStore.recordDetail(result.poemId, 'line', `第${line.lineIndex + 1}句:${line.status}`)
      }
    }
  }
  if (result.authorCorrect === false) {
    learningStore.recordDetail(result.poemId, 'author')
  }
  if (result.dynastyCorrect === false) {
    learningStore.recordDetail(result.poemId, 'dynasty')
  }

  // 字级标记统计
  if (result.charMarks && Object.keys(result.charMarks).length > 0) {
    const poem = poemStore.getPoemById(result.poemId)
    if (poem) {
      learningStore.recordReciteWithCharMarks(result.poemId, result.overallStatus === 'mastered', poem.text, result.charMarks)
    }
  }
}

// ========== 展开/缩回逻辑 ==========
const cardSwiperRef = ref<InstanceType<typeof CardSwiper> | null>(null)

// 过渡中的导航计时器，用于防止竞态
const EXPAND_TRANSITION_MS = 350
let navTimer: ReturnType<typeof setTimeout> | null = null
let isNavigating = ref(false)

// 上滑缩回阈值（px）——由 utils/swipe 统一管理
// 滑动起点记录（用于判断上滑手势）
const swipeState = createSwipeState()

// 页面根容器（不随 viewMode 重建，用于稳定绑定触摸监听）
const pageRootRef = ref<HTMLElement | null>(null)

onMounted(() => {
  // 绑定到页面根容器（不会因 CardSwiper 重建而失效）
  // 用 capture 阶段确保能收到卡片区域内的触摸事件
  pageRootRef.value?.addEventListener('touchstart', onAreaTouchStart, { passive: true, capture: true })
  pageRootRef.value?.addEventListener('touchmove', onAreaTouchMove, { passive: true, capture: true })
  pageRootRef.value?.addEventListener('touchend', onAreaTouchEnd, { capture: true })
  pageRootRef.value?.addEventListener('touchcancel', onAreaTouchEnd, { capture: true })
})

onBeforeUnmount(() => {
  if (navTimer) clearTimeout(navTimer)
  swipeEnd(swipeState)
  pageRootRef.value?.removeEventListener('touchstart', onAreaTouchStart, { capture: true })
  pageRootRef.value?.removeEventListener('touchmove', onAreaTouchMove, { capture: true })
  pageRootRef.value?.removeEventListener('touchend', onAreaTouchEnd, { capture: true })
  pageRootRef.value?.removeEventListener('touchcancel', onAreaTouchEnd, { capture: true })
})

// 原生触摸：记录起点（仅背诵模式；不拦截按钮，靠移动阈值区分点击 vs 上滑）
function onAreaTouchStart(e: TouchEvent) {
  if (!expandedPoemId.value || isNavigating.value) return
  // 只处理卡片区域内的触摸（避开顶部返回条、底部进度条）
  const target = e.target as HTMLElement | null
  if (!target?.closest?.('.card-swiper')) return
  // 忽略背诵卡片正文滚动区（data-scroll-area）内的触摸，让原生滚动接管；
  // 否则上滑滚动手势会被「上滑缩回浏览」拦截（长诗正文无法滚动）。
  // 用语义标记而非 .overflow-y-auto 类名——页面级 flex 容器也带该类，会误伤标题区/按钮区的缩回手势
  if (target.closest('[data-scroll-area]')) return
  const touch = e.touches[0]
  if (touch) swipeStart(swipeState, touch.clientX, touch.clientY)
}

// 原生触摸：垂直上滑超过阈值则缩回
// 点击按钮时手指几乎不动（dy 小），不会触发缩回
function onAreaTouchMove(e: TouchEvent) {
  if (!expandedPoemId.value || isNavigating.value) return
  const touch = e.touches[0]
  if (!touch) return
  if (swipeMove(swipeState, touch.clientX, touch.clientY)) {
    collapseSlide()
  }
}

function onAreaTouchEnd() {
  swipeEnd(swipeState)
}

// 展开某个 slide：切换到背诵模式（Swiper 通过 key 重建为 slide 全宽效果）
function expandSlide(slideIndex: number) {
  const poemId = poems.value[slideIndex]?.id
  if (!poemId) return

  expandedPoemId.value = poemId
  currentIndex.value = slideIndex
  viewMode.value = 'recite'
}

// 缩回当前展开的 slide：回到浏览模式
function collapseSlide() {
  if (!expandedPoemId.value) return
  expandedPoemId.value = null
  viewMode.value = 'swiper'
}

// 点击 PoemCard → 展开进入背诵
function onCardClick(poem: Poem) {
  const idx = poems.value.findIndex(p => p.id === poem.id)
  if (idx >= 0) expandSlide(idx)
}

// ========== 详情页提交/导航 ==========
// 导航到指定诗：先缩回浏览模式，Swiper 重建后用 initial-slide 对齐目标，再进入背诵
function navigateToPoem(targetIndex: number) {
  if (isNavigating.value) return
  isNavigating.value = true
  if (navTimer) clearTimeout(navTimer)
  // 先切回浏览模式（触发 Swiper 重建，旧实例销毁）
  collapseSlide()
  // 设置目标索引：Swiper 重建时 initial-slide 用新值对齐
  currentIndex.value = targetIndex
  // 等 DOM 更新后进入背诵模式（触发第二次重建，新实例定位到目标诗）
  nextTick(() => {
    navTimer = setTimeout(() => {
      viewMode.value = 'recite'
      isNavigating.value = false
      navTimer = null
    }, EXPAND_TRANSITION_MS)
  })
}

function onDetailSubmit(result: RecitationResult) {
  saveResult(result)

  if (fromMystery.value) {
    const navList = mysteryRevealedPoems.value
    const idx = navList.findIndex(p => p.id === currentPoem.value?.id)
    if (idx >= 0 && idx < navList.length - 1) {
      navigateToPoem(idx + 1)
    } else {
      collapseSlide()
      viewMode.value = 'mystery'
    }
    return
  }

  const idx = poems.value.findIndex(p => p.id === currentPoem.value?.id)
  if (idx >= 0 && idx < poems.value.length - 1) {
    navigateToPoem(idx + 1)
  } else {
    collapseSlide()
  }
}

function onDetailGoPrev() {
  if (fromMystery.value) {
    const navList = mysteryRevealedPoems.value
    const idx = navList.findIndex(p => p.id === currentPoem.value?.id)
    if (idx > 0) {
      navigateToPoem(idx - 1)
    }
    return
  }
  const idx = poems.value.findIndex(p => p.id === currentPoem.value?.id)
  if (idx > 0) {
    navigateToPoem(idx - 1)
  }
}

// 返回浏览（从背诵模式）
function goBackToBrowse() {
  if (fromMystery.value) {
    expandedPoemId.value = null
    viewMode.value = 'mystery'
  } else {
    collapseSlide()
  }
}

// ========== 盲盒相关 ==========
const mysteryBoxRef = ref<InstanceType<typeof MysteryBox> | null>(null)

function onMysterySelectAndEnter(poem: Poem) {
  fromMystery.value = true
  if (mysteryBoxRef.value) {
    mysteryRevealedPoems.value = mysteryBoxRef.value.boxes
      ? mysteryBoxRef.value.boxes
          .filter((b: { state: string; poem: Poem | null }) => b.state === 'revealed' && b.poem)
          .map((b: { poem: Poem | null }) => b.poem!)
      : []
  }
  const idx = mysteryRevealedPoems.value.findIndex(p => p.id === poem.id)
  if (idx >= 0) expandSlide(idx)
}

function switchToGlobal() {
  fromMystery.value = false
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

// 背诵模式的进度信息
const detailProgress = computed(() => {
  if (!currentPoem.value) return { text: '', percent: 0 }
  const navList = poems.value
  const idx = navList.findIndex(p => p.id === currentPoem.value?.id)
  const total = navList.length
  if (idx < 0) return { text: '', percent: 0 }
  return {
    text: `${idx + 1}/${total}`,
    percent: ((idx + 1) / total) * 100,
  }
})
</script>

<template>
  <div ref="pageRootRef" class="poem-card-page w-full max-w-md mx-auto h-dvh flex flex-col bg-gray-50 relative overflow-hidden">
    <div class="flex flex-col flex-1 min-h-0">
      <!-- 顶部：背诵模式只保留返回条，浏览/盲盒模式显示完整筛选栏 -->
      <div v-if="viewMode === 'recite'" class="px-3 py-2 bg-white border-b border-gray-100 flex items-center">
        <button data-testid="recite-back" class="text-gray-400 text-sm" @click="goBackToBrowse">← 返回</button>
        <span class="text-sm text-gray-500 ml-auto">已查 {{ checkedCount }} / {{ totalCount }} 首</span>
      </div>
      <div v-else class="p-3 bg-white border-b border-gray-100">
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
      <div class="flex-1 min-h-0 p-4 overflow-hidden">
        <!-- 盲盒模式：用 v-show 保留状态 -->
        <MysteryBox
          v-show="viewMode === 'mystery' && allPoems.length > 0"
          ref="mysteryBoxRef"
          :poems="allPoems"
          @select="onMysterySelectAndEnter"
        />

        <!-- 滑动模式（浏览 + 背诵共用同一个 Swiper 结构，通过 key 重建切换 effect） -->
        <CardSwiper
          v-show="viewMode !== 'mystery'"
          v-if="poems.length > 0"
          :key="viewMode"
          ref="cardSwiperRef"
          v-model="currentIndex"
          :count="poems.length"
          :effect="viewMode === 'recite' ? 'slide' : 'coverflow'"
        >
          <SwiperSlide v-for="(poem, index) in poems" :key="poem.id + '-' + index">
            <RecitationCard
              v-if="viewMode === 'recite'"
              class="h-full px-4"
              :poem="poem"
              :can-go-prev="fromMystery ? mysteryRevealedPoems.findIndex(p => p.id === poem.id) > 0 : poems.findIndex(p => p.id === poem.id) > 0"
              @submit="onDetailSubmit"
              @go-prev="onDetailGoPrev"
            />
            <PoemCard
              v-else
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
        <!-- 背诵模式：精简进度条 -->
        <div v-if="viewMode === 'recite'" class="px-4 pt-2 pb-1">
          <div class="flex items-center justify-between mb-1">
            <span data-testid="detail-progress" class="text-xs text-gray-400">{{ detailProgress.text }}</span>
            <div class="flex items-center">
              <button
                v-if="fromMystery"
                class="ml-3 text-xs text-purple-400 cursor-pointer"
                @click="collapseSlide(); viewMode = 'mystery'"
              >返回盲盒</button>
              <button
                v-if="fromMystery"
                class="ml-2 text-xs text-indigo-400 cursor-pointer"
                @click="switchToGlobal"
              >全部古诗</button>
            </div>
          </div>
          <div class="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div class="h-full bg-indigo-500 rounded-full transition-all duration-300" :style="{ width: detailProgress.percent + '%' }"></div>
          </div>
        </div>

        <!-- 浏览模式：进度条 -->
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

        <!-- 模式切换按钮（背诵模式隐藏，保证全屏） -->
        <div v-if="viewMode !== 'recite'" class="p-3 flex gap-3">
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
