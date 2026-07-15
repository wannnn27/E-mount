<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
// Mengimpor client Supabase terpusat Anda
import { supabase } from '../lib/supabase' 

const router = useRouter()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

// Mengubah menjadi async function untuk menghandle network request ke Supabase
const handleLogin = async () => {
  errorMessage.value = ''

  if (!email.value || !password.value) {
    errorMessage.value = 'Email dan Password wajib diisi.'
    return
  }

  isLoading.value = true

  try {
    // 1. Proses Otentikasi Email & Password ke Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })

    // Jika kredensial salah atau terjadi error dari Supabase Auth, lempar ke catch block
    if (authError) throw authError

    if (authData?.user) {
      // 2. Ambil data role pengguna dari tabel public.users (PRD Bab 6.1)
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle() // Mengembalikan null jika baris profil belum terbentuk otomatis

      if (profileError) throw profileError

      // 3. Logika Pengalihan Halaman Berdasarkan Role Pengguna (PRD Bab 2.2)
      // Memberikan fallback 'hiker' jika data profil di database kosong
      const userRole = profileData?.role || 'hiker'
      
      if (userRole === 'admin' || userRole === 'tenant_admin' || userRole === 'super_admin') {
        // Jika admin pengelola gunung atau super admin, arahkan ke dashboard pengelola
        router.push({ name: 'admin-dashboard' })
      } else {
        // Jika user adalah pendaki (hiker / group_leader), arahkan ke riwayat tiket
        router.push({ name: 'riwayat' })
      }
    }
  } catch (error: any) {
    console.error('Login error:', error)
    // Mengubah pesan error bahasa Inggris bawaan Supabase agar lebih ramah bagi user lokal
    if (error.message === 'Invalid login credentials') {
      errorMessage.value = 'Kredensial tidak valid. Silakan periksa kembali email dan password Anda.'
    } else {
      errorMessage.value = error.message || 'Terjadi kesalahan sistem. Silakan coba lagi.'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login-page animate-fade-in">
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
            :disabled="isLoading"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Password *</label>
          <input 
            type="password" 
            class="form-control"
            v-model="password" 
            required 
            :disabled="isLoading"
          />
        </div>

        <div v-if="errorMessage" style="color: #c5221f; margin-bottom: 1rem; font-size: 0.9rem; font-weight: 600;">
          <i class="ph-fill ph-warning-circle"></i> {{ errorMessage }}
        </div>

        <div class="text-center" style="margin-top: 2rem;">
          <button type="submit" class="btn btn-green" style="padding: 0.75rem 3rem; font-size: 1rem; width: 100%;" :disabled="isLoading">
            {{ isLoading ? 'Memproses Masuk...' : 'Masuk' }}
          </button>
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