<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTenant } from '../composables/useTenant'
// Mengimpor Supabase client terpusat Anda
import { supabase } from '../lib/supabase' 

const route = useRoute()
const router = useRouter()
const { mountainId } = useTenant()

const bookingId = route.params.bookingId as string

// Menampung raw data asli dari database Supabase
const rawBooking = ref<any>(null)
const rawPayment = ref<any>(null)
const rawTrail = ref<any>(null)

// 1. Pemetaan Computed data agar strukturnya 100% kompatibel dengan variabel dummy di template Anda
const booking = computed(() => {
  if (!rawBooking.value) return null
  return {
    id: rawBooking.value.id,
    jalur_id: rawBooking.value.trail_id,
    tanggal_naik: new Date(rawBooking.value.entry_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    jumlah_pendaki: rawBooking.value.booking_members ? rawBooking.value.booking_members.length : 0
  }
})

const pembayaran = computed(() => {
  if (!rawPayment.value) return null
  return {
    jumlah: rawPayment.value.amount
  }
})

const jalur = computed(() => {
  if (!rawTrail.value) return null
  return {
    nama_jalur: rawTrail.value.name
  }
})

const selectedMethod = ref('bank') // 'bank' or 'va'
const transferProof = ref<File | null>(null)
const uploadProgress = ref(false)
const errorMessage = ref('')
const uploadSuccess = ref(false)

// 2. Memuat Rincian Tagihan & Booking Relasional dari Supabase (PRD Bab 6)
const fetchPaymentDetails = async () => {
  try {
    // Fetch data booking beserta relasi jalur dan jumlah anggota
    const { data: bookingData, error: bookingErr } = await supabase
      .from('bookings')
      .select(`
        *,
        trails (*),
        booking_members (id)
      `)
      .eq('id', bookingId)
      .single()

    if (bookingErr) throw bookingErr
    rawBooking.value = bookingData
    rawTrail.value = bookingData.trails

    // Fetch data nominal tagihan dari tabel payments
    const { data: paymentData, error: paymentErr } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle()

    if (paymentErr) throw paymentErr
    rawPayment.value = paymentData
  } catch (error) {
    console.error('Gagal memuat rincian transaksi:', error)
    errorMessage.value = 'Gagal memuat data transaksi dari server.'
  }
}

onMounted(() => {
  fetchPaymentDetails()
})

const formatRupiah = (val: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val)
}

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    transferProof.value = target.files[0] || null
  }
}

// 3. Proses Upload Bukti ke Supabase Storage & Mutasi Status State Machine (PRD Bab 4.2 & 6.3)
const submitPaymentProof = async () => {
  if (!transferProof.value) {
    errorMessage.value = 'Harap pilih berkas foto bukti transfer terlebih dahulu.'
    return
  }

  errorMessage.value = ''
  uploadProgress.value = true

  try {
    const file = transferProof.value
    const fileExt = file.name.split('.').pop()
    const fileName = `${bookingId}_proof_${Date.now()}.${fileExt}`
    const filePath = `receipts/${fileName}`

    // A. Upload file gambar ke private/public bucket Supabase Storage ('permit-documents')
    const { error: uploadErr } = await supabase.storage
      .from('permit-documents')
      .upload(filePath, file)

    if (uploadErr) throw uploadErr

    // Ambil URL public link objek untuk disimpan di metadata database
    const { data: { publicUrl } } = supabase.storage
      .from('permit-documents')
      .getPublicUrl(filePath)

    // B. Perbarui metode transaksi dan simpan referensi URL bukti ke tabel payments
    const { error: paymentUpdateErr } = await supabase
      .from('payments')
      .update({
        method: 'MANUAL_BANK',
        gateway_ref: publicUrl,
        status: 'PENDING'
      })
      .eq('booking_id', bookingId)

    if (paymentUpdateErr) throw paymentUpdateErr

    // C. Mutasi status utama booking menjadi PERMIT_REVIEW (Menunggu Verifikasi) agar sinkron dengan Dashboard
    const { error: bookingUpdateErr } = await supabase
      .from('bookings')
      .update({ status: 'PERMIT_REVIEW' })
      .eq('id', bookingId)

    if (bookingUpdateErr) throw bookingUpdateErr

    // Tampilkan screen sukses dan berikan micro-interaction delay sebelum redirect
    uploadSuccess.value = true
    setTimeout(() => {
      router.push({ name: 'riwayat' })
    }, 2000)

  } catch (error: any) {
    console.error('Error saat submit bukti transfer:', error)
    errorMessage.value = error.message || 'Gagal mengirimkan bukti transfer. Silakan coba lagi.'
  } finally {
    uploadProgress.value = false
  }
}
</script>

