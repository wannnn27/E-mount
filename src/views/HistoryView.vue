<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTenant } from '../composables/useTenant'
// Mengimpor client Supabase terpusat Anda
import { supabase } from '../lib/supabase' 

const router = useRouter()
const { mountainId } = useTenant()

const currentUser = ref<any>(null)
const bookingsData = ref<any[]>([])
const isLoading = ref(true)

// Fungsi pembantu untuk memetakan status database (State Machine PRD) ke string visual dummy awal
const mapDBStatusToView = (dbStatus: string) => {
  switch (dbStatus) {
    case 'DRAFT':
    case 'WAITING_PAYMENT':
      return 'Menunggu Pembayaran'
    case 'PERMIT_REVIEW':
      return 'Menunggu Verifikasi'
    case 'PAID':
    case 'APPROVED':
    case 'CHECKED_IN':
    case 'CHECKED_OUT':
    case 'COMPLETED':
      return 'Lunas'
    case 'CANCELLED':
    case 'EXPIRED':
      return 'Dibatalkan'
    default:
      return 'Lunas'
  }
}

// 1. Mengambil data user yang sedang login via Supabase Auth
const fetchUserAndBookings = async () => {
  isLoading.value = true
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError
    
    if (user) {
      currentUser.value = user
      await fetchMyBookings(user.id)
    }
  } catch (error) {
    console.error('Gagal mengambil sesi user:', error)
  } finally {
    isLoading.value = false
  }
}

