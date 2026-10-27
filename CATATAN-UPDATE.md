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
- Admin > Soal: kartu "Impor Soal dari PDF" (file pdfsoal.js). PDF harus berisi teks. Bisa pilih halaman mana saja dari PDF. Kunci jawaban otomatis dibaca dari halaman KEY ANSWER bila ada, bisa diubah/diisi manual lalu Simpan.
- Part soal: soal diurutkan & dikelompokkan per halaman PDF dengan nomor sesuai PDF (jalankan supabase-soal-nomor.sql sekali). Tiap soal ada tombol Simpan Foto & Audio.
- Menu Soal: tiap soal punya Edit (soal, pilihan, jawaban, halaman, nomor) + Tambah Foto/Audio + Simpan.
- Soal: nomor per halaman (1,2,3 tiap halaman), deteksi & gabung soal ganda, impor PDF tanpa teks pengganti.
- Soal: nomor per halaman (1,2,3 tiap halaman), deteksi & gabung soal ganda, impor PDF tanpa teks pengganti.
- Part dikembalikan seperti semula. Menu Soal: tombol 'Cocokkan dengan PDF' mengisi halaman & nomor soal lama otomatis dan menggabung salinan ganda.
- Cocokkan PDF juga menyalin foto/audio dari soal sama di Part lain; pilihan Part di menu Soal diingat; latihan menyembunyikan teks pengganti lama.
- Beranda: tombol Mulai belajar dihapus; nama ITCO JAPAN dibingkai ring card + efek timbul 3D transparan; font deskripsi diperbagus.


## Jadwal Aktif/Nonaktif Part
Fitur jadwal Part menambahkan kolom `scheduled_start_at` dan `scheduled_end_at`. Jalankan file `supabase-part-schedule.sql` di Supabase SQL Editor satu kali sebelum memakai jadwal aktif/nonaktif. Pada menu Part, tombol status dapat memilih aktif langsung atau memakai jadwal tanggal dan jam mulai serta opsional waktu selesai. Di halaman Pilih Part tersedia hitung mundur hingga detik dan tombol Refresh Sekarang setelah jadwal mulai.

## Update Tes Hiragana & Katakana via Part 13–15
- Tombol tes Hiragana mengarah ke Part 13 pada halaman Latihan.
- Tombol tes Katakana mengarah ke Part 14 pada halaman Latihan.
- Tombol tes gabungan Hiragana + Katakana mengarah ke Part 15.
- File `supabase-kana-parts-13-15.sql` menambahkan 46 soal Hiragana di Part 13, 46 soal Katakana di Part 14, dan 92 soal gabungan di Part 15.
- Jalankan SQL tersebut satu kali di Supabase SQL Editor setelah deployment. Script menghindari duplikasi soal dengan prompt yang sama saat dijalankan ulang.

---
## Urutan SQL (jalankan di Supabase → SQL Editor, sekali saja per file)
File lama (supabase-accounts, user-monitor, update, kosakata, part-schedule, soal-nomor, kana-parts) cukup dijalankan kalau belum pernah.
File baru, jalankan hanya yang belum pernah:
1. supabase-app-name.sql        — nama & ikon aplikasi
2. supabase-kanji-part.sql      — Part Kanji + nama Part Kanji
3. supabase-result-settings.sql — pengaturan nilai
4. supabase-part-inactive-mode.sql — blur / dihilangkan saat Part nonaktif
5. supabase-custom-mode.sql     — Mode Custom
6. supabase-admin-roles.sql     — Admin Utama & Sensei (buat akun witamatama411@gmail.com dulu sebelum Run)
7. supabase-vocab-parts.sql      — Kosakata berbentuk Part (Admin → Part Kosakata)
8. supabase-guard-warning.sql   — pengaturan Peringatan Salin (foto, suara, teks)
9. supabase-fix-bunpou.sql      — memperbaiki error RLS saat menambah Kaiwa & Bunpou

