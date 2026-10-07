# Catatan update

1. Jalankan `supabase-update.sql` sekali di Supabase (SQL Editor). Kalau belum, Dashboard Admin menampilkan peringatan + SQL-nya.
2. Upload semua file ke GitHub seperti biasa (termasuk `manifest.webmanifest`, `sw.js`, dan `icon-*.png` untuk fitur install aplikasi).

## Yang baru
- **Part diatur Admin / User** (Admin → Part, atau buka Part → Pengaturan Soal & Timer).
  - Diatur Admin: admin menentukan jumlah soal + timer. User cukup isi nama.
  - Diatur User: user isi nama, jumlah soal, dan waktu sendiri (tanpa batas minimum; waktu kosong = tanpa timer).
- **Kana**: ketuk kartu → panel besar langsung terbuka (huruf, cara baca, animasi goresan besar). Ada tombol ‹ › untuk pindah huruf.
- **Kanji**: sama seperti Kana. Saat tambah/import Kanji ada pilihan "Buat animasi"; bisa dimatikan/dihidupkan lagi dari daftar.
- **Developer**: kolom "Cara download aplikasi" (Chrome → ⋮ → Install).
- Perbaikan: timer Part tidak lagi mulai ulang setiap menjawab, dan berhenti saat pindah halaman.

---

## Update: akun pengguna + layar loading

**Wajib dilakukan setelah upload (urut):**
1. Supabase → Authentication → Providers → Email → **matikan "Confirm email"** (supaya user langsung bisa masuk setelah daftar; email konfirmasi Supabase gratis sangat dibatasi).
2. Buka `supabase-accounts.sql`, **ganti email di LANGKAH 2 dengan email akun Admin kamu**, lalu jalankan di Supabase → SQL Editor → Run. (Kalau email salah, script berhenti sebelum mengunci apa pun.)
3. Upload semua file ke GitHub/Vercel.

**Yang baru**
- Semua user harus daftar (Nama, Email, Password) lalu masuk. Menu **Akun** berisi nama, email, dan tombol Keluar. Nama di form latihan otomatis terisi dari akun.
- Layar loading saat web dibuka: logo, nama web, dan animasi memuat (logo & nama diambil dari Branding).
- **Keamanan Admin:** sebelumnya semua akun yang login dianggap Admin. Sekarang hanya akun di tabel `admins` yang bisa membuka panel Admin dan mengubah data. Untuk menambah admin lain: Supabase → Table Editor → `admins` → tambah `user_id` akun tersebut.
- Lupa password: belum ada fitur sendiri; reset lewat Supabase → Authentication → Users.
