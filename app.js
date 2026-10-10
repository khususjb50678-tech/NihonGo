import { supabase, sbReady } from './supabase.js';
import { CONFIG } from './config.js';
import { applyCardStyle, loadCachedStyle, fetchCardStyle, runFx } from './cardstyle.js';
import { stopAllStages } from './kanastroke.js';
import { openStudy, closeStudy } from './study.js';
import { currentUser, userName, renderAuth } from './auth.js';
import { fixDesc, NEW_DESC } from './copy.js';
import { startUserMonitor, stopUserMonitor, recordActivity, deviceLabel } from './user-monitor.js';
import { kosakata, tesKotoba, openKotobaSetup, stopKotobaTimer } from './vocab.js';

const app = document.querySelector('#app');
const state = { user: null, page: location.hash.slice(1) || 'home', branding: null, part: null, name: '', questions: [], index: 0, answers: {}, result: null, timer: null, timerLeft: 0, timerSettings: null, setup: null, totalOn: false, totalLeft: 0, qOn: false, qLeft: 0, qFor: -1, perQ: {}, timedOut: false };
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g,' ');
const choiceLabel = i => String.fromCharCode(65 + Number(i));
const isKanji = s => /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(String(s));
const isKana = s => /^[\s\u3040-\u309f\u30a0-\u30ffー・]+$/.test(String(s));
function typingInstruction(answer){ const a=String(answer??'').trim(); if(isKanji(a)) return 'Silahkan jawab dengan Kanji'; if(/^[A-Za-z][A-Za-z0-9 .,'’\-]*$/.test(a)) return 'Silahkan jawab dengan Romaji'; if(isKana(a)) return 'Silahkan jawab dengan Cara Baca'; return 'Silahkan jawab dengan Arti'; }
function parseJSON(v, fallback=[]){ if(Array.isArray(v)) return v; if(typeof v==='object' && v!==null) return v; try{return JSON.parse(v||'')}catch{return fallback;} }

const defaultBunpou=[
{category:'partikel',title:'は (wa)',pattern:'は',meaning:'penanda topik',usage:'Dipakai untuk menunjukkan topik atau hal yang sedang dibicarakan.',before_form:'nama benda / orang / topik',examples:[['わたしは がくせいです。','Watashi wa gakusei desu.','Saya adalah pelajar.'],['これは ほんです。','Kore wa hon desu.','Ini adalah buku.']],conversation:[['A','あなたは がくせいですか？','Anata wa gakusei desu ka?','Apakah kamu pelajar?'],['B','はい、がくせいです。','Hai, gakusei desu.','Ya, saya pelajar.']]},
{category:'partikel',title:'が (ga)',pattern:'が',meaning:'penanda subjek',usage:'Menunjukkan subjek, terutama saat memperkenalkan atau menekankan siapa/apa yang melakukan atau mengalami sesuatu.',before_form:'nama benda / orang / subjek',examples:[['ねこが います。','Neko ga imasu.','Ada kucing.'],['だれが きますか？','Dare ga kimasu ka?','Siapa yang datang?']],conversation:[['A','だれが きますか？','Dare ga kimasu ka?','Siapa yang datang?'],['B','たなかさんが きます。','Tanaka-san ga kimasu.','Tanaka yang datang.']]},
{category:'partikel',title:'を (o)',pattern:'を',meaning:'penanda objek',usage:'Menunjukkan benda yang dikenai tindakan kata kerja.',before_form:'kata benda + を + kata kerja',examples:[['ごはんを たべます。','Gohan o tabemasu.','Saya makan nasi.'],['ほんを よみます。','Hon o yomimasu.','Saya membaca buku.']],conversation:[['A','なにを たべますか？','Nani o tabemasu ka?','Kamu makan apa?'],['B','パンを たべます。','Pan o tabemasu.','Saya makan roti.']]},
{category:'partikel',title:'に (ni)',pattern:'に',meaning:'waktu, tujuan, atau tempat keberadaan',usage:'Dipakai untuk waktu tertentu, tujuan perpindahan, atau tempat keberadaan.',before_form:'waktu / tempat + に',examples:[['しちじに おきます。','Shichiji ni okimasu.','Saya bangun jam tujuh.'],['がっこうに いきます。','Gakkou ni ikimasu.','Saya pergi ke sekolah.']],conversation:[['A','なんじに おきますか？','Nanji ni okimasu ka?','Kamu bangun jam berapa?'],['B','ろくじに おきます。','Rokuji ni okimasu.','Saya bangun jam enam.']]},
{category:'partikel',title:'へ (e)',pattern:'へ',meaning:'arah atau tujuan',usage:'Menunjukkan arah atau tujuan perpindahan. Dibaca e.',before_form:'tempat + へ + kata kerja perpindahan',examples:[['にほんへ いきます。','Nihon e ikimasu.','Saya pergi ke Jepang.'],['うちへ かえります。','Uchi e kaerimasu.','Saya pulang ke rumah.']],conversation:[['A','どこへ いきますか？','Doko e ikimasu ka?','Mau pergi ke mana?'],['B','えきへ いきます。','Eki e ikimasu.','Saya pergi ke stasiun.']]},
{category:'partikel',title:'で (de)',pattern:'で',meaning:'tempat melakukan kegiatan atau alat',usage:'Menunjukkan tempat suatu kegiatan dilakukan atau alat yang digunakan.',before_form:'tempat / alat + で',examples:[['としょかんで べんきょうします。','Toshokan de benkyou shimasu.','Saya belajar di perpustakaan.'],['バスで いきます。','Basu de ikimasu.','Saya pergi dengan bus.']],conversation:[['A','どこで べんきょうしますか？','Doko de benkyou shimasu ka?','Belajar di mana?'],['B','としょかんで べんきょうします。','Toshokan de benkyou shimasu.','Saya belajar di perpustakaan.']]},
{category:'partikel',title:'と (to)',pattern:'と',meaning:'dan / bersama',usage:'Menghubungkan dua benda atau menunjukkan orang yang melakukan sesuatu bersama.',before_form:'kata benda + と + kata benda / orang',examples:[['パンと たまごを たべます。','Pan to tamago o tabemasu.','Saya makan roti dan telur.'],['ともだちと いきます。','Tomodachi to ikimasu.','Saya pergi bersama teman.']],conversation:[['A','だれと いきますか？','Dare to ikimasu ka?','Pergi bersama siapa?'],['B','ともだちと いきます。','Tomodachi to ikimasu.','Saya pergi bersama teman.']]},
{category:'partikel',title:'の (no)',pattern:'の',meaning:'kepemilikan atau hubungan',usage:'Menunjukkan kepemilikan atau hubungan antara dua kata benda.',before_form:'kata benda + の + kata benda',examples:[['わたしの ほんです。','Watashi no hon desu.','Ini buku saya.'],['にほんごの せんせいです。','Nihongo no sensei desu.','Ini guru bahasa Jepang.']],conversation:[['A','これは だれの かばんですか？','Kore wa dare no kaban desu ka?','Ini tas siapa?'],['B','わたしの かばんです。','Watashi no kaban desu.','Ini tas saya.']]},
{category:'partikel',title:'も (mo)',pattern:'も',meaning:'juga',usage:'Menunjukkan bahwa sesuatu juga berlaku untuk orang atau benda lain.',before_form:'kata benda + も',examples:[['わたしも がくせいです。','Watashi mo gakusei desu.','Saya juga pelajar.'],['これも おいしいです。','Kore mo oishii desu.','Ini juga enak.']],conversation:[['A','たなかさんは がくせいです。','Tanaka-san wa gakusei desu.','Tanaka adalah pelajar.'],['B','わたしも がくせいです。','Watashi mo gakusei desu.','Saya juga pelajar.']]},
{category:'partikel',title:'から (kara)',pattern:'から',meaning:'dari / karena',usage:'Bisa menunjukkan titik awal atau alasan. Pada bagian alasan, pola ini berarti karena.',before_form:'alasan: bentuk biasa + から',examples:[['くじから はたらきます。','Kuji kara hatarakimasu.','Saya bekerja mulai jam sembilan.'],['あめが ふるから、いきません。','Ame ga furu kara, ikimasen.','Karena hujan, saya tidak pergi.']],conversation:[['A','どうして いきませんか？','Doushite ikimasen ka?','Kenapa tidak pergi?'],['B','あめが ふるから、いきません。','Ame ga furu kara, ikimasen.','Karena hujan, saya tidak pergi.']]},
{category:'partikel',title:'まで (made)',pattern:'まで',meaning:'sampai',usage:'Menunjukkan batas waktu atau tempat.',before_form:'waktu / tempat + まで',examples:[['ごじまで はたらきます。','Goji made hatarakimasu.','Saya bekerja sampai jam lima.'],['えきまで あるきます。','Eki made arukimasu.','Saya berjalan sampai stasiun.']],conversation:[['A','なんじまで はたらきますか？','Nanji made hatarakimasu ka?','Bekerja sampai jam berapa?'],['B','ごじまでです。','Goji made desu.','Sampai jam lima.']]},
{category:'partikel',title:'や (ya)',pattern:'や',meaning:'dan sebagainya',usage:'Menghubungkan beberapa contoh benda tanpa menyebutkan semuanya.',before_form:'kata benda + や + kata benda',examples:[['りんごや バナナを かいました。','Ringo ya banana o kaimashita.','Saya membeli apel, pisang, dan sebagainya.']],conversation:[['A','なにを かいましたか？','Nani o kaimashita ka?','Kamu membeli apa?'],['B','りんごや バナナを かいました。','Ringo ya banana o kaimashita.','Saya membeli apel, pisang, dan sebagainya.']]},
{category:'partikel',title:'だけ (dake)',pattern:'だけ',meaning:'hanya',usage:'Membatasi jumlah atau pilihan menjadi hanya sesuatu yang disebutkan.',before_form:'kata benda / bentuk biasa + だけ',examples:[['みずだけ のみます。','Mizu dake nomimasu.','Saya hanya minum air.'],['ひとつだけ ください。','Hitotsu dake kudasai.','Tolong satu saja.']],conversation:[['A','コーヒーも のみますか？','Koohii mo nomimasu ka?','Apakah minum kopi juga?'],['B','みずだけ のみます。','Mizu dake nomimasu.','Saya hanya minum air.']]},
{category:'bunpou',title:'～から (karena)',pattern:'bentuk biasa + から',meaning:'karena / sebab',usage:'Menjelaskan alasan atau penyebab.',before_form:'kata kerja bentuk biasa; i-keiyoushi langsung; na-keiyoushi + だ; kata benda + だ',examples:[['あついから、みずを のみます。','Atsui kara, mizu o nomimasu.','Karena panas, saya minum air.'],['しずかだから、ここが すきです。','Shizuka da kara, koko ga suki desu.','Karena tenang, saya suka tempat ini.']],conversation:[['A','どうして みずを のみますか？','Doushite mizu o nomimasu ka?','Kenapa minum air?'],['B','あついからです。','Atsui kara desu.','Karena panas.']]},
{category:'bunpou',title:'～ので (karena)',pattern:'bentuk biasa + ので',meaning:'karena / dikarenakan',usage:'Menjelaskan alasan dengan nuansa lebih halus dan lembut daripada から.',before_form:'kata kerja bentuk biasa + ので; i-keiyoushi + ので; na-keiyoushi + なので; kata benda + なので',examples:[['じかんが ないので、いそぎます。','Jikan ga nai node, isogimasu.','Karena tidak punya waktu, saya bergegas.']],conversation:[['A','どうして いそぎますか？','Doushite isogimasu ka?','Kenapa buru-buru?'],['B','じかんが ないので、いそぎます。','Jikan ga nai node, isogimasu.','Karena tidak punya waktu, saya bergegas.']]},
{category:'bunpou',title:'～とき (ketika)',pattern:'bentuk biasa + とき',meaning:'ketika / saat',usage:'Menunjukkan waktu ketika suatu keadaan atau tindakan terjadi.',before_form:'kata kerja / kata sifat / kata benda + とき',examples:[['ひまなとき、ほんを よみます。','Hima na toki, hon o yomimasu.','Saat senggang, saya membaca buku.'],['にほんへ いくとき、かばんを かいます。','Nihon e iku toki, kaban o kaimasu.','Saat pergi ke Jepang, saya membeli tas.']],conversation:[['A','ひまなとき、なにを しますか？','Hima na toki, nani o shimasu ka?','Kalau senggang, apa yang kamu lakukan?'],['B','おんがくを ききます。','Ongaku o kikimasu.','Saya mendengarkan musik.']]},
{category:'bunpou',title:'～たら (kalau / ketika)',pattern:'bentuk た + ら',meaning:'kalau / setelah / ketika',usage:'Dipakai untuk syarat atau kejadian yang akan dilakukan setelah sesuatu terjadi.',before_form:'kata kerja bentuk た + ら; i-keiyoushi bentuk たら; na-keiyoushi / kata benda + だったら',examples:[['じかんが あったら、えいがを みます。','Jikan ga attara, eiga o mimasu.','Kalau ada waktu, saya menonton film.'],['しごとが おわったら、かえります。','Shigoto ga owattara, kaerimasu.','Setelah pekerjaan selesai, saya pulang.']],conversation:[['A','しごとが おわったら、なにを しますか？','Shigoto ga owattara, nani o shimasu ka?','Setelah kerja selesai, apa yang dilakukan?'],['B','うちへ かえります。','Uchi e kaerimasu.','Saya pulang ke rumah.']]},
{category:'bunpou',title:'～なら (kalau / mengenai)',pattern:'bentuk biasa + なら',meaning:'kalau / jika memang',usage:'Memberi saran atau membicarakan suatu topik berdasarkan informasi yang sudah muncul.',before_form:'bentuk biasa + なら; kata benda + なら',examples:[['にほんへ いくなら、はるが いいです。','Nihon e iku nara, haru ga ii desu.','Kalau mau pergi ke Jepang, musim semi bagus.']],conversation:[['A','にほんへ いきたいです。','Nihon e ikitai desu.','Saya ingin pergi ke Jepang.'],['B','いくなら、はるが いいですよ。','Iku nara, haru ga ii desu yo.','Kalau mau pergi, musim semi bagus.']]},
{category:'bunpou',title:'～ても (meskipun)',pattern:'bentuk て + も',meaning:'meskipun / walaupun',usage:'Menunjukkan bahwa hasil tetap sama walaupun ada kondisi tertentu.',before_form:'kata kerja bentuk て + も; i-keiyoushi + くても; na-keiyoushi + でも',examples:[['あめが ふっても、いきます。','Ame ga futte mo, ikimasu.','Meskipun hujan, saya pergi.']],conversation:[['A','あめが ふったら、どうしますか？','Ame ga futtara, dou shimasu ka?','Kalau hujan, bagaimana?'],['B','あめが ふっても、いきます。','Ame ga futte mo, ikimasu.','Meskipun hujan, saya tetap pergi.']]},
{category:'bunpou',title:'～ながら (sambil)',pattern:'bentuk masu tanpa ます + ながら',meaning:'sambil',usage:'Menunjukkan dua kegiatan yang dilakukan bersamaan.',before_form:'kata kerja bentuk masu, buang ます + ながら',examples:[['おんがくを ききながら、べんきょうします。','Ongaku o kikinagara, benkyou shimasu.','Saya belajar sambil mendengarkan musik.']],conversation:[['A','なにを しながら べんきょうしますか？','Nani o shinagara benkyou shimasu ka?','Belajar sambil melakukan apa?'],['B','おんがくを ききながら べんきょうします。','Ongaku o kikinagara benkyou shimasu.','Saya belajar sambil mendengarkan musik.']]},
{category:'bunpou',title:'～ほうが いい (sebaiknya)',pattern:'kata kerja bentuk た + ほうが いい',meaning:'sebaiknya',usage:'Memberikan saran.',before_form:'kata kerja bentuk た + ほうが いい; negatif + ないほうが いい',examples:[['はやく ねたほうが いいです。','Hayaku neta hou ga ii desu.','Sebaiknya tidur lebih awal.'],['むりを しないほうが いいです。','Muri o shinai hou ga ii desu.','Sebaiknya jangan memaksakan diri.']],conversation:[['A','ちょっと つかれました。','Chotto tsukaremashita.','Saya agak lelah.'],['B','やすんだほうが いいですよ。','Yasunda hou ga ii desu yo.','Sebaiknya kamu istirahat.']]},
{category:'bunpou',title:'～なければ ならない (harus)',pattern:'bentuk ない → なければ ならない',meaning:'harus',usage:'Menunjukkan kewajiban.',before_form:'kata kerja bentuk ない, ubah ない menjadi なければ + ならない',examples:[['べんきょうしなければ なりません。','Benkyou shinakereba narimasen.','Harus belajar.'],['はやく いかなければ なりません。','Hayaku ikanakereba narimasen.','Harus pergi lebih cepat.']],conversation:[['A','あした しけんが あります。','Ashita shiken ga arimasu.','Besok ada ujian.'],['B','べんきょうしなければ なりませんね。','Benkyou shinakereba narimasen ne.','Berarti harus belajar ya.']]},
{category:'bunpou',title:'～なくても いい (tidak harus)',pattern:'bentuk ない → なくても いい',meaning:'tidak perlu / tidak harus',usage:'Menunjukkan bahwa sesuatu tidak wajib dilakukan.',before_form:'kata kerja bentuk ない + なくても いい',examples:[['あした こなくても いいです。','Ashita konakute mo ii desu.','Besok tidak perlu datang.']],conversation:[['A','あしたも きますか？','Ashita mo kimasu ka?','Besok datang lagi?'],['B','いいえ、こなくても いいです。','Iie, konakute mo ii desu.','Tidak, tidak perlu datang.']]},
{category:'bunpou',title:'～ことが できる (bisa)',pattern:'kata kerja bentuk kamus + ことが できる',meaning:'bisa / dapat',usage:'Menunjukkan kemampuan atau kemungkinan melakukan sesuatu.',before_form:'kata kerja bentuk kamus + ことが できる',examples:[['にほんごを はなすことが できます。','Nihongo o hanasu koto ga dekimasu.','Saya bisa berbicara bahasa Jepang.']],conversation:[['A','にほんごを はなすことが できますか？','Nihongo o hanasu koto ga dekimasu ka?','Bisa berbicara bahasa Jepang?'],['B','はい、すこし できます。','Hai, sukoshi dekimasu.','Ya, sedikit bisa.']]},
{category:'bunpou',title:'～つもり (berniat)',pattern:'kata kerja bentuk kamus / ない + つもり',meaning:'berniat / bermaksud',usage:'Menyatakan niat atau rencana pribadi.',before_form:'kata kerja bentuk kamus + つもり; bentuk ない + つもり',examples:[['らいねん にほんへ いくつもりです。','Rainen Nihon e iku tsumori desu.','Saya berniat pergi ke Jepang tahun depan.']],conversation:[['A','らいねん なにを するつもりですか？','Rainen nani o suru tsumori desu ka?','Tahun depan berniat melakukan apa?'],['B','にほんへ いくつもりです。','Nihon e iku tsumori desu.','Saya berniat pergi ke Jepang.']]},
{category:'bunpou',title:'～よてい (rencana)',pattern:'kata benda / kata kerja bentuk kamus + よてい',meaning:'rencana / jadwal',usage:'Menyatakan rencana yang sudah ditentukan.',before_form:'kata kerja bentuk kamus + よてい; kata benda + の + よてい',examples:[['らいげつ りょこうする よていです。','Raigetsu ryokou suru yotei desu.','Bulan depan ada rencana bepergian.']],conversation:[['A','らいげつ どこへ いきますか？','Raigetsu doko e ikimasu ka?','Bulan depan pergi ke mana?'],['B','きょうとへ いく よていです。','Kyouto e iku yotei desu.','Rencananya pergi ke Kyoto.']]},
{category:'bunpou',title:'～と おもいます (saya pikir)',pattern:'bentuk biasa + と おもいます',meaning:'saya pikir / menurut saya',usage:'Menyatakan pendapat atau perkiraan pribadi.',before_form:'bentuk biasa + と おもいます',examples:[['あしたは あめだと おもいます。','Ashita wa ame da to omoimasu.','Saya pikir besok hujan.']],conversation:[['A','あしたは はれると おもいますか？','Ashita wa hareru to omoimasu ka?','Menurutmu besok akan cerah?'],['B','はい、はれると おもいます。','Hai, hareru to omoimasu.','Ya, saya pikir akan cerah.']]},
{category:'bunpou',title:'～かも しれない (mungkin)',pattern:'bentuk biasa + かも しれない',meaning:'mungkin',usage:'Menyatakan kemungkinan yang belum pasti.',before_form:'bentuk biasa + かも しれない',examples:[['あしたは あめかも しれません。','Ashita wa ame kamo shiremasen.','Besok mungkin hujan.']],conversation:[['A','あした でかけますか？','Ashita dekakemasu ka?','Besok pergi keluar?'],['B','あめかも しれません。','Ame kamo shiremasen.','Mungkin hujan.']]},
{category:'bunpou',title:'～て いる (sedang / keadaan)',pattern:'bentuk て + いる',meaning:'sedang melakukan / keadaan yang berlangsung',usage:'Menunjukkan kegiatan yang sedang berlangsung atau keadaan yang masih berlanjut.',before_form:'kata kerja bentuk て + いる',examples:[['いま べんきょうしています。','Ima benkyou shiteimasu.','Sekarang sedang belajar.'],['とうきょうに すんでいます。','Toukyou ni sundeimasu.','Tinggal di Tokyo.']],conversation:[['A','いま なにを していますか？','Ima nani o shiteimasu ka?','Sekarang sedang apa?'],['B','べんきょうしています。','Benkyou shiteimasu.','Saya sedang belajar.']]},
{category:'bunpou',title:'～て ください (tolong)',pattern:'bentuk て + ください',meaning:'tolong lakukan',usage:'Meminta seseorang melakukan sesuatu dengan sopan.',before_form:'kata kerja bentuk て + ください',examples:[['ここに なまえを かいてください。','Koko ni namae o kaite kudasai.','Tolong tulis nama di sini.']],conversation:[['A','すみません。ここに なまえを かいてください。','Sumimasen. Koko ni namae o kaite kudasai.','Permisi. Tolong tulis nama di sini.'],['B','はい、わかりました。','Hai, wakarimashita.','Baik, saya mengerti.']]},
{category:'bunpou',title:'～ても いい (boleh)',pattern:'bentuk て + も いい',meaning:'boleh',usage:'Meminta atau memberi izin.',before_form:'kata kerja bentuk て + も いい',examples:[['ここで しゃしんを とっても いいですか？','Koko de shashin o totte mo ii desu ka?','Bolehkah mengambil foto di sini?']],conversation:[['A','ここで しゃしんを とっても いいですか？','Koko de shashin o totte mo ii desu ka?','Bolehkah mengambil foto di sini?'],['B','はい、いいですよ。','Hai, ii desu yo.','Ya, boleh.']]},
{category:'bunpou',title:'～ては いけない (tidak boleh)',pattern:'bentuk て + は いけない',meaning:'tidak boleh',usage:'Menyatakan larangan.',before_form:'kata kerja bentuk て + は いけない',examples:[['ここで たばこを すっては いけません。','Koko de tabako o sutte wa ikemasen.','Tidak boleh merokok di sini.']],conversation:[['A','ここで たばこを すっても いいですか？','Koko de tabako o sutte mo ii desu ka?','Boleh merokok di sini?'],['B','いいえ、すっては いけません。','Iie, sutte wa ikemasen.','Tidak, tidak boleh.']]},
{category:'bunpou',title:'～てから (setelah)',pattern:'bentuk て + から',meaning:'setelah melakukan',usage:'Menunjukkan bahwa kegiatan kedua dilakukan setelah kegiatan pertama selesai.',before_form:'kata kerja bentuk て + から',examples:[['ごはんを たべてから、べんきょうします。','Gohan o tabete kara, benkyou shimasu.','Setelah makan, saya belajar.']],conversation:[['A','ごはんの あとで なにを しますか？','Gohan no ato de nani o shimasu ka?','Setelah makan, apa yang dilakukan?'],['B','ごはんを たべてから、べんきょうします。','Gohan o tabete kara, benkyou shimasu.','Setelah makan, saya belajar.']]},
{category:'bunpou',title:'～まえに (sebelum)',pattern:'bentuk kamus + まえに',meaning:'sebelum',usage:'Menunjukkan kegiatan yang dilakukan sebelum kegiatan lain.',before_form:'kata kerja bentuk kamus + まえに; kata benda + の + まえに',examples:[['ねるまえに、はを みがきます。','Neru mae ni, ha o migakimasu.','Sebelum tidur, saya menggosok gigi.']],conversation:[['A','ねるまえに なにを しますか？','Neru mae ni nani o shimasu ka?','Sebelum tidur, apa yang dilakukan?'],['B','はを みがきます。','Ha o migakimasu.','Saya menggosok gigi.']]},
{category:'bunpou',title:'～ように (supaya)',pattern:'bentuk biasa + ように',meaning:'supaya / agar',usage:'Menyatakan tujuan agar suatu keadaan atau kemampuan tercapai.',before_form:'bentuk biasa + ように',examples:[['わすれないように、メモします。','Wasurenai you ni, memo shimasu.','Saya mencatat supaya tidak lupa.']],conversation:[['A','どうして メモしますか？','Doushite memo shimasu ka?','Kenapa mencatat?'],['B','わすれないように、メモします。','Wasurenai you ni, memo shimasu.','Supaya tidak lupa.']]},
{category:'bunpou',title:'～ために (untuk / demi)',pattern:'bentuk kamus + ために',meaning:'untuk / demi',usage:'Menyatakan tujuan yang jelas.',before_form:'kata kerja bentuk kamus + ために; kata benda + の + ために',examples:[['にほんで はたらくために、にほんごを べんきょうします。','Nihon de hataraku tame ni, nihongo o benkyou shimasu.','Saya belajar bahasa Jepang untuk bekerja di Jepang.']],conversation:[['A','どうして にほんごを べんきょうしますか？','Doushite nihongo o benkyou shimasu ka?','Kenapa belajar bahasa Jepang?'],['B','にほんで はたらくために、べんきょうします。','Nihon de hataraku tame ni, benkyou shimasu.','Saya belajar untuk bekerja di Jepang.']]}
];
function normalizeBunpou(row,i=0){
  const ex=parseJSON(row.examples,[]), cv=parseJSON(row.conversation,[]);
  return {...row,_i:i,examples:Array.isArray(ex)?ex:[],conversation:Array.isArray(cv)?cv:[]};
}
function bunpouRowsToDefaults(rows){return rows.map((r,i)=>normalizeBunpou({id:`default-${i}`,active:true,...r},i));}
function renderBunpouExamples(examples){return examples.map(e=>`<div class="bunpou-example"><div class="jp">${esc(e[0]||'')}</div><div class="romaji">${esc(e[1]||'')}</div><div class="meaning">${esc(e[2]||'')}</div></div>`).join('');}
function renderConversation(rows){return rows.map(r=>`<div class="kaiwa-line"><b>${esc(r[0]||'A')}</b><div><div class="jp">${esc(r[1]||'')}</div><div class="romaji">${esc(r[2]||'')}</div><div class="meaning">${esc(r[3]||'')}</div></div></div>`).join('');}
function renderBunpouCard(x,i=0){return `<button type="button" class="bunpou-item fx-float fx-ring" data-bunpou-index="${i}"><span class="bunpou-item-tag">${x.category==='partikel'?'PARTIKEL':'BUNPOU'}</span><strong>${esc(x.title||x.pattern||'Materi')}</strong><span class="bunpou-item-pattern">${esc(x.pattern||'')}</span><span class="bunpou-item-arrow">›</span></button>`;}
function renderBunpouDetail(x){return `<div class="bunpou-modal-backdrop" id="bunpouModal"><div class="bunpou-modal" role="dialog" aria-modal="true"><button type="button" class="bunpou-close" id="bunpouClose" aria-label="Tutup">×</button><div class="bunpou-tag">${x.category==='partikel'?'PARTIKEL':'BUNPOU'}</div><h2>${esc(x.title||x.pattern||'Materi')}</h2><div class="bunpou-pattern">${esc(x.pattern||'')}</div><p class="bunpou-meaning"><b>Arti:</b> ${esc(x.meaning||'')}</p><p class="bunpou-detail-text"><b>Fungsi:</b> ${esc(x.usage||'')}</p><div class="bunpou-block"><b>Bentuk sebelum pola</b><p>${esc(x.before_form||'')}</p></div>${x.notes?`<div class="bunpou-block"><b>Catatan</b><p>${esc(x.notes)}</p></div>`:''}<div class="bunpou-block"><b>Contoh</b>${renderBunpouExamples(x.examples)}</div><div class="bunpou-block"><b>Percakapan KAIWA</b><div class="kaiwa">${renderConversation(x.conversation)}</div></div></div></div>`;}
function applyAppManifest(b){
  const name=(b.app_name||'').trim()||(b.site_name||'').trim()||CONFIG.siteName;
  const short=(b.app_short_name||'').trim()||name.slice(0,12);
  const o=location.origin+'/',abs=f=>new URL(f,o).href;
  const icon=(b.app_icon_url||'').trim();
  const icons=icon?[{src:icon,sizes:'192x192',type:'image/png',purpose:'any'},{src:icon,sizes:'512x512',type:'image/png',purpose:'any'}]
    :[{src:abs('icon-192.png'),sizes:'192x192',type:'image/png',purpose:'any'},{src:abs('icon-512.png'),sizes:'512x512',type:'image/png',purpose:'any'},{src:abs('icon-maskable-512.png'),sizes:'512x512',type:'image/png',purpose:'maskable'}];
  const m={id:o,name,short_name:short,description:'Belajar bahasa Jepang: Kana, Kanji, Bunpou, dan latihan soal interaktif.',start_url:o,scope:o,display:'standalone',orientation:'portrait',background_color:'#050505',theme_color:'#050505',lang:'id',icons};
  const url=URL.createObjectURL(new Blob([JSON.stringify(m)],{type:'application/manifest+json'}));
  let l=document.querySelector('link[rel="manifest"]');if(!l){l=document.createElement('link');l.rel='manifest';document.head.appendChild(l);}
  l.setAttribute('href',url);
  const t=document.querySelector('meta[name="apple-mobile-web-app-title"]')||Object.assign(document.createElement('meta'),{name:'apple-mobile-web-app-title'});t.content=name;if(!t.parentNode)document.head.appendChild(t);
  const ai=document.querySelector('link[rel="apple-touch-icon"]');if(ai&&icon)ai.setAttribute('href',icon);
}
async function loadBranding(force=false){
  if(state.branding && !force) return state.branding;
  let b={site_name:CONFIG.siteName,corporate_name:CONFIG.corporateName,creator:CONFIG.creator,hero_image:CONFIG.heroImage,description:NEW_DESC,logo_url:'',favicon_url:'',whatsapp_url:'',telegram_url:'',instagram_url:'',developer_logo_url:''};
  const styleJob=fetchCardStyle();
  if(sbReady){ try{ const {data}=await supabase.from('branding').select('*').eq('id',1).maybeSingle(); if(data)b={...b,...data}; }catch(err){ console.warn('Branding tidak terbaca:',err); } }
  fixDesc(b);
  state.branding=b; document.title=b.site_name||CONFIG.siteName;
  try{localStorage.setItem('itco_brand',JSON.stringify({n:b.site_name||CONFIG.siteName,c:b.corporate_name||'',l:b.logo_url||''}));}catch{}
  if(b.favicon_url&&!/^https?:\/\/(www\.)?ibb\.co\//i.test(b.favicon_url)){const f=document.querySelector('#favicon');if(f){f.setAttribute('href',b.favicon_url);f.removeAttribute('type');}}
  try{applyAppManifest(b);}catch(e){console.warn('Manifest:',e);}
  const cs=await styleJob; if(cs) applyCardStyle(cs);
  return b;
}
async function q(table,opts={}){ if(!sbReady)return {data:[],error:null}; let x=supabase.from(table).select(opts.select||'*'); if(opts.eq)for(const [k,v] of Object.entries(opts.eq))x=x.eq(k,v); if(opts.order)x=x.order(opts.order,{ascending:opts.asc!==false}); return x; }
function renderPromptHTML(value){
  const t=document.createElement('template');
  t.innerHTML=String(value||'');
  const walk=node=>{
    if(node.nodeType===Node.TEXT_NODE)return;
    if(node.nodeType!==Node.ELEMENT_NODE){node.remove();return;}
    const tag=node.tagName.toLowerCase();
    if(!['u','br'].includes(tag)){
      const frag=document.createDocumentFragment();
      while(node.firstChild)frag.appendChild(node.firstChild);
      node.replaceWith(frag);
      return;
    }
    [...node.attributes].forEach(a=>node.removeAttribute(a.name));
    [...node.childNodes].forEach(walk);
  };
  [...t.content.childNodes].forEach(walk);
  return t.innerHTML;
}
function promptText(value){
  const t=document.createElement('template'); t.innerHTML=renderPromptHTML(value);
  return (t.content.textContent||'').replace(/\s+/g,' ').trim();
}

function shell(content){
  stopAllStages();
  const b=state.branding||{};
  const logo=b.logo_url?`<img class="mark-img" src="${esc(b.logo_url)}" alt="logo" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{className:'mark-fallback',textContent:'⛩'}))">`:'⛩';
  app.innerHTML=`<div class="shell"><header class="topbar"><div class="topin"><a class="brand" href="#home"><span class="mark fx-card fx-ring">${logo}</span><span class="brand-name">${esc(b.site_name||'ITCO JAPAN')}<small>${esc(b.corporate_name||'TOP CORPORATION')} · ${esc(b.creator||'ウィタマ。')}</small></span></a><nav class="nav"><a href="#home">⌂ Beranda</a><a href="#developer">⌘ Developer</a><a href="#akun">☺ Akun</a></nav><button type="button" class="top-message" id="messageBtn" aria-label="Pesan terbaru" title="Pesan terbaru"><span>🔔</span>${b.message_enabled?'<i aria-hidden="true"></i>':''}</button></div></header>${content}<nav class="bottom"><a href="#home">⌂<br>Beranda</a><a href="#developer">⌘<br>Developer</a><a href="#akun">☺<br>Akun</a></nav></div>`;
  document.querySelectorAll('.nav a,.bottom a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#${state.page}`));
  document.querySelectorAll('[href="#tes-kotoba"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();openKotobaSetup();}));
  const mb=document.querySelector('#messageBtn');
  if(mb)mb.onclick=()=>showSiteMessage();
  if(b.message_enabled===true){
    const signature=`${String(b.message_title||'')}\n${String(b.message_body||'')}`.trim();
    let seen='';
    try{seen=localStorage.getItem('nihongo_seen_message')||'';}catch{}
    if(signature && signature!==seen){
      setTimeout(()=>{
        showSiteMessage();
        try{localStorage.setItem('nihongo_seen_message',signature);}catch{}
      },300);
    }
  }
  runFx();
}
function showSiteMessage(){
  const b=state.branding||{};
  document.querySelector('#siteMessageModal')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="site-message-backdrop" id="siteMessageModal"><div class="site-message-card" role="dialog" aria-modal="true"><button type="button" class="bunpou-close" id="siteMessageClose" aria-label="Tutup">×</button><div class="eyebrow">📢 PESAN TERBARU</div><h2>${esc(b.message_title||'Informasi Website')}</h2><div class="site-message-body">${renderPromptHTML(String(b.message_body||'Belum ada pesan terbaru dari pengelola website.').replace(/\n/g,'<br>'))}</div></div></div>`);
  const m=document.querySelector('#siteMessageModal'); document.querySelector('#siteMessageClose').onclick=()=>m.remove(); m.onclick=e=>{if(e.target===m)m.remove();};
}
function showMaintenance(b){
  stopAllStages();
  const logo=b.logo_url?`<img class="mark-img" src="${esc(b.logo_url)}" alt="logo">`:'⛩';
  app.innerHTML=`<div class="maintenance-page"><div class="maintenance-card fx-float fx-ring"><div class="maintenance-logo">${logo}</div><div class="eyebrow">${esc(b.site_name||'ITCO JAPAN')}</div><h1>${esc(b.maintenance_title||'Website Sedang Dalam Perbaikan')}</h1><div class="maintenance-divider"></div><p>${renderPromptHTML(String(b.maintenance_body||'Website sedang dalam proses perbaikan dan pembaruan. Mohon tunggu sebentar, kami akan segera kembali.').replace(/\n/g,'<br>'))}</p><div class="maintenance-box"><span>⚙</span><div><b>Sedang diperbaiki</b><small>Mohon tunggu sebentar ya. Terima kasih atas pengertiannya.</small></div></div></div></div>`;
}

async function home(){
  const b=await loadBranding();
  const rawHero=(b.hero_image&&String(b.hero_image).trim())||'';const heroImage=(rawHero&&!/^https?:\/\/(www\.)?ibb\.co\//i.test(rawHero))?rawHero:CONFIG.heroImage;
  const heroBg=heroImage?`background-image:linear-gradient(180deg,#05050500 38%,#050505 100%),linear-gradient(90deg,#030303ec 0%,#030303a8 52%,#03030366),url(&quot;${esc(encodeURI(heroImage).replace(/\(/g,'%28').replace(/\)/g,'%29'))}&quot;)`:'';
  shell(`<section class="hero" style="${heroBg}"><div class="hero-inner"><div class="hero-name fx-ring"><h1>${esc(b.site_name||'ITCO JAPAN')}</h1></div><h2>${esc(b.corporate_name||'TOP CORPORATION')}</h2><p>${esc(b.description||NEW_DESC)}</p></div></section><section class="section home-section"><div class="section-title"><div><h2>Mau belajar apa hari ini?</h2><p class="muted">Pilih satu materi, lalu belajar sedikit demi sedikit setiap hari.</p></div></div><div class="cards"><a class="card feature fx-card fx-ring" href="#kanji"><div class="icon">字</div><h3>Kanji</h3><p>Hafalkan Kanji lewat kartu yang bisa dibalik, lengkap dengan cara baca dan artinya.</p></a><a class="card feature fx-card fx-ring" href="#kana"><div class="icon">あ</div><h3>Kana</h3><p>Hiragana dan Katakana dalam kartu interaktif, plus animasi urutan goresan.</p></a><a class="card feature fx-card fx-ring" href="#kaiwa"><div class="icon">会話</div><h3>Kaiwa &amp; Bunpou</h3><p>Pahami partikel dan pola kalimat lewat contoh serta percakapan sehari-hari.</p></a><a class="card feature fx-card fx-ring" href="#latihan"><div class="icon">✎</div><h3>Mengerjakan Soal</h3><p>Kerjakan soal per Part, lalu cek nilai dan review jawabanmu.</p></a><a class="card feature fx-card fx-ring" href="#kosakata"><div class="icon">語</div><h3>Kosakata</h3><p>Pelajari Kotoba Minna no Nihongo Bab 1–50 lewat kartu interaktif dan Test Kotoba.</p></a></div></section>`);
}
async function developer(){
  const b=await loadBranding(true);
  const icon=(name,url)=>url?`<a class="social-icon" href="${esc(url)}" target="_blank" rel="noopener" aria-label="${name}"><img src="https://cdn.simpleicons.org/${name.toLowerCase()}/ffffff" alt=""></a>`:'';
  const links=`${icon('WhatsApp',b.whatsapp_url)}${icon('Telegram',b.telegram_url)}${icon('Instagram',b.instagram_url)}`;
  const avatar=b.developer_logo_url?`<img class="developer-avatar-img" src="${esc(b.developer_logo_url)}" alt="Logo Developer">`:'⌘';
  shell(`<section class="section developer-page"><div class="developer-panel fx-float fx-ring"><div class="eyebrow">Di balik website ini</div><div class="developer-avatar fx-card fx-ring">${avatar}</div><h1>Developer</h1><h2>${esc(b.creator_name||'Witama Yuliananta')}</h2><p>${esc(b.developer_description)}</p><div class="socials">${links||'<span class="muted">Kontak belum ditambahkan.</span>'}</div></div>${installGuide()}</section>`);
  const ib=document.querySelector('#installBtn');
  if(ib){ ib.onclick=async()=>{ if(!installEvt)return; installEvt.prompt(); try{await installEvt.userChoice;}catch{} installEvt=null; syncInstallUI(); }; } syncInstallUI();
}
// Panduan memasang website sebagai aplikasi (Chrome → ⋮ → Install).
let installEvt=null;
function syncInstallUI(){const b=document.querySelector('#installBtn'),s=document.querySelector('#installSteps');if(b)b.hidden=!installEvt;if(s)s.hidden=!!installEvt;}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;syncInstallUI();});
window.addEventListener('appinstalled',()=>{installEvt=null;const c=document.querySelector('.install-card');if(c)c.remove();});
function installGuide(){
  if(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)return '';
  return `<div class="install-card fx-float fx-ring"><div class="eyebrow">Pasang di HP</div><h2>Pasang aplikasi</h2><p class="muted">Website ini bisa dipasang seperti aplikasi biasa: ikonnya muncul di layar utama dan terbuka layar penuh.</p><button type="button" id="installBtn" class="btn red" hidden>Install sekarang</button><div id="installSteps"><p class="install-note">Kalau tombol Install belum muncul, pasang manual lewat Chrome:</p><ol class="install-steps"><li><span>Ketuk <b>titik tiga (⋮)</b> di pojok kanan atas Chrome.</span></li><li><span>Pilih <b>Install aplikasi</b> (atau <b>Tambahkan ke layar utama</b>).</span></li><li><span>Ketuk <b>Install</b>. Ikon ${esc((state.branding&&(state.branding.app_name||state.branding.site_name))||CONFIG.siteName)} akan muncul di layar utama.</span></li></ol></div><p class="install-note">Pengguna iPhone: buka lewat Safari, ketuk tombol Bagikan, lalu pilih <b>Tambah ke Layar Utama</b>.</p></div>`;
}
let kanjiShown=[];
const kanjiStudy=x=>({glyph:x.kanji,reading:x.reading||'',meaning:x.meaning||'',animate:x.animate!==false});
async function kanji(){ await loadBranding(); const {data,error}=await q('kanji',{eq:{active:true},order:'created_at'}); if(error)console.error(error); kanjiShown=data||[]; shell(`<section class="section"><div class="section-title"><div><div class="eyebrow">字 Kanji</div><h2>Kanji</h2><p class="muted">Ketuk kartu untuk melihat cara baca, arti, dan animasi urutan goresannya.</p></div></div><input id="search" class="input search" placeholder="Cari Kanji, cara baca, atau arti…"><div id="kanjiGrid" class="grid" style="margin-top:20px">${renderKanji(kanjiShown)}</div></section>`); const s=document.querySelector('#search'); s.oninput=e=>{const v=norm(e.target.value);kanjiShown=(data||[]).filter(x=>norm(`${x.kanji} ${x.reading} ${x.meaning}`).includes(v));document.querySelector('#kanjiGrid').innerHTML=renderKanji(kanjiShown);runFx();}; document.querySelector('#kanjiGrid').onclick=e=>{const c=e.target.closest('.kanji-flip'); if(!c)return; openStudy(kanjiShown.map(kanjiStudy),Number(c.dataset.i));}; }
function renderKanji(rows){ if(!rows.length)return `<div class="empty" style="grid-column:1/-1"><div class="empty-symbol">字</div><h3>Belum ada materi Kanji</h3><p>Materi akan muncul di sini setelah Admin menambahkannya.</p></div>`; return rows.map((x,i)=>`<button class="kanji-flip fx-card" type="button" data-i="${i}" aria-label="Kanji ${esc(x.kanji)}"><span class="flip-inner"><span class="flip-face flip-front"><span class="kanji-char">${esc(x.kanji)}</span><small>${x.animate!==false?'Ketuk untuk melihat arti &amp; animasi':'Ketuk untuk melihat arti'}</small></span></span></button>`).join(''); }

const basicH=[['あ','a'],['い','i'],['う','u'],['え','e'],['お','o'],['か','ka'],['き','ki'],['く','ku'],['け','ke'],['こ','ko'],['さ','sa'],['し','shi'],['す','su'],['せ','se'],['そ','so'],['た','ta'],['ち','chi'],['つ','tsu'],['て','te'],['と','to'],['な','na'],['に','ni'],['ぬ','nu'],['ね','ne'],['の','no'],['は','ha'],['ひ','hi'],['ふ','fu'],['へ','he'],['ほ','ho'],['ま','ma'],['み','mi'],['む','mu'],['め','me'],['も','mo'],['や','ya'],['ゆ','yu'],['よ','yo'],['ら','ra'],['り','ri'],['る','ru'],['れ','re'],['ろ','ro'],['わ','wa'],['を','wo'],['ん','n']];
const voicedH=[['が','ga'],['ぎ','gi'],['ぐ','gu'],['げ','ge'],['ご','go'],['ざ','za'],['じ','ji'],['ず','zu'],['ぜ','ze'],['ぞ','zo'],['だ','da'],['ぢ','ji'],['づ','zu'],['で','de'],['ど','do'],['ば','ba'],['び','bi'],['ぶ','bu'],['べ','be'],['ぼ','bo'],['ぱ','pa'],['ぴ','pi'],['ぷ','pu'],['ぺ','pe'],['ぽ','po']];
const combosH=[['きゃ','kya'],['きゅ','kyu'],['きょ','kyo'],['しゃ','sha'],['しゅ','shu'],['しょ','sho'],['ちゃ','cha'],['ちゅ','chu'],['ちょ','cho'],['にゃ','nya'],['にゅ','nyu'],['にょ','nyo'],['ひゃ','hya'],['ひゅ','hyu'],['ひょ','hyo'],['みゃ','mya'],['みゅ','myu'],['みょ','myo'],['りゃ','rya'],['りゅ','ryu'],['りょ','ryo'],['ぎゃ','gya'],['ぎゅ','gyu'],['ぎょ','gyo'],['じゃ','ja'],['じゅ','ju'],['じょ','jo'],['びゃ','bya'],['びゅ','byu'],['びょ','byo'],['ぴゃ','pya'],['ぴゅ','pyu'],['ぴょ','pyo']];
const smallH=[['ぁ','a'],['ぃ','i'],['ぅ','u'],['ぇ','e'],['ぉ','o'],['ゃ','ya'],['ゅ','yu'],['ょ','yo'],['ゎ','wa'],['っ','small tsu']];
const hira=[...basicH,...voicedH,...combosH,...smallH]; const kata=basicH.map(([a,r])=>[a.replace(/[\u3041-\u3096]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60)),r]); const voicedK=voicedH.map(([a,r])=>[a.replace(/[\u3041-\u3096]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60)),r]); const comboK=combosH.map(([a,r])=>[a.replace(/[\u3041-\u3096]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60)),r]);
const smallK=smallH.map(([a,r])=>[a.replace(/[\u3041-\u3096]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60)),r]);
const extraK=[['ヴ','vu']];
const kanaData={hiragana:hira,katakana:[...kata,...voicedK,...comboK,...smallK,...extraK]};
const kanaTest={kind:'hiragana',questions:[],index:0,answers:{},startedAt:0,timerSeconds:0,timerLeft:0,timerHandle:null,finished:false};
function stopAssessmentTimer(){ if(kanaTest.timerHandle){clearInterval(kanaTest.timerHandle);kanaTest.timerHandle=null;} }
function fmtAssessmentClock(sec){sec=Math.max(0,Math.floor(Number(sec)||0));return `${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`;}
async function getAssessmentTimer(key){ if(!sbReady)return 0; try{const {data}=await supabase.from('timer_settings').select('per_question').eq('id',1).maybeSingle();const cfg=parseJSON(data?.per_question,{});return Number(cfg?.[`__test_${key}`]||0);}catch{return 0;} }
function startKanaAssessmentTimer(){ stopAssessmentTimer(); if(kanaTest.timerSeconds<=0)return; const paint=()=>{const el=document.querySelector('#kanaTestTimer');if(el)el.textContent=`⏱ ${fmtAssessmentClock(kanaTest.timerLeft)}`;}; paint(); kanaTest.timerHandle=setInterval(()=>{if(kanaTest.finished)return stopAssessmentTimer();kanaTest.timerLeft--;paint();if(kanaTest.timerLeft<=0){kanaTest.timerLeft=0;stopAssessmentTimer();kanaTest.finished=true;finishKanaTest(true);}},1000); }
function kanaSlug(ch){ return [...ch].map(c=>c.codePointAt(0).toString(16).padStart(5,'0')).join('-'); }
function kanaCard(item,kind,index){ const [char,romaji]=item; return `<button type="button" class="kana-flip fx-card" data-kana-index="${index}" aria-label="Huruf ${esc(char)}, dibaca ${esc(romaji)}"><span class="kana-inner"><span class="kana-face kana-front"><span class="kana-char">${esc(char)}</span><small>Ketuk untuk melihat animasi</small></span></span></button>`; }
async function kana(){
  await loadBranding(); const kind=state.kanaKind||'hiragana'; const data=kanaData[kind]; const partNo=kind==='hiragana'?13:14;
  shell(`<section class="section kana-page"><div class="section-title"><div><div class="eyebrow">あ Kana</div><h2>${kind==='hiragana'?'Hiragana':'Katakana'}</h2><p class="muted">Ketuk kartu untuk membuka panel besar berisi huruf, cara baca, dan animasi urutan goresannya.</p></div></div><div class="kana-test-card fx-float fx-ring"><div><div class="eyebrow">TES ${kind==='hiragana'?'HIRAGANA · PART 13':'KATAKANA · PART 14'}</div><h3>Uji semua ${kind==='hiragana'?'Hiragana':'Katakana'} dasar</h3><p>Kerjakan tes melalui Part latihan agar soal dan hasilnya tercatat bersama latihan Part lainnya.</p></div><button type="button" class="btn red" id="goKanaPart">Buka Part ${partNo}</button></div><div class="kana-test-card fx-float fx-ring"><div><div class="eyebrow">TES GABUNGAN · PART 15</div><h3>Tes Hiragana &amp; Katakana</h3><p>Uji pemahaman Hiragana dan Katakana dalam satu tes gabungan.</p></div><button type="button" class="btn red" id="goKanaCombined">Buka Part 15</button></div><div class="segmented"><button class="seg ${kind==='hiragana'?'active':''}" data-kind="hiragana">Hiragana</button><button class="seg ${kind==='katakana'?'active':''}" data-kind="katakana">Katakana</button></div><div class="kana-grid" id="kanaGrid">${data.map((x,i)=>kanaCard(x,kind,i)).join('')}</div></section>`); bindKana();
  const goPart=n=>{try{sessionStorage.setItem('itco_open_part_number',String(n));}catch{}location.hash='#latihan';};
  document.querySelector('#goKanaPart')?.addEventListener('click',()=>goPart(partNo));
  document.querySelector('#goKanaCombined')?.addEventListener('click',()=>goPart(15));
}
function bindKana(){
  document.querySelectorAll('.seg').forEach(b=>b.onclick=()=>{b.classList.add('interaction-wiggle','click-glow');setTimeout(()=>{state.kanaKind=b.dataset.kind;renderRoute()},260)});
  const grid=document.querySelector('#kanaGrid'); if(!grid)return;
  const list=kanaData[state.kanaKind||'hiragana'].map(([char,romaji])=>({glyph:char,reading:romaji,meaning:'',animate:true}));
  grid.onclick=e=>{ const card=e.target.closest('.kana-flip'); if(card)openStudy(list,Number(card.dataset.kanaIndex)); };
}


function makeKanaTest(kind='hiragana'){
  const base=(kind==='katakana'?kata:basicH).map(([char,romaji])=>({char,romaji})).sort(()=>Math.random()-.5);
  return base.map(x=>{const forward=Math.random()<.5;const correct=forward?x.romaji:x.char;const pool=base.filter(y=>y.char!==x.char).map(y=>forward?y.romaji:y.char).sort(()=>Math.random()-.5).slice(0,3);return {...x,forward,correct,options:[correct,...pool].sort(()=>Math.random()-.5)};});
}
async function tesKana(kind='hiragana'){await loadBranding();stopAssessmentTimer();kanaTest.kind=kind;kanaTest.questions=makeKanaTest(kind);kanaTest.index=0;kanaTest.answers={};kanaTest.startedAt=Date.now();kanaTest.finished=false;kanaTest.timerSeconds=await getAssessmentTimer(kind==='katakana'?'katakana_46':'hiragana_46');kanaTest.timerLeft=kanaTest.timerSeconds;await recordActivity(`${kind}_test_start`,{total:46,timer_seconds:kanaTest.timerSeconds});renderKanaQuestion();}
function renderKanaQuestion(){const q=kanaTest.questions[kanaTest.index];if(!q)return;const kind=kanaTest.kind,label=kind==='katakana'?'Katakana':'Hiragana',selected=kanaTest.answers[kanaTest.index]||'';shell(`<section class="section hira-test-page"><div class="section-title"><div><div class="eyebrow">TES ${label.toUpperCase()} · ${kanaTest.index+1}/46</div><h2>46 ${label} Dasar</h2><p class="muted">Setiap huruf hanya muncul sekali dalam tes ini.</p></div><div id="kanaTestTimer" class="timer-text"></div></div><div class="hira-progress"><i style="width:${((kanaTest.index+1)/46)*100}%"></i></div><div class="hira-question-card fx-float fx-ring"><div class="hira-direction">${q.forward?'HURUF → ROMAJI':'ROMAJI → HURUF'}</div><div class="hira-prompt">${esc(q.forward?q.char:q.romaji)}</div><p class="muted">${q.forward?'Pilih cara baca yang benar.':`Pilih ${label} yang benar.`}</p></div><div class="hira-options">${q.options.map((o,i)=>`<button type="button" class="btn hira-option ${norm(selected)===norm(o)?'selected':''}" data-kana-answer="${esc(o)}">${choiceLabel(i)}. ${esc(o)}</button>`).join('')}</div><div class="exercise-nav"><button class="btn" id="kanaPrev" ${kanaTest.index===0?'disabled':''}>← Sebelumnya</button><button class="btn red" id="kanaNext">${kanaTest.index===45?'Selesai':'Selanjutnya →'}</button></div></section>`);startKanaAssessmentTimer();document.querySelectorAll('[data-kana-answer]').forEach(b=>b.onclick=()=>{kanaTest.answers[kanaTest.index]=b.dataset.kanaAnswer;recordActivity(`${kind}_answer`,{number:kanaTest.index+1,answer:b.dataset.kanaAnswer});document.querySelectorAll('[data-kana-answer]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');});document.querySelector('#kanaPrev').onclick=()=>{if(kanaTest.index>0){kanaTest.index--;renderKanaQuestion();}};document.querySelector('#kanaNext').onclick=()=>{if(kanaTest.index===45)finishKanaTest(false);else{kanaTest.index++;renderKanaQuestion();}};}
async function finishKanaTest(timedOut=false){if(kanaTest.finished&&timedOut===false)return;kanaTest.finished=true;stopAssessmentTimer();const kind=kanaTest.kind,label=kind==='katakana'?'Katakana':'Hiragana',duration=Math.max(0,Math.round((Date.now()-kanaTest.startedAt)/1000));const details=kanaTest.questions.map((q,i)=>({number:i+1,kana:q.char,hiragana:q.char,romaji:q.romaji,direction:q.forward?'kana_to_romaji':'romaji_to_kana',user_answer:kanaTest.answers[i]||'',correct_answer:q.correct,correct:norm(kanaTest.answers[i])===norm(q.correct)}));const correct=details.filter(x=>x.correct).length,unanswered=details.filter(x=>!x.user_answer).length,wrong=details.length-correct-unanswered,score=Math.round(correct/46*100);if(sbReady&&state.user){const {error}=await supabase.from('assessment_results').insert({user_id:state.user.id,test_type:`${kind}_46`,score,correct_count:correct,wrong_count:wrong,unanswered_count:unanswered,duration_seconds:duration,details});if(error)console.warn(`Hasil Tes ${label} belum tersimpan:`,error.message);}await recordActivity(`${kind}_test_finish`,{score,correct,wrong,unanswered,duration_seconds:duration,timed_out:timedOut});shell(`<section class="section result hira-result"><div class="result-card fx-float fx-ring"><div class="eyebrow">HASIL TES ${label.toUpperCase()}</div><h1>${score}<small>/100</small></h1><div class="result-stats"><span>Benar <b>${correct}</b></span><span>Salah <b>${wrong}</b></span><span>Tidak dijawab <b>${unanswered}</b></span></div><p class="muted">Waktu pengerjaan: ${Math.floor(duration/60)} menit ${duration%60} detik${timedOut?' · ⏰ Waktu habis':''}</p></div><div class="review-list"><h2>Review 46 Huruf</h2>${details.map(x=>`<article class="review ${x.correct?'ok':'bad'}"><b>${x.number}. ${esc(x.kana)} ↔ ${esc(x.romaji)}</b><span>Jawaban kamu: ${esc(x.user_answer)||'—'}</span><span>Jawaban benar: ${esc(x.correct_answer)}</span></article>`).join('')}</div><a class="cta" href="#akun">Lihat hasil di Akun</a></section>`);}
async function tesHiragana(){return tesKana('hiragana');}
async function tesKatakana(){return tesKana('katakana');}


async function kaiwa(){
  await loadBranding();
  let rows=[];
  if(sbReady){ const r=await supabase.from('bunpou').select('*').eq('active',true).order('sort_order').order('created_at'); if(r.error) console.warn('Bunpou database belum terbaca, memakai materi bawaan:',r.error.message); else rows=r.data||[]; }
  const mergedBunpou=new Map(bunpouRowsToDefaults(defaultBunpou).map(x=>[`${x.category||'bunpou'}|${x.title||x.pattern}`,x])); (rows||[]).map(normalizeBunpou).forEach(x=>mergedBunpou.set(`${x.category||'bunpou'}|${x.title||x.pattern}`,x)); rows=[...mergedBunpou.values()];
  shell(`<section class="section kaiwa-page"><div class="section-title"><div><div class="eyebrow">会話 · KAIWA</div><h2>Bunpou & Percakapan</h2><p class="muted">Pelajari partikel dan pola kalimat lengkap dengan contoh dan percakapannya.</p></div></div><div class="bunpou-intro"><b>Cara pakai:</b> ketuk salah satu judul untuk membuka fungsi, bentuk, contoh, dan percakapannya.</div><div class="bunpou-tabs"><button class="bunpou-tab active" data-filter="all">Semua</button><button class="bunpou-tab" data-filter="partikel">Partikel</button><button class="bunpou-tab" data-filter="bunpou">Bunpou</button></div><div id="bunpouList" class="bunpou-list"></div></section>`);
  const renderFiltered=(filter)=>{ const filtered=rows.filter(x=>filter==='all'||x.category===filter); document.querySelector('#bunpouList').innerHTML=filtered.map((x,i)=>renderBunpouCard(x,rows.indexOf(x))).join(''); runFx(); document.querySelectorAll('[data-bunpou-index]').forEach(b=>b.onclick=()=>{const x=rows[Number(b.dataset.bunpouIndex)]; if(!x)return; document.body.insertAdjacentHTML('beforeend',renderBunpouDetail(x)); const modal=document.querySelector('#bunpouModal'); document.querySelector('#bunpouClose').onclick=()=>modal.remove(); modal.onclick=e=>{if(e.target===modal)modal.remove();}; document.addEventListener('keydown',function close(ev){if(ev.key==='Escape'){modal.remove();document.removeEventListener('keydown',close);}}, {once:true});}); };
  document.querySelectorAll('.bunpou-tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.bunpou-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderFiltered(b.dataset.filter);});
  renderFiltered('all');
}
const fmtClock=n=>{n=Math.max(0,Math.floor(n));const h=Math.floor(n/3600),m=Math.floor(n%3600/60),r=n%60,mm=String(m).padStart(2,'0'),rr=String(r).padStart(2,'0');return h?`${h}:${mm}:${rr}`:`${mm}:${rr}`;};
const fmtDur=n=>{n=Math.floor(Number(n)||0);const m=Math.floor(n/60),r=n%60;return [m?`${m} menit`:'',r?`${r} detik`:''].filter(Boolean).join(' ')||'0 detik';};
function partBadge(p){ if(p.setup_mode==='user')return 'Atur sendiri: jumlah soal & waktu'; const a=[p.question_limit?`${p.question_limit} soal`:'Semua soal']; if(Number(p.timer_seconds)>0)a.push(fmtDur(p.timer_seconds)); return a.join(' · '); }
async function latihan(){
  await loadBranding();
  const {data,error}=await q('parts',{order:'part_number'});
  if(error)console.error(error);
  const rows=data||[];
  const now=Date.now();const partIsOpen=x=>{const start=x.scheduled_start_at?new Date(x.scheduled_start_at).getTime():0,end=x.scheduled_end_at?new Date(x.scheduled_end_at).getTime():0;if(start&&now<start)return false;if(end&&now>=end)return false;return x.active!==false||!!(start&&now>=start&&(!end||now<end));};
  shell(`<section class="section"><div class="section-title"><div><div class="eyebrow">✎ Mengerjakan Soal</div><h2>Pilih Part</h2><p class="muted">Pilih Part yang ingin dikerjakan. Kamu akan diminta mengisi nama sebelum mulai.</p></div></div>${rows.length?`<div class="part-list">${rows.map(x=>{const active=partIsOpen(x),start=x.scheduled_start_at?new Date(x.scheduled_start_at).getTime():0,end=x.scheduled_end_at?new Date(x.scheduled_end_at).getTime():0;const waiting=!!start&&now<start;return `<div class="part-card fx-card fx-ring ${active?'':'part-disabled'}" data-part="${x.id}" data-start="${waiting?start:''}" role="button" tabindex="${active?'0':'-1'}" aria-disabled="${active?'false':'true'}"><span class="tag">PART ${String(x.part_number).padStart(2,'0')}</span><h3>${esc(x.name)}</h3><p class="part-desc">${esc(x.description||'Latihan soal untuk Part ini.')}</p>${waiting?`<div class="part-countdown"><span>Soal akan dibuka dalam</span><strong data-countdown="${start}">--:--:--</strong><button type="button" class="btn part-refresh" hidden data-refresh-part>⟳ Refresh Sekarang</button></div>`:end&&now>=end?'<b>Jadwal telah berakhir</b>':`<b>${esc(partBadge(x))}</b>`}</div>`}).join('')}</div>`:`<div class="empty">Belum ada Part latihan.</div>`}</section>`);
  const countdownTick=()=>{let done=false;document.querySelectorAll('[data-countdown]').forEach(el=>{const left=Math.max(0,Math.ceil((Number(el.dataset.countdown)-Date.now())/1000));if(left<=0){el.textContent='00:00:00';const refresh=el.parentElement.querySelector('[data-refresh-part]');if(refresh)refresh.hidden=false;done=true;}else{const h=Math.floor(left/3600),m=Math.floor(left%3600/60),sec=left%60;el.textContent=[h,m,sec].map(v=>String(v).padStart(2,'0')).join(':');}});};countdownTick();if(window.partCountdownTimer)clearInterval(window.partCountdownTimer);window.partCountdownTimer=setInterval(countdownTick,1000);document.querySelectorAll('[data-refresh-part]').forEach(b=>b.onclick=e=>{e.stopPropagation();location.reload()});
  document.querySelectorAll('[data-part][aria-disabled="false"]').forEach(b=>{const open=()=>{b.classList.add('interaction-wiggle','click-glow');setTimeout(()=>openSetup(b.dataset.part,rows),260)};b.onclick=e=>{if(e.target.closest('[data-refresh-part]'))return;open()};b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}});
  let targetNo=0;try{targetNo=Number(sessionStorage.getItem('itco_open_part_number')||0);sessionStorage.removeItem('itco_open_part_number');}catch{}
  if(targetNo){const target=rows.find(x=>Number(x.part_number)===targetNo);const card=target&&document.querySelector(`[data-part="${target.id}"]`);if(target&&card?.getAttribute('aria-disabled')==='false'){setTimeout(()=>{card.scrollIntoView({behavior:'smooth',block:'center'});card.classList.add('click-glow');openSetup(target.id,rows);},220);}else if(target){card?.scrollIntoView({behavior:'smooth',block:'center'});alert(`Part ${targetNo} belum aktif atau belum tersedia. Silakan cek pengaturan Part di admin.`);}}
}
// Form sebelum mulai: nama selalu diisi. Kalau Part diatur User, user juga mengisi jumlah soal & waktu sendiri.
async function openSetup(id,parts){
  const p=(parts||[]).find(x=>String(x.id)===String(id)); if(!p)return;
  const {data,error}=await q('questions',{eq:{part_id:p.id},select:'id'});
  if(error){alert(error.message);return}
  const total=(data||[]).length;
  if(!total){alert('Part ini belum memiliki soal aktif.');return}
  const user=p.setup_mode==='user';
  let saved=userName(state.user); if(!saved){try{saved=localStorage.getItem('itco_name')||'';}catch{}}
  document.querySelector('#setupModal')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="bunpou-modal-backdrop" id="setupModal"><form class="bunpou-modal setup-modal" id="setupForm" novalidate role="dialog" aria-modal="true" aria-labelledby="suTitle"><button type="button" class="bunpou-close" id="suClose" aria-label="Tutup">×</button><div class="bunpou-tag">PART ${String(p.part_number).padStart(2,'0')}</div><h2 id="suTitle">${esc(p.name)}</h2><p class="muted setup-info">${user?`Atur latihanmu sendiri. Tersedia <b>${total}</b> soal.`:esc(partBadge(p))}</p><label class="setup-field"><span>Nama</span><input class="input" id="suName" maxlength="60" autocomplete="name" placeholder="Tulis namamu" value="${esc(saved)}"></label>${user?`<label class="setup-field"><span>Jumlah soal</span><input class="input" id="suCount" type="number" inputmode="numeric" min="1" max="${total}" value="${total}"></label><div class="setup-field"><span>Waktu <small>(kosongkan jika tanpa batas waktu)</small></span><div class="setup-time"><label><input class="input" id="suMin" type="number" inputmode="numeric" min="0" placeholder="0"><small>menit</small></label><label><input class="input" id="suSec" type="number" inputmode="numeric" min="0" placeholder="0"><small>detik</small></label></div></div>`:''}<div class="setup-error" id="suErr" role="alert"></div><div class="setup-actions"><button type="button" class="btn" id="suCancel">Batal</button><button type="submit" class="btn red">Mulai</button></div></form></div>`);
  const modal=document.querySelector('#setupModal'), form=document.querySelector('#setupForm'), err=document.querySelector('#suErr');
  const close=()=>{document.removeEventListener('keydown',onEsc);modal.remove();};
  const onEsc=ev=>{if(ev.key==='Escape')close();};
  document.addEventListener('keydown',onEsc);
  document.querySelector('#suClose').onclick=close; document.querySelector('#suCancel').onclick=close;
  modal.onclick=e=>{if(e.target===modal)close();};
  const fail=(m,el)=>{err.textContent=m;el?.focus();};
  form.onsubmit=e=>{
    e.preventDefault(); err.textContent='';
    const nameEl=document.querySelector('#suName'), name=nameEl.value.trim();
    if(!name)return fail('Nama wajib diisi.',nameEl);
    let count=0,seconds=0;
    if(user){
      const cEl=document.querySelector('#suCount'), c=Number(cEl.value);
      if(!Number.isInteger(c)||c<1)return fail('Isi jumlah soal dengan angka bulat, minimal 1.',cEl);
      if(c>total)return fail(`Jumlah soal maksimal ${total}, sesuai soal yang tersedia.`,cEl);
      const m=Number(document.querySelector('#suMin').value||0), sc=Number(document.querySelector('#suSec').value||0);
      if(!Number.isFinite(m)||!Number.isFinite(sc)||m<0||sc<0)return fail('Waktu tidak boleh negatif.',document.querySelector('#suMin'));
      count=c; seconds=Math.round(m*60+sc);
    }
    try{localStorage.setItem('itco_name',name);}catch{}
    close(); state.part=p; state.name=name; state.setup={count,seconds}; startExercise();
  };
  document.querySelector('#suName').focus({preventScroll:true});
}
async function startExercise(){ const {data,error}=await q('questions',{eq:{part_id:state.part.id,active:true},order:'created_at'}); if(error){alert(error.message);return} if(!data?.length){alert('Part ini belum memiliki soal aktif.');return} let qs=[...data]; if(state.part.shuffle_questions)qs.sort(()=>Math.random()-.5); const user=state.part.setup_mode==='user'; const limit=user?state.setup?.count:state.part.question_limit; if(limit)qs=qs.slice(0,limit); state.questions=qs;state.index=0;state.answers={};state.doubts={};state.reviewed={};state.review=false;state.timedOut=false;state.exerciseActive=true;state.exerciseHash=location.hash||'#latihan';await recordActivity('exercise_start',{part:state.part?.name,part_id:state.part?.id,total_questions:qs.length});await loadTimerSettings();initTimers();renderExercise(); }
async function loadTimerSettings(){ state.timerSettings=null; if(!sbReady||state.part.setup_mode==='user')return; const {data}=await supabase.from('timer_settings').select('*').eq('id',1).maybeSingle();state.timerSettings=data||null; }
// Timer total (satu Part) berjalan terus selama latihan; timer per soal (opsional dari Kelola Timer) mulai ulang tiap pindah soal.
// Part "Diatur User": hanya waktu pilihan user yang dipakai.
function initTimers(){
  stopTimer();
  const p=state.part, user=p.setup_mode==='user';
  let total=0; state.perQ={};
  if(user)total=Number(state.setup?.seconds||0);
  else{
    total=Number(p.timer_seconds||0);
    const t=state.timerSettings;
    if(t?.enabled){ const pp=parseJSON(t.per_part,{}); if(!total)total=Number(pp[p.id]||pp[String(p.part_number)]||t.global_seconds||0); state.perQ=parseJSON(t.per_question,{}); }
  }
  state.totalOn=total>0; state.totalLeft=total; state.endAt=total>0?Date.now()+total*1000:0; state.qOn=false; state.qLeft=0; state.qFor=-1;
  state.timer=setInterval(tick,1000);
}
function syncQuestionTimer(x){
  if(state.qFor!==state.index){ state.qFor=state.index; const pq=state.perQ||{}; const sec=Number(pq[x.id]||pq[String(state.index+1)]||0); state.qOn=sec>0; state.qLeft=sec; }
  renderTimerOnly();
}
function tick(){
  if(state.totalOn){ state.totalLeft=state.endAt?Math.max(0,Math.ceil((state.endAt-Date.now())/1000)):state.totalLeft-1; if(state.totalLeft<=0){ state.totalLeft=0; state.timedOut=true; renderTimerOnly(); finish(); return; } }
  if(state.qOn){ state.qLeft--; if(state.qLeft<=0){ if(state.index>=state.questions.length-1&&!pendingIdx(state.index).length){ state.timedOut=true; finish(); return; } goNext(false,true); return; } }
  renderTimerOnly();
}
function stopTimer(){if(state.timer)clearInterval(state.timer);state.timer=null;}
function renderTimerOnly(){const el=document.querySelector('#timerText');if(!el)return;const parts=[];if(state.totalOn)parts.push(`⏱ ${fmtClock(state.totalLeft)}`);if(state.qOn)parts.push(`Soal ${fmtClock(state.qLeft)}`);el.textContent=parts.join(' · ');el.classList.toggle('low',(state.totalOn&&state.totalLeft<=10)||(state.qOn&&state.qLeft<=5));}
function answerFor(x){return x.answer??'';}
function matchingPairs(x){return parseJSON(x.options,[]).filter(p=>p&&p.left!==undefined&&p.right!==undefined);}
function renderExercise(){ const x=state.questions[state.index]; x.prompt=String(x.prompt||'').replace(/\(Lihat gambar \/ dengarkan audio\)/g,'').trim(); let opts=parseJSON(x.options,[]);if(!Array.isArray(opts))opts=[];if(state.part.shuffle_options && x.type!=='matching')opts=[...opts].sort(()=>Math.random()-.5);const current=state.answers[x.id];const mediaUrl=x.media_url||'';const mediaType=(x.media_type||'').toLowerCase();const inferredImage=!mediaType&&/\.(?:png|jpe?g|webp|gif|svg)(?:\?|$)/i.test(mediaUrl);const inferredAudio=!mediaType&&/\.(?:mp3|wav|ogg|m4a|aac|flac)(?:\?|$)/i.test(mediaUrl);const photo=x.photo_url||(mediaType==='image'||inferredImage?mediaUrl:'');const audio=x.audio_url||(mediaType==='audio'||inferredAudio?mediaUrl:'');const media=`${photo?`<div class="question-media photo-media"><div class="media-label">📷 Foto</div><img class="media" loading="lazy" src="${esc(photo)}" alt="Foto soal" onerror="this.closest('.photo-media')?.classList.add('media-error')"></div>`:''}${audio?`<div class="question-media audio-media"><div class="media-label">🔊 Audio</div><audio class="media" controls preload="metadata" src="${esc(audio)}"></audio></div>`:''}${(!photo&&!audio)?'':''}`;let instruction=x.instruction||'';if(x.type==='typing')instruction=typingInstruction(x.answer);else if(x.type==='kanji_input')instruction='Masukkan Kanji yang sesuai.';else if(x.type==='multiple_choice'||x.type==='kanji_choice')instruction=x.type==='kanji_choice'?'Pilih Kanji yang sesuai dengan arti tersebut.':'Pilih jawaban yang paling tepat.';else if(x.type==='truefalse')instruction='Tentukan apakah pernyataan berikut benar atau salah.';else if(x.type==='matching')instruction='Pasangkan setiap kata dengan pasangan yang tepat.';let body='';if(x.type==='truefalse')body=`<div class="answers"><button class="btn answer live-card ${norm(current)==='benar'?'selected':''}" data-answer="Benar">A. Benar</button><button class="btn answer live-card ${norm(current)==='salah'?'selected':''}" data-answer="Salah">B. Salah</button></div>`;else if(x.type==='typing'||x.type==='kanji_input')body=`<div class="answer-field live-card still"><input id="typing" class="input" placeholder="Ketik jawaban..." value="${esc(current||'')}"></div>`;else if(x.type==='matching'){const pairs=matchingPairs(x);const chosen=parseJSON(current,{});body=`<div class="matching-list">${pairs.map(p=>`<div class="matching-row live-card still"><span>${esc(p.left)}</span><select class="input match-select" data-left="${esc(p.left)}"><option value="">Pilih...</option>${pairs.map(q=>`<option value="${esc(q.right)}" ${chosen[p.left]===q.right?'selected':''}>${esc(q.right)}</option>`).join('')}</select></div>`).join('')}</div>`;}else body=`<div class="answers">${opts.map((o,i)=>`<button class="btn answer live-card ${norm(current)===norm(o)?'selected':''}" data-answer="${esc(o)}">${choiceLabel(i)}. ${esc(o)}</button>`).join('')}</div>`;document.body.classList.add('exercise-mode');saveSession();const flagged=!!state.doubts[x.id],pendOthers=pendingIdx(state.index).length,isLast=state.review?pendOthers===0:state.index===state.questions.length-1;shell(`<section class="section exercise"><div class="exercise-head"><div><div class="eyebrow">${esc(state.part.name)} · ${state.index+1}/${state.questions.length}</div><div id="timerText" class="timer-text"></div></div><button type="button" class="doubt-btn ${flagged?'on':''}" id="doubt">🤔 ${flagged?'Ditandai ragu':'Ragu-ragu'}</button></div><div class="progress"><i style="width:${((state.index+1)/state.questions.length)*100}%"></i></div>${state.review?`<div class="review-banner">↩ Kembali ke soal yang ragu-ragu / belum dijawab${pendOthers?` · sisa ${pendOthers} lagi`:''}</div>`:''}<div class="question-block live-card">${promptText(x.prompt).length<35?`<div class="question">${renderPromptHTML(x.prompt)}</div>`:`<h2 class="question-long">${renderPromptHTML(x.prompt)}</h2>`}${x.reading?`<div class="reading">${esc(x.reading)}</div>`:''}${media}</div><p class="instruction">${esc(instruction)}</p>${body}<div class="exercise-nav"><button class="btn" id="prev" ${state.index===0?'disabled':''}>← Sebelumnya</button><button class="btn red" id="next">${isLast?'Selesai':'Selanjutnya →'}</button></div></section>`);document.querySelectorAll('.answer').forEach(b=>b.onclick=()=>{state.answers[x.id]=b.dataset.answer;delete state.doubts[x.id];recordActivity('answer_selected',{part:state.part?.name,question_id:x.id,question_number:state.index+1,answer:b.dataset.answer});b.classList.add('interaction-wiggle','click-glow');setTimeout(()=>renderExercise(),260)});const inp=document.querySelector('#typing');if(inp)inp.oninput=()=>{state.answers[x.id]=inp.value;if(inp.value.trim())delete state.doubts[x.id];saveSession();};document.querySelectorAll('.match-select').forEach(s=>s.onchange=()=>{const v={...parseJSON(state.answers[x.id],{})};v[s.dataset.left]=s.value;state.answers[x.id]=JSON.stringify(v);saveSession();});document.querySelector('#prev').onclick=()=>{if(state.index>0){state.index--;document.querySelector('#prev').classList.add('interaction-wiggle','click-glow');setTimeout(()=>renderExercise(),260)}};document.querySelector('#next').onclick=()=>{if(inp)state.answers[x.id]=inp.value;document.querySelector('#next').classList.add('interaction-wiggle','click-glow');setTimeout(()=>goNext(false),260)};document.querySelector('#doubt').onclick=()=>{if(inp)state.answers[x.id]=inp.value;if(state.doubts[x.id]){delete state.doubts[x.id];renderExercise();}else{state.doubts[x.id]=true;delete state.reviewed[x.id];goNext(true);}};syncLive();syncQuestionTimer(x); }

// ===== Ragu-ragu, fokus mengerjakan, dan lanjut setelah keluar =====
const SESSION_KEY='itco_exercise_session';
function hasAnswer(x){const v=state.answers[x.id];if(v==null)return false;if(x.type==='matching'){const o=parseJSON(v,{}),pr=matchingPairs(x);return pr.length>0&&pr.every(p=>o[p.left]);}return String(v).trim()!=='';}
function pendingIdx(exclude){return state.questions.map((x,k)=>k).filter(k=>{const x=state.questions[k];return k!==exclude&&!state.reviewed[x.id]&&(state.doubts[x.id]||!hasAnswer(x));});}
function goNext(fromDoubt,force){
  const n=state.questions.length,i=state.index,cur=state.questions[i];
  if(!fromDoubt&&state.review){state.reviewed[cur.id]=true;delete state.doubts[cur.id];}
  if(!state.review&&i<n-1){state.index++;renderExercise();return;}
  const pend=pendingIdx(i);
  if(pend.length){state.review=true;state.index=pend.find(k=>k>i)??pend[0];renderExercise();return;}
  const blank=state.questions.filter(x=>!hasAnswer(x)).length;
  if(blank>0&&!force&&!confirm(`Masih ada ${blank} soal yang belum dijawab. Selesaikan sekarang?`)){delete state.reviewed[cur.id];renderExercise();return;}
  finish();
}
function saveSession(){try{if(!state.exerciseActive||!state.part)return;localStorage.setItem(SESSION_KEY,JSON.stringify({v:1,userId:state.user?.id||null,part:state.part,name:state.name,setup:state.setup,questions:state.questions,index:state.index,answers:state.answers,doubts:state.doubts,reviewed:state.reviewed,review:state.review,endAt:state.endAt||0,savedAt:Date.now()}));}catch{}}
function clearSession(){try{localStorage.removeItem(SESSION_KEY);}catch{}}
function readSession(){try{const s=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');if(!s||s.v!==1||!Array.isArray(s.questions)||!s.questions.length||!s.part)return null;if((s.userId||null)!==(state.user?.id||null))return null;if(s.endAt&&Date.now()>s.endAt+1000){clearSession();return null;}return s;}catch{return null;}}
function exerciseEnd(){state.exerciseActive=false;document.body.classList.remove('exercise-mode');clearSession();}
async function resumeExercise(sess){
  Object.assign(state,{part:sess.part,name:sess.name,setup:sess.setup,questions:sess.questions,index:Math.min(sess.index||0,sess.questions.length-1),answers:sess.answers||{},doubts:sess.doubts||{},reviewed:sess.reviewed||{},review:!!sess.review,timedOut:false,exerciseActive:true,exerciseHash:'#latihan'});
  await loadTimerSettings();initTimers();
  if(sess.endAt){state.endAt=sess.endAt;state.totalOn=true;state.totalLeft=Math.max(0,Math.ceil((sess.endAt-Date.now())/1000));}
  if(state.totalOn&&state.totalLeft<=0){state.timedOut=true;await finish();return;}
  renderExercise();
}
function showLeaveModal(opts={}){
  if(document.querySelector('#leaveModal'))return;
  const sess=opts.sess||null,partName=esc((sess?.part||state.part)?.name||'Part'),total=(sess?.questions||state.questions).length,idx=(sess?sess.index:state.index)+1,timed=sess?!!sess.endAt:state.totalOn;
  document.body.insertAdjacentHTML('beforeend',`<div class="bunpou-modal-backdrop" id="leaveModal"><div class="bunpou-modal setup-modal" role="dialog" aria-modal="true"><h2 style="margin-top:0">Soal belum selesai</h2><p class="muted">Kamu sedang mengerjakan <b>${partName}</b> (soal ${idx} dari ${total}).${timed?' Waktu tetap berjalan.':''} Mau lanjut atau kembali ke halaman?</p><div style="display:grid;gap:10px;margin-top:14px"><button type="button" class="cta" id="leaveContinue">▶ Lanjut Mengerjakan</button><button type="button" class="btn" id="leaveBack">← Kembali ke Halaman</button></div></div></div>`);
  document.querySelector('#leaveContinue').onclick=async()=>{document.querySelector('#leaveModal')?.remove();if(sess&&!state.exerciseActive)await resumeExercise(sess);};
  document.querySelector('#leaveBack').onclick=()=>{document.querySelector('#leaveModal')?.remove();try{recordActivity('exercise_abandon',{part:(sess?.part||state.part)?.name});}catch{}stopTimer();const t=opts.target&&opts.target!==(state.exerciseHash||'#latihan')?opts.target:'#latihan';exerciseEnd();if(location.hash===t)renderRoute();else location.hash=t;};
}
async function checkResumeSession(){const s=readSession();if(s&&!state.exerciseActive)showLeaveModal({sess:s});}
document.addEventListener('visibilitychange',()=>{if(document.hidden){state.leftAt=Date.now();return;}if(state.exerciseActive&&state.leftAt&&Date.now()-state.leftAt>1500){state.leftAt=0;showLeaveModal({});}});
window.addEventListener('beforeunload',e=>{if(state.exerciseActive){saveSession();e.preventDefault();e.returnValue='';}});
function syncLive(){const d=`-${((performance.now()%20000)/1000).toFixed(3)}s`;document.querySelectorAll('.live-card').forEach(e=>e.style.setProperty('--fxd',d));}
async function finish(){stopTimer();exerciseEnd();let correct=0;const reviews=state.questions.map(x=>{let user=state.answers[x.id]??'';let ans=answerFor(x);let ok=false;if(x.type==='matching'){const a=parseJSON(user,{}),b=parseJSON(ans,{});ok=matchingPairs(x).every(p=>norm(a[p.left])===norm(p.right));}else ok=norm(user)===norm(ans);if(ok)correct++;return {...x,user,ok};});const total=reviews.length,unanswered=reviews.filter(x=>!String(x.user||'').trim()).length,accuracy=total?Math.round(correct/total*100):0;state.result={correct,total,accuracy,reviews};await recordActivity('exercise_finish',{part:state.part?.name,score:accuracy,correct,total});if(sbReady){await supabase.from('user_names').upsert({name:state.name},{onConflict:'name'});const resultRow={user_id:state.user?.id||null,name:state.name,part_id:state.part.id,score:accuracy,correct_count:correct,wrong_count:total-correct-unanswered,unanswered_count:unanswered,details:reviews.map(x=>({question:x.prompt,user_answer:x.user,correct_answer:x.answer,correct:x.ok,type:x.type}))};const saved=await supabase.from('results').insert(resultRow);if(saved.error&&/user_id|column/i.test(saved.error.message||'')){delete resultRow.user_id;await supabase.from('results').insert(resultRow);}}renderResult();}
function renderResult(){const r=state.result; shell(`<section class="section result"><div class="result-card fx-float fx-ring"><div class="eyebrow">HASIL LATIHAN</div><h1>${esc(state.name)}</h1>${state.timedOut?'<p class="muted">⏰ Waktu habis. Soal yang belum dijawab dihitung kosong.</p>':''}<div class="score">${r.accuracy}<small>/100</small></div><div class="result-stats"><span>Benar <b>${r.correct}</b></span><span>Salah <b>${r.total-r.correct-r.reviews.filter(x=>!String(x.user||'').trim()).length}</b></span><span>Tidak dijawab <b>${r.reviews.filter(x=>!String(x.user||'').trim()).length}</b></span></div></div><div class="review-list"><h2>Review Jawaban</h2>${r.reviews.map((x,i)=>`<article class="review ${x.ok?'ok':'bad'}"><b>${i+1}. ${renderPromptHTML(x.prompt)}</b><span>Jawaban kamu: ${esc(formatAnswer(x.user,x.type))||'—'}</span><span>Jawaban benar: ${esc(formatAnswer(x.answer,x.type))}</span></article>`).join('')}</div><button class="cta" type="button" id="backToLatihan">Kembali ke Latihan</button></section>`); document.querySelector('#backToLatihan')?.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation();backToLatihan();});}
function backToLatihan(){stopTimer();if(location.hash==='#latihan')renderRoute();else location.hash='#latihan';}
function formatAnswer(v,type){if(!v)return '';if(type==='matching'){const o=parseJSON(v,{});return Object.entries(o).map(([a,b])=>`${a} = ${b}`).join(', ');}return String(v);}

async function renderRoute(){stopTimer();stopAssessmentTimer();stopKotobaTimer();window.__finishKotoba=null;closeStudy();state.page=location.hash.slice(1)||'home';if(state.user)recordActivity('page_view',{page:state.page});const b=await loadBranding(true);if(b.maintenance_enabled===true)return showMaintenance(b);if(state.page==='home')return home();if(state.page==='kanji')return kanji();if(state.page==='kana')return kana();if(state.page==='tes-hiragana')return tesHiragana();if(state.page==='tes-katakana')return tesKatakana();if(state.page==='developer')return developer();if(state.page==='akun')return account();if(state.page==='kosakata')return kosakata({state,shell,esc,norm});if(state.page==='tes-kotoba')return tesKotoba({state,shell,recordActivity,supabase,sbReady});if(state.page==='kaiwa')return kaiwa();if(state.page==='latihan')return latihan();return home();}

// Global tap interaction: subtle wiggle + ripple/glow on interactive UI.
function playInteraction(el, clientX=null, clientY=null){
  if(!el)return;
  el.classList.remove('interaction-wiggle','click-glow');
  void el.offsetWidth;
  el.classList.add('interaction-wiggle','click-glow');
  const rect=el.getBoundingClientRect();
  const x=clientX==null?rect.width/2:clientX-rect.left;
  const y=clientY==null?rect.height/2:clientY-rect.top;
  if(!el.classList.contains('kanji-flip')&&!el.classList.contains('kana-flip')){
    const ripple=document.createElement('span');
    ripple.className='click-ripple';
    ripple.style.left=`${x}px`;
    ripple.style.top=`${y}px`;
    el.appendChild(ripple);
    ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
  }
  setTimeout(()=>el.classList.remove('interaction-wiggle','click-glow'),620);
}
// Reliable internal navigation for fixed/mobile navigation and result buttons.
function bindReliableNavigation(){
  if(window.__itcoReliableNavBound)return;
  window.__itcoReliableNavBound=true;
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href^=\"#\"]');
    if(!a)return;
    const href=a.getAttribute('href');
    if(!href || href==='#')return;
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const el=a;
    try{playInteraction(el,e.clientX,e.clientY);}catch{}
    window.location.hash=href.slice(1);
  },true);
}
bindReliableNavigation();

function bindInteractionEffects(){
  if(window.__itcoInteractionBound)return;
  window.__itcoInteractionBound=true;
  document.addEventListener('click',e=>{
    const el=e.target.closest('.btn,.cta,.seg,.part-card,.feature,.social-icon,.nav a,.bottom a');
    if(!el)return;
    // Internal navigation needs a short delay so the wiggle/ripple is visible before the new view renders.
    if(el.matches('a[href^="#"]') && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey){
      e.preventDefault();
      playInteraction(el,e.clientX,e.clientY);
      const href=el.getAttribute('href');
      setTimeout(()=>{ location.hash=href.slice(1); },260);
      return;
    }
    playInteraction(el,e.clientX,e.clientY);
  });
}
bindInteractionEffects();
if('serviceWorker' in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

// ===== Akun & layar loading =====
async function account(){
  await loadBranding();
  const u=state.user, nm=userName(u); let normal=[],tests=[];
  if(sbReady&&u){
    let a=await supabase.from('results').select('id,name,score,correct_count,wrong_count,unanswered_count,details,created_at,parts(name,part_number)').eq('user_id',u.id).order('created_at',{ascending:false});if(a.error&&/user_id|column/i.test(a.error.message||''))a=await supabase.from('results').select('id,name,score,correct_count,wrong_count,unanswered_count,details,created_at,parts(name,part_number)').eq('name',nm).order('created_at',{ascending:false});const b=await supabase.from('assessment_results').select('id,test_type,score,correct_count,wrong_count,unanswered_count,duration_seconds,details,created_at').eq('user_id',u.id).order('created_at',{ascending:false});if(!a.error)normal=a.data||[]; if(!b.error)tests=b.data||[];
  }
  const cards=[...normal.map(x=>({kind:'part',date:x.created_at,data:x})),...tests.map(x=>({kind:'test',date:x.created_at,data:x}))].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const resultHTML=cards.length?cards.map(x=>x.kind==='test'?`<button type="button" class="account-result-card fx-card" data-test-id="${esc(x.data.id)}"><span class="account-result-tag">${x.data.test_type==='kotoba'?'TEST KOTOBA':`TES ${x.data.test_type==='katakana_46'?'KATAKANA':'HIRAGANA'} · 46`}</span><strong>Nilai ${x.data.score}</strong><span>Benar ${x.data.correct_count} · Salah ${x.data.wrong_count} · Tidak dijawab ${x.data.unanswered_count}</span><small>${new Date(x.date).toLocaleString('id-ID')}</small><b>Lihat Detail →</b></button>`:`<button type="button" class="account-result-card fx-card" data-result-id="${esc(x.data.id)}"><span class="account-result-tag">${esc(x.data.parts?.name||'Latihan')}</span><strong>Nilai ${x.data.score}</strong><span>Benar ${x.data.correct_count} · Salah ${x.data.wrong_count} · Tidak dijawab ${x.data.unanswered_count}</span><small>${new Date(x.date).toLocaleString('id-ID')}</small><b>Lihat Detail →</b></button>`).join(''):'<div class="account-empty">Belum ada hasil latihan.<small>Kerjakan latihan atau Tes Kana 46 untuk melihat hasilnya di sini.</small></div>';
  shell(`<section class="section account-page"><div class="account-card fx-float fx-ring"><div class="account-avatar">${esc((nm[0]||'?').toUpperCase())}</div><div class="eyebrow">Akun saya</div><h2>${esc(nm)}</h2><p class="muted">${esc(u?.email||'')}</p><button type="button" id="logoutBtn" class="btn red">Keluar</button></div><div class="account-results"><div class="section-title"><div><div class="eyebrow">HASIL LATIHAN</div><h2>Hasil Saya</h2><p class="muted">Semua hasil latihan dan Tes Kana yang kamu kerjakan.</p></div></div><div class="account-result-list">${resultHTML}</div></div></section>`);
  document.querySelector('#logoutBtn').onclick=async()=>{stopTimer();await stopUserMonitor({logout:true});try{await supabase.auth.signOut();}catch{}state.user=null;location.hash='#home';showLogin();};
  document.querySelectorAll('[data-result-id]').forEach(b=>b.onclick=()=>{const x=normal.find(r=>String(r.id)===b.dataset.resultId);if(x)showAccountResult(x,false);});
  document.querySelectorAll('[data-test-id]').forEach(b=>b.onclick=()=>{const x=tests.find(r=>String(r.id)===b.dataset.testId);if(x)showAccountResult(x,true);});
  await recordActivity('open_account',{result_count:cards.length});
}
function showAccountResult(x,isTest){
  const d=parseJSON(x.details,[]), isKotoba=x.test_type==='kotoba', kanaLabel=x.test_type==='katakana_46'?'Katakana':'Hiragana', title=isTest?(isKotoba?'Test Kotoba':`Tes ${kanaLabel} · 46`):(x.parts?.name||'Hasil Latihan');
  const body=isTest?(isKotoba?d.map((r,i)=>`<article class="review ${r.correct?'ok':'bad'}"><b>${i+1}. ${esc(r.japanese||'')} · ${esc(r.romaji||'')}</b><span>Arti: ${esc(r.meaning||'')}</span><span>Jawaban kamu: ${esc(r.user_answer)||'—'}</span><span>Jawaban benar: ${esc(r.direction==='jp_id'?r.meaning:r.romaji)||'—'}</span></article>`).join(''):d.map((r,i)=>`<article class="review ${r.correct?'ok':'bad'}"><b>${r.number||i+1}. ${esc(r.kana||r.hiragana||'')} ↔ ${esc(r.romaji||'')}</b><span>Jawaban kamu: ${esc(r.user_answer)||'—'}</span><span>Jawaban benar: ${esc(r.correct_answer)||'—'}</span></article>`).join('')):d.map((r,i)=>`<article class="review ${r.correct?'ok':'bad'}"><b>${i+1}. ${renderPromptHTML(r.question||'')}</b><span>Jawaban kamu: ${esc(formatAnswer(r.user_answer,r.type))||'—'}</span><span>Jawaban benar: ${esc(formatAnswer(r.correct_answer,r.type))||'—'}</span></article>`).join('');
  document.body.insertAdjacentHTML('beforeend',`<div class="account-result-modal" id="accountResultModal"><div class="account-result-dialog"><button class="bunpou-close" id="accountResultClose">×</button><div class="eyebrow">HASIL LATIHAN</div><h2>${esc(title)}</h2><div class="account-result-summary"><b>${x.score}/100</b><span>Benar ${x.correct_count}</span><span>Salah ${x.wrong_count}</span><span>Tidak dijawab ${x.unanswered_count}</span>${isTest?`<span>Waktu ${Math.floor((x.duration_seconds||0)/60)}m ${(x.duration_seconds||0)%60}s</span>`:''}</div><div class="review-list">${body||'<p class="muted">Detail jawaban tidak tersedia.</p>'}</div></div></div>`);
  const m=document.querySelector('#accountResultModal');document.querySelector('#accountResultClose').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove();};
}

function showLogin(){ stopTimer(); closeStudy(); renderAuth(app,state.branding||{},async u=>{ state.user=u; await startUserMonitor({login:true}); if(!location.hash||location.hash==='#akun')location.hash='#home'; renderRoute(); }); }
function updateSplash(b){
  const sp=document.querySelector('#splash'); if(!sp||!b)return;
  const n=document.querySelector('#splashName'),c=document.querySelector('#splashSub'),i=document.querySelector('#splashImg');
  if(n)n.textContent=b.site_name||CONFIG.siteName; if(c)c.textContent=b.corporate_name||'';
  if(i){ const want=b.logo_url||'favicon.svg'; if(i.getAttribute('src')!==want){ i.onerror=()=>{i.onerror=null;i.src='favicon.svg';}; i.src=want; } }
  sp.classList.remove('pending');
}
function hideSplash(){
  const sp=document.querySelector('#splash'); if(!sp)return;
  const wait=Math.max(0,1700-(Date.now()-(window.__splashStart||Date.now())));
  setTimeout(()=>{ sp.classList.add('hide'); setTimeout(()=>sp.remove(),600); },wait);
}
async function boot(){
  try{
    const b=await loadBranding(); updateSplash(b);
    if(sbReady){
      state.user=await currentUser();
      if(state.user) await startUserMonitor({login:false});
      supabase.auth.onAuthStateChange((ev,session)=>{ const had=!!state.user; state.user=session?.user||null; if(ev==='SIGNED_OUT'&&had&&b.maintenance_enabled!==true){stopUserMonitor();showLogin();} });
    }
    if(b.maintenance_enabled===true) showMaintenance(b);
    else if(sbReady&&!state.user) showLogin();
    else {await renderRoute();await checkResumeSession();}
  }catch(err){ console.error(err); }
  finally{ hideSplash(); }
}
window.addEventListener('hashchange',()=>{ if(sbReady&&!state.user)return; if(state.exerciseActive){const target=location.hash;try{history.replaceState(null,'',state.exerciseHash||'#latihan');}catch{}showLeaveModal({target});return;} renderRoute(); });
boot();

