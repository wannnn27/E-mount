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
      .select('id, name, max_capacity')
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

    // 2. Fetch data kustom kuota dari tabel quotas berdasarkan rentang waktu (Kolom Baru: quota_date)
    const { data: quotas, error: quotasErr } = await supabase
      .from('quotas')
      .select('*')
      .in('trail_id', trailIds)
      .gte('quota_date', startDate)
      .lte('quota_date', endDate)

    if (quotasErr) throw quotasErr

    // 3. Fetch data booking aktif bulan ini untuk menghitung jumlah slot terpakai secara riil
    const { data: bookings, error: bookingsErr } = await supabase
      .from('bookings')
      .select('trail_id, entry_date, booking_members(id)')
      .in('trail_id', trailIds)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .in('status', ['PAID', 'APPROVED', 'CHECKED_IN', 'PERMIT_REVIEW', 'WAITING_PAYMENT'])

    if (bookingsErr) throw bookingsErr

    // 4. Transformasi & mapping data secara dinamis mengikuti jumlah hari asli dalam bulan tersebut
    const daysInMonth = new Date(Number(selectedTahun.value), Number(targetMonth), 0).getDate()
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

      // Isi nilai sisa kuota (Kapasitas Maksimal - Slot Terpakai dari Manifes Rombongan)
      trails.forEach(trail => {
        const defaultMax = trail.max_capacity || 100
        
        // Cek apakah ada override kuota khusus dari pos admin petugas
        const quotaOverride = quotas?.find(q => q.trail_id === trail.id && q.quota_date === dbDate)
        const totalQuota = quotaOverride ? quotaOverride.max_quota : defaultMax

        // Hitung jumlah pendaki terdaftar di tanggal dan jalur ini
        const dayBookings = bookings?.filter(b => b.trail_id === trail.id && b.entry_date === dbDate) || []
        const totalUsed = dayBookings.reduce((acc, b) => acc + (b.booking_members ? b.booking_members.length : 0), 0)

        // Sisa kuota tidak boleh bernilai negatif
        const sisaKuota = Math.max(0, totalQuota - totalUsed)
        
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

// 5. Implementasi Supabase Realtime agar kuota di dalam tabel terupdate secara live (PRD Bab 3.2 & 4.1)
const setupRealtimeSubscription = () => {
  quotaSubscription = supabase
    .channel('realtime-quota-table')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'quotas' }, () => {
      fetchKuotaData()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
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
    <div class="filter-controls" style="display: flex; gap: 1rem; align-items: center; margin-bottom: 2rem;">
      <select v-model="selectedBulan" class="form-control" style="width: 200px; padding: 0.5rem;">
        <option value="Juli">Juli</option>
        <option value="Agustus">Agustus</option>
      </select>
      <select v-model="selectedTahun" class="form-control" style="width: 200px; padding: 0.5rem;">
        <option value="2026">2026</option>
      </select>
      <button class="btn btn-orange" style="padding: 0.5rem 2rem; border-radius: 0;" @click="fetchKuotaData">CARI</button>
    </div>

    <p style="font-size: 0.95rem; margin-bottom: 1rem; color: var(--text-main);">
      Data yang ditampilkan pada halaman ini adalah <strong style="color: var(--accent-orange);">Jumlah Sisa Kuota</strong> pada setiap jalur pendakian.
    </p>

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