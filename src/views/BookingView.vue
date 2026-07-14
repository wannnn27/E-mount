<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDatabaseStore } from '../stores/database'

const route = useRoute()
const router = useRouter()
const db = useDatabaseStore()

const jalurId = route.params.jalurId as string
const selectedJalur = computed(() => db.jalur.find(j => j.id === jalurId))

// Set default date to tomorrow
const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
const defaultDateStr = tomorrow.toISOString().slice(0, 10)

// Inputs
const tanggalNaik = ref(defaultDateStr)
const jumlahPendaki = ref(1)
const namaPemimpin = ref('')
const noHpPemimpin = ref('')
const nikPemimpin = ref('')
const kontakDarurat = ref('')
const anggota = ref<string[]>([])

// Safety Disclaimer
const showDisclaimer = ref(false)
const disclaimerAccepted = ref(false)
const errorMessage = ref('')

// Route detail status check
const isPathWaspada = computed(() => selectedJalur.value?.status_jalur === 'Waspada')
const isPathTutup = computed(() => selectedJalur.value?.status_jalur === 'Tutup')

// Dynamic members input handling
watch(jumlahPendaki, (newVal) => {
  const targetLen = newVal - 1
  if (targetLen < 0) return
  
  if (anggota.value.length < targetLen) {
    while (anggota.value.length < targetLen) {
      anggota.value.push('')
    }
  } else if (anggota.value.length > targetLen) {
    anggota.value = anggota.value.slice(0, targetLen)
  }
})

// Calculate quota and weather for selected date
const activeQuota = computed(() => {
  return db.getKuotaHarian(jalurId, tanggalNaik.value)
})

const activeWeather = computed(() => {
  return db.getCuaca(jalurId, tanggalNaik.value)
})

const availableSlots = computed(() => {
  const q = activeQuota.value
  return q.kuota_total - q.kuota_terpakai
})

// 5-Day Forecast
const forecast5Days = computed(() => {
  const forecast = []
  const baseDate = new Date(tanggalNaik.value)
  for (let i = 0; i < 5; i++) {
    const d = new Date(baseDate)
    d.setDate(d.getDate() + i)
    const dStr = d.toISOString().slice(0, 10)
    
    // Get short day name (e.g., Sen, Sel, Rab)
    const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' })
    const w = db.getCuaca(jalurId, dStr)
    
    // Map condition to icon
    let icon = 'ph-cloud-sun'
    let color = '#f5952c'
    if (w.ringkasan_cuaca === 'Cerah') { icon = 'ph-sun'; color = '#f5952c' }
    if (w.ringkasan_cuaca === 'Hujan Ringan') { icon = 'ph-cloud-rain'; color = '#445566' }
    if (w.ringkasan_cuaca === 'Hujan Lebat') { icon = 'ph-cloud-lightning'; color = '#c5221f' }
    if (w.ringkasan_cuaca === 'Badai Angin') { icon = 'ph-wind'; color = '#c5221f' }
    
    forecast.push({
      dateStr: dStr,
      dayName,
      shortDate: `${d.getDate()}/${d.getMonth()+1}`,
      temp: w.temp_c,
      cond: w.ringkasan_cuaca,
      icon,
      color,
      isToday: i === 0
    })
  }
  return forecast
})

// Check safety warnings
watch([tanggalNaik, isPathWaspada], () => {
  if (isPathWaspada.value) {
    showDisclaimer.value = true
  } else {
    showDisclaimer.value = false
  }
}, { immediate: true })

