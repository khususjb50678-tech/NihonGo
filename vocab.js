const VOCAB_SOURCE='https://raw.githubusercontent.com/vitto4/MinnaNoDS/main/minna-no-ds.yaml';
const TRANSLATE_URL='https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=id&dt=t&q=';
const TRANSLATE_FALLBACK='https://api.mymemory.translated.net/get?q=';
const CACHE_KEY='itco_minna_vocab_v5';
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
  'i':'Saya','me':'Saya','my':'Saya','we':'Kami, kita','our':'Kami, kita','you':'Anda, kamu','your':'Anda, kamu','he':'Dia (laki-laki)','she':'Dia (perempuan)','they':'Mereka','that person, he, she':'Orang itu (biasa)','that person':'Orang itu','person':'Orang','people':'Orang-orang',
  'teacher':'Guru, dosen','student':'Siswa, murid','university':'Universitas','hospital':'Rumah sakit','doctor':'Dokter','researcher':'Peneliti','company employee':'Pegawai perusahaan','employee':'Pegawai','bank employee':'Pegawai bank','name':'Nama','what is your name?':'Nama Anda siapa?','yes':'Iya','no':'Tidak','introduction':'Perkenalan','excuse me':'Permisi','nice to meet you':'Senang berkenalan','nice to meet you too':'Senang berkenalan juga',
  'america':'Amerika','england':'Inggris','india':'India','indonesia':'Indonesia','korea':'Korea','china':'China','germany':'Jerman','japan':'Jepang','france':'Prancis',
  'this':'Ini','that':'Itu','that over there':'Itu (jauh)','book':'Buku','dictionary':'Kamus','magazine':'Majalah','newspaper':'Koran','notebook':'Buku catatan','name card':'Kartu nama','card':'Kartu','pencil':'Pensil','ballpoint pen':'Bolpoin','key':'Kunci','watch, clock':'Jam, arloji','umbrella':'Payung','bag':'Tas','television':'Televisi','radio':'Radio','camera':'Kamera','computer':'Komputer','car':'Mobil','desk':'Meja','chair':'Kursi','chocolate':'Cokelat','coffee':'Kopi','souvenir':'Oleh-oleh','english language':'Bahasa Inggris','japanese language':'Bahasa Jepang','what':'Apa','really?':'Benarkah?','please':'Silakan','thank you very much':'Terima kasih banyak','is that so?':'Oh, begitu / benarkah?','different':'Berbeda','wrong':'Salah',
  'get up':'Bangun tidur','go to bed':'Tidur','work':'Bekerja','rest, take a holiday':'Beristirahat, libur','study':'Belajar','finish':'Selesai','department store':'Departemen store','bank':'Bank','post office':'Kantor pos','library':'Perpustakaan','art museum':'Gedung kesenian','now':'Sekarang','morning':'Pagi','afternoon':'Siang','evening':'Malam','night':'Malam','yesterday':'Kemarin','today':'Hari ini','tomorrow':'Besok','day after tomorrow':'Besok lusa','every morning':'Setiap pagi','every night':'Setiap malam','every day':'Setiap hari','monday':'Hari Senin','tuesday':'Hari Selasa','wednesday':'Hari Rabu','thursday':'Hari Kamis','friday':'Hari Jumat','saturday':'Hari Sabtu','sunday':'Hari Minggu','from':'Dari','until':'Sampai','and':'Dan',
  'go':'Pergi','come':'Datang','return, go home':'Pulang','school':'Sekolah','supermarket':'Supermarket','station':'Stasiun','airplane':'Pesawat terbang','ship':'Kapal','train':'Kereta','subway':'Kereta bawah tanah','shinkansen':'Shinkansen','bus':'Bus','taxi':'Taksi','bicycle':'Sepeda','on foot':'Jalan kaki','friend':'Teman','boyfriend, he':'Dia (laki-laki)','girlfriend, she':'Dia (perempuan)','family':'Keluarga','alone':'Sendirian','last week':'Minggu lalu','this week':'Minggu ini','next week':'Minggu depan','last month':'Bulan lalu','this month':'Bulan ini','next month':'Bulan depan','last year':'Tahun lalu',
  'eat':'Makan','drink':'Minum','smoke':'Merokok','see, watch':'Melihat, menonton','hear, listen':'Mendengar','read':'Membaca','write':'Menulis','buy':'Membeli','take, photograph':'Mengambil foto','do':'Melakukan','meet':'Bertemu','rice':'Nasi','breakfast':'Sarapan','lunch':'Makan siang','dinner':'Makan malam','bread':'Roti','egg':'Telur','meat':'Daging','fish':'Ikan','vegetable':'Sayuran','fruit':'Buah-buahan','water':'Air','green tea':'Teh hijau','tea':'Teh','milk':'Susu','juice':'Jus','beer':'Bir','alcohol, sake':'Minuman keras','cigarette':'Rokok','letter':'Surat','report':'Laporan','photograph':'Foto','video':'Video','shop, store':'Toko','garden':'Halaman','homework':'Pekerjaan rumah','tennis':'Tenis','soccer':'Sepak bola','together':'Bersama-sama','a little':'Sedikit','always':'Selalu','sometimes':'Kadang-kadang','then':'Kemudian','good':'Baik, bagus','understand':'Mengerti','see you':'Sampai jumpa',
  'handsome':'Tampan','beautiful, clean':'Cantik, bersih','quiet':'Tenang','lively':'Ramai','famous':'Terkenal','kind':'Baik hati','healthy, energetic':'Sehat','free, not busy':'Senggang','convenient':'Praktis','wonderful':'Bagus','big':'Besar','small':'Kecil','new':'Baru','old':'Lama, tua','bad':'Jelek','hot':'Panas','cold':'Dingin','difficult':'Sulit','easy':'Mudah','expensive, high':'Mahal, tinggi','cheap':'Murah','low':'Rendah','interesting':'Menarik','delicious':'Enak','busy':'Sibuk','fun':'Menyenangkan','white':'Putih','black':'Hitam','red':'Merah','blue':'Biru','cherry blossom':'Bunga sakura','mountain':'Gunung','town, city':'Kota','food':'Makanan','place':'Tempat','dormitory':'Asrama','restaurant':'Restoran','life':'Kehidupan','job, work':'Pekerjaan','how':'Bagaimana','very':'Sangat','not very':'Tidak begitu','but':'Tetapi','how are you?':'Apa kabar?','green':'Hijau','purple':'Ungu','yellow':'Kuning','brown':'Cokelat','pink':'Merah muda','orange':'Oranye','gray':'Abu-abu','beige':'Krem','spring':'Musim semi','summer':'Musim panas','autumn':'Musim gugur','winter':'Musim dingin',
  'there is, exist (inanimate)':'Ada (benda mati)','there is, exist (animate)':'Ada (benda hidup)','various':'Berbagai, macam-macam','man':'Orang laki-laki','woman':'Orang perempuan','boy':'Anak laki-laki','girl':'Anak perempuan','dog':'Anjing','cat':'Kucing','panda':'Panda','elephant':'Gajah','tree':'Pohon','thing':'Barang','battery':'Baterai','box':'Kotak','switch':'Saklar','refrigerator':'Kulkas','table':'Meja','bed':'Tempat tidur','shelf':'Rak, lemari','door':'Pintu','window':'Jendela','mailbox':'Kotak surat','building':'Gedung','convenience store':'Toko 24 jam','park':'Taman','coffee shop':'Kedai kopi, kafe','shop':'Toko','entrance':'Pintu masuk','bathroom':'Kamar mandi','kitchen':'Dapur','dining room':'Ruang makan','living room':'Ruang tamu','bedroom':'Kamar tidur','hallway':'Koridor',
  'how many':'Berapa','one person':'1 orang','two people':'2 orang','many':'Banyak','number':'Nomor','exam':'Ujian','meeting':'Rapat','movie':'Film','every':'Setiap','about':'Sekitar','in total':'Secara keseluruhan'
};
function offlineMeaning(en){
  const s=String(en||'').trim(); if(!s)return '';
  const key=s.toLowerCase().replace(/[“”]/g,'').replace(/\s+/g,' ');
  if(OFFLINE_ID[key])return OFFLINE_ID[key];
  if(/\b(university|college)\b/i.test(key))return 'Universitas';
  if(/\bhospital\b/i.test(key))return 'Rumah sakit';
  if(/\bdoctor\b/i.test(key))return 'Dokter';
  if(/\bteacher\b/i.test(key))return 'Guru, dosen';
  if(/\bstudent\b/i.test(key))return 'Siswa, murid';
  if(/\bresearcher\b/i.test(key))return 'Peneliti';
  return '';
}
async function translateMeaning(en){
  const source=String(en||'').trim(); if(!source)return '';
  const cache=getTranslationCache(); if(cache[source])return cache[source];
  const local=offlineMeaning(source); if(local){cache[source]=local;saveTranslationCache(cache);return local;}
  const urls=[
    TRANSLATE_URL+encodeURIComponent(source),
    TRANSLATE_FALLBACK+encodeURIComponent(source)+'&langpair=en|id',
    'https://libretranslate.de/translate?source=en&target=id&q='+encodeURIComponent(source)
  ];
  for(const url of urls){
    try{
      const r=await fetch(url,{cache:'no-store'}); if(!r.ok)continue;
      const j=await r.json();
      let id='';
      if(Array.isArray(j?.[0]))id=j[0].map(x=>x?.[0]||'').join('').trim();
      else id=String(j?.responseData?.translatedText||j?.translatedText||'').trim();
      if(id && id.toLowerCase()!==source.toLowerCase() && !/^(i|we|you|he|she|the|a|an|that|this|and|or|to|of)$/i.test(id)){
        cache[source]=id;saveTranslationCache(cache);return id;
      }
    }catch{}
  }
  return '';
}
async function translateItems(items){
  const cache=getTranslationCache();
  items.forEach(x=>x.meaning_id=cache[x.meaning_en]||offlineMeaning(x.meaning_en)||'');
  const need=[...new Set(items.map(x=>x.meaning_en).filter(x=>x&&!cache[x]&&!offlineMeaning(x)))];
  for(let i=0;i<need.length;i+=3){
    await Promise.all(need.slice(i,i+3).map(async en=>{const id=await translateMeaning(en);if(id)cache[en]=id;}));
    saveTranslationCache(cache);
    items.forEach(x=>{if(cache[x.meaning_en])x.meaning_id=cache[x.meaning_en];});
  }
  return items;
}
function meaningText(x){return x.meaning_id||'Memuat arti Indonesia…';}
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
      rows.forEach(x=>x.meaning_id=getTranslationCache()[x.meaning_en]||offlineMeaning(x.meaning_en)||'');
      mount.innerHTML=`<div class="vocab-learn-head"><button type="button" class="btn" id="backVocab">← Kembali ke Bab</button><div><div class="eyebrow">📖 BELAJAR KOSAKATA</div><h2>Bab ${n}</h2><p class="muted">${rows.length} kata tersedia.</p></div><button type="button" class="btn red" id="lessonTest">📝 Test Bab ${n}</button></div><div class="vocab-grid">${rows.map(vocabCard).join('')||'<div class="empty">Data kosakata untuk bab ini belum tersedia.</div>'}</div>`;
      translateItems(rows).then(()=>rows.forEach(x=>{const el=document.querySelector(`[data-vocab-meaning="${x.id}"]`);if(el)el.textContent=meaningText(x);})).catch(()=>{});
      document.querySelector('#backVocab').onclick=()=>render();
      document.querySelector('#lessonTest').onclick=()=>{window.__kotobaSetup={lessons:[n],mode:'jp_id',count:10};location.hash='tes-kotoba';};
    };
    const render=async()=>{
      const counts=Object.fromEntries(Array.from({length:50},(_,i)=>[i+1,byLesson(i+1).length]));
      const first=Array.from({length:25},(_,i)=>i+1).map(n=>lessonCard(n,counts[n])).join('');
      const second=Array.from({length:25},(_,i)=>i+26).map(n=>lessonCard(n,counts[n])).join('');
      const mount=document.querySelector('#vocabMount');if(!mount)return;
      mount.innerHTML=`<div class="vocab-chapter-grid">${first}</div><div class="vocab-chapter-grid">${second}</div>${testSelectionButton()}<p class="vocab-source-note">Data kosakata pihak ketiga digunakan sebagai referensi pendamping buku. Buku Minna no Nihongo tetap menjadi sumber utama pembelajaran.</p>`;
      document.querySelectorAll('[data-chapter]').forEach(card=>card.onclick=()=>{card.classList.toggle('flipped');});
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
    const rows=pickQuestions(data,setup.lessons,setup.count);if(!rows.length)throw new Error('Kosakata dari bab yang dipilih belum tersedia.');translateItems(rows).catch(()=>{});
    const answers={};let index=0;const started=Date.now();kotobaTimerSeconds=await getKotobaTimer(supabase,sbReady);kotobaTimerLeft=kotobaTimerSeconds;
    await recordActivity('kotoba_test_start',{total:rows.length,lessons:setup.lessons,mode:setup.mode,timer_seconds:kotobaTimerSeconds});let finishStarted=false;
    const finish=async(timedOut=false)=>{if(finishStarted)return;finishStarted=true;kotobaFinished=true;stopKotobaTimer();const details=rows.map((q,i)=>{const forward=setup.mode==='jp_id';const correct=forward?q.meaning_id:(q.romaji||q.kana);return {lesson:q.lesson,japanese:q.kanji||q.kana,kana:q.kana,romaji:q.romaji,meaning:q.meaning_id,user_answer:answers[i]||'',correct:vnorm(answers[i])===vnorm(correct),direction:setup.mode};});const correct=details.filter(x=>x.correct).length,unanswered=details.filter(x=>!x.user_answer).length,wrong=details.length-correct-unanswered,score=details.length?Math.round(correct/details.length*100):0,duration=Math.round((Date.now()-started)/1000);if(sbReady&&state.user){const {error}=await supabase.from('assessment_results').insert({user_id:state.user.id,test_type:'kotoba',score,correct_count:correct,wrong_count:wrong,unanswered_count:unanswered,duration_seconds:duration,details});if(error)console.warn('Hasil Test Kotoba belum tersimpan:',error.message);}await recordActivity('kotoba_test_finish',{score,correct,wrong,unanswered,duration_seconds:duration,lessons:setup.lessons,mode:setup.mode,timed_out:timedOut});shell(`<section class="section result hira-result"><div class="result-card fx-float fx-ring"><div class="eyebrow">HASIL TEST KOTOBA</div><h1>${score}<small>/100</small></h1><div class="result-stats"><span>Benar <b>${correct}</b></span><span>Salah <b>${wrong}</b></span><span>Tidak dijawab <b>${unanswered}</b></span></div><p class="muted">Bab: ${setup.lessons.join(', ')} · ${Math.floor(duration/60)} menit ${duration%60} detik${timedOut?' · ⏰ Waktu habis':''}</p></div><div class="review-list"><h2>Review</h2>${details.map((x,i)=>`<article class="review ${x.correct?'ok':'bad'}"><b>${i+1}. ${vesc(x.japanese)} · ${vesc(x.romaji)}</b><span>Arti: ${vesc(x.meaning)}</span><span>Jawaban kamu: ${vesc(x.user_answer)||'—'}</span><span>Jawaban benar: ${vesc(x.direction==='jp_id'?x.meaning:x.romaji)}</span></article>`).join('')}</div><a class="cta" href="#akun">Lihat hasil di Akun</a></section>`);};
    window.__finishKotoba=finish;
    const render=async()=>{const q=rows[index];if(!q)return finish(false);const forward=setup.mode==='jp_id';const pool=data.filter(x=>x.id!==q.id&&setup.lessons.includes(x.lesson)).sort(()=>Math.random()-.5).slice(0,12);try{if(forward)await translateItems([q,...pool]);}catch{}const correct=forward?(q.meaning_id||offlineMeaning(q.meaning_en)):(q.romaji||q.kana);let candidates=pool.map(x=>forward?(x.meaning_id||offlineMeaning(x.meaning_en)):(x.romaji||x.kana)).filter(Boolean).filter(x=>vnorm(x)!==vnorm(correct));let unique=[...new Set([correct,...candidates])].slice(0,4).sort(()=>Math.random()-.5);if(unique.length<4&&forward){const extra=data.filter(x=>x.id!==q.id&&!unique.some(u=>vnorm(u)===vnorm(offlineMeaning(x.meaning_en)))).map(x=>offlineMeaning(x.meaning_en)).filter(Boolean);unique=[...new Set([...unique,...extra])].slice(0,4).sort(()=>Math.random()-.5);}if(unique.length<4){const fillers=['Pilihan Indonesia A','Pilihan Indonesia B','Pilihan Indonesia C','Pilihan Indonesia D'];for(const f of fillers){if(unique.length>=4)break;if(!unique.includes(f))unique.push(f);}}shell(`<section class="section vocab-test-page"><div class="section-title"><div><div class="eyebrow">🎯 TEST KOTOBA · ${index+1}/${rows.length}</div><h2>${forward?'Jepang → Indonesia':'Indonesia → Jepang'}</h2></div><div id="kotobaTestTimer" class="timer-text"></div></div><div class="hira-progress"><i style="width:${((index+1)/rows.length)*100}%"></i></div><div class="vocab-test-question fx-float fx-ring"><span class="vocab-tag">BAB ${q.lesson}</span><div class="vocab-test-prompt">${vesc(forward?(q.kanji||q.kana):meaningText(q))}</div>${forward?`<div class="vocab-kana">${vesc(q.kana||'')}</div>`:''}</div><div class="vocab-options">${unique.map((o,i)=>`<button type="button" class="btn vocab-option ${vnorm(answers[index])===vnorm(o)?'selected':''}" data-vanswer="${vesc(o)}"><b class="choice-letter">${String.fromCharCode(65+i)}.</b> ${vesc(o)}</button>`).join('')}</div><div class="exercise-nav"><button type="button" class="btn" id="vprev" ${index===0?'disabled':''}>← Sebelumnya</button><button type="button" class="btn red" id="vnext">${index===rows.length-1?'Selesai':'Selanjutnya →'}</button></div></section>`);startKotobaTimer();document.querySelectorAll('[data-vanswer]').forEach(b=>b.onclick=()=>{answers[index]=b.dataset.vanswer;document.querySelectorAll('[data-vanswer]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');});document.querySelector('#vprev').onclick=()=>{if(index>0){index--;render();}};document.querySelector('#vnext').onclick=()=>{if(index<rows.length-1){index++;render();}else finish(false);};};
    await render();
  }catch(e){stopKotobaTimer();window.__finishKotoba=null;shell(`<section class="section"><div class="card"><h2>Test Kotoba tidak bisa dimulai</h2><p class="muted">${vesc(e.message||'Data belum tersedia.')}</p><a class="btn" href="#kosakata">Kembali ke Kosakata</a></div></section>`);}
}
export function openKotobaSetup(initial=[1]){loadVocab().then(()=>selectionModal(initial));}
