import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { initContentRegistry } from './engine/admin/ContentRegistry'
import { refreshItemDatabase } from './engine/ItemDatabase'

initContentRegistry()
refreshItemDatabase()
createApp(App).mount('#app')
