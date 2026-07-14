import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface User {
  id: string
  nama: string
  email: string
  no_hp: string
  password_hash: string
  role: 'climber' | 'admin' | 'superadmin'
  created_at: string
}

export interface Jalur {
  id: string
  nama_jalur: string
  deskripsi: string
  kuota_harian_default: number
  status_jalur: 'Buka' | 'Waspada' | 'Tutup'
  latitude: number
  longitude: number
}

export interface KuotaHarian {
  id: string
  jalur_id: string
  tanggal: string // YYYY-MM-DD
  kuota_total: number
  kuota_terpakai: number
}

export interface Booking {
  id: string
  user_id: string
  jalur_id: string
  tanggal_naik: string // YYYY-MM-DD
  jumlah_pendaki: number
  nama_pemimpin: string
  no_hp_pemimpin: string
  nik_pemimpin: string
  kontak_darurat: string
  anggota: string[] // List of member names
  status_booking: 'Menunggu Pembayaran' | 'Menunggu Verifikasi' | 'Lunas' | 'Dibatalkan'
  created_at: string
}

export interface Pembayaran {
  id: string
  booking_id: string
  metode: string
  jumlah: number
  bukti_transfer_url: string | null
  status_verifikasi: 'Pending' | 'Disetujui' | 'Ditolak'
}

export interface Tiket {
  id: string
  booking_id: string
  kode_qr: string
  status_checkin: 'Belum Check-in' | 'Checked-in' | 'Checked-out'
  checkin_at: string | null
}

export interface CuacaLog {
  id: string
  jalur_id: string
  tanggal: string
  ringkasan_cuaca: 'Cerah' | 'Berawan' | 'Hujan Ringan' | 'Hujan Lebat' | 'Badai Angin'
  temp_c: number
  sumber_data: string
}

export interface Notifikasi {
  id: string
  user_id: string
  jenis: 'Notifikasi Jalur' | 'Pembayaran' | 'Tiket'
  isi_pesan: string
  status_terkirim: boolean
  created_at: string
}

// Initial mock datasets
const DEFAULT_JALUR: Jalur[] = [
  {
    id: 'jalur-bambangan',
    nama_jalur: 'Jalur Bambangan',
    deskripsi: 'Jalur pendakian paling ikonik dan teramai di Purbalingga. Memiliki fasilitas basecamp terlengkap dengan medan yang cukup panjang namun landai di awal.',
    kuota_harian_default: 200,
    status_jalur: 'Buka',
    latitude: -7.2285,
    longitude: 109.2435
  },
  {
    id: 'jalur-guci',
    nama_jalur: 'Jalur Guci (Kompak)',
    deskripsi: 'Pendakian via Tegal yang populer karena berada di kawasan pemandian air panas Guci. Trek cukup terjal dan menantang sejak pos awal.',
    kuota_harian_default: 150,
    status_jalur: 'Buka',
    latitude: -7.1990,
    longitude: 109.1673
  },
  {
    id: 'jalur-dipajaya',
    nama_jalur: 'Jalur Dipajaya',
    deskripsi: 'Berada di Pemalang, menawarkan rute alternatif dengan pemandangan sabana yang indah, sering disebut jalur yang lebih sepi dan asri.',
    kuota_harian_default: 100,
    status_jalur: 'Waspada',
    latitude: -7.2155,
    longitude: 109.2553
  }
]

const DEFAULT_USERS: User[] = [
  {
    id: 'user-admin',
    nama: 'Pak Wahyu (Admin Basecamp)',
    email: 'admin@emountainous.id',
    no_hp: '081234567890',
    password_hash: 'admin123', // plaintext for simulation simplicity
    role: 'admin',
    created_at: new Date().toISOString()
  },
  {
    id: 'user-climber-1',
    nama: 'Adi Arwan Syah',
    email: 'adi@gmail.com',
    no_hp: '085712345678',
    password_hash: 'adi123',
    role: 'climber',
    created_at: new Date().toISOString()
  }
]

