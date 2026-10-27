import { runFx } from './cardstyle.js';
import { showResult } from './matematika.js';
import { BOOK, toRomaji } from './vocab-book.js';
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
function bookRows(){
  const out=[];
  for(const l of Object.keys(BOOK).map(Number).sort((a,b)=>a-b))BOOK[l].forEach((str,i)=>{
    const p=str.split('|');const hasKanji=p.length>=3;
    const kanji=hasKanji?p[0]:'',kana=hasKanji?p[1]:p[0],arti=p[p.length-1];
    out.push({id:`${l}-${i+1}`,lesson:l,number:i+1,kanji,kana,romaji:toRomaji(kana),meaning_en:'',meaning_id:arti});
  });
  return out;
}
function applyEdits(rows,edits){
  const map=new Map(edits.filter(e=>e.number!=null).map(e=>[`${e.lesson}-${e.number}`,e]));const out=[];
  for(let r of rows){const e=map.get(r.id);if(e){if(e.hidden)continue;r={...r,kanji:e.kanji??r.kanji,kana:e.kana??r.kana,meaning_id:e.arti??r.meaning_id};r.romaji=toRomaji(r.kana);}out.push(r);}
  edits.filter(e=>e.number==null&&!e.hidden).forEach((e,i)=>out.push({id:`${e.lesson}-x${e.id}`,lesson:e.lesson,number:1000+i,kanji:e.kanji||'',kana:e.kana||'',romaji:toRomaji(e.kana||''),meaning_en:'',meaning_id:e.arti||''}));
  return out;
}
async function loadVocab(){
  if(vocabCache)return vocabCache;if(vocabLoadPromise)return vocabLoadPromise;
  vocabLoadPromise=(async()=>{
    const book=bookRows();let old=[];
    try{const r=await fetch(VOCAB_SOURCE,{cache:'no-store'});if(r.ok)old=parseMinnaYaml(await r.text()).filter(x=>x.lesson<=25&&!BOOK[x.lesson]);}catch{}
    let edits=[];try{const m=await import('./supabase.js');if(m.sbReady){const {data}=await m.supabase.from('vocab_edits').select('*');edits=data||[];}}catch{}
    vocabCache=applyEdits([...book,...old],edits).sort((a,b)=>a.lesson-b.lesson||a.number-b.number);
    if(!vocabCache.length)throw new Error('Data kosakata gagal dimuat.');return vocabCache;
  })().finally(()=>{vocabLoadPromise=null;});
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
 'わたし':'Saya','わたしたち':'Kami, kita','あなた':'Anda, kamu','あのひと(あのかた)':'Orang itu (あのかた = bentuk sopan: beliau)','あのひと':'Orang itu','あのかた':'Beliau (bentuk sopan dari あの人)',
 'みなさん':'Anda sekalian, semuanya','~さん':'Bapak/Ibu/Saudara ~ (sapaan sopan)','~ちゃん':'Dik ~ (sapaan akrab untuk anak kecil)','~くん':'Dik ~ (sapaan untuk anak laki-laki)','~じん':'Orang ~ (kebangsaan)',
 'せんせい':'Guru, dosen (sapaan)','きょうし':'Guru, dosen (profesi)','がくせい':'Siswa, mahasiswa','かいしゃいん':'Karyawan perusahaan','しゃいん':'Karyawan perusahaan ~','ぎんこういん':'Pegawai bank','いしゃ':'Dokter','けんきゅうしゃ':'Peneliti','エンジニア':'Insinyur',
 'だいがく':'Universitas','びょういん':'Rumah sakit','でんき':'Listrik','だれ(どなた)':'Siapa (どなた = bentuk sopan)','だれ':'Siapa','どなた':'Siapa (sopan)',
 '~さい':'~ tahun (usia)','なんさい(おいくつ)':'Berapa umur? (おいくつ = bentuk sopan)','なんさい':'Berapa umur?','おいくつ':'Berapa umur? (sopan)',
 'はい':'Ya','いいえ':'Bukan, tidak','しつれいですが':'Permisi, maaf (sebelum bertanya)','おなまえは?':'Siapa nama Anda?','はじめまして':'Senang bertemu dengan Anda (salam perkenalan)',
 'どうぞよろしくおねがいします':'Mohon bantuannya, senang berkenalan','こちらは~さんです':'Ini adalah Bapak/Ibu ~','~からきました':'Saya datang dari ~',
 'アメリカ':'Amerika','イギリス':'Inggris','インド':'India','インドネシア':'Indonesia','かんこく':'Korea Selatan','タイ':'Thailand','ちゅうごく':'Tiongkok','ドイツ':'Jerman','にほん':'Jepang','フランス':'Prancis','ブラジル':'Brasil'
};
function jkey(s){return String(s||'').replace(/[\s\u3000]/g,'').replace(/（/g,'(').replace(/）/g,')').replace(/[～〜]/g,'~').replace(/？/g,'?');}
function dictMeaning(x){
  if(x.meaning_id)return x.meaning_id;
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
  modal.innerHTML=`<div class="vocab-setup-card"><button class="bunpou-close" id="vocabSetupClose">×</button><div class="eyebrow">🎯 TEST PILIHAN KOSAKATA</div><h2>Pilih Bab untuk Test</h2><p class="muted">Centang bab yang ingin kamu gunakan.</p><div class="vocab-pick-tools"><button type="button" class="btn" data-pick="all">☑ Semua</button><button type="button" class="btn" data-pick="1-25">Bab 1–25</button><button type="button" class="btn" data-pick="none">Kosongkan</button></div><div class="vocab-choice-grid">${Array.from({length:25},(_,i)=>{const n=i+1;return `<label class="vocab-choice"><input type="checkbox" value="${n}" ${initial.includes(n)?'checked':''}><span>Bab ${n}</span></label>`}).join('')}</div><div class="vocab-setup-section"><b>Mode</b><div class="segmented"><button class="seg active" data-vmode="jp_id">🇯🇵 Jepang → 🇮🇩 Indonesia</button><button class="seg" data-vmode="id_jp">🇮🇩 Indonesia → 🇯🇵 Jepang</button></div></div><div class="vocab-setup-section"><b>Jumlah soal</b><div class="vocab-counts"><button class="btn active" data-vcount="10">10</button><button class="btn" data-vcount="20">20</button><button class="btn" data-vcount="30">30</button><button class="btn" data-vcount="50">50</button></div></div><button class="btn red full" id="startKotoba">🚀 Mulai Test</button></div>`;
  document.body.appendChild(modal);let mode='jp_id',count=10;
  const boxes=()=>[...modal.querySelectorAll('.vocab-choice input')];
  modal.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{const p=b.dataset.pick;boxes().forEach(x=>x.checked=p==='all'||(p==='1-25'&&+x.value<=25)||(p==='26-50'&&+x.value>=26));});
  modal.querySelectorAll('[data-vmode]').forEach(b=>b.onclick=()=>{mode=b.dataset.vmode;modal.querySelectorAll('[data-vmode]').forEach(x=>x.classList.toggle('active',x===b));});
  modal.querySelectorAll('[data-vcount]').forEach(b=>b.onclick=()=>{count=Number(b.dataset.vcount);modal.querySelectorAll('[data-vcount]').forEach(x=>x.classList.toggle('active',x===b));});
  modal.querySelector('#vocabSetupClose').onclick=()=>modal.remove();modal.onclick=e=>{if(e.target===modal)modal.remove();};
  modal.querySelector('#startKotoba').onclick=()=>{const lessons=boxes().filter(x=>x.checked).map(x=>+x.value).sort((a,b)=>a-b);if(!lessons.length)return alert('Pilih minimal satu bab.');window.__kotobaSetup={lessons,mode,count};modal.remove();location.hash='tes-kotoba';};
  return modal;
}

