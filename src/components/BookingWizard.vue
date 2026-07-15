<!--
  BookingWizard.vue
  Multi-step wizard dengan slide animasi dan progress bar.
  Menggantikan form booking satu halaman di BookingView.vue.

  Steps:
    1. Pilih Jalur & Tanggal
    2. Data Ketua Rombongan
    3. Data Anggota
    4. Upload Dokumen SIMAKSI
    5. Konfirmasi & Submit
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDatabaseStore } from '../stores/database'
import { useBooking } from '../composables/useBooking'
import { useTenant } from '../composables/useTenant'
import { useQuotas } from '../composables/useQuotas'
import { useStorage } from '../composables/useStorage'
import type { DocumentType } from '../types/database.types'

const props = defineProps<{
  /** jalurId yang dipilih dari URL params */
  initialTrailId: string
}>()

const router = useRouter()
const db = useDatabaseStore()
const { mountainId, pricePerPerson, features } = useTenant()
const {
  formData, currentStep, TOTAL_STEPS, totalAmount, canProceed,
  isLoading, error,
  nextStep, prevStep, syncMembersToHeadcount, createBooking
} = useBooking(mountainId.value, pricePerPerson.value)
const { fetchQuota, getAvailableSlots, isTrailAvailable } = useQuotas(mountainId.value)
const { uploadDocument, isDocUploaded, isDocUploading, getDocUrl } = useStorage(mountainId.value)

// ── Init trail from URL param ─────────────────────────────────
const selectedJalur = computed(() => db.jalur.find(j => j.id === props.initialTrailId))

watch(() => props.initialTrailId, (id) => {
  formData.value.trailId = id
  formData.value.trailName = selectedJalur.value?.nama_jalur ?? ''
}, { immediate: true })

// ── Date setup ────────────────────────────────────────────────
const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
const minDate = tomorrow.toISOString().slice(0, 10)

if (!formData.value.date) {
  formData.value.date = minDate
}

// ── Quota display ─────────────────────────────────────────────
const activeQuota = computed(() => db.getKuotaHarian(props.initialTrailId, formData.value.date))
const availableSlots = computed(() => {
  const q = activeQuota.value
  return q.kuota_total - q.kuota_terpakai
})

const isPathTutup = computed(() => selectedJalur.value?.status_jalur === 'Tutup')
const isPathWaspada = computed(() => selectedJalur.value?.status_jalur === 'Waspada')
const disclaimerAccepted = ref(false)

// ── Members sync ──────────────────────────────────────────────
watch(() => formData.value.headcount, () => syncMembersToHeadcount())

// ── Document uploads ──────────────────────────────────────────
const ktpInput = ref<HTMLInputElement | null>(null)
const healthInput = ref<HTMLInputElement | null>(null)

async function handleFileUpload(event: Event, docType: DocumentType) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  await uploadDocument(formData.value.trailId, docType, file)
}

// ── Navigation with validation ────────────────────────────────
const stepError = ref('')

function handleNext() {
  stepError.value = ''
  if (currentStep.value === 1) {
    if (!formData.value.date) { stepError.value = 'Pilih tanggal pendakian.'; return }
    if (isPathTutup.value) { stepError.value = 'Jalur ditutup. Booking tidak dapat dilanjutkan.'; return }
    if (formData.value.headcount > availableSlots.value) {
      stepError.value = `Kuota tidak mencukupi. Tersisa ${availableSlots.value} slot.`; return
    }
    if (isPathWaspada.value && !disclaimerAccepted.value) {
      stepError.value = 'Anda wajib menyetujui pernyataan risiko jalur Waspada.'; return
    }
  }
  if (currentStep.value === 2) {
    if (!formData.value.leaderName.trim()) { stepError.value = 'Nama ketua wajib diisi.'; return }
    if (formData.value.leaderNik.length < 16) { stepError.value = 'NIK harus 16 digit.'; return }
    if (!formData.value.leaderPhone.trim()) { stepError.value = 'No. HP wajib diisi.'; return }
    if (!formData.value.emergencyContact.trim()) { stepError.value = 'Kontak darurat wajib diisi.'; return }
  }
  if (currentStep.value === 3) {
    for (let i = 0; i < formData.value.members.length; i++) {
      if (!formData.value.members[i]?.trim()) {
        stepError.value = `Nama anggota #${i + 1} wajib diisi.`; return
      }
    }
  }
  nextStep()
}

