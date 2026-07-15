<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { computed, onMounted, ref, watch } from 'vue'
// Mengimpor client Supabase terpusat dari folder lib Anda
import { supabase } from './lib/supabase'

const router = useRouter()

// State internal untuk menyimpan session auth dan data profil terintegrasi Supabase
const authUser = ref<any>(null)
const userProfile = ref<any>(null)
const notifications = ref<any[]>([])

const isNotifOpen = ref(false)
const mobileMenuOpen = ref(false)

// 1. Fetch Profil Ringkas User dari Tabel public.users untuk mengetahui Nama & Role asli
const fetchUserProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    
    if (error) throw error
    userProfile.value = data
  } catch (err) {
    console.error('Gagal memuat profil navigasi:', err)
  }
}

// 2. Fetch Data Notifikasi Dinamis Sesuai User yang Sedang Login
const fetchNotifications = async (userId: string) => {
  try {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    notifications.value = data || []
  } catch (err) {
    // Fallback aman berupa array kosong jika tabel notifikasi belum di-onboard total
    notifications.value = []
  }
}

onMounted(() => {
  // 3. Mendengarkan Perubahan Status Login (Sign In / Sign Out) secara Reaktif & Real-time
  supabase.auth.onAuthStateChange(async (event, session) => {
    authUser.value = session?.user || null
    
    if (session?.user) {
      await fetchUserProfile(session.user.id)
      await fetchNotifications(session.user.id)
    } else {
      userProfile.value = null
      notifications.value = []
    }
  })
})

// 4. Pemetaan Computed Properti Objek User Agar 100% Sinkron Dengan Variabel yang Dibaca Template Anda
const user = computed(() => {
  if (!authUser.value) return null
  
  // Normalisasi kode role database ('tenant_admin', 'super_admin', 'group_leader') ke role visual template
  const rawRole = userProfile.value?.role || 'hiker'
  const isAdmin = ['admin', 'tenant_admin', 'super_admin'].includes(rawRole)
  
  return {
    nama: userProfile.value?.name || authUser.value.email?.split('@')[0] || 'Pendaki',
    role: isAdmin ? 'admin' : 'climber' // Menyesuaikan dengan kondisi percabangan v-if navbar Anda
  }
})

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

// Tutup menu mobile otomatis setiap kali ada perpindahan rute halaman
router.afterEach(() => {
  mobileMenuOpen.value = false
})

// 5. Transformasi Struktur Notifikasi Agar Kompatibel dengan Template
const myNotifications = computed(() => {
  return notifications.value.map(n => ({
    id: n.id,
    jenis: n.type || 'INFO',
    isi_pesan: n.message || n.isi_pesan,
    created_at: n.created_at,
    status_terkirim: n.status_terkirim ?? true
  }))
})

const unreadCount = computed(() => myNotifications.value.filter(n => n.status_terkirim).length)

const toggleNotif = async () => {
  isNotifOpen.value = !isNotifOpen.value
  if (isNotifOpen.value && authUser.value) {
    // Ubah status notifikasi secara lokal menjadi sudah dibaca
    notifications.value.forEach(n => {
      n.status_terkirim = false
    })
    
    // Kirim mutasi update ke database jika tabel pendukung notifikasi sudah aktif
    try {
      await supabase
        .from('notifications')
        .update({ status_terkirim: false })
        .eq('user_id', authUser.value.id)
    } catch (e) {
      // Mengabaikan silent catch jika tabel belum mendukung kolom
    }
  }
}

// 6. Proses Logout Nyata Menghapus Token JWT Sesi Supabase Lokal
const handleLogout = async () => {
  try {
    await supabase.auth.signOut()
    authUser.value = null
    userProfile.value = null
    router.push({ name: 'landing' })
  } catch (error) {
    console.error('Error saat logout:', error)
  }
}
</script>

