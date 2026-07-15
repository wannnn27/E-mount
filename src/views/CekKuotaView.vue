<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useTenant } from '../composables/useTenant'
// Mengimpor client Supabase yang terhubung dengan kredensial .env Anda
import { supabase } from '../lib/supabase' 

const selectedBulan = ref('Juli')
const selectedTahun = ref('2026')
const isLoading = ref(true)

// Mengambil mountainId dinamis dari subdomain/domain URL aktif (PRD Bab 3.1)
const { mountainId } = useTenant()

// Variabel ini menggantikan data dummy agar langsung terikat (data-binding) ke template Anda
const slmtDummyData = ref<any[]>([])
let quotaSubscription: any = null

// Pemetaan nama bulan ke format digit angka PostgreSQL
const monthMap: Record<string, string> = {
  'Juli': '07',
  'Agustus': '08'
}

// Fungsi utama untuk memuat sisa kuota dari Supabase berdasarkan filter dan tenant
const fetchKuotaData = async () => {
  if (!mountainId.value) return
  isLoading.value = true
  
  try {
    // 1. Ambil seluruh data jalur pendakian milik gunung/tenant ini
    const { data: trails, error: trailsErr } = await supabase
      .from('trails')
      .select('id, name')
      .eq('mountain_id', mountainId.value)
      
    if (trailsErr) throw trailsErr
    if (!trails || trails.length === 0) {
      slmtDummyData.value = []
      return
    }

    const trailIds = trails.map(t => t.id)
    const targetMonth = monthMap[selectedBulan.value] || '07'
    
    // Menentukan rentang tanggal awal dan akhir bulan untuk query gte & lte
    const startDate = `${selectedTahun.value}-${targetMonth}-01`
    const endDate = `${selectedTahun.value}-${targetMonth}-31`

    // 2. Fetch data kuota harian dari tabel quotas berdasarkan rentang waktu
    const { data: quotas, error: quotasErr } = await supabase
      .from('quotas')
      .select('*')
      .in('trail_id', trailIds)
      .gte('date', startDate)
      .lte('date', endDate)

    if (quotasErr) throw quotasErr

    // 3. Transformasi & mapping data dari database ke struktur yang dibaca oleh template Anda
    // Menghasilkan baris tanggal otomatis (misal dari tanggal 1 sampai 10 atau sebulan penuh)
    const daysInMonth = 10; // Disesuaikan dengan batas visual 10 baris pada dummy awal Anda
    const generatedRows = []

    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0')
      const dbDate = `${selectedTahun.value}-${targetMonth}-${dayStr}` // Format YYYY-MM-DD
      const viewDate = `${dayStr}-${targetMonth}-${selectedTahun.value}` // Format DD-MM-YYYY untuk template

      // Kerangka objek baris penampung data sisa kuota
      const rowData: Record<string, any> = {
        tanggal: viewDate,
        bambangan: 0,
        guci: 0,
        dipajaya: 0,
        baturraden: 0,
        kalidas: 0
      }

      // Isi nilai sisa kuota (capacity - booked_count) untuk masing-masing jalur secara dinamis (PRD Bab 1.3)
      trails.forEach(trail => {
        const quotaEntry = quotas?.find(q => q.trail_id === trail.id && q.date === dbDate)
        // Hitung sisa kuota: Kapasitas dikurangi jumlah slot yang sudah dipesan
        const sisaKuota = quotaEntry ? (quotaEntry.capacity - quotaEntry.booked_count) : 0
        
        const normalizedTrailName = trail.name.toLowerCase()
        if (normalizedTrailName.includes('bambangan')) rowData.bambangan = sisaKuota
        else if (normalizedTrailName.includes('guci')) rowData.guci = sisaKuota
        else if (normalizedTrailName.includes('dipajaya')) rowData.dipajaya = sisaKuota
        else if (normalizedTrailName.includes('baturraden')) rowData.baturraden = sisaKuota
        else if (normalizedTrailName.includes('kalidas')) rowData.kalidas = sisaKuota
      })

      generatedRows.push(rowData)
    }

    slmtDummyData.value = generatedRows
  } catch (err) {
    console.error('Gagal memuat log data kuota:', err)
  } finally {
    isLoading.value = false
  }
}

