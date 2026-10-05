# ITCO JAPAN — FINAL 600 SOAL JFT + JLPT

## Kenapa SQL-nya dipecah sangat kecil?
Supaya aman dari HP. Versi sebelumnya bisa terpotong saat copy-paste sehingga Supabase memberi `42601 syntax error at end of input`.

### CARA RUN
1. Extract ZIP.
2. Supabase → SQL Editor.
3. Jalankan `01_SETUP.sql` sekali.
4. Setelah sukses, jalankan **60 file Pxx-yy.sql** satu per satu, urut:
   - P01-01 → P01-05
   - P02-01 → P02-05
   - ...
   - P12-01 → P12-05
5. Setiap file berisi hanya 10 soal dan di bagian akhir menampilkan `total_soal`. Hasilnya harus 10 untuk file tersebut.
6. Setelah semua selesai: 12 Part × 50 = 600 soal.

## URUTAN PART
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

## CAMPURAN TIPE SOAL (per Part = 50)
- 15 soal teks
- 10 soal foto
- 10 soal audio
- 15 soal foto + audio

Total:
- 180 teks
- 120 foto
- 120 audio
- 180 foto + audio
- 300 soal memakai gambar unik (`q001.jpg`–`q300.jpg`)
- 300 soal memakai audio TTS (`audio_text`)

Jadi tidak semua soal memakai foto/audio.

## GAMBAR
Jangan hapus `q001.jpg` sampai `q300.jpg`. Gambar diletakkan di root ZIP agar path relatif mudah dipakai website.

## AUDIO
Audio memakai SpeechSynthesis browser melalui `audio_text`, sehingga tidak perlu 300 file MP3. Kecepatan suara disesuaikan level oleh website.

## PENTING
Jangan menjalankan SQL lama dari versi sebelumnya. Gunakan `01_SETUP.sql` + 60 file `Pxx-yy.sql` yang ada di ZIP ini.
