<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTenant } from '../../composables/useTenant'
// Mengimpor client Supabase terpusat Anda
import { supabase } from '../../lib/supabase'

const { mountainId } = useTenant()

// State internal penampung data reaktif langsung dari database Supabase
const trailsList = ref<any[]>([])
const quotasOverrides = ref<any[]>([])
const bookingsList = ref<any[]>([])

const successMessage = ref('')
const errorMessage = ref('')

// Set default date picker to tomorrow
const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
const defaultDateStr = tomorrow.toISOString().slice(0, 10)

// Inputs Form
const selectedJalurId = ref('')
const targetDate = ref(defaultDateStr)
const quotaLimitInput = ref(100)

// 1. Memuat Informasi Jalur, Transaksi Booking, dan Kustom Override Kuota dari Supabase
const fetchQuotaData = async () => {
  if (!mountainId.value) return

  try {
    // A. Ambil semua data jalur resmi di bawah tenant gunung saat ini
    const { data: trailsData, error: trailsErr } = await supabase
      .from('trails')
      .select('*')
      .eq('mountain_id', mountainId.value)
      .order('name', { ascending: true })

    if (trailsErr) throw trailsErr
    trailsList.value = trailsData || []

    // Otomatis pilih jalur pertama jika input pilihan masih kosong
    if (trailsList.value.length > 0 && !selectedJalurId.value) {
      selectedJalurId.value = trailsList.value[0].id
    }

    // B. Ambil data kustom alokasi kuota dari tabel quotas
    const { data: quotasData, error: quotasErr } = await supabase
      .from('quotas')
      .select('*')

    if (quotasErr) throw quotasErr
    quotasOverrides.value = quotasData || []

    // C. Ambil akumulasi data booking aktif untuk kalkulasi slot kuota terpakai (PRD Bab 9)
    const { data: bookingsData, error: bookingsErr } = await supabase
      .from('bookings')
      .select(`
        *,
        booking_members (id)
      `)
      .eq('mountain_id', mountainId.value)
      .in('status', ['PAID', 'APPROVED', 'CHECKED_IN', 'PERMIT_REVIEW', 'WAITING_PAYMENT'])

    if (bookingsErr) throw bookingsErr
    bookingsList.value = bookingsData || []

    // Sinkronisasikan nilai form input dengan database setelah data berhasil dimuat
    syncFormInput()

  } catch (error) {
    console.error('Gagal memuat arsitektur kuota harian:', error)
  }
}

// Watcher untuk re-fetch otomatis jika user berpinto domain tenant gunung
watch(() => mountainId.value, (newId) => {
  if (newId) fetchQuotaData()
}, { immediate: true })

const activeRoute = computed(() => {
  return trailsList.value.find(j => j.id === selectedJalurId.value)
})

// 2. Pemetaan Adaptor Computed agar Selaras Menyerupai Struktur DB Pinia Dummy di Template
const db = computed(() => ({
  jalur: trailsList.value.map(t => ({
    id: t.id,
    nama_jalur: t.name
  }))
}))

// 3. Kalkulasi Real-time Slot Kuota Total & Terpakai per Tanggal Pilihan Form
const activeKuotaEntry = computed(() => {
  const trail = trailsList.value.find(t => t.id === selectedJalurId.value)
  const defaultMax = trail?.max_capacity || 100

  // Cari apakah ada baris override kustom kuota di tabel quotas
  const override = quotasOverrides.value.find(
    q => q.trail_id === selectedJalurId.value && q.quota_date === targetDate.value
  )
  const total = override ? override.max_quota : defaultMax

  // Hitung jumlah pendaki yang sudah membooking slot di tanggal tersebut
  const used = bookingsList.value
    .filter(b => b.trail_id === selectedJalurId.value && b.entry_date === targetDate.value)
    .reduce((acc, b) => acc + (b.booking_members ? b.booking_members.length : 0), 0)

  return {
    kuota_total: total,
    kuota_terpakai: used
  }
})

