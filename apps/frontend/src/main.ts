import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ShellApp from './ShellApp.vue'
import './style.css'
import { initializeUiTheme } from '@/themes/theme-runtime'
import { router } from '@/router'

initializeUiTheme()

const app = createApp(ShellApp)
app.use(createPinia())
app.use(router)
app.mount('#app')
