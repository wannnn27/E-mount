<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTenant } from '../../composables/useTenant'
// Mengimpor client Supabase terpusat Anda
import { supabase } from '../../lib/supabase'

const router = useRouter()
const { mountainId } = useTenant()

// State internal penampung raw data reaktif langsung dari database Supabase
const rawBookings = ref<any[]>([])
const rawTrails = ref<any[]>([])
let dashboardSubscription: any = null

// Mendapatkan string tanggal hari ini (YYYY-MM-DD) untuk filter jadwal keberangkatan
const todayStr = new Date().toISOString().split('T')[0]

// 1. Memuat Seluruh Data Transaksi & Jalur yang Teralokasi untuk Gunung/Tenant Aktif (PRD Bab 3.1)
const fetchDashboardData = async () => {
  if (!mountainId.value) return
  
  try {
    // A. Fetch seluruh data jalur pendakian milik tenant ini
    const { data: trailsData, error: trailsErr } = await supabase
      .from('trails')
      .select('*')
      .eq('mountain_id', mountainId.value)
      
    if (trailsErr) throw trailsErr
    rawTrails.value = trailsData || []

    // B. Fetch data booking beserta relasi pembayaran, manifest anggota, dan nama jalur
    const { data: bookingsData, error: bookingsErr } = await supabase
      .from('bookings')
      .select(`
        *,
        payments (*),
        booking_members (id),
        trails (name)
      `)
      .eq('mountain_id', mountainId.value)

    if (bookingsErr) throw bookingsErr
    rawBookings.value = bookingsData || []
  } catch (error) {
    console.error('Gagal memuat metrik dashboard admin:', error)
  }
}

// 2. Setup Supabase Realtime Channel untuk Live Update Data Statistik Petugas (PRD Bab 4.1)
const setupRealtimeSync = () => {
  dashboardSubscription = supabase
    .channel('realtime-admin-dashboard')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
      fetchDashboardData()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
      fetchDashboardData()
    })
    .subscribe()
}

// Memicu fetch ulang secara otomatis apabila domain tenant/gunung berpindah
watch(() => mountainId.value, (newId) => {
  if (newId) fetchDashboardData()
}, { immediate: true })

onMounted(() => {
  setupRealtimeSync()
})

onUnmounted(() => {
  // Memutuskan koneksi realtime channel saat meninggalkan halaman demi optimalisasi bandwidth
  if (dashboardSubscription) {
    supabase.removeChannel(dashboardSubscription)
  }
})

// 3. Rekonsiliasi Perhitungan Agregasi Menggunakan Computed Properties Berbasis Real DB
const pendingPayments = computed(() => {
  // Menghitung jumlah booking berstatus menanti verifikasi bukti pembayaran struk fisik (PRD Bab 6.3)
  return rawBookings.value.filter(b => b.status === 'PERMIT_REVIEW').length
})

const activeClimbersCount = computed(() => {
  // Agregasi jumlah pendaki riil di atas gunung (Sudah Check-in tapi Belum Turun/Check-out)
  const activeBookings = rawBookings.value.filter(b => b.status === 'CHECKED_IN')
  return activeBookings.reduce((acc, b) => acc + (b.booking_members ? b.booking_members.length : 0), 0)
})

const routesOpenCount = computed(() => {
  // Mengasumsikan status jalur aktif jika difficulty/status tidak diset 'Closed'
  return rawTrails.value.filter(j => j.difficulty !== 'Closed').length
})

const totalRevenue = computed(() => {
  // Akumulasi nominal dana dari seluruh transaksi pembayaran yang sudah diverifikasi sah (Lunas/Paid)
  const approvedBookings = rawBookings.value.filter(b => 
    ['PAID', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'].includes(b.status)
  )
  return approvedBookings.reduce((acc, b) => {
    const payAmount = b.payments?.[0]?.amount || 0
    return acc + payAmount
  }, 0)
})

// 4. Memfilter Jadwal Keberangkatan Rombongan Hari Ini yang Sudah Melunasi Administrasi
const todaysBookings = computed(() => {
  return rawBookings.value.filter(b => {
    return b.entry_date === todayStr && ['PAID', 'APPROVED', 'CHECKED_IN'].includes(b.status)
  }).map(b => ({
    id: b.id,
    nama_pemimpin: b.full_name || 'Ketua Rombongan',
    jalur_id: b.trail_id,
    jumlah_pendaki: b.booking_members ? b.booking_members.length : 0
  }))
})

// 5. Fungsi Pembantu Penyelaras Interpolasi String & Obyek Proxy untuk Template
const db = computed(() => ({
  jalur: rawTrails.value
}))

const getJalurName = (jalurId: string) => {
  const found = rawTrails.value.find(j => j.id === jalurId)
  return found ? found.name : 'Jalur Tidak Dikenal'
}

const getTicketStatus = (bookingId: string) => {
  const found = rawBookings.value.find(b => b.id === bookingId)
  if (!found) return 'Belum Terbit'
  
  // Transformasi balik status DB menjadi string visual yang dipahami class badge template
  if (found.status === 'CHECKED_IN') return 'Checked-in'
  if (found.status === 'CHECKED_OUT' || found.status === 'COMPLETED') return 'Checked-out'
  return 'Belum Check-in'
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

    <div class="quick-actions-bar card-tngm margin-top-1">
      <h4 class="bar-title">Menu Cepat Petugas:</h4>
      <div class="actions-flex">
        <button @click="navigateTo('admin-checkin')" class="btn btn-green"><i class="ph-bold ph-scan"></i> Check-in Scanner</button>
        <button @click="navigateTo('admin-kuota')" class="btn btn-outline" style="border-color: var(--primary-green); color: var(--primary-green);"><i class="ph-bold ph-calendar"></i> Atur Kuota Jalur</button>
        <button @click="navigateTo('admin-jalur')" class="btn btn-outline" style="border-color: var(--primary-green); color: var(--primary-green);"><i class="ph-bold ph-warning"></i> Buka/Tutup Jalur</button>
        <button @click="navigateTo('admin-laporan')" class="btn btn-outline" style="border-color: var(--primary-green); color: var(--primary-green);"><i class="ph-bold ph-chart-bar"></i> Rekap Laporan</button>
      </div>
    </div>

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
        <div class="empty-table-state text-center" v-else>
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