<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
// Mengimpor client Supabase terpusat Anda
import { supabase } from '../lib/supabase' 

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
const isLoading = ref(false)

// State untuk menampung berkas file identitas yang diunggah
const identityFile = ref<File | null>(null)

// Menangani perubahan input file identitas (KTP/Kartu Pelajar/SIM)
const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    identityFile.value = target.files[0] || null
  }
}

// Proses Registrasi Baru Terintegrasi dengan Supabase Auth & Storage
const handleRegister = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  // 1. Validasi Formulir Sisi Klien
  if (!nama.value || !email.value || !noHp.value || !password.value || !confirmPassword.value || !nomorKtp.value || !tanggalLahir.value) {
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

  if (!identityFile.value) {
    errorMessage.value = 'Harap lampirkan foto/file kartu identitas Anda terlebih dahulu.'
    return
  }

  isLoading.value = true

  try {
    // 2. Mendaftarkan Akun ke Supabase Auth
    // Menyertakan metadata tambahan ke options.data agar ditangkap otomatis oleh Trigger Database handle_new_user()
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        data: {
          full_name: nama.value,
          phone: noHp.value,
          role: 'group_leader', // Set default role sebagai Ketua Rombongan sesuai persona PRD
          nik: nomorKtp.value,
          emergency_contact: noHpDarurat.value,
          dob: tanggalLahir.value,
          citizenship: jenisKewarganegaraan.value,
          identity_type: jenisIdentitas.value
        }
      }
    })

    if (authError) throw authError

    if (authData?.user) {
      const userId = authData.user.id
      const file = identityFile.value
      const fileExt = file.name.split('.').pop()
      // Menyusun nama file unik menggunakan ID user untuk kebutuhan verifikasi identitas (PRD Bab 1.3)
      const fileName = `${userId}_identity_${Date.now()}.${fileExt}`
      const filePath = `identities/${fileName}`

      // 3. Mengunggah Foto Identitas ke Supabase Storage Bucket ('permit-documents')
      const { error: uploadError } = await supabase.storage
        .from('permit-documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Ambil Public URL hasil upload untuk disimpan sebagai metadata referensi jika diperlukan
      const { data: { publicUrl } } = supabase.storage
        .from('permit-documents')
        .getPublicUrl(filePath)

      // Perbarui metadata user auth dengan link publicUrl kartu identitas
      await supabase.auth.updateUser({
        data: { identity_card_url: publicUrl }
      })

      successMessage.value = 'Pendaftaran berhasil! Mengalihkan ke halaman Login...'
      
      // Micro-interaction delay sebelum diarahkan otomatis ke halaman login
      setTimeout(() => {
        router.push({ name: 'login' })
      }, 1500)
    }
  } catch (error: any) {
    console.error('Error saat registrasi:', error)
    if (error.message === 'User already registered') {
      errorMessage.value = 'Alamat email ini sudah terdaftar.'
    } else {
      errorMessage.value = error.message || 'Terjadi kesalahan saat mendaftarkan akun. Silakan coba lagi.'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="register-page animate-fade-in">
    <div class="page-header">
      <h2>REGISTRASI</h2>
      <p>Beranda > Registrasi</p>
    </div>

    <div class="container" style="max-width: 1000px; padding: 4rem 1rem;">
      <form @submit.prevent="handleRegister" class="form-container">
        
        <div class="form-group">
          <label class="form-label">Jenis Kewarganegaraan *</label>
          <select class="form-control" v-model="jenisKewarganegaraan" :disabled="isLoading">
            <option value="WNI">WNI</option>
            <option value="WNA">WNA</option>
          </select>
        </div>

        <div class="grid grid-3">
          <div class="form-group">
            <label class="form-label">Jenis Identitas *</label>
            <select class="form-control" v-model="jenisIdentitas" :disabled="isLoading">
              <option value="KTP">KTP</option>
              <option value="Kartu Pelajar">Kartu Pelajar</option>
              <option value="SIM">SIM</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Lampiran Identitas KTP *</label>
            <input type="file" class="form-control" accept="image/jpeg, image/png" @change="handleFileChange" :disabled="isLoading" />
            <small style="color: #666; font-size: 0.75rem;">Silahkan lampirkan file gambar berformat .jpg / .png</small>
          </div>
          <div class="form-group">
            <label class="form-label">Nomor KTP *</label>
            <input type="text" class="form-control" v-model="nomorKtp" required :disabled="isLoading" />
          </div>
        </div>

        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">Nama Lengkap *</label>
            <input type="text" class="form-control" v-model="nama" required :disabled="isLoading" />
          </div>
          <div class="form-group">
            <label class="form-label">Tanggal Lahir *</label>
            <input type="date" class="form-control" v-model="tanggalLahir" required :disabled="isLoading" />
          </div>
        </div>

        <div class="grid grid-3">
          <div class="form-group">
            <label class="form-label">No. Telepon *</label>
            <div style="display: flex; gap: 0.5rem;">
              <select class="form-control" style="width: 40%;" :disabled="isLoading"><option>Indonesia (+62)</option></select>
              <input type="text" class="form-control" v-model="noHp" placeholder="Tulis 0812xxx / 812xxx" required :disabled="isLoading" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">No. Telepon Darurat *</label>
            <div style="display: flex; gap: 0.5rem;">
              <select class="form-control" style="width: 40%;" :disabled="isLoading"><option>Indonesia (+62)</option></select>
              <input type="text" class="form-control" v-model="noHpDarurat" placeholder="Tulis 0812xxx / 812xxx" required :disabled="isLoading" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Email *</label>
            <input type="email" class="form-control" v-model="email" required :disabled="isLoading" />
          </div>
        </div>

        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">Password *</label>
            <input type="password" class="form-control" v-model="password" required :disabled="isLoading" />
          </div>
          <div class="form-group">
            <label class="form-label">Konfirmasi Password *</label>
            <input type="password" class="form-control" v-model="confirmPassword" required :disabled="isLoading" />
          </div>
        </div>

        <div v-if="errorMessage" style="color: #c5221f; margin-bottom: 1rem; font-size: 0.9rem; font-weight: 600;">
          <i class="ph-fill ph-warning-circle"></i> {{ errorMessage }}
        </div>

        <div v-if="successMessage" style="color: #137333; margin-bottom: 1rem; font-size: 0.9rem; font-weight: 600;">
          <i class="ph-fill ph-check-circle"></i> {{ successMessage }}
        </div>

        <div class="text-center" style="margin-top: 2rem;">
          <button type="submit" class="btn btn-orange" style="padding: 0.75rem 3rem; font-size: 1rem; color: #fff;" :disabled="isLoading">
            {{ isLoading ? 'Mendaftarkan Akun...' : 'Daftar Akun' }}
          </button>
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
  background-color: #445566;
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