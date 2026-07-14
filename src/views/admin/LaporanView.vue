<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDatabaseStore } from '../../stores/database'

const db = useDatabaseStore()

// Filter states
const selectedJalurFilter = ref('all')
const selectedStatusFilter = ref('all')
const selectedRangeFilter = ref('all') // 'all', 'today', 'week', 'month'

const getJalurName = (jalurId: string) => {
  return db.jalur.find(j => j.id === jalurId)?.nama_jalur || 'Unknown'
}

const getPaymentAmount = (bookingId: string) => {
  const pay = db.pembayaran.find(p => p.booking_id === bookingId)
  return pay ? pay.jumlah : 0
}

const getPaymentStatus = (bookingId: string) => {
  const pay = db.pembayaran.find(p => p.booking_id === bookingId)
  return pay ? pay.status_verifikasi : 'Pending'
}

const getCheckinStatus = (bookingId: string) => {
  const tix = db.tiket.find(t => t.booking_id === bookingId)
  return tix ? tix.status_checkin : '-'
}

const formatRupiah = (val: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val)
}

// Filtering algorithm
const filteredBookings = computed(() => {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  
  // Date calculations
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(today.getDate() - 7)
  const oneMonthAgo = new Date()
  oneMonthAgo.setMonth(today.getMonth() - 1)

  return db.bookings.filter(b => {
    // 1. Jalur filter
    if (selectedJalurFilter.value !== 'all' && b.jalur_id !== selectedJalurFilter.value) {
      return false
    }

    // 2. Status filter
    if (selectedStatusFilter.value !== 'all' && b.status_booking !== selectedStatusFilter.value) {
      return false
    }

    // 3. Range filter
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

// Metrics for the filtered rows
const totalClimbers = computed(() => {
  return filteredBookings.value.reduce((acc, b) => acc + b.jumlah_pendaki, 0)
})

const confirmedRevenue = computed(() => {
  // Sum payments only for confirmed/Lunas bookings in current filtered listing
  return filteredBookings.value
    .filter(b => b.status_booking === 'Lunas')
    .reduce((acc, b) => acc + getPaymentAmount(b.id), 0)
})

// Trigger browser printing
const printReport = () => {
  window.print()
}

// Download Table data as CSV file
const exportCSV = () => {
  const headers = ['ID Booking', 'Nama Pemimpin', 'Jalur', 'Tanggal Naik', 'Jumlah Pendaki', 'Total Biaya', 'Status Booking', 'Status Check-in']
  
  const rows = filteredBookings.value.map(b => [
    b.id,
    b.nama_pemimpin,
    getJalurName(b.jalur_id),
    b.tanggal_naik,
    b.jumlah_pendaki,
    getPaymentAmount(b.id),
    b.status_booking,
    getCheckinStatus(b.id)
  ])

  const csvContent = "data:text/csv;charset=utf-8," 
    + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
  
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement("a")
  link.setAttribute("href", encodedUri)
  link.setAttribute("download", `laporan_pendakian_${selectedRangeFilter.value}.csv`)
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

    <!-- Filters Bar -->
    <div class="filters-bar card-tngm no-print margin-top-2">
      <div class="grid-3" style="padding: 1.5rem;">
        <!-- Range Filter -->
        <div class="form-group margin-bottom-none">
          <label class="form-label" style="font-weight: 600; color: var(--text-main);">Periode Tanggal Naik</label>
          <select v-model="selectedRangeFilter" class="form-control">
            <option value="all">Semua Periode</option>
            <option value="today">Hari Ini</option>
            <option value="week">1 Minggu Terakhir</option>
            <option value="month">1 Bulan Terakhir</option>
          </select>
        </div>

        <!-- Path Filter -->
        <div class="form-group margin-bottom-none">
          <label class="form-label" style="font-weight: 600; color: var(--text-main);">Saring Jalur</label>
          <select v-model="selectedJalurFilter" class="form-control">
            <option value="all">Semua Jalur</option>
            <option v-for="j in db.jalur" :key="j.id" :value="j.id">{{ j.nama_jalur }}</option>
          </select>
        </div>

        <!-- Status Filter -->
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

    <!-- Printable Header (only shown during printing) -->
    <div class="print-only print-header text-center">
      <h2>LAPORAN REKAPITULASI PENGUNJUNG BASECAMP</h2>
      <h3>SISTEM RESERVASI GUNUNG SLAMET</h3>
      <p>Saringan Filter Jalur: {{ selectedJalurFilter === 'all' ? 'Semua Jalur' : getJalurName(selectedJalurFilter) }} | Status: {{ selectedStatusFilter }}</p>
      <div class="divider"></div>
    </div>

    <!-- Summary Metrics Card -->
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

    <!-- Reports Table list -->
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

/* Summary Box */
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

/* Controls header table */
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

/* Print CSS */
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
