# ITCO JAPAN — Final

Tema: Japanese Night — hitam, putih, aksen merah; Torii + Fuji realistis; animasi ringan.

## Yang sudah ada
- Public: Beranda, Kanji, Latihan.
- Tanpa login/register user.
- Nama wajib sebelum latihan.
- Maksimal 20 Part, limit soal, acak soal/pilihan.
- Tipe soal: pilihan ganda, ketik, isian Kanji, benar/salah, matching.
- Quick Soal: `Pertanyaan|Jawaban|Tipe`.
- Hasil tersimpan online berdasarkan nama.
- Admin login menggunakan Supabase Auth, bukan password hard-coded frontend.
- Struktur database dan RLS ada di `schema.sql`.

## Setup sebelum dipakai online
1. Buat project Supabase.
2. Buka SQL Editor, jalankan `schema.sql`.
3. Di Authentication → Users, buat akun Admin.
4. Isi `config.js` dengan Supabase Project URL dan anon public key.
5. Buat Storage bucket untuk media soal jika ingin foto/audio online, lalu tambahkan URL file ke editor soal. Untuk produksi, buat policy Storage yang membatasi upload pada authenticated admin.
6. Upload seluruh folder ini ke GitHub Pages dari branch `main` root.
7. Untuk domain `itcojapanquiz.my.id`, set Custom domain di GitHub Pages setelah DNS domain diarahkan.

## Catatan keamanan
Supabase anon key memang boleh berada di frontend; jangan pernah memasukkan service-role key ke GitHub. RLS wajib aktif. Untuk produksi, policy admin pada `schema.sql` sebaiknya diperketat dengan role/claim khusus admin sebelum data sensitif digunakan.

## Media
Versi ini menyimpan URL media di `questions.media_url`. Upload file ke Supabase Storage dari Admin dapat dijadikan langkah berikutnya; jangan taruh secret key di frontend.
