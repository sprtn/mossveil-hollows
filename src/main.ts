import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { initContentRegistry } from './engine/admin/ContentRegistry'

initContentRegistry()
createApp(App).mount('#app')
