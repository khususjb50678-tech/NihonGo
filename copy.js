// Teks bawaan yang lebih enak dibaca. Teks lama versi bawaan otomatis diganti,
// sedangkan teks yang sudah kamu edit sendiri di Admin tidak disentuh.
export const OLD_DESC = 'Belajar bahasa Jepang dengan Kanji dan latihan interaktif.';
export const NEW_DESC = 'Hafalkan Kana dan Kanji, pahami pola kalimat, lalu uji dirimu lewat latihan soal. Belajar kapan saja, langsung dari HP.';
export const OLD_DEV = 'Website ini dibuat dan dikembangkan oleh Witama Yuliananta, sebagai bagian dari pengembangan media pembelajaran bahasa Jepang yang interaktif, modern, dan mudah digunakan.';
export const NEW_DEV = 'Website ini dibuat oleh Witama Yuliananta agar belajar bahasa Jepang terasa lebih ringan: materi tertata rapi, latihan interaktif, dan bisa dibuka kapan saja dari HP.';

export function fixDesc(b) {
  if (!b.description || b.description.trim() === OLD_DESC) b.description = NEW_DESC;
  if (!b.developer_description || b.developer_description.trim() === OLD_DEV) b.developer_description = NEW_DEV;
  return b;
}