// 4. Agregasi Otomatis Matrix Ketersediaan Slot Kuota 7 Hari Ke Depan
const next7DaysList = computed(() => {
  const list = []
  const today = new Date()
  
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(today.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    
    const pathQuotas = trailsList.value.map(j => {
      const defaultMax = j.max_capacity || 100
      
      const override = quotasOverrides.value.find(
        q => q.trail_id === j.id && q.quota_date === dateStr
      )
      const total = override ? override.max_quota : defaultMax

      const terpakai = bookingsList.value
        .filter(b => b.trail_id === j.id && b.entry_date === dateStr)
        .reduce((acc, b) => acc + (b.booking_members ? b.booking_members.length : 0), 0)

      return {
        jalurName: j.name,
        dateStr,
        total,
        terpakai,
        sisa: total - terpakai
      }
    })
    list.push(...pathQuotas)
  }
  return list
})

// 5. Mutasi Aksi Pembaruan Limit Kuota Menggunakan Strategi Upsert ke Supabase Table (PRD Bab 4.1)
const handleUpdateQuota = async () => {
  successMessage.value = ''
  errorMessage.value = ''

  if (quotaLimitInput.value < 0) {
    errorMessage.value = 'Kuota total tidak boleh kurang dari 0.'
    return
  }

  const currentUsed = activeKuotaEntry.value.kuota_terpakai
  if (quotaLimitInput.value < currentUsed) {
    errorMessage.value = `Gagal. Kuota total tidak boleh lebih kecil dari kuota terpakai saat ini (${currentUsed} slot telah dibooking).`
    return
  }

  try {
    // Jalankan perintah upsert ke tabel quotas Supabase (Insert baru atau Update jika unique key bentrok)
    const { error } = await supabase
      .from('quotas')
      .upsert({
        trail_id: selectedJalurId.value,
        quota_date: targetDate.value,
        max_quota: quotaLimitInput.value
      }, { onConflict: 'trail_id,quota_date' })

    if (error) throw error

    successMessage.value = `Kuota untuk ${activeRoute.value?.name} tanggal ${targetDate.value} berhasil diubah menjadi ${quotaLimitInput.value}!`
    await fetchQuotaData() // Refresh data visual state
  } catch (err: any) {
    errorMessage.value = err.message || 'Gagal memperbarui kuota ke dalam database server.'
  }
}

// Menyelaraskan form pengisian angka ketika dropdown jalur atau input tanggal berganti
const syncFormInput = () => {
  quotaLimitInput.value = activeKuotaEntry.value.kuota_total
}

// Pemicu otomatis pengisian nilai form saat entri data di-resolve dari server
watch([selectedJalurId, targetDate], () => {
  syncFormInput()
})
</script>

