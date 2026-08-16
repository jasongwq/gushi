import { createRouter, createWebHashHistory } from 'vue-router'

export const ROUTE_STORAGE_KEY = 'poem-quiz-route'

// Routes that have session state and should be restored after refresh
export const RESTORABLE_ROUTES = new Set(['quiz-play', 'recitation-play'])

const routes = [
  { path: '/', name: 'home', component: () => import('@/views/HomePage.vue') },
  { path: '/quiz/setup', name: 'quiz-setup', component: () => import('@/views/QuizSetupPage.vue') },
  { path: '/quiz/play', name: 'quiz-play', component: () => import('@/views/QuizPlayPage.vue') },
  { path: '/quiz/result', name: 'quiz-result', component: () => import('@/views/QuizResultPage.vue') },
  { path: '/recitation/setup', name: 'recitation-setup', component: () => import('@/views/RecitationSetupPage.vue') },
  { path: '/recitation/play', name: 'recitation-play', component: () => import('@/views/RecitationPlayPage.vue') },
  { path: '/recitation/result', name: 'recitation-result', component: () => import('@/views/RecitationResultPage.vue') },
  { path: '/wrong', name: 'wrong-book', component: () => import('@/views/WrongBookPage.vue') },
  { path: '/progress', name: 'progress', component: () => import('@/views/ProgressPage.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsPage.vue') },
  { path: '/poems', name: 'poem-collection', component: () => import('@/views/PoemCollectionPage.vue') },
  { path: '/settings/poems', name: 'poem-config', component: () => import('@/views/PoemConfigPage.vue') },
  { path: '/poem-card', name: 'poem-card', component: () => import('@/views/PoemCardPage.vue') },
  { path: '/poem/:id', name: 'poem-detail', component: () => import('@/views/PoemDetailPage.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// Save current route to sessionStorage when on restorable pages
router.afterEach((to) => {
  if (RESTORABLE_ROUTES.has(to.name as string)) {
    sessionStorage.setItem(ROUTE_STORAGE_KEY, to.fullPath)
  } else {
    sessionStorage.removeItem(ROUTE_STORAGE_KEY)
  }
})

export default router