export const useDatabaseStore = defineStore('database', () => {
  // Load initial states from LocalStorage or use defaults
  const load = <T>(key: string, defaultValue: T): T => {
    const data = localStorage.getItem(`em_${key}`)
    return data ? JSON.parse(data) : defaultValue
  }

  const save = (key: string, data: any) => {
    localStorage.setItem(`em_${key}`, JSON.stringify(data))
  }

  // Reactive states
  const users = ref<User[]>(load('users', DEFAULT_USERS))
  const jalur = ref<Jalur[]>(load('jalur', DEFAULT_JALUR))
  const bookings = ref<Booking[]>(load('bookings', []))
  const pembayaran = ref<Pembayaran[]>(load('pembayaran', []))
  const tiket = ref<Tiket[]>(load('tiket', []))
  const kuotaHarian = ref<KuotaHarian[]>(load('kuota_harian', []))
  const notifikasi = ref<Notifikasi[]>(load('notifikasi', []))
  const currentUser = ref<User | null>(load('current_user', null))

  // Persistence helpers
  const saveAll = () => {
    save('users', users.value)
    save('jalur', jalur.value)
    save('bookings', bookings.value)
    save('pembayaran', pembayaran.value)
    save('tiket', tiket.value)
    save('kuota_harian', kuotaHarian.value)
    save('notifikasi', notifikasi.value)
    save('current_user', currentUser.value)
  }

  // Weather log simulator (generates cuaca on the fly based on path/date)
  const getCuaca = (jalurId: string, tanggal: string): CuacaLog => {
    // Generate deterministic weather summary based on date/route id string
    const seed = (tanggal + jalurId).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const options: CuacaLog['ringkasan_cuaca'][] = ['Cerah', 'Berawan', 'Hujan Ringan', 'Hujan Lebat', 'Badai Angin']
    const pathStatus = jalur.value.find(j => j.id === jalurId)?.status_jalur || 'Buka'
    
    let weatherIndex = seed % options.length
    if (pathStatus === 'Waspada') {
      weatherIndex = (seed % 3) + 2 // shift to Hujan Ringan, Hujan Lebat, or Badai Angin
    } else if (pathStatus === 'Tutup') {
      weatherIndex = 4 // Badai Angin
    }
    
    const ringkasan_cuaca = options[weatherIndex] || 'Cerah'
    const temp_c = 12 + (seed % 8) // typical mountain summit temperature (12 - 20 deg C)

    return {
      id: `cuaca-${jalurId}-${tanggal}`,
      jalur_id: jalurId,
      tanggal,
      ringkasan_cuaca,
      temp_c,
      sumber_data: 'BMKG Open Data'
    }
  }

  // Quota operations
  const getKuotaHarian = (jalurId: string, tanggal: string): KuotaHarian => {
    const route = jalur.value.find(j => j.id === jalurId)
    const defaultLimit = route ? route.kuota_harian_default : 100
    
    let entry = kuotaHarian.value.find(k => k.jalur_id === jalurId && k.tanggal === tanggal)
    if (!entry) {
      entry = {
        id: `kuota-${jalurId}-${tanggal}`,
        jalur_id: jalurId,
        tanggal,
        kuota_total: defaultLimit,
        kuota_terpakai: 0
      }
      kuotaHarian.value.push(entry)
      saveAll()
    }
    return entry
  }

  // Auth Operations
  const login = (email: string, passwordHash: string): boolean => {
    const user = users.value.find(u => u.email === email && u.password_hash === passwordHash)
    if (user) {
      currentUser.value = user
      saveAll()
      return true
    }
    return false
  }

  const register = (nama: string, email: string, no_hp: string, passwordHash: string): boolean => {
    if (users.value.some(u => u.email === email)) {
      return false
    }
    const newUser: User = {
      id: `user-${Date.now()}`,
      nama,
      email,
      no_hp,
      password_hash: passwordHash,
      role: 'climber',
      created_at: new Date().toISOString()
    }
    users.value.push(newUser)
    currentUser.value = newUser
    saveAll()
    return true
  }

  const logout = () => {
    currentUser.value = null
    saveAll()
  }

  // Booking Flow operations
  const createBooking = (
    jalurId: string,
    tanggal: string,
    jumlahPendaki: number,
    pemimpin: { nama: string; no_hp: string; nik: string; kontak_darurat: string },
    anggota: string[]
  ): { success: boolean; bookingId?: string; error?: string } => {
    if (!currentUser.value) return { success: false, error: 'User must be authenticated' }
    
    const route = jalur.value.find(j => j.id === jalurId)
    if (!route) return { success: false, error: 'Jalur not found' }
    if (route.status_jalur === 'Tutup') return { success: false, error: 'Jalur sedang ditutup demi keselamatan' }

    // Quota Atomic-safe operation check
    const kuota = getKuotaHarian(jalurId, tanggal)
    const available = kuota.kuota_total - kuota.kuota_terpakai
    
    if (jumlahPendaki > available) {
      return { 
        success: false, 
        error: `Kuota tidak mencukupi. Tersisa ${available} slot untuk tanggal tersebut.` 
      }
    }

    // Allocate quota
    kuota.kuota_terpakai += jumlahPendaki

    const bookingId = `book-${Date.now()}`
    const newBooking: Booking = {
      id: bookingId,
      user_id: currentUser.value.id,
      jalur_id: jalurId,
      tanggal_naik: tanggal,
      jumlah_pendaki: jumlahPendaki,
      nama_pemimpin: pemimpin.nama,
      no_hp_pemimpin: pemimpin.no_hp,
      nik_pemimpin: pemimpin.nik,
      kontak_darurat: pemimpin.kontak_darurat,
      anggota,
      status_booking: 'Menunggu Pembayaran',
      created_at: new Date().toISOString()
    }

    const pricePerPerson = 25000 // Rp 25.000,-
    const amount = jumlahPendaki * pricePerPerson

    const newPembayaran: Pembayaran = {
      id: `pay-${Date.now()}`,
      booking_id: bookingId,
      metode: 'Manual Bank Transfer',
      jumlah: amount,
      bukti_transfer_url: null,
      status_verifikasi: 'Pending'
    }

    bookings.value.push(newBooking)
    pembayaran.value.push(newPembayaran)
    saveAll()

    return { success: true, bookingId }
  }

  const cancelBooking = (bookingId: string) => {
    const booking = bookings.value.find(b => b.id === bookingId)
    if (!booking) return false

    // Return quota
    if (booking.status_booking !== 'Dibatalkan') {
      const kuota = getKuotaHarian(booking.jalur_id, booking.tanggal_naik)
      kuota.kuota_terpakai = Math.max(0, kuota.kuota_terpakai - booking.jumlah_pendaki)
      booking.status_booking = 'Dibatalkan'
      saveAll()
      return true
    }
    return false
  }

  // Payment proof simulation upload
  const uploadBuktiTransfer = (bookingId: string, dummyUrl: string) => {
    const pay = pembayaran.value.find(p => p.booking_id === bookingId)
    const booking = bookings.value.find(b => b.id === bookingId)
    if (pay && booking) {
      pay.bukti_transfer_url = dummyUrl
      booking.status_booking = 'Menunggu Verifikasi'
      saveAll()
      return true
    }
    return false
  }

  // Admin confirmation of payment
  const verifikasiPembayaran = (bookingId: string, approve: boolean) => {
    const pay = pembayaran.value.find(p => p.booking_id === bookingId)
    const booking = bookings.value.find(b => b.id === bookingId)
    
    if (pay && booking) {
      if (approve) {
        pay.status_verifikasi = 'Disetujui'
        booking.status_booking = 'Lunas'

        // Create Ticket automatically
        const tiketId = `tix-${Date.now()}`
        const newTiket: Tiket = {
          id: tiketId,
          booking_id: bookingId,
          kode_qr: `QR-${bookingId}`,
          status_checkin: 'Belum Check-in',
          checkin_at: null
        }
        tiket.value.push(newTiket)
        
        // Add Success Notification
        notifikasi.value.push({
          id: `notif-${Date.now()}`,
          user_id: booking.user_id,
          jenis: 'Tiket',
          isi_pesan: `Pembayaran booking ${bookingId} disetujui! E-tiket Anda telah diterbitkan.`,
          status_terkirim: true,
          created_at: new Date().toISOString()
        })
      } else {
        pay.status_verifikasi = 'Ditolak'
        // Refund/free quota back
        const kuota = getKuotaHarian(booking.jalur_id, booking.tanggal_naik)
        kuota.kuota_terpakai = Math.max(0, kuota.kuota_terpakai - booking.jumlah_pendaki)
        booking.status_booking = 'Dibatalkan'

        notifikasi.value.push({
          id: `notif-${Date.now()}`,
          user_id: booking.user_id,
          jenis: 'Pembayaran',
          isi_pesan: `Pembayaran booking ${bookingId} ditolak. Harap unggah ulang bukti transfer yang valid.`,
          status_terkirim: true,
          created_at: new Date().toISOString()
        })
      }
      saveAll()
      return true
    }
    return false
  }

  // QR Check-in process
  const checkinTiket = (kodeQr: string): { success: boolean; message: string } => {
    const ticketObj = tiket.value.find(t => t.kode_qr === kodeQr)
    if (!ticketObj) return { success: false, message: 'Tiket tidak ditemukan.' }
    
    if (ticketObj.status_checkin === 'Checked-in') {
      // Toggle to Checked-out or reject? Let's check them out!
      ticketObj.status_checkin = 'Checked-out'
      saveAll()
      return { success: true, message: 'Check-out berhasil! Pendaki telah keluar jalur pendakian.' }
    } else if (ticketObj.status_checkin === 'Checked-out') {
      return { success: false, message: 'Tiket ini sudah checked-out.' }
    }

    const booking = bookings.value.find(b => b.id === ticketObj.booking_id)
    if (!booking) return { success: false, message: 'Booking data mismatch.' }

    ticketObj.status_checkin = 'Checked-in'
    ticketObj.checkin_at = new Date().toISOString()
    saveAll()

    return { success: true, message: `Check-in berhasil untuk rombongan ${booking.nama_pemimpin} (${booking.jumlah_pendaki} orang).` }
  }

  // Admin route status updating with automated notification dispatch
  const updateJalurStatus = (jalurId: string, status: Jalur['status_jalur']) => {
    const route = jalur.value.find(j => j.id === jalurId)
    if (route) {
      route.status_jalur = status
      
      // If Tutup, find all bookings on or after today affected by this closure and dispatch notification
      if (status === 'Tutup') {
        const todayStr = new Date().toISOString().slice(0, 10)
        const affectedBookings = bookings.value.filter(
          b => b.jalur_id === jalurId && 
          b.tanggal_naik >= todayStr && 
          b.status_booking !== 'Dibatalkan'
        )

        affectedBookings.forEach(booking => {
          // Notify climber
          notifikasi.value.push({
            id: `notif-${Date.now()}-${booking.id}`,
            user_id: booking.user_id,
            jenis: 'Notifikasi Jalur',
            isi_pesan: `PENTING: Jalur ${route.nama_jalur} ditutup sementara untuk pendakian tanggal ${booking.tanggal_naik} karena alasan cuaca buruk / keselamatan. Booking Anda (${booking.id}) dibatalkan, silakan lakukan reschedule/refund.`,
            status_terkirim: true,
            created_at: new Date().toISOString()
          })

          // Cancel the booking and release quota
          cancelBooking(booking.id)
        })
      }
      saveAll()
      return true
    }
    return false
  }

  // Admin set custom daily quota override
  const updateKuotaHarian = (jalurId: string, tanggal: string, total: number) => {
    const kuota = getKuotaHarian(jalurId, tanggal)
    kuota.kuota_total = total
    saveAll()
    return true
  }

  return {
    users,
    jalur,
    bookings,
    pembayaran,
    tiket,
    kuotaHarian,
    notifikasi,
    currentUser,
    login,
    register,
    logout,
    getCuaca,
    getKuotaHarian,
    createBooking,
    cancelBooking,
    uploadBuktiTransfer,
    verifikasiPembayaran,
    checkinTiket,
    updateJalurStatus,
    updateKuotaHarian,
    saveAll
  }
})
