# E-Mountainous 🏔️

**E-Mountainous** adalah platform web booking tiket pendakian gunung yang dirancang untuk membantu pengelola basecamp dalam mendigitalisasi proses reservasi, mengelola kuota pendaki secara real-time, dan memberikan informasi keselamatan (seperti estimasi cuaca) kepada pendaki.

## ✨ Fitur Utama

### 🧗 Untuk Pendaki (User)
- **Cek Kuota Real-time**: Memastikan ketersediaan kuota sebelum berangkat ke basecamp.
- **Booking Tiket Online**: Reservasi jadwal pendakian dengan mudah dan aman.
- **Informasi Cuaca & Status Jalur**: Mengetahui kondisi cuaca dan keamanan jalur (buka/tutup) sebelum pendakian.
- **E-Tiket QR Code**: Bukti booking digital yang praktis dan bisa discan saat check-in di basecamp.

### 🛡️ Untuk Pengelola (Admin Basecamp)
- **Manajemen Kuota**: Mengatur batas jumlah pendaki harian untuk mencegah over-kapasitas dan menjaga kelestarian alam.
- **Validasi Cepat**: Scan QR Code e-tiket pendaki saat kedatangan untuk proses check-in yang efisien.
- **Update Status Jalur**: Menutup jalur secara instan jika cuaca buruk atau terjadi keadaan darurat.
- **Dashboard Laporan**: Memantau statistik jumlah pendaki, pendapatan, dan riwayat transaksi.

---

## 🛠️ Tech Stack
Proyek ini dibangun menggunakan ekosistem modern untuk performa terbaik:
- **Frontend Framework**: Vue 3 + Vite
- **Bahasa Pemrograman**: TypeScript
- **Styling**: CSS / TailwindCSS

---

## 🚀 Panduan Instalasi & Penggunaan

### Prasyarat (Prerequisites)
Pastikan Anda telah menginstal perangkat lunak berikut di sistem Anda:
- [Node.js](https://nodejs.org/) (Versi 16 atau yang lebih baru direkomendasikan)
- Package Manager: `npm`, `yarn`, atau `pnpm`

### Langkah-langkah Instalasi

1. **Clone Repositori**
   Unduh kode sumber proyek ini ke komputer lokal Anda:
   ```bash
   git clone https://github.com/wannnn27/E-mount.git
   ```

2. **Masuk ke Direktori Proyek**
   ```bash
   cd E-mount
   ```

3. **Instal Dependensi**
   Unduh dan pasang semua library yang dibutuhkan oleh proyek:
   ```bash
   npm install
   ```

### Menjalankan Server Pengembangan (Development)
Untuk menjalankan aplikasi dalam mode pengembangan dengan fitur *Hot-Module Replacement* (HMR):
```bash
npm run dev
```
Setelah server berjalan, buka browser dan akses aplikasi melalui `http://localhost:5173` (atau port lain yang tertera di terminal).

### Build & Produksi
Untuk mengkompilasi, mengecek tipe data, dan me-minify kode aplikasi agar siap di-deploy ke server produksi:
```bash
npm run build
```
File hasil kompilasi akan otomatis dibuat di dalam folder `dist/`.

### Linting & Perbaikan Kode
Untuk mengecek kualitas kode dan memperbaiki isu _formatting_ secara otomatis menggunakan ESLint:
```bash
npm run lint
```

---

## 📞 Dukungan & Kontribusi
Proyek ini merupakan purwarupa (prototype) untuk mendigitalisasi proses pendakian gunung.
Jika Anda menemukan _bug_ atau ingin berkontribusi menambahkan fitur baru, jangan ragu untuk membuat *Pull Request* atau melaporkannya di tab *Issues* pada repositori GitHub ini.

Selamat menggunakan E-Mountainous, dan selalu utamakan keselamatan saat mendaki! 🏕️