## v55 — Soal PDF (Mirip Asli)
Menu admin baru: **Soal PDF (Mirip Asli)**.
1. Jalankan `supabase-lembar-pdf.sql` SEKALI di Supabase (SQL Editor).
2. Admin → Soal PDF (Mirip Asli) → pilih Part → upload PDF. Tiap halaman difoto dan dipotong per soal (nomor （１）（２）… dan judul bagian terdeteksi otomatis).
3. Admin memilih jawaban benar (A/B/C/D atau ○/×), bisa mengubah jumlah jawaban per soal (mis. ① ②), lalu Simpan.
4. Soal yang punya kode audio 【Y15-10】 mendapat tombol "Pilih audio dari HP". Di sisi user, ikon suara pada gambar soal bisa diketuk untuk memutar audio.
5. Di sisi user, halaman PDF tampil utuh dan digulir dari atas ke bawah; jawaban dipilih dengan mengetuk kotak jawaban di halaman (muncul pilihan A/B/C). Mode ini aktif bila SEMUA soal di Part berasal dari Soal PDF; kalau Part dicampur dengan soal biasa, tampilan kembali satu-satu. Nilai, timer, ragu-ragu, dan hasil memakai sistem Part yang sudah ada.
Jalankan ulang supabase-lembar-pdf.sql jika sudah pernah menjalankan versi sebelumnya (aman diulang). File baru: lembarpdf.js, supabase-lembar-pdf.sql. File diubah: admin.js, app.js, style.css.
Catatan: butuh internet untuk memuat pdf.js; PDF harus berisi teks (bukan scan).

## v55 — Kerjain Teman (khusus Admin Utama) + menu User untuk Sensei
1. Jalankan `supabase-kerjain-teman.sql` SEKALI di Supabase (SQL Editor). Butuh `supabase-admin-roles.sql` (fungsi is_owner) sudah pernah dijalankan.
2. Admin Utama: menu baru **Kerjain Teman 😈** → pilih target (semua / user tertentu, ada penanda online), isi teks/foto/video/suara dari HP, pilih gaya (popup, layar penuh, banner), atur batas waktu berlaku, lalu Pratinjau / Kirim. Riwayat kiriman bisa dihentikan atau dihapus.
3. Sisi user: kiriman muncul otomatis (dicek tiap ±6 detik) di halaman mana pun saat web terbuka. Selalu ada tombol ✕ (juga ESC); tidak ada label. Tiap kiriman hanya tampil sekali per user dan kedaluwarsa sesuai pengaturan.
4. Menu **User** sudah tampil untuk Sensei; menu Kerjain Teman tidak. Sidebar admin kini menampilkan "Panel v55 · Admin Utama/Sensei" untuk memastikan versi yang ter-deploy.
File baru: prank-client.js, kerjainteman.js, supabase-kerjain-teman.sql. Diubah: admin.js, user-monitor.js, style.css.

### Kerjain Teman: jumpscare layar penuh (update)
- Gaya baru **Jumpscare** (default): foto/video memenuhi seluruh layar (potong tepi), tanpa label, tanpa fade. Pilihan "gambar utuh" juga ada.
- Media diunduh dulu di belakang layar (maks ±3,5 detik), lalu foto + suara + video tampil bersamaan, jadi tidak ada layar kosong atau jeda.
- Sinyal instan lewat Realtime broadcast (kanal `itco-kerjain`); polling 4 detik tetap sebagai cadangan.
- Foto besar otomatis dikecilkan (maks 1920 px) saat dikirim supaya cepat terunduh. Tidak perlu SQL tambahan.

## v55 — Fitur Admin Tambahan, review hasil mirip tampilan user, dan password
1. Jalankan `supabase-akses-admin.sql` SEKALI di Supabase (SQL Editor). Butuh `supabase-admin-roles.sql` sudah pernah dijalankan.
2. Menu baru **Fitur Admin Tambahan** (khusus Admin Utama): centang menu apa saja yang boleh dibuka tiap admin tambahan (Sensei) — bisa "Pilih semua", "Hanya soal", "Kosongkan", atau "Terapkan ke semua Sensei". Tersimpan otomatis. Menu khusus Admin Utama (Branding, Tampilan Kolom, Pengaturan Nilai, Peringatan Salin, Tambah Admin, Kerjain Teman, dan halaman ini) tidak pernah bisa diberikan ke Sensei, dikunci di kode maupun di database.
3. Menu **User** → detail seorang user → **Hasil Latihan**: hasil dari soal PDF sekarang ditampilkan sama persis seperti yang dilihat user sendiri (halaman PDF dengan lingkaran hijau/merah menandai benar/salah, plus jawaban yang benar). Hasil latihan biasa (bukan soal PDF) tetap memakai daftar seperti sebelumnya. File baru `review-view.js` dipakai bersama oleh `app.js` dan `admin.js` supaya tampilannya selalu identik.
4. **Kata Sandi**: password user disimpan terenkripsi satu arah oleh Supabase Auth dan tidak bisa dilihat siapa pun (termasuk lewat database) — ini bukan batasan aplikasi, tapi cara kerja sistem keamanan. Sebagai gantinya, di detail user (khusus Admin Utama) ada tombol **"Kirim Link Reset Kata Sandi"** yang mengirim email reset resmi dari Supabase. Catatan: website belum punya halaman "buat kata sandi baru" setelah link diklik — kalau mau dilengkapi, perlu ditambahkan terpisah.
File baru: review-view.js, aksesadmin.js, menuaccess.js, supabase-akses-admin.sql. Diubah: admin.js, app.js, style.css.

