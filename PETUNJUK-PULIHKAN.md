AKEMI v55 — PATCH PEMULIHAN WEBSITE

Tujuan: mengembalikan app.js, admin.js, style.css ke versi sebelum penambahan pencarian Profil ID, berdasarkan arsip Akemi-v55-FINAL-Akun-Detail-Lengkap.zip yang tersedia. sw.js memakai nama cache baru agar browser mengambil aset terbaru.

PENTING:
- Ini patch pemulihan sementara. Fitur pencarian Profil ID tidak ada di patch ini; prioritasnya membuat website kembali terbuka.
- Jangan menghapus atau mengubah data Supabase.
- Tidak perlu menjalankan SQL apa pun untuk patch ini.

Cara memasang lewat GitHub/Vercel:
1. Backup empat file lama.
2. Ganti hanya app.js, admin.js, style.css, dan sw.js dengan file dari ZIP ini, di folder yang sama seperti sebelumnya.
3. Commit/upload perubahan ke branch yang dipakai Vercel (biasanya main) dan tunggu deployment Ready.
4. Di HP, buka website lalu refresh. Jika masih blank, buka menu Chrome > Setelan > Setelan situs > pilih domain Akemi > Hapus data situs, kemudian buka ulang dan login lagi.
5. Jika masih blank setelah itu, kirim screenshot Logs dari deployment terbaru.

Jangan unggah seluruh ZIP ini sebagai pengganti seluruh proyek; ZIP ini hanya berisi patch empat file dan petunjuk.