async function kosakataMinna({state,shell,esc=vesc,norm=vnorm,ctx={}}){
  shell(`<section class="section vocab-page">${ctx.onBack?'<button type="button" class="btn" id="backParts" style="margin-bottom:14px">← Pilih Part</button>':''}<div class="section-title"><div><div class="eyebrow">📖 KOSAKATA${ctx.partNo?` · PART ${String(ctx.partNo).padStart(2,'0')}`:''}</div><h2>${vesc(ctx.title||'Minna no Nihongo I · Bab 1–25')}</h2><p class="muted">Klik kartu Bab untuk membaliknya. Pilih Pelajari untuk melihat kosakata atau Test untuk langsung menguji bab tersebut.</p></div></div><div id="vocabMount"><div id="vocabLoading" class="card vocab-loading">Memuat data kosakata…</div></div></section>`);
  document.querySelector('#backParts')?.addEventListener('click',()=>{window.scrollTo({top:0});ctx.onBack&&ctx.onBack();});
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
      const counts=Object.fromEntries(Array.from({length:25},(_,i)=>[i+1,byLesson(i+1).length]));
      const first=Array.from({length:25},(_,i)=>i+1).map(n=>lessonCard(n,counts[n])).join('');
      const mount=document.querySelector('#vocabMount');if(!mount)return;
      mount.innerHTML=`<div class="vocab-chapter-grid">${first}</div>${testSelectionButton()}<p class="vocab-source-note">Kosakata mengikuti urutan dan arti di buku Minna no Nihongo I (Bab 1–25).</p>`;
      runFx();document.querySelectorAll('[data-chapter]').forEach(card=>card.onclick=()=>{card.classList.toggle('flipped');});
      document.querySelectorAll('[data-learn]').forEach(el=>el.onclick=e=>{e.stopPropagation();renderLesson(Number(el.dataset.learn));});
      document.querySelectorAll('[data-test]').forEach(el=>el.onclick=e=>{e.stopPropagation();window.__kotobaSetup={lessons:[Number(el.dataset.test)],mode:'jp_id',count:10};location.hash='tes-kotoba';});
      document.querySelector('#openVocabChoiceTest').onclick=()=>selectionModal([]);
    };
    await render();
  }catch(e){const el=document.querySelector('#vocabLoading');if(el)el.innerHTML=`<b>Gagal memuat kosakata.</b><p class="muted">${vesc(e.message||'Coba buka kembali halaman ini.')}</p>`;}
}

