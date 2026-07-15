<script setup lang="ts">
import { computed, ref, onMounted, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import SkeletonCard from '../components/SkeletonCard.vue'
import { useTenant } from '../composables/useTenant'
// Mengimpor Supabase client yang sudah dikoneksikan ke .env
import { supabase } from '../lib/supabase' 

const router = useRouter()

// 1. Ambil data Tenant dinamis dari composable
const { mountainId, mountain, isLoading: isLoadingTenant, initTenant } = useTenant()
const mountainData = mountain

// 2. State Management untuk Data Jalur, Kuota & Berita API
const trails = ref<any[]>([])
const quotas = ref<any[]>([])
const newsList = ref<any[]>([]) // Menampung hasil GET API Berita

const isLoadingTrails = ref(true)
const isLoadingNews = ref(true) // Loading state khusus komponen berita
let quotaSubscription: any = null

// 3. Fungsi Fetch Data Jalur & Kuota Hari Ini dari Supabase
const fetchLandingData = async (mId: string) => {
  if (!mId) return
  isLoadingTrails.value = true
  try {
    const { data: trailsData, error: trailsErr } = await supabase
      .from('trails')
      .select('*')
      .eq('mountain_id', mId)

    if (trailsErr) throw trailsErr
    trails.value = trailsData || []

    const trailIds = trails.value.map(t => t.id)
    const today = new Date().toISOString().slice(0, 10)

    if (trailIds.length > 0) {
      const { data: quotasData, error: quotasErr } = await supabase
        .from('quotas')
        .select('*')
        .in('trail_id', trailIds)
        .eq('quota_date', today)

      if (quotasErr) throw quotasErr
      quotas.value = quotasData || []
    }
  } catch (error) {
    console.error('Error loading trails/quotas data:', error)
  } finally {
    isLoadingTrails.value = false
  }
}

// 4. Integrasi GET API Berita Indonesia Terkait Gunung & Alam (Dengan Auto-Fallback Aman)
const fetchNewsData = async () => {
  isLoadingNews.value = true
  try {
    const response = await fetch('https://api-berita-indonesia.vercel.app/cnn/nasional/')
    if (!response.ok) throw new Error('Koneksi API Gagal')
    
    const json = await response.json()
    
    if (json.success && json.data?.posts?.length > 0) {
      const allPosts = json.data.posts
      
      // Memfilter artikel yang mengandung kata kunci bertema gunung, pendakian, atau alam bebas
      const filtered = allPosts.filter((post: any) => {
        const titleLower = post.title?.toLowerCase() || ''
        const descLower = post.description?.toLowerCase() || ''
        return (
          titleLower.includes('gunung') || descLower.includes('gunung') ||
          titleLower.includes('pendaki') || descLower.includes('pendaki') ||
          titleLower.includes('wisata') || titleLower.includes('alam')
        )
      })

      // Gunakan hasil filter jika ada, jika kosong ambil berita nasional teratas agar tetap tampil
      const displayPosts = filtered.length > 0 ? filtered.slice(0, 3) : allPosts.slice(0, 3)

      newsList.value = displayPosts.map((post: any, index: number) => ({
        id: index,
        title: post.title,
        image: post.thumbnail || 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800&auto=format&fit=crop',
        link: post.link
      }))
    } else {
      throw new Error('Struktur data API kosong')
    }
  } catch (error) {
    console.warn('Gagal memuat GET API berita, beralih ke local fallback data:', error)
    
    // 🔥 DATA FALLBACK AMAN: Jika API Down / Kena CORS, Tampilkan Data Ini Agar Halaman Tidak Blank!
    newsList.value = [
      {
        id: 1,
        title: 'Peningkatan Aktivitas Vulkanik, Jalur Pendakian Gunung di Indonesia Diperketat',
        image: 'https://images.unsplash.com/photo-1659700387819-5f1734834dcc?q=80&w=1632&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        link: 'https://cnnindonesia.com'
      },
      {
        id: 2,
        title: 'Aksi Bersih Sampah Bersama Komunitas Pecinta Alam di Kawasan Pos Pendakian',
        image: 'https://images.unsplash.com/photo-1637304497628-c69e8684c11a?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        link: 'https://cnnindonesia.com'
      },
      {
        id: 3,
        title: 'Tips Aman Manajemen Logistik dan Perlengkapan Pendakian di Musim Hujan Bagi Pemula',
        image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800&auto=format&fit=crop',
        link: 'https://cnnindonesia.com'
      }
    ]
  } finally {
    isLoadingNews.value = false // Matikan skeleton loading abu-abu
  }
}

// 5. Implementasi Supabase Realtime untuk Sinkronisasi Kuota Langsung
const setupRealtimeQuotas = () => {
  quotaSubscription = supabase
    .channel('public:quotas')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'quotas' }, (payload) => {
      const today = new Date().toISOString().slice(0, 10)
      if (payload.new && (payload.new as any).quota_date === today) {
        const index = quotas.value.findIndex(q => q.id === (payload.new as any).id)
        if (index !== -1) {
          quotas.value[index] = payload.new
        } else {
          quotas.value.push(payload.new)
        }
      }
    })
    .subscribe()
}

