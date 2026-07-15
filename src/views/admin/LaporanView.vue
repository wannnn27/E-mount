<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTenant } from '../../composables/useTenant'
// Mengimpor client Supabase terpusat dari folder lib Anda
import { supabase } from '../../lib/supabase'

const { mountainId } = useTenant()

// State internal penampung raw data reaktif langsung dari database Supabase
const rawBookings = ref<any[]>([])
const rawTrails = ref<any[]>([])

// Filter states
const selectedJalurFilter = ref('all')
const selectedStatusFilter = ref('all')
const selectedRangeFilter = ref('all') // 'all', 'today', 'week', 'month'

// 1. Memuat Seluruh Data Manifes Transaksi & Jalur yang Teralokasi untuk Gunung/Tenant Aktif
const fetchReportData = async () => {
  if (!mountainId.value) return

  try {
    // A. Mengambil seluruh data master jalur milik tenant ini
    const { data: trailsData, error: trailsErr } = await supabase
      .from('trails')
      .select('*')
      .eq('mountain_id', mountainId.value)

    if (trailsErr) throw trailsErr
    rawTrails.value = trailsData || []

    // B. Mengambil seluruh data transaksi booking lengkap dengan relasi pembayaran dan manifest anggota kelompok
    const { data: bookingsData, error: bookingsErr } = await supabase
      .from('bookings')
      .select(`
        *,
        payments (*),
        booking_members (id),
        users (name)
      `)
      .eq('mountain_id', mountainId.value)
      .order('entry_date', { ascending: false })

    if (bookingsErr) throw bookingsErr
    rawBookings.value = bookingsData || []
  } catch (error) {
    console.error('Gagal memuat rekapitulasi laporan:', error)
  }
}

// Memantau perpindahan domain tenant/gunung untuk memicu fetch otomatis
watch(() => mountainId.value, (newId) => {
  if (newId) fetchReportData()
}, { immediate: true })

onMounted(() => {
  fetchReportData()
})

// 2. Proksi Objek DB Pembantu untuk Mencegah Error Loop Direktif v-for pada Dropdown Template
const db = computed(() => ({
  jalur: rawTrails.value.map(t => ({
    id: t.id,
    nama_jalur: t.name
  }))
}))

// 3. Kumpulan Fungsi Pembantu (Helpers) Data Relasional
const getJalurName = (jalurId: string) => {
  return rawTrails.value.find(j => j.id === jalurId)?.name || 'Jalur Tidak Dikenal'
}

const getPaymentAmount = (bookingId: string) => {
  const booking = rawBookings.value.find(b => b.id === bookingId)
  return booking?.payments?.[0]?.amount || 0
}

const getPaymentStatus = (bookingId: string) => {
  const booking = rawBookings.value.find(b => b.id === bookingId)
  return booking?.payments?.[0]?.status || 'Pending'
}

const getCheckinStatus = (bookingId: string) => {
  const booking = rawBookings.value.find(b => b.id === bookingId)
  if (!booking) return '-'
  
  if (booking.status === 'CHECKED_IN') return 'Checked-in'
  if (booking.status === 'CHECKED_OUT' || booking.status === 'COMPLETED') return 'Checked-out'
  return 'Belum Check-in'
}

const formatRupiah = (val: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val)
}

