import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fontsource-variable/inter/wght.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'

import App from './App.vue'
import router from './router'

import '@/assets/styles/css/tailwind.css'
import '@/assets/styles/css/main.css'
import '@/assets/styles/css/studio-print.css'
import 'vue-sonner/style.css'

createApp(App)
.use(createPinia())
.use(router)
.mount('#app')