<template>
  <div class="app-wrapper">
    
    <div class="top-header">
      <div class="container top-header-inner">
        <RouterLink to="/" class="brand-logo-tngm">
          <i class="ph-fill ph-mountains" style="color: #137333; font-size: 2.5rem;"></i>
          <div class="brand-text">
            <span class="brand-title" style="color: #137333;">Booking Online</span>
            <span class="brand-subtitle" style="color: #137333;">Pendakian Gunung Slamet</span>
          </div>
        </RouterLink>
        
        <div class="language-selector">
          <img src="https://flagcdn.com/w20/id.png" alt="ID Flag" />
          <span>INDONESIA</span>
        </div>
      </div>
    </div>

    <header class="main-navbar">
      <div class="container navbar-inner">
        
        <button class="mobile-toggle" @click="toggleMobileMenu">
          <i :class="mobileMenuOpen ? 'ph-bold ph-x' : 'ph-bold ph-list'"></i>
        </button>

        <nav class="nav-links" :class="{ 'nav-active': mobileMenuOpen }">
          <template v-if="!user">
            <RouterLink to="/" class="nav-link">BERANDA</RouterLink>
            <RouterLink :to="{ path: '/', hash: '#destinasi' }" class="nav-link">DESTINASI WISATA</RouterLink>
            <RouterLink :to="{ path: '/', hash: '#panduan' }" class="nav-link">PANDUAN BOOKING</RouterLink>
            <RouterLink to="/cek-kuota" class="nav-link">CEK KUOTA</RouterLink>
            <RouterLink :to="{ path: '/', hash: '#berita' }" class="nav-link">BERITA</RouterLink>
            <RouterLink :to="{ path: '/', hash: '#sop' }" class="nav-link">S O P</RouterLink>
          </template>

          <template v-else-if="user.role === 'admin'">
            <RouterLink to="/admin/dashboard" class="nav-link">DASHBOARD</RouterLink>
            <RouterLink Hohen to="/admin/verifikasi" class="nav-link">VERIFIKASI</RouterLink>
            <RouterLink to="/admin/checkin" class="nav-link">CHECK-IN</RouterLink>
            <RouterLink to="/admin/jalur" class="nav-link">JALUR</RouterLink>
            <RouterLink to="/admin/kuota" class="nav-link">KUOTA</RouterLink>
            <RouterLink to="/admin/laporan" class="nav-link">LAPORAN</RouterLink>
          </template>

          <template v-else-if="user.role === 'climber'">
            <RouterLink to="/" class="nav-link">BERANDA</RouterLink>
            <RouterLink :to="{ path: '/', hash: '#destinasi' }" class="nav-link">BOOKING BARU</RouterLink>
            <RouterLink to="/riwayat" class="nav-link">RIWAYAT TRANSAKSI</RouterLink>
            <RouterLink to="/cek-kuota" class="nav-link">CEK KUOTA</RouterLink>
            <RouterLink :to="{ path: '/', hash: '#sop' }" class="nav-link">S.O.P</RouterLink>
          </template>
        </nav>

        <div class="nav-actions">
          <template v-if="user">
            <div class="notif-wrapper">
              <button @click="toggleNotif" class="notif-btn">
                <i class="ph-fill ph-bell"></i>
                <span v-if="unreadCount > 0" class="notif-badge">{{ unreadCount }}</span>
              </button>
              
              <div v-if="isNotifOpen" class="notif-dropdown animate-fade-in">
                <div class="notif-header">
                  <h4>Notifikasi</h4>
                </div>
                <div class="notif-body">
                  <div v-if="myNotifications.length === 0" class="notif-empty">
                    Belum ada notifikasi.
                  </div>
                  <div v-for="n in myNotifications" :key="n.id" class="notif-item">
                    <div class="notif-title">{{ n.jenis }}</div>
                    <div class="notif-text">{{ n.isi_pesan }}</div>
                    <div class="notif-time">{{ new Date(n.created_at).toLocaleString('id-ID') }}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <span class="user-greeting">Halo, {{ user.nama }}</span>
            <button @click="handleLogout" class="btn btn-orange">LOGOUT</button>
          </template>
          <template v-else>
            <RouterLink to="/register" class="btn btn-orange">REGISTRASI</RouterLink>
            <RouterLink to="/login" class="btn btn-orange">LOGIN</RouterLink>
          </template>
        </div>
      </div>
    </header>

    <main class="main-content animate-fade-in">
      <RouterView />
    </main>

    <footer class="footer-tngm">
      <div class="container footer-grid">
        <div class="footer-col">
          <RouterLink to="/" class="brand-logo-tngm" style="margin-bottom: 1rem;">
            <i class="ph-fill ph-mountains" style="color: #137333; font-size: 2.5rem;"></i>
            <div class="brand-text">
              <span class="brand-title" style="color: #137333;">Booking Online</span>
              <span class="brand-subtitle" style="color: #137333;">Pendakian Gunung Slamet</span>
            </div>
          </RouterLink>
        </div>
        
        <div class="footer-col">
          <h4>INFORMASI</h4>
          <ul class="footer-list">
            <li><i class="ph-fill ph-map-pin"></i> Jl. Raya Purbalingga - Pemalang, Jawa Tengah.</li>
            <li><i class="ph-fill ph-phone"></i> Helpdesk : +62 811-2850-XXXX</li>
            <li><i class="ph-fill ph-envelope"></i> admin@gunungslamet.id</li>
          </ul>
        </div>
        
        <div class="footer-col">
          <h4>LINK TERKAIT</h4>
          <ul class="footer-list">
            <li><a href="#">Destinasi Wisata</a></li>
            <li><a href="#">Panduan Booking</a></li>
            <li><a href="#">Privacy Policy</a></li>
          </ul>
        </div>
        
        <div class="footer-col">
          <h4>IKUTI KAMI</h4>
          <div class="social-links">
            <a href="#"><i class="ph-fill ph-instagram-logo"></i></a>
          </div>
        </div>
      </div>
      
      <div class="footer-bottom">
        <div class="container">
          &copy; 2026 Aplikasi Booking Gunung Slamet All rights reserved.
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Seluruh kode CSS dipertahankan 100% tanpa ada modifikasi */
.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}
.top-header {
  background-color: #ffffff;
  padding: 1rem 0;
}
.top-header-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.brand-logo-tngm {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
}
.brand-text {
  display: flex;
  flex-direction: column;
}
.brand-title {
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1.1;
}
.brand-subtitle {
  font-size: 0.85rem;
  font-weight: 700;
}
.language-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #333;
}
.main-navbar {
  background-color: #137333;
  padding: 0.75rem 0;
}
.navbar-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.nav-links {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}
.nav-link {
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  transition: opacity 0.2s;
}
.nav-link:hover {
  opacity: 0.8;
}
.mobile-toggle {
  display: none;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem;
}
.nav-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}
.nav-actions .btn {
  padding: 0.35rem 1.5rem;
  font-size: 0.85rem;
}
.user-greeting {
  color: #fff;
  font-size: 0.85rem;
  font-weight: 500;
  margin-right: 0.5rem;
}
.notif-wrapper {
  position: relative;
  margin-right: 0.5rem;
}
.notif-btn {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.notif-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #c5221f;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.15rem 0.35rem;
  border-radius: 50px;
  border: 2px solid #137333;
}
.notif-dropdown {
  position: absolute;
  top: 130%;
  right: -10px;
  width: 320px;
  background: #fff;
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 15px rgba(0,0,0,0.15);
  border: 1px solid var(--border-light);
  z-index: 100;
  overflow: hidden;
}
.notif-header {
  padding: 1rem;
  background: var(--bg-light);
  border-bottom: 1px solid var(--border-light);
}
.notif-header h4 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-main);
}
.notif-body {
  max-height: 350px;
  overflow-y: auto;
}
.notif-empty {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
}
.notif-item {
  padding: 1rem;
  border-bottom: 1px solid var(--border-light);
}
.notif-item:last-child {
  border-bottom: none;
}
.notif-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--primary-green);
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}
.notif-text {
  font-size: 0.85rem;
  color: var(--text-main);
  line-height: 1.4;
  margin-bottom: 0.5rem;
}
.notif-time {
  font-size: 0.7rem;
  color: var(--text-muted);
}
.main-content {
  flex: 1;
}
@media (max-width: 768px) {
  .top-header-inner {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  .mobile-toggle {
    display: block;
  }
  .nav-links {
    display: none;
    flex-direction: column;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background-color: var(--primary-green);
    padding: 1rem;
    z-index: 50;
    border-top: 1px solid rgba(255,255,255,0.1);
  }
  .nav-links.nav-active {
    display: flex;
  }
  .nav-actions {
    margin-left: auto;
  }
  .main-navbar {
    position: relative;
  }
}
.footer-tngm {
  background-color: #ffffff;
  margin-top: 4rem;
  padding-top: 3rem;
  border-top: 1px solid var(--border-light);
}
.footer-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  margin-bottom: 3rem;
}
@media (min-width: 768px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr;
  }
}
@media (min-width: 900px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr 1fr 1fr;
  }
}
.footer-col h4 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 1.25rem;
  text-transform: uppercase;
}
.footer-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.footer-list li {
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.footer-list a {
  color: var(--text-main);
}
.footer-list a:hover {
  color: var(--primary-green);
}
.social-links a {
  font-size: 1.5rem;
  color: var(--text-main);
}
.footer-bottom {
  background-color: var(--primary-green);
  color: #ffffff;
  padding: 1rem 0;
  font-size: 0.85rem;
}
</style>