<template>
  <div class="payment-page animate-fade-in" v-if="booking && pembayaran">
    
    <div class="page-header">
      <h2>PEMBAYARAN TIKET</h2>
      <p>Selesaikan pembayaran untuk mengamankan kuota dan mendapatkan e-tiket Anda</p>
    </div>

    <div class="container" style="padding: 3rem 1rem;">
      <div class="breadcrumb">
        <RouterLink to="/riwayat" class="back-link"><i class="ph-bold ph-arrow-left"></i> Kembali ke Riwayat</RouterLink>
      </div>

      <div class="grid grid-layout">
        <div class="payment-sidebar">
          <div class="card-tngm">
            <div class="card-header-green">Rincian Transaksi</div>
            <div class="card-tngm-body">
              <div class="detail-row">
                <span class="detail-label">Kode Booking</span>
                <strong class="detail-value text-green">{{ booking.id }}</strong>
              </div>
              <div class="detail-row">
                <span class="detail-label">Jalur Pendakian</span>
                <span class="detail-value">{{ jalur?.nama_jalur }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Tanggal Naik</span>
                <span class="detail-value">{{ booking.tanggal_naik }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Jumlah Anggota</span>
                <span class="detail-value">{{ booking.jumlah_pendaki }} Orang</span>
              </div>
              
              <div class="divider"></div>
              
              <div class="total-row">
                <span>Total Tagihan</span>
                <strong class="total-price">{{ formatRupiah(pembayaran.jumlah) }}</strong>
              </div>
              <span class="price-notice">*(Rp 25.000,- per pendaki)</span>
            </div>
          </div>

          <div class="card-tngm margin-top-1">
            <div class="card-header-gray">Pilih Metode</div>
            <div class="card-tngm-body">
              <div class="method-options">
                <label class="method-option active">
                  <input type="radio" v-model="selectedMethod" value="bank" checked />
                  <div class="method-details">
                    <strong>Manual Bank Transfer</strong>
                    <p>Butuh verifikasi admin (1x24 jam)</p>
                  </div>
                </label>
                
                <label class="method-option disabled-option">
                  <input type="radio" disabled />
                  <div class="method-details">
                    <strong>Virtual Account (Qris)</strong>
                    <p>Pembayaran instan (Sedang Gangguan)</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="payment-main">
          <div class="card-tngm">
            <div class="card-header-green">Instruksi Pembayaran & Konfirmasi</div>
            <div class="card-tngm-body" style="padding: 2.5rem 2rem;">
              
              <div class="bank-details-box">
                <p class="bank-notice">Silakan transfer nominal tagihan tepat ke rekening pengelola berikut:</p>
                <div class="bank-account">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Bank_Mandiri_logo_2016.svg/1200px-Bank_Mandiri_logo_2016.svg.png" alt="Mandiri" class="bank-logo" />
                  <div class="account-number">133-0021-9877-62</div>
                  <div class="account-holder">a.n. BASECAMP GUNUNG SLAMET</div>
                </div>
              </div>

              <div class="divider" style="margin: 2.5rem 0;"></div>

              <div class="upload-form-section">
                <h4 class="section-heading">Unggah Bukti Transfer</h4>
                <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">Foto struk ATM or screenshot m-banking Anda. Pastikan tanggal dan nominal terlihat jelas.</p>
                
                <div v-if="!uploadSuccess">
                  <div class="file-drop-area">
                    <input type="file" id="proof-input" accept="image/*" @change="handleFileChange" class="file-input-hidden" />
                    <label for="proof-input" class="file-drop-label">
                      <i class="ph-fill ph-upload-simple file-icon"></i>
                      <span v-if="!transferProof">Klik untuk Pilih Foto / Screenshot</span>
                      <span v-else class="text-green font-bold">{{ transferProof.name }}</span>
                    </label>
                  </div>

                  <div v-if="errorMessage" class="error-banner">
                    <i class="ph-fill ph-warning-circle"></i>
                    <span>{{ errorMessage }}</span>
                  </div>

                  <button 
                    @click="submitPaymentProof" 
                    class="btn btn-green w-full margin-top-1" 
                    style="padding: 1rem; font-size: 1.05rem;"
                    :disabled="uploadProgress">
                    <span v-if="uploadProgress"><i class="ph ph-spinner ph-spin"></i> Sedang Mengunggah...</span>
                    <span v-else><i class="ph-bold ph-paper-plane-right"></i> Konfirmasi Pembayaran</span>
                  </button>
                </div>

                <div v-else class="success-upload-state text-center">
                  <div class="success-checkmark"><i class="ph-bold ph-check"></i></div>
                  <h4 style="color: var(--primary-green); font-size: 1.25rem; font-weight: 700;">Bukti Berhasil Terkirim!</h4>
                  <p class="margin-top-1" style="color: var(--text-muted);">
                    Status pemesanan Anda kini dalam antrean verifikasi petugas. E-tiket akan diterbitkan otomatis jika pembayaran valid.<br><br>
                    <i>Mengarahkan kembali ke Riwayat Booking...</i>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* CSS Styling dipertahankan 100% tanpa diubah */
.page-header {
  background-color: #445566;
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
  opacity: 0.9;
}
.breadcrumb {
  margin-bottom: 1.5rem;
}
.back-link {
  color: var(--primary-green);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.back-link:hover {
  text-decoration: underline;
}
.grid-layout {
  grid-template-columns: 1fr;
  align-items: start;
}
@media (min-width: 900px) {
  .grid-layout {
    grid-template-columns: 1fr 1.8fr;
  }
}
.card-header-green {
  background-color: var(--primary-green);
  color: #fff;
  padding: 1rem 1.5rem;
  font-weight: 700;
  font-size: 1.1rem;
}
.card-header-gray {
  background-color: var(--bg-light);
  border-bottom: 1px solid var(--border-light);
  color: var(--text-main);
  padding: 1rem 1.5rem;
  font-weight: 700;
  font-size: 1.1rem;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
  font-size: 0.95rem;
}
.detail-label {
  color: var(--text-muted);
}
.detail-value {
  color: var(--text-main);
  font-weight: 600;
}
.text-green {
  color: var(--primary-green) !important;
}
.font-bold {
  font-weight: 700;
}
.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.1rem;
  color: var(--text-main);
  font-weight: 700;
}
.total-price {
  font-size: 1.5rem;
  color: var(--accent-orange);
}
.price-notice {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: block;
  text-align: right;
  margin-top: 0.25rem;
}
.divider {
  height: 1px;
  background-color: var(--border-light);
  margin: 1.5rem 0;
}
.margin-top-1 {
  margin-top: 1.5rem;
}
.method-options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.method-option {
  border: 1px solid var(--border-light);
  background: var(--bg-white);
  border-radius: var(--radius-sm);
  padding: 1.25rem;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  cursor: pointer;
}
.method-option input {
  margin-top: 0.35rem;
  accent-color: var(--primary-green);
}
.method-option.active {
  border-color: var(--primary-green);
  background: #f0fdf4;
}
.method-details strong {
  font-size: 0.95rem;
  color: var(--text-main);
  display: block;
}
.method-details p {
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.4;
  margin-top: 0.25rem;
}
.disabled-option {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--bg-light);
}
.bank-details-box {
  background: #f8f9fa;
  border: 1px solid var(--border-light);
  padding: 2rem;
  border-radius: var(--radius-md);
  text-align: center;
}
.bank-notice {
  font-size: 0.95rem;
  color: var(--text-main);
  margin-bottom: 1.5rem;
}
.bank-logo {
  height: 40px;
  object-fit: contain;
  margin-bottom: 1rem;
}
.account-number {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-main);
  letter-spacing: 0.05em;
  margin: 0.5rem 0;
}
.account-holder {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-muted);
}
.file-drop-area {
  border: 2px dashed var(--border-light);
  border-radius: var(--radius-md);
  padding: 3rem 1.5rem;
  text-align: center;
  background: var(--bg-light);
  transition: all 0.3s ease;
  cursor: pointer;
}
.file-drop-area:hover {
  border-color: var(--primary-green);
  background: #f0fdf4;
}
.file-input-hidden {
  display: none;
}
.file-drop-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
}
.file-icon {
  font-size: 3rem;
  color: var(--primary-green);
}
.section-heading {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 0.5rem;
}
.error-banner {
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #fce8e6;
  border: 1px solid #c5221f;
  color: #c5221f;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
}
.success-upload-state {
  padding: 3rem 1rem;
}
.success-checkmark {
  width: 5rem;
  height: 5rem;
  background: var(--primary-green);
  color: #fff;
  border-radius: 50%;
  font-size: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
}
.w-full {
  width: 100%;
}
</style>