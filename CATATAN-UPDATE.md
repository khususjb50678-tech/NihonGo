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
