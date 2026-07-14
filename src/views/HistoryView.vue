<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDatabaseStore } from '../stores/database'

const db = useDatabaseStore()
const router = useRouter()

const user = computed(() => db.currentUser)

// Get bookings belonging to active climber, sorted by created_at desc
const myBookings = computed(() => {
  if (!user.value) return []
  return db.bookings
    .filter(b => b.user_id === user.value?.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
})

const getJalurName = (jalurId: string) => {
  return db.jalur.find(j => j.id === jalurId)?.nama_jalur || 'Jalur Tidak Dikenal'
}

const getPaymentAmount = (bookingId: string) => {
  const pay = db.pembayaran.find(p => p.booking_id === bookingId)
  return pay ? pay.jumlah : 0
}

const formatRupiah = (val: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val)
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'Menunggu Pembayaran': return 'badge-warning'
    case 'Menunggu Verifikasi': return 'badge-warning'
    case 'Lunas': return 'badge-success'
    case 'Dibatalkan': return 'badge-danger'
    default: return 'badge-success'
  }
}

const navigateToPayment = (bookingId: string) => {
  router.push({ name: 'payment', params: { bookingId } })
}

const navigateToTicket = (bookingId: string) => {
  router.push({ name: 'tiket', params: { bookingId } })
}

const handleCancel = (bookingId: string) => {
  if (confirm('Apakah Anda yakin ingin membatalkan booking pendakian ini? Kuota akan dibebaskan kembali.')) {
    db.cancelBooking(bookingId)
  }
}
</script>

<template>
  <div class="history-page animate-fade-in">
    <!-- Page Header -->
    <div class="page-header">
      <h2>DASHBOARD PENDAKI</h2>
      <p>Beranda > Riwayat Booking</p>
    </div>

    <div class="container" style="max-width: 1000px; padding: 4rem 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h3 style="font-size: 1.5rem; font-weight: 600; color: var(--text-main);">Riwayat Transaksi & Tiket</h3>
        <RouterLink to="/" class="btn btn-green"><i class="ph-bold ph-plus"></i> Booking Baru</RouterLink>
      </div>

      <!-- Empty State -->
      <div v-if="myBookings.length === 0" class="card-tngm text-center" style="padding: 4rem 2rem;">
        <i class="ph-fill ph-ticket" style="font-size: 4rem; color: var(--border-light); margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">Belum Ada Transaksi</h3>
        <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Anda belum pernah melakukan booking pendakian.</p>
      </div>

      <!-- List of Bookings -->
      <div v-else class="grid">
        <div v-for="b in myBookings" :key="b.id" class="card-tngm list-card">
          <div class="list-card-header">
            <div>
              <div class="booking-id">KODE BOOKING: <strong>{{ b.id }}</strong></div>
              <div class="booking-date">Dibuat pada {{ new Date(b.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) }}</div>
            </div>
            <span class="badge" :class="getStatusBadgeClass(b.status_booking)">
              {{ b.status_booking }}
            </span>
          </div>

          <div class="list-card-body">
            <div class="details">
              <h4 class="route-name">{{ getJalurName(b.jalur_id) }}</h4>
              <div class="specs grid grid-3">
                <div class="spec-item">
                  <i class="ph-fill ph-calendar-blank"></i>
                  <div>
                    <span class="spec-label">Tanggal Naik</span>
                    <span class="spec-value">{{ b.tanggal_naik }}</span>
                  </div>
                </div>
                <div class="spec-item">
                  <i class="ph-fill ph-users"></i>
                  <div>
                    <span class="spec-label">Rombongan</span>
                    <span class="spec-value">{{ b.jumlah_pendaki }} Orang</span>
                  </div>
                </div>
                <div class="spec-item">
                  <i class="ph-fill ph-money"></i>
                  <div>
                    <span class="spec-label">Total Biaya</span>
                    <span class="spec-value" style="color: var(--primary-green);">{{ formatRupiah(getPaymentAmount(b.id)) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions column based on status -->
            <div class="actions">
              <template v-if="b.status_booking === 'Menunggu Pembayaran'">
                <button @click="navigateToPayment(b.id)" class="btn btn-green btn-block">Bayar Sekarang</button>
                <button @click="handleCancel(b.id)" class="btn btn-outline btn-block" style="border-color: #c5221f; color: #c5221f; margin-top: 0.5rem;">Batalkan</button>
              </template>

              <template v-else-if="b.status_booking === 'Menunggu Verifikasi'">
                <div class="notice-box">Sedang diverifikasi petugas.</div>
              </template>

              <template v-else-if="b.status_booking === 'Lunas'">
                <button @click="navigateToTicket(b.id)" class="btn btn-green btn-block">Lihat E-Tiket</button>
              </template>

              <template v-else-if="b.status_booking === 'Dibatalkan'">
                <div class="notice-box" style="background: #fce8e6; color: #c5221f;">Booking Dibatalkan</div>
              </template>
            </div>
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
  font-size: 2.5rem;
  font-weight: 400;
  margin-bottom: 0.5rem;
}
.page-header p {
  font-size: 1rem;
}

.list-card {
  display: block; /* Override flex-col from card-tngm */
}

.list-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
  background-color: var(--bg-light);
}

.booking-id {
  font-size: 0.85rem;
  color: var(--text-muted);
}
.booking-id strong {
  color: var(--primary-green);
}

.booking-date {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.15rem;
}

.list-card-body {
  padding: 1.5rem;
  display: grid;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .list-card-body {
    grid-template-columns: 3fr 1fr;
    align-items: center;
  }
}

.route-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 1rem;
}

.spec-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.spec-item i {
  font-size: 1.25rem;
  color: var(--border-light);
  margin-top: 0.1rem;
}

.spec-label {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
}

.spec-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-main);
}

.actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.btn-block {
  width: 100%;
}

.notice-box {
  font-size: 0.85rem;
  color: var(--text-muted);
  background: var(--bg-light);
  border: 1px solid var(--border-light);
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  text-align: center;
  font-weight: 600;
}
</style>