// 4. Implementasi Supabase Realtime agar kuota di dalam tabel terupdate secara live (PRD Bab 3.2 & 4.1)
const setupRealtimeSubscription = () => {
  quotaSubscription = supabase
    .channel('realtime-quota-table')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'quotas' }, () => {
      // Panggil ulang fetch data untuk merefresh isi tabel secara halus ketika ada transaksi masuk
      fetchKuotaData()
    })
    .subscribe()
}

// Memicu fetch ulang secara reaktif setiap kali mountainId terdeteksi atau berubah
watch(() => mountainId.value, (newId) => {
  if (newId) fetchKuotaData()
}, { immediate: true })

onMounted(() => {
  setupRealtimeSubscription()
})

onUnmounted(() => {
  // Membersihkan real-time channel saat komponen di-destroy demi performa memori
  if (quotaSubscription) {
    supabase.removeChannel(quotaSubscription)
  }
})
</script>

<template>
  <div class="cek-kuota-page container animate-fade-in" style="padding-top: 3rem; padding-bottom: 5rem;">
    <!-- Filters -->
    <div class="filter-controls" style="display: flex; gap: 1rem; align-items: center; margin-bottom: 2rem;">
      <select v-model="selectedBulan" class="form-control" style="width: 200px; padding: 0.5rem;">
        <option value="Juli">Juli</option>
        <option value="Agustus">Agustus</option>
      </select>
      <select v-model="selectedTahun" class="form-control" style="width: 200px; padding: 0.5rem;">
        <option value="2026">2026</option>
      </select>
      <!-- Menambahkan event click untuk memfungsikan tombol CARI sesuai filter -->
      <button class="btn btn-orange" style="padding: 0.5rem 2rem; border-radius: 0;" @click="fetchKuotaData">CARI</button>
    </div>

    <!-- Notice -->
    <p style="font-size: 0.95rem; margin-bottom: 1rem; color: var(--text-main);">
      Data yang ditampilkan pada halaman ini adalah <strong style="color: var(--accent-orange);">Jumlah Sisa Kuota</strong> pada setiap jalur pendakian.
    </p>

    <!-- Table -->
    <div class="table-responsive" style="overflow-x: auto;">
      <table class="kuota-table" style="width: 100%; border-collapse: collapse; text-align: center; font-size: 0.9rem;">
        <thead>
          <tr>
            <th rowspan="2" style="border-bottom: 1px solid #ccc; padding: 1rem; text-align: left;">No</th>
            <th rowspan="2" style="border-bottom: 1px solid #ccc; padding: 1rem; text-align: left;">Tanggal</th>
            <th colspan="5" style="border-bottom: 1px solid #ccc; padding: 1rem;">Jalur Pendakian</th>
          </tr>
          <tr>
            <th style="border-bottom: 1px solid #ccc; padding: 1rem;">Jalur Pendakian Bambangan</th>
            <th style="border-bottom: 1px solid #ccc; padding: 1rem;">Jalur Pendakian Guci</th>
            <th style="border-bottom: 1px solid #ccc; padding: 1rem;">Jalur Pendakian Dipajaya</th>
            <th style="border-bottom: 1px solid #ccc; padding: 1rem;">Jalur Pendakian Baturraden</th>
            <th style="border-bottom: 1px solid #ccc; padding: 1rem;">Jalur Pendakian Kalidas</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in slmtDummyData" :key="idx" style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 1rem; text-align: left;">{{ idx + 1 }}</td>
            <td style="padding: 1rem; text-align: left;">{{ row.tanggal }}</td>
            <td style="padding: 1rem;">{{ row.bambangan }}</td>
            <td style="padding: 1rem;">{{ row.guci }}</td>
            <td style="padding: 1rem;">{{ row.dipajaya }}</td>
            <td style="padding: 1rem;">{{ row.baturraden }}</td>
            <td style="padding: 1rem;">{{ row.kalidas }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.kuota-table th {
  font-weight: 600;
  color: var(--text-main);
}
.kuota-table td {
  color: var(--text-main);
}
</style>