function pickQuestions(data,lessons,count){let pool=data.filter(x=>lessons.includes(x.lesson));pool=[...pool].sort(()=>Math.random()-.5);return pool.slice(0,Math.min(count,pool.length));}
export async function tesKotoba({state,shell,recordActivity,supabase,sbReady,tierFor,playSound,name,siteName,logo}){
  try{
    stopKotobaTimer();kotobaFinished=false;
    const data=await loadVocab();const setup=window.__kotobaSetup||{lessons:[1],mode:'jp_id',count:10};
    let rows=pickQuestions(data,setup.lessons,setup.count);if(!rows.length)throw new Error('Kosakata dari bab yang dipilih belum tersedia.');await translateItems(rows).catch(()=>{});rows=rows.filter(x=>x.meaning_id);if(!rows.length)throw new Error('Arti Bahasa Indonesia belum bisa dimuat. Periksa koneksi internet lalu coba lagi.');
    const answers={};let index=0;const started=Date.now();kotobaTimerSeconds=await getKotobaTimer(supabase,sbReady);kotobaTimerLeft=kotobaTimerSeconds;
    await recordActivity('kotoba_test_start',{total:rows.length,lessons:setup.lessons,mode:setup.mode,timer_seconds:kotobaTimerSeconds});let finishStarted=false;
    const finish=async(timedOut=false)=>{if(finishStarted)return;finishStarted=true;kotobaFinished=true;stopKotobaTimer();const details=rows.map((q,i)=>{const forward=setup.mode==='jp_id';const correct=forward?q.meaning_id:(q.romaji||q.kana);return {lesson:q.lesson,japanese:q.kanji||q.kana,kana:q.kana,romaji:q.romaji,meaning:q.meaning_id,user_answer:answers[i]||'',correct:vnorm(answers[i])===vnorm(correct),direction:setup.mode};});const correct=details.filter(x=>x.correct).length,unanswered=details.filter(x=>!x.user_answer).length,wrong=details.length-correct-unanswered,score=details.length?Math.round(correct/details.length*100):0,duration=Math.round((Date.now()-started)/1000);if(sbReady&&state.user){const {error}=await supabase.from('assessment_results').insert({user_id:state.user.id,test_type:'kotoba',score,correct_count:correct,wrong_count:wrong,unanswered_count:unanswered,duration_seconds:duration,details});if(error)console.warn('Hasil Test Kotoba belum tersimpan:',error.message);}await recordActivity('kotoba_test_finish',{score,correct,wrong,unanswered,duration_seconds:duration,lessons:setup.lessons,mode:setup.mode,timed_out:timedOut});const reviewHTML=details.map((x,i)=>`<article class="review ${x.correct?'ok':'bad'}"><b>${i+1}. ${vesc(x.japanese)} · ${vesc(x.romaji)}</b><span>Arti: ${vesc(x.meaning)}</span><span>Jawaban kamu: ${vesc(x.user_answer)||'—'}</span><span>Jawaban benar: ${vesc(x.direction==='jp_id'?x.meaning:x.romaji)}</span></article>`).join('');showResult({shell,title:'Test Kotoba',score,correct,wrong,unanswered,duration,reviewHTML,tierFor,name,siteName,logo,playSound,startedAt:new Date(started).toISOString(),limit:0,limitBy:'admin'});};
    window.__finishKotoba=finish;
    const render=async()=>{const q=rows[index];if(!q)return finish(false);const forward=setup.mode==='jp_id';const pool=data.filter(x=>x.id!==q.id&&setup.lessons.includes(x.lesson)).sort(()=>Math.random()-.5).slice(0,14);try{await translateItems([q,...pool]);}catch{}const good=pool.filter(x=>x.meaning_id);const correct=forward?meaningText(q):(q.romaji||q.kana);const opts=[correct,...good.slice(0,3).map(x=>forward?meaningText(x):(x.romaji||x.kana))].filter(Boolean);const unique=[...new Set(opts)].sort(()=>Math.random()-.5);shell(`<section class="section vocab-test-page"><div class="section-title"><div><div class="eyebrow">🎯 TEST KOTOBA · ${index+1}/${rows.length}</div><h2>${forward?'Jepang → Indonesia':'Indonesia → Jepang'}</h2></div><div id="kotobaTestTimer" class="timer-text"></div></div><div class="hira-progress"><i style="width:${((index+1)/rows.length)*100}%"></i></div><div class="vocab-test-question fx-float fx-ring"><span class="vocab-tag">BAB ${q.lesson}</span><div class="vocab-test-prompt">${vesc(forward?(q.kanji||q.kana):meaningText(q))}</div>${forward?`<div class="vocab-kana">${vesc(q.kana||'')}</div>`:''}</div><div class="vocab-options">${unique.map((o,i)=>`<button type="button" class="btn vocab-option ${vnorm(answers[index])===vnorm(o)?'selected':''}" data-vanswer="${vesc(o)}"><b class="choice-letter">${String.fromCharCode(65+i)}.</b> ${vesc(o)}</button>`).join('')}</div><div class="exercise-nav"><button type="button" class="btn" id="vprev" ${index===0?'disabled':''}>← Sebelumnya</button><button type="button" class="btn red" id="vnext">${index===rows.length-1?'Selesai':'Selanjutnya →'}</button></div></section>`);startKotobaTimer();document.querySelectorAll('[data-vanswer]').forEach(b=>b.onclick=()=>{answers[index]=b.dataset.vanswer;document.querySelectorAll('[data-vanswer]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');});document.querySelector('#vprev').onclick=()=>{if(index>0){index--;render();}};document.querySelector('#vnext').onclick=()=>{if(index<rows.length-1){index++;render();}else finish(false);};};
    await render();
  }catch(e){stopKotobaTimer();window.__finishKotoba=null;shell(`<section class="section"><div class="card"><h2>Test Kotoba tidak bisa dimulai</h2><p class="muted">${vesc(e.message||'Data belum tersedia.')}</p><a class="btn" href="#kosakata">Kembali ke Kosakata</a></div></section>`);}
}

