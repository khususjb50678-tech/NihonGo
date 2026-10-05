# ITCO JAPAN — Final

Website pembelajaran Nihongo dengan Kanji, Kana, Latihan, Quick Soal, Timer, Hasil, dan Developer profile.

## Isi versi final
- Beranda Japanese Night
- Kanji flashcard: Kanji / Cara Baca / Arti
- Import Kanji format `Kanji|Cara Baca|Arti`
- Kana bawaan: Hiragana + Katakana, voiced sounds, handakuten, kombinasi
- Flashcard Kana bolak-balik + Play stroke order via KanjiVG
- Latihan 6 tipe: Ganda, Ketik, Kanji, B/S, Pilih Kanji, Pasangan
- Instruksi Ketik otomatis dari jawaban benar
- Quick Soal + foto/audio per soal
- Timer Global / Part / Soal
- Hasil online berdasarkan nama
- Admin Supabase Auth
- Branding + kontak Developer WhatsApp/Telegram/Instagram
- Developer: Witama Yuliananta

## Supabase
Gunakan project Supabase yang sama. Jika kolom Branding baru belum ada, jalankan `schema.sql` atau jalankan bagian `alter table branding ...` dari file tersebut. Jangan gunakan service_role key di frontend.

Storage bucket `media` digunakan untuk foto/audio Quick Soal.

## Deploy
Upload seluruh isi folder ke GitHub/Vercel. `config.js` berisi URL dan anon key project Supabase.

## Update desain Kana & kartu
- Kana sekarang memakai animasi stroke-order SVG saat tombol "Lihat cara menulis" ditekan.
- Data stroke-order Kana diambil dari `kana-svg-data` melalui jsDelivr saat animasi diputar. Sumber data menggunakan data SVG Kana dari AnimeCJK dan berlisensi LGPL. Referensi: https://github.com/hy2k/kana-svg-data
- Branding Admin memiliki upload `Wallpaper Kolom / Kartu`; gambar disimpan ke Supabase Storage bucket `media` dan URL-nya ke `branding.card_wallpaper_url`.
- Navigasi publik disederhanakan menjadi Beranda dan Developer.