// ── Final submission ──────────────────────────────────────────
const isSubmitting = ref(false)

async function handleSubmit() {
  isSubmitting.value = true
  stepError.value = ''
  const result = await createBooking()
  isSubmitting.value = false
  if (result.success && result.bookingId) {
    router.push({ name: 'payment', params: { bookingId: result.bookingId } })
  } else {
    stepError.value = result.error ?? 'Terjadi kesalahan. Coba lagi.'
  }
}

// ── Wizard step metadata ──────────────────────────────────────
const stepLabels = ['Jadwal', 'Ketua', 'Anggota', 'Dokumen', 'Konfirmasi']

// Slide direction
const slideDirection = ref<'slide-left' | 'slide-right'>('slide-left')
const originalNextStep = nextStep
function handlePrev() {
  slideDirection.value = 'slide-right'
  prevStep()
}
function handleNextWithDir() {
  slideDirection.value = 'slide-left'
  handleNext()
}

// Format currency
const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
</script>

<template>
  <div class="booking-wizard animate-fade-in">

    <!-- ─── Step Progress Bar ─────────────────────────────── -->
    <div class="wizard-step-bar" role="progressbar" :aria-valuenow="currentStep" :aria-valuemax="TOTAL_STEPS">
      <template v-for="(label, idx) in stepLabels" :key="idx">
        <div
          class="wizard-step"
          :class="{
            active: currentStep === idx + 1,
            completed: currentStep > idx + 1
          }"
        >
          <div class="wizard-step-dot">
            <i v-if="currentStep > idx + 1" class="ph-bold ph-check"></i>
            <span v-else>{{ idx + 1 }}</span>
          </div>
          <span class="wizard-step-label">{{ label }}</span>
        </div>
        <!-- Connector line between steps -->
        <div
          v-if="idx < stepLabels.length - 1"
          class="wizard-step-line"
          :class="{ completed: currentStep > idx + 1 }"
        ></div>
      </template>
    </div>

    <!-- ─── Step Content Area with Transitions ────────────── -->
    <div class="wizard-content-wrapper">
      <Transition :name="slideDirection" mode="out-in">

        <!-- ── STEP 1: Jadwal & Kuota ─────────────────────── -->
        <div v-if="currentStep === 1" key="step1" class="wizard-step-content">
          <h3 class="step-title"><i class="ph-fill ph-calendar-check"></i> Pilih Jadwal Pendakian</h3>

          <div class="form-group">
            <label class="form-label">Tanggal Naik</label>
            <input type="date" class="form-control" v-model="formData.date" :min="minDate" />
          </div>

          <div class="form-group">
            <label class="form-label">Jumlah Pendaki (Termasuk Ketua)</label>
            <input type="number" class="form-control" v-model.number="formData.headcount"
              min="1" :max="availableSlots" />
          </div>

          <!-- Quota indicator -->
          <div class="quota-indicator" :class="{ 'quota-low': availableSlots < 20, 'quota-full': availableSlots === 0 }">
            <i class="ph-fill ph-users"></i>
            <div>
              <div class="quota-label">Sisa Kuota Tanggal Ini</div>
              <div class="quota-value">{{ availableSlots }} / {{ activeQuota.kuota_total }} orang</div>
            </div>
            <span v-if="availableSlots === 0" class="badge badge-danger">Penuh</span>
            <span v-else-if="availableSlots < 20" class="badge badge-warning">Hampir Penuh</span>
            <span v-else class="badge badge-success">Tersedia</span>
          </div>

          <!-- Trail status badges -->
          <div v-if="selectedJalur" class="trail-status-row">
            <span v-if="selectedJalur.status_jalur === 'Buka'" class="badge badge-success">
              <i class="ph-fill ph-check-circle"></i> Jalur Dibuka
            </span>
            <span v-else-if="selectedJalur.status_jalur === 'Waspada'" class="badge badge-warning">
              <i class="ph-fill ph-warning-circle"></i> Status Waspada
            </span>
            <span v-else class="badge badge-danger">
              <i class="ph-fill ph-prohibit"></i> Jalur Ditutup
            </span>
          </div>

          <!-- Waspada disclaimer -->
          <Transition name="fade-scale">
            <div v-if="isPathWaspada" class="disclaimer-card">
              <div class="disclaimer-header">
                <i class="ph-fill ph-warning-octagon"></i>
                <h4>Peringatan Keselamatan: Status Waspada</h4>
              </div>
              <p class="disclaimer-text">
                Jalur ini berstatus <strong>WASPADA</strong> — cuaca buruk atau angin kencang di sekitar puncak. Pendakian tetap diizinkan namun wajib membawa perlengkapan keselamatan lengkap.
              </p>
              <label class="disclaimer-checkbox">
                <input type="checkbox" v-model="disclaimerAccepted" id="disclaimer-check" />
                <span>Saya memahami risiko dan siap dengan perlengkapan yang memadai.</span>
              </label>
            </div>
          </Transition>
        </div>

        <!-- ── STEP 2: Data Ketua ──────────────────────────── -->
        <div v-else-if="currentStep === 2" key="step2" class="wizard-step-content">
          <h3 class="step-title"><i class="ph-fill ph-user-circle"></i> Data Ketua Rombongan</h3>

          <div class="form-group">
            <label class="form-label">Nama Lengkap (Sesuai KTP)</label>
            <input type="text" class="form-control" v-model="formData.leaderName"
              placeholder="Nama Ketua Rombongan" />
          </div>

          <div class="grid grid-2">
            <div class="form-group">
              <label class="form-label">NIK (16 Digit)</label>
              <input type="text" class="form-control" v-model="formData.leaderNik"
                placeholder="1234567890123456" maxlength="16" />
            </div>
            <div class="form-group">
              <label class="form-label">No. WhatsApp Aktif</label>
              <input type="tel" class="form-control" v-model="formData.leaderPhone"
                placeholder="0857xxxxxxxx" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Kontak Darurat (Keluarga di Rumah)</label>
            <input type="tel" class="form-control" v-model="formData.emergencyContact"
              placeholder="No. HP keluarga yang bisa dihubungi" />
          </div>
        </div>

        <!-- ── STEP 3: Anggota ─────────────────────────────── -->
        <div v-else-if="currentStep === 3" key="step3" class="wizard-step-content">
          <h3 class="step-title"><i class="ph-fill ph-users-three"></i> Data Anggota Rombongan</h3>
          <p class="step-desc" v-if="formData.members.length === 0">
            Tidak ada anggota tambahan (pendakian solo / hanya ketua).
          </p>
          <TransitionGroup name="slide-left" tag="div">
            <div v-for="(_, idx) in formData.members" :key="idx" class="form-group">
              <label class="form-label">Nama Anggota #{{ idx + 1 }}</label>
              <input type="text" class="form-control" v-model="formData.members[idx]"
                :placeholder="`Nama Anggota #${idx + 1}`" />
            </div>
          </TransitionGroup>
        </div>

        <!-- ── STEP 4: Dokumen SIMAKSI ────────────────────── -->
        <div v-else-if="currentStep === 4" key="step4" class="wizard-step-content">
          <h3 class="step-title"><i class="ph-fill ph-file-doc"></i> Dokumen SIMAKSI</h3>
          <p class="step-desc">Upload dokumen identitas dan kesehatan. Maks 5MB per file (JPG/PNG/PDF).</p>

          <!-- KTP Upload -->
          <div class="doc-upload-item" :class="{ uploaded: isDocUploaded('ktp') }">
            <div class="doc-icon">
              <i class="ph-fill" :class="isDocUploaded('ktp') ? 'ph-check-circle' : 'ph-identification-card'"></i>
            </div>
            <div class="doc-info">
              <div class="doc-name">Scan KTP / Kartu Identitas</div>
              <div class="doc-status">{{ isDocUploaded('ktp') ? 'Berhasil diupload ✓' : 'Belum diupload' }}</div>
            </div>
            <div>
              <input ref="ktpInput" type="file" accept="image/*,.pdf" style="display:none"
                @change="e => handleFileUpload(e, 'ktp')" id="ktp-upload" />
              <button class="btn btn-outline-green btn-sm" type="button"
                @click="ktpInput?.click()" :disabled="isDocUploading('ktp')">
                <i class="ph-bold ph-upload-simple"></i>
                {{ isDocUploading('ktp') ? 'Mengupload...' : 'Pilih File' }}
              </button>
            </div>
          </div>

          <!-- Surat Sehat Upload -->
          <div class="doc-upload-item" :class="{ uploaded: isDocUploaded('health_certificate') }">
            <div class="doc-icon">
              <i class="ph-fill" :class="isDocUploaded('health_certificate') ? 'ph-check-circle' : 'ph-heart-straight'"></i>
            </div>
            <div class="doc-info">
              <div class="doc-name">Surat Keterangan Sehat</div>
              <div class="doc-status">{{ isDocUploaded('health_certificate') ? 'Berhasil diupload ✓' : 'Belum diupload' }}</div>
            </div>
            <div>
              <input ref="healthInput" type="file" accept="image/*,.pdf" style="display:none"
                @change="e => handleFileUpload(e, 'health_certificate')" id="health-upload" />
              <button class="btn btn-outline-green btn-sm" type="button"
                @click="healthInput?.click()" :disabled="isDocUploading('health_certificate')">
                <i class="ph-bold ph-upload-simple"></i>
                {{ isDocUploading('health_certificate') ? 'Mengupload...' : 'Pilih File' }}
              </button>
            </div>
          </div>

          <p class="doc-note">* Dokumen bisa dilengkapi belakangan jika belum tersedia sekarang.</p>
        </div>

        <!-- ── STEP 5: Konfirmasi ──────────────────────────── -->
        <div v-else-if="currentStep === 5" key="step5" class="wizard-step-content">
          <h3 class="step-title"><i class="ph-fill ph-clipboard-text"></i> Konfirmasi Booking</h3>

          <div class="confirmation-grid">
            <div class="confirm-block">
              <div class="confirm-label">Jalur Pendakian</div>
              <div class="confirm-value">{{ selectedJalur?.nama_jalur ?? formData.trailName }}</div>
            </div>
            <div class="confirm-block">
              <div class="confirm-label">Tanggal Naik</div>
              <div class="confirm-value">{{ new Date(formData.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }}</div>
            </div>
            <div class="confirm-block">
              <div class="confirm-label">Ketua Rombongan</div>
              <div class="confirm-value">{{ formData.leaderName }}</div>
            </div>
            <div class="confirm-block">
              <div class="confirm-label">Jumlah Pendaki</div>
              <div class="confirm-value">{{ formData.headcount }} orang</div>
            </div>
            <div v-if="formData.members.length > 0" class="confirm-block confirm-block--full">
              <div class="confirm-label">Anggota</div>
              <div class="confirm-value">{{ formData.members.join(', ') }}</div>
            </div>
          </div>

          <!-- Price breakdown -->
          <div class="payment-summary-card" style="margin-top: 1.5rem;">
            <div class="summary-row">
              <span>Tiket ({{ formData.headcount }} × {{ formatRp(pricePerPerson) }})</span>
              <span>{{ formatRp(formData.headcount * pricePerPerson) }}</span>
            </div>
            <div class="summary-row">
              <span>Retribusi Kawasan</span>
              <span>Termasuk</span>
            </div>
            <div class="summary-row">
              <span style="font-weight: 700;">TOTAL PEMBAYARAN</span>
              <span class="summary-total">{{ formatRp(formData.headcount * pricePerPerson) }}</span>
            </div>
          </div>
        </div>

      </Transition>
    </div>

    <!-- ─── Error Banner ────────────────────────────────────── -->
    <Transition name="fade-scale">
      <div v-if="stepError" class="error-banner" role="alert">
        <i class="ph-fill ph-warning-circle"></i>
        <span>{{ stepError }}</span>
      </div>
    </Transition>

    <!-- ─── Navigation Buttons ──────────────────────────────── -->
    <div class="wizard-nav">
      <button
        v-if="currentStep > 1"
        class="btn btn-outline-secondary"
        type="button"
        @click="handlePrev"
      >
        <i class="ph-bold ph-arrow-left"></i> Kembali
      </button>
      <div style="flex: 1;"></div>

      <!-- Next (steps 1-4) -->
      <button
        v-if="currentStep < TOTAL_STEPS"
        class="btn btn-green"
        type="button"
        @click="handleNextWithDir"
      >
        Lanjut <i class="ph-bold ph-arrow-right"></i>
      </button>

      <!-- Submit (step 5) -->
      <button
        v-if="currentStep === TOTAL_STEPS"
        class="btn btn-green"
        type="button"
        :disabled="isSubmitting"
        @click="handleSubmit"
      >
        <i v-if="isSubmitting" class="ph-bold ph-spinner" style="animation: spin 1s linear infinite;"></i>
        {{ isSubmitting ? 'Memproses...' : 'Buat Booking & Lanjut Bayar' }}
        <i v-if="!isSubmitting" class="ph-bold ph-arrow-right"></i>
      </button>
    </div>

  </div>
</template>

<style scoped>
.booking-wizard {
  max-width: 680px;
  margin: 0 auto;
}

.wizard-content-wrapper {
  position: relative;
  min-height: 320px;
  overflow: hidden;
}

.wizard-step-content {
  padding: 0.25rem 0;
}

.step-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.step-title i { color: var(--primary-green); font-size: 1.3rem; }

.step-desc {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin-bottom: 1.5rem;
}

/* ─ Quota Indicator ─ */
.quota-indicator {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--bg-light);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 1rem 1.25rem;
  margin: 1.25rem 0;
  transition: border-color 0.3s ease;
}
.quota-indicator i { font-size: 2rem; color: var(--primary-green); }
.quota-indicator.quota-low { border-color: #b06000; background: #fef7e0; }
.quota-indicator.quota-low i { color: #b06000; }
.quota-indicator.quota-full { border-color: #c5221f; background: #fce8e6; }
.quota-indicator.quota-full i { color: #c5221f; }
.quota-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; }
.quota-value { font-size: 1.05rem; font-weight: 700; }

.trail-status-row { margin-bottom: 1rem; }

/* ─ Disclaimer ─ */
.disclaimer-card {
  padding: 1.25rem;
  border: 1px solid #f6c358;
  background: #fef7e0;
  border-radius: var(--radius-md);
  margin-top: 1rem;
}
.disclaimer-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #b06000;
  margin-bottom: 0.75rem;
  font-size: 1rem;
  font-weight: 700;
}
.disclaimer-text {
  font-size: 0.85rem;
  color: #5f3a00;
  line-height: 1.6;
  margin-bottom: 1rem;
}
.disclaimer-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #5f3a00;
  cursor: pointer;
}

/* ─ Document Upload ─ */
.doc-upload-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
  background: #fff;
  transition: border-color 0.2s ease, background 0.2s ease;
}
.doc-upload-item.uploaded {
  border-color: var(--primary-green);
  background: #f2fcf5;
}
.doc-icon { font-size: 2rem; color: var(--text-muted); }
.doc-upload-item.uploaded .doc-icon { color: var(--primary-green); }
.doc-info { flex: 1; }
.doc-name { font-size: 0.9rem; font-weight: 600; margin-bottom: 0.2rem; }
.doc-status { font-size: 0.8rem; color: var(--text-muted); }
.doc-upload-item.uploaded .doc-status { color: var(--primary-green); }
.doc-note { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem; }