// Watcher untuk memicu pengambilan data saat domain/tenant berubah atau termuat
watch(() => mountainId.value, (newId) => {
  if (newId) {
    fetchLandingData(newId)
  }
}, { immediate: true })

onMounted(async () => {
  await initTenant()
  setupRealtimeQuotas()
  fetchNewsData() // Menjalankan GET API berita saat halaman dimuat
})

onUnmounted(() => {
  if (quotaSubscription) {
    supabase.removeChannel(quotaSubscription)
  }
})

// 6. Data Mapping untuk Keperluan UI Render
const allJalur = computed(() => {
  return trails.value.map(t => {
    let currentStatus = 'Buka'
    if (t.difficulty === 'Waspada' || t.difficulty === 'Waspada Cuaca') currentStatus = 'Waspada'
    else if (t.difficulty === 'Tutup' || t.difficulty === 'Closed') currentStatus = 'Tutup'

    return {
      id: t.id,
      nama_jalur: t.name,
      status_jalur: currentStatus
    }
  })
})

const getRouteQuota = (jalurId: string) => {
  const trail = trails.value.find(t => t.id === jalurId)
  const defaultMax = trail?.max_capacity || 100
  const found = quotas.value.find(q => q.trail_id === jalurId)
  return {
    kuota_total: found ? found.max_quota : defaultMax,
    kuota_terpakai: 0 
  }
}

const navigateToBooking = (jalurId: string) => {
  router.push({ name: 'booking', params: { jalurId: jalurId } })
}

// Fungsi membuka URL artikel asli berita di tab baru
const openNewsLink = (url: string) => {
  if (url) {
    window.open(url, '_blank')
  }
}

const showAlert = (msg: string) => {
  window.alert(msg)
}

// Mapping gambar fallback statis jalur pendakian
const trailImages: Record<string, string> = {
  'c0a80102-0000-0000-0000-000000000001': 'https://images.unsplash.com/photo-1695257529239-5998d979446e?q=80&w=1469&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', 
  'c0a80102-0000-0000-0000-000000000002': 'https://plus.unsplash.com/premium_photo-1730035378601-e4b6183f3398?q=80&w=1374&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', 
  'c0a80102-0000-0000-0000-000000000003': 'https://images.unsplash.com/photo-1518070588484-2b53926cba76?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'  
}
const DEFAULT_IMG = 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800&auto=format&fit=crop'
</script>

