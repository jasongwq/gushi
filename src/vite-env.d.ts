/// <reference types="vite/client" />

declare const __GIT_HASH__: string
declare const __BUILD_TIME__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'vue-focus-lock' {
  import type { DefineComponent } from 'vue'
  const FocusLock: DefineComponent<{ returnFocus?: boolean }, {}, any>
  export default FocusLock
}