.btn-outline-green {
  background: transparent;
  border: 1.5px solid var(--primary-green);
  color: var(--primary-green);
  font-size: 0.8rem;
  padding: 0.35rem 0.85rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  transition: all 0.2s ease;
}
.btn-outline-green:hover:not(:disabled) {
  background: var(--primary-green);
  color: #fff;
}

.btn-outline-secondary {
  background: transparent;
  border: 1.5px solid var(--border-light);
  color: var(--text-muted);
  padding: 0.6rem 1.25rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}
.btn-outline-secondary:hover {
  border-color: var(--text-main);
  color: var(--text-main);
}

/* ─ Confirmation Grid ─ */
.confirmation-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  background: var(--bg-light);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 1.5rem;
}
.confirm-block--full { grid-column: 1 / -1; }
.confirm-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 0.25rem; }
.confirm-value { font-size: 0.95rem; font-weight: 700; color: var(--text-main); }

/* ─ Error Banner ─ */
.error-banner {
  margin-top: 1.25rem;
  padding: 0.85rem 1rem;
  background: #fce8e6;
  border: 1px solid #c5221f;
  color: #c5221f;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
}

/* ─ Nav Buttons ─ */
.wizard-nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-light);
}

.btn.btn-green {
  padding: 0.7rem 1.75rem;
  font-size: 0.95rem;
}

/* ─ Spinner ─ */
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