## v55 — Tampilan hasil soal dirombak (rapi & bersih dari HTML bocor) + Penjelasan di Quick Soal
1. **Perbaikan besar:** detail hasil di menu User (admin) sebelumnya menampilkan teks mentah `<b><u><span style=...>` kalau soalnya ditempel dari Word/Google Docs. Sekarang dibersihkan otomatis (sama seperti tampilan user) dan ditata jadi kartu rapi (kotak hijau/merah per soal, bukan teks polos). Bug pembersih HTML ini sebenarnya ada di seluruh web (bukan cuma admin) untuk soal yang di-bold+garis bawah sekaligus — sudah diperbaiki, berlaku untuk semua hasil baru.
2. Hasil di admin & di halaman "Akun Saya" user sekarang punya: lingkaran nilai berwarna, tanggal, dan baris Benar/Salah/Kosong yang jelas (bukan cuma teks).
3. `review-view.js` sekarang jadi satu sumber tampilan review untuk semua tempat: halaman hasil user, modal "Akun Saya", dan detail User di admin — supaya selalu seragam.
4. Jalankan `supabase-penjelasan-soal.sql` SEKALI di Supabase (SQL Editor). Di **Quick Soal**, format baris sekarang: `Soal|Jawaban|Tipe|Pilihan1;Pilihan2|Penjelasan` — bagian Penjelasan opsional (boleh dikosongkan). Kalau diisi, penjelasan itu muncul dalam kotak biru di bawah jawaban, baik benar maupun salah, setelah user selesai mengerjakan (di halaman hasil, di "Akun Saya", dan di admin).
Catatan: fitur Penjelasan untuk sekarang hanya berlaku untuk soal biasa (termasuk Quick Soal), belum untuk Soal PDF (Mirip Asli).
File baru: supabase-penjelasan-soal.sql. Diubah: review-view.js, app.js, admin.js, style.css.

---

## Update v60: suara hasil + kartu hasil baru

1. Tidak perlu SQL baru. Upload semua file website terbaru (termasuk `sw.js`).
2. Kartu hasil di layar hanya menampilkan nama part, nama user, nilai, dan pengucapan. Foto (Simpan sebagai foto) menampilkan hasil lengkap: mulai, selesai, waktu penyelesaian, dan batas waktu (diatur Admin/User).
3. Admin → Pengaturan Nilai → **Suara Hasil**: nyala/mati, batas nilai bagus, keras suara (slider), pilihan suara bawaan, dan upload MP3 sendiri untuk nilai bagus dan buruk (disimpan di bucket `media`). Tekan **Simpan Pengaturan Nilai** setelah mengubah.
4. Emoji besar transparan per tingkat nilai: isi kolom "Emoji besar transparan di kartu foto" di tiap tingkat.
5. Impor soal PDF: kini juga mengenali format ujian Jepang (もんだい１… dengan pilihan dipisah spasi tanpa huruf a–d). Nomor soal berurutan per もんだい. Kunci jawaban diisi manual di pratinjau.
7. Soal PDF (Mirip Asli) mode manual: upload PDF → tiap halaman jadi gambar utuh. Admin menambah soal per halaman, menandai kotak jawaban dan ikon suara dengan ketuk gambar, lalu memilih jawaban benar (A–D, 1–4, A–C, atau A–B).
8. Soal PDF (Mirip Asli): admin bisa upload foto/gambar halaman soal (JPG/PNG, bisa banyak sekaligus) selain PDF. Foto dipakai sebagai halaman urut 1, 2, 3, dan seterusnya.
9. Test Kosakata: tombol "Mulai Test" sekarang langsung menjalankan tes (sebelumnya membuka pengaturan lagi).
10. Menu Kosakata di beranda sekarang membuka daftar Part (Part 1 Minna no Nihongo, lalu Part lain dari admin), bukan langsung pengaturan test bab.
11. Fitur baru: Matematika (tambah, kurang, kali, bagi dengan digit acak) dan Kraepelin (penjumlahan kolom). Admin → Matematika & Kraepelin untuk operasi, layout baris, timer, dan jumlah kolom. Jalankan SQL supabase-matematika.sql sekali di Supabase.

## Versi 61
Ganti file berikut saja: app.js, admin.js, matematika.js (baru), lembarpdf.js, pdfsoal.js, resultposter.js, style.css, sw.js, dan supabase-matematika.sql (baru, jalankan sekali di Supabase).