// 2. Fetch data booking dengan query join relasional (Trail, Payment, Member Count) 
// Serta diisolasi berdasarkan Tenant/Mountain ID sesuai aturan Multi-Tenant PRD Bab 3.1
const fetchMyBookings = async (userId: string) => {
  if (!mountainId.value) return
  
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        trails (name),
        payments (amount, status),
        booking_members (id)
      `)
      .eq('leader_id', userId)
      .eq('mountain_id', mountainId.value) // Isolasi data transaksi per gunung
      .order('created_at', { ascending: false })

    if (error) throw error
    bookingsData.value = data || []
  } catch (error) {
    console.error('Gagal memuat riwayat booking:', error)
  }
}

// 3. Transformasi struktur objek database agar kompatibel 100% dengan variabel dummy di template
const myBookings = computed(() => {
  return bookingsData.value.map(b => ({
    id: b.id,
    created_at: b.created_at,
    jalur_id: b.trail_id,
    // Format tanggal ke String lokal untuk dibaca langsung oleh template
    tanggal_naik: new Date(b.entry_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    jumlah_pendaki: b.booking_members ? b.booking_members.length : 0,
    status_booking: mapDBStatusToView(b.status),
    // Menyimpan data join internal untuk diakses fungsi pembantu di bawah
    _trailName: b.trails?.name,
    _paymentAmount: b.payments?.[0]?.amount || 0
  }))
})

// Fungsi pembantu pencarian data yang dipanggil oleh interpolasi template Anda
const getJalurName = (jalurId: string) => {
  const found = bookingsData.value.find(b => b.trail_id === jalurId)
  return found?.trails?.name || 'Jalur Tidak Dikenal'
}

const getPaymentAmount = (bookingId: string) => {
  const found = bookingsData.value.find(b => b.id === bookingId)
  return found?.payments?.[0]?.amount || 0
}

const formatRupiah = (val: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val)
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'Menunggu Pembayaran': return 'badge-warning'
    case 'Menunggu Verifikasi': return 'badge-warning'
    case 'Lunas': return 'badge-success'
    case 'Dibatalkan': return 'badge-danger'
    default: return 'badge-success'
  }
}

const navigateToPayment = (bookingId: string) => {
  router.push({ name: 'payment', params: { bookingId } })
}

const navigateToTicket = (bookingId: string) => {
  router.push({ name: 'tiket', params: { bookingId } })
}

// 4. Aksi Pembatalan Slot Booking Langsung Bermutasi ke Database (PRD Bab 9 - Mitigasi Kuota)
const handleCancel = async (bookingId: string) => {
  if (confirm('Apakah Anda yakin ingin membatalkan booking pendakian ini? Kuota akan dibebaskan kembali.')) {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'CANCELLED' })
        .eq('id', bookingId)

      if (error) throw error
      
      // Refresh data secara lokal agar status visual di dashboard langsung berubah menjadi "Dibatalkan"
      if (currentUser.value) {
        await fetchMyBookings(currentUser.value.id)
      }
    } catch (error) {
      alert('Gagal membatalkan booking. Silakan coba kembali.')
      console.error(error)
    }
  }
}

// Watcher untuk re-fetch otomatis data riwayat jika user berganti domain tenant gunung
watch(() => mountainId.value, () => {
  fetchUserAndBookings()
})

onMounted(() => {
  fetchUserAndBookings()
})
</script>

<template>
  <div class="history-page animate-fade-in">
    <div class="page-header">
      <h2>DASHBOARD PENDAKI</h2>
      <p>Beranda > Riwayat Booking</p>
    </div>

    <div class="container" style="max-width: 1000px; padding: 4rem 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h3 style="font-size: 1.5rem; font-weight: 600; color: var(--text-main);">Riwayat Transaksi & Tiket</h3>
        <RouterLink to="/" class="btn btn-green"><i class="ph-bold ph-plus"></i> Booking Baru</RouterLink>
      </div>

      <div v-if="myBookings.length === 0" class="card-tngm text-center" style="padding: 4rem 2rem;">
        <i class="ph-fill ph-ticket" style="font-size: 4rem; color: var(--border-light); margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">Belum Ada Transaksi</h3>
        <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Anda belum pernah melakukan booking pendakian.</p>
      </div>

      <div v-else class="grid">
        <div v-for="b in myBookings" :key="b.id" class="card-tngm list-card">
          <div class="list-card-header">
            <div>
              <div class="booking-id">KODE BOOKING: <strong>{{ b.id }}</strong></div>
              <div class="booking-date">Dibuat pada {{ new Date(b.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) }}</div>
            </div>
            <span class="badge" :class="getStatusBadgeClass(b.status_booking)">
              {{ b.status_booking }}
            </span>
          </div>

          <div class="list-card-body">
            <div class="details">
              <h4 class="route-name">{{ getJalurName(b.jalur_id) }}</h4>
              <div class="specs grid grid-3">
                <div class="spec-item">
                  <i class="ph-fill ph-calendar-blank"></i>
                  <div>
                    <span class="spec-label">Tanggal Naik</span>
                    <span class="spec-value">{{ b.tanggal_naik }}</span>
                  </div>
                </div>
                <div class="spec-item">
                  <i class="ph-fill ph-users"></i>
                  <div>
                    <span class="spec-label">Rombongan</span>
                    <span class="spec-value">{{ b.jumlah_pendaki }} Orang</span>
                  </div>
                </div>
                <div class="spec-item">
                  <i class="ph-fill ph-money"></i>
                  <div>
                    <span class="spec-label">Total Biaya</span>
                    <span class="spec-value" style="color: var(--primary-green);">{{ formatRupiah(getPaymentAmount(b.id)) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="actions">
              <template v-if="b.status_booking === 'Menunggu Pembayaran'">
                <button @click="navigateToPayment(b.id)" class="btn btn-green btn-block">Bayar Sekarang</button>
                <button @click="handleCancel(b.id)" class="btn btn-outline btn-block" style="border-color: #c5221f; color: #c5221f; margin-top: 0.5rem;">Batalkan</button>
              </template>

              <template v-else-if="b.status_booking === 'Menunggu Verifikasi'">
                <div class="notice-box">Sedang diverifikasi petugas.</div>
              </template>

              <template v-else-if="b.status_booking === 'Lunas'">
                <button @click="navigateToTicket(b.id)" class="btn btn-green btn-block">Lihat E-Tiket</button>
              </template>

              <template v-else-if="b.status_booking === 'Dibatalkan'">
                <div class="notice-box" style="background: #fce8e6; color: #c5221f;">Booking Dibatalkan</div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  background-color: #445566;
  color: #fff;
  padding: 4rem 1rem;
  text-align: center;
}
.page-header h2 {
  font-size: 2.5rem;
  font-weight: 400;
  margin-bottom: 0.5rem;
}
.page-header p {
  font-size: 1rem;
}
.list-card {
  display: block;
}
.list-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
  background-color: var(--bg-light);
}
.booking-id {
  font-size: 0.85rem;
  color: var(--text-muted);
}
.booking-id strong {
  color: var(--primary-green);
}
.booking-date {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.15rem;
}
.list-card-body {
  padding: 1.5rem;
  display: grid;
  gap: 1.5rem;
}
@media (min-width: 768px) {
  .list-card-body {
    grid-template-columns: 3fr 1fr;
    align-items: center;
  }
}
.route-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 1rem;
}
.spec-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.spec-item i {
  font-size: 1.25rem;
  color: var(--border-light);
  margin-top: 0.1rem;
}
.spec-label {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
}
.spec-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-main);
}
.actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.btn-block {
  width: 100%;
}
.notice-box {
  font-size: 0.85rem;
  color: var(--text-muted);
  background: var(--bg-light);
  border: 1px solid var(--border-light);
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  text-align: center;
  font-weight: 600;
}
</style>