import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('@/views/HomePage.vue') },
  { path: '/quiz/setup', name: 'quiz-setup', component: () => import('@/views/QuizSetupPage.vue') },
  { path: '/quiz/play', name: 'quiz-play', component: () => import('@/views/QuizPlayPage.vue') },
  { path: '/quiz/result', name: 'quiz-result', component: () => import('@/views/QuizResultPage.vue') },
  { path: '/wrong', name: 'wrong-book', component: () => import('@/views/WrongBookPage.vue') },
  { path: '/progress', name: 'progress', component: () => import('@/views/ProgressPage.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsPage.vue') },
  { path: '/poems', name: 'poem-collection', component: () => import('@/views/PoemCollectionPage.vue') },
  { path: '/settings/poems', name: 'poem-config', component: () => import('@/views/PoemConfigPage.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
