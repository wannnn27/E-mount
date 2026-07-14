<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDatabaseStore } from '../../stores/database'

const db = useDatabaseStore()
const router = useRouter()

// Date logic
const todayStr = new Date().toISOString().split('T')[0]

// Calculations
const pendingPayments = computed(() => {
  return db.bookings.filter(b => b.status_booking === 'Menunggu Verifikasi').length
})

const activeClimbersCount = computed(() => {
  // Count checked-in but not checked-out climbers
  const activeTickets = db.tiket.filter(t => t.status_checkin === 'Checked-in')
  return activeTickets.reduce((acc, t) => {
    const booking = db.bookings.find(b => b.id === t.booking_id)
    return acc + (booking ? booking.jumlah_pendaki : 0)
  }, 0)
})

const routesOpenCount = computed(() => {
  return db.jalur.filter(j => j.status_jalur === 'Buka' || j.status_jalur === 'Waspada').length
})

const totalRevenue = computed(() => {
  // Sum of payments for approved bookings
  const approvedPays = db.pembayaran.filter(p => p.status_verifikasi === 'Disetujui')
  return approvedPays.reduce((acc, p) => acc + p.jumlah, 0)
})

// Today's climber list
const todaysBookings = computed(() => {
  return db.bookings.filter(b => b.tanggal_naik === todayStr && b.status_booking === 'Lunas')
})

const getJalurName = (jalurId: string) => {
  return db.jalur.find(j => j.id === jalurId)?.nama_jalur || 'Unknown'
}

const getTicketStatus = (bookingId: string) => {
  const tix = db.tiket.find(t => t.booking_id === bookingId)
  return tix ? tix.status_checkin : 'Belum Terbit'
}

const formatRupiah = (val: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val)
}

const navigateTo = (routeName: string) => {
  router.push({ name: routeName })
}
</script>

