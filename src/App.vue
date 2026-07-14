<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useDatabaseStore } from './stores/database'
import { computed, onMounted, ref } from 'vue'

const db = useDatabaseStore()
const router = useRouter()

// Auto-reset local storage if old Gede Pangrango data is detected
onMounted(() => {
  if (db.jalur.some(j => j.id === 'jalur-cibodas')) {
    localStorage.removeItem('em_jalur')
    localStorage.removeItem('em_bookings')
    localStorage.removeItem('em_pembayaran')
    localStorage.removeItem('em_tiket')
    localStorage.removeItem('em_kuota_harian')
    localStorage.removeItem('em_users')
    localStorage.removeItem('em_current_user')
    window.location.reload()
  } else if (db.users.some(u => u.nama === 'Bima')) {
    // Force reload if old Bima user is found
    localStorage.removeItem('em_users')
    localStorage.removeItem('em_current_user')
    window.location.reload()
  }
})

const user = computed(() => db.currentUser)

// Notification logic
const isNotifOpen = ref(false)
const mobileMenuOpen = ref(false)

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

// Close mobile menu on route change
router.afterEach(() => {
  mobileMenuOpen.value = false
})

const myNotifications = computed(() => {
  if (!user.value) return []
  return db.notifikasi
    .filter(n => n.user_id === user.value?.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
})
const unreadCount = computed(() => myNotifications.value.filter(n => n.status_terkirim).length)

const toggleNotif = () => {
  isNotifOpen.value = !isNotifOpen.value
  if (isNotifOpen.value) {
    // Mark as read when opened
    myNotifications.value.forEach(n => {
      n.status_terkirim = false
    })
    db.saveAll()
  }
}

const handleLogout = () => {
  db.logout()
  router.push({ name: 'landing' })
}
</script>

<template>
  <div class="app-wrapper">
    
    <!-- Top Header Logo Area -->
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

    <!-- Main Navigation Bar -->
    <header class="main-navbar">
      <div class="container navbar-inner">
        
        <!-- Mobile Menu Toggle Button (Visible only on small screens) -->
        <button class="mobile-toggle" @click="toggleMobileMenu">
          <i :class="mobileMenuOpen ? 'ph-bold ph-x' : 'ph-bold ph-list'"></i>
        </button>

        <nav class="nav-links" :class="{ 'nav-active': mobileMenuOpen }">
          <!-- Navbar untuk Pengunjung Belum Login (Guest) -->
          <template v-if="!user">
            <RouterLink to="/" class="nav-link">BERANDA</RouterLink>
            <RouterLink :to="{ path: '/', hash: '#destinasi' }" class="nav-link">DESTINASI WISATA</RouterLink>
            <RouterLink :to="{ path: '/', hash: '#panduan' }" class="nav-link">PANDUAN BOOKING</RouterLink>
            <RouterLink to="/cek-kuota" class="nav-link">CEK KUOTA</RouterLink>
            <RouterLink :to="{ path: '/', hash: '#berita' }" class="nav-link">BERITA</RouterLink>
            <RouterLink :to="{ path: '/', hash: '#sop' }" class="nav-link">S O P</RouterLink>
          </template>

          <!-- Navbar untuk Admin -->
          <template v-else-if="user.role === 'admin'">
            <RouterLink to="/admin/dashboard" class="nav-link">DASHBOARD</RouterLink>
            <RouterLink to="/admin/verifikasi" class="nav-link">VERIFIKASI</RouterLink>
            <RouterLink to="/admin/checkin" class="nav-link">CHECK-IN</RouterLink>
            <RouterLink to="/admin/jalur" class="nav-link">JALUR</RouterLink>
            <RouterLink to="/admin/kuota" class="nav-link">KUOTA</RouterLink>
            <RouterLink to="/admin/laporan" class="nav-link">LAPORAN</RouterLink>
          </template>

          <!-- Navbar untuk Pendaki (Climber) -->
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
            <!-- Notification Bell -->
            <div class="notif-wrapper">
              <button @click="toggleNotif" class="notif-btn">
                <i class="ph-fill ph-bell"></i>
                <span v-if="unreadCount > 0" class="notif-badge">{{ unreadCount }}</span>
              </button>
              
              <!-- Dropdown -->
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

    <!-- Main Content -->
    <main class="main-content animate-fade-in">
      <RouterView />
    </main>

    <!-- Footer -->
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
.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

/* Top Header */
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

/* Notifications */
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

/* Mobile Responsiveness Overrides */
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

/* Footer */
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