const handleBooking = () => {
  errorMessage.value = ''
  
  if (isPathTutup.value) {
    errorMessage.value = 'Jalur pendakian ini ditutup demi alasan keselamatan.'
    return
  }

  if (isPathWaspada.value && !disclaimerAccepted.value) {
    errorMessage.value = 'Anda harus membaca dan menyetujui pernyataan keselamatan jalur Waspada.'
    return
  }

  if (jumlahPendaki.value <= 0) {
    errorMessage.value = 'Jumlah pendaki minimal 1 orang.'
    return
  }

  if (jumlahPendaki.value > availableSlots.value) {
    errorMessage.value = `Kuota tidak mencukupi. Tersisa ${availableSlots.value} slot.`
    return
  }

  if (!namaPemimpin.value || !noHpPemimpin.value || !nikPemimpin.value || !kontakDarurat.value) {
    errorMessage.value = 'Harap lengkapi seluruh data ketua kelompok.'
    return
  }

  // Validate NIK
  if (nikPemimpin.value.length < 16) {
    errorMessage.value = 'Nomor NIK KTP tidak valid (minimal 16 digit).'
    return
  }

  // Validate members names
  for (let i = 0; i < anggota.value.length; i++) {
    const memberName = anggota.value[i]
    if (!memberName || !memberName.trim()) {
      errorMessage.value = `Harap lengkapi nama Anggota #${i + 1}.`;
      return
    }
  }

  // Create booking in database store
  const res = db.createBooking(
    jalurId,
    tanggalNaik.value,
    jumlahPendaki.value,
    {
      nama: namaPemimpin.value,
      no_hp: noHpPemimpin.value,
      nik: nikPemimpin.value,
      kontak_darurat: kontakDarurat.value
    },
    anggota.value
  )

  if (res.success && res.bookingId) {
    router.push({ name: 'payment', params: { bookingId: res.bookingId } })
  } else {
    errorMessage.value = res.error || 'Terjadi kesalahan saat memproses booking.'
  }
}
</script>

