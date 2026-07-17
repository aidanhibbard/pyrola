import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import '@/assets/styles/css/tailwind.css'
import '@/assets/styles/css/studio-print.css'
import 'vue-sonner/style.css'

createApp(App)
.use(createPinia())
.use(router)
.mount('#app')
