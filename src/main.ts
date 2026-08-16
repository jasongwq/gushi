import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router, { ROUTE_STORAGE_KEY, RESTORABLE_ROUTES } from './router'
import App from './App.vue'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// Restore route after refresh if the user was on a restorable page
router.isReady().then(() => {
  const savedRoute = sessionStorage.getItem(ROUTE_STORAGE_KEY)
  if (savedRoute && savedRoute !== router.currentRoute.value.fullPath) {
    const routeName = router.resolve(savedRoute).name
    if (routeName && RESTORABLE_ROUTES.has(routeName as string)) {
      router.replace(savedRoute)
    }
  }
})

app.mount('#app')
