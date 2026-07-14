<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDatabaseStore } from '../stores/database'

const db = useDatabaseStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const errorMessage = ref('')

const handleLogin = () => {
  errorMessage.value = ''

  if (!email.value || !password.value) {
    errorMessage.value = 'Email dan Password wajib diisi.'
    return
  }

  const success = db.login(email.value, password.value)
  if (success) {
    if (db.currentUser?.role === 'admin') {
      router.push({ name: 'admin-dashboard' })
    } else {
      router.push({ name: 'riwayat' })
    }
  } else {
    errorMessage.value = 'Kredensial tidak valid. Silakan coba lagi.'
  }
}
</script>

<template>
  <div class="login-page animate-fade-in">
    <!-- Page Header -->
    <div class="page-header">
      <h2>LOGIN</h2>
      <p>Beranda > Login</p>
    </div>

    <div class="container" style="max-width: 600px; padding: 4rem 1rem;">
      <form @submit.prevent="handleLogin" class="form-container">
        
        <div class="form-group">
          <label class="form-label">Email *</label>
          <input 
            type="email" 
            class="form-control"
            v-model="email" 
            required 
          />
        </div>

        <div class="form-group">
          <label class="form-label">Password *</label>
          <input 
            type="password" 
            class="form-control"
            v-model="password" 
            required 
          />
        </div>

        <!-- Alert Messages -->
        <div v-if="errorMessage" style="color: #c5221f; margin-bottom: 1rem; font-size: 0.9rem; font-weight: 600;">
          <i class="ph-fill ph-warning-circle"></i> {{ errorMessage }}
        </div>

        <!-- Submit -->
        <div class="text-center" style="margin-top: 2rem;">
          <button type="submit" class="btn btn-green" style="padding: 0.75rem 3rem; font-size: 1rem; width: 100%;">Masuk</button>
        </div>

      </form>
      
      <div class="text-center" style="margin-top: 2rem; font-size: 0.9rem;">
        Belum punya akun? <RouterLink to="/register" style="color: var(--accent-orange); font-weight: bold;">Registrasi di sini</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  background-color: #445566; /* Grey blue header from screenshot */
  color: #fff;
  padding: 4rem 1rem;
  text-align: center;
}
.page-header h2 {
  font-size: 2.5rem;
  font-weight: 400;
  margin-bottom: 0.5rem;
}
.page-header p {
  font-size: 1rem;
}

.form-container {
  background: var(--bg-white);
}

.form-label {
  color: #c5221f;
}
</style>