<template>
  <div class="landing-page animate-fade-in">
    <section class="hero-banner">
      <div class="hero-overlay">
        <h3 class="hero-subtitle">SELAMAT DATANG DI</h3>
        <h1 class="hero-title">BOOKING ONLINE PENDAKIAN {{ mountainData?.name?.toUpperCase() || 'GUNUNG' }}</h1>
        <button class="btn btn-outline hero-btn">BOOKING NOW</button>
      </div>

      <div class="search-overlay">
        <div class="container search-inner">
          <div class="search-title">
            <i class="ph-bold ph-check-circle" style="color: #f5952c; font-size: 1.5rem;"></i>
            <span>Temukan Wisata Favorit Anda</span>
          </div>
          <div class="search-input-group">
            <input type="text" placeholder="Cari Destinasi Wisata" class="form-control" style="border-radius: var(--radius-sm); border: none;" />
            <button class="btn btn-orange" @click="showAlert('Fitur pencarian destinasi wisata sedang dalam tahap pengembangan.')">CARI WISATA</button>
          </div>
        </div>
      </div>
    </section>

    <section id="destinasi" class="destinasi-section container">
      <h2 class="section-title text-center">DESTINASI WISATA</h2>
      <h3 class="section-subtitle">Pendakian Gunung</h3>

      <Transition name="fade-scale">
        <SkeletonCard v-if="isLoadingTrails || isLoadingTenant" :count="3" />
      </Transition>

      <Transition name="fade-scale">
        <div v-if="!isLoadingTrails && !isLoadingTenant" class="grid grid-3">
          <div
            v-for="j in allJalur"
            :key="j.id"
            class="card-tngm hover-lift"
          >
            <div class="card-img-wrapper">
              <img
                :src="trailImages[j.id] ?? DEFAULT_IMG"
                :alt="j.nama_jalur"
                loading="lazy"
              />
              <div class="card-img-status">
                <span v-if="j.status_jalur === 'Buka'" class="badge badge-success">
                  <i class="ph-fill ph-check-circle"></i> Buka
                </span>
                <span v-else-if="j.status_jalur === 'Waspada'" class="badge badge-warning">
                  <i class="ph-fill ph-warning-circle"></i> Waspada
                </span>
                <span v-else class="badge badge-danger">
                  <i class="ph-fill ph-prohibit"></i> Tutup
                </span>
              </div>
            </div>

            <div class="card-tngm-body">
              <h4 class="card-tngm-title">{{ j.nama_jalur }}</h4>

              <div class="quota-mini">
                <div class="quota-mini-bar">
                  <div
                    class="quota-mini-fill"
                    :style="{
                      width: `${((getRouteQuota(j.id).kuota_total - getRouteQuota(j.id).kuota_terpakai) / getRouteQuota(j.id).kuota_total) * 100}%`,
                      background: getRouteQuota(j.id).kuota_total - getRouteQuota(j.id).kuota_terpakai < 20 ? '#c5221f' : 'var(--primary-green)'
                    }"
                  ></div>
                </div>
                <span class="quota-mini-label">
                  Sisa <strong>{{ getRouteQuota(j.id).kuota_total - getRouteQuota(j.id).kuota_terpakai }}</strong> slot
                </span>
              </div>

              <div class="card-tngm-footer">
                <button
                  class="btn btn-orange"
                  style="padding: 0.45rem 1.1rem; font-size: 0.82rem; width: 100%;"
                  :disabled="j.status_jalur === 'Tutup'"
                  @click="navigateToBooking(j.id)"
                >
                  <i class="ph-bold ph-arrow-right"></i>
                  {{ j.status_jalur === 'Tutup' ? 'Jalur Ditutup' : 'Booking Sekarang' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <div class="text-center" style="margin-top: 2rem;">
        <button
          class="btn btn-outline"
          style="border-color: var(--text-main); color: var(--text-main); border-radius: 0;"
          @click="showAlert('Fitur memuat lebih banyak destinasi wisata belum tersedia saat ini.')"
        >LEBIH BANYAK</button>
      </div>
    </section>

    <section id="panduan" class="container" style="padding-top: 4rem; padding-bottom: 2rem;">
      <h2 class="section-title text-center">PANDUAN BOOKING</h2>
      <div class="grid grid-3" style="margin-top: 2rem;">
        <div class="card-tngm text-center" style="padding: 2rem;">
          <i class="ph-fill ph-user-circle" style="font-size: 3rem; color: var(--primary-green); margin-bottom: 1rem;"></i>
          <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">1. Registrasi Akun</h4>
          <p style="font-size: 0.9rem; color: var(--text-muted);">Buat akun pendaki dengan email aktif untuk memulai pendaftaran.</p>
        </div>
        <div class="card-tngm text-center" style="padding: 2rem;">
          <i class="ph-fill ph-file-text" style="font-size: 3rem; color: var(--primary-green); margin-bottom: 1rem;"></i>
          <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">2. Isi Form Booking</h4>
          <p style="font-size: 0.9rem; color: var(--text-muted);">Pilih jalur, tanggal, dan lengkapi data anggota rombongan dengan benar.</p>
        </div>
        <div class="card-tngm text-center" style="padding: 2rem;">
          <i class="ph-fill ph-money" style="font-size: 3rem; color: var(--primary-green); margin-bottom: 1rem;"></i>
          <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">3. Pembayaran</h4>
          <p style="font-size: 0.9rem; color: var(--text-muted);">Lakukan pembayaran dan tunggu verifikasi untuk mendapatkan E-Tiket QR Code.</p>
        </div>
      </div>
    </section>

    <section id="berita" class="berita-section container">
      <h2 class="section-title text-center">SEPUTAR {{ mountainData?.name?.toUpperCase() || 'GUNUNG' }}</h2>

      <Transition name="fade-scale">
        <SkeletonCard v-if="isLoadingNews" :count="3" />
      </Transition>

      <Transition name="fade-scale">
        <div v-if="!isLoadingNews" class="grid grid-3">
          <div v-for="n in newsList" :key="n.id" class="card-tngm">
            <img :src="n.image" :alt="n.title" style="height: 200px; object-fit: cover; width: 100%;">
            <div class="card-tngm-body" style="display: flex; flex-direction: column; justify-content: space-between; height: 180px;">
              <h4 class="card-tngm-title" style="font-size: 1rem; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                {{ n.title }}
              </h4>
              <div class="card-tngm-footer" style="margin-top: auto;">
                <button class="btn btn-orange" style="padding: 0.35rem 1rem; font-size: 0.82rem; width: 100%;" @click="openNewsLink(n.link)">
                  Lihat Detail
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <div class="text-center" style="margin-top: 2rem;">
        <button class="btn btn-outline" style="border-color: var(--text-main); color: var(--text-main); border-radius: 0;" @click="showAlert('Fitur memuat lebih banyak berita belum tersedia saat ini.')">LEBIH BANYAK</button>
      </div>
    </section>

    <section id="sop" class="container" style="padding-top: 2rem; padding-bottom: 4rem;">
      <h2 class="section-title text-center">S.O.P PENDAKIAN</h2>
      <div class="card-tngm" style="padding: 2rem; margin-top: 2rem; background: var(--bg-light);">
        <ul style="padding-left: 1.5rem; line-height: 1.8; color: var(--text-main);">
          <li>Wajib membawa identitas diri asli (KTP/SIM/Paspor) yang sesuai dengan data booking.</li>
          <li>Setiap pendaki wajib membawa perlengkapan standar keselamatan (Jaket tebal, jas hujan, P3K, tenda layak pakai).</li>
          <li>Dilarang keras membawa tisu basah, botol air minum kemasan sekali pakai, dan benda tajam terlarang.</li>
          <li>Dilarang membuat api umum di sepanjang jalur pendakian dan puncak.</li>
          <li>Semua pendaki wajib melapor di pos jaga sebelum pendakian (Check-in) dan sesudah turun (Check-out).</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Seluruh kode CSS bawaan dipertahankan 100% tanpa modifikasi */
.landing-page { }
.hero-banner {
  position: relative;
  background-image: url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2000&auto=format&fit=crop');
  background-size: cover;
  background-position: center;
  height: 550px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hero-overlay {
  text-align: center;
  color: #fff;
  z-index: 10;
}
.hero-subtitle {
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
  text-shadow: 1px 1px 4px rgba(0,0,0,0.5);
}
.hero-title {
  font-size: 2.25rem;
  font-weight: 400;
  margin-bottom: 2rem;
  text-shadow: 1px 1px 4px rgba(0,0,0,0.5);
  max-width: 800px;
  line-height: 1.2;
}
.hero-btn {
  padding: 0.5rem 2rem;
  font-size: 0.9rem;
  border-radius: 0;
}
.search-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: rgba(0, 0, 0, 0.7);
  padding: 1rem 0;
}
.search-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}
.search-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #fff;
  font-size: 1.25rem;
}
.search-input-group {
  display: flex;
  gap: 1rem;
  flex: 1;
  max-width: 600px;
}
.search-input-group .form-control {
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
}
.search-input-group .btn {
  border-radius: var(--radius-sm);
}
.destinasi-section {
  padding-top: 4rem;
  padding-bottom: 4rem;
}
.berita-section {
  padding-top: 2rem;
  padding-bottom: 4rem;
}
.section-title {
  font-size: 2rem;
  font-weight: 400;
  color: var(--text-main);
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}
.section-subtitle {
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--text-main);
  margin-bottom: 2rem;
}
.card-img-wrapper {
  position: relative;
  overflow: hidden;
}
.card-img-wrapper img {
  width: 100%;
  height: 220px;
  object-fit: cover;
  display: block;
}
.card-img-status {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
}
.quota-mini {
  margin-bottom: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.quota-mini-bar {
  height: 5px;
  background: #eee;
  border-radius: 99px;
  overflow: hidden;
}
.quota-mini-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.5s ease;
}
.quota-mini-label {
  font-size: 0.78rem;
  color: var(--text-muted);
}
</style>