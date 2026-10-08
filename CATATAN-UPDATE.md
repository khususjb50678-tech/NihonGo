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

---

## Update terbaru: User Monitoring + Hasil Akun + Tes Hiragana 46

**Wajib dilakukan setelah upload update ini:**
1. Pastikan `supabase-accounts.sql` sudah pernah dijalankan untuk keamanan Admin.
2. Jalankan `supabase-user-monitor.sql` **sekali** di Supabase → SQL Editor → Run.
3. Upload semua file website terbaru.

### User di Admin Panel
- Menu **Hasil** diganti menjadi **User**.
- Daftar user otomatis diperbarui berkala.
- Menampilkan online/offline berdasarkan heartbeat website.
- Nama, email, waktu daftar, login terakhir, total login, device terakhir, halaman terakhir, jumlah hasil.
- Ada notifikasi visual untuk user baru saat Admin Panel sedang terbuka.
- Klik user untuk melihat detail lengkap: riwayat login/logout, aktivitas, device, hasil latihan, dan Tes Hiragana.
- Admin dapat menonaktifkan/mengaktifkan akun atau menghapus akun.
- Tidak mengumpulkan IP atau lokasi.

### Akun user
- Halaman **Akun** sekarang menampilkan semua hasil latihan milik akun tersebut.
- Hasil latihan lama yang bisa dicocokkan dengan satu nama user akan otomatis ditautkan oleh SQL.
- Setiap hasil baru ditautkan dengan `user_id`, sehingga nama yang sama tidak mencampur hasil.
- Klik hasil untuk melihat review jawaban.

### Tes Hiragana
- Dari halaman Kana tersedia **Tes 46 Hiragana**.
- Tepat 46 huruf dasar: あ〜ん, tanpa dakuten/handakuten/kombinasi.
- Setiap huruf muncul tepat satu kali dalam satu sesi.
- Soal campuran: Hiragana → Romaji dan Romaji → Hiragana.
- Hasil tersimpan di akun user dan dapat dilihat user maupun Admin.

---

## Update: arti Bahasa Indonesia + kartu kosakata beranimasi
- Perbaikan bug kamus offline (kata "I" tidak ketemu karena beda huruf besar/kecil) dan ditambah kamus Indonesia bawaan Bab 1 (tanpa internet).
- Test Kotoba tidak lagi memunculkan soal/pilihan tanpa arti Indonesia.
- Kartu kosakata & kartu Bab kini punya cahaya merah-biru yang berputar dan goyang seirama, sama seperti Kanji/Hiragana.
- Label Inggris (Password, Login, Edit) diganti Bahasa Indonesia.
- Kamus Indonesia per bab ada di `vocab-id.js` (sudah: Bab 1-5). Bab lain masih memakai terjemahan online sampai kamusnya ditambah.
- Bab dibatasi 1-25 (Bab 26-50 dihapus dari tampilan). Kosakata mengikuti buku (urutan & arti) di `vocab-book.js`: sudah Bab 1-25. Admin > Kosakata untuk ubah/sembunyikan/tambah kata (jalankan supabase-kosakata.sql sekali). Bab lain sementara memakai data lama.