// 4. Algoritma Pemfilteran Multivariat (Multi-Filter Client Side) (PRD Bab 8)
const filteredBookings = computed(() => {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  
  // Konfigurasi kalkulasi batas waktu rentang tanggal
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(today.getDate() - 7)
  const oneMonthAgo = new Date()
  oneMonthAgo.setMonth(today.getMonth() - 1)

  return rawBookings.value.map(b => {
    // Normalisasi Status Database ke format string visual bahasa Indonesia lama yang dikenali template
    let visualStatus = 'Menunggu Pembayaran'
    if (b.status === 'PERMIT_REVIEW') visualStatus = 'Menunggu Verifikasi'
    else if (['PAID', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'].includes(b.status)) visualStatus = 'Lunas'
    else if (b.status === 'CANCELLED') visualStatus = 'Dibatalkan'

    return {
      id: b.id,
      jalur_id: b.trail_id,
      nama_pemimpin: b.full_name || b.users?.name || 'Ketua Kelompok',
      tanggal_naik: b.entry_date,
      jumlah_pendaki: b.booking_members ? b.booking_members.length : 0,
      status_booking: visualStatus
    }
  }).filter(b => {
    // A. Filter berdasarkan Jalur Pendakian
    if (selectedJalurFilter.value !== 'all' && b.jalur_id !== selectedJalurFilter.value) {
      return false
    }

    // B. Filter berdasarkan Status Administrasi Tiket
    if (selectedStatusFilter.value !== 'all' && b.status_booking !== selectedStatusFilter.value) {
      return false
    }

    // C. Filter berdasarkan Rentang Dimensi Waktu
    const bookingDate = new Date(b.tanggal_naik)
    if (selectedRangeFilter.value === 'today' && b.tanggal_naik !== todayStr) {
      return false
    }
    if (selectedRangeFilter.value === 'week' && bookingDate < oneWeekAgo) {
      return false
    }
    if (selectedRangeFilter.value === 'month' && bookingDate < oneMonthAgo) {
      return false
    }

    return true
  })
})

// 5. Agregasi Metrik Finansial Retribusi Tersaring Dinamis
const totalClimbers = computed(() => {
  return filteredBookings.value.reduce((acc, b) => acc + b.jumlah_pendaki, 0)
})

const confirmedRevenue = computed(() => {
  return filteredBookings.value
    .filter(b => b.status_booking === 'Lunas')
    .reduce((acc, b) => acc + getPaymentAmount(b.id), 0)
})

// Pemicu Pencetakan Dokumen Fisik Browser
const printReport = () => {
  window.print()
}

// 6. Utilitas Ekspor File Data CSV Lapangan (Mendukung Tanda Kutip Guna Mencegah Data Pecah/Comma-Splitting)
const exportCSV = () => {
  const headers = ['ID Booking', 'Nama Pemimpin', 'Jalur', 'Tanggal Naik', 'Jumlah Pendaki', 'Total Biaya', 'Status Booking', 'Status Check-in']
  
  const rows = filteredBookings.value.map(b => [
    `"${b.id}"`,
    `"${b.nama_pemimpin}"`,
    `"${getJalurName(b.jalur_id)}"`,
    `"${b.tanggal_naik}"`,
    b.jumlah_pendaki,
    getPaymentAmount(b.id),
    `"${b.status_booking}"`,
    `"${getCheckinStatus(b.id)}"`
  ])

  // Menyusun konten CSV string
  const csvContent = "data:text/csv;charset=utf-8," 
    + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
  
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement("a")
  link.setAttribute("href", encodedUri)
  link.setAttribute("download", `laporan_pendakian_${selectedRangeFilter.value}_${Date.now()}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<template>
  <div class="laporan-page container animate-fade-in">
    <div class="header-section no-print">
      <h2 style="font-size: 2rem; font-weight: 700; color: var(--text-main);">Rekapitulasi Laporan Pendaki</h2>
      <p class="subtitle">Analisis statistik kunjungan pendaki, kumpulkan data retribusi pembayaran tiket, dan ekspor dokumen laporan secara berkala.</p>
    </div>

    <div class="filters-bar card-tngm no-print margin-top-2">
      <div class="grid-3" style="padding: 1.5rem;">
        <div class="form-group margin-bottom-none">
          <label class="form-label" style="font-weight: 600; color: var(--text-main);">Periode Tanggal Naik</label>
          <select v-model="selectedRangeFilter" class="form-control">
            <option value="all">Semua Periode</option>
            <option value="today">Hari Ini</option>
            <option value="week">1 Minggu Terakhir</option>
            <option value="month">1 Bulan Terakhir</option>
          </select>
        </div>

        <div class="form-group margin-bottom-none">
          <label class="form-label" style="font-weight: 600; color: var(--text-main);">Saring Jalur</label>
          <select v-model="selectedJalurFilter" class="form-control">
            <option value="all">Semua Jalur</option>
            <option v-for="j in db.jalur" :key="j.id" :value="j.id">{{ j.nama_jalur }}</option>
          </select>
        </div>

        <div class="form-group margin-bottom-none">
          <label class="form-label" style="font-weight: 600; color: var(--text-main);">Saring Status Booking</label>
          <select v-model="selectedStatusFilter" class="form-control">
            <option value="all">Semua Status</option>
            <option value="Menunggu Pembayaran">Menunggu Pembayaran</option>
            <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
            <option value="Lunas">Lunas</option>
            <option value="Dibatalkan">Dibatalkan</option>
          </select>
        </div>
      </div>
    </div>

    <div class="print-only print-header text-center">
      <h2>LAPORAN REKAPITULASI PENGUNJUNG BASECAMP</h2>
      <h3>SISTEM RESERVASI GUNUNG SLAMET</h3>
      <p>Saringan Filter Jalur: {{ selectedJalurFilter === 'all' ? 'Semua Jalur' : getJalurName(selectedJalurFilter) }} | Status: {{ selectedStatusFilter }}</p>
      <div class="divider"></div>
    </div>

    <div class="grid-2 margin-top-1">
      <div class="card-tngm summary-box text-center">
        <span class="summary-label">Total Pendaki Tersaring:</span>
        <h3 class="summary-value" style="color: var(--text-main);">👥 {{ totalClimbers }} Orang</h3>
      </div>
      <div class="card-tngm summary-box text-center">
        <span class="summary-label">Pendapatan Confirmed (Lunas):</span>
        <h3 class="summary-value text-green">{{ formatRupiah(confirmedRevenue) }}</h3>
      </div>
    </div>

    <div class="card-tngm table-card margin-top-1">
      <div class="table-header-controls no-print">
        <h3 class="card-title">Daftar Rombongan Pendaki</h3>
        <div class="export-btns">
          <button @click="printReport" class="btn btn-outline btn-sm">🖨️ Cetak (PDF)</button>
          <button @click="exportCSV" class="btn btn-green btn-sm margin-left-sm">📥 Ekspor CSV</button>
        </div>
      </div>
      <div class="divider no-print" style="margin: 0;"></div>

      <div class="table-container table-responsive" style="padding: 1rem 1.5rem;">
        <table class="custom-table" v-if="filteredBookings.length > 0">
          <thead>
            <tr>
              <th>ID Booking</th>
              <th>Ketua</th>
              <th>Jalur</th>
              <th>Tgl Naik</th>
              <th>Jumlah</th>
              <th>Biaya</th>
              <th>Status Booking</th>
              <th>Status Check-in</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in filteredBookings" :key="b.id">
              <td><code>{{ b.id }}</code></td>
              <td><strong>{{ b.nama_pemimpin }}</strong></td>
              <td>{{ getJalurName(b.jalur_id) }}</td>
              <td><code>{{ b.tanggal_naik }}</code></td>
              <td>👥 {{ b.jumlah_pendaki }}</td>
              <td>{{ formatRupiah(getPaymentAmount(b.id)) }}</td>
              <td>
                <span class="badge" :class="{
                  'badge-warning': b.status_booking === 'Menunggu Pembayaran',
                  'badge-info': b.status_booking === 'Menunggu Verifikasi',
                  'badge-success': b.status_booking === 'Lunas',
                  'badge-danger': b.status_booking === 'Dibatalkan'
                }">
                  {{ b.status_booking }}
                </span>
              </td>
              <td>{{ getCheckinStatus(b.id) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-table text-center margin-top-1">
          <p class="text-muted">Tidak ada data pendakian yang cocok dengan saringan filter Anda.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Seluruh kode CSS dipertahankan 100% tanpa ada modifikasi */
.laporan-page {
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
.margin-bottom-none {
  margin-bottom: 0;
}
.margin-left-sm {
  margin-left: 0.5rem;
}
.divider {
  height: 1px;
  background-color: var(--border-light);
  margin: 1.25rem 0;
}
.text-center {
  text-align: center;
}
.text-green {
  color: var(--primary-green) !important;
  font-weight: 800 !important;
}
.grid-3 {
  display: grid;
  gap: 1.5rem;
}
@media (min-width: 768px) {
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}
@media (min-width: 768px) {
  .grid-2 { grid-template-columns: repeat(2, 1fr); }
}
.summary-box {
  padding: 1.5rem;
}
.summary-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  display: block;
  font-weight: 600;
}
.summary-value {
  font-size: 1.5rem;
  margin-top: 0.5rem;
  font-weight: 800;
}
.table-header-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--bg-light);
}
.card-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-main);
}
.export-btns {
  display: flex;
  gap: 0.5rem;
}
.text-muted {
  color: var(--text-muted);
}
.empty-table {
  padding: 3rem 0;
}
.btn-sm {
  padding: 0.45rem 0.85rem;
  font-size: 0.8rem;
  border-radius: var(--radius-sm);
}
.btn-outline {
  border: 1px solid var(--border-light);
  color: var(--text-main);
  background: var(--bg-white);
}
.btn-outline:hover {
  border-color: var(--primary-green);
  color: var(--primary-green);
}
.print-only {
  display: none;
}
@media print {
  .no-print {
    display: none !important;
  }
  .print-only {
    display: block !important;
  }
  body {
    background: white !important;
    color: black !important;
  }
  .card-tngm {
    border: 1px solid #000 !important;
    background: transparent !important;
    box-shadow: none !important;
    padding: 1rem !important;
  }
  .text-green {
    color: #000 !important;
  }
  .table-card {
    border: none !important;
  }
  .custom-table {
    border: 1px solid #000 !important;
  }
  .custom-table th, .custom-table td {
    border-bottom: 1px solid #000 !important;
    color: #000 !important;
  }
  .print-header h2 {
    font-size: 1.5rem;
    font-weight: 800;
  }
  .print-header h3 {
    font-size: 1.1rem;
    margin-top: 0.25rem;
  }
  .print-header p {
    font-size: 0.8rem;
    margin-top: 0.25rem;
  }
}
</style>