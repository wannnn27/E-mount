<script setup lang="ts">
import { ref } from 'vue'

const selectedBulan = ref('Juli')
const selectedTahun = ref('2026')

// Dummy data based on the screenshot
const dummyData = [
  { tanggal: '01-07-2026', selo: 488, thekelan: 102, suwanting: 0, cuntel: 126, wekas: 268 },
  { tanggal: '02-07-2026', selo: 491, thekelan: 130, suwanting: 0, cuntel: 117, wekas: 237 },
  { tanggal: '03-07-2026', selo: 489, thekelan: 152, suwanting: 0, cuntel: 92, wekas: 266 },
  { tanggal: '04-07-2026', selo: 45, thekelan: 0, suwanting: 0, cuntel: 0, wekas: 83 },
  { tanggal: '05-07-2026', selo: 430, thekelan: 0, suwanting: 0, cuntel: 83, wekas: 251 },
  { tanggal: '06-07-2026', selo: 447, thekelan: 0, suwanting: 0, cuntel: 83, wekas: 241 },
  { tanggal: '07-07-2026', selo: 502, thekelan: 12, suwanting: 0, cuntel: 105, wekas: 244 },
  { tanggal: '08-07-2026', selo: 477, thekelan: 21, suwanting: 0, cuntel: 89, wekas: 256 },
  { tanggal: '09-07-2026', selo: 468, thekelan: 144, suwanting: 0, cuntel: 99, wekas: 274 },
  { tanggal: '10-07-2026', selo: 500, thekelan: 101, suwanting: 0, cuntel: 104, wekas: 265 },
]

// Note: Although this is for Gunung Slamet, the user screenshot specifically showed Merbabu routes (Selo, Thekelan, etc). 
// Since the prompt was "cuman pake dummy aja" referencing the screenshot, I'll adapt it to Gunung Slamet routes (Bambangan, Guci, Dipajaya, dll) for consistency, but keep the structure exact.
const slmtDummyData = [
  { tanggal: '01-07-2026', bambangan: 488, guci: 102, dipajaya: 0, baturraden: 126, kalidas: 268 },
  { tanggal: '02-07-2026', bambangan: 491, guci: 130, dipajaya: 0, baturraden: 117, kalidas: 237 },
  { tanggal: '03-07-2026', bambangan: 489, guci: 152, dipajaya: 0, baturraden: 92, kalidas: 266 },
  { tanggal: '04-07-2026', bambangan: 45,  guci: 0,   dipajaya: 0, baturraden: 0,   kalidas: 83 },
  { tanggal: '05-07-2026', bambangan: 430, guci: 0,   dipajaya: 0, baturraden: 83,  kalidas: 251 },
  { tanggal: '06-07-2026', bambangan: 447, guci: 0,   dipajaya: 0, baturraden: 83,  kalidas: 241 },
  { tanggal: '07-07-2026', bambangan: 502, guci: 12,  dipajaya: 0, baturraden: 105, kalidas: 244 },
  { tanggal: '08-07-2026', bambangan: 477, guci: 21,  dipajaya: 0, baturraden: 89,  kalidas: 256 },
  { tanggal: '09-07-2026', bambangan: 468, guci: 144, dipajaya: 0, baturraden: 99,  kalidas: 274 },
  { tanggal: '10-07-2026', bambangan: 500, guci: 101, dipajaya: 0, baturraden: 104, kalidas: 265 },
]
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
      <button class="btn btn-orange" style="padding: 0.5rem 2rem; border-radius: 0;">CARI</button>
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
