<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTenant } from '../../composables/useTenant'
// Mengimpor client Supabase terpusat dari folder lib Anda
import { supabase } from '../../lib/supabase'

const { mountainId } = useTenant()

const qrCodeInput = ref('')
const searchFilter = ref('')
const alertSuccess = ref('')
const alertError = ref('')
const isScanning = ref(false)

// State penampung data manifes rombongan terdaftar dari database
const bookingsList = ref<any[]>([])
let bookingSubscription: any = null

// 1. Memuat Data Rombongan yang Layak Scan (PAID, CHECKED_IN, CHECKED_OUT) Berdasarkan Tenant Gunung Aktif
const fetchBookingsData = async () => {
  if (!mountainId.value) return
  
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        users (name)
      `)
      .eq('mountain_id', mountainId.value)
      .in('status', ['PAID', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'])
      .order('created_at', { ascending: false })

    if (error) throw error
    bookingsList.value = data || []
  } catch (err) {
    console.error('Gagal mengambil data manifes check-in:', err)
  }
}

// 2. Setup Realtime Subscription Agar Layar Monitor Petugas Terupdate Otomatis Saat Ada yang Bayar/Update
const setupRealtimeSync = () => {
  bookingSubscription = supabase
    .channel('realtime-checkin-admin')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
      fetchBookingsData()
    })
    .subscribe()
}

watch(() => mountainId.value, (newId) => {
  if (newId) fetchBookingsData()
}, { immediate: true })

onMounted(() => {
  setupRealtimeSync()
})

onUnmounted(() => {
  if (bookingSubscription) {
    supabase.removeChannel(bookingSubscription)
  }
})

// 3. Mutasi Status Kehadiran (State Machine Pintu Masuk/Keluar) ke Supabase (PRD Bab 7)
const handleScanSubmit = async () => {
  alertSuccess.value = ''
  alertError.value = ''

  const inputClean = qrCodeInput.value.trim()
  if (!inputClean) {
    alertError.value = 'Harap isi kode QR tiket atau tempel kode hasil pemindaian.'
    return
  }

  // Cari berkas transaksi di dalam list lokal (fleksibel mendukung scan kode booking/ID/alternatif dummy prefix)
  const foundBooking = bookingsList.value.find(b => 
    b.code?.toLowerCase() === inputClean.toLowerCase() ||
    b.id.toLowerCase() === inputClean.toLowerCase() ||
    `QR-${b.code}`.toLowerCase() === inputClean.toLowerCase()
  )

  if (!foundBooking) {
    alertError.value = 'Kode E-Tiket tidak valid atau data rombongan belum melunasi pembayaran tagihan.'
    return
  }

  // Proteksi Logika Alur Validasi Naik-Turun Gunung
  if (foundBooking.status === 'CHECKED_OUT' || foundBooking.status === 'COMPLETED') {
    alertError.value = `Rombongan atas nama ${foundBooking.users?.name || 'Ketua'} sudah berstatus Checked-out / Selesai.`
    return
  }

  // Tentukan status berikutnya berdasarkan status aktif saat ini
  const nextStatus = foundBooking.status === 'PAID' ? 'CHECKED_IN' : 'CHECKED_OUT'
  const actionLabel = nextStatus === 'CHECKED_IN' ? 'Kehadiran CHECK-IN (Naik)' : 'Kehadiran CHECK-OUT (Turun)'

  try {
    const { error } = await supabase
      .from('bookings')
      .update({ status: nextStatus })
      .eq('id', foundBooking.id)

    if (error) throw error

    alertSuccess.value = `Berhasil! Pencatatan ${actionLabel} untuk rombongan ${foundBooking.users?.name || ''} sukses disimpan.`
    qrCodeInput.value = '' // Kosongkan input form setelah sukses
    await fetchBookingsData() // Refresh list data
  } catch (err: any) {
    alertError.value = err.message || 'Gagal merubah status manifes kehadiran pintu penjagaan.'
  }
}

// Simulator Animasi Pemindaian Laser Kamera Sesuai Keinginan UI Tim Anda
const simulateScan = (kodeQr: string) => {
  isScanning.value = true
  alertSuccess.value = ''
  alertError.value = ''
  
  setTimeout(() => {
    isScanning.value = false
    qrCodeInput.value = kodeQr
    handleScanSubmit()
  }, 1500)
}

// 4. Transformasi & Filter Kompatibilitas Data Untuk Direktif Elemen Tabel
const filteredTickets = computed(() => {
  const searchLower = searchFilter.value.toLowerCase()
  
  return bookingsList.value.map(b => {
    // Memetakan status database ke istilah string visual bahasa Indonesia lama
    let statusText = 'Belum Check-in'
    if (b.status === 'CHECKED_IN') statusText = 'Checked-in'
    if (b.status === 'CHECKED_OUT' || b.status === 'COMPLETED') statusText = 'Checked-out'

    return {
      id: b.id,
      booking_id: b.id,
      kode_qr: b.code || b.id.substring(0, 8).toUpperCase(),
      status_checkin: statusText,
      nama_pemimpin: b.users?.name || 'Unknown'
    }
  }).filter(t => {
    return (
      t.kode_qr.toLowerCase().includes(searchLower) ||
      t.booking_id.toLowerCase().includes(searchLower) ||
      t.nama_pemimpin.toLowerCase().includes(searchLower)
    )
  })
})

const getJalurName = (jalurId: string) => {
  return 'Jalur Aktif' // Mengamankan fallback visual ringkas
}

const getBookingObj = (bookingId: string) => {
  const found = bookingsList.value.find(b => b.id === bookingId)
  return found ? { nama_pemimpin: found.users?.name || 'Unknown' } : null
}
</script>

<template>
  <div class="checkin-admin-page container animate-fade-in">
    <div class="header-section">
      <h2 style="font-size: 2rem; font-weight: 700; color: var(--text-main);">Validasi QR Check-in Pendaki</h2>
      <p class="subtitle">Scan QR Code e-tiket pendaki atau masukkan ID booking untuk mencatat kehadiran naik/turun gunung secara real-time.</p>
    </div>

    <div class="grid-2 margin-top-2">
      <!-- Left column: Scanner simulation -->
      <div>
        <div class="card-tngm scanner-sim-card">
          <div style="background-color: var(--primary-green); color: #fff; padding: 1rem 1.5rem; font-weight: 700;">Simulator Pemindai QR</div>

          <div style="padding: 1.5rem;">
            <div class="scanner-screen text-center" :class="{ 'scanning-active': isScanning }">
              <div class="scanner-laser" v-show="isScanning"></div>
              <div class="scanner-corners">
                <span class="tl"></span><span class="tr"></span><span class="bl"></span><span class="br"></span>
              </div>
              <i class="ph-bold ph-camera scanner-text-icon" v-if="!isScanning"></i>
              <i class="ph-bold ph-qr-code scanner-text-icon" v-else style="color: var(--accent-orange); animation: pulse 1s infinite;"></i>
              <p class="scanner-instruction">{{ isScanning ? 'Menganalisis QR Code...' : 'Arahkan kamera ke QR Code e-tiket pendaki.' }}</p>
            </div>

            <form @submit.prevent="handleScanSubmit" class="margin-top-1">
              <div class="form-group">
                <label class="form-label" style="font-weight: 600; color: var(--text-main);">Hasil Pemindaian / Masukkan Manual Kode QR</label>
                <div class="input-action-group">
                  <input 
                    type="text" 
                    v-model="qrCodeInput" 
                    class="form-control text-upper" 
                    placeholder="Contoh: QR-book-12345" 
                  />
                  <button type="submit" class="btn btn-green">Validasi</button>
                </div>
                <span class="form-help">Bila kamera scanner terganggu, ketik nomor e-tiket manual.</span>
              </div>
            </form>

            <!-- Banner alerts -->
            <div v-if="alertSuccess" class="alert alert-success margin-top-1" style="background: #e6f4ea; border: 1px solid var(--primary-green); color: var(--primary-green);">
              <i class="ph-fill ph-check-circle"></i> <span>{{ alertSuccess }}</span>
            </div>
            
            <div v-if="alertError" class="alert alert-danger margin-top-1" style="background: #fce8e6; border: 1px solid #c5221f; color: #c5221f;">
              <i class="ph-fill ph-warning-circle"></i> <span>{{ alertError }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right column: List of checkins -->
      <div>
        <div class="card-tngm status-list-card">
          <div class="table-header">
            <h3 class="card-title">Rombongan Terdaftar</h3>
            <input 
              type="text" 
              v-model="searchFilter" 
              class="form-control search-input" 
              placeholder="Cari pemimpin / ID booking..." 
            />
          </div>
          
          <div class="divider"></div>

          <div class="table-container table-responsive list-scroll" style="padding: 0 1.5rem 1.5rem 1.5rem;">
            <table class="custom-table" v-if="filteredTickets.length > 0">
              <thead>
                <tr>
                  <th>Kode QR</th>
                  <th>Ketua</th>
                  <th>Status</th>
                  <th>Aksi Cepat</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in filteredTickets" :key="t.id">
                  <td><code>{{ t.kode_qr }}</code></td>
                  <td><strong>{{ getBookingObj(t.booking_id)?.nama_pemimpin }}</strong></td>
                  <td>
                    <span class="badge" :class="{
                      'badge-info': t.status_checkin === 'Belum Check-in',
                      'badge-success': t.status_checkin === 'Checked-in',
                      'badge-danger': t.status_checkin === 'Checked-out'
                    }">
                      {{ t.status_checkin }}
                    </span>
                  </td>
                  <td>
                    <!-- Simulation trigger btn -->
                    <button 
                      @click="simulateScan(t.kode_qr)" 
                      class="btn btn-outline btn-xs-action"
                      style="border-color: var(--primary-green); color: var(--primary-green);"
                      :disabled="t.status_checkin === 'Checked-out'">
                      {{ t.status_checkin === 'Belum Check-in' ? 'Check-in' : 'Check-out' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty-table text-center margin-top-1">
              <p class="text-muted">Tidak ada tiket rombongan lunas yang cocok dengan pencarian.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Seluruh kode CSS dipertahankan 100% tanpa ada modifikasi */
.checkin-admin-page {
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
.divider {
  height: 1px;
  background-color: var(--border-light);
  margin: 1rem 0;
}
.text-center {
  text-align: center;
}
.text-upper {
  text-transform: uppercase;
}
.text-muted {
  color: var(--text-muted);
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}
@media (min-width: 900px) {
  .grid-2 {
    grid-template-columns: 1fr 1.5fr;
  }
}
.scanner-screen {
  background-color: #f8f9fa;
  border: 2px dashed var(--border-light);
  height: 200px;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
.scanner-text-icon {
  font-size: 4rem;
  color: var(--primary-green);
  z-index: 2;
  transition: all 0.3s;
}
.scanner-instruction {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 600;
  margin-top: 0.5rem;
  z-index: 2;
}
.scanning-active {
  background-color: #000 !important;
  border-color: #000 !important;
}
.scanning-active .scanner-instruction {
  color: #fff;
}
.scanner-corners span {
  position: absolute;
  width: 20px;
  height: 20px;
  border: 3px solid var(--primary-green);
}
.scanning-active .scanner-corners span {
  border-color: var(--accent-orange);
}
.scanner-corners .tl { top: 10px; left: 10px; border-right: none; border-bottom: none; }
.scanner-corners .tr { top: 10px; right: 10px; border-left: none; border-bottom: none; }
.scanner-corners .bl { bottom: 10px; left: 10px; border-right: none; border-top: none; }
.scanner-corners .br { bottom: 10px; right: 10px; border-left: none; border-top: none; }
.scanner-laser {
  position: absolute;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: var(--accent-orange);
  box-shadow: 0 0 10px var(--accent-orange), 0 0 20px var(--accent-orange);
  z-index: 1;
  animation: scanMotion 1.2s infinite linear;
}
@keyframes scanMotion {
  0% { top: 10%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: 90%; opacity: 0; }
}
@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}
.input-action-group {
  display: flex;
  gap: 0.5rem;
}
.input-action-group input {
  flex: 1;
}
.form-help {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--bg-light);
  border-bottom: 1px solid var(--border-light);
}
.card-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-main);
}
.search-input {
  max-width: 240px;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
}
.list-scroll {
  max-height: 480px;
  overflow-y: auto;
}
.btn-xs-action {
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  border-radius: var(--radius-sm);
}
.alert {
  padding: 1rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
}
</style>