// ===== Kosakata berbentuk Part: Part 1 = Minna no Nihongo (bawaan), Part 2+ diatur Admin =====
async function fetchVocabParts(supabase,sbReady){
  const out={settings:{title:'Kosakata',description:'Pilih Part, lalu pelajari kosakata atau uji dirimu.'},parts:[]};
  if(!sbReady||!supabase)return out.parts=[minnaDefault()],out;
  try{const {data}=await supabase.from('vocab_settings').select('*').eq('id',1).maybeSingle();if(data){if(data.title)out.settings.title=data.title;if(data.description!=null)out.settings.description=data.description;}}catch{}
  let rows=[];try{const r=await supabase.from('vocab_parts').select('*').order('part_number');rows=r.data||[];}catch{}
  const hasMinna=rows.some(p=>p.kind==='minna');
  out.parts=rows.filter(p=>p.active!==false);
  if(!hasMinna)out.parts.unshift(minnaDefault());
  out.parts.sort((a,b)=>(a.part_number||0)-(b.part_number||0));
  return out;
}
function minnaDefault(){return {id:null,part_number:1,name:'Minna no Nihongo I · Bab 1–25',description:'Kosakata sesuai buku Minna no Nihongo I. Pelajari per bab atau langsung Test.',kind:'minna',active:true};}
function customWordCard(x,p){return `<article class="vocab-word-card fx-card fx-ring"><div class="vocab-card-top"><span class="vocab-tag">PART ${vesc(p.part_number)}</span><span class="vocab-type">${vesc(toRomaji(x.kana||''))}</span></div><div class="vocab-jp">${vesc(x.kanji||x.kana)}</div>${x.kanji&&x.kana?`<div class="vocab-kana">${vesc(x.kana)}</div>`:''}<div class="vocab-meaning">${vesc(x.arti||'')}</div></article>`;}
export async function kosakata({state,shell,esc=vesc,norm=vnorm,supabase,sbReady}){
  const cfg=await fetchVocabParts(supabase,sbReady);
  const counts={};
  await Promise.all(cfg.parts.filter(p=>p.kind!=='minna'&&p.id).map(async p=>{try{const {count}=await supabase.from('vocab_part_words').select('id',{count:'exact',head:true}).eq('part_id',p.id);counts[p.id]=count||0;}catch{counts[p.id]=0;}}));
  const nn=p=>String(p.part_number).padStart(2,'0');
  const showParts=()=>{
    shell(`<section class="section vocab-page"><div class="section-title"><div><div class="eyebrow">📖 KOSAKATA</div><h2>${vesc(cfg.settings.title)}</h2><p class="muted">${vesc(cfg.settings.description)}</p></div></div>${cfg.parts.length?`<div class="part-list">${cfg.parts.map((p,i)=>`<div class="part-card fx-card fx-ring" data-vpart="${i}" role="button" tabindex="0"><span class="tag">PART ${nn(p)}</span><h3>${vesc(p.name)}</h3><p class="part-desc">${vesc(p.description||'')}</p><b>${p.kind==='minna'?'Bab 1–25':`${counts[p.id]||0} kata`}</b></div>`).join('')}</div>`:'<div class="empty"><h3>Belum ada Part kosakata</h3></div>'}</section>`);
    runFx();
    document.querySelectorAll('[data-vpart]').forEach(c=>{const go=()=>openPart(cfg.parts[Number(c.dataset.vpart)]);c.onclick=go;c.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};});
    window.scrollTo({top:0});
  };
  const showCustom=async p=>{
    shell(`<section class="section vocab-page"><button type="button" class="btn" id="backParts" style="margin-bottom:14px">← Pilih Part</button><div class="section-title"><div><div class="eyebrow">📖 KOSAKATA · PART ${nn(p)}</div><h2>${vesc(p.name)}</h2><p class="muted">${vesc(p.description||'')}</p></div></div><div id="vocabMount"><div class="card vocab-loading">Memuat kosakata…</div></div></section>`);
    document.querySelector('#backParts').onclick=()=>showParts();
    window.scrollTo({top:0});
    let rows=[];
    try{const r=await supabase.from('vocab_part_words').select('*').eq('part_id',p.id).order('sort',{ascending:true}).order('created_at',{ascending:true});if(r.error)throw r.error;rows=r.data||[];}
    catch(e){const m=document.querySelector('#vocabMount');if(m)m.innerHTML=`<div class="card vocab-loading"><b>Gagal memuat kosakata.</b><p class="muted">${vesc(e.message||'Coba buka kembali halaman ini.')}</p></div>`;return;}
    const mount=document.querySelector('#vocabMount');if(!mount)return;
    mount.innerHTML=`<input id="vcSearch" class="input search" placeholder="Cari kata, cara baca, atau arti…" style="margin:0 0 16px"><p class="muted" id="vcCount" style="margin:0 0 12px">${rows.length} kata tersedia.</p><div class="vocab-grid" id="vcGrid">${rows.map(x=>customWordCard(x,p)).join('')||'<div class="empty">Belum ada kosakata di Part ini.</div>'}</div>`;
    runFx();
    document.querySelector('#vcSearch').oninput=e=>{const s=norm(e.target.value);const f=rows.filter(x=>norm(`${x.kanji||''} ${x.kana||''} ${x.arti||''}`).includes(s));document.querySelector('#vcGrid').innerHTML=f.map(x=>customWordCard(x,p)).join('')||'<div class="empty">Tidak ada yang cocok.</div>';document.querySelector('#vcCount').textContent=`${f.length} kata ditampilkan.`;runFx();};
  };
  const openPart=p=>{if(!p)return;if(p.kind==='minna')return kosakataMinna({state,shell,esc,norm,ctx:{title:p.name,partNo:p.part_number,onBack:showParts}});return showCustom(p);};
  showParts();
}

export function openKotobaSetup(initial=[1]){loadVocab().then(()=>selectionModal(initial));}