<template>
  <div class="admin-dashboard container animate-fade-in">
    <div class="header-section">
      <h2 style="font-size: 2rem; font-weight: 700; color: var(--text-main);">Panel Administrasi Basecamp</h2>
      <p class="subtitle">Kelola dan pantau seluruh operasional basecamp, kuota jalur, verifikasi transaksi, serta scan check-in pendaki secara real-time.</p>
    </div>

    <!-- Stats Grid -->
    <div class="grid-4 margin-top-2">
      <div class="card-tngm stat-card" @click="navigateTo('admin-verifikasi')">
        <div class="icon-wrapper bg-orange"><i class="ph-bold ph-hourglass-high"></i></div>
        <div>
          <h3 class="number" style="color: var(--accent-orange);">{{ pendingPayments }}</h3>
          <p class="label">Persetujuan Bayar</p>
        </div>
      </div>
      
      <div class="card-tngm stat-card">
        <div class="icon-wrapper bg-green"><i class="ph-bold ph-users-three"></i></div>
        <div>
          <h3 class="number" style="color: var(--primary-green);">{{ activeClimbersCount }}</h3>
          <p class="label">Pendaki di Jalur</p>
        </div>
      </div>

      <div class="card-tngm stat-card" @click="navigateTo('admin-jalur')">
        <div class="icon-wrapper bg-blue"><i class="ph-bold ph-mountains"></i></div>
        <div>
          <h3 class="number" style="color: #093796;">{{ routesOpenCount }} / {{ db.jalur.length }}</h3>
          <p class="label">Jalur Aktif</p>
        </div>
      </div>

      <div class="card-tngm stat-card">
        <div class="icon-wrapper bg-emerald"><i class="ph-bold ph-money"></i></div>
        <div>
          <h3 class="number" style="color: #059669;">{{ formatRupiah(totalRevenue) }}</h3>
          <p class="label">Total Pendapatan</p>
        </div>
      </div>
    </div>

    <!-- Quick action links -->
    <div class="quick-actions-bar card-tngm margin-top-1">
      <h4 class="bar-title">Menu Cepat Petugas:</h4>
      <div class="actions-flex">
        <button @click="navigateTo('admin-checkin')" class="btn btn-green"><i class="ph-bold ph-scan"></i> Check-in Scanner</button>
        <button @click="navigateTo('admin-kuota')" class="btn btn-outline" style="border-color: var(--primary-green); color: var(--primary-green);"><i class="ph-bold ph-calendar"></i> Atur Kuota Jalur</button>
        <button @click="navigateTo('admin-jalur')" class="btn btn-outline" style="border-color: var(--primary-green); color: var(--primary-green);"><i class="ph-bold ph-warning"></i> Buka/Tutup Jalur</button>
        <button @click="navigateTo('admin-laporan')" class="btn btn-outline" style="border-color: var(--primary-green); color: var(--primary-green);"><i class="ph-bold ph-chart-bar"></i> Rekap Laporan</button>
      </div>
    </div>

    <!-- Today's Schedule Table -->
    <div class="card-tngm margin-top-2">
      <div class="table-header">
        <h3 class="card-title">Jadwal Keberangkatan Hari Ini ({{ todayStr }})</h3>
        <span class="badge badge-success">{{ todaysBookings.length }} Rombongan Lunas</span>
      </div>
      <div class="divider"></div>

      <div class="table-container table-responsive" style="padding: 1rem 1.5rem;">
        <table class="custom-table" v-if="todaysBookings.length > 0">
          <thead>
            <tr>
              <th>ID Booking</th>
              <th>Ketua Rombongan</th>
              <th>Jalur</th>
              <th>Jumlah Pendaki</th>
              <th>Status Tiket</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in todaysBookings" :key="b.id">
              <td><code>{{ b.id }}</code></td>
              <td><strong>{{ b.nama_pemimpin }}</strong></td>
              <td>{{ getJalurName(b.jalur_id) }}</td>
              <td>👥 {{ b.jumlah_pendaki }} Orang</td>
              <td>
                <span class="badge" :class="{
                  'badge-info': getTicketStatus(b.id) === 'Belum Check-in',
                  'badge-success': getTicketStatus(b.id) === 'Checked-in',
                  'badge-danger': getTicketStatus(b.id) === 'Checked-out'
                }">
                  {{ getTicketStatus(b.id) }}
                </span>
              </td>
              <td>
                <button 
                  @click="navigateTo('admin-checkin')" 
                  class="btn btn-outline btn-sm"
                  style="border-color: var(--primary-green); color: var(--primary-green);"
                  :disabled="getTicketStatus(b.id) === 'Checked-out'">
                  Kelola Check-in
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-table-state text-center">
          <p>Tidak ada keberangkatan rombongan lunas yang dijadwalkan naik hari ini.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-dashboard {
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
  margin: 0;
}

.text-center {
  text-align: center;
}

/* Grid 4 helper */
.grid-4 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 576px) {
  .grid-4 {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 992px) {
  .grid-4 {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* Stat card clickable style */
.stat-card {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.5rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.08);
}

.icon-wrapper {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: var(--radius-md);
  font-size: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bg-orange { background-color: #fff4e5; color: var(--accent-orange); }
.bg-green { background-color: #e6f4ea; color: var(--primary-green); }
.bg-blue { background-color: #e8f0fe; color: #1a73e8; }
.bg-emerald { background-color: #d1fae5; color: #059669; }

.number {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-main);
  margin-bottom: 0.25rem;
}

.label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
}

/* Quick actions bar styling */
.quick-actions-bar {
  padding: 1.5rem;
}

.bar-title {
  font-size: 1rem;
  color: var(--text-main);
  font-weight: 700;
  margin-bottom: 1rem;
}

.actions-flex {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

/* Table header decoration */
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background-color: var(--bg-light);
  border-bottom: 1px solid var(--border-light);
}

.card-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-main);
}

.empty-table-state {
  padding: 3rem 0;
  color: var(--text-muted);
  font-size: 0.95rem;
}

.btn-sm {
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
}
</style>
