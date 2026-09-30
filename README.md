# ITCO JAPAN — FINAL v2

Tema: Japanese Night — hitam, putih, aksen merah. Public site sederhana: Beranda, Kanji, Latihan.

## Isi ZIP
Semua file berada langsung di root ZIP agar bisa dipilih sekaligus saat upload ke GitHub Pages.

## Yang diubah
- Memperbaiki tombol `↩ Website` Admin agar menuju root website dengan path relatif `./`, bukan `../` yang bisa menyebabkan 404.
- Branding sekarang dibaca dari tabel `branding` oleh website publik, sehingga perubahan Admin benar-benar muncul di website.
- Branding mendukung upload Logo, Favicon, dan Hero langsung dari File Manager melalui Supabase Storage.
- Kanji: hanya `Kanji` dan `Jawaban/Arti` yang wajib; field lainnya opsional.
- Kanji publik dibuat menjadi flashcard: tap kartu → kartu berbalik → jawaban/arti, reading, romaji, dan catatan tampil.
- Kartu Part diperbaiki agar teks putih dan jelas pada tema gelap.
- Tambah `Cara Penggunaan Admin` dengan panduan dan contoh pengisian.
- Tambah `Reset Statistik`: menghapus semua riwayat hasil, tetapi daftar nama disimpan terpisah dan tidak ikut dihapus.
- Tambah `Reset Soal` per Part: menghapus soal di Part tersebut tanpa menghapus Part.
- Quick Soal tetap memakai format `Pertanyaan|Jawaban|Tipe` dan `ganda` untuk Pilihan Ganda.
- Setelah Quick Soal di-import, setiap soal hasil import langsung memiliki tombol Media untuk memilih foto/audio dari File Manager.
- Tambah upload media langsung untuk soal biasa. Foto/audio disimpan di Supabase Storage dan URL-nya disimpan di database.
- Latihan dapat menampilkan foto dan audio secara bersamaan.
- Hasil latihan menyimpan nama ke tabel `user_names` terpisah.

## Setup
1. Buka Supabase project yang dipakai ITCO JAPAN.
2. SQL Editor → jalankan seluruh `schema.sql`.
3. Authentication → Users → buat akun Admin dengan email/password.
4. `config.js` sudah berisi Project URL dan anon public key yang diberikan untuk project ini.
5. Upload semua file ZIP ke root repository GitHub Pages.
6. Setelah commit, buka website GitHub Pages.
7. Admin dibuka melalui `/admin.html`.

## Penting
- Jangan masukkan `service_role` key ke GitHub. Hanya anon/public key yang boleh berada di frontend.
- Jika schema lama sudah pernah dijalankan, schema baru memakai `if not exists` dan `alter table ... add column if not exists` untuk bagian yang ditambahkan.
- Storage bucket `media` dibuat oleh `schema.sql`.
- Setelah mengubah Branding, refresh website publik.

## Format Quick Soal
```text
Pertanyaan|Jawaban|Tipe
いう|Berkata|ganda
食べる|Makan|ganda
飲む|Minum|ganda
```

## Catatan verifikasi
JavaScript sudah dicek dengan `node --check`. Integrasi Supabase tetap membutuhkan project yang aktif, schema yang sudah dijalankan, dan akun Admin yang dibuat di Authentication.