<template>
  <div class="booking-page animate-fade-in" v-if="selectedJalur">
    <!-- Page Header -->
    <div class="page-header">
      <h2>FORMULIR BOOKING PENDAKIAN</h2>
      <p>Lengkapi data diri rombongan Anda untuk pendakian via {{ selectedJalur.nama_jalur }}</p>
    </div>

    <div class="container" style="padding: 3rem 1rem;">
      <div class="breadcrumb">
        <RouterLink to="/" class="back-link"><i class="ph-bold ph-arrow-left"></i> Kembali ke Beranda</RouterLink>
      </div>

      <div class="grid grid-layout">
        <!-- Left side: Booking details panel -->
        <div>
          <!-- Route card summary -->
          <div class="card-tngm summary-card">
            <h3 class="summary-title">{{ selectedJalur.nama_jalur }}</h3>
            <p class="summary-desc">{{ selectedJalur.deskripsi }}</p>
            
            <div class="summary-badges">
              <span v-if="selectedJalur.status_jalur === 'Buka'" class="badge badge-success"><i class="ph-fill ph-check-circle"></i> Jalur Dibuka</span>
              <span v-else-if="selectedJalur.status_jalur === 'Waspada'" class="badge badge-warning"><i class="ph-fill ph-warning-circle"></i> Waspada Cuaca</span>
              <span v-else class="badge badge-danger"><i class="ph-fill ph-prohibit"></i> Jalur Ditutup</span>
              
              <span class="summary-coord"><i class="ph-fill ph-map-pin"></i> {{ selectedJalur.latitude }}, {{ selectedJalur.longitude }}</span>
            </div>
          </div>

          <!-- Quota & Weather Checker -->
          <div class="card-tngm info-card">
            <h4 class="card-section-title">Informasi Hari Pendakian</h4>
            <div class="divider"></div>
            
            <!-- Date input -->
            <div class="form-group">
              <label class="form-label">Pilih Tanggal Naik</label>
              <input type="date" class="form-control" v-model="tanggalNaik" :min="defaultDateStr" />
            </div>

            <div class="indicator-grid">
              <div class="indicator-box" style="margin-bottom: 1rem;">
                <i class="ph-fill ph-users indicator-icon"></i>
                <div>
                  <div class="indicator-label">Sisa Kuota Tanggal Ini</div>
                  <div class="indicator-value" :class="{'text-danger': availableSlots < 10}">
                    {{ availableSlots }} / {{ activeQuota.kuota_total }} Orang
                  </div>
                </div>
              </div>
            </div>

            <!-- 5-Day Forecast Widget -->
            <div class="weather-widget">
              <div class="weather-widget-header">
                <i class="ph-fill ph-cloud-sun" style="font-size: 1.2rem; color: #f5952c;"></i>
                <span style="font-size: 0.85rem; font-weight: 700;">PRAKIRAAN CUACA 5 HARI</span>
              </div>
              <div class="weather-scroll">
                <div v-for="f in forecast5Days" :key="f.dateStr" class="weather-day" :class="{'active-day': f.isToday}">
                  <div class="w-day-name">{{ f.isToday ? 'Dipilih' : f.dayName }}</div>
                  <div class="w-date">{{ f.shortDate }}</div>
                  <i :class="['ph-fill', f.icon, 'w-icon']" :style="{ color: f.color }"></i>
                  <div class="w-temp">{{ f.temp }}°C</div>
                  <div class="w-cond" :style="f.cond === 'Badai Angin' ? 'color: #c5221f; font-weight: 700;' : ''">{{ f.cond }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Warning Disclaimer Card -->
          <div v-if="isPathWaspada" class="card-tngm disclaimer-card">
            <div class="disclaimer-header">
              <i class="ph-fill ph-warning-octagon warn-icon"></i>
              <h4>Peringatan Keselamatan: Status Waspada</h4>
            </div>
            <p class="disclaimer-text">
              Jalur pendakian yang Anda pilih saat ini berstatus <strong>WASPADA</strong> dikarenakan perkiraan cuaca buruk, hujan lebat, atau angin kencang di sekitar puncak. Pendakian tetap diperbolehkan dengan pengawasan ketat, namun Anda wajib melengkapi peralatan keselamatan, jas hujan, pakaian hangat berlapis, dan logistik cadangan.
            </p>
            <label class="disclaimer-checkbox">
              <input type="checkbox" v-model="disclaimerAccepted" />
              <span>Saya telah membaca dan menyetujui risiko keselamatan pendakian dalam kondisi Waspada.</span>
            </label>
          </div>
        </div>

        <!-- Right side: Group Data Entry Form -->
        <div>
          <div class="card-tngm form-wrapper">
            <h3 class="form-title">Data Kelompok Pendaki</h3>
            <div class="divider"></div>

            <form @submit.prevent="handleBooking">
              <!-- Group Size -->
              <div class="form-group" style="background: var(--bg-light); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
                <label class="form-label">Jumlah Anggota Rombongan (Termasuk Ketua)</label>
                <input type="number" class="form-control" v-model.number="jumlahPendaki" min="1" max="10" />
                <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 0.5rem;">
                  *Maksimal 10 orang per pendaftaran kelompok.
                </span>
              </div>

              <!-- Leader Details -->
              <h4 class="section-subtitle">Data Ketua Kelompok</h4>
              
              <div class="form-group">
                <label class="form-label">Nama Lengkap Ketua (Sesuai KTP)</label>
                <input type="text" class="form-control" v-model="namaPemimpin" placeholder="Masukkan nama ketua..." required />
              </div>

              <div class="grid grid-2">
                <div class="form-group">
                  <label class="form-label">Nomor Induk Kependudukan (NIK)</label>
                  <input type="text" class="form-control" v-model="nikPemimpin" placeholder="16 Digit NIK" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Nomor WhatsApp Aktif</label>
                  <input type="text" class="form-control" v-model="noHpPemimpin" placeholder="Contoh: 0857123..." required />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Nomor HP Kontak Darurat (Keluarga di Rumah)</label>
                <input type="text" class="form-control" v-model="kontakDarurat" placeholder="Wajib diisi..." required />
              </div>

              <!-- Members list dynamic form fields -->
              <div v-if="anggota.length > 0" class="members-section">
                <h4 class="section-subtitle">Data Anggota Kelompok</h4>
                <div v-for="(member, index) in anggota" :key="index" class="form-group">
                  <label class="form-label">Nama Lengkap Anggota #{{ index + 1 }}</label>
                  <input type="text" class="form-control" v-model="anggota[index]" :placeholder="`Nama Anggota #${index + 1}`" required />
                </div>
              </div>

              <!-- Error message banner -->
              <div v-if="errorMessage" class="error-banner">
                <i class="ph-fill ph-warning-circle"></i>
                <span>{{ errorMessage }}</span>
              </div>

              <!-- Submit -->
              <div style="margin-top: 2rem;">
                <button type="submit" class="btn btn-green btn-block" style="padding: 1rem; font-size: 1.05rem;">
                  Lanjutkan ke Pembayaran <i class="ph-bold ph-arrow-right"></i>
                </button>
              </div>
            </form>
          </div>
        </div>
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
  font-size: 2.25rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}
