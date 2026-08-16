<template>
  <router-view />
  <footer class="text-center text-xs text-gray-400 py-3 select-none">
    v{{ version }} · {{ buildTime }} · {{ gitHash }}
  </footer>
</template>

<script setup lang="ts">
import { version } from '../package.json'

const gitHash = __GIT_HASH__
const buildTime = __BUILD_TIME__
</script>
