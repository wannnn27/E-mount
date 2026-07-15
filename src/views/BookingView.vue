<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useTenant } from '../composables/useTenant'
// Mengimpor client Supabase terpusat Anda
import { supabase } from '../lib/supabase'
import BookingWizard from '../components/BookingWizard.vue'
import PaymentSidebar from '../components/PaymentSidebar.vue'

const route = useRoute()
const { mountainId, initTenant, pricePerPerson } = useTenant()

const jalurId = route.params.jalurId as string

// State internal penampung detail data reaktif jalur dari database Supabase
const selectedJalurRaw = ref<any>(null)
const isLoading = ref(true)

// 1. Mengambil Spesifikasi Jalur Secara Akurat Mengikuti Id Parameter Router & Multi-Tenant
const fetchTrailDetail = async () => {
  if (!mountainId.value || !jalurId) return
  isLoading.value = true
  
  try {
    const { data, error } = await supabase
      .from('trails')
      .select('*')
      .eq('id', jalurId)
      .eq('mountain_id', mountainId.value)
      .single() // Mengambil data objek tunggal secara presisi

    if (error) throw error
    selectedJalurRaw.value = data
  } catch (err) {
    console.error('Gagal memuat detail spesifikasi jalur:', err)
    selectedJalurRaw.value = null
  } finally {
    isLoading.value = false
  }
}

// Memicu pencarian ulang otomatis jika id tenant gunung berpindah
watch(() => mountainId.value, (newId) => {
  if (newId) fetchTrailDetail()
})

onMounted(async () => {
  // Memastikan mesin inisialisasi identitas tenant gunung sudah aktif berjalan
  await initTenant()
  await fetchTrailDetail()
})

// 2. Data Mapping Computed untuk Mengubah Properti DB agar 100% Kompatibel dengan Template Anda
const selectedJalur = computed(() => {
  if (isLoading.value || !selectedJalurRaw.value) return null

  // Normalisasi string status keamanan agar sinkron dengan badge visual pada template
  let currentStatus = 'Buka'
  if (selectedJalurRaw.value.difficulty === 'Waspada' || selectedJalurRaw.value.difficulty === 'Waspada Cuaca') {
    currentStatus = 'Waspada'
  } else if (selectedJalurRaw.value.difficulty === 'Tutup' || selectedJalurRaw.value.difficulty === 'Closed') {
    currentStatus = 'Tutup'
  }

  return {
    id: selectedJalurRaw.value.id,
    nama_jalur: selectedJalurRaw.value.name,
    deskripsi: selectedJalurRaw.value.description || 'Jalur pendakian resmi menuju puncak gunung.',
    status_jalur: currentStatus,
    latitude: selectedJalurRaw.value.latitude || '-7.2425',
    longitude: selectedJalurRaw.value.longitude || '109.2183'
  }
})
</script>

<template>
  <div class="booking-page animate-fade-in" v-if="selectedJalur">
    <div class="page-header">
      <h2>FORMULIR BOOKING PENDAKIAN</h2>
      <p>Lengkapi data rombongan Anda via <strong>{{ selectedJalur.nama_jalur }}</strong></p>
    </div>

    <div class="container" style="padding: 3rem 1rem;">
      <div class="breadcrumb">
        <RouterLink to="/" class="back-link">
          <i class="ph-bold ph-arrow-left"></i> Kembali ke Beranda
        </RouterLink>
      </div>

      <div class="booking-layout">
        <div class="booking-main">
          <div class="card-tngm summary-card">
            <h3 class="summary-title">{{ selectedJalur.nama_jalur }}</h3>
            <p class="summary-desc">{{ selectedJalur.deskripsi }}</p>
            <div class="summary-badges">
              <span v-if="selectedJalur.status_jalur === 'Buka'" class="badge badge-success">
                <i class="ph-fill ph-check-circle"></i> Jalur Dibuka
              </span>
              <span v-else-if="selectedJalur.status_jalur === 'Waspada'" class="badge badge-warning">
                <i class="ph-fill ph-warning-circle"></i> Waspada Cuaca
              </span>
              <span v-else class="badge badge-danger">
                <i class="ph-fill ph-prohibit"></i> Jalur Ditutup
              </span>
              <span class="summary-coord">
                <i class="ph-fill ph-map-pin"></i>
                {{ selectedJalur.latitude }}, {{ selectedJalur.longitude }}
              </span>
            </div>
          </div>

          <div class="card-tngm wizard-card">
            <BookingWizard :initial-trail-id="jalurId" />
          </div>
        </div>

        <div class="booking-sidebar">
          <PaymentSidebar
            :trail-name="selectedJalur.nama_jalur"
            :date="''"
            :headcount="1"
            :price-per-person="pricePerPerson"
          />
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="!isLoading" class="container" style="padding: 6rem 1rem; text-align: center;">
    <i class="ph-fill ph-warning-circle" style="font-size: 3rem; color: #c5221f;"></i>
    <h2 style="margin: 1rem 0 0.5rem;">Jalur Tidak Ditemukan</h2>
    <p style="color: var(--text-muted);">ID jalur yang diminta tidak ada di sistem.</p>
    <RouterLink to="/" class="btn btn-green" style="margin-top: 1.5rem;">Kembali ke Beranda</RouterLink>
  </div>
</template>

<style scoped>
/* Seluruh kode CSS bawaan dipertahankan 100% tanpa modifikasi */
.page-header {
  background: linear-gradient(135deg, #1a3c4a 0%, #0d2b36 100%);
  color: #fff;
  padding: 4rem 1rem;
  text-align: center;
}
.page-header h2 {
  font-size: 2.25rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}
.page-header p {
  font-size: 1.05rem;
  opacity: 0.85;
}
.breadcrumb { margin-bottom: 1.5rem; }
.back-link {
  color: var(--primary-green);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.back-link:hover { text-decoration: underline; }
.booking-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  align-items: start;
}
@media (min-width: 960px) {
  .booking-layout {
    grid-template-columns: 1fr 340px;
  }
}
.booking-main {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.summary-card {
  padding: 1.75rem;
}
.summary-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 0.5rem;
}
.summary-desc {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin-bottom: 1.25rem;
  line-height: 1.6;
}
.summary-badges {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.summary-coord {
  font-size: 0.82rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
}
.wizard-card {
  padding: 2rem;
}
</style>