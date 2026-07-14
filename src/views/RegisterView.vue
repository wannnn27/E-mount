<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDatabaseStore } from '../stores/database'

const db = useDatabaseStore()
const router = useRouter()

const jenisKewarganegaraan = ref('WNI')
const jenisIdentitas = ref('KTP')
const nomorKtp = ref('')
const tanggalLahir = ref('')
const nama = ref('')
const email = ref('')
const noHp = ref('')
const noHpDarurat = ref('')
const password = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const successMessage = ref('')

const handleRegister = () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!nama.value || !email.value || !noHp.value || !password.value || !confirmPassword.value) {
    errorMessage.value = 'Harap isi seluruh formulir pendaftaran yang wajib (*).'
    return
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Konfirmasi password tidak cocok.'
    return
  }

  if (password.value.length < 6) {
    errorMessage.value = 'Password minimal terdiri dari 6 karakter.'
    return
  }

  const success = db.register(nama.value, email.value, noHp.value, password.value)
  if (success) {
    successMessage.value = 'Pendaftaran berhasil! Mengalihkan ke halaman Login...'
    setTimeout(() => {
      router.push({ name: 'login' })
    }, 1500)
  } else {
    errorMessage.value = 'Alamat email ini sudah terdaftar.'
  }
}
</script>

<template>
  <div class="register-page animate-fade-in">
    <!-- Page Header -->
    <div class="page-header">
      <h2>REGISTRASI</h2>
      <p>Beranda > Registrasi</p>
    </div>

    <div class="container" style="max-width: 1000px; padding: 4rem 1rem;">
      <form @submit.prevent="handleRegister" class="form-container">
        
        <!-- Row 1 -->
        <div class="form-group">
          <label class="form-label">Jenis Kewarganegaraan *</label>
          <select class="form-control" v-model="jenisKewarganegaraan">
            <option value="WNI">WNI</option>
            <option value="WNA">WNA</option>
          </select>
        </div>

        <!-- Row 2 -->
        <div class="grid grid-3">
          <div class="form-group">
            <label class="form-label">Jenis Identitas *</label>
            <select class="form-control" v-model="jenisIdentitas">
              <option value="KTP">KTP</option>
              <option value="Kartu Pelajar">Kartu Pelajar</option>
              <option value="SIM">SIM</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Lampiran Identitas KTP *</label>
            <input type="file" class="form-control" accept="image/jpeg, image/png" />
            <small style="color: #666; font-size: 0.75rem;">Silahkan lampirkan file gambar berformat .jpg / .png</small>
          </div>
          <div class="form-group">
            <label class="form-label">Nomor KTP *</label>
            <input type="text" class="form-control" v-model="nomorKtp" required />
          </div>
        </div>

        <!-- Row 3 -->
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">Nama Lengkap *</label>
            <input type="text" class="form-control" v-model="nama" required />
          </div>
          <div class="form-group">
            <label class="form-label">Tanggal Lahir *</label>
            <input type="date" class="form-control" v-model="tanggalLahir" required />
          </div>
        </div>

        <!-- Row 4 -->
        <div class="grid grid-3">
          <div class="form-group">
            <label class="form-label">No. Telepon *</label>
            <div style="display: flex; gap: 0.5rem;">
              <select class="form-control" style="width: 40%;"><option>Indonesia (+62)</option></select>
              <input type="text" class="form-control" v-model="noHp" placeholder="Tulis 0812xxx / 812xxx" required />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">No. Telepon Darurat *</label>
            <div style="display: flex; gap: 0.5rem;">
              <select class="form-control" style="width: 40%;"><option>Indonesia (+62)</option></select>
              <input type="text" class="form-control" v-model="noHpDarurat" placeholder="Tulis 0812xxx / 812xxx" required />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Email *</label>
            <input type="email" class="form-control" v-model="email" required />
          </div>
        </div>

        <!-- Row 5 (Passwords) -->
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">Password *</label>
            <input type="password" class="form-control" v-model="password" required />
          </div>
          <div class="form-group">
            <label class="form-label">Konfirmasi Password *</label>
            <input type="password" class="form-control" v-model="confirmPassword" required />
          </div>
        </div>

        <!-- Alert Messages -->
        <div v-if="errorMessage" style="color: #c5221f; margin-bottom: 1rem; font-size: 0.9rem; font-weight: 600;">
          <i class="ph-fill ph-warning-circle"></i> {{ errorMessage }}
        </div>

        <div v-if="successMessage" style="color: #137333; margin-bottom: 1rem; font-size: 0.9rem; font-weight: 600;">
          <i class="ph-fill ph-check-circle"></i> {{ successMessage }}
        </div>

        <!-- Submit -->
        <div class="text-center" style="margin-top: 2rem;">
          <button type="submit" class="btn btn-orange" style="padding: 0.75rem 3rem; font-size: 1rem; color: #fff;">Daftar Akun</button>
        </div>

      </form>
      
      <div class="text-center" style="margin-top: 2rem; font-size: 0.9rem;">
        Sudah punya akun? <RouterLink to="/login" style="color: var(--accent-orange); font-weight: bold;">Masuk di sini</RouterLink>
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
