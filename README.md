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


## Pembaruan V2
- Animasi urutan goresan Hiragana/Katakana: balik kartu, lalu tekan Play (data KanjiVG, CC BY-SA 3.0, dimuat saat Play dan disimpan di cache browser).
- Semua kolom goyang seirama + cahaya merah/biru berjalan di tepi (termasuk logo).
- Admin > Tampilan Kolom: pilih wallpaper saran atau upload foto sendiri. Disimpan di Storage bucket `media` (file `branding/card-style.json`), tidak perlu mengubah database.
- Font baru: Sora, Plus Jakarta Sans, Klee One, Zen Maru Gothic (Google Fonts).
- Menu atas/bawah hanya Beranda dan Developer. Kanji, Kana, Kaiwa, Latihan diakses lewat kartu di Beranda.

## JFT-Basic Part 1
Part 1 sekarang dapat diganti menjadi 50 soal JFT-Basic style. Jalankan `JFT-50-SOAL.sql` di Supabase. Saat user memilih Part 1, user diminta nama, jumlah soal (5–50), dan timer (termasuk custom). Soal diacak dari 50 soal. Soal audio menggunakan Web Speech API dengan bahasa Jepang. Aset foto berada di ``.


## JFT-Basic — 50 Soal
Part 1 diganti menjadi latihan JFT-Basic dengan 50 soal pilihan ganda: 25 soal berbasis gambar dan 25 soal audio Jepang melalui Web Speech API. User memasukkan nama, memilih jumlah soal, lalu memilih timer termasuk custom timer. Soal diacak dari 50 soal. Semua file berada di root ZIP (flat), tanpa folder tambahan.
