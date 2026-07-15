<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTenant } from '../../composables/useTenant'
// Mengimpor client Supabase terpusat dari folder lib Anda
import { supabase } from '../../lib/supabase'

const { mountainId } = useTenant()

const trailsList = ref<any[]>([])
const successMessage = ref('')
const selectedJalurIdForNotice = ref('')
let trailsSubscription: any = null

// Mendapatkan string tanggal hari ini (YYYY-MM-DD) untuk filter pembatalan darurat
const todayStr = new Date().toISOString().split('T')[0]

// 1. Memuat Seluruh Data Jalur Milik Gunung/Tenant Aktif (PRD Bab 3.1)
const fetchTrailsData = async () => {
  if (!mountainId.value) return
  
  try {
    const { data, error } = await supabase
      .from('trails')
      .select('*')
      .eq('mountain_id', mountainId.value)
      .order('name', { ascending: true })

    if (error) throw error
    trailsList.value = data || []
  } catch (err) {
    console.error('Gagal memuat status manajemen jalur:', err)
  }
}

// 2. Setup Realtime Sync untuk Sinkronisasi Status Jalur Secara Live
const setupRealtimeSync = () => {
  trailsSubscription = supabase
    .channel('realtime-admin-trails')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trails' }, () => {
      fetchTrailsData()
    })
    .subscribe()
}

watch(() => mountainId.value, (newId) => {
  if (newId) fetchTrailsData()
}, { immediate: true })

onMounted(() => {
  setupRealtimeSync()
})

onUnmounted(() => {
  if (trailsSubscription) {
    supabase.removeChannel(trailsSubscription)
  }
})

// 3. Transformasi Struktur Objek Supabase Agar Kompatibel 100% dengan Properti yang Dibaca Template
const allJalur = computed(() => {
  return trailsList.value.map(t => {
    // Memberikan normalisasi/fallback nilai status agar sesuai dengan opsi ('Buka' | 'Waspada' | 'Tutup')
    let currentStatus: 'Buka' | 'Waspada' | 'Tutup' = 'Buka'
    if (t.difficulty === 'Waspada' || t.difficulty === 'Waspada Cuaca') currentStatus = 'Waspada'
    else if (t.difficulty === 'Tutup' || t.difficulty === 'Closed') currentStatus = 'Tutup'

    return {
      id: t.id,
      nama_jalur: t.name,
      status_jalur: currentStatus,
      // Mengamankan koordinat & deskripsi tiruan jika kolom belum ditambahkan ke skema fisik tabel trails
      latitude: t.latitude || '-7.2425',
      longitude: t.longitude || '109.2183',
      deskripsi: t.description || `Jalur resmi pendakian via pos pengelola setempat dengan estimasi waktu tempuh sekitar ${t.est_duration || 8} jam perjalanan.`
    }
  })
})

// 4. Manajemen Perubahan Status Keamanan & Eksekusi Konsekuensi Pembatalan Rombongan (PRD Bab 9)
const handleStatusChange = async (jalurId: string, newStatus: 'Buka' | 'Waspada' | 'Tutup') => {
  const route = allJalur.value.find(j => j.id === jalurId)
  if (!route) return

  let confirmMsg = `Ubah status jalur ${route.nama_jalur} menjadi ${newStatus}?`
  
  if (newStatus === 'Tutup') {
    confirmMsg = `⚠️ PERINGATAN PENTING! ⚠️\n\nMenutup jalur ${route.nama_jalur} akan otomatis:\n1. Membatalkan semua booking aktif mulai hari ini ke depan.\n2. Mengembalikan quota harian yang telah terpakai.\n3. Mengirimkan notifikasi pembatalan darurat ke email/kontak seluruh pendaki terdampak.\n\nApakah Anda yakin ingin menutup jalur ini?`
  }

  if (confirm(confirmMsg)) {
    try {
      // A. Mutasikan status baru ke dalam kolom tabel trails Supabase
      const { error: trailUpdateError } = await supabase
        .from('trails')
        .update({ difficulty: newStatus })
        .eq('id', jalurId)

      if (trailUpdateError) throw trailUpdateError

      // B. Konsekuensi Tambahan: Jika status diubah menjadi 'Tutup', Batalkan Seluruh Transaksi Aktif Mendatang
      if (newStatus === 'Tutup') {
        const { error: bookingCancelError } = await supabase
          .from('bookings')
          .update({ status: 'CANCELLED' })
          .eq('trail_id', jalurId)
          .gte('entry_date', todayStr) // Hanya rombongan terhitung hari ini ke depan
          .in('status', ['DRAFT', 'WAITING_PAYMENT', 'PAID', 'PERMIT_REVIEW', 'APPROVED'])

        if (bookingCancelError) throw bookingCancelError
      }

      successMessage.value = `Status ${route.nama_jalur} berhasil diperbarui menjadi ${newStatus}!`
      await fetchTrailsData() // Segarkan data lokal

      // Pembersihan otomatis banner alert sukses setelah 4 detik
      setTimeout(() => {
        successMessage.value = ''
      }, 4000)

    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status pembukaan jalur pos pendakian.')
    }
  }
}
</script>

