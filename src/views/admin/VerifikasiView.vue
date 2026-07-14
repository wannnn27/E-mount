<script setup lang="ts">
import { computed } from 'vue'
import { useDatabaseStore } from '../../stores/database'

const db = useDatabaseStore()

// Filter bookings waiting verification
const pendingBookings = computed(() => {
  return db.bookings.filter(b => b.status_booking === 'Menunggu Verifikasi')
})

const getJalurName = (jalurId: string) => {
  return db.jalur.find(j => j.id === jalurId)?.nama_jalur || 'Unknown'
}

const getPaymentObj = (bookingId: string) => {
  return db.pembayaran.find(p => p.booking_id === bookingId)
}

const formatRupiah = (val: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val)
}

const handleVerify = (bookingId: string, approve: boolean) => {
  const confirmMsg = approve 
    ? 'Apakah Anda yakin ingin MENYETUJUI pembayaran ini? E-tiket akan otomatis diterbitkan.' 
    : 'Apakah Anda yakin ingin MENOLAK pembayaran ini? Booking akan dibatalkan.'

  if (confirm(confirmMsg)) {
    db.verifikasiPembayaran(bookingId, approve)
  }
}
</script>

<template>
  <div class="verifikasi-admin-page container animate-fade-in">
    <div class="header-section">
      <h2 style="font-size: 2rem; font-weight: 700; color: var(--text-main);">Verifikasi Pembayaran Manual</h2>
      <p class="subtitle">Tinjau bukti transfer bank manual pendaki dan berikan konfirmasi untuk penerbitan E-Tiket.</p>
    </div>

    <!-- Empty State -->
    <div v-if="pendingBookings.length === 0" class="card-tngm empty-state margin-top-2 text-center">
      <span class="empty-icon">☕</span>
      <h3>Semua Bersih!</h3>
      <p class="margin-top-1 text-secondary">Tidak ada antrean pembayaran yang menunggu verifikasi saat ini.</p>
    </div>

    <!-- Queue List -->
    <div v-else class="queue-list margin-top-2">
      <div v-for="b in pendingBookings" :key="b.id" class="card-tngm verify-item-card margin-bottom-1">
        <div class="grid-2 align-center">
          <!-- Left info: details of booking -->
          <div style="padding: 1.5rem;">
            <div class="item-header">
              <span class="booking-id">ID Booking: <code>{{ b.id }}</code></span>
              <span class="badge badge-info">MENUNGGU VERIFIKASI</span>
            </div>
            
            <h4 class="route-name margin-top-sm">{{ getJalurName(b.jalur_id) }}</h4>
            
            <div class="details-specs margin-top-1">
              <div class="spec-row">
                <span class="label">Nama Pemimpin:</span>
                <span class="value">{{ b.nama_pemimpin }}</span>
              </div>
              <div class="spec-row">
                <span class="label">Jumlah Rombongan:</span>
                <span class="value">👥 {{ b.jumlah_pendaki }} Orang</span>
              </div>
              <div class="spec-row">
                <span class="label">Tanggal Naik:</span>
                <span class="value">📅 {{ b.tanggal_naik }}</span>
              </div>
              <div class="spec-row">
                <span class="label">Total Tagihan:</span>
                <strong class="value text-primary">{{ formatRupiah(getPaymentObj(b.id)?.jumlah || 0) }}</strong>
              </div>
            </div>
          </div>

          <!-- Right info: payment proof slip mockup & actions -->
          <div class="proof-actions-wrapper">
            <h5 class="proof-title">Mockup Foto Bukti Transfer</h5>
            <div class="slip-mock-display">
              <!-- Visual Mock Slip Design -->
              <div class="slip-card">
                <div class="slip-card-header">BANK TRANSFER SUCCESS</div>
                <div class="slip-card-body">
                  <div class="slip-row"><span>KE:</span> <strong>BASECAMP SLAMET</strong></div>
                  <div class="slip-row"><span>DARI:</span> <span>{{ b.nama_pemimpin }}</span></div>
                  <div class="slip-row"><span>JUMLAH:</span> <strong class="text-green">{{ formatRupiah(getPaymentObj(b.id)?.jumlah || 0) }}</strong></div>
                  <div class="slip-row"><span>STATUS:</span> <span class="slip-success-tag">SUCCESS</span></div>
                </div>
              </div>
            </div>

            <!-- Buttons -->
            <div class="action-buttons-group margin-top-1">
              <button @click="handleVerify(b.id, true)" class="btn btn-green btn-sm btn-action"><i class="ph-bold ph-check"></i> Setujui</button>
              <button @click="handleVerify(b.id, false)" class="btn btn-outline btn-sm btn-action" style="border-color: #c5221f; color: #c5221f;"><i class="ph-bold ph-x"></i> Tolak</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.verifikasi-admin-page {
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
  margin-top: 1.5rem;
}

.margin-top-sm {
  margin-top: 0.5rem;
}

.margin-bottom-1 {
  margin-bottom: 1.5rem;
}

.text-center {
  text-align: center;
}

.text-secondary {
  color: var(--text-muted);
}

.align-center {
  align-items: center;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr;
}

@media (min-width: 900px) {
  .grid-2 {
    grid-template-columns: 1fr 1fr;
  }
}

/* Empty state design */
.empty-state {
  padding: 4rem 2rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.empty-icon {
  font-size: 4rem;
  display: block;
  margin-bottom: 1.5rem;
}

/* Verify item card design */
.verify-item-card {
  overflow: hidden;
  border-left: 6px solid var(--accent-orange);
}

.item-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.booking-id {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.booking-id code {
  color: var(--text-main);
  font-weight: 700;
}

.route-name {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--text-main);
  margin-top: 0.75rem;
}

.details-specs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.spec-row {
  display: flex;
  font-size: 0.95rem;
}

.spec-row .label {
  width: 160px;
  color: var(--text-muted);
  font-weight: 600;
}

.spec-row .value {
  color: var(--text-main);
  font-weight: 700;
}

.text-primary {
  color: var(--primary-green) !important;
  font-size: 1.1rem;
}

/* Mock slip visualization card */
.proof-actions-wrapper {
  background-color: var(--bg-light);
  padding: 2rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-left: 1px solid var(--border-light);
}

.proof-title {
  font-size: 0.9rem;
  color: var(--text-main);
  font-weight: 700;
  margin-bottom: 1rem;
  text-transform: uppercase;
  text-align: center;
}

.slip-mock-display {
  display: flex;
  justify-content: center;
}

.slip-card {
  background: #fff;
  border-left: 5px solid var(--primary-green);
  color: var(--text-main);
  padding: 1.25rem;
  border-radius: var(--radius-sm);
  width: 100%;
  max-width: 320px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.05);
  font-family: monospace;
  font-size: 0.85rem;
}

.slip-card-header {
  font-weight: 800;
  text-align: center;
  border-bottom: 1px dashed var(--border-light);
  padding-bottom: 0.75rem;
  margin-bottom: 0.75rem;
  color: var(--text-main);
}

.slip-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.slip-row {
  display: flex;
  justify-content: space-between;
}

.slip-row span {
  color: var(--text-muted);
}

.slip-row strong {
  color: var(--text-main);
}

.text-green {
  color: var(--primary-green) !important;
  font-weight: 800 !important;
}

.slip-success-tag {
  background-color: #e6f4ea;
  color: var(--primary-green);
  font-weight: 800;
  padding: 0.1rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
}

/* Buttons group */
.action-buttons-group {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.btn-action {
  flex: 1;
  font-size: 0.95rem;
  padding: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
</style>
