<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDatabaseStore } from '../stores/database'

const route = useRoute()
const router = useRouter()
const db = useDatabaseStore()

const bookingId = route.params.bookingId as string
const booking = computed(() => db.bookings.find(b => b.id === bookingId))
const tiket = computed(() => db.tiket.find(t => t.booking_id === bookingId))
const jalur = computed(() => db.jalur.find(j => j.id === booking.value?.jalur_id))

const qrCodeUrl = computed(() => {
  if (!tiket.value) return ''
  // Use a public QR code generation API, color green: 137333
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=137333&bgcolor=ffffff&data=${tiket.value.kode_qr}`
})

const handlePrint = () => {
  window.print()
}

const navigateToHistory = () => {
  router.push({ name: 'riwayat' })
}
</script>

<template>
  <div class="ticket-page container animate-fade-in" v-if="booking && tiket">
    <div class="breadcrumb no-print">
      <button @click="navigateToHistory" class="back-btn"><i class="ph-bold ph-arrow-left"></i> Kembali ke Riwayat Booking</button>
    </div>

    <div class="ticket-wrapper">
      <!-- Printable pass card -->
      <div class="card-tngm ticket-card">
        
        <!-- Ticket Top branding -->
        <div class="ticket-header">
          <div class="brand">
            <i class="ph-fill ph-mountains brand-icon"></i>
            <div>
              <h3>E-TIKET PENDAKIAN</h3>
              <p>TAMAN NASIONAL GUNUNG SLAMET</p>
            </div>
          </div>
          <div class="ticket-badge-status">
            <span v-if="tiket.status_checkin === 'Belum Check-in'" class="badge badge-info">BELUM CHECK-IN</span>
            <span v-else-if="tiket.status_checkin === 'Checked-in'" class="badge badge-success">SUDAH CHECK-IN</span>
            <span v-else class="badge badge-danger">CHECKED OUT</span>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Ticket Body grid -->
        <div class="ticket-body">
          <!-- Left side: text details -->
          <div class="ticket-details">
            <div class="grid-2">
              <div class="data-group">
                <span class="label">Jalur Pendakian</span>
                <span class="value text-green font-bold">{{ jalur?.nama_jalur }}</span>
              </div>
              <div class="data-group">
                <span class="label">Tanggal Pendakian</span>
                <span class="value">{{ booking.tanggal_naik }}</span>
              </div>
            </div>

            <div class="grid-2 margin-top-1">
              <div class="data-group">
                <span class="label">Ketua Kelompok</span>
                <span class="value">{{ booking.nama_pemimpin }}</span>
              </div>
              <div class="data-group">
                <span class="label">NIK Ketua</span>
                <span class="value">{{ booking.nik_pemimpin }}</span>
              </div>
            </div>

            <div class="grid-2 margin-top-1">
              <div class="data-group">
                <span class="label">Total Rombongan</span>
                <span class="value">{{ booking.jumlah_pendaki }} Orang</span>
              </div>
              <div class="data-group">
                <span class="label">Nomor Kontak Ketua</span>
                <span class="value">{{ booking.no_hp_pemimpin }}</span>
              </div>
            </div>

            <!-- Members list -->
            <div class="members-list-box margin-top-1" v-if="booking.anggota.length > 0">
              <span class="label">Daftar Anggota Kelompok</span>
              <ul class="members-ul">
                <li v-for="(name, index) in booking.anggota" :key="index">
                  {{ index + 1 }}. {{ name }}
                </li>
              </ul>
            </div>
          </div>

          <!-- Right side: QR Code display -->
          <div class="ticket-qr-section">
            <div class="qr-container">
              <img :src="qrCodeUrl" alt="QR Code E-Tiket" class="qr-image" />
            </div>
            <div class="qr-code-text">
              <code>{{ tiket.kode_qr }}</code>
            </div>
            <p class="qr-notice">Tunjukkan QR code ini ke petugas di loket pintu masuk basecamp untuk check-in / check-out.</p>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Ticket Footer rules guidelines -->
        <div class="ticket-footer">
          <div class="footer-note">
            <h5>Ketentuan & Peraturan Penggunaan Tiket</h5>
            <ul>
              <li>E-Tiket ini sah apabila status pembayaran telah diverifikasi dan ketua kelompok membawa KTP/Identitas fisik asli yang sesuai.</li>
              <li>Dilarang keras membawa tisu basah, botol plastik sekali pakai, dan benda tajam terlarang.</li>
              <li>Sampah pendakian wajib dibawa turun kembali dan akan dicek pada saat Check-out.</li>
              <li>Waspadai perubahan cuaca mendadak dan segera ikuti arahan ranger basecamp.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="ticket-actions no-print margin-top-2">
        <button @click="handlePrint" class="btn btn-green"><i class="ph-bold ph-printer"></i> Cetak / Simpan PDF</button>
        <button @click="navigateToHistory" class="btn btn-outline" style="border-color: var(--primary-green); color: var(--primary-green);">Kembali ke Riwayat</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ticket-page {
  padding-top: 3rem;
  padding-bottom: 4rem;
}

.breadcrumb {
  margin-bottom: 1.5rem;
}

.back-btn {
  background: transparent;
  border: none;
  color: var(--primary-green);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.back-btn:hover {
  text-decoration: underline;
}

.ticket-wrapper {
  max-width: 900px;
  margin: 0 auto;
}

.ticket-card {
  padding: 3rem;
  background: #fff;
  border-top: 8px solid var(--primary-green);
  box-shadow: 0 10px 30px rgba(0,0,0,0.08);
}

.ticket-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.brand-icon {
  font-size: 2.5rem;
  color: var(--primary-green);
}

.brand h3 {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-main);
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.brand p {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 600;
}

.divider {
  height: 2px;
  background-color: var(--border-light);
  margin: 2rem 0;
  border-style: dashed;
}

/* Body layout */
.ticket-body {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
}

@media (min-width: 768px) {
  .ticket-body {
    grid-template-columns: 1.8fr 1fr;
  }
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.data-group {
  display: flex;
  flex-direction: column;
}

.label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  margin-bottom: 0.35rem;
}

.value {
  font-size: 1.05rem;
  color: var(--text-main);
  font-weight: 600;
}

.text-green {
  color: var(--primary-green);
}

.font-bold {
  font-weight: 800;
}

.margin-top-1 {
  margin-top: 1.5rem;
}

.members-list-box {
  background: var(--bg-light);
  border: 1px solid var(--border-light);
  padding: 1.5rem;
  border-radius: var(--radius-md);
}

.members-ul {
  list-style: none;
  margin-top: 0.75rem;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.members-ul li {
  font-size: 0.9rem;
  color: var(--text-main);
  font-weight: 500;
}

/* QR code column */
.ticket-qr-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: #f0fdf4;
  padding: 2rem 1.5rem;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(19, 115, 51, 0.15);
}

.qr-container {
  background: #fff;
  padding: 1rem;
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-image {
  width: 180px;
  height: 180px;
  display: block;
}

.qr-code-text {
  margin-top: 1rem;
  font-size: 1.25rem;
  letter-spacing: 0.1em;
  color: var(--text-main);
  font-weight: 800;
}

.qr-notice {
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin-top: 1rem;
}

/* Footer layout */
.footer-note h5 {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-main);
  margin-bottom: 0.75rem;
}

.footer-note ul {
  padding-left: 1.25rem;
}

.footer-note li {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.ticket-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.margin-top-2 {
  margin-top: 2rem;
}

/* Print CSS overrides */
@media print {
  body {
    background: white !important;
    color: black !important;
  }
  .no-print {
    display: none !important;
  }
  .ticket-card {
    border: 2px solid #000 !important;
    border-top: 8px solid #137333 !important;
    box-shadow: none !important;
    padding: 2rem !important;
  }
  .ticket-wrapper {
    max-width: 100% !important;
  }
  .ticket-qr-section {
    background: transparent !important;
    border: 1px solid #000 !important;
  }
  .members-list-box {
    background: transparent !important;
    border: 1px solid #000 !important;
  }
}
</style>
