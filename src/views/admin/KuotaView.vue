<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDatabaseStore } from '../../stores/database'

const db = useDatabaseStore()

// Set default date picker to tomorrow
const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
const defaultDateStr = tomorrow.toISOString().slice(0, 10)

// Inputs
const selectedJalurId = ref(db.jalur[0]?.id || '')
const targetDate = ref(defaultDateStr)
const quotaLimitInput = ref(100)

const successMessage = ref('')
const errorMessage = ref('')

const activeRoute = computed(() => {
  return db.jalur.find(j => j.id === selectedJalurId.value)
})

// Current quota status for selection
const activeKuotaEntry = computed(() => {
  return db.getKuotaHarian(selectedJalurId.value, targetDate.value)
})

// Quick check list for next 7 days
const next7DaysList = computed(() => {
  const list = []
  const today = new Date()
  
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(today.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    
    // For each path
    const pathQuotas = db.jalur.map(j => {
      const q = db.getKuotaHarian(j.id, dateStr)
      return {
        jalurName: j.nama_jalur,
        dateStr,
        total: q.kuota_total,
        terpakai: q.kuota_terpakai,
        sisa: q.kuota_total - q.kuota_terpakai
      }
    })
    list.push(...pathQuotas)
  }
  return list
})

const handleUpdateQuota = () => {
  successMessage.value = ''
  errorMessage.value = ''

  if (quotaLimitInput.value < 0) {
    errorMessage.value = 'Kuota total tidak boleh kurang dari 0.'
    return
  }

  // Ensure total is not less than already booked/terpakai quota
  const currentUsed = activeKuotaEntry.value.kuota_terpakai
  if (quotaLimitInput.value < currentUsed) {
    errorMessage.value = `Gagal. Kuota total tidak boleh lebih kecil dari kuota terpakai saat ini (${currentUsed} slot telah dibooking).`
    return
  }

  const success = db.updateKuotaHarian(selectedJalurId.value, targetDate.value, quotaLimitInput.value)
  if (success) {
    successMessage.value = `Kuota untuk ${activeRoute.value?.nama_jalur} tanggal ${targetDate.value} berhasil diubah menjadi ${quotaLimitInput.value}!`
  } else {
    errorMessage.value = 'Gagal memperbarui kuota.'
  }
}

// Watch selection changes to autofill form
const syncFormInput = () => {
  quotaLimitInput.value = activeKuotaEntry.value.kuota_total
}
</script>

