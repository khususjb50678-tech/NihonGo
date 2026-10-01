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
