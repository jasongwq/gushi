<template>
  <div class="h-dvh flex flex-col overflow-hidden">
    <router-view class="flex-1 min-h-0 overflow-y-auto" />
    <footer class="shrink-0 text-center text-xs text-gray-400 py-3 select-none">
      v{{ version }} · {{ formattedBuildTime }} · {{ gitHash }}
    </footer>
  </div>
</template>

<script setup lang="ts">
import { version } from '../package.json'

const gitHash = __GIT_HASH__
const formattedBuildTime = new Date(__BUILD_TIME__).toLocaleString()
</script>