<template>
  <div class="quota-admin-page container animate-fade-in">
    <div class="header-section">
      <h2 style="font-size: 2rem; font-weight: 700; color: var(--text-main);">Manajemen Kuota Pendakian</h2>
      <p class="subtitle">Sesuaikan batas maksimal kapasitas pendaki per hari untuk masing-masing jalur pendakian resmi.</p>
    </div>

    <div class="grid-2 margin-top-2">
      <!-- Left side: adjustment form -->
      <div>
        <div class="card-tngm adjust-quota-card">
          <div style="background-color: var(--primary-green); color: #fff; padding: 1rem 1.5rem; font-weight: 700;">Atur Ulang Kuota</div>
          <div style="padding: 1.5rem;">
            <form @submit.prevent="handleUpdateQuota">
              <!-- Select route -->
              <div class="form-group">
                <label class="form-label" style="font-weight: 600; color: var(--text-main);">Pilih Jalur Pendakian</label>
                <select v-model="selectedJalurId" @change="syncFormInput" class="form-control">
                  <option v-for="j in db.jalur" :key="j.id" :value="j.id">{{ j.nama_jalur }}</option>
                </select>
              </div>

              <!-- Pick Date -->
              <div class="form-group margin-top-1">
                <label class="form-label" style="font-weight: 600; color: var(--text-main);">Tanggal Penyesuaian</label>
                <input type="date" v-model="targetDate" @change="syncFormInput" class="form-control" />
              </div>

              <!-- Current status summary -->
              <div class="current-quota-summary alert alert-info margin-top-1">
                <div>
                  <strong>Status Saat Ini:</strong>
                  <ul>
                    <li>Total Kuota: {{ activeKuotaEntry.kuota_total }} Orang</li>
                    <li>Terpakai: {{ activeKuotaEntry.kuota_terpakai }} Orang</li>
                    <li>Tersisa: <strong>{{ activeKuotaEntry.kuota_total - activeKuotaEntry.kuota_terpakai }} Orang</strong></li>
                  </ul>
                </div>
              </div>

              <!-- Input new limit -->
              <div class="form-group margin-top-1">
                <label class="form-label" style="font-weight: 600; color: var(--text-main);">Batas Kuota Baru (Jumlah Total Slot)</label>
                <input type="number" v-model.number="quotaLimitInput" class="form-control" min="0" />
                <span class="form-help">Sesuaikan kapasitas default untuk hari libur / antisipasi cuaca ekstrem.</span>
              </div>

              <!-- Message banners -->
              <div v-if="successMessage" class="alert alert-success" style="background: #e6f4ea; border: 1px solid var(--primary-green); color: var(--primary-green);">
                <i class="ph-fill ph-check-circle"></i> <span>{{ successMessage }}</span>
              </div>
              <div v-if="errorMessage" class="alert alert-danger" style="background: #fce8e6; border: 1px solid #c5221f; color: #c5221f;">
                <i class="ph-fill ph-warning-circle"></i> <span>{{ errorMessage }}</span>
              </div>

              <!-- Submit -->
              <button type="submit" class="btn btn-green w-full margin-top-1">Perbarui Kuota Jalur</button>
            </form>
          </div>
        </div>
      </div>

      <!-- Right side: Overview table for next 7 days -->
      <div>
        <div class="card-tngm overview-card">
          <div class="table-header">
            <h3 class="card-title">Ketersediaan Kuota 7 Hari ke Depan</h3>
          </div>
          <div class="divider" style="margin:0;"></div>

          <div class="table-container table-responsive list-scroll" style="padding: 1rem 1.5rem;">
            <table class="custom-table compact-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Jalur</th>
                  <th>Terpakai</th>
                  <th>Batas</th>
                  <th>Sisa</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(q, index) in next7DaysList" :key="index" :class="{'highlight-low': q.sisa < 10}">
                  <td><code>{{ q.dateStr }}</code></td>
                  <td><strong>{{ q.jalurName }}</strong></td>
                  <td>👥 {{ q.terpakai }}</td>
                  <td>{{ q.total }}</td>
                  <td class="font-bold" :class="q.sisa <= 0 ? 'text-red' : 'text-primary'">
                    {{ q.sisa }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quota-admin-page {
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

.grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 900px) {
  .grid-2 {
    grid-template-columns: 1fr 1.2fr;
  }
}

.current-quota-summary {
  background-color: #f0fdf4;
  border: 1px solid rgba(19, 115, 51, 0.15);
  color: var(--primary-green);
  padding: 1rem 1.5rem;
  border-radius: var(--radius-sm);
}

.current-quota-summary ul {
  padding-left: 1.25rem;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

.form-help {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 0.5rem;
}

/* Scroll list overview style */
.list-scroll {
  max-height: 520px;
  overflow-y: auto;
}

.table-header {
  padding: 1.5rem;
  background-color: var(--bg-light);
  border-bottom: 1px solid var(--border-light);
}

.card-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-main);
}

.compact-table th {
  padding: 0.75rem 1rem;
}

.compact-table td {
  padding: 0.75rem 1rem;
}

.highlight-low {
  background-color: #fce8e6;
}

.font-bold {
  font-weight: 700;
}

.text-primary {
  color: var(--primary-green);
}

.text-red {
  color: #c5221f;
}

.w-full {
  width: 100%;
}

.alert {
  padding: 1rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  margin-top: 1rem;
}
</style>