<template>
  <div class="quota-admin-page container animate-fade-in">
    <div class="header-section">
      <h2 style="font-size: 2rem; font-weight: 700; color: var(--text-main);">Manajemen Kuota Pendakian</h2>
      <p class="subtitle">Sesuaikan batas maksimal kapasitas pendaki per hari untuk masing-masing jalur pendakian resmi.</p>
    </div>

    <div class="grid-2 margin-top-2">
      <div>
        <div class="card-tngm adjust-quota-card">
          <div style="background-color: var(--primary-green); color: #fff; padding: 1rem 1.5rem; font-weight: 700;">Atur Ulang Kuota</div>
          <div style="padding: 1.5rem;">
            <form @submit.prevent="handleUpdateQuota">
              <div class="form-group">
                <label class="form-label" style="font-weight: 600; color: var(--text-main);">Pilih Jalur Pendakian</label>
                <select v-model="selectedJalurId" @change="syncFormInput" class="form-control">
                  <option v-for="j in db.jalur" :key="j.id" :value="j.id">{{ j.nama_jalur }}</option>
                </select>
              </div>

              <div class="form-group margin-top-1">
                <label class="form-label" style="font-weight: 600; color: var(--text-main);">Tanggal Penyesuaian</label>
                <input type="date" v-model="targetDate" @change="syncFormInput" class="form-control" />
              </div>

              <div class="current-quota-summary alert alert-info margin-top-1">
                <div>
                  <strong>Status Saat Ini:</strong>
                  <ul>
                    <li>Total Kuota: {{ activeKuotaEntry.kuota_total }} Orang</li>
                    <li>Terpakai: {{ activeKuotaEntry.kuota_terpakai }} Orang</li>
                    <li>Tersisa: <strong>{{ activeKuotaEntry.kuota_total - activeKuotaEntry.kuota_terpakai }} Orang</strong></li>
                  </ul>
                </div>
              </div>

              <div class="form-group margin-top-1">
                <label class="form-label" style="font-weight: 600; color: var(--text-main);">Batas Kuota Baru (Jumlah Total Slot)</label>
                <input type="number" v-model.number="quotaLimitInput" class="form-control" min="0" />
                <span class="form-help">Sesuaikan kapasitas default untuk hari libur / antisipasi cuaca ekstrem.</span>
              </div>

              <div v-if="successMessage" class="alert alert-success" style="background: #e6f4ea; border: 1px solid var(--primary-green); color: var(--primary-green);">
                <i class="ph-fill ph-check-circle"></i> <span>{{ successMessage }}</span>
              </div>
              <div v-if="errorMessage" class="alert alert-danger" style="background: #fce8e6; border: 1px solid #c5221f; color: #c5221f;">
                <i class="ph-fill ph-warning-circle"></i> <span>{{ errorMessage }}</span>
              </div>

              <button type="submit" class="btn btn-green w-full margin-top-1">Perbarui Kuota Jalur</button>
            </form>
          </div>
        </div>
      </div>

      <div>
        <div class="card-tngm overview-card">
          <div class="table-header">
            <h3 class="card-title">Ketersediaan Kuota 7 Hari ke Depan</h3>
          </div>
          <div class="divider" style="margin:0;"></div>

          <div class="table-container table-responsive list-scroll" style="padding: 1rem 1.5rem;">
            <table class="custom-table compact-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Jalur</th>
                  <th>Terpakai</th>
                  <th>Batas</th>
                  <th>Sisa</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(q, index) in next7DaysList" :key="index" :class="{'highlight-low': q.sisa < 10}">
                  <td><code>{{ q.dateStr }}</code></td>
                  <td><strong>{{ q.jalurName }}</strong></td>
                  <td>👥 {{ q.terpakai }}</td>
                  <td>{{ q.total }}</td>
                  <td class="font-bold" :class="q.sisa <= 0 ? 'text-red' : 'text-primary'">
                    {{ q.sisa }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Seluruh kode CSS dipertahankan 100% tanpa ada modifikasi */
.quota-admin-page {
  padding-top: 2rem;
  padding-bottom: 4rem;
}
.subtitle {
  font-size: 1rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}
.margin-top-2 {
  margin-top: 2rem;
}
.margin-top-1 {
  margin-top: 1.25rem;
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}
@media (min-width: 900px) {
  .grid-2 {
    grid-template-columns: 1fr 1.2fr;
  }
}
.current-quota-summary {
  background-color: #f0fdf4;
  border: 1px solid rgba(19, 115, 51, 0.15);
  color: var(--primary-green);
  padding: 1rem 1.5rem;
  border-radius: var(--radius-sm);
}
.current-quota-summary ul {
  padding-left: 1.25rem;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}
.form-help {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 0.5rem;
}
.list-scroll {
  max-height: 520px;
  overflow-y: auto;
}
.table-header {
  padding: 1.5rem;
  background-color: var(--bg-light);
  border-bottom: 1px solid var(--border-light);
}
.card-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-main);
}
.compact-table th {
  padding: 0.75rem 1rem;
}
.compact-table td {
  padding: 0.75rem 1rem;
}
.highlight-low {
  background-color: #fce8e6;
}
.font-bold {
  font-weight: 700;
}
.text-primary {
  color: var(--primary-green);
}
.text-red {
  color: #c5221f;
}
.w-full {
  width: 100%;
}
.alert {
  padding: 1rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  margin-top: 1rem;
}
</style>