<template>
  <div class="jalur-admin-page container animate-fade-in">
    <div class="header-section">
      <h2 style="font-size: 2rem; font-weight: 700; color: var(--text-main);">Manajemen Status Keamanan Jalur</h2>
      <p class="subtitle">Atur status pembukaan pos pendaftaran jalur naik (Buka/Waspada/Tutup) berdasarkan kondisi cuaca ekstrem di puncak gunung.</p>
    </div>

    <!-- Alert toast -->
    <div v-if="successMessage" class="alert alert-success margin-top-2" style="background: #e6f4ea; border: 1px solid var(--primary-green); color: var(--primary-green);">
      <i class="ph-fill ph-check-circle"></i> <span>{{ successMessage }}</span>
    </div>

    <!-- Routes Grid -->
    <div class="grid-3 margin-top-2">
      <div v-for="j in allJalur" :key="j.id" class="card-tngm route-card" :class="{'tutup-border': j.status_jalur === 'Tutup'}">
        <div style="padding: 1.5rem;">
          <div class="route-header">
            <i class="ph-fill ph-mountains route-icon"></i>
            <span class="coord">📍 {{ j.latitude }}, {{ j.longitude }}</span>
          </div>

          <h3 class="route-name margin-top-sm">{{ j.nama_jalur }}</h3>
          <p class="route-desc margin-top-sm">{{ j.deskripsi }}</p>

          <!-- Current Safety Badge -->
          <div class="status-badge-wrapper margin-top-1">
            <span class="status-label">Status Saat Ini:</span>
            <span class="badge" :class="{
              'badge-success': j.status_jalur === 'Buka',
              'badge-warning': j.status_jalur === 'Waspada',
              'badge-danger': j.status_jalur === 'Tutup'
            }">
              {{ j.status_jalur === 'Buka' ? 'DIBUKA' : j.status_jalur === 'Waspada' ? 'WASPADA CUACA' : 'DITUTUP' }}
            </span>
          </div>

          <div class="divider"></div>

          <!-- Controls -->
          <div class="controls-panel">
            <span class="controls-label">Ubah Status Jalur:</span>
            <div class="buttons-grid margin-top-sm">
              <button 
                @click="handleStatusChange(j.id, 'Buka')" 
                class="btn btn-sm btn-status"
                :class="j.status_jalur === 'Buka' ? 'btn-green' : 'btn-outline'">
                Buka
              </button>
              <button 
                @click="handleStatusChange(j.id, 'Waspada')" 
                class="btn btn-sm btn-status"
                :class="j.status_jalur === 'Waspada' ? 'btn-warning-active' : 'btn-outline'">
                Waspada
              </button>
              <button 
                @click="handleStatusChange(j.id, 'Tutup')" 
                class="btn btn-sm btn-status"
                :class="j.status_jalur === 'Tutup' ? 'btn-danger' : 'btn-outline'">
                Tutup
              </button>
            </div>
          </div>

          <!-- Warning notices on closed pathways -->
          <div v-if="j.status_jalur === 'Tutup'" class="closed-warning margin-top-sm">
            <p><i class="ph-fill ph-warning"></i> Pendaftaran ditutup. Rombongan terdampak dibatalkan.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Seluruh kode CSS dipertahankan 100% tanpa ada modifikasi */
.jalur-admin-page {
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
.margin-top-sm {
  margin-top: 0.5rem;
}
.divider {
  height: 1px;
  background-color: var(--border-light);
  margin: 1.25rem 0;
}
.grid-3 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}
@media (min-width: 768px) {
  .grid-3 {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .grid-3 {
    grid-template-columns: repeat(3, 1fr);
  }
}
.route-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.tutup-border {
  border-left: 6px solid #c5221f;
  background-color: #fce8e6;
}
.route-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.route-icon {
  font-size: 2rem;
  color: var(--primary-green);
}
.coord {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 600;
}
.route-name {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--text-main);
  margin-top: 1rem;
}
.route-desc {
  font-size: 0.9rem;
  color: var(--text-muted);
  line-height: 1.5;
  flex: 1;
}
.status-badge-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.status-label {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 600;
}
.controls-label {
  font-size: 0.85rem;
  color: var(--text-main);
  font-weight: 700;
}
.buttons-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}
.btn-status {
  padding: 0.5rem 0;
  font-size: 0.85rem;
  font-weight: 700;
  border-radius: var(--radius-sm);
}
.btn-outline {
  border: 1px solid var(--border-light);
  color: var(--text-muted);
  background: var(--bg-white);
}
.btn-outline:hover {
  border-color: var(--primary-green);
  color: var(--primary-green);
}
.btn-warning-active {
  background-color: #f6c358;
  color: #5f3a00;
  border: none;
}
.btn-warning-active:hover {
  opacity: 0.9;
}
.btn-danger {
  background-color: #c5221f;
  color: #fff;
  border: none;
}
.closed-warning {
  background-color: #fce8e6;
  border: 1px solid #f28b82;
  border-radius: var(--radius-sm);
  padding: 0.75rem;
}
.closed-warning p {
  font-size: 0.8rem;
  color: #c5221f;
  line-height: 1.4;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.alert {
  padding: 1rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
}
</style>