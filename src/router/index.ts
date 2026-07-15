import { createRouter, createWebHistory } from 'vue-router'
// 1. Mengimpor client Supabase terpusat Anda
import { supabase } from '../lib/supabase' 

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth',
      }
    }
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'landing',
      component: () => import('../views/LandingView.vue')
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue')
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue')
    },
    {
      path: '/cek-kuota',
      name: 'cek-kuota',
      component: () => import('../views/CekKuotaView.vue')
    },
    {
      path: '/booking/:jalurId',
      name: 'booking',
      component: () => import('../views/BookingView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/payment/:bookingId',
      name: 'payment',
      component: () => import('../views/PaymentView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/tiket/:bookingId',
      name: 'tiket',
      component: () => import('../views/TicketView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/riwayat',
      name: 'riwayat',
      component: () => import('../views/HistoryView.vue'),
      meta: { requiresAuth: true }
    },
    // Admin Routes
    {
      path: '/admin/dashboard',
      name: 'admin-dashboard',
      component: () => import('../views/admin/DashboardView.vue'),
      meta: { requiresAdmin: true }
    },
    {
      path: '/admin/kuota',
      name: 'admin-kuota',
      component: () => import('../views/admin/KuotaView.vue'),
      meta: { requiresAdmin: true }
    },
    {
      path: '/admin/verifikasi',
      name: 'admin-verifikasi',
      component: () => import('../views/admin/VerifikasiView.vue'),
      meta: { requiresAdmin: true }
    },
    {
      path: '/admin/checkin',
      name: 'admin-checkin',
      component: () => import('../views/admin/CheckinView.vue'),
      meta: { requiresAdmin: true }
    },
    {
      path: '/admin/jalur',
      name: 'admin-jalur',
      component: () => import('../views/admin/JalurView.vue'),
      meta: { requiresAdmin: true }
    },
    {
      path: '/admin/laporan',
      name: 'admin-laporan',
      component: () => import('../views/admin/LaporanView.vue'),
      meta: { requiresAdmin: true }
    }
  ]
})

// 2. Mengubah Guard menjadi Async untuk membaca status session riil Supabase
router.beforeEach(async (to, from, next) => {
  // Ambil data user aktif dari Supabase token JWT lokal
  const { data: { user } } = await supabase.auth.getUser()

  // Skenario A: Halaman membutuhkan hak akses khusus Pengelola/Admin
  if (to.meta.requiresAdmin) {
    if (!user) {
      return next({ name: 'login', query: { redirect: to.fullPath } })
    }

    // Mengambil profil role dinamis dari public.users (PRD Bab 2.2 & 6.1)
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const userRole = profile?.role || 'hiker'
    const allowedAdminRoles = ['admin', 'tenant_admin', 'super_admin']

    // Jika user terbukti bukan dari kelompok role admin, kembalikan ke riwayat pendaki
    if (!allowedAdminRoles.includes(userRole)) {
      return next({ name: 'riwayat' })
    }
    
    return next()
  } 
  
  // Skenario B: Halaman membutuhkan login pendaki biasa (Booking, Tiket, Riwayat)
  else if (to.meta.requiresAuth) {
    if (!user) {
      // Tendang kembali ke login screen jika kedapatan belum melangsungkan auth session
      return next({ name: 'login', query: { redirect: to.fullPath } })
    }
    return next()
  } 
  
  // Skenario C: Halaman Publik (Landing, Cek Kuota)
  else {
    next()
  }
})

export default router