.page-header p {
  font-size: 1.05rem;
  opacity: 0.9;
}

.breadcrumb {
  margin-bottom: 1.5rem;
}

.back-link {
  color: var(--primary-green);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.back-link:hover {
  text-decoration: underline;
}

.grid-layout {
  grid-template-columns: 1fr;
  align-items: start;
}

@media (min-width: 900px) {
  .grid-layout {
    grid-template-columns: 1.2fr 1fr;
  }
}

.summary-card {
  padding: 2rem;
  margin-bottom: 1.5rem;
}

.summary-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 0.5rem;
}

.summary-desc {
  font-size: 0.95rem;
  color: var(--text-muted);
  margin-bottom: 1.5rem;
}

.summary-badges {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.summary-coord {
  font-size: 0.85rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.info-card {
  padding: 2rem;
  margin-bottom: 1.5rem;
}

.card-section-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 1rem;
}

.divider {
  height: 1px;
  background-color: var(--border-light);
  margin-bottom: 1.5rem;
}

.indicator-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-top: 1.5rem;
}
@media (min-width: 600px) {
  .indicator-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.indicator-box {
  background: var(--bg-light);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.indicator-icon {
  font-size: 2rem;
  color: var(--primary-green);
}

.indicator-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 600;
}

.indicator-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
}

.text-danger {
  color: #c5221f;
}

/* Weather Widget */
.weather-widget {
  background: var(--bg-light);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.weather-widget-header {
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.weather-scroll {
  display: flex;
  overflow-x: auto;
  padding: 1rem;
  gap: 0.5rem;
  scrollbar-width: thin;
}

.weather-day {
  min-width: 90px;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0.75rem 0.5rem;
  border-radius: var(--radius-sm);
  background: #fff;
  border: 1px solid var(--border-light);
  transition: transform 0.2s;
}
.weather-day:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
}

.active-day {
  border-color: var(--primary-green);
  background: #f2fcf5;
  box-shadow: 0 0 0 1px var(--primary-green);
}
.active-day .w-day-name {
  color: var(--primary-green);
  font-weight: 700;
}

.w-day-name {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 0.15rem;
}

.w-date {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 0.5rem;
}

.w-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.w-temp {
  font-size: 1.1rem;
  font-weight: 800;
  margin-bottom: 0.25rem;
}

.w-cond {
  font-size: 0.75rem;
  line-height: 1.2;
  color: var(--text-muted);
}

.disclaimer-card {
  padding: 1.5rem;
  border: 1px solid #f6c358;
  background-color: #fef7e0;
}

.disclaimer-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #b06000;
  margin-bottom: 0.75rem;
}
.disclaimer-header h4 {
  font-weight: 700;
}

.warn-icon {
  font-size: 1.5rem;
}

.disclaimer-text {
  font-size: 0.85rem;
  color: #5f3a00;
  line-height: 1.6;
  margin-bottom: 1rem;
}

.disclaimer-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #5f3a00;
  cursor: pointer;
}
.disclaimer-checkbox input {
  margin-top: 0.2rem;
}

.form-wrapper {
  padding: 2rem;
}

.form-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 1rem;
}

.section-subtitle {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--primary-green);
  margin: 2rem 0 1rem 0;
  border-bottom: 2px solid var(--primary-green);
  padding-bottom: 0.5rem;
  display: inline-block;
}

.members-section {
  margin-top: 1rem;
}

.btn-block {
  width: 100%;
}

.error-banner {
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #fce8e6;
  border: 1px solid #c5221f;
  color: #c5221f;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
}
</style>
