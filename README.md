# Website Nihon — JFT + JLPT FINAL (600 SOAL)

Versi ini berisi **12 Part × 50 soal = 600 soal**.

## Urutan Part
1. JFT Basic
2. JFT N5
3. JFT N4
4. JFT N3
5. JFT N2
6. JFT N1
7. JLPT Basic
8. JLPT N5
9. JLPT N4
10. JLPT N3
11. JLPT N2
12. JLPT N1

## Media
Setiap soal memiliki **1 gambar situasi unik** (`q001.jpg` sampai `q600.jpg`) dan audio berbasis `audio_text`/SpeechSynthesis Jepang. Gambar dibuat sebagai **ilustrasi situasi pembelajaran yang jelas dan kontekstual**, bukan foto kamera nyata. Foto dan audio dapat tampil bersamaan pada soal yang sama.

## Cara menjalankan di Supabase
1. Buka project Supabase kamu.
2. Masuk **SQL Editor**.
3. Buat query baru.
4. Buka file `FINAL-JFT-JLPT-ALL.sql` dari ZIP ini.
5. Copy seluruh isinya ke SQL Editor.
6. Klik **Run**.
7. Pastikan selesai tanpa error.

SQL tersebut membuat/memperbarui Part 1–12 dan mengisi **600 soal (50 per Part)**.

> Jalankan SQL ini setelah schema utama (`schema.sql`) sudah pernah dijalankan pada project.

## Cara deploy ke Vercel
1. Extract ZIP.
2. Upload semua file ke repository GitHub kamu **di root repository**. Jangan masukkan file `q001.jpg`–`q600.jpg` ke folder lain.
3. Pastikan `index.html`, `app.js`, `style.css`, `config.js`, dan `supabase.js` berada di root.
4. Push/commit ke GitHub.
5. Vercel akan melakukan deployment otomatis jika repository sudah terhubung.
6. Buka website setelah deployment selesai.
7. Jika masih melihat versi lama, lakukan hard refresh / hapus cache browser.

## Konfigurasi Supabase
Pastikan `config.js` berisi URL project dan anon/publishable key Supabase yang benar.

## Pengaturan latihan
- Jumlah soal bisa preset atau **Custom**.
- Custom jumlah soal dapat melebihi 50 selama bank soal Part mencukupi.
- Timer dapat tanpa batas atau **Custom jam + menit + detik**.
- Foto + audio dapat tampil bersamaan.
- Tombol **Kembali ke Latihan** pada halaman hasil kembali ke daftar latihan.

## Struktur penting
Semua aset gambar berada di root:
`q001.jpg` … `q600.jpg`

Jangan hapus atau memindahkan file-file tersebut setelah SQL dijalankan, karena URL soal mengarah ke nama file tersebut.
