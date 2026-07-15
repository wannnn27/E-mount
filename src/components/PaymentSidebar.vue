<!--
  PaymentSidebar.vue
  Sticky sidebar ringkasan pembayaran pada halaman booking/payment.
  Mengikuti scroll dengan CSS position:sticky.
-->
<script setup lang="ts">
defineProps<{
  trailName: string
  date: string
  headcount: number
  pricePerPerson: number
  status?: string
  bookingId?: string
}>()

function formatRp(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(n)
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}
</script>

<template>
  <aside class="payment-sidebar sticky-sidebar" aria-label="Ringkasan Pembayaran">

    <!-- Header -->
    <div class="sidebar-header">
      <i class="ph-fill ph-receipt"></i>
      <h3>Ringkasan Pembayaran</h3>
    </div>

    <!-- Mountain/Trail info -->
    <div class="sidebar-trail-info">
      <div class="trail-badge">
        <i class="ph-fill ph-mountains"></i>
        <span>{{ trailName }}</span>
      </div>
      <div class="trail-date" v-if="date">
        <i class="ph-fill ph-calendar"></i>
        <span>{{ formatDate(date) }}</span>
      </div>
    </div>

    <div class="sidebar-divider"></div>

    <!-- Price rows -->
    <div class="sidebar-price-rows">
      <div class="price-row">
        <span class="price-label">Tiket Masuk</span>
        <span class="price-value">{{ formatRp(pricePerPerson) }}</span>
      </div>
      <div class="price-row">
        <span class="price-label">Jumlah Pendaki</span>
        <span class="price-value">× {{ headcount }}</span>
      </div>
      <div class="price-row">
        <span class="price-label">Retribusi Kawasan</span>
        <span class="price-value price-included">Termasuk</span>
      </div>
    </div>

    <div class="sidebar-divider"></div>

    <!-- Total -->
    <div class="sidebar-total">
      <span class="total-label">Total Pembayaran</span>
      <span class="total-value">{{ formatRp(headcount * pricePerPerson) }}</span>
    </div>

    <!-- Booking ID (if available) -->
    <div v-if="bookingId" class="sidebar-booking-id">
      <span class="booking-id-label">ID Booking</span>
      <code class="booking-id-value">{{ bookingId }}</code>
    </div>

    <!-- Status chip -->
    <div v-if="status" class="sidebar-status">
      <div class="status-dot"></div>
      <span>{{ status }}</span>
    </div>

    <!-- Info note -->
    <div class="sidebar-note">
      <i class="ph-fill ph-info"></i>
      <span>Pembayaran diverifikasi dalam 1×24 jam setelah transfer dilakukan.</span>
    </div>
  </aside>
</template>

<style scoped>
.payment-sidebar {
  background: #fff;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
  overflow: hidden;
}

.sidebar-header {
  background: linear-gradient(135deg, var(--primary-green) 0%, #0d5224 100%);
  color: #fff;
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.sidebar-header i { font-size: 1.5rem; }
.sidebar-header h3 {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
}

.sidebar-trail-info {
  padding: 1.25rem 1.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.trail-badge, .trail-date {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-main);
}
.trail-badge i { color: var(--primary-green); font-size: 1.1rem; }
.trail-date i { color: var(--text-muted); font-size: 1rem; }
.trail-badge span { font-weight: 700; }
.trail-date span { color: var(--text-muted); }

.sidebar-divider {
  height: 1px;
  background: var(--border-light);
  margin: 0.75rem 1.5rem;
}

.sidebar-price-rows {
  padding: 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}
.price-label { color: var(--text-muted); }
.price-value { font-weight: 600; color: var(--text-main); }
.price-included { color: var(--primary-green); font-size: 0.8rem; }

.sidebar-total {
  margin: 0.75rem 1.5rem;
  padding: 1rem 1.25rem;
  background: var(--bg-light);
  border-radius: var(--radius-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid var(--border-light);
}
.total-label { font-size: 0.85rem; font-weight: 600; color: var(--text-main); }
.total-value {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--primary-green);
}

.sidebar-booking-id {
  margin: 0 1.5rem 0.75rem;
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.booking-id-label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; }
.booking-id-value { font-family: 'Geist Mono', monospace; font-size: 0.8rem; color: var(--text-main); word-break: break-all; }

.sidebar-status {
  margin: 0 1.5rem 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-main);
}
.status-dot {
  width: 8px; height: 8px;
  background: var(--accent-orange);
  border-radius: 50%;
  animation: pulse-dot 1.5s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.4); opacity: 0.6; }
}

.sidebar-note {
  margin: 0 1.5rem 1.5rem;
  padding: 0.75rem 1rem;
  background: #fff8e8;
  border: 1px solid #f6c358;
  border-radius: var(--radius-sm);
  display: flex;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: #7a5100;
  line-height: 1.4;
}
.sidebar-note i { flex-shrink: 0; font-size: 1rem; margin-top: 0.1rem; }
</style>
