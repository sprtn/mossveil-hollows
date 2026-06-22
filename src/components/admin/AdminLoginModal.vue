<template>
  <Teleport to="body">
    <div class="admin-login-overlay" role="dialog" aria-modal="true" aria-label="Admin login" @click.self="emit('cancel')">
      <form class="admin-login panel" @submit.prevent="submit">
        <h2 class="admin-login-title">Content Admin</h2>
        <p class="admin-login-hint">Sign in to edit game content.</p>

        <label class="field-label">
          Username
          <input
            ref="usernameRef"
            v-model="username"
            type="text"
            class="field-input"
            autocomplete="username"
            required
          />
        </label>

        <label class="field-label">
          Password
          <input
            v-model="password"
            type="password"
            class="field-input"
            autocomplete="current-password"
            required
          />
        </label>

        <p v-if="error" class="login-error">{{ error }}</p>

        <div class="login-actions">
          <button type="button" class="btn btn-secondary" @click="emit('cancel')">Cancel</button>
          <button type="submit" class="btn btn-primary">Sign in</button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { verifyAdminLogin, setAdminAuthenticated } from '@/engine/admin/adminAuth'

const emit = defineEmits<{
  success: []
  cancel: []
}>()

const username = ref('')
const password = ref('')
const error = ref('')
const usernameRef = ref<HTMLInputElement | null>(null)

onMounted(() => usernameRef.value?.focus())

function submit() {
  error.value = ''
  if (!verifyAdminLogin(username.value.trim(), password.value)) {
    error.value = 'Invalid username or password.'
    return
  }
  setAdminAuthenticated()
  emit('success')
}
</script>

<style scoped>
.admin-login-overlay {
  position: fixed;
  inset: 0;
  z-index: 2100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.78);
}

.admin-login {
  width: min(360px, 100%);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-login-title {
  margin: 0;
  font-size: 18px;
  color: var(--color-accent-bright);
}

.admin-login-hint {
  margin: 0 0 4px;
  font-size: 13px;
  color: var(--color-text-soft);
}

.field-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-soft);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.field-input {
  padding: 8px 10px;
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.field-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.login-error {
  margin: 0;
  font-size: 12px;
  color: var(--color-danger, #c0392b);
}

.login-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
</style>
