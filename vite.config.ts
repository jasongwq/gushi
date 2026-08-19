import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'

const gitHash = execSync('git rev-parse --short HEAD').toString().trim()
const buildTime = Date.now()

export default defineConfig({
  define: {
    __GIT_HASH__: JSON.stringify(gitHash),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['gushi-dev.ypwq.fun'],
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '古诗抽查',
        short_name: '古诗抽查',
        description: '古诗词背诵抽查练习工具',
        theme_color: '#4f46e5',
        background_color: '#f9fafb',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    exclude: ['tests/e2e/**', 'node_modules/**', '.codebuddy/**', '.worktrees/**'],
    coverage: {
      // 只统计被测试触碰的文件（v8 默认行为）；全库统计会把大量存量无测试页面计入 0% 拉低全局值
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 85,
        lines: 90,
      },
    },
  },
})
