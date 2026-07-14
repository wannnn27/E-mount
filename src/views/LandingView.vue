<script setup lang="ts">
import { useDatabaseStore } from '../stores/database'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const db = useDatabaseStore()
const router = useRouter()

const allJalur = computed(() => db.jalur)

const navigateToBooking = (jalurId: string) => {
  router.push({ name: 'booking', params: { jalurId: jalurId } })
}

const getRouteQuota = (jalurId: string) => {
  const today = new Date().toISOString().slice(0, 10)
  return db.getKuotaHarian(jalurId, today)
}
</script>

<template>
  <div class="landing-page animate-fade-in">
    <!-- Hero Banner Section -->
    <section class="hero-banner">
      <div class="hero-overlay">
        <h3 class="hero-subtitle">SELAMAT DATANG DI</h3>
        <h1 class="hero-title">BOOKING ONLINE PENDAKIAN GUNUNG SLAMET</h1>
        <button class="btn btn-outline hero-btn">BOOKING NOW</button>
      </div>

      <!-- Search Bar Overlay at Bottom -->
      <div class="search-overlay">
        <div class="container search-inner">
          <div class="search-title">
            <i class="ph-bold ph-check-circle" style="color: #f5952c; font-size: 1.5rem;"></i>
            <span>Temukan Wisata Favorit Anda</span>
          </div>
          <div class="search-input-group">
            <input type="text" placeholder="Cari Destinasi Wisata" class="form-control" style="border-radius: var(--radius-sm); border: none;" />
            <button class="btn btn-orange" @click="alert('Fitur pencarian destinasi wisata sedang dalam tahap pengembangan.')">CARI WISATA</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Destinasi Wisata -->
    <section id="destinasi" class="destinasi-section container">
      <h2 class="section-title text-center">DESTINASI WISATA</h2>
      <h3 class="section-subtitle">Pendakian Gunung</h3>

      <div class="grid grid-3">
        <div v-for="j in allJalur" :key="j.id" class="card-tngm">
          <!-- We use a placeholder since we don't have actual images in assets -->
          <img :src="'https://images.unsplash.com/photo-1549880338-65dd4bd82f8b?q=80&w=800&auto=format&fit=crop'" alt="Jalur Pendakian">
          
          <div class="card-tngm-body">
            <h4 class="card-tngm-title">{{ j.nama_jalur }}</h4>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">
              Sisa Kuota: <strong>{{ getRouteQuota(j.id).kuota_total - getRouteQuota(j.id).kuota_terpakai }}</strong> 
              <span v-if="j.status_jalur === 'Tutup'" class="badge badge-danger">Tutup</span>
            </div>
            
            <div class="card-tngm-footer">
              <button 
                class="btn btn-orange" 
                style="padding: 0.35rem 1rem; font-size: 0.8rem;"
                :disabled="j.status_jalur === 'Tutup'"
                @click="navigateToBooking(j.id)">
                Lihat Detail
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="text-center" style="margin-top: 2rem;">
        <button class="btn btn-outline" style="border-color: var(--text-main); color: var(--text-main); border-radius: 0;" @click="alert('Fitur memuat lebih banyak destinasi wisata belum tersedia saat ini.')">LEBIH BANYAK</button>
      </div>
    </section>

    <!-- Panduan Booking -->
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

    <!-- Seputar Gunung -->
    <section id="berita" class="berita-section container">
      <h2 class="section-title text-center">SEPUTAR GUNUNG SLAMET</h2>

      <div class="grid grid-3">
        
        <div class="card-tngm">
          <img src="https://images.unsplash.com/photo-1516766487140-5e36eb100806?q=80&w=800&auto=format&fit=crop" alt="Aksi Sampah">
          <div class="card-tngm-body">
            <h4 class="card-tngm-title">Aksi Nol Sampah Pendakian Slamet</h4>
            <div class="card-tngm-footer">
              <button class="btn btn-orange" style="padding: 0.35rem 1rem; font-size: 0.8rem;" @click="alert('Fitur detail berita sedang dalam tahap pengembangan.')">Lihat Detail</button>
            </div>
          </div>
        </div>

        <div class="card-tngm">
          <img src="https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800&auto=format&fit=crop" alt="Flora">
          <div class="card-tngm-body">
            <h4 class="card-tngm-title">Komposisi Flora di Resor Bambangan</h4>
            <div class="card-tngm-footer">
              <button class="btn btn-orange" style="padding: 0.35rem 1rem; font-size: 0.8rem;" @click="alert('Fitur detail berita sedang dalam tahap pengembangan.')">Lihat Detail</button>
            </div>
          </div>
        </div>

        <div class="card-tngm">
          <img src="https://images.unsplash.com/photo-1519331379826-f10be5486c6f?q=80&w=800&auto=format&fit=crop" alt="Rimba">
          <div class="card-tngm-body">
            <h4 class="card-tngm-title">Nagara Rimba Nusa Versi Taman Nasional</h4>
            <div class="card-tngm-footer">
              <button class="btn btn-orange" style="padding: 0.35rem 1rem; font-size: 0.8rem;" @click="alert('Fitur detail berita sedang dalam tahap pengembangan.')">Lihat Detail</button>
            </div>
          </div>
        </div>

      </div>

      <div class="text-center" style="margin-top: 2rem;">
        <button class="btn btn-outline" style="border-color: var(--text-main); color: var(--text-main); border-radius: 0;" @click="alert('Fitur memuat lebih banyak berita belum tersedia saat ini.')">LEBIH BANYAK</button>
      </div>
    </section>

    <!-- S.O.P Section -->
    <section id="sop" class="container" style="padding-top: 2rem; padding-bottom: 4rem;">
      <h2 class="section-title text-center">S.O.P PENDAKIAN</h2>
      <div class="card-tngm" style="padding: 2rem; margin-top: 2rem; background: var(--bg-light);">
        <ul style="padding-left: 1.5rem; line-height: 1.8; color: var(--text-main);">
          <li>Wajib membawa identitas diri asli (KTP/SIM/Paspor) yang sesuai dengan data booking.</li>
          <li>Setiap pendaki wajib membawa perlengkapan standar keselamatan (Jaket tebal, jas hujan, P3K, tenda layak pakai).</li>
          <li>Dilarang keras membawa tisu basah, botol air minum kemasan sekali pakai, dan benda tajam terlarang.</li>
          <li>Dilarang membuat api unggun di sepanjang jalur pendakian dan puncak.</li>
          <li>Semua pendaki wajib melapor di pos jaga sebelum pendakian (Check-in) dan sesudah turun (Check-out).</li>
        </ul>
      </div>
    </section>

  </div>
</template>

<style scoped>
.landing-page {
  /* Offset removed */
}

/* Hero Banner */
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
  border-radius: 0; /* Square button as per image */
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

/* Sections */
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
</style>
