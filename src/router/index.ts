import { createRouter, createWebHistory } from 'vue-router'
import { useDatabaseStore } from '../stores/database'

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

// Authentication & Role Routing Guard
router.beforeEach((to, from, next) => {
  const db = useDatabaseStore()
  const user = db.currentUser

  if (to.meta.requiresAdmin) {
    if (!user || user.role !== 'admin') {
      next({ name: 'login', query: { redirect: to.fullPath } })
    } else {
      next()
    }
  } else if (to.meta.requiresAuth) {
    if (!user) {
      next({ name: 'login', query: { redirect: to.fullPath } })
    } else {
      next()
    }
  } else {
    next()
  }
})

export default router
