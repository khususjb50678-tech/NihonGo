import { runFx } from './cardstyle.js';
const VOCAB_SOURCE='https://raw.githubusercontent.com/vitto4/MinnaNoDS/main/minna-no-ds.yaml';
const TRANSLATE_URL='https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=id&dt=t&q=';
const TRANSLATE_FALLBACK='https://api.mymemory.translated.net/get?q=';
const CACHE_KEY='itco_minna_vocab_v9_bab1_25';
let vocabCache=null;
let vocabLoadPromise=null;
let kotobaTimerHandle=null;
let kotobaTimerLeft=0;
let kotobaTimerSeconds=0;
let kotobaFinished=false;

export function stopKotobaTimer(){if(kotobaTimerHandle){clearInterval(kotobaTimerHandle);kotobaTimerHandle=null;}}
function fmtKotobaClock(sec){sec=Math.max(0,Math.floor(Number(sec)||0));return `${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`;}
async function getKotobaTimer(supabase,sbReady){if(!sbReady)return 0;try{const {data}=await supabase.from('timer_settings').select('per_question').eq('id',1).maybeSingle();const cfg=JSON.parse(data?.per_question||'{}');return Number(cfg?.__test_kotoba||0);}catch{return 0;}}
function startKotobaTimer(){stopKotobaTimer();if(kotobaTimerSeconds<=0)return;const paint=()=>{const el=document.querySelector('#kotobaTestTimer');if(el)el.textContent=`⏱ ${fmtKotobaClock(kotobaTimerLeft)}`;};paint();kotobaTimerHandle=setInterval(()=>{if(kotobaFinished)return stopKotobaTimer();kotobaTimerLeft--;paint();if(kotobaTimerLeft<=0){kotobaTimerLeft=0;stopKotobaTimer();kotobaFinished=true;window.__finishKotoba?.(true);}},1000);}
function vesc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function vnorm(s){return String(s??'').trim().toLowerCase().replace(/\s+/g,' ');}
function stripQuotes(s){let x=String(s??'').trim();if(x==='~')return '';if((x.startsWith('"')&&x.endsWith('"'))||(x.startsWith("'")&&x.endsWith("'")))x=x.slice(1,-1);return x;}
function parseMinnaYaml(text){
  const lessons={};let current=null,block=null;
  const lines=text.split(/\r?\n/);
  for(const line of lines){
    const lm=line.match(/^lesson-(\d+):\s*$/);if(lm){current=Number(lm[1]);if(current<=50)lessons[current]=[];block=null;continue;}
    if(!current||current>50)continue;
    const bm=line.match(/^\s{2}- id:\s*\[(\d+),\s*(\d+)\]/);if(bm){block={id:Number(bm[2]),edition:[],kanji:'',kana:'',romaji:'',en:''};lessons[current].push(block);continue;}
    if(!block)continue;
    let m=line.match(/^\s{4}edition:\s*\[([^\]]+)\]/);if(m){block.edition=m[1].split(',').map(x=>Number(x.trim())).filter(Boolean);continue;}
    m=line.match(/^\s{4}kanji:\s*(.*)$/);if(m){block.kanji=stripQuotes(m[1]);continue;}
    m=line.match(/^\s{4}kana:\s*(.*)$/);if(m){block.kana=stripQuotes(m[1]);continue;}
    m=line.match(/^\s{4}romaji:\s*(.*)$/);if(m){block.romaji=stripQuotes(m[1]);continue;}
    m=line.match(/^\s{6}en:\s*(.*)$/);if(m){block.en=stripQuotes(m[1]);continue;}
  }
  const out=[];
  for(let lesson=1;lesson<=50;lesson++)for(const x of (lessons[lesson]||[])){
    if(!x.edition.includes(2)||!x.en)continue;
    out.push({id:`${lesson}-${x.id}`,lesson,number:x.id,kanji:x.kanji||'',kana:x.kana||'',romaji:x.romaji||'',meaning_en:x.en,meaning_id:''});
  }
  return out;
}
async function loadVocab(){
  if(vocabCache)return vocabCache;if(vocabLoadPromise)return vocabLoadPromise;
  vocabLoadPromise=(async()=>{const r=await fetch(VOCAB_SOURCE,{cache:'no-store'});if(!r.ok)throw new Error('Data kosakata gagal dimuat.');const text=await r.text();vocabCache=parseMinnaYaml(text);if(!vocabCache.length)throw new Error('Data kosakata kosong.');return vocabCache;})().finally(()=>{vocabLoadPromise=null;});
  return vocabLoadPromise;
}
function getTranslationCache(){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')}catch{return {}}}
function saveTranslationCache(c){try{localStorage.setItem(CACHE_KEY,JSON.stringify(c))}catch{}}
const OFFLINE_ID={
  'i':'Saya','we':'Kami, kita','you':'Anda, kamu','that person, he, she':'Orang itu, dia',
  'person':'Orang','teacher':'Guru, dosen','student':'Siswa, murid','university':'Universitas',
  'hospital':'Rumah sakit','doctor':'Dokter','researcher':'Peneliti','company employee':'Pegawai perusahaan',
  'bank employee':'Pegawai bank','employee':'Karyawan','name':'Nama','what is your name?':'Nama Anda siapa?',
  'yes':'Iya','no':'Tidak','introduction':'Perkenalan','excuse me':'Permisi',
  'america':'Amerika','england':'Inggris','india':'India','indonesia':'Indonesia','korea':'Korea',
  'china':'China','germany':'Jerman','japan':'Jepang','france':'Prancis'
};

// Kamus Bahasa Indonesia bawaan (tanpa internet), kuncinya tulisan kana. Dicek lebih dulu sebelum terjemahan online.
const ID_DICT={
 // Pelajaran 1–10 — arti Bahasa Indonesia disesuaikan dengan halaman buku yang diberikan.
 'わたし':'saya','あなた':'Anda, kamu','あのひと':'orang itu','あのかた':'beliau (bentuk sopan dari あのひと)','みなさん':'Anda sekalian, semuanya','～さん':'Bapak/Ibu/Saudara ~','～ちゃん':'akhiran akrab untuk nama anak','～じん':'orang berkebangsaan ~','せんせい':'guru, dosen','きょうし':'guru, dosen (profesi)','がくせい':'siswa, mahasiswa','かいしゃいん':'karyawan perusahaan','しゃいん':'karyawan perusahaan ~','ぎんこういん':'pegawai bank','いしゃ':'dokter','けんきゅうしゃ':'peneliti','エンジニア':'insinyur','だいがく':'universitas','びょういん':'rumah sakit','でんき':'listrik','だれ':'siapa','どなた':'siapa (bentuk sopan)','－さい':'~ tahun (usia)','～さい':'~ tahun (usia)','なんさい':'berapa umur?','おいくつ':'berapa umur? (bentuk sopan)','はい':'ya','いいえ':'bukan, tidak','しつれいですが':'permisi, maaf','おなまえは？':'siapa nama Anda?','はじめまして。':'senang berkenalan','～からきました。':'saya datang dari ~','［どうぞ］よろしく［おねがいします］。':'mohon bantuannya, senang berkenalan','こちらは～さんです。':'ini Bapak/Ibu ~','アメリカ':'Amerika','イギリス':'Inggris','インド':'India','インドネシア':'Indonesia','かんこく':'Korea Selatan','タイ':'Thailand','ちゅうごく':'Tiongkok','ドイツ':'Jerman','にほん':'Jepang','ブラジル':'Brasil','IMC／パワーでんき／ブラジルエアー':'perusahaan fiksi','AKC':'lembaga fiksi','こうべびょういん':'rumah sakit fiksi','さくらだいがく／ふじだいがく':'universitas fiksi',

 'これ':'ini (benda yang ada di dekat pembicara)','それ':'itu (benda yang ada di dekat lawan bicara)','あれ':'itu (benda yang ada jauh dari pembicara dan lawan bicara)','この～':'~ ini (menerangkan benda yang ada di dekat si pembicara)','その～':'~ itu (menerangkan benda yang ada di dekat lawan bicara)','あの～':'~ itu (menerangkan benda yang ada jauh dari si pembicara dan lawan bicara)','ほん':'buku','じしょ':'kamus','ざっし':'majalah','しんぶん':'koran, surat kabar','ノート':'buku tulis, buku catatan','てちょう':'buku agenda','めいし':'kartu nama','カード':'kartu','えんぴつ':'pensil','ボールペン':'bolpoin','シャープペンシル':'pensil mekanik, pensil isi ulang','かぎ':'kunci','とけい':'jam, arloji','かさ':'payung','かばん':'tas','CD':'CD','テレビ':'televisi','ラジオ':'radio','カメラ':'kamera','コンピューター':'komputer, PC','くるま':'mobil','つくえ':'meja, meja tulis','いす':'kursi','チョコレート':'coklat','コーヒー':'kopi','［お］みやげ':'oleh-oleh','えいご':'bahasa Inggris','にほんご':'bahasa Jepang','～ご':'bahasa ~','なん':'apa','そう':'begitu','あのう':'permisi / anu (ungkapan kepada lawan bicara dalam percakapan)','えっ':'Eh (dipakai ketika mendengar sesuatu yang di luar dugaan)','どうぞ。':'Silakan (digunakan ketika menawarkan sesuatu)','［どうも］ありがとうございます。':'Terima kasih (banyak).','ちがいます。':'Bukan. / Tidak. / Salah.','あ':'Oh, (dipakai ketika sadar)','これからおせわになります。':'Mulai sekarang, saya akan meminta bantuannya.','こちらこそ［どうぞ］よろしく［おねがいします］。':'Ya, sama-sama. (jawaban terhadap よろしくおねがいします)',

 'ここ':'sini','そこ':'situ','あそこ':'sana','どこ':'mana','こちら':'sini (bentuk sopan dari ここ)','そちら':'situ (bentuk sopan dari そこ)','あちら':'sana (bentuk sopan dari あそこ)','どちら':'mana (bentuk sopan dari どこ)','きょうしつ':'ruang kelas','しょくどう':'ruang makan, rumah makan, kantin','じむしょ':'kantor','かいぎしつ':'ruang rapat','うけつけ':'meja informasi','ロビー':'ruang tunggu, lobi','へや':'kamar','トイレ':'kamar kecil, toilet, W.C.','おてあらい':'kamar kecil, toilet, W.C.','かいだん':'tangga','エレベーター':'lift','エスカレーター':'tangga berjalan, eskalator','じどうはんばいき':'mesin jual otomatis','でんわ':'telepon','［お］くに':'negara, negeri','かいしゃ':'perusahaan','うち':'rumah','くつ':'sepatu','ネクタイ':'dasi','ワイン':'anggur','タバコ':'rokok','うりば':'tempat penjualan','ちか':'bawah tanah, basement','～かい':'lantai ~, tingkat ~','～がい':'lantai ~, tingkat ~','なんがい':'lantai berapa, tingkat berapa','～えん':'~ yen','いくら':'berapa','ひゃく':'ratus','せん':'ribu','まん':'puluh ribu','すみません。':'Maaf. / Permisi.','～でございます':'bentuk sopan dari です','～をみせてください。':'Tolong perlihatkan ~.','じゃ':'kalau begitu','～をください。':'Minta ~. / Tolong berikan ~.',

 'おきます':'bangun, bangun tidur','ねます':'tidur','はたらきます':'bekerja','やすみます':'beristirahat, mengambil libur','べんきょうします':'belajar','おわります':'selesai','デパート':'toserba','ぎんこう':'bank','ゆうびんきょく':'kantor pos','としょかん':'perpustakaan','びじゅつかん':'gedung kesenian','いま':'sekarang','～じ':'jam ~, pukul ~','～ふん':'~ menit','～ぷん':'~ menit','はん':'setengah','なんじ':'jam berapa, pukul berapa','なんぷん':'berapa menit','ごぜん':'a.m. (waktu sebelum jam 12 siang)','ごご':'p.m. (waktu setelah jam 12 siang)','あさ':'pagi','ひる':'siang','ばん':'malam','よる':'malam','おととい':'dua hari yang lalu, kemarin lusa','きのう':'kemarin','きょう':'hari ini','あした':'besok','あさって':'lusa','けさ':'pagi ini, tadi pagi','こんばん':'malam ini, nanti malam','やすみ':'istirahat, cuti, libur','ひるやすみ':'istirahat siang','まいあさ':'setiap pagi','まいばん':'setiap malam','まいにち':'setiap hari','げつようび':'hari Senin','かようび':'hari Selasa','すいようび':'hari Rabu','もくようび':'hari Kamis','きんようび':'hari Jumat','どようび':'hari Sabtu','にちようび':'hari Minggu','なんようび':'hari apa','ばんごう':'nomor','なんばん':'nomor berapa','～から':'dari ~','～まで':'sampai ~','～と～':'~ dan ~','たいへんですね。':'O, berat ya. (ungkapan untuk menyatakan rasa simpati dari lawan bicara)','えーと':'anu..., ehm...','おねがいします':'mohon, tolong','かしこまりました':'baik, mengerti (ungkapan sopan)',

 'いきます':'pergi','きます':'datang','かえります':'pulang','がっこう':'sekolah','スーパー':'pasar swalayan','えき':'stasiun','ひこうき':'pesawat terbang','ふね':'kapal laut','でんしゃ':'kereta listrik','ちかてつ':'kereta bawah tanah','しんかんせん':'Shinkansen','バス':'bus','タクシー':'taksi','じてんしゃ':'sepeda','あるいて':'dengan berjalan kaki','ひと':'orang','ともだち':'teman','かれ':'dia, ia (laki-laki)','かのじょ':'dia, ia (perempuan)','かぞく':'keluarga','ひとりで':'sendirian, dengan sendiri','せんしゅう':'minggu lalu','こんしゅう':'minggu ini','らいしゅう':'minggu depan','せんげつ':'bulan lalu','こんげつ':'bulan ini','らいげつ':'bulan depan','きょねん':'tahun lalu','ことし':'tahun ini','らいねん':'tahun depan','～ねん':'tahun ~','なんねん':'tahun berapa','～がつ':'bulan ~','なんがつ':'bulan apa','なんにち':'tanggal berapa, berapa hari','いつ':'kapan','たんじょうび':'hari ulang tahun','そうですね。':'Ya, betul. / Ya, begitulah.','どうもありがとうございました。':'Terima kasih banyak.','どういたしまして':'Sama-sama.','おめでとうございます':'Selamat.','すみません':'maaf, permisi','どうぞ':'silakan','なんようび':'hari apa','おおさかじょう':'nama benteng kuno di Osaka',

 'たべます':'makan','のみます':'minum','すいます':'mengisap (rokok)','みます':'menonton, melihat','ききます':'mendengar, bertanya','よみます':'membaca','かきます':'menulis','かいます':'membeli','とります':'mengambil (foto)','します':'melakukan','あいます':'bertemu [seseorang]','ごはん':'nasi, makanan','あさごはん':'sarapan','ひるごはん':'makan siang','ばんごはん':'makan malam','パン':'roti','たまご':'telur','にく':'daging','さかな':'ikan','やさい':'sayur-sayuran','くだもの':'buah-buahan','みず':'air','おちゃ':'teh','こうちゃ':'teh hitam','ぎゅうにゅう':'susu','ジュース':'jus','ビール':'bir','おさけ':'minuman keras, sake','ビデオ':'video','えいが':'film','CD':'CD','てがみ':'surat','レポート':'laporan','しゃしん':'foto','みせ':'toko','レストラン':'restoran','にわ':'taman','しゅくだい':'pekerjaan rumah, PR','テニス':'tenis','サッカー':'sepak bola','おはなみ':'melihat bunga Sakura','なに':'apa','いっしょに':'bersama-sama','ちょっと':'sebentar, sedikit','いつも':'selalu','ときどき':'kadang-kadang','それから':'kemudian','ええ':'ya','いいですね':'bagus ya, baik sekali','わかりました':'mengerti, baiklah','なんですか':'apa?','じゃ、また':'sampai jumpa',

 'きります':'memotong, menggunting','おくります':'mengirim','あげます':'memberikan, memberi','もらいます':'menerima','かします':'meminjamkan, menyewakan','かります':'meminjam, menyewa','おしえます':'mengajar','ならいます':'belajar','かけます［でんわを～］':'menelepon','はさみ':'gunting','て':'tangan','スプーン':'sendok','ナイフ':'pisau','フォーク':'garpu','ホッチキス':'stapler','ファクス':'faks','ワープロ':'komputer, PC','パソコン':'komputer, PC','ケータイ':'HP','メール':'e-mail','ねんがじょう':'kartu tahun baru','パンチ':'pelubang kertas','セロテープ':'selotip','けしゴム':'penghapus karet','かみ':'kertas','はな':'bunga','シャツ':'kemeja','プレゼント':'hadiah','にもつ':'barang, bagasi','おかね':'uang','きっぷ':'karcis','クリスマス':'Natal','ちち':'bapak, ayah','はは':'ibu','おとうさん':'bapak, ayah (orang lain, dan digunakan untuk bapak kandung sendiri juga ketika memanggilnya)','おかあさん':'ibu (orang lain, dan digunakan untuk ibu kandung sendiri juga ketika memanggilnya)','もう':'sudah','まだ':'belum','これから':'mulai dari sekarang','～に':'kepada ~','どうぞおげんきで':'semoga sehat-sehat selalu',

 'わかります':'mengerti','あります':'ada, mempunyai','すき［な］':'suka, gemar','きらい［な］':'tidak suka','じょうず［な］':'pandai, pintar','へた［な］':'tidak pandai, tidak pintar','のみもの':'minuman','りょうり':'masakan','スポーツ':'olahraga','やきゅう':'baseball','ダンス':'dansa','おんがく':'musik','うた':'lagu','クラシック':'klasik','ジャズ':'jazz','コンサート':'konser','カラオケ':'karaoke','かぶき':'Kabuki (salah satu drama tradisional Jepang)','え':'gambar','じ':'huruf','かんじ':'Kanji','ひらがな':'Hiragana','カタカナ':'Katakana','ローマじ':'huruf latin','こまかいおかね':'uang kecil, receh','チケット':'tiket','じかん':'jam, waktu','ようじ':'urusan','やくそく':'janji','ごしゅじん':'suami (digunakan untuk menyebut suami orang lain)','おっと／しゅじん':'suami sendiri','おくさん':'istri (digunakan untuk menyebut istri orang lain)','つま／かない':'istri sendiri','こども':'anak','よく':'dengan baik, sering','だいたい':'kira-kira','たくさん':'banyak','すこし':'sedikit','ぜんぜん':'sama sekali (diikuti kalimat negatif)','はやく':'cepat, lekas','～から':'karena ~, sebab ~','どうして':'kenapa','かしていただけませんか':'Tolong dipinjamkan.','いいですよ':'Boleh.','ざんねんですが':'sayang sekali','ああ':'ah, oh','いっしょにいかがですか':'Bagaimana kalau bersama-sama?','～はちょっと':'Maaf ya, saya tidak bisa ~ (ungkapan untuk menolak ajakan secara tidak langsung)','またこんどおねがいします':'Maaf, lain kali saja.','どうぞよろしく':'mohon bantuannya',

 'あります':'ada (digunakan untuk benda mati)','います':'ada (digunakan untuk makhluk hidup)','いろいろ［な］':'berbagai','おとこのひと':'orang laki-laki','おんなのひと':'orang perempuan','おとこのこ':'anak laki-laki','おんなのこ':'anak perempuan','いぬ':'anjing','ねこ':'kucing','パンダ':'panda','ぞう':'gajah','き':'pohon','もの':'barang','でんち':'baterai','はこ':'kotak','スイッチ':'tombol, sakelar','れいぞうこ':'kulkas, lemari es','テーブル':'meja makan','ベッド':'tempat tidur','たな':'lemari','ドア':'pintu','まど':'jendela','ポスト':'kotak surat','ビル':'gedung','ATM':'ATM, Anjungan Tunai Mandiri','コンビニ':'toko 24 jam','こうえん':'taman','きっさてん':'coffee shop','～や':'toko ~','のりば':'tempat naik','けん':'prefektur','うえ':'atas','した':'bawah','まえ':'depan, muka','うしろ':'belakang','みぎ':'kanan','ひだり':'kiri','なか':'dalam','そと':'luar','となり':'sebelah','ちかく':'dekat','あいだ':'antara','～や～など':'~ dan ~ [dan lain-lain]','どうもすみません':'Terima kasih (banyak).','ナンプラー':'kecap ikan','コーナー':'tempat/bagian penjualan','いちばんした':'paling bawah'
 'わたし':'Saya','わたしたち':'Kami, kita','あなた':'Anda, kamu','あのひと(あのかた)':'Orang itu (あのかた = bentuk sopan: beliau)','あのひと':'Orang itu','あのかた':'Beliau (bentuk sopan dari あの人)',
 'みなさん':'Anda sekalian, semuanya','~さん':'Bapak/Ibu/Saudara ~ (sapaan sopan)','~ちゃん':'Dik ~ (sapaan akrab untuk anak kecil)','~くん':'Dik ~ (sapaan untuk anak laki-laki)','~じん':'Orang ~ (kebangsaan)',
 'せんせい':'Guru, dosen (sapaan)','きょうし':'Guru, dosen (profesi)','がくせい':'Siswa, mahasiswa','かいしゃいん':'Karyawan perusahaan','しゃいん':'Karyawan perusahaan ~','ぎんこういん':'Pegawai bank','いしゃ':'Dokter','けんきゅうしゃ':'Peneliti','エンジニア':'Insinyur',
 'だいがく':'Universitas','びょういん':'Rumah sakit','でんき':'Listrik','だれ(どなた)':'Siapa (どなた = bentuk sopan)','だれ':'Siapa','どなた':'Siapa (sopan)',
 '~さい':'~ tahun (usia)','なんさい(おいくつ)':'Berapa umur? (おいくつ = bentuk sopan)','なんさい':'Berapa umur?','おいくつ':'Berapa umur? (sopan)',
 'はい':'Ya','いいえ':'Bukan, tidak','しつれいですが':'Permisi, maaf (sebelum bertanya)','おなまえは?':'Siapa nama Anda?','はじめまして':'Senang bertemu dengan Anda (salam perkenalan)',
 'どうぞよろしくおねがいします':'Mohon bantuannya, senang berkenalan','こちらは~さんです':'Ini adalah Bapak/Ibu ~','~からきました':'Saya datang dari ~',
 'アメリカ':'Amerika','イギリス':'Inggris','インド':'India','インドネシア':'Indonesia','かんこく':'Korea Selatan','タイ':'Thailand','ちゅうごく':'Tiongkok','ドイツ':'Jerman','にほん':'Jepang','フランス':'Prancis','ブラジル':'Brasil',
 // Pelajaran 11–20 — arti Bahasa Indonesia bawaan agar Bab 11–20 bekerja seperti Bab 1–10 tanpa terjemahan online.
 'こどもがいます':'mempunyai anak','にほんにいます':'ada di Jepang','かかります':'memakan waktu, perlu','かいしゃをやすみます':'tidak masuk kerja, mengambil cuti dari kantor',
 'ひとつ':'satu buah','ふたつ':'dua buah','みっつ':'tiga buah','みつ':'tiga buah','よっつ':'empat buah','いつつ':'lima buah','むっつ':'enam buah','ななつ':'tujuh buah','やっつ':'delapan buah','ここのつ':'sembilan buah','とお':'sepuluh buah','いくつ':'berapa buah','ひとり':'satu orang','ふたり':'dua orang','～にん':'~ orang','～だい':'~ unit (mesin/kendaraan)','～まい':'~ lembar, helai','～かい':'~ kali','りんご':'apel','みかん':'jeruk','サンドイッチ':'sandwich','カレー':'kari','アイスクリーム':'es krim','きって':'perangko','はがき':'kartu pos','ふうとう':'amplop','そくたつ':'surat kilat','かきとめ':'surat tercatat','エアメール':'surat udara','こうくうびん':'pos udara','りょうしん':'orang tua','きょうだい':'saudara kandung','あに':'kakak laki-laki saya','おとうと':'adik laki-laki saya','あね':'kakak perempuan saya','いもうと':'adik perempuan saya','がいこく':'luar negeri','りゅうがくせい':'pelajar asing','クラス':'kelas','じかん':'jam, waktu','しゅうかん':'minggu','かげつ':'bulan','ねん':'tahun','ぐらい':'kira-kira, sekitar','どのくらい':'berapa lama, berapa banyak','ぜんぶで':'seluruhnya, semuanya','みんな':'semua, semuanya','～だけ':'hanya ~','いらっしゃいませ':'selamat datang','いいおてんきですね':'Cuacanya bagus ya','おでかけですか':'Mau pergi?','ちょっと～まで':'sebentar, sampai ~','いってらっしゃい':'Selamat jalan (kepada orang yang pergi)','いってまいります':'Saya pergi dulu (ungkapan sopan)','ただいま':'Saya pulang','おかえりなさい':'Selamat datang kembali','それから':'setelah itu, kemudian','オーストラリア':'Australia',

 'かんたん［な］':'mudah, sederhana','ちかい':'dekat','とおい':'jauh','はやい':'cepat, awal','おそい':'lambat, terlambat','おおい':'banyak','すくない':'sedikit','あたたかい':'hangat','すずしい':'sejuk','あまい':'manis','からい':'pedas','おもい':'berat','かるい':'ringan','いい':'baik, bagus','きせつ':'musim','はる':'musim semi','なつ':'musim panas','あき':'musim gugur','ふゆ':'musim dingin','てんき':'cuaca','あめ':'hujan','ゆき':'salju','くもり':'mendung','ホテル':'hotel','くうこう':'bandara','うみ':'laut','せかい':'dunia','パーティー':'pesta','まつり':'festival, perayaan','しけん':'ujian','すきやき':'sukiyaki','さしみ':'sashimi','すし':'sushi','てんぷら':'tempura','ぶたにく':'daging babi','とりにく':'daging ayam','ぎゅうにく':'daging sapi','たべもの':'makanan','せいかつ':'kehidupan, hidup sehari-hari','どちら':'yang mana, yang mana dari dua','どちらも':'keduanya','ずっと':'jauh lebih, terus-menerus','はじめて':'pertama kali','ただいま':'Saya pulang','おかえりなさい':'Selamat datang kembali','わあ、すごいですね':'Wah, hebat ya','でも':'tetapi','つかれました':'Saya lelah','ほかの':'yang lain','なぜ':'mengapa','いちばん':'paling, nomor satu',

 'あそびます':'bermain','およぎます':'berenang','むかえます':'menjemput','つかれます':'lelah','けっこんします':'menikah','かいものします':'berbelanja','しょくじします':'makan','さんぽします':'berjalan-jalan','たいへん［な］':'berat, susah','ほしい':'ingin, menginginkan','ひろい':'luas','せまい':'sempit','プール':'kolam renang','かわ':'sungai','びじゅつ':'kesenian','つりをします':'memancing','スキー':'ski','しゅうまつ':'akhir pekan','おしょうがつ':'tahun baru','～ごろ':'kira-kira, sekitar','なにか':'sesuatu','どこか':'suatu tempat','のどがかわきます':'haus','おなかがすきます':'lapar','そうしましょう':'Ya, mari','ごちゅうもんは':'Pesan apa?','ていしょく':'menu paket makanan','ぎゅうどん':'gyudon','しょうしょうおまちください':'Tunggu sebentar','～でございます':'bentuk halus dari です','べつべつに':'sendiri-sendiri, masing-masing',

 'つけます':'menyalakan','けします':'mematikan','あけます':'membuka','しめます':'menutup','いそぎます':'bergegas','まちます':'menunggu','とめます':'menghentikan, memarkir','まがります':'belok','もちます':'memegang, membawa','とります':'mengambil','てつだいます':'membantu','よびます':'memanggil','はなします':'berbicara','みせます':'memperlihatkan','おしえます':'memberi tahu, mengajarkan','すわります':'duduk','たちます':'berdiri','はいります':'masuk','でます':'keluar','ふります':'turun [hujan]','コピーします':'memfotokopi','エアコン':'AC','パスポート':'paspor','なまえ':'nama','じゅうしょ':'alamat','ちず':'peta','しお':'garam','さとう':'gula','よみかた':'cara membaca','～かた':'cara ~','ゆっくり':'pelan-pelan','すぐ':'segera','また':'lagi','あとで':'nanti','もうすこし':'sedikit lagi','もう～':'~ lagi','さあ':'mari, ayo','あれ？':'Lho?','しんごうをまっています':'sedang menunggu lampu lalu lintas','まっすぐ':'lurus','これでおねがいします':'Ini saja, tolong','おつり':'uang kembalian','ありがとうござました':'terima kasih banyak',

 'つまらない':'membosankan','おもしろい':'menarik','ながい':'panjang','みじかい':'pendek','おおきい':'besar','ちいさい':'kecil','あたらしい':'baru','ふるい':'lama, tua','わかい':'muda','あかるい':'terang, cerah','くらい':'gelap','きれい［な］':'indah, bersih','しずか［な］':'tenang, sepi','ゆうめい［な］':'terkenal','にぎやか［な］':'ramai','げんき［な］':'sehat, bersemangat','しんせつ［な］':'ramah, baik hati','ひま［な］':'senggang','べんり［な］':'praktis','すてき［な］':'bagus, indah','すき［な］':'suka','きらい［な］':'tidak suka','じょうず［な］':'pandai','へた［な］':'tidak pandai','しんぱい［な］':'khawatir','たいせつ［な］':'penting, berharga','だいじょうぶ［な］':'tidak apa-apa','からだ':'tubuh','あたま':'kepala','かみ':'rambut','かお':'wajah','め':'mata','みみ':'telinga','はな':'hidung','くち':'mulut','は':'gigi','おなか':'perut','あし':'kaki','せ':'punggung, tinggi badan','ジョギング':'joging','おてら':'kuil Buddha','じんじゃ':'kuil Shinto','どうぶつえん':'kebun binatang','しぜん':'alam','かぶき':'Kabuki','すもう':'sumo','けっこんしき':'upacara pernikahan','～ばん':'nomor ~','おなじ':'sama','どうですか':'bagaimana?','どんな':'seperti apa','もちろん':'tentu saja','ぜひ':'sungguh, pasti','なかなか':'tidak mudah','もうすぐ':'sebentar lagi','おかげさまで':'berkat doa/bantuan Anda','かんぱい':'bersulang, cheers',

 'のります':'naik [kendaraan]','おります':'turun [kendaraan]','のりかえます':'berganti kendaraan','あびます':'mandi [shower]','いれます':'memasukkan','だします':'mengeluarkan','おろします':'mengambil uang','はいります':'masuk','でます':'keluar, tamat','おします':'menekan','のみます':'minum','はじめます':'memulai','けんがくします':'mengunjungi untuk belajar, studi wisata','でんわします':'menelepon','ながい':'panjang','みじかい':'pendek','あかるい':'terang','くらい':'gelap','からだ':'tubuh','あたま':'kepala','かみ':'rambut','かお':'wajah','め':'mata','みみ':'telinga','はな':'hidung','くち':'mulut','は':'gigi','おなか':'perut','あし':'kaki','せ':'punggung, tinggi badan','ジョギング':'joging','おてら':'kuil Buddha','じんじゃ':'kuil Shinto','こうばん':'pos polisi','こうさてん':'persimpangan','たてもの':'gedung','はし':'jembatan','みぎ':'kanan','ひだり':'kiri','まえ':'depan','うしろ':'belakang','なか':'dalam','そと':'luar','ちかく':'dekat','となり':'sebelah','あいだ':'antara','おおきい':'besar','ちいさい':'kecil','わかい':'muda','おもしろい':'menarik','かるい':'ringan','きた':'utara','みなみ':'selatan','ひがし':'timur','にし':'barat','～ぐらい':'kira-kira','それから':'setelah itu','けっこうです':'tidak perlu, cukup','おげんきで':'semoga sehat-sehat',

 'おぼえます':'mengingat, menghafal','わすれます':'lupa','なくします':'kehilangan','はらいます':'membayar','かえします':'mengembalikan','でかけます':'bepergian','ぬぎます':'membuka [pakaian]','もっていきます':'membawa pergi','もってきます':'membawa datang','しんぱいします':'khawatir','ざんぎょうします':'lembur','しゅっちょうします':'melakukan perjalanan dinas','くすりをのみます':'minum obat','おふろにはいります':'mandi di ofuro','たいせつ［な］':'penting, berharga','だいじょうぶ［な］':'tidak apa-apa','あぶない':'berbahaya','きんえん':'dilarang merokok','けんこう':'kesehatan','ほけんしょう':'kartu asuransi','ねつ':'demam','びょうき':'sakit','くすり':'obat','おふろ':'ofuro, bak mandi','うわぎ':'baju luar, jaket','したぎ':'pakaian dalam','～までに':'sampai dengan ~','ですから':'oleh karena itu','どうしましたか':'Kenapa?','のど':'tenggorokan','いたいです':'sakit','かぜ':'masuk angin, flu','おだいじに':'Semoga lekas sembuh',

 'できます':'bisa, dapat','あらいます':'mencuci','ひきます':'bermain [alat musik]','うたいます':'menyanyi','あつめます':'mengumpulkan','すてます':'membuang','かえます':'menukar, mengganti','うんてんします':'menyetir','よやくします':'memesan','ピアノ':'piano','～メートル':'~ meter','げんきん':'uang tunai','しゅみ':'hobi','にっき':'catatan harian','おいのりします':'berdoa','かちょう':'kepala seksi','ぶちょう':'kepala bagian','しゃちょう':'direktur utama','どうぶつ':'binatang, hewan','うま':'kuda','インターネット':'internet','とくに':'terutama, khususnya','おもしろい':'menarik','なかなか':'tidak mudah','ほんとうですか':'Benarkah?','ぜひ':'sungguh, pasti','しごと':'pekerjaan','しごとします':'bekerja',

 'のぼります':'mendaki, naik','とまります':'menginap','そうじします':'membersihkan','せんたくします':'mencuci pakaian','なります':'menjadi','ねむい':'mengantuk','つよい':'kuat','よわい':'lemah','れんしゅう':'latihan','ゴルフ':'golf','すもう':'sumo','おちゃ':'teh','ひ':'hari, matahari','ちょうし':'kondisi, keadaan','いちど':'sekali','いちども':'sama sekali tidak pernah','だんだん':'berangsur-angsur','もうすぐ':'sebentar lagi','おかげさまで':'berkat doa Anda','でも':'tetapi','かんぱい':'bersulang, cheers','ダイエット':'diet','むり［な］':'berlebihan, mustahil','からだにいい':'baik untuk tubuh','とうきょうスカイツリー':'Tokyo Skytree',

 'いります':'memerlukan','しらべます':'memeriksa, mengecek','しゅうりします':'memperbaiki','ぼく':'saya (informal)','きみ':'kamu (informal)','～くん':'Sdr. ~, Dik ~ (informal)','うん':'ya (informal)','ううん':'tidak (informal)','ことば':'kosakata, bahasa','ビザ':'visa','はじめ':'awal, mula-mula','おわり':'akhir','こっち':'sini (informal)','そっち':'situ (informal)','あっち':'sana (informal)','どっち':'mana (informal)','みんなで':'kita semua','～けど':'~ tetapi','おなかがいっぱい':'kenyang','よかったら':'kalau mau, kalau suka','いろいろ':'bermacam-macam, berbagai macam','またでんわします':'akan menelepon lagi','じゃあ':'kalau begitu','どうぞおげんきで':'semoga sehat-sehat selalu',

 // Pelajaran 21–25 — arti Bahasa Indonesia berdasarkan foto halaman buku yang diberikan.
 'おもいます':'mengira, berpikir','いいます':'mengatakan, berkata','かちます':'menang','まけます':'kalah',
 'あります［おまつりが~］':'ada, diadakan [pesta perayaan]','やくにたちます':'berguna, bermanfaat','うごきます':'pindah, bergerak',
 'やめます［かいしゃを~］':'berhenti [kerja]','きをつけます':'berwaspada, berhati-hati','りゅうがくします':'studi di luar negeri',
 'むだ［な］':'sia-sia, tidak berguna','ふべん［な］':'tidak praktis','すごい':'hebat, bukan main (digunakan ketika menyatakan kejutan atau kekaguman)',
 'ほんとう':'betul, benar','うそ':'bohong','じどうしゃ':'mobil','こうつう':'lalu lintas','ぶっか':'harga barang',
 'ほうそう':'siaran, pengumuman','ニュース':'warta berita','アニメ':'animasi','マンガ':'manga, komik','デザイン':'desain, model',
 'ゆめ':'mimpi','てんさい':'genius','しあい':'pertandingan (~をします: bertanding)','いけん':'pendapat',
 'はなし':'cerita (~をします: bercerita, berbicara)','ちきゅう':'bumi','つき':'bulan','さいきん':'akhir-akhir ini',
 'たぶん':'mungkin, barangkali','きっと':'pasti','ほんとうに':'betul-betul','そんなに':'tidak begitu (diikuti bentuk negatif)',
 '~について':'tentang ~, mengenai ~','ひさしぶりですね。':'Sudah lama tidak bertemu ya.','~でものみませんか。':'Bagaimana kalau kita minum ~, atau apa saja?',
 'もちろん':'tentu saja','もうかえらないと……。':'Saya harus pulang...','アインシュタイン':'Albert Einstein (1879-1955)',
 'ガガーリン':'Gagarin (1934-1968)','ガリレオ':'Galileo Galilei (1564-1642)','キングぼくし':'Martin Luther King, Jr. (1929-1968)',
 'フランクリン':'Benjamin Franklin (1706-1790)','かぐやひめ':'Putri Kaguya (protagonis dari cerita dongeng Jepang “Taketori monogatari”)',
 'てんじんまつり':'Perayaan Tenjin (perayaan di Osaka)','よしのやま':'Gunung Yoshino (gunung yang ada di Nara)','カンガルー':'kanguru',
 'キャプテン・クック':'Captain James Cook (1728-1779)','ヨーネン':'perusahaan fiksi',

 'きます':'memakai (kemeja)','はきます':'memakai (sepatu, celana)','かぶります':'memakai (topi)','かけます［めがねを~］':'memakai [kaca mata]',
 'します［ネクタイを~］':'memakai [dasi]','うまれます':'lahir','わたしたち':'kami, kita','コート':'mantel','セーター':'sweater, baju hangat',
 'スーツ':'pakaian setelan','ぼうし':'topi','めがね':'kaca mata','ケーキ':'kue','［お］べんとう':'bekal','ロボット':'robot',
 'ユーモア':'humor','つごう':'kondisi','よく':'sering kali','えーと':'Itu...','おめでとう［ございます］。':'Selamat (digunakan ketika hari ulang tahun, upacara pernikahan, dan tahun baru)',
 'おさがしですか。':'Mencari apa?','では':'kalau begitu','こちら':'ini (ungkapan sopan dari これ)','やちん':'biaya sewa rumah',
 'ダイニングキッチン':'ruang makan dengan dapur','わしつ':'kamar ala Jepang','おしいれ':'lemari dinding ala Jepang','ふとん':'selimut dan kasur berisi kapas ala Jepang',
 'パリ':'Paris','ばんりのちょうじょう':'Tembok Besar China','みんなのアンケート':'angket fiksi',

 'ききます［せんせいに~］':'bertanya [kepada guru]','まわします':'memutar','ひきます':'tarik','かえます':'mengubah',
 'さわります［ドアに~］':'menyentuh [pintu]','でます［おつりが~］':'keluar [uang kembalian]','あるきます':'berjalan kaki',
 'わたります［はしを~］':'menyeberang [jembatan]','まがります［みぎへ~］':'belok [ke kanan]','さびしい':'sepi','［お］ゆ':'air panas',
 'おと':'bunyi, suara','サイズ':'ukuran','こしょう':'kerusakan (~します: rusak)','みち':'jalan','こうさてん':'perempatan',
 'しんごう':'lampu lalu lintas','かど':'sudut','はし':'jembatan','ちゅうしゃじょう':'tempat parkir','たてもの':'gedung',
 'なんかいも':'berkali-kali','－め':'yang ke- (mengungkapkan urutan)','しょうとくたいし':'Pangeran Shotoku (574-622)',
 'ほうりゅうじ':'Kuil Horyuji, kuil di Prefektur Nara','げんきちゃ':'teh fiksi','ほんだえき':'stasiun fiksi','としょかんまえ':'halte bus fiksi',

 'くれます':'diberikan','なおします':'memperbaiki','つれていきます':'membawa [seseorang] pergi','つれてきます':'membawa [seseorang] datang',
 'おくります［ひとを~］':'mengantar [orang]','しょうかいします':'memperkenalkan','あんないします':'mengantarkan','せつめいします':'menjelaskan, menerangkan',
 'おじいさん／おじいちゃん':'kakek','おばあさん／おばあちゃん':'nenek','じゅんび':'persiapan','ひっこし':'pindah rumah, memindahkan',
 '［お］かし':'kue','ホームステイ':'homestay','ぜんぶ':'semua','じぶんで':'dengan sendiri','ほかに':'selain, yang lain','ははのひ':'Hari Ibu',

 'かんがえます':'berpikir, memikirkan','つきます':'tiba, sampai','とります［としを~］':'berumur, lanjut usia','たります':'cukup',
 'いなか':'desa, kampung halaman','チャンス':'kesempatan','おく':'ratus juta','もし［~たら］':'kalau','いみ':'arti, makna',
 'もしもし':'halo (digunakan ketika menelepon)','てんきん':'pindah ke kantor cabang lain atau jabatan lain (~します: pindah kantor)',
 'こと':'hal (~のこと: hal ~)','ひま':'waktu luang','［いろいろ］おせわになりました。':'Terima kasih banyak bantuan Anda yang telah diberikan',
 'がんばります':'berusaha, bekerja keras','どうぞおげんきで。':'Semoga sehat-sehat selalu (digunakan ketika perpisahan dalam jangka waktu lama)','ベトナム':'Vietnam'
};
function jkey(s){return String(s||'').replace(/[\s\u3000]/g,'').replace(/（/g,'(').replace(/）/g,')').replace(/[～〜]/g,'~').replace(/？/g,'?');}
function dictMeaning(x){
  for(const raw of [x.kana,x.kanji]){
    const k=jkey(raw); if(!k)continue;
    if(ID_DICT[k])return ID_DICT[k];
    const base=k.replace(/\(.*?\)/g,''); if(ID_DICT[base])return ID_DICT[base];
  }
  return '';
}
function offlineMeaning(en){
  const s=String(en||'').trim(); if(!s)return '';
  const key=s.toLowerCase().replace(/[“”"]/g,'').replace(/\s+/g,' ');
  if(OFFLINE_ID[key])return OFFLINE_ID[key];
  const bare=key.replace(/\s*\([^)]*\)/g,'').trim(); if(OFFLINE_ID[bare])return OFFLINE_ID[bare];
  if(/university/i.test(key))return 'Universitas';
  if(/hospital/i.test(key))return 'Rumah sakit';
  if(/doctor/i.test(key))return 'Dokter';
  if(/teacher/i.test(key))return 'Guru, dosen';
  if(/student/i.test(key))return 'Siswa, murid';
  if(/researcher/i.test(key))return 'Peneliti';
  return '';
}
async function translateMeaning(en){
  const source=String(en||'').trim(); if(!source)return '';
  const cache=getTranslationCache(); if(cache[source])return cache[source];
  const local=offlineMeaning(source); if(local){cache[source]=local;saveTranslationCache(cache);return local;}
  try{
    const r=await fetch(TRANSLATE_URL+encodeURIComponent(source),{cache:'no-store'});
    if(r.ok){
      const j=await r.json();
      const id=Array.isArray(j?.[0])?j[0].map(x=>x?.[0]||'').join('').trim():'';
      if(id&&id.toLowerCase()!==source.toLowerCase()){
        cache[source]=id;saveTranslationCache(cache);return id;
      }
    }
  }catch{}
  try{
    const r=await fetch(TRANSLATE_FALLBACK+encodeURIComponent(source)+'&langpair=en|id',{cache:'no-store'});
    if(r.ok){
      const j=await r.json();
      const id=String(j?.responseData?.translatedText||'').trim();
      if(id&&id.toLowerCase()!==source.toLowerCase()){
        cache[source]=id;saveTranslationCache(cache);return id;
      }
    }
  }catch{}
  return '';
}
async function translateItems(items){
  const cache=getTranslationCache();
  const need=[...new Set(items.filter(x=>!dictMeaning(x)).map(x=>x.meaning_en).filter(x=>x&&!cache[x]))];
  for(let i=0;i<need.length;i+=10){
    await Promise.all(need.slice(i,i+10).map(async en=>{
      const id=await translateMeaning(en); if(id)cache[en]=id;
    }));
    saveTranslationCache(cache);
  }
  items.forEach(x=>x.meaning_id=dictMeaning(x)||cache[x.meaning_en]||'');
  return items;
}
function meaningText(x){return x.meaning_id||'Arti belum bisa dimuat. Periksa internet lalu buka ulang.';}
function vocabCard(x){return `<article class="vocab-word-card fx-card fx-ring"><div class="vocab-card-top"><span class="vocab-tag">BAB ${x.lesson}</span><span class="vocab-type">${vesc(x.romaji||'')}</span></div><div class="vocab-jp">${vesc(x.kanji||x.kana)}</div><div class="vocab-kana">${vesc(x.kana||'')}</div><div class="vocab-meaning" data-vocab-meaning="${vesc(x.id)}">${vesc(meaningText(x))}</div></article>`;}
function lessonCard(n,count){return `<button type="button" class="vocab-chapter-card fx-card fx-ring" data-chapter="${n}"><span class="vocab-chapter-front"><span class="vocab-chapter-no">BAB ${n}</span><strong>ことば</strong><small>${count?`${count} kata`:'Belum ada data'}</small><em>Klik untuk membalik</em></span><span class="vocab-chapter-back"><span class="vocab-chapter-no">BAB ${n}</span><b>Kamu mau apa?</b><span class="vocab-chapter-actions"><span data-learn="${n}">📖 Pelajari</span><span data-test="${n}">📝 Test</span></span></span></button>`;}
function testSelectionButton(){return `<div class="vocab-choice-test card"><div><div class="eyebrow">🎯 TEST PILIHAN KOSAKATA</div><h3>Pilih sendiri bab yang mau kamu test</h3><p class="muted">Centang satu, beberapa, atau semua bab. Pilihanmu hanya berlaku untuk test ini.</p></div><button type="button" class="btn red" id="openVocabChoiceTest">Pilih Bab &amp; Mulai Test</button></div>`;}
function selectionModal(initial=[1]){
  const modal=document.createElement('div');modal.className='vocab-setup-backdrop';modal.id='vocabSetupModal';
  modal.innerHTML=`<div class="vocab-setup-card"><button class="bunpou-close" id="vocabSetupClose">×</button><div class="eyebrow">🎯 TEST PILIHAN KOSAKATA</div><h2>Pilih Bab untuk Test</h2><p class="muted">Centang bab yang ingin kamu gunakan.</p><div class="vocab-pick-tools"><button type="button" class="btn" data-pick="all">☑ Semua</button><button type="button" class="btn" data-pick="1-25">Bab 1–25</button><button type="button" class="btn" data-pick="26-50">Bab 26–50</button><button type="button" class="btn" data-pick="none">Kosongkan</button></div><div class="vocab-choice-grid">${Array.from({length:50},(_,i)=>{const n=i+1;return `<label class="vocab-choice"><input type="checkbox" value="${n}" ${initial.includes(n)?'checked':''}><span>Bab ${n}</span></label>`}).join('')}</div><div class="vocab-setup-section"><b>Mode</b><div class="segmented"><button class="seg active" data-vmode="jp_id">🇯🇵 Jepang → 🇮🇩 Indonesia</button><button class="seg" data-vmode="id_jp">🇮🇩 Indonesia → 🇯🇵 Jepang</button></div></div><div class="vocab-setup-section"><b>Jumlah soal</b><div class="vocab-counts"><button class="btn active" data-vcount="10">10</button><button class="btn" data-vcount="20">20</button><button class="btn" data-vcount="30">30</button><button class="btn" data-vcount="50">50</button></div></div><button class="btn red full" id="startKotoba">🚀 Mulai Test</button></div>`;
  document.body.appendChild(modal);let mode='jp_id',count=10;
  const boxes=()=>[...modal.querySelectorAll('.vocab-choice input')];
  modal.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{const p=b.dataset.pick;boxes().forEach(x=>x.checked=p==='all'||(p==='1-25'&&+x.value<=25)||(p==='26-50'&&+x.value>=26));});
  modal.querySelectorAll('[data-vmode]').forEach(b=>b.onclick=()=>{mode=b.dataset.vmode;modal.querySelectorAll('[data-vmode]').forEach(x=>x.classList.toggle('active',x===b));});
  modal.querySelectorAll('[data-vcount]').forEach(b=>b.onclick=()=>{count=Number(b.dataset.vcount);modal.querySelectorAll('[data-vcount]').forEach(x=>x.classList.toggle('active',x===b));});
  modal.querySelector('#vocabSetupClose').onclick=()=>modal.remove();modal.onclick=e=>{if(e.target===modal)modal.remove();};
  modal.querySelector('#startKotoba').onclick=()=>{const lessons=boxes().filter(x=>x.checked).map(x=>+x.value).sort((a,b)=>a-b);if(!lessons.length)return alert('Pilih minimal satu bab.');window.__kotobaSetup={lessons,mode,count};modal.remove();location.hash='tes-kotoba';};
  return modal;
}

export async function kosakata({state,shell,esc=vesc,norm=vnorm}){
  shell(`<section class="section vocab-page"><div class="section-title"><div><div class="eyebrow">📖 KOSAKATA</div><h2>Minna no Nihongo I · Bab 1–50</h2><p class="muted">Klik kartu Bab untuk membaliknya. Pilih Pelajari untuk melihat kosakata atau Test untuk langsung menguji bab tersebut.</p></div></div><div id="vocabMount"><div id="vocabLoading" class="card vocab-loading">Memuat data kosakata…</div></div></section>`);
  try{
    const data=await loadVocab();
    const byLesson=n=>data.filter(x=>x.lesson===n);
    const renderLesson=async n=>{
      const rows=byLesson(n).slice();
      const mount=document.querySelector('#vocabMount');if(!mount)return;
      mount.innerHTML=`<div class="card vocab-loading">Menyiapkan arti Bahasa Indonesia untuk Bab ${n}…</div>`;
      try{await translateItems(rows);}catch{}
      mount.innerHTML=`<div class="vocab-learn-head"><button type="button" class="btn" id="backVocab">← Kembali ke Bab</button><div><div class="eyebrow">📖 BELAJAR KOSAKATA</div><h2>Bab ${n}</h2><p class="muted">${rows.length} kata tersedia.</p></div><button type="button" class="btn red" id="lessonTest">📝 Test Bab ${n}</button></div><div class="vocab-grid">${rows.map(vocabCard).join('')||'<div class="empty">Data kosakata untuk bab ini belum tersedia.</div>'}</div>`;
      runFx();document.querySelector('#backVocab').onclick=()=>render();
      document.querySelector('#lessonTest').onclick=()=>{window.__kotobaSetup={lessons:[n],mode:'jp_id',count:10};location.hash='tes-kotoba';};
    };
    const render=async()=>{
      const counts=Object.fromEntries(Array.from({length:50},(_,i)=>[i+1,byLesson(i+1).length]));
      const first=Array.from({length:25},(_,i)=>i+1).map(n=>lessonCard(n,counts[n])).join('');
      const second=Array.from({length:25},(_,i)=>i+26).map(n=>lessonCard(n,counts[n])).join('');
      const mount=document.querySelector('#vocabMount');if(!mount)return;
      mount.innerHTML=`<div class="vocab-chapter-grid">${first}</div><div class="vocab-chapter-grid">${second}</div>${testSelectionButton()}<p class="vocab-source-note">Data kosakata pihak ketiga digunakan sebagai referensi pendamping buku. Buku Minna no Nihongo tetap menjadi sumber utama pembelajaran.</p>`;
      runFx();document.querySelectorAll('[data-chapter]').forEach(card=>card.onclick=()=>{card.classList.toggle('flipped');});
      document.querySelectorAll('[data-learn]').forEach(el=>el.onclick=e=>{e.stopPropagation();renderLesson(Number(el.dataset.learn));});
      document.querySelectorAll('[data-test]').forEach(el=>el.onclick=e=>{e.stopPropagation();window.__kotobaSetup={lessons:[Number(el.dataset.test)],mode:'jp_id',count:10};location.hash='tes-kotoba';});
      document.querySelector('#openVocabChoiceTest').onclick=()=>selectionModal([]);
    };
    await render();
  }catch(e){const el=document.querySelector('#vocabLoading');if(el)el.innerHTML=`<b>Gagal memuat kosakata.</b><p class="muted">${vesc(e.message||'Coba buka kembali halaman ini.')}</p>`;}
}

function pickQuestions(data,lessons,count){let pool=data.filter(x=>lessons.includes(x.lesson));pool=[...pool].sort(()=>Math.random()-.5);return pool.slice(0,Math.min(count,pool.length));}
export async function tesKotoba({state,shell,recordActivity,supabase,sbReady}){
  try{
    stopKotobaTimer();kotobaFinished=false;
    const data=await loadVocab();const setup=window.__kotobaSetup||{lessons:[1],mode:'jp_id',count:10};
    let rows=pickQuestions(data,setup.lessons,setup.count);if(!rows.length)throw new Error('Kosakata dari bab yang dipilih belum tersedia.');await translateItems(rows).catch(()=>{});rows=rows.filter(x=>x.meaning_id);if(!rows.length)throw new Error('Arti Bahasa Indonesia belum bisa dimuat. Periksa koneksi internet lalu coba lagi.');
    const answers={};let index=0;const started=Date.now();kotobaTimerSeconds=await getKotobaTimer(supabase,sbReady);kotobaTimerLeft=kotobaTimerSeconds;
    await recordActivity('kotoba_test_start',{total:rows.length,lessons:setup.lessons,mode:setup.mode,timer_seconds:kotobaTimerSeconds});let finishStarted=false;
    const finish=async(timedOut=false)=>{if(finishStarted)return;finishStarted=true;kotobaFinished=true;stopKotobaTimer();const details=rows.map((q,i)=>{const forward=setup.mode==='jp_id';const correct=forward?q.meaning_id:(q.romaji||q.kana);return {lesson:q.lesson,japanese:q.kanji||q.kana,kana:q.kana,romaji:q.romaji,meaning:q.meaning_id,user_answer:answers[i]||'',correct:vnorm(answers[i])===vnorm(correct),direction:setup.mode};});const correct=details.filter(x=>x.correct).length,unanswered=details.filter(x=>!x.user_answer).length,wrong=details.length-correct-unanswered,score=details.length?Math.round(correct/details.length*100):0,duration=Math.round((Date.now()-started)/1000);if(sbReady&&state.user){const {error}=await supabase.from('assessment_results').insert({user_id:state.user.id,test_type:'kotoba',score,correct_count:correct,wrong_count:wrong,unanswered_count:unanswered,duration_seconds:duration,details});if(error)console.warn('Hasil Test Kotoba belum tersimpan:',error.message);}await recordActivity('kotoba_test_finish',{score,correct,wrong,unanswered,duration_seconds:duration,lessons:setup.lessons,mode:setup.mode,timed_out:timedOut});shell(`<section class="section result hira-result"><div class="result-card fx-float fx-ring"><div class="eyebrow">HASIL TEST KOTOBA</div><h1>${score}<small>/100</small></h1><div class="result-stats"><span>Benar <b>${correct}</b></span><span>Salah <b>${wrong}</b></span><span>Tidak dijawab <b>${unanswered}</b></span></div><p class="muted">Bab: ${setup.lessons.join(', ')} · ${Math.floor(duration/60)} menit ${duration%60} detik${timedOut?' · ⏰ Waktu habis':''}</p></div><div class="review-list"><h2>Review</h2>${details.map((x,i)=>`<article class="review ${x.correct?'ok':'bad'}"><b>${i+1}. ${vesc(x.japanese)} · ${vesc(x.romaji)}</b><span>Arti: ${vesc(x.meaning)}</span><span>Jawaban kamu: ${vesc(x.user_answer)||'—'}</span><span>Jawaban benar: ${vesc(x.direction==='jp_id'?x.meaning:x.romaji)}</span></article>`).join('')}</div><a class="cta" href="#akun">Lihat hasil di Akun</a></section>`);};
    window.__finishKotoba=finish;
    const render=async()=>{const q=rows[index];if(!q)return finish(false);const forward=setup.mode==='jp_id';const pool=data.filter(x=>x.id!==q.id&&setup.lessons.includes(x.lesson)).sort(()=>Math.random()-.5).slice(0,14);try{await translateItems([q,...pool]);}catch{}const good=pool.filter(x=>x.meaning_id);const correct=forward?meaningText(q):(q.romaji||q.kana);const opts=[correct,...good.slice(0,3).map(x=>forward?meaningText(x):(x.romaji||x.kana))].filter(Boolean);const unique=[...new Set(opts)].sort(()=>Math.random()-.5);shell(`<section class="section vocab-test-page"><div class="section-title"><div><div class="eyebrow">🎯 TEST KOTOBA · ${index+1}/${rows.length}</div><h2>${forward?'Jepang → Indonesia':'Indonesia → Jepang'}</h2></div><div id="kotobaTestTimer" class="timer-text"></div></div><div class="hira-progress"><i style="width:${((index+1)/rows.length)*100}%"></i></div><div class="vocab-test-question fx-float fx-ring"><span class="vocab-tag">BAB ${q.lesson}</span><div class="vocab-test-prompt">${vesc(forward?(q.kanji||q.kana):meaningText(q))}</div>${forward?`<div class="vocab-kana">${vesc(q.kana||'')}</div>`:''}</div><div class="vocab-options">${unique.map((o,i)=>`<button type="button" class="btn vocab-option ${vnorm(answers[index])===vnorm(o)?'selected':''}" data-vanswer="${vesc(o)}"><b class="choice-letter">${String.fromCharCode(65+i)}.</b> ${vesc(o)}</button>`).join('')}</div><div class="exercise-nav"><button type="button" class="btn" id="vprev" ${index===0?'disabled':''}>← Sebelumnya</button><button type="button" class="btn red" id="vnext">${index===rows.length-1?'Selesai':'Selanjutnya →'}</button></div></section>`);startKotobaTimer();document.querySelectorAll('[data-vanswer]').forEach(b=>b.onclick=()=>{answers[index]=b.dataset.vanswer;document.querySelectorAll('[data-vanswer]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');});document.querySelector('#vprev').onclick=()=>{if(index>0){index--;render();}};document.querySelector('#vnext').onclick=()=>{if(index<rows.length-1){index++;render();}else finish(false);};};
    await render();
  }catch(e){stopKotobaTimer();window.__finishKotoba=null;shell(`<section class="section"><div class="card"><h2>Test Kotoba tidak bisa dimulai</h2><p class="muted">${vesc(e.message||'Data belum tersedia.')}</p><a class="btn" href="#kosakata">Kembali ke Kosakata</a></div></section>`);}
}
export function openKotobaSetup(initial=[1]){loadVocab().then(()=>selectionModal(initial));}
