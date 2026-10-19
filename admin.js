import { supabase, sbReady, requireSupabase } from './supabase.js';
import { CONFIG } from './config.js';
import { defaultBunpou } from './default-bunpou.js';
import { BOOK } from './vocab-book.js';
import { readPdfPages, parsePdfQuestions, parseKeyText } from './pdfsoal.js';
import { PRESETS, DEFAULT_STYLE, cleanStyle, applyCardStyle, saveCardStyle, fetchCardStyle, loadCachedStyle, runFx } from './cardstyle.js';
import { NEW_DESC, NEW_DEV, OLD_DESC, OLD_DEV } from './copy.js';
const root=document.querySelector('#admin-app');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const parse=v=>{try{return JSON.parse(v)}catch{return v}};
const sanitizePromptHTML=html=>{
  const t=document.createElement('template'); t.innerHTML=String(html||'');
  const walk=n=>{
    [...n.childNodes].forEach(ch=>{
      if(ch.nodeType===1){
        const tag=ch.tagName.toLowerCase();
        if(['div','p','li','h1','h2','h3','h4','h5','h6'].includes(tag)){
          const parent=ch.parentNode;
          while(ch.firstChild) parent.insertBefore(ch.firstChild,ch);
          parent.insertBefore(document.createElement('br'),ch);
          parent.removeChild(ch); return;
        }
        if(!['u','br'].includes(tag)){
          const parent=ch.parentNode;
          while(ch.firstChild) parent.insertBefore(ch.firstChild,ch);
          parent.removeChild(ch); return;
        }
        [...ch.attributes].forEach(a=>ch.removeAttribute(a.name));
        walk(ch);
      } else if(ch.nodeType!==3) ch.remove();
    });
  };
  walk(t.content); return t.innerHTML;
};
function bindPromptToolbar(editor){
  if(!editor)return;
  const toolbar=document.createElement('div');
  toolbar.className='prompt-selection-toolbar';
  toolbar.innerHTML='<button type="button" data-cmd="underline" aria-label="Garis bawah"><u>U</u> Garis bawah</button><button type="button" data-cmd="remove" aria-label="Hapus garis bawah">✖ Hapus</button>';
  document.body.appendChild(toolbar);
  let savedRange=null;
  const hide=()=>{toolbar.classList.remove('show');};
  const show=()=>{
    if(!document.body.contains(editor)){toolbar.remove();return;}
    const sel=window.getSelection();
    if(!sel || sel.rangeCount===0 || sel.isCollapsed || !editor.contains(sel.anchorNode) || !editor.contains(sel.focusNode)){hide();return;}
    savedRange=sel.getRangeAt(0).cloneRange();
    const r=sel.getRangeAt(0).getBoundingClientRect();
    toolbar.style.left=Math.max(8,Math.min(window.innerWidth-toolbar.offsetWidth-8,r.left+r.width/2-toolbar.offsetWidth/2))+'px';
    let top=r.bottom+8;
    if(top+toolbar.offsetHeight>window.innerHeight-8) top=Math.max(8,r.top-toolbar.offsetHeight-8);
    toolbar.style.top=top+'px'; toolbar.classList.add('show');
  };
  editor.addEventListener('paste',e=>{
    e.preventDefault();
    const text=(e.clipboardData||window.clipboardData)?.getData('text/plain')||'';
    const html=esc(text).replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/\n/g,'<br>');
    document.execCommand('insertHTML',false,html);
    editor.innerHTML=sanitizePromptHTML(editor.innerHTML);
    setTimeout(show,20);
  });
  editor.addEventListener('blur',()=>{ const c=sanitizePromptHTML(editor.innerHTML); if(c!==editor.innerHTML) editor.innerHTML=c; });
  editor.addEventListener('mouseup',()=>setTimeout(show,20));
  editor.addEventListener('touchend',()=>setTimeout(show,60));
  editor.addEventListener('keyup',show);
  document.addEventListener('selectionchange',()=>{ if(document.activeElement===editor) setTimeout(show,0);});
  toolbar.addEventListener('mousedown',e=>e.preventDefault());
  toolbar.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b||!savedRange)return;
    editor.focus(); const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange);
    if(b.dataset.cmd==='underline') document.execCommand('underline',false,null);
    else {
      document.execCommand('removeFormat',false,null);
      document.execCommand('unlink',false,null);
    }
    editor.innerHTML=sanitizePromptHTML(editor.innerHTML);
    hide();
  });
  editor.addEventListener('blur',()=>setTimeout(()=>{if(!toolbar.matches(':hover'))hide();},200));
}

const typeMap={ganda:'multiple_choice',multiple_choice:'multiple_choice',ketik:'typing',typing:'typing'};
let role='owner'; const OWNER_ONLY=['branding','tampilan','nilai','admins'];
let current='dashboard', user=null, imported=[]; let userRefreshTimer=null; let selectedUserId=null;
// ===== Update database (sekali saja) =====
const DB_SQL=`alter table public.parts add column if not exists setup_mode text not null default 'admin';
alter table public.parts add column if not exists timer_seconds integer;
alter table public.parts add column if not exists scheduled_start_at timestamptz;
alter table public.parts add column if not exists scheduled_end_at timestamptz;
alter table public.kanji add column if not exists animate boolean not null default true;
alter table public.kanji add column if not exists part_number integer not null default 1;
alter table public.branding add column if not exists message_enabled boolean not null default false;
alter table public.branding add column if not exists message_title text;
alter table public.branding add column if not exists message_body text;
alter table public.branding add column if not exists maintenance_enabled boolean not null default false;
alter table public.branding add column if not exists maintenance_title text;
alter table public.branding add column if not exists maintenance_body text;
notify pgrst, 'reload schema';`;
const DB_NOTE='Database belum diupdate, jadi pengaturan baru belum bisa disimpan. Buka menu Dashboard, salin SQL yang tampil, lalu jalankan di Supabase → SQL Editor.';
const PART_OPT=['setup_mode','timer_seconds','scheduled_start_at','scheduled_end_at','inactive_mode'], KANJI_OPT=['animate','part_number'];
async function dbStatus(){const [a,b]=await Promise.all([supabase.from('parts').select('setup_mode,timer_seconds,scheduled_start_at,scheduled_end_at').limit(1),supabase.from('kanji').select('animate').limit(1)]);return !a.error&&!b.error;}
function dbNoticeHTML(){return `<div class="card admin-card db-notice"><h2>⚠ Update database diperlukan</h2><p class="muted">Fitur baru (pengaturan soal &amp; timer, jadwal aktif/nonaktif Part, dan animasi Kanji) butuh kolom database tambahan. Salin SQL di bawah, buka Supabase → SQL Editor, tempel, lalu klik Run. Cukup dilakukan sekali.</p><pre id="dbSql">${esc(DB_SQL)}</pre><button id="copySql" class="btn" type="button">Salin SQL</button></div>`;}
async function copySql(){try{await navigator.clipboard.writeText(DB_SQL);alert('SQL tersalin. Tempel di Supabase → SQL Editor, lalu Run.');}catch{alert('Salin manual SQL yang tampil di layar.');}}
// Simpan; kalau kolom baru belum ada di database, simpan bagian lainnya saja dan beri tahu.
async function saveOptional(run,row,optKeys){
  let r=await run(row);
  if(r.error&&optKeys.some(k=>String(r.error.message||'').includes(k))){
    const strip=x=>{if(Array.isArray(x))return x.map(strip);const c={...x};optKeys.forEach(k=>delete c[k]);return c;};
    const slim=strip(row);
    if(!Array.isArray(slim)&&!Object.keys(slim).length)return {error:{message:DB_NOTE}};
    r=await run(slim);
    if(!r.error){r.degraded=true;alert('Data tersimpan, tetapi pengaturan baru belum ikut tersimpan. '+DB_NOTE);}
  }
  return r;
}
const fmtDur=n=>{n=Math.floor(Number(n)||0);const m=Math.floor(n/60),r=n%60;return [m?`${m} menit`:'',r?`${r} detik`:''].filter(Boolean).join(' ')||'0 detik';};
// ===== Pengaturan Part: soal & timer diatur Admin atau User =====
function partSetupHTML(x={}){
  const user=x.setup_mode==='user',t=Number(x.timer_seconds||0);
  return `<div class="part-setup" data-part-setup><label>Soal &amp; timer diatur oleh siapa?<select class="input" name="setup_mode"><option value="admin" ${user?'':'selected'}>Diatur Admin</option><option value="user" ${user?'selected':''}>Diatur User</option></select></label>
  <p class="hint" data-hint-admin>Admin menentukan jumlah soal dan timer. User cukup mengisi nama lalu mengerjakan.</p>
  <p class="hint" data-hint-user hidden>Setiap mau mengerjakan, user mengisi sendiri nama, jumlah soal, dan waktunya. Tidak ada batas minimum.</p>
  <div data-admin-opts class="form-grid"><label class="full">Jumlah soal<input class="input" name="question_limit" type="number" min="1" value="${x.question_limit||''}" placeholder="Kosongkan = semua soal"></label><label>Timer (menit)<input class="input" name="timer_min" type="number" min="0" value="${t?Math.floor(t/60):''}" placeholder="0"></label><label>Timer (detik)<input class="input" name="timer_sec" type="number" min="0" value="${t?t%60:''}" placeholder="0"></label><p class="hint full">Kosongkan timer jika tidak ingin memakai batas waktu.</p></div></div>`;
}
function bindPartSetup(root){
  const sel=root.querySelector('[name="setup_mode"]');
  const sync=()=>{const u=sel.value==='user';root.querySelector('[data-admin-opts]').hidden=u;root.querySelector('[data-hint-admin]').hidden=u;root.querySelector('[data-hint-user]').hidden=!u;};
  sel.onchange=sync;sync();
}
function readPartSetup(root){
  const g=n=>root.querySelector(`[name="${n}"]`);
  if(g('setup_mode').value==='user')return {setup_mode:'user',question_limit:null,timer_seconds:null};
  const lim=Math.floor(Number(g('question_limit').value)),m=Number(g('timer_min').value||0),sc=Number(g('timer_sec').value||0);
  const total=Math.round((m>0?m:0)*60+(sc>0?sc:0));
  return {setup_mode:'admin',question_limit:lim>0?lim:null,timer_seconds:total>0?total:null};
}
function partModeBadge(x){
  if(x.setup_mode==='user')return '<i class="mode-pill user">Diatur User</i>';
  const bits=[x.question_limit?`${x.question_limit} soal`:'semua soal'];if(Number(x.timer_seconds)>0)bits.push(fmtDur(x.timer_seconds));
  return `<i class="mode-pill">Diatur Admin · ${esc(bits.join(' · '))}</i>`;
}

function menuFor(){const all=[['dashboard','Dashboard'],['branding','Branding'],['tampilan','Tampilan Kolom'],['kanji','Kanji'],['kaiwa','Kaiwa & Bunpou'],['vocab','Kosakata'],['parts','Part'],['questions','Soal'],['quick','Quick Soal'],['timer','Kelola Timer'],['custom','Mode Custom'],['nilai','Pengaturan Nilai'],['users','User'],['admins','Tambah Admin'],['messages','Pesan & Maintenance'],['guide','Cara Penggunaan Admin']];return all.filter(([k])=>role==='owner'||!OWNER_ONLY.includes(k));}
function app(html){
  if(userRefreshTimer){clearInterval(userRefreshTimer);userRefreshTimer=null;}
  root.innerHTML=`<div class="admin-shell"><aside class="admin-side"><div class="admin-brand"><span>⛩</span><div><b>ITCO JAPAN</b><small>ADMIN PANEL · ${role==='owner'?'ADMIN UTAMA':'SENSEI'}</small></div></div><nav>${menuFor().map(([k,t])=>`<button class="side-link ${current===k?'active':''}" data-menu="${k}">${t}</button>`).join('')}</nav><button id="logout" class="logout">Keluar</button></aside><main class="admin-main">${html}</main></div>`;
  document.querySelectorAll('[data-menu]').forEach(b=>b.onclick=()=>{current=b.dataset.menu;render()});
  document.querySelector('#logout').onclick=async()=>{await supabase.auth.signOut();render()};
}
// Hanya akun yang terdaftar di tabel `admins` yang boleh masuk (user biasa punya akun juga, tetapi bukan Admin).
async function checkAdmin(){const {data,error}=await supabase.rpc('is_admin');if(error)return {ok:false,msg:'Fungsi keamanan is_admin belum ada di database. Jalankan file supabase-accounts.sql di Supabase SQL Editor.'};if(data!==true)return {ok:false,msg:'Akun ini bukan Admin.'};const rr=await supabase.rpc('admin_role');role=rr.error?'owner':(rr.data||'sensei');return {ok:true};}
async function boot(){if(!sbReady)return login('Supabase belum dikonfigurasi.');const {data}=await supabase.auth.getSession();user=data.session?.user||null;if(!user)return login();const a=await checkAdmin();if(!a.ok){user=null;return login(a.msg);}render();}
function login(msg=''){root.innerHTML=`<div class="login-wrap"><div class="login-card"><div class="admin-logo">⛩</div><div class="eyebrow">ITCO JAPAN</div><h1>Admin Panel</h1><p class="muted">Masuk menggunakan akun Admin Supabase.</p>${msg?`<div class="alert">${esc(msg)}</div>`:''}<input id="email" class="input" type="email" placeholder="Email"><input id="password" class="input" type="password" placeholder="Password"><button id="login" class="btn red fullbtn">Masuk</button></div></div>`;document.querySelector('#login').onclick=async()=>{const {error}=await supabase.auth.signInWithPassword({email:document.querySelector('#email').value.trim().toLowerCase(),password:document.querySelector('#password').value});if(error)return login(/invalid login credentials/i.test(error.message)?'Email atau password salah. Pakai email dan password akun yang kamu daftarkan di website (bukan akun admin lama). Pastikan tidak ada spasi di belakang email.':/email not confirmed/i.test(error.message)?'Email belum dikonfirmasi. Buka inbox emailmu dan klik link verifikasi, lalu masuk lagi.':error.message);user=(await supabase.auth.getUser()).data.user;const a=await checkAdmin();if(!a.ok){await supabase.auth.signOut();user=null;return login(a.msg);}render();};}
const vx=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function kosakata(){
  const lesson=Number(sessionStorage.getItem('vocabLesson')||1);
  const {data:ed,error}=await supabase.from('vocab_edits').select('*').eq('lesson',lesson);
  const warn=error?`<div class="card admin-card"><b>Tabel belum dibuat.</b> Jalankan file <code>supabase-kosakata.sql</code> di Supabase → SQL Editor, lalu muat ulang halaman ini.</div>`:'';
  const edits=ed||[];const byNo=new Map(edits.filter(x=>x.number!=null).map(x=>[x.number,x]));
  const rows=(BOOK[lesson]||[]).map((str,i)=>{const p=str.split('|'),hk=p.length>=3,n=i+1,e=byNo.get(n);const b={kanji:hk?p[0]:'',kana:hk?p[1]:p[0],arti:p[p.length-1]};return {n,kanji:e?.kanji??b.kanji,kana:e?.kana??b.kana,arti:e?.arti??b.arti,hidden:!!e?.hidden,eid:e?.id||'',isNew:false};});
  edits.filter(x=>x.number==null).forEach(e=>rows.push({n:'',kanji:e.kanji||'',kana:e.kana||'',arti:e.arti||'',hidden:!!e.hidden,eid:e.id,isNew:true}));
  const opts=Array.from({length:25},(_,i)=>`<option value="${i+1}" ${i+1===lesson?'selected':''}>Bab ${i+1}</option>`).join('');
  const list=rows.map((r,i)=>`<div class="card admin-card" style="${r.hidden?'opacity:.5':''}"><div><b>${vx(r.kanji||r.kana)}</b> ${r.kanji?`<small>${vx(r.kana)}</small>`:''}${r.isNew?' <small>(tambahan)</small>':''}${r.hidden?' <small>(disembunyikan)</small>':''}</div><div class="muted">${vx(r.arti)}</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn" data-vedit="${i}">Ubah</button><button class="btn" data-vhide="${i}">${r.hidden?'Tampilkan':'Sembunyikan'}</button>${r.eid?`<button class="btn" data-vreset="${i}">${r.isNew?'Hapus':'Kembalikan ke buku'}</button>`:''}</div></div>`).join('');
  app(`<div class="admin-header"><div><div class="eyebrow">KOSAKATA</div><h1>Kelola Kosakata</h1></div></div>${warn}
  <div class="card admin-card"><label>Pilih Bab<select class="input" id="vLesson">${opts}</select></label></div>
  <form id="vForm" class="card admin-card form-grid"><b id="vTitle">Tambah kata baru</b><input type="hidden" name="n"><input type="hidden" name="eid">
  <label>Kanji (boleh kosong)<input class="input" name="kanji"></label><label>Hiragana/Katakana<input class="input" name="kana" required></label><label>Arti Bahasa Indonesia<textarea class="input" name="arti" rows="3" required></textarea></label>
  <div style="display:flex;gap:8px"><button class="btn primary" type="submit">Simpan</button><button class="btn" type="button" id="vCancel">Batal</button></div></form>${list}`);
  const form=document.querySelector('#vForm');
  const reset=()=>{form.reset();form.n.value='';form.eid.value='';document.querySelector('#vTitle').textContent='Tambah kata baru';};
  document.querySelector('#vLesson').onchange=e=>{sessionStorage.setItem('vocabLesson',e.target.value);kosakata();};
  document.querySelector('#vCancel').onclick=reset;
  form.onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(form));const row={lesson,number:o.n===''?null:Number(o.n),kanji:o.kanji.trim(),kana:o.kana.trim(),arti:o.arti.trim(),hidden:false};
    const {error:er}=o.eid?await supabase.from('vocab_edits').update(row).eq('id',o.eid):await supabase.from('vocab_edits').insert(row);if(er)return alert(er.message);kosakata();};
  document.querySelectorAll('[data-vedit]').forEach(b=>b.onclick=()=>{const r=rows[+b.dataset.vedit];form.n.value=r.n;form.eid.value=r.eid;form.kanji.value=r.kanji;form.kana.value=r.kana;form.arti.value=r.arti;document.querySelector('#vTitle').textContent='Ubah kata';form.scrollIntoView({behavior:'smooth'});});
  document.querySelectorAll('[data-vhide]').forEach(b=>b.onclick=async()=>{const r=rows[+b.dataset.vhide];const row={lesson,number:r.n===''?null:Number(r.n),kanji:r.kanji,kana:r.kana,arti:r.arti,hidden:!r.hidden};
    const {error:er}=r.eid?await supabase.from('vocab_edits').update({hidden:!r.hidden}).eq('id',r.eid):await supabase.from('vocab_edits').insert(row);if(er)return alert(er.message);kosakata();});
  document.querySelectorAll('[data-vreset]').forEach(b=>b.onclick=async()=>{const r=rows[+b.dataset.vreset];if(!confirm(r.isNew?'Hapus kata tambahan ini?':'Kembalikan kata ini ke versi buku?'))return;const {error:er}=await supabase.from('vocab_edits').delete().eq('id',r.eid);if(er)return alert(er.message);kosakata();});
}
async function render(){if(role!=='owner'&&OWNER_ONLY.includes(current))current='dashboard';if(current==='admins')return adminsPage();if(current==='custom')return customPage();if(current==='dashboard')return dashboard();if(current==='nilai')return nilai();if(current==='branding')return branding();if(current==='tampilan')return tampilan();if(current==='kanji')return kanji();if(current==='kaiwa')return kaiwa();if(current==='vocab')return kosakata();if(current==='parts')return parts();if(current==='questions')return questions();if(current==='quick')return quick();if(current==='timer')return timer();if(current==='users')return users();if(current==='messages')return messages();if(current==='guide')return guide();}

async function tampilan(){
  let st=cleanStyle(await fetchCardStyle()||loadCachedStyle()||DEFAULT_STYLE);
  const tile=(id,name,inner,sw)=>`<button type="button" class="wp-tile ${st.preset===id?'sel':''}" data-wp="${id}"><span class="wp-swatch" style="${sw}">${inner}</span><b>${esc(name)}</b></button>`;
  app(`<div class="admin-header"><div><div class="eyebrow">TAMPILAN</div><h1>Tampilan Kolom</h1><p class="muted">Atur wallpaper semua kolom (kartu) di website: pilih dari saran di bawah atau pakai fotomu sendiri. Perubahan langsung terlihat di pratinjau.</p></div></div>
  <div class="card admin-card"><h3>1. Pilih wallpaper</h3><div class="wp-grid">${PRESETS.map(p=>tile(p.id,p.name,'',`background:${esc(p.css)}`)).join('')}${tile('foto','Foto Sendiri','📷',st.preset==='foto'&&st.url?`background:url(&quot;${esc(st.url)}&quot;) center/cover no-repeat`:'')}</div></div>
  <div class="card admin-card upload-box"><label>2. Upload foto wallpaper sendiri</label><p class="muted">Pilih foto dari galeri HP. Foto otomatis dikecilkan agar website tetap ringan, lalu langsung dipakai dan tersimpan.</p><div class="upload-row"><input id="cwFile" class="input" type="file" accept="image/png,image/jpeg,image/webp"><button id="cwUpload" class="btn" type="button">📁 Upload Foto</button></div><div id="cwStatus" class="upload-status">${st.preset==='foto'&&st.url?'Foto sendiri sedang dipakai.':'Belum ada foto sendiri.'}</div></div>
  <div class="card admin-card"><h3>3. Atur tampilan</h3><div class="wp-range"><span>Terang</span><input id="cwDim" type="range" min="0" max="85" step="5" value="${Math.round(st.dim*100)}"><span>Gelap</span><b id="cwDimVal">${Math.round(st.dim*100)}%</b></div><p class="muted">Makin gelap, tulisan di kolom makin mudah dibaca. Untuk foto sendiri, 50–65% biasanya pas.</p><div class="wp-checks"><label><input type="checkbox" id="cwGlow" ${st.glow?'checked':''}> Cahaya merah &amp; biru di tepi kolom</label><label><input type="checkbox" id="cwSway" ${st.sway?'checked':''}> Kolom bergerak / goyang seirama</label></div></div>
  <div class="card admin-card"><h3>Pratinjau</h3><div class="wp-preview"><a class="card feature fx-card fx-ring" href="javascript:void(0)"><div class="icon">あ</div><h3>Kana</h3><p>Seperti inilah tampilan kolom di website.</p></a></div></div>
  <button id="cwSave" class="btn red fullbtn" type="button">Simpan Tampilan Kolom</button>`);
  const $=i=>document.querySelector(i);
  document.documentElement.classList.add('admin-preview');
  const refresh=()=>{st=applyCardStyle(st);document.querySelectorAll('.wp-tile').forEach(t=>t.classList.toggle('sel',t.dataset.wp===st.preset));};
  refresh();
  const prev=document.querySelector('.wp-preview .feature');if(prev)prev.style.cssText='background:linear-gradient(rgba(5,6,10,var(--cw-dim)),rgba(5,6,10,var(--cw-dim))),var(--cw-bg)';
  runFx();
  document.querySelectorAll('.wp-tile').forEach(t=>t.onclick=()=>{
    const id=t.dataset.wp;
    if(id==='foto'&&!st.url){alert('Upload foto dulu di langkah 2.');return;}
    st={...st,preset:id};
    if(id==='foto'&&st.dim<.5)st.dim=.55; $('#cwDim').value=Math.round(st.dim*100);$('#cwDimVal').textContent=Math.round(st.dim*100)+'%';
    refresh();
  });
  $('#cwDim').oninput=e=>{st={...st,dim:Number(e.target.value)/100};$('#cwDimVal').textContent=e.target.value+'%';refresh();};
  $('#cwGlow').onchange=e=>{st={...st,glow:e.target.checked};refresh();};
  $('#cwSway').onchange=e=>{st={...st,sway:e.target.checked};refresh();};
  const shrink=async file=>{
    try{
      const bmp=await createImageBitmap(file);const k=Math.min(1,1280/Math.max(bmp.width,bmp.height));
      const c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);
      c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.82));
      return blob&&blob.size>0?{blob,ext:'jpg',type:'image/jpeg'}:null;
    }catch{return null;}
  };
  $('#cwUpload').onclick=async()=>{
    const file=$('#cwFile').files?.[0],status=$('#cwStatus'),btn=$('#cwUpload');
    if(!file)return alert('Pilih foto dari galeri terlebih dahulu.');
    if(!file.type.startsWith('image/'))return alert('File harus berupa gambar.');
    if(file.size>15*1024*1024)return alert('Ukuran foto maksimal 15 MB.');
    btn.disabled=true;status.textContent='Memproses dan mengupload foto...';
    try{
      const small=await shrink(file);
      const body=small?small.blob:file,type=small?small.type:file.type;
      const ext=small?small.ext:((file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg');
      const path=`branding/card-wallpaper-${Date.now()}.${ext}`;
      const {error}=await supabase.storage.from('media').upload(path,body,{upsert:true,contentType:type,cacheControl:'31536000'});
      if(error)throw error;
      const {data:pub}=supabase.storage.from('media').getPublicUrl(path);
      st={...st,preset:'foto',url:pub.publicUrl,dim:Math.max(st.dim,.55)};
      $('#cwDim').value=Math.round(st.dim*100);$('#cwDimVal').textContent=Math.round(st.dim*100)+'%';
      refresh();
      const sw=document.querySelector('[data-wp="foto"] .wp-swatch');if(sw){sw.style.background=`url("${pub.publicUrl}") center/cover no-repeat`;sw.textContent='';}
      await saveCardStyle(st);
      status.textContent='Foto berhasil di-upload dan sudah dipakai di website.';
    }catch(err){status.textContent='Upload gagal.';alert('Upload foto gagal: '+(err.message||err));}
    finally{btn.disabled=false;$('#cwFile').value='';}
  };
  $('#cwSave').onclick=async()=>{
    try{await saveCardStyle(st);alert('Tampilan kolom tersimpan. Buka ulang website untuk melihatnya.');}
    catch(err){alert('Gagal menyimpan: '+(err.message||err));}
  };
}

async function count(table){const {count,error}=await supabase.from(table).select('*',{count:'exact',head:true});return error?0:count||0;}
async function dashboard(){const [k,b,p,q,r]=await Promise.all(['kanji','bunpou','parts','questions','user_profiles'].map(count));const dbOk=await dbStatus();app(`<div class="admin-header"><div><div class="eyebrow">CONTROL CENTER</div><h1>Dashboard</h1><p class="muted">Kelola seluruh materi, latihan, dan pemantauan user ITCO JAPAN.</p></div></div>${dbOk?'':dbNoticeHTML()}<div class="stat-grid"><div class="stat-card"><b>${k}</b><span>Kanji</span></div><div class="stat-card"><b>${b}</b><span>Bunpou</span></div><div class="stat-card"><b>${p}</b><span>Part</span></div><div class="stat-card"><b>${q}</b><span>Soal</span></div><div class="stat-card"><b>${r}</b><span>User</span></div></div><div class="card admin-card"><h2>Alur cepat</h2><p>Isi Branding → tambah Kanji → buat Part → masukkan soal lewat Soal atau Quick Soal → atur Timer → pantau User.</p><p class="muted">Untuk fitur User Monitoring, jalankan <b>supabase-user-monitor.sql</b> satu kali di Supabase setelah <b>supabase-accounts.sql</b>.</p></div>`);const cb=document.querySelector('#copySql');if(cb)cb.onclick=copySql;}
async function branding(){let {data}=await supabase.from('branding').select('*').eq('id',1).maybeSingle();data=data||{};app(`<div class="admin-header"><div><div class="eyebrow">SITE IDENTITY</div><h1>Branding</h1></div></div><form id="brandForm" class="card admin-card form-grid"><label>Nama utama<input class="input" name="site_name" value="${esc(data.site_name||CONFIG.siteName)}"></label><label>Nama alternatif<input class="input" name="corporate_name" value="${esc(data.corporate_name||CONFIG.corporateName)}"></label><label>Creator header<input class="input" name="creator" value="${esc(data.creator||CONFIG.creator)}"></label><label>Nama Developer<input class="input" name="creator_name" value="${esc(data.creator_name||'Witama Yuliananta')}"></label><label class="full">Deskripsi website<textarea class="textarea" name="description">${esc((!data.description||data.description.trim()===OLD_DESC)?NEW_DESC:data.description)}</textarea></label><label class="full">Deskripsi Developer<textarea class="textarea" name="developer_description">${esc((!data.developer_description||data.developer_description.trim()===OLD_DEV)?NEW_DEV:data.developer_description)}</textarea></label><div class="full upload-box"><label>Logo Developer</label><p class="muted">Pilih langsung dari File Manager HP. Logo akan di-upload ke Supabase Storage dan otomatis dipakai di halaman Developer.</p><div class="upload-row"><input id="developerLogoFile" class="input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"><button id="uploadDeveloperLogo" class="btn" type="button">📁 Upload Logo</button></div><input type="hidden" name="developer_logo_url" id="developerLogoUrl" value="${esc(data.developer_logo_url||'')}"><div id="developerLogoStatus" class="upload-status">${data.developer_logo_url?`Logo tersimpan.`:'Belum ada logo Developer.'}</div>${data.developer_logo_url?`<img class="upload-preview" src="${esc(data.developer_logo_url)}" alt="Logo Developer">`:''}</div><div class="full upload-box"><label>Logo Header</label><p class="muted">Pilih logo langsung dari File Manager HP. Setelah upload, URL logo otomatis tersimpan.</p><div class="upload-row"><input id="headerLogoFile" class="input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"><button id="uploadHeaderLogo" class="btn" type="button">📁 Upload Logo Header</button></div><input type="hidden" name="logo_url" id="headerLogoUrl" value="${esc(data.logo_url||'')}"><div id="headerLogoStatus" class="upload-status">${data.logo_url?'Logo header tersimpan.':'Belum ada logo header.'}</div>${data.logo_url?`<img class="upload-preview" src="${esc(data.logo_url)}" alt="Logo Header">`:''}</div><div class="full contact-box"><h3>Aplikasi (saat di-install)</h3><p class="muted">Nama dan ikon yang muncul di layar utama HP ketika website di-install sebagai aplikasi. Kosongkan nama untuk memakai Nama utama.</p><label>Nama aplikasi<input class="input" name="app_name" value="${esc(data.app_name||'')}" placeholder="${esc(data.site_name||CONFIG.siteName)}"></label><label>Nama pendek (di bawah ikon, maks ±12 huruf)<input class="input" name="app_short_name" maxlength="20" value="${esc(data.app_short_name||'')}" placeholder="${esc((data.app_name||data.site_name||CONFIG.siteName).slice(0,12))}"></label><div class="upload-box" style="margin-top:12px"><label>Ikon aplikasi</label><div class="upload-row"><input id="appIconFile" class="input" type="file" accept="image/png,image/jpeg,image/webp"><button id="uploadAppIcon" class="btn" type="button">📁 Upload Ikon</button></div><input type="hidden" name="app_icon_url" id="appIconUrl" value="${esc(data.app_icon_url||'')}"><div id="appIconStatus" class="upload-status">${data.app_icon_url?'Ikon aplikasi tersimpan.':'Belum ada ikon (memakai bawaan).'}</div>${data.app_icon_url?`<img id="appIconPreview" class="upload-preview" src="${esc(data.app_icon_url)}" alt="Ikon aplikasi">`:''}</div><p class="muted">Aplikasi yang sudah terlanjur ter-install tidak berubah otomatis. Hapus lalu install ulang dari Chrome agar nama/ikon baru terpakai.</p></div><div class="full upload-box"><label>Favicon (ikon tab browser)</label><p class="muted">Pilih gambar dari HP (sebaiknya kotak/persegi). Otomatis dijadikan ikon 256×256, di-upload, dan langsung dipakai.</p><div class="upload-row"><input id="favFile" class="input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"><button id="uploadFav" class="btn" type="button">📁 Upload Favicon</button></div><input type="hidden" name="favicon_url" id="favUrl" value="${esc((data.favicon_url&&!/^https?:\/\/(www\.)?ibb\.co\//i.test(data.favicon_url))?data.favicon_url:'')}"><div id="favStatus" class="upload-status">${(data.favicon_url&&!/^https?:\/\/(www\.)?ibb\.co\//i.test(data.favicon_url))?'Favicon tersimpan.':'Belum ada favicon (memakai bawaan).'}</div>${(data.favicon_url&&!/^https?:\/\/(www\.)?ibb\.co\//i.test(data.favicon_url))?`<img id="favPreview" class="upload-preview" src="${esc(data.favicon_url)}" alt="Favicon">`:''}</div><div class="full upload-box"><label>Wallpaper Hero (halaman depan)</label><p class="muted">Pilih foto langsung dari galeri/File Manager HP. Foto otomatis dikecilkan, di-upload, dan langsung dipakai di website.</p><div class="upload-row"><input id="heroFile" class="input" type="file" accept="image/png,image/jpeg,image/webp"><button id="uploadHero" class="btn" type="button">📁 Upload Wallpaper</button></div><input type="hidden" name="hero_image" id="heroUrl" value="${esc((data.hero_image&&!/^https?:\/\/(www\.)?ibb\.co\//i.test(data.hero_image))?data.hero_image:'')}"><div id="heroStatus" class="upload-status">${(data.hero_image&&!/^https?:\/\/(www\.)?ibb\.co\//i.test(data.hero_image))?'Wallpaper tersimpan.':'Belum ada wallpaper (memakai bawaan).'}</div>${(data.hero_image&&!/^https?:\/\/(www\.)?ibb\.co\//i.test(data.hero_image))?`<img id="heroPreview" class="upload-preview" src="${esc(data.hero_image)}" alt="Wallpaper">`:''}</div><div class="full contact-box"><h3>Kontak Developer</h3><p class="muted">Isi link saja. Di halaman publik yang tampil hanya ikon.</p><label>WhatsApp Link<input class="input" name="whatsapp_url" value="${esc(data.whatsapp_url||'')}"></label><label>Telegram Link<input class="input" name="telegram_url" value="${esc(data.telegram_url||'')}"></label><label>Instagram Link<input class="input" name="instagram_url" value="${esc(data.instagram_url||'')}"></label></div><button class="btn red full" type="submit">Simpan Branding</button></form>`);const fileInput=document.querySelector('#developerLogoFile');const uploadBtn=document.querySelector('#uploadDeveloperLogo');const status=document.querySelector('#developerLogoStatus');uploadBtn.onclick=async()=>{const file=fileInput.files?.[0];if(!file)return alert('Pilih logo dari File Manager terlebih dahulu.');if(!file.type.startsWith('image/'))return alert('File harus berupa gambar.');if(file.size>5*1024*1024)return alert('Ukuran logo maksimal 5 MB.');uploadBtn.disabled=true;status.textContent='Mengupload logo...';try{const ext=(file.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`branding/developer-logo-${Date.now()}.${ext}`;const {error:uploadError}=await supabase.storage.from('media').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});if(uploadError)throw uploadError;const {data:pub}=supabase.storage.from('media').getPublicUrl(path);document.querySelector('#developerLogoUrl').value=pub.publicUrl;const {error:saveLogoError}=await supabase.from('branding').upsert({id:1,developer_logo_url:pub.publicUrl});if(saveLogoError)throw saveLogoError;status.textContent='Logo berhasil di-upload dan langsung disimpan.';let preview=document.querySelector('.upload-preview');if(!preview){preview=document.createElement('img');preview.className='upload-preview';document.querySelector('.upload-box').appendChild(preview)}preview.src=pub.publicUrl;}catch(err){status.textContent='Upload gagal.';alert('Upload logo gagal: '+err.message)}finally{uploadBtn.disabled=false}};const headerFile=document.querySelector('#headerLogoFile');const headerBtn=document.querySelector('#uploadHeaderLogo');const headerStatus=document.querySelector('#headerLogoStatus');headerBtn.onclick=async()=>{const file=headerFile.files?.[0];if(!file)return alert('Pilih logo header terlebih dahulu.');if(!file.type.startsWith('image/'))return alert('File harus berupa gambar.');if(file.size>5*1024*1024)return alert('Ukuran logo maksimal 5 MB.');headerBtn.disabled=true;headerStatus.textContent='Mengupload logo header...';try{const ext=(file.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`branding/header-logo-${Date.now()}.${ext}`;const {error:uploadError}=await supabase.storage.from('media').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});if(uploadError)throw uploadError;const {data:pub}=supabase.storage.from('media').getPublicUrl(path);const {error:saveError}=await supabase.from('branding').upsert({id:1,logo_url:pub.publicUrl});if(saveError)throw saveError;document.querySelector('#headerLogoUrl').value=pub.publicUrl;headerStatus.textContent='Logo header berhasil di-upload dan disimpan.';let preview=document.querySelector('#headerLogoStatus').parentElement.querySelector('.upload-preview');if(!preview){preview=document.createElement('img');preview.className='upload-preview';document.querySelector('#headerLogoStatus').parentElement.appendChild(preview)}preview.src=pub.publicUrl;}catch(err){headerStatus.textContent='Upload gagal.';alert('Upload logo header gagal: '+err.message)}finally{headerBtn.disabled=false}};const heroBtn=document.querySelector('#uploadHero');heroBtn.onclick=async()=>{const file=document.querySelector('#heroFile').files?.[0],st=document.querySelector('#heroStatus');if(!file)return alert('Pilih foto wallpaper dari HP terlebih dahulu.');if(!file.type.startsWith('image/'))return alert('File harus berupa gambar.');if(file.size>20*1024*1024)return alert('Ukuran foto maksimal 20 MB.');heroBtn.disabled=true;st.textContent='Memproses dan mengupload...';try{let body=file,type=file.type,ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';try{const bmp=await createImageBitmap(file);const k=Math.min(1,1920/Math.max(bmp.width,bmp.height));const c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.85));if(blob&&blob.size>0){body=blob;type='image/jpeg';ext='jpg'}}catch{}const path=`branding/hero-${Date.now()}.${ext}`;const {error:upErr}=await supabase.storage.from('media').upload(path,body,{upsert:true,contentType:type,cacheControl:'31536000'});if(upErr)throw upErr;const {data:pub}=supabase.storage.from('media').getPublicUrl(path);const {error:saveErr}=await supabase.from('branding').upsert({id:1,hero_image:pub.publicUrl});if(saveErr)throw saveErr;document.querySelector('#heroUrl').value=pub.publicUrl;st.textContent='Wallpaper berhasil di-upload dan langsung dipakai.';let pv=document.querySelector('#heroPreview');if(!pv){pv=document.createElement('img');pv.id='heroPreview';pv.className='upload-preview';st.parentElement.appendChild(pv)}pv.src=pub.publicUrl;document.querySelector('#heroFile').value=''}catch(err){st.textContent='Upload gagal.';alert('Upload wallpaper gagal: '+(err.message||err))}finally{heroBtn.disabled=false}};const favBtn=document.querySelector('#uploadFav');favBtn.onclick=async()=>{const file=document.querySelector('#favFile').files?.[0],st=document.querySelector('#favStatus');if(!file)return alert('Pilih gambar favicon dari HP terlebih dahulu.');if(!file.type.startsWith('image/'))return alert('File harus berupa gambar.');if(file.size>5*1024*1024)return alert('Ukuran gambar maksimal 5 MB.');favBtn.disabled=true;st.textContent='Memproses dan mengupload...';try{let body=file,type=file.type,ext=(file.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'')||'png';if(file.type!=='image/svg+xml'){try{const bmp=await createImageBitmap(file);const S=256,c=document.createElement('canvas');c.width=c.height=S;const m=Math.min(bmp.width,bmp.height),sx=(bmp.width-m)/2,sy=(bmp.height-m)/2;c.getContext('2d').drawImage(bmp,sx,sy,m,m,0,0,S,S);const blob=await new Promise(r=>c.toBlob(r,'image/png'));if(blob&&blob.size>0){body=blob;type='image/png';ext='png'}}catch{}}const path=`branding/favicon-${Date.now()}.${ext}`;const {error:upErr}=await supabase.storage.from('media').upload(path,body,{upsert:true,contentType:type,cacheControl:'31536000'});if(upErr)throw upErr;const {data:pub}=supabase.storage.from('media').getPublicUrl(path);const {error:saveErr}=await supabase.from('branding').upsert({id:1,favicon_url:pub.publicUrl});if(saveErr)throw saveErr;document.querySelector('#favUrl').value=pub.publicUrl;st.textContent='Favicon berhasil di-upload dan langsung dipakai.';let pv=document.querySelector('#favPreview');if(!pv){pv=document.createElement('img');pv.id='favPreview';pv.className='upload-preview';st.parentElement.appendChild(pv)}pv.src=pub.publicUrl;document.querySelector('#favFile').value=''}catch(err){st.textContent='Upload gagal.';alert('Upload favicon gagal: '+(err.message||err))}finally{favBtn.disabled=false}};const aiBtn=document.querySelector('#uploadAppIcon');aiBtn.onclick=async()=>{const file=document.querySelector('#appIconFile').files?.[0],st=document.querySelector('#appIconStatus');if(!file)return alert('Pilih gambar ikon dari HP terlebih dahulu.');if(!file.type.startsWith('image/'))return alert('File harus berupa gambar.');if(file.size>10*1024*1024)return alert('Ukuran gambar maksimal 10 MB.');aiBtn.disabled=true;st.textContent='Memproses dan mengupload...';try{const bmp=await createImageBitmap(file);const S=512,c=document.createElement('canvas');c.width=c.height=S;const m=Math.min(bmp.width,bmp.height),sx=(bmp.width-m)/2,sy=(bmp.height-m)/2;c.getContext('2d').drawImage(bmp,sx,sy,m,m,0,0,S,S);const blob=await new Promise(r=>c.toBlob(r,'image/png'));if(!blob)throw new Error('Gagal memproses gambar');const path=`branding/app-icon-${Date.now()}.png`;const {error:upErr}=await supabase.storage.from('media').upload(path,blob,{upsert:true,contentType:'image/png',cacheControl:'31536000'});if(upErr)throw upErr;const {data:pub}=supabase.storage.from('media').getPublicUrl(path);const {error:saveErr}=await supabase.from('branding').upsert({id:1,app_icon_url:pub.publicUrl});if(saveErr)throw saveErr;document.querySelector('#appIconUrl').value=pub.publicUrl;st.textContent='Ikon berhasil di-upload dan disimpan.';let pv=document.querySelector('#appIconPreview');if(!pv){pv=document.createElement('img');pv.id='appIconPreview';pv.className='upload-preview';st.parentElement.appendChild(pv)}pv.src=pub.publicUrl;document.querySelector('#appIconFile').value=''}catch(err){st.textContent='Upload gagal.';alert('Upload ikon gagal: '+(err.message||err)+'\n\nPastikan SQL supabase-app-name.sql sudah dijalankan.')}finally{aiBtn.disabled=false}};document.querySelector('#brandForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const obj=Object.fromEntries(fd.entries());obj.id=1;const {error}=await supabase.from('branding').upsert(obj);alert(error?error.message:'Branding berhasil disimpan.');};}
async function kanji(){
  const [kr,br]=await Promise.all([supabase.from('kanji').select('*').order('created_at',{ascending:true}),supabase.from('branding').select('kanji_part_names').eq('id',1).maybeSingle()]);
  const data=kr.data||[], partOf=x=>Number(x.part_number)||1;
  let names={};try{const v=br?.data?.kanji_part_names;names=typeof v==='string'?JSON.parse(v):(v||{});}catch{}
  const nums=[...new Set(data.map(partOf))].sort((p,q)=>p-q);
  const sel=Math.max(1,Number(window.__kSel)||nums[0]||1);
  const opts=[...new Set([...nums,sel])].sort((p,q)=>p-q);
  const cnt=n=>data.filter(x=>partOf(x)===n).length;
  const rows=data.filter(x=>partOf(x)===sel);
  const partTitle=n=>names[n]||`Kanji Part ${n}`;
  app(`<div class="admin-header"><div><div class="eyebrow">字 KANJI</div><h1>Kelola Kanji</h1><p class="muted">Pilih Part, lalu isi, edit, atau hapus Kanji di Part itu. Nomor Part bebas, tanpa batas.</p></div></div>
  <div class="card admin-card"><h3>Import Kanji</h3><p class="muted">Format: Kanji|Cara Baca|Arti. Baris kosong dan nomor di awal baris boleh digunakan.</p><label style="display:block;margin:0 0 10px">Masukkan ke Part nomor<input id="kImportPart" class="input" type="number" min="1" value="${sel}"></label><textarea id="kImport" class="textarea" rows="8" placeholder="1. 食べる|たべる|Makan&#10;&#10;2. 飲む|のむ|Minum"></textarea><label class="check-line" style="margin:12px 0"><input type="checkbox" id="kImportAnim" checked> Buat animasi urutan goresan untuk semua Kanji yang diimport</label><button id="importK" class="btn red">Import</button></div>
  <div class="card admin-card"><h3>📋 Lihat Semua Kanji</h3><p class="muted">Total ${data.length} Kanji di ${nums.length} Part. Tampilkan lalu salin untuk cadangan atau dipindah ke tempat lain. Formatnya sama dengan Import (Kanji|Cara Baca|Arti), jadi bisa di-import ulang kapan saja.</p><label>Tampilkan<select id="kvScope" class="input"><option value="all">Semua Part (${data.length} Kanji)</option>${nums.map(n=>`<option value="${n}">Part ${n} · ${esc(partTitle(n))} (${cnt(n)} Kanji)</option>`).join('')}</select></label><label class="check-line" style="margin:10px 0"><input type="checkbox" id="kvHead" checked> Sertakan judul Part</label><button class="btn" type="button" id="kvShow">👁 Tampilkan Daftar</button><div id="kvBox" hidden style="margin-top:12px"><textarea id="kvText" class="textarea" rows="14" readonly></textarea><div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 6px"><button class="btn red" type="button" id="kvCopy">📋 Salin Semua</button><button class="btn" type="button" id="kvHide">Tutup</button></div><small class="muted" id="kvInfo"></small></div></div>
  <div class="card admin-card"><h3>Pilih Part</h3><label>Part yang dikelola<select id="kPartSel" class="input">${opts.map(n=>`<option value="${n}" ${n===sel?'selected':''}>Part ${n} · ${esc(partTitle(n))} (${cnt(n)} Kanji)</option>`).join('')}<option value="new">➕ Part baru…</option></select></label><label style="display:block;margin-top:12px">Nama Part ${sel} <small class="muted">(judul yang dilihat user)</small><input id="kPartName" class="input" value="${esc(names[sel]||'')}" placeholder="Kanji Part ${sel}"></label><button id="kPartNameSave" class="btn red" style="margin-top:10px">Simpan Nama Part</button></div>
  <div class="card admin-card"><h3 id="kFormTitle">Tambah Kanji ke Part ${sel}</h3><form id="kForm" class="form-grid"><input type="hidden" name="eid" value=""><label>Kanji<input class="input" name="kanji" required placeholder="食べる"></label><label>Cara Baca<input class="input" name="reading" required placeholder="たべる"></label><label>Part<input class="input" name="part_number" type="number" min="1" value="${sel}" required></label><label class="full">Arti<input class="input" name="meaning" required placeholder="Makan"></label><label class="full check-line"><input type="checkbox" name="animate" checked> Buat animasi urutan goresan untuk Kanji ini</label><button class="btn red full" type="submit" id="kSubmit">Tambah Kanji</button><button class="btn full" type="button" id="kCancel" hidden>Batal edit</button></form></div>
  <div class="card admin-card"><div class="toolbar"><b>Part ${sel} · ${rows.length} Kanji</b><button id="delAll" class="btn danger">Hapus Semua di Part ${sel}</button></div><div class="table-list">${rows.map(x=>{const on=x.animate!==false;return `<div class="list-row"><div><b>${esc(x.kanji)}</b><span>${esc(x.reading||'')} · ${esc(x.meaning)}</span><span><i class="mode-pill ${on?'user':''}">${on?'Animasi aktif':'Tanpa animasi'}</i></span></div><div class="media-actions"><button class="btn" data-kedit="${x.id}">✏️ Edit</button><button class="btn" data-kpart="${x.id}" data-cur="${partOf(x)}">Pindah Part</button><button class="btn" data-ktoggle="${x.id}" data-on="${on?1:0}">${on?'Matikan animasi':'Aktifkan animasi'}</button><button class="btn danger" data-del="${x.id}">Hapus</button></div></div>`;}).join('')||'<p class="muted">Belum ada Kanji di Part ini.</p>'}</div></div>`);
  const form=document.querySelector('#kForm');
  document.querySelector('#kPartSel').onchange=e=>{if(e.target.value==='new'){const v=prompt('Nomor Part baru?',String((opts[opts.length-1]||0)+1));const n=Math.floor(Number(v));if(!(n>=1)){e.target.value=String(sel);return;}window.__kSel=n;}else window.__kSel=Number(e.target.value);render();};
  document.querySelector('#kPartNameSave').onclick=async()=>{const v=document.querySelector('#kPartName').value.trim();const nn={...names};if(v)nn[sel]=v;else delete nn[sel];const {error}=await supabase.from('branding').upsert({id:1,kanji_part_names:nn});if(error)alert(error.message+'\n\nPastikan SQL supabase-kanji-part.sql sudah dijalankan.');else{alert('Nama Part tersimpan.');render();}};
  const resetForm=()=>{form.reset();form.eid.value='';form.part_number.value=sel;form.animate.checked=true;document.querySelector('#kSubmit').textContent='Tambah Kanji';document.querySelector('#kFormTitle').textContent=`Tambah Kanji ke Part ${sel}`;document.querySelector('#kCancel').hidden=true;};
  document.querySelector('#kCancel').onclick=resetForm;
  document.querySelectorAll('[data-kedit]').forEach(b=>b.onclick=()=>{const x=data.find(r=>String(r.id)===b.dataset.kedit);if(!x)return;form.eid.value=x.id;form.kanji.value=x.kanji||'';form.reading.value=x.reading||'';form.meaning.value=x.meaning||'';form.part_number.value=partOf(x);form.animate.checked=x.animate!==false;document.querySelector('#kSubmit').textContent='Simpan Perubahan';document.querySelector('#kFormTitle').textContent='Edit Kanji';document.querySelector('#kCancel').hidden=false;form.scrollIntoView({behavior:'smooth',block:'center'});});
  form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form);const row={kanji:String(fd.get('kanji')).trim(),reading:String(fd.get('reading')).trim(),meaning:String(fd.get('meaning')).trim(),animate:fd.has('animate'),part_number:Math.max(1,Math.floor(Number(fd.get('part_number'))||1))};const eid=fd.get('eid');let r;if(eid)r=await saveOptional(x=>supabase.from('kanji').update(x).eq('id',eid),row,KANJI_OPT);else r=await saveOptional(x=>supabase.from('kanji').insert(x),{...row,active:true},KANJI_OPT);if(r.error)alert(r.error.message);else{window.__kSel=row.part_number;render();}};
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(confirm('Hapus Kanji ini?')){await supabase.from('kanji').delete().eq('id',b.dataset.del);render();}});
  document.querySelectorAll('[data-kpart]').forEach(b=>b.onclick=async()=>{const v=prompt('Pindahkan Kanji ini ke Part nomor berapa?',b.dataset.cur);if(v===null)return;const n=Math.floor(Number(v));if(!(n>=1))return alert('Nomor Part harus angka 1 atau lebih.');const {error}=await supabase.from('kanji').update({part_number:n}).eq('id',b.dataset.kpart);if(error)alert(error.message+'\n\nPastikan SQL supabase-kanji-part.sql sudah dijalankan.');else render();});
  document.querySelectorAll('[data-ktoggle]').forEach(b=>b.onclick=async()=>{const {error}=await supabase.from('kanji').update({animate:b.dataset.on!=='1'}).eq('id',b.dataset.ktoggle);if(error)alert(String(error.message||'').includes('animate')?DB_NOTE:error.message);else render();});
  document.querySelector('#delAll').onclick=async()=>{if(!rows.length)return alert('Part ini belum punya Kanji.');if(confirm(`Hapus semua ${rows.length} Kanji di Part ${sel}?`)){await supabase.from('kanji').delete().eq('part_number',sel);render();}};
  const kvBuild=()=>{const sc=document.querySelector('#kvScope').value,head=document.querySelector('#kvHead').checked;const ns=sc==='all'?nums:[Number(sc)];return ns.map(n=>{const list=data.filter(x=>partOf(x)===n);return (head?`=== Part ${n} · ${partTitle(n)} (${list.length} Kanji) ===\n`:'')+list.map((x,i)=>`${i+1}. ${x.kanji}|${x.reading||''}|${x.meaning}`).join('\n');}).join('\n\n');};
  const kvFill=()=>{const t=kvBuild();document.querySelector('#kvText').value=t;const sc=document.querySelector('#kvScope').value;document.querySelector('#kvInfo').textContent=`${sc==='all'?data.length:cnt(Number(sc))} Kanji ditampilkan.`;};
  document.querySelector('#kvShow').onclick=()=>{kvFill();document.querySelector('#kvBox').hidden=false;};
  document.querySelector('#kvHide').onclick=()=>{document.querySelector('#kvBox').hidden=true;};
  document.querySelector('#kvScope').onchange=()=>{if(!document.querySelector('#kvBox').hidden)kvFill();};
  document.querySelector('#kvHead').onchange=()=>{if(!document.querySelector('#kvBox').hidden)kvFill();};
  document.querySelector('#kvCopy').onclick=async()=>{const t=document.querySelector('#kvText');try{await navigator.clipboard.writeText(t.value);}catch{t.select();t.setSelectionRange(0,t.value.length);document.execCommand('copy');}alert('Daftar Kanji tersalin.');};
  document.querySelector('#importK').onclick=async()=>{const anim=document.querySelector('#kImportAnim').checked;const ipart=Math.max(1,Math.floor(Number(document.querySelector('#kImportPart').value)||1));const lines=document.querySelector('#kImport').value.split(/\n/).map(s=>s.trim()).filter(Boolean);const out=[];for(let line of lines){line=line.replace(/^\s*\d+[.)]\s*/,'');const [kanji,reading,meaning]=line.split('|').map(s=>s.trim());if(kanji&&reading&&meaning)out.push({kanji,reading,meaning,active:true,animate:anim,part_number:ipart});}if(out.length){const {error}=await saveOptional(r=>supabase.from('kanji').insert(r),out,KANJI_OPT);if(error)alert(error.message);else{window.__kSel=ipart;render();}}else alert('Tidak ada baris valid.');};
}

function parseLessonLines(text, conversation=false){
  return text.split(/\n/).map(s=>s.trim()).filter(Boolean).map(line=>{
    const [a,b,c,d]=line.split('|').map(x=>x.trim());
    return conversation ? [a||'A',b||'',c||'',d||''] : [a||'',b||'',c||''];
  }).filter(x=>conversation ? x[1] : x[0]);
}
async function kaiwa(){
  const {data:dbRows,error}=await supabase.from('bunpou').select('*').order('sort_order').order('created_at',{ascending:false});
  if(error){app(`<div class="admin-header"><div><div class="eyebrow">KAIWA & BUNPOU</div><h1>Kelola Bunpou</h1><p class="muted">Supabase belum membaca tabel Bunpou. Jalankan schema fix jika tabel belum terbaca.</p></div></div><div class="card admin-card"><pre>${esc(error.message)}</pre></div>`);return;}
  const keyOf=x=>`${x.category||'bunpou'}|${x.title||x.pattern}`;
  const merged=new Map(defaultBunpou.map(x=>[keyOf(x),{...x,__builtin:true}]));
  (dbRows||[]).forEach(x=>merged.set(keyOf(x),{...x,__builtin:false}));
  const rows=[...merged.values()];
  const toLines=(arr,conversation=false)=> (Array.isArray(arr)?arr:[]).map(x=>conversation?`${x[0]||'A'}|${x[1]||''}|${x[2]||''}|${x[3]||''}`:`${x[0]||''}|${x[1]||''}|${x[2]||''}`).join('\n');
  app(`<div class="admin-header"><div><div class="eyebrow">会話 · KAIWA</div><h1>Kelola Bunpou</h1><p class="muted">Semua materi bawaan + materi yang kamu tambahkan tampil di sini. Klik <b>Ubah</b> untuk memperbaiki materi.</p></div></div>
  <div class="card admin-card"><form id="bForm" class="form-grid"><input type="hidden" name="id"><input type="hidden" name="builtin_key"><label>Kategori<select class="input" name="category"><option value="partikel">Partikel</option><option value="bunpou">Bunpou</option></select></label><label>Urutan<input class="input" type="number" name="sort_order" value="100"></label><label>Judul<input class="input" name="title" required placeholder="と (to)"></label><label>Pola<input class="input" name="pattern" required placeholder="kata benda + と"></label><label>Arti<input class="input" name="meaning" required placeholder="dan / bersama"></label><label>Aktif<select class="input" name="active"><option value="true">Ya</option><option value="false">Tidak</option></select></label><label class="full">Fungsi<textarea class="textarea" name="usage" required></textarea></label><label class="full">Bentuk sebelum pola<textarea class="textarea" name="before_form" required placeholder="Gunakan istilah Indonesia: bentuk kamus, bentuk て, bentuk た, bentuk ない, dll."></textarea></label><label class="full">Catatan tambahan<textarea class="textarea" name="notes"></textarea></label><label class="full">Contoh (satu baris: kana|romaji|arti)<textarea class="textarea" name="examples" rows="5"></textarea></label><label class="full">KAIWA (satu baris: A/B|kana|romaji|arti)<textarea class="textarea" name="conversation" rows="7"></textarea></label><div class="toolbar full"><button id="bSubmit" class="btn red" type="submit">Tambah Bunpou</button><button id="bCancel" class="btn" type="button" hidden>Batal Ubah</button></div></form></div>
  <div class="card admin-card"><div class="admin-list-head"><h2>Semua Partikel & Bunpou</h2><span class="muted">${rows.length} materi</span></div><div class="table-list">${rows.map((x,i)=>`<div class="list-row"><div><b>${esc(x.title||x.pattern)}</b><span>${esc(x.category)} · ${esc(x.meaning||'')} · ${x.active===false?'Nonaktif':'Aktif'}${x.__builtin?' · Bawaan':''}</span></div><div class="media-actions"><button class="btn" type="button" data-bedit="${i}">Ubah</button>${x.id?`<button class="btn danger" type="button" data-bdel="${x.id}">Hapus</button>`:''}</div></div>`).join('')}</div></div>`);
  const form=document.querySelector('#bForm'), submit=document.querySelector('#bSubmit'), cancel=document.querySelector('#bCancel');
  const fill=(x)=>{for(const n of ['id','builtin_key','category','sort_order','title','pattern','meaning','active','usage','before_form','notes','examples','conversation']){const el=form.elements[n];if(!el)continue;if(n==='examples')el.value=toLines(x.examples,false);else if(n==='conversation')el.value=toLines(x.conversation,true);else if(n==='builtin_key')el.value=keyOf(x);else el.value=x[n]??'';}submit.textContent='Simpan Perubahan';cancel.hidden=false;window.scrollTo({top:0,behavior:'smooth'});};
  document.querySelectorAll('[data-bedit]').forEach(b=>b.onclick=()=>fill(rows[Number(b.dataset.bedit)]));
  cancel.onclick=()=>{form.reset();form.elements.id.value='';form.elements.builtin_key.value='';form.elements.sort_order.value='100';submit.textContent='Tambah Bunpou';cancel.hidden=true;};
  form.onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(form));const examples=parseLessonLines(o.examples,false);const conversation=parseLessonLines(o.conversation,true);const row={category:o.category,title:o.title,pattern:o.pattern,meaning:o.meaning,usage:o.usage,before_form:o.before_form,notes:o.notes||'',examples,conversation,sort_order:Number(o.sort_order||100),active:o.active==='true'};let result;if(o.id)result=await supabase.from('bunpou').update(row).eq('id',o.id);else result=await supabase.from('bunpou').insert(row);if(result.error)alert(result.error.message);else{alert(o.id?'Bunpou berhasil diperbarui.':'Bunpou berhasil ditambahkan.');render();}};
  document.querySelectorAll('[data-bdel]').forEach(b=>b.onclick=async()=>{if(confirm('Hapus materi Bunpou custom ini?')){const {error}=await supabase.from('bunpou').delete().eq('id',b.dataset.bdel);if(error)alert(error.message);else render();}});
}
async function parts(){
  const {data}=await supabase.from('parts').select('*').order('part_number');
  app(`<div class="admin-header"><div><div class="eyebrow">LATIHAN</div><h1>Part</h1><p class="muted">Pilih siapa yang mengatur jumlah soal &amp; timer: Admin atau User. Di sini hanya untuk mengaktifkan/menonaktifkan dan menghapus Part. Kelola soal, foto, dan audio ada di menu Soal.</p></div></div>
  <div class="card admin-card"><form id="pForm" class="form-grid">
    <label>Nomor Part<input class="input" name="part_number" type="number" min="1" required value="${Math.max(0,...(data||[]).map(x=>Number(x.part_number)||0))+1}"></label>
    <label>Nama Part<input class="input" name="name" required placeholder="Part 01"></label>
    <label class="full">Deskripsi<input class="input" name="description"></label>
    <div class="full">${partSetupHTML({})}</div>
    <label><input type="checkbox" name="shuffle_questions" checked> Acak soal</label>
    <label><input type="checkbox" name="shuffle_options" checked> Acak pilihan <small class="muted">(sekarang selalu acak otomatis)</small></label>
    <label><input type="checkbox" name="active" checked> Aktif</label>
    <label>Jika nonaktif, tampilan di user<select class="input" name="inactive_mode"><option value="blur">Blur (tetap terlihat, redup)</option><option value="hide">Dihilangkan (tidak tampil)</option></select></label>
    <button class="btn red full" type="submit">Tambah Part</button>
  </form></div>
  <div class="card admin-card table-list">${(data||[]).map(x=>`<div class="list-row part-admin-row">
    <div><b>Part ${String(x.part_number).padStart(2,'0')} — ${esc(x.name)}</b><span>${partModeBadge(x)}${esc(x.description||'')} · ${x.active?'Aktif':`Nonaktif (${x.inactive_mode==='hide'?'dihilangkan':'blur'})`}${x.scheduled_start_at?` · Mulai ${new Date(x.scheduled_start_at).toLocaleString('id-ID')}`:''}${x.scheduled_end_at?` · Selesai ${new Date(x.scheduled_end_at).toLocaleString('id-ID')}`:''}</span></div>
    <div class="media-actions">
      <button class="btn" type="button" data-pmove="${x.id}">⇅ Urutan</button>
      <button class="btn" type="button" data-pedit="${x.id}">✏️ Edit</button>
      <button class="btn" type="button" data-part-toggle="${x.id}" data-active="${x.active?'1':'0'}">${x.active?'✓ Atur Status':'✕ Aktifkan'}</button>
      <button class="btn danger" type="button" data-pdel="${x.id}">Hapus</button>
    </div>
  </div>`).join('')||'<p class="muted">Belum ada Part.</p>'}</div>`);
  bindPartSetup(document.querySelector('#pForm'));
  document.querySelector('#pForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const o=Object.fromEntries(fd.entries());const row={part_number:Number(o.part_number),name:o.name,description:o.description||'',...readPartSetup(e.target),shuffle_questions:fd.has('shuffle_questions'),shuffle_options:fd.has('shuffle_options'),active:fd.has('active'),inactive_mode:o.inactive_mode==='hide'?'hide':'blur',scheduled_start_at:null,scheduled_end_at:null};if(!(row.part_number>=1))return alert('Nomor Part harus angka 1 atau lebih.');const dupe=(data||[]).find(x=>Number(x.part_number)===row.part_number);if(dupe){const used=new Set((data||[]).map(x=>Number(x.part_number)));let nx=row.part_number+1;while(used.has(nx))nx++;return alert(`Nomor Part ${row.part_number} sudah dipakai oleh "${dupe.name}".\n\nPart tidak ditambahkan. Pakai nomor lain (nomor kosong berikutnya: ${nx}), atau hapus Part lama dulu.`);}const {error}=await saveOptional(r=>supabase.from('parts').insert(r),row,PART_OPT);if(error)alert(error.message);else render();};
  document.querySelectorAll('[data-part-toggle]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const isActive=b.dataset.active==='1';
    const part=(data||[]).find(p=>String(p.id)===b.dataset.partToggle)||{};const curMode=part.inactive_mode==='hide'?'hide':'blur';
    const modal=document.createElement('div');modal.className='schedule-modal-backdrop';modal.innerHTML=`<div class="schedule-modal card admin-card" role="dialog" aria-modal="true"><h2>${isActive?'Atur status Part':'Aktifkan Part'}</h2><p class="muted">Pilih tindakan untuk Part ini.</p><label class="schedule-choice"><input type="radio" name="scheduleMode" value="${isActive?'off':'now'}" checked> ${isActive?'Nonaktifkan sekarang':'Aktifkan sekarang'}</label><label class="schedule-choice"><input type="radio" name="scheduleMode" value="scheduled"> ${isActive?'Nonaktifkan dulu, aktif otomatis sesuai jadwal':'Aktifkan menggunakan jadwal'}</label><div class="schedule-fields" hidden><label>Mulai aktif tanggal &amp; jam<input class="input" type="datetime-local" id="scheduleStart"></label><label>Nonaktif kembali (opsional)<input class="input" type="datetime-local" id="scheduleEnd"></label><small class="muted">Gunakan waktu lokal perangkat. Waktu selesai boleh dikosongkan.</small></div><h3 style="margin:16px 0 6px;font-size:1rem">Saat Part nonaktif, tampilan di user:</h3><label class="schedule-choice"><input type="radio" name="inactiveMode" value="blur" ${curMode==='blur'?'checked':''}> 🌫️ Blur — Part tetap terlihat tapi redup dan tidak bisa dibuka</label><label class="schedule-choice"><input type="radio" name="inactiveMode" value="hide" ${curMode==='hide'?'checked':''}> 🙈 Dihilangkan — Part tidak tampil sama sekali</label><div class="media-actions"><button type="button" class="btn" data-schedule-cancel>Batal</button><button type="button" class="btn red" data-schedule-save>Simpan</button></div></div>`;document.body.appendChild(modal);
    const fields=modal.querySelector('.schedule-fields');modal.querySelectorAll('[name="scheduleMode"]').forEach(r=>r.onchange=()=>{fields.hidden=modal.querySelector('[name="scheduleMode"]:checked').value!=='scheduled';});
    modal.querySelector('[data-schedule-cancel]').onclick=()=>modal.remove();modal.onclick=ev=>{if(ev.target===modal)modal.remove()};
    modal.querySelector('[data-schedule-save]').onclick=async()=>{const mode=modal.querySelector('[name="scheduleMode"]:checked').value,im=modal.querySelector('[name="inactiveMode"]:checked').value;let patch;
      if(mode==='scheduled'){const start=modal.querySelector('#scheduleStart').value,end=modal.querySelector('#scheduleEnd').value;if(!start)return alert('Pilih tanggal dan jam mulai aktif.');if(new Date(start)<=new Date())return alert('Waktu mulai harus di masa depan.');if(end&&new Date(end)<=new Date(start))return alert('Waktu selesai harus setelah waktu mulai.');patch={active:false,scheduled_start_at:new Date(start).toISOString(),scheduled_end_at:end?new Date(end).toISOString():null,inactive_mode:im};}
      else patch={active:mode==='now',scheduled_start_at:null,scheduled_end_at:null,inactive_mode:im};
      const {error,degraded}=await saveOptional(r=>supabase.from('parts').update(r).eq('id',b.dataset.partToggle),patch,PART_OPT);if(error)return alert(error.message);modal.remove();render();
    };
  });
  const reorderPart=async(id,target)=>{const list=[...(data||[])].sort((x,y)=>x.part_number-y.part_number);const from=list.findIndex(p=>String(p.id)===String(id));if(from<0)return false;const t=Math.max(0,Math.min(list.length-1,target));if(t===from)return false;const pool=list.map(p=>p.part_number);const moved=list.splice(from,1)[0];list.splice(t,0,moved);const changes=list.map((p,i)=>({id:p.id,to:pool[i],from:p.part_number})).filter(c=>c.from!==c.to);if(!changes.length)return false;const base=Math.max(...pool)+1000;
    const r1=await Promise.all(changes.map((c,i)=>supabase.from('parts').update({part_number:base+i}).eq('id',c.id)));const e1=r1.find(r=>r.error);if(e1){alert(e1.error.message);return false;}
    const r2=await Promise.all(changes.map(c=>supabase.from('parts').update({part_number:c.to}).eq('id',c.id)));const e2=r2.find(r=>r.error);if(e2){alert(e2.error.message);return false;}return true;};
  document.querySelectorAll('[data-pmove]').forEach(b=>b.onclick=e=>{e.stopPropagation();const list=[...(data||[])].sort((x,y)=>x.part_number-y.part_number);const idx=list.findIndex(p=>String(p.id)===b.dataset.pmove);if(idx<0)return;const part=list[idx];
    const modal=document.createElement('div');modal.className='schedule-modal-backdrop';modal.innerHTML=`<div class="schedule-modal card admin-card" role="dialog" aria-modal="true"><h2>Atur urutan</h2><p class="muted">Part ${String(part.part_number).padStart(2,'0')} — ${esc(part.name)}<br>Sekarang di urutan ke-${idx+1} dari ${list.length}. Nomor Part mengikuti urutan barunya.</p><div style="display:grid;gap:8px"><button type="button" class="btn" data-mv="up" ${idx===0?'disabled':''}>⬆ Naik 1 urutan</button><button type="button" class="btn" data-mv="down" ${idx===list.length-1?'disabled':''}>⬇ Turun 1 urutan</button><button type="button" class="btn" data-mv="top" ${idx===0?'disabled':''}>⏫ Jadikan paling pertama</button><button type="button" class="btn" data-mv="bottom" ${idx===list.length-1?'disabled':''}>⏬ Jadikan paling terakhir</button><label>Atau pindah ke urutan ke-<input class="input" type="number" id="mvPos" min="1" max="${list.length}" value="${idx+1}"></label><button type="button" class="btn red" data-mv="pos">Pindahkan ke urutan itu</button></div><div class="media-actions"><button type="button" class="btn" data-mv-cancel>Batal</button></div></div>`;document.body.appendChild(modal);
    modal.querySelector('[data-mv-cancel]').onclick=()=>modal.remove();modal.onclick=ev=>{if(ev.target===modal)modal.remove()};
    modal.querySelectorAll('[data-mv]').forEach(btn=>btn.onclick=async()=>{const k=btn.dataset.mv;let t=idx;if(k==='up')t=idx-1;else if(k==='down')t=idx+1;else if(k==='top')t=0;else if(k==='bottom')t=list.length-1;else t=Math.round(Number(modal.querySelector('#mvPos').value)||0)-1;if(t<0||t>list.length-1)return alert(`Urutan harus antara 1 dan ${list.length}.`);modal.querySelectorAll('button').forEach(x=>x.disabled=true);const ok=await reorderPart(part.id,t);modal.remove();if(ok)render();else render();});
  });
  document.querySelectorAll('[data-pedit]').forEach(b=>b.onclick=e=>{e.stopPropagation();const part=(data||[]).find(p=>String(p.id)===b.dataset.pedit);if(!part)return;
    const modal=document.createElement('div');modal.className='schedule-modal-backdrop';modal.innerHTML=`<div class="schedule-modal card admin-card" role="dialog" aria-modal="true"><h2>Edit Part ${String(part.part_number).padStart(2,'0')}</h2><p class="muted">Ubah nama dan deskripsi yang dilihat user.</p><label>Nama Part<input class="input" id="peName" value="${esc(part.name||'')}"></label><label style="display:block;margin-top:10px">Deskripsi<textarea class="textarea" id="peDesc" rows="3">${esc(part.description||'')}</textarea></label><div class="media-actions"><button type="button" class="btn" data-pe-cancel>Batal</button><button type="button" class="btn red" data-pe-save>Simpan</button></div></div>`;document.body.appendChild(modal);
    modal.querySelector('[data-pe-cancel]').onclick=()=>modal.remove();modal.onclick=ev=>{if(ev.target===modal)modal.remove()};
    modal.querySelector('[data-pe-save]').onclick=async()=>{const name=modal.querySelector('#peName').value.trim(),description=modal.querySelector('#peDesc').value.trim();if(!name)return alert('Nama Part tidak boleh kosong.');const {error}=await supabase.from('parts').update({name,description}).eq('id',part.id);if(error)return alert(error.message);modal.remove();render();};
    setTimeout(()=>modal.querySelector('#peName')?.focus(),50);
  });
  document.querySelectorAll('[data-pdel]').forEach(b=>b.onclick=async e=>{e.stopPropagation();if(confirm('Hapus Part dan seluruh soal di dalamnya?')){await supabase.from('parts').delete().eq('id',b.dataset.pdel);render();}});
}
async function partQuestions(partId){
  const [{data:part},{data:qs,error}]=await Promise.all([
    supabase.from('parts').select('*').eq('id',partId).single(),
    supabase.from('questions').select('*').eq('part_id',partId).order('created_at',{ascending:true})
  ]);
  if(error)return alert(error.message);
  const rows=qs||[];
  app(`<div class="admin-header"><div><div class="eyebrow">PART ${String(part?.part_number||'').padStart(2,'0')}</div><h1>${esc(part?.name||'Part')}</h1><p class="muted">${rows.length} soal · Kelola soal, foto, dan audio langsung dari Part ini.</p></div><div class="toolbar"><button id="backParts" class="btn">← Kembali ke Part</button><button id="goQuick" class="btn red">＋ Tambah Soal</button></div></div>
  <div class="card admin-card"><h3>Pengaturan Soal &amp; Timer</h3><form id="partSetupForm">${partSetupHTML(part||{})}<button class="btn red fullbtn" type="submit">Simpan Pengaturan</button></form></div>
  <div class="card admin-card"><div class="part-question-list">${rows.map((x,i)=>`<article class="part-question-card" data-qcard="${x.id}">
    <div class="part-question-main"><div class="question-number">${i+1}</div><div class="part-question-copy"><b>${esc(x.prompt)}</b><span>${esc(x.type)} · jawaban: ${esc(x.answer)}</span>${x.reading?`<small>Reading: ${esc(x.reading)}</small>`:''}</div></div>
    <div class="part-media-status">${x.photo_url?'<span class="media-pill">📷 Foto tersimpan</span>':'<span class="media-pill muted-pill">📷 Belum ada foto</span>'}${x.audio_url?'<span class="media-pill">🔊 Audio tersimpan</span>':'<span class="media-pill muted-pill">🔊 Belum ada audio</span>'}</div>
    <div class="part-question-actions"><label class="btn">📷 ${x.photo_url?'Ganti Foto':'Tambah Foto'}<input hidden type="file" accept="image/*" data-part-photo="${x.id}"></label><label class="btn">🔊 ${x.audio_url?'Ganti Audio':'Tambah Audio'}<input hidden type="file" accept="audio/*" data-part-audio="${x.id}"></label><button class="btn danger" data-part-qdel="${x.id}">Hapus Soal</button></div>
    ${x.photo_url?`<div class="part-media-preview"><img src="${esc(x.photo_url)}" alt="Foto soal" loading="lazy"></div>`:''}
    ${x.audio_url?`<div class="part-audio-preview"><audio controls preload="metadata" src="${esc(x.audio_url)}"></audio></div>`:''}
  </article>`).join('')||'<div class="empty-state">Belum ada soal di Part ini.</div>'}</div></div>`);
  document.querySelector('#backParts').onclick=()=>{current='parts';render();};
  bindPartSetup(document.querySelector('#partSetupForm'));
  document.querySelector('#partSetupForm').onsubmit=async e=>{e.preventDefault();const {error,degraded}=await saveOptional(r=>supabase.from('parts').update(r).eq('id',partId),readPartSetup(e.target),PART_OPT);if(error)alert(error.message);else if(!degraded){alert('Pengaturan Part tersimpan.');partQuestions(partId);}};
  document.querySelector('#goQuick').onclick=()=>{current='quick';render();setTimeout(()=>{const sel=document.querySelector('#quickPart');if(sel){sel.value=partId;}},0)};
  document.querySelectorAll('[data-part-photo]').forEach(i=>i.onchange=()=>uploadMediaAndRefresh(i,'photo',partId));
  document.querySelectorAll('[data-part-audio]').forEach(i=>i.onchange=()=>uploadMediaAndRefresh(i,'audio',partId));
  document.querySelectorAll('[data-part-qdel]').forEach(b=>b.onclick=async()=>{if(confirm('Hapus soal ini dari Part?')){const {error}=await supabase.from('questions').delete().eq('id',b.dataset.partQdel);if(error)alert(error.message);else partQuestions(partId);}});
}
async function uploadMediaAndRefresh(input,kind,partId){await uploadMedia(input,kind);partQuestions(partId);}

function injectPdfImport(){
  const form=document.querySelector('#qForm');if(!form||document.querySelector('#pdfCard'))return;
  form.closest('.card').insertAdjacentHTML('beforebegin',`<div class="card admin-card" id="pdfCard"><h3>Impor Soal dari PDF</h3><p class="muted">Pilih file PDF soal (teksnya harus bisa disalin). Nomor soal dan pilihan a–d terdeteksi otomatis. Kunci jawaban kamu isi di pratinjau.</p><label>Part tujuan<select class="input" id="pdfPart">${document.querySelector('#qPart').innerHTML}</select></label><input type="file" accept="application/pdf" id="pdfFile" class="input"><div id="pdfOut"></div><hr style="margin:16px 0;opacity:.2"><b>Sudah punya soal? Cocokkan dengan PDF</b><p class="muted">Tidak perlu impor ulang. Pilih PDF yang sama: halaman dan nomor soal yang sudah ada diisi otomatis sesuai PDF (Part tujuan di atas), foto/audio tetap aman, dan salinan ganda digabung.</p><input type="file" accept="application/pdf" id="pdfSync" class="input"></div>`);
  document.querySelector('#pdfSync').onchange=e=>syncPdf(e.target.files[0]);
  const pp=document.querySelector('#pdfPart'),qp=document.querySelector('#qPart');pp.value=qp.value;qp.addEventListener('change',()=>{pp.value=qp.value;});pp.addEventListener('change',()=>{if(qp.value!==pp.value){qp.value=pp.value;qp.dispatchEvent(new Event('change'));}});
  document.querySelector('#pdfFile').onchange=e=>handlePdf(e.target.files[0]);
}
async function handlePdf(file){
  const out=document.querySelector('#pdfOut');if(!file)return;out.innerHTML='<p class="muted">Membaca PDF…</p>';
  try{
    const pages=await readPdfPages(file);const all=parsePdfQuestions(pages);const cnt={};all.forEach(q=>{cnt[q.page]=(cnt[q.page]||0)+1;});
    out.innerHTML=`<p><b>PDF ini punya ${pages.length} halaman.</b> Pilih halaman yang mau dimasukkan:</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px">${pages.map((_,i)=>`<label class="btn" style="cursor:pointer"><input type="checkbox" data-pg="${i+1}" ${cnt[i+1]?'checked':''}> Hal ${i+1}${cnt[i+1]?` · ${cnt[i+1]} soal`:' · tanpa soal'}</label>`).join('')}</div>
    <div style="display:flex;gap:8px;margin:8px 0"><input class="input" id="pgRange" placeholder="atau ketik: 1-3, 5"><button class="btn" type="button" id="pgRangeBtn">Pilih</button></div>
    <button class="btn red fullbtn" id="pgNext" type="button">Lanjut ke Pratinjau</button><div id="pdfPrev"></div>`;
    document.querySelector('#pgRangeBtn').onclick=()=>{const on=new Set();document.querySelector('#pgRange').value.split(',').forEach(t=>{const m=t.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(m)for(let n=+m[1];n<=+(m[2]||m[1]);n++)on.add(n);});document.querySelectorAll('[data-pg]').forEach(c=>{c.checked=on.has(+c.dataset.pg);});};
    document.querySelector('#pgNext').onclick=()=>{const sel=[...document.querySelectorAll('[data-pg]:checked')].map(c=>+c.dataset.pg);const qs=all.filter(q=>sel.includes(q.page)&&q.opts.length>=2);const prev=document.querySelector('#pdfPrev');
      if(!qs.length)return void(prev.innerHTML='<p class="muted">Tidak ada soal di halaman yang dipilih. Pastikan PDF berisi teks (bukan hasil scan/foto).</p>');showPdfPreview(qs,prev);};
  }catch(err){out.innerHTML=`<p class="muted">${esc(err.message||err)}</p>`;}
}
function showPdfPreview(qs,out){
  const secs=[...new Set(qs.map(q=>q.sec))];
  const cards=qs.map((q,i)=>`${(i===0||qs[i-1].page!==q.page)?`<h4 style="margin:14px 0 6px">Halaman ${q.page}</h4>`:''}<div class="list-row" style="display:block"><b>${esc(q.sec)} · No. ${q.num} <small>(hal. ${q.page})</small></b><div style="white-space:pre-wrap">${esc(q.stem||'(soal bergambar/audio — tambahkan foto atau audio setelah disimpan)')}</div>${q.opts.map((o,j)=>`<label style="display:block"><input type="radio" name="pq${i}" value="${j}" ${q.key==='abcd'[j]?'checked':''}> ${'abcd'[j]}. ${esc(o||'abcd'[j].toUpperCase())}</label>`).join('')}</div>`).join('');
  out.innerHTML=`<p><b>${qs.length} soal akan dimasukkan.</b> ${qs.some(q=>q.key)?'Kunci jawaban dari halaman KEY ANSWER sudah terisi, silakan cek/ubah.':'Isi kunci jawaban di bawah.'}</p>
  ${secs.map(s=>`<label>Kunci jawaban — ${esc(s)} <small>(contoh: 1A 2C 3B atau a c b d)</small><input class="input" data-keysec="${esc(s)}"></label>`).join('')}
  <button class="btn" id="pdfApply" type="button">Terapkan Kunci</button><div>${cards}</div><button class="btn red fullbtn" id="pdfSave" type="button">Simpan ${qs.length} Soal ke Part</button>`;
  document.querySelector('#pdfApply').onclick=()=>{document.querySelectorAll('[data-keysec]').forEach(inp=>{const k=parseKeyText(inp.value);qs.forEach((q,i)=>{if(q.sec===inp.dataset.keysec&&k[q.num]){const r=document.querySelector(`input[name=pq${i}][value="${'abcd'.indexOf(k[q.num])}"]`);if(r)r.checked=true;}});});};
  document.querySelector('#pdfSave').onclick=async()=>{
    const part=document.querySelector('#pdfPart').value;const missing=[];const rows=[];
    qs.forEach((q,i)=>{const s=document.querySelector(`input[name=pq${i}]:checked`);if(!s)return missing.push(`${q.sec} no.${q.num}`);const options=q.opts.map((o,j)=>o||'ABCD'[j]);rows.push({part_id:part,prompt:esc(q.stem||'').replace(/\n/g,'<br>'),type:'multiple_choice',options,answer:options[+s.value],reading:'',instruction:'',active:true,q_number:q.num,source_page:q.page});});
    if(missing.length)return alert('Kunci jawaban belum diisi untuk: '+missing.slice(0,8).join(', ')+(missing.length>8?` dan ${missing.length-8} lainnya`:''));
    const {error}=await supabase.from('questions').insert(rows);if(error)return alert(/q_number|source_page/.test(error.message)?'Jalankan dulu file supabase-soal-nomor.sql di Supabase (SQL Editor), lalu coba simpan lagi.':error.message);alert(`${rows.length} soal tersimpan, berurutan sesuai nomor di PDF.`);render();};
}

const optKey=(opts,ans)=>JSON.stringify((opts||[]).map(v=>String(v).trim()).sort())+'|'+String(ans||'').trim();
const optsArr=x=>{let o=x.options;if(typeof o==='string'){try{o=JSON.parse(o);}catch{o=[];}}return Array.isArray(o)?o:[];};
async function mergeDupes(list){
  const isPh=t=>/Lihat gambar/.test(t||'');const score=x=>(x.photo_url||x.audio_url?4:0)+(x.source_page!=null?2:0)+(((x.prompt||'').trim()&&!isPh(x.prompt))?1:0);
  const groups={};list.filter(x=>x.type==='multiple_choice').forEach(x=>{(groups[optKey(optsArr(x),x.answer)]=groups[optKey(optsArr(x),x.answer)]||[]).push(x);});
  let removed=0;
  for(const g of Object.values(groups).filter(g=>g.length>1)){
    const sorted=[...g].sort((a,b)=>score(b)-score(a)||String(a.created_at).localeCompare(String(b.created_at)));const keep=sorted[0];const patch={};
    for(const o of sorted.slice(1)){
      for(const f of ['photo_url','audio_url','media_url','media_type','source_page','q_number']){if((keep[f]===null||keep[f]===undefined||keep[f]==='')&&o[f]){patch[f]=o[f];keep[f]=o[f];}}
      if((!(keep.prompt||'').trim()||isPh(keep.prompt))&&(o.prompt||'').trim()&&!isPh(o.prompt)){patch.prompt=o.prompt;keep.prompt=o.prompt;}
    }
    if(isPh(keep.prompt)&&patch.prompt===undefined)patch.prompt='';
    if(Object.keys(patch).length){const {error}=await supabase.from('questions').update(patch).eq('id',keep.id);if(error)throw error;}
    const {error:de}=await supabase.from('questions').delete().in('id',sorted.slice(1).map(x=>x.id));if(de)throw de;removed+=sorted.length-1;
  }
  return removed;
}
async function syncPdf(file){
  if(!file)return;const part=document.querySelector('#pdfPart').value;if(!part)return alert('Pilih Part tujuan dulu.');
  const out=document.querySelector('#pdfOut');out.innerHTML='<p class="muted">Mencocokkan dengan PDF…</p>';
  try{
    const parsed=parsePdfQuestions(await readPdfPages(file)).filter(q=>q.opts.length>=2);
    const pk={};parsed.forEach(q=>{const ans=q.opts['abcd'.indexOf(q.key)];if(!ans)return;const k=optKey(q.opts,ans);(pk[k]=pk[k]||[]).push(q);});
    const {data:ex,error}=await supabase.from('questions').select('*').eq('part_id',part);if(error)throw error;
    let matched=0,unmatched=0;
    for(const x of ex||[]){
      if(x.type!=='multiple_choice')continue;const c=pk[optKey(optsArr(x),x.answer)];
      if(!c||c.length!==1){unmatched++;continue;}
      const {error:ue}=await supabase.from('questions').update({source_page:c[0].page,q_number:c[0].num}).eq('id',x.id);
      if(ue){if(/q_number|source_page/.test(ue.message))throw new Error('Jalankan dulu file supabase-soal-nomor.sql di Supabase (SQL Editor), lalu coba lagi.');throw ue;}
      matched++;
    }
    const {data:ex2}=await supabase.from('questions').select('*').eq('part_id',part);
    const removed=await mergeDupes(ex2||[]);
    const {data:ex3}=await supabase.from('questions').select('*').eq('part_id',part);
    const {data:oth}=await supabase.from('questions').select('*').neq('part_id',part).or('photo_url.not.is.null,audio_url.not.is.null');
    const mk={};(oth||[]).forEach(o=>{if(o.type!=='multiple_choice')return;const m=mk[optKey(optsArr(o),o.answer)]=mk[optKey(optsArr(o),o.answer)]||{};if(o.photo_url&&!m.photo_url)m.photo_url=o.photo_url;if(o.audio_url&&!m.audio_url)m.audio_url=o.audio_url;});
    let copied=0;
    for(const x of ex3||[]){const patch={};const m=x.type==='multiple_choice'?mk[optKey(optsArr(x),x.answer)]:null;
      if(m){if(m.photo_url&&!x.photo_url){patch.photo_url=m.photo_url;if(!x.media_url){patch.media_url=m.photo_url;patch.media_type='image';}}if(m.audio_url&&!x.audio_url)patch.audio_url=m.audio_url;}
      if(/Lihat gambar/.test(x.prompt||''))patch.prompt='';
      if(Object.keys(patch).length){const {error:pe}=await supabase.from('questions').update(patch).eq('id',x.id);if(pe)throw pe;if(patch.photo_url||patch.audio_url)copied++;}}
    sessionStorage.setItem('qPartSel',part);
    out.innerHTML='';alert(`${matched} soal dicocokkan dengan halaman & nomor PDF.\n${copied} foto/audio disalin dari soal yang sama di Part lain.\n${removed} salinan ganda digabung.\n${unmatched} soal tidak ditemukan di PDF (tetap di "Soal manual").`);render();
  }catch(err){out.innerHTML=`<p class="muted">${esc(err.message||err)}</p>`;}
}
async function questions(){const r=await questions0();injectPdfImport();return r;}
async function questions0(){
  const {data:parts}=await supabase.from('parts').select('*').order('part_number');
  const {data:qs}=await supabase.from('questions').select('*').order('created_at',{ascending:false});
  const renderList=(partId)=>{
    const rows=(qs||[]).filter(x=>!partId || String(x.part_id)===String(partId)).sort((a,b)=>{const pa=a.source_page??1e9,pb=b.source_page??1e9;if(pa!==pb)return pa-pb;const na=a.q_number??1e9,nb=b.q_number??1e9;if(na!==nb)return na-nb;return String(a.created_at||'').localeCompare(String(b.created_at||''));});
    const optsOf=x=>{let o=x.options;if(typeof o==='string'){try{o=JSON.parse(o);}catch{o=[];}}return Array.isArray(o)?o:[];};
    const groupsD={};rows.forEach(x=>{if(x.type!=='multiple_choice')return;const k=JSON.stringify(optsOf(x).map(v=>String(v).trim()).sort())+'|'+String(x.answer||'').trim();(groupsD[k]=groupsD[k]||[]).push(x);});
    const dupGroups=Object.values(groupsD).filter(g=>g.length>1);const dupCount=dupGroups.reduce((n,g)=>n+g.length-1,0);
    const dupBanner=dupCount?`<div class="card admin-card" style="margin-bottom:12px"><b>⚠ ${dupCount} soal ganda terdeteksi</b><p class="muted">Soal yang sama tersimpan lebih dari sekali (misalnya sebagian punya foto, sebagian tidak). Gabungkan supaya foto/audio dan halaman ikut terbawa ke satu soal, lalu salinannya dihapus.</p><button class="btn red" type="button" data-dedupe>🧹 Gabungkan Soal Ganda</button></div>`:'';
    const seq={};rows.forEach(x=>{const k=x.source_page??'m';seq[k]=(seq[k]||0)+1;x._no=seq[k];});
    const el=document.querySelector('#qList');
    const curPart=partId?(parts||[]).find(p=>String(p.id)===String(partId)):null;
    const countCard=`<div class="card admin-card" style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><div class="eyebrow">📊 JUMLAH SOAL</div><h3 style="margin:4px 0 0">${rows.length} soal <small class="muted">${curPart?`di ${esc(curPart.name||'Part')} (Part ${curPart.part_number})`:'di semua Part'}</small></h3></div>${curPart&&rows.length?'<button class="btn danger" type="button" id="delAllQ">🗑 Hapus Semua Soal di Part Ini</button>':''}${curPart?`<div style="flex-basis:100%;display:grid;gap:8px"><label>Nama Part <small class="muted">(judul yang dilihat user)</small><input id="partRename" class="input" value="${esc(curPart.name||'')}"></label><button class="btn red" type="button" id="partRenameSave">✏️ Simpan Nama Part</button></div>`:''}</div>`;
    const setupCard=(curPart&&rows.length)?`<div class="card admin-card" style="margin-bottom:14px"><div class="eyebrow">PART ${String(curPart.part_number||'').padStart(2,'0')}</div><h3 style="margin:4px 0 2px">${esc(curPart.name||'Part')} · ${rows.length} soal</h3><p class="muted" style="margin:0 0 10px">Pengaturan Soal &amp; Timer untuk Part ini</p><form id="partSetupForm">${partSetupHTML(curPart)}<button class="btn red fullbtn" type="submit">Simpan Pengaturan</button></form></div>`:'';
    if(el)el.innerHTML=countCard+setupCard+dupBanner+(rows.map((x,i)=>`${(i===0||rows[i-1].source_page!==x.source_page)?`<h4 style="margin:34px 0 8px;padding-top:14px;border-top:1px solid rgba(255,255,255,.12)">${x.source_page?`Halaman ${x.source_page}`:'Soal manual'}</h4>`:''}<div class="list-row" style="display:block" data-qrow="${x.id}"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><b>${x._no}. ${sanitizePromptHTML(x.prompt||'(tanpa teks — soal bergambar/audio)')}</b><span>${esc(x.type==='multiple_choice'?'Ganda':'Ketik')} · jawaban: ${esc(x.answer||'')}</span></div><div style="display:flex;gap:6px"><button class="btn" data-qedit="${x.id}">Edit</button><button class="btn danger" data-qdel="${x.id}">Hapus</button></div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><span class="media-pill ${x.photo_url?'':'muted-pill'}">📷 ${x.photo_url?'Foto tersimpan':'Belum ada foto'}</span><span class="media-pill ${x.audio_url?'':'muted-pill'}">🔊 ${x.audio_url?'Audio tersimpan':'Belum ada audio'}</span></div>
      ${x.photo_url?`<div style="margin-top:8px"><img src="${esc(x.photo_url)}" alt="Foto soal" loading="lazy" style="max-width:220px;border-radius:10px"></div>`:''}${x.audio_url?`<audio controls preload="metadata" src="${esc(x.audio_url)}" style="width:100%;margin-top:8px"></audio>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px"><label class="btn">📷 ${x.photo_url?'Ganti Foto':'Tambah Foto'}<input hidden type="file" accept="image/*" data-photo="${x.id}"></label><label class="btn">🔊 ${x.audio_url?'Ganti Audio':'Tambah Audio'}<input hidden type="file" accept="audio/*" data-audio="${x.id}"></label><span class="muted" data-fname>Belum ada file dipilih</span><button class="btn red" type="button" data-qsave="${x.id}">💾 Simpan Foto &amp; Audio</button></div>
      <div data-qeditbox="${x.id}" hidden></div></div>`).join('')||'<p class="muted">Belum ada soal untuk Part ini.</p>');
    {const rb=document.querySelector('#partRenameSave');if(rb&&curPart)rb.onclick=async()=>{const v=document.querySelector('#partRename').value.trim();if(!v)return alert('Nama Part tidak boleh kosong.');const {error}=await supabase.from('parts').update({name:v}).eq('id',curPart.id);if(error)return alert(error.message);alert('Nama Part tersimpan.');render();};}
    {const db=document.querySelector('#delAllQ');if(db&&curPart)db.onclick=async()=>{const n=rows.length;const t=prompt(`Hapus SEMUA ${n} soal di "${curPart.name}" (Part ${curPart.part_number})?\nTindakan ini tidak bisa dibatalkan.\n\nKetik HAPUS untuk melanjutkan:`);if(t===null)return;if(t.trim().toUpperCase()!=='HAPUS')return alert('Dibatalkan: kata konfirmasi tidak cocok.');const {error}=await supabase.from('questions').delete().eq('part_id',curPart.id);if(error)return alert(error.message);alert(`${n} soal berhasil dihapus.`);render();};}
    {const sf=document.querySelector('#partSetupForm');if(sf&&curPart){bindPartSetup(sf);sf.onsubmit=async e=>{e.preventDefault();const vals=readPartSetup(e.target);const {error,degraded}=await saveOptional(r=>supabase.from('parts').update(r).eq('id',curPart.id),vals,PART_OPT);if(error)alert(error.message);else if(!degraded){Object.assign(curPart,vals);alert('Pengaturan Part tersimpan.');}};}}
    document.querySelectorAll('[data-photo],[data-audio]').forEach(i=>i.onchange=()=>{const row=i.closest('[data-qrow]');const n=[...row.querySelectorAll('input[type=file]')].map(f=>f.files?.[0]?.name).filter(Boolean);row.querySelector('[data-fname]').textContent=n.length?n.join(' + '):'Belum ada file dipilih';});
    document.querySelectorAll('[data-qsave]').forEach(b=>b.onclick=async()=>{const row=b.closest('[data-qrow]');const ph=row.querySelector('[data-photo]'),au=row.querySelector('[data-audio]');if(!ph.files?.[0]&&!au.files?.[0])return alert('Pilih foto atau audio dulu, lalu tekan Simpan.');b.disabled=true;b.textContent='Menyimpan…';if(ph.files?.[0])await uploadMedia(ph,'photo');if(au.files?.[0])await uploadMedia(au,'audio');render();});
    document.querySelectorAll('[data-qedit]').forEach(b=>b.onclick=()=>{
      const x=rows.find(r=>String(r.id)===b.dataset.qedit);const box=document.querySelector(`[data-qeditbox="${x.id}"]`);const g=k=>box.querySelector(`[data-e="${k}"]`);
      const mc=x.type==='multiple_choice';const opts=Array.isArray(x.options)?x.options:[];
      box.hidden=false;box.innerHTML=`<div class="form-grid" style="margin-top:10px"><label>Halaman PDF<input class="input" type="number" min="1" data-e="page" value="${x.source_page??''}"></label><label>Nomor di PDF<input class="input" type="number" min="1" data-e="num" value="${x.q_number??''}"></label><label>Soal<div class="input" contenteditable="true" data-e="prompt" style="min-height:60px;white-space:pre-wrap">${sanitizePromptHTML(x.prompt||'')}</div></label>${mc?`<label>Pilihan (satu baris satu pilihan)<textarea class="input" rows="5" data-e="opts">${esc(opts.join('\n'))}</textarea></label><label>Jawaban benar<select class="input" data-e="ans">${opts.map(o=>`<option ${o===x.answer?'selected':''}>${esc(o)}</option>`).join('')}</select></label>`:`<label>Jawaban<input class="input" data-e="ans" value="${esc(x.answer||'')}"></label>`}<div style="display:flex;gap:8px"><button class="btn red" type="button" data-esave>Simpan Perubahan</button><button class="btn" type="button" data-ecancel>Batal</button></div></div>`;
      bindPromptToolbar(g('prompt'));
      if(mc){const ta=g('opts'),sel=g('ans');ta.oninput=()=>{const cur=sel.value;sel.innerHTML=ta.value.split('\n').map(v=>v.trim()).filter(Boolean).map(v=>`<option ${v===cur?'selected':''}>${esc(v)}</option>`).join('');};}
      box.querySelector('[data-ecancel]').onclick=()=>{box.hidden=true;box.innerHTML='';};
      box.querySelector('[data-esave]').onclick=async()=>{
        const patch={prompt:sanitizePromptHTML(g('prompt').innerHTML.trim())};
        if(mc){const o=g('opts').value.split('\n').map(v=>v.trim()).filter(Boolean);if(o.length<2)return alert('Minimal 2 pilihan.');patch.options=o;patch.answer=g('ans').value;if(!o.includes(patch.answer))return alert('Pilih jawaban benar.');}else patch.answer=g('ans').value.trim();
        const full={...patch,q_number:g('num').value?+g('num').value:null,source_page:g('page').value?+g('page').value:null};
        let {error}=await supabase.from('questions').update(full).eq('id',x.id);
        if(error&&/q_number|source_page/.test(error.message)){const r=await supabase.from('questions').update(patch).eq('id',x.id);error=r.error;if(!error)alert('Soal tersimpan, tetapi nomor/halaman belum bisa disimpan. Jalankan dulu supabase-soal-nomor.sql di Supabase.');}
        if(error)return alert(error.message);render();};
    });
    document.querySelector('[data-dedupe]')?.addEventListener('click',async()=>{
      if(!confirm(`Gabungkan ${dupCount} soal ganda? Salinan yang tidak dipakai akan dihapus.`))return;
      const isPh=t=>/Lihat gambar/.test(t||'');const score=x=>(x.photo_url||x.audio_url?4:0)+(x.source_page!=null?2:0)+(((x.prompt||'').trim()&&!isPh(x.prompt))?1:0);
      for(const g of dupGroups){
        const sorted=[...g].sort((a,b)=>score(b)-score(a)||String(a.created_at).localeCompare(String(b.created_at)));const keep=sorted[0];const patch={};
        for(const o of sorted.slice(1)){
          for(const f of ['photo_url','audio_url','media_url','media_type','source_page','q_number']){if((keep[f]===null||keep[f]===undefined||keep[f]==='')&&o[f]){patch[f]=o[f];keep[f]=o[f];}}
          if((!(keep.prompt||'').trim()||isPh(keep.prompt))&&(o.prompt||'').trim()&&!isPh(o.prompt)){patch.prompt=o.prompt;keep.prompt=o.prompt;}
        }
        if(isPh(keep.prompt)&&patch.prompt===undefined)patch.prompt='';
        if(Object.keys(patch).length){let {error}=await supabase.from('questions').update(patch).eq('id',keep.id);if(error&&/q_number|source_page/.test(error.message)){delete patch.q_number;delete patch.source_page;error=Object.keys(patch).length?(await supabase.from('questions').update(patch).eq('id',keep.id)).error:null;}if(error)return alert(error.message);}
        const {error:de}=await supabase.from('questions').delete().in('id',sorted.slice(1).map(x=>x.id));if(de)return alert(de.message);
      }
      render();});
    document.querySelectorAll('[data-qdel]').forEach(b=>b.onclick=async()=>{if(confirm('Hapus soal ini?')){const {error}=await supabase.from('questions').delete().eq('id',b.dataset.qdel);if(error)alert(error.message);else render();}});
  };
  app(`<div class="admin-header"><div><div class="eyebrow">SOAL</div><h1>Kelola Soal</h1><p class="muted">Pilih Part, lalu daftar soal dan pengaturan Soal &amp; Timer Part itu muncul di bawah.</p></div></div>
  <div class="card admin-card"><form id="qForm" class="form-grid">
    <label>Part<select class="input" name="part_id" id="qPart" required>${(parts||[]).map(p=>`<option value="${p.id}">Part ${p.part_number} — ${esc(p.name)}</option>`).join('')}</select></label>
    <label>Tipe<select class="input" name="type" id="qType"><option value="multiple_choice">Ganda</option><option value="typing">Ketik jawaban sendiri</option></select></label>
    <label class="full">Pertanyaan <small>(opsional)</small><div class="prompt-editor-wrap"><div id="promptEditor" class="textarea prompt-editor" contenteditable="true" data-placeholder="Tulis pertanyaan..."></div></div><input type="hidden" name="prompt" id="promptValue"></label>
    <label>Jawaban benar <small>(opsional)</small><input class="input" name="answer"></label>
    <label id="optionsField">Pilihan <small>(opsional)</small><input class="input" name="options" placeholder="Makan;Minum;Tidur"></label>
    <label>Reading <small>(opsional)</small><input class="input" name="reading"></label>
    <label class="full">Penjelasan <small>(opsional)</small><input class="input" name="instruction"></label>
    <label>Foto soal <small>(opsional)</small><input class="input" type="file" name="photo" accept="image/*"></label>
    <label>Audio soal <small>(opsional)</small><input class="input" type="file" name="audio" accept="audio/*"></label>
    <button class="btn red full" type="submit">Tambah Soal</button>
  </form></div>
  <div class="card admin-card table-list" id="qList"></div>`);
  const editor=document.querySelector('#promptEditor'); bindPromptToolbar(editor);
  const typeEl=document.querySelector('#qType'), optField=document.querySelector('#optionsField');
  const syncType=()=>{optField.style.display=typeEl.value==='multiple_choice'?'':'none';};
  typeEl.onchange=syncType; syncType();
  {const sel=document.querySelector('#qPart');const saved=sessionStorage.getItem('qPartSel');if(saved&&[...sel.options].some(o=>o.value===saved))sel.value=saved;sel.onchange=e=>{sessionStorage.setItem('qPartSel',e.target.value);renderList(e.target.value);};renderList(sel.value);}
  document.querySelector('#qForm').onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(e.target), type=fd.get('type'), prompt=sanitizePromptHTML(editor.innerHTML.trim());
    const id=(crypto?.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`);
    let options=[];
    if(type==='multiple_choice') options=String(fd.get('options')||'').split(';').map(s=>s.trim()).filter(Boolean);
    const row={id,part_id:fd.get('part_id'),prompt,reading:String(fd.get('reading')||''),instruction:String(fd.get('instruction')||''),type,options,answer:String(fd.get('answer')||'')};
    const {error}=await supabase.from('questions').insert(row);
    if(error){alert(error.message);return;}
    for(const [field,kind,col] of [['photo','photo','photo_url'],['audio','audio','audio_url']]){
      const file=fd.get(field);
      if(file instanceof File && file.size){
        const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
        const path=`questions/${id}/${Date.now()}-${safe}`;
        const up=await supabase.storage.from('media').upload(path,file,{upsert:true,contentType:file.type||undefined});
        if(up.error){alert(`${kind==='photo'?'Foto':'Audio'} gagal diupload: ${up.error.message}`);continue;}
        const {data:urlData}=supabase.storage.from('media').getPublicUrl(path);
        const patch=kind==='photo'?{photo_url:urlData?.publicUrl||'',media_url:urlData?.publicUrl||'',media_type:'image'}:{audio_url:urlData?.publicUrl||'',media_url:urlData?.publicUrl||'',media_type:'audio'};
        const up2=await supabase.from('questions').update(patch).eq('id',id);
        if(up2.error)alert(`Media ter-upload tetapi gagal ditautkan: ${up2.error.message}`);
      }
    }
    render();
  };
}
async function quick(){
  const {data:parts}=await supabase.from('parts').select('*').order('part_number');
  app(`<div class="admin-header"><div><div class="eyebrow">QUICK SOAL</div><h1>Import Cepat</h1><p class="muted">Import teks dulu. Setelah masuk, pilih Part untuk melihat dan mengelola semua soalnya.</p></div></div>
  <div class="card admin-card"><textarea id="quickText" class="textarea" rows="13" placeholder="1. 食べる|Makan|ganda|Makan;Minum;Tidur;Pergi\n\n2. 飲む|Minum|ketik"></textarea><select id="quickPart" class="input"><option value="">Pilih Part</option>${(parts||[]).map(p=>`<option value="${p.id}">Part ${p.part_number} — ${esc(p.name)}</option>`).join('')}</select><button id="quickImport" class="btn red">Import Soal</button></div><div id="quickList"></div>`);
  document.querySelector('#quickImport').onclick=()=>doQuickImport();
  document.querySelector('#quickPart').onchange=async()=>{const id=document.querySelector('#quickPart').value;if(id){const {data}=await supabase.from('questions').select('*').eq('part_id',id).order('created_at',{ascending:true});renderQuickList(data||[],'Semua Soal di Part');}else document.querySelector('#quickList').innerHTML='';};
}
function parseQuick(text){return text.split(/\n/).map(s=>s.trim()).filter(Boolean).map(line=>{line=line.replace(/^\s*\d+[.)]\s*/,'');const [prompt,answer,typeRaw,optionsRaw]=line.split('|');const type=typeMap[(typeRaw||'').trim().toLowerCase()]||'multiple_choice';let options=[];const finalAnswer=(answer||'').trim();if(type==='multiple_choice'){if(optionsRaw)options=optionsRaw.split(';').map(s=>s.trim()).filter(Boolean);else if(finalAnswer)options.push(finalAnswer);}return {prompt:(prompt||'').trim(),answer:finalAnswer,type,options};}).filter(x=>x.prompt&&x.answer&&x.type);}
async function doQuickImport(){const part=document.querySelector('#quickPart').value;if(!part)return alert('Pilih Part terlebih dahulu.');const rows=parseQuick(document.querySelector('#quickText').value);if(!rows.length)return alert('Format Quick Soal belum menghasilkan soal.');const {data,error}=await supabase.from('questions').insert(rows.map(x=>({...x,part_id:part,active:true,instruction:x.type==='typing'?'':undefined}))).select();if(error)return alert(error.message);renderQuickList(data||[]);}
function renderQuickList(rows,title='Soal yang berhasil diimport'){
  document.querySelector('#quickList').innerHTML=`<div class="card admin-card"><div class="admin-list-head"><h2>${esc(title)}</h2><span class="muted">${rows.length} soal</span></div>${rows.map((x,i)=>`<article class="media-row quick-question-row" data-row="${x.id}"><div><b>${i+1}. ${esc(x.prompt)}</b><small>${esc(x.type)} · ${esc(x.answer)} ${x.photo_url?'· 📷':''} ${x.audio_url?'· 🔊':''}</small></div><div class="media-actions"><label class="btn">📷 ${x.photo_url?'Ganti':'Tambah'} Foto<input hidden type="file" accept="image/*" data-photo="${x.id}"></label><label class="btn">🔊 ${x.audio_url?'Ganti':'Tambah'} Audio<input hidden type="file" accept="audio/*" data-audio="${x.id}"></label><button class="btn danger" data-quick-qdel="${x.id}">Hapus</button></div></article>`).join('')||'<p class="muted">Belum ada soal di Part ini.</p>'}</div>`;
  document.querySelectorAll('[data-photo]').forEach(i=>i.onchange=()=>uploadMedia(i,'photo'));
  document.querySelectorAll('[data-audio]').forEach(i=>i.onchange=()=>uploadMedia(i,'audio'));
  document.querySelectorAll('[data-quick-qdel]').forEach(b=>b.onclick=async()=>{if(confirm('Hapus soal ini?')){const {error}=await supabase.from('questions').delete().eq('id',b.dataset.quickQdel);if(error)alert(error.message);else document.querySelector('#quickPart').dispatchEvent(new Event('change'));}});
}
async function uploadMedia(input,kind){
  const file=input.files?.[0];
  if(!file)return;
  const id=input.dataset[kind]||input.dataset[`part${kind[0].toUpperCase()}${kind.slice(1)}`];
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const path=`questions/${id}/${Date.now()}-${safe}`;
  const {error:uploadError}=await supabase.storage.from('media').upload(path,file,{upsert:true,contentType:file.type||undefined});
  if(uploadError)return alert(`Upload gagal: ${uploadError.message}`);
  const {data:urlData}=supabase.storage.from('media').getPublicUrl(path);
  const publicUrl=urlData?.publicUrl||'';
  if(!publicUrl)return alert('URL media tidak berhasil dibuat.');
  const patch=kind==='photo'
    ?{photo_url:publicUrl,media_url:publicUrl,media_type:'image'}
    :{audio_url:publicUrl,media_url:publicUrl,media_type:'audio'};
  const {data:saved,error:updateError}=await supabase.from('questions').update(patch).eq('id',id).select('id,photo_url,audio_url,media_url,media_type').single();
  if(updateError)return alert(`Media ter-upload, tetapi data soal gagal disimpan: ${updateError.message}`);
  const ok=kind==='photo'?saved?.photo_url===publicUrl:saved?.audio_url===publicUrl;
  if(!ok)return alert('Media sudah ter-upload tetapi URL belum tersimpan pada soal. Coba upload ulang.');
  const note=input.closest('.media-row')?.querySelector('small'); if(note)note.textContent=`${kind==='photo'?'📷 Foto':'🔊 Audio'} tersimpan dan terhubung ke soal.`;
  input.value='';
}
async function timer(){
  const {data}=await supabase.from('timer_settings').select('*').eq('id',1).maybeSingle();
  const t=data||{enabled:false,global_seconds:0,per_part:{},per_question:{}};
  const pp=parse(t.per_part||'{}')||{};
  const pq=parse(t.per_question||'{}')||{};
  const secParts=k=>Number(pp[String(k)]||0);
  const minSec=(sec)=>{sec=Math.max(0,Number(sec)||0);return {m:Math.floor(sec/60),s:sec%60};};
  const testSeconds=k=>Number(pq[`__test_${k}`]||0);
  const field=(key,label)=>{const x=minSec(testSeconds(key));return `<div class="timer-test-row"><div><b>${label}</b><p class="muted">0 = tanpa batas waktu.</p></div><div class="timer-test-fields"><label>Menit<input class="input" type="number" min="0" name="${key}_min" value="${x.m}" inputmode="numeric"></label><label>Detik<input class="input" type="number" min="0" max="59" name="${key}_sec" value="${x.s}" inputmode="numeric"></label></div></div>`;};
  const global=minSec(t.global_seconds);
  const partRows=Array.from({length:20},(_,i)=>{const n=i+1,x=minSec(secParts(n));return `<div class="timer-part-row"><b>Part ${n}</b><label>Menit<input class="input" type="number" min="0" name="part_${n}_min" value="${x.m}" inputmode="numeric"></label><label>Detik<input class="input" type="number" min="0" max="59" name="part_${n}_sec" value="${x.s}" inputmode="numeric"></label></div>`}).join('');
  app(`<div class="admin-header"><div><div class="eyebrow">TIME CONTROL</div><h1>Kelola Timer</h1><p class="muted">Sekarang cukup isi menit dan detik. Tidak perlu menulis JSON.</p></div></div>
  <div class="card admin-card"><h2>📝 Timer Tes</h2><p class="muted">Atur batas waktu yang akan dipakai user. Timer Test Kotoba juga berlaku untuk <b>Test Pilihan Kosakata</b>.</p><form id="testTimerForm">${field('hiragana_46','Tes Hiragana · 46 soal')}${field('katakana_46','Tes Katakana · 46 soal')}${field('kotoba','Test Kotoba / Test Pilihan Kosakata')}<button class="btn red" type="submit">Simpan Timer Tes</button></form></div>
  <div class="card admin-card"><h2>⏱️ Timer Latihan</h2><form id="simpleTimerForm"><label class="check-line"><input type="checkbox" name="enabled" ${t.enabled?'checked':''}> Aktifkan timer latihan</label><div class="timer-simple-global"><label>Waktu global · Menit<input class="input" type="number" min="0" name="global_min" value="${global.m}" inputmode="numeric"></label><label>Detik<input class="input" type="number" min="0" max="59" name="global_sec" value="${global.s}" inputmode="numeric"></label></div><p class="muted">Waktu global dipakai sebagai timer utama jika tidak ada timer khusus Part.</p><h3 class="timer-section-title">Waktu tiap Part</h3><div class="timer-part-grid">${partRows}</div><button class="btn red" type="submit">Simpan Timer Latihan</button></form></div>
  <details class="card admin-card timer-advanced"><summary><b>⚙️ Pengaturan Lanjutan</b><span class="muted">Untuk timer soal khusus yang sudah kamu pakai sebelumnya</span></summary><p class="muted">Bagian ini tidak perlu disentuh untuk penggunaan normal. Data lama tetap dipertahankan.</p><label>Timer Soal JSON<textarea class="textarea" id="advancedQuestionTimer">${esc(JSON.stringify(Object.fromEntries(Object.entries(pq).filter(([k])=>!k.startsWith('__test_'))),null,2))}</textarea></label><button class="btn" id="saveAdvancedTimer" type="button">Simpan Timer Soal Lanjutan</button></details>`);
  document.querySelector('#testTimerForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const next={...pq};for(const key of ['hiragana_46','katakana_46','kotoba']){const m=Number(fd.get(`${key}_min`)||0),sc=Number(fd.get(`${key}_sec`)||0);if(!Number.isFinite(m)||!Number.isFinite(sc)||m<0||sc<0||sc>59)return alert(`Waktu ${key} tidak valid.`);const total=Math.round(m*60+sc);if(total>0)next[`__test_${key}`]=total;else delete next[`__test_${key}`];}const {error}=await supabase.from('timer_settings').upsert({id:1,enabled:t.enabled,global_seconds:Number(t.global_seconds||0),per_part:pp,per_question:next});alert(error?error.message:'Timer Tes berhasil disimpan.');};
  document.querySelector('#simpleTimerForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const nextPP={...pp};const gm=Number(fd.get('global_min')||0),gs=Number(fd.get('global_sec')||0);if(!Number.isFinite(gm)||!Number.isFinite(gs)||gm<0||gs<0||gs>59)return alert('Waktu global tidak valid.');for(let n=1;n<=20;n++){const m=Number(fd.get(`part_${n}_min`)||0),sc=Number(fd.get(`part_${n}_sec`)||0);if(!Number.isFinite(m)||!Number.isFinite(sc)||m<0||sc<0||sc>59)return alert(`Waktu Part ${n} tidak valid.`);const total=Math.round(m*60+sc);if(total>0)nextPP[String(n)]=total;else delete nextPP[String(n)];}const {error}=await supabase.from('timer_settings').upsert({id:1,enabled:fd.has('enabled'),global_seconds:Math.round(gm*60+gs),per_part:nextPP,per_question:pq});alert(error?'Gagal menyimpan: '+error.message:'Timer Latihan berhasil disimpan.');};
  document.querySelector('#saveAdvancedTimer').onclick=async()=>{let advanced;try{advanced=JSON.parse(document.querySelector('#advancedQuestionTimer').value||'{}');if(!advanced||Array.isArray(advanced))throw 0;}catch{return alert('JSON timer soal tidak valid.');}const nextPQ={...Object.fromEntries(Object.entries(pq).filter(([k])=>k.startsWith('__test_'))),...advanced};const {error}=await supabase.from('timer_settings').upsert({id:1,enabled:t.enabled,global_seconds:Number(t.global_seconds||0),per_part:pp,per_question:nextPQ});alert(error?'Gagal menyimpan: '+error.message:'Timer soal lanjutan berhasil disimpan.');};
}

async function users(){
  const {data,error}=await supabase.rpc('admin_list_users');
  if(error){app(`<div class="admin-header"><div><div class="eyebrow">USER MONITOR</div><h1>User</h1><p class="muted">Jalankan <b>supabase-user-monitor.sql</b> di Supabase terlebih dahulu.</p></div></div><div class="card admin-card alert">${esc(error.message)}</div>`);return;}
  const rows=Array.isArray(data)?data:[];
  let seen=[];try{seen=JSON.parse(localStorage.getItem('itco_seen_users')||'[]')}catch{}
  const ids=rows.map(x=>x.user_id);const fresh=rows.filter(x=>!seen.includes(x.user_id));
  if(rows.length){try{localStorage.setItem('itco_seen_users',JSON.stringify(ids));}catch{}}
  const online=rows.filter(x=>x.online).length;
  app(`<div class="admin-header"><div><div class="eyebrow">USER MONITOR</div><h1>User</h1><p class="muted">Pantau akun, login, perangkat, aktivitas, dan hasil latihan. Daftar diperbarui otomatis.</p></div></div>${fresh.length?`<div class="user-new-notice">🔔 <b>USER BARU</b><span>${fresh.map(x=>`${esc(x.name||x.email)} · ${esc(x.email)}`).join('<br>')}</span></div>`:''}<div class="user-stat-row"><div class="stat-card"><b>${rows.length}</b><span>Total User</span></div><div class="stat-card"><b>${online}</b><span>Online</span></div><div class="stat-card"><b>${rows.filter(x=>new Date(x.created_at)>new Date(Date.now()-86400000)).length}</b><span>User Baru 24 Jam</span></div></div><div class="toolbar user-toolbar"><input id="userSearch" class="input" placeholder="Cari nama atau email..."><select id="userFilter" class="input"><option value="all">Semua</option><option value="online">🟢 Online</option><option value="offline">⚪ Offline</option><option value="disabled">⛔ Dinonaktifkan</option></select></div><div id="userList" class="user-list"></div>`);
  const renderList=()=>{const q=String(document.querySelector('#userSearch')?.value||'').toLowerCase().trim(),f=document.querySelector('#userFilter')?.value||'all';const filtered=rows.filter(x=>(!q||`${x.name} ${x.email}`.toLowerCase().includes(q))&&(f==='all'||(f==='online'&&x.online)||(f==='offline'&&!x.online&&!x.disabled)||(f==='disabled'&&x.disabled)));document.querySelector('#userList').innerHTML=filtered.map(x=>`<button type="button" class="user-row ${x.online?'is-online':''}" data-user-id="${esc(x.user_id)}"><span class="user-avatar">${esc((x.name||x.email||'?')[0].toUpperCase())}</span><span class="user-main"><b>${esc(x.name||'Tanpa nama')}</b><small>${esc(x.email)}</small><span>${x.online?'🟢 Online':'⚪ Offline'} · ${x.disabled?'⛔ Dinonaktifkan':'Aktif'} · ${x.last_device?esc(x.last_device):'Device belum tercatat'}</span></span><span class="user-meta"><b>${x.login_count||0}</b><small>Masuk</small><b>${Number(x.result_count||0)+Number(x.assessment_count||0)}</b><small>Hasil</small></span></button>`).join('')||'<div class="empty">User tidak ditemukan.</div>';document.querySelectorAll('[data-user-id]').forEach(b=>b.onclick=()=>userDetail(b.dataset.userId));};
  document.querySelector('#userSearch').oninput=renderList;document.querySelector('#userFilter').onchange=renderList;renderList();
  userRefreshTimer=setInterval(()=>{if(current==='users'&&!selectedUserId)users();},10000);
}

async function userDetail(id){
  selectedUserId=id; const {data,error}=await supabase.rpc('admin_get_user_detail',{p_user_id:id});
  if(error){selectedUserId=null;alert(error.message);return users();}
  const p=data?.profile||{},pr=data?.presence||{},logins=data?.logins||[],acts=data?.activities||[],results=data?.results||[],assess=data?.assessments||[],devices=data?.devices||[];
  const online=!!(pr?.last_seen_at&&new Date(pr.last_seen_at)>new Date(Date.now()-45000));
  app(`<div class="admin-header"><button class="btn" id="backUsers">← Kembali ke User</button><div><div class="eyebrow">USER DETAIL</div><h1>${esc(p.name||'Tanpa nama')}</h1><p class="muted">${esc(p.email||'')}</p></div></div><div class="user-detail-grid"><div class="card admin-card user-profile-card"><div class="user-detail-avatar">${esc((p.name||p.email||'?')[0].toUpperCase())}</div><div class="user-status ${online?'online':'offline'}">${online?'🟢 ONLINE':'⚪ OFFLINE'}</div><h2>${esc(p.name||'Tanpa nama')}</h2><p class="muted">${esc(p.email||'')}</p><div class="detail-grid"><span>Akun dibuat<b>${p.created_at?new Date(p.created_at).toLocaleString('id-ID'):'—'}</b></span><span>Masuk terakhir<b>${p.last_login_at?new Date(p.last_login_at).toLocaleString('id-ID'):'Belum pernah'}</b></span><span>Terakhir aktif<b>${p.last_seen_at?new Date(p.last_seen_at).toLocaleString('id-ID'):'—'}</b></span><span>Total login<b>${p.login_count||0}</b></span><span>Device terakhir<b>${esc(p.last_device||'—')}</b></span><span>Halaman terakhir<b>${esc(pr.page||'—')}</b></span></div><div class="user-actions"><button class="btn" id="toggleUser">${p.disabled?'Aktifkan Akun':'Nonaktifkan Akun'}</button><button class="btn danger" id="deleteUser">Hapus Akun</button></div></div><div class="card admin-card"><h2>Perangkat</h2><div class="device-list">${devices.map(d=>`<span>${esc(d)}</span>`).join('')||'<p class="muted">Belum ada data device.</p>'}</div><h2>Statistik</h2><div class="user-stat-mini"><span><b>${results.length}</b>Latihan</span><span><b>${assess.length}</b>Tes</span><span><b>${results.length+assess.length}</b>Total Hasil</span></div></div></div><div class="card admin-card"><h2>Riwayat Masuk</h2><div class="timeline">${logins.map(x=>`<div><b>🟢 Masuk</b><span>${new Date(x.login_at).toLocaleString('id-ID')} · ${esc(x.device||'Device tidak diketahui')}</span><small>${x.logout_at?`Logout ${new Date(x.logout_at).toLocaleString('id-ID')}`:'Session belum logout'}</small></div>`).join('')||'<p class="muted">Belum ada riwayat login.</p>'}</div></div><details class="card admin-card activity-collapse"><summary><span><h2>Aktivitas Terbaru</h2><small>${acts.length} aktivitas tersimpan · ketuk untuk melihat</small></span><b>＋</b></summary><div class="timeline">${acts.map(x=>`<div><b>${esc(x.action)}</b><span>${new Date(x.created_at).toLocaleString('id-ID')} · ${esc(x.page||'')}</span><small>${esc(JSON.stringify(x.detail||{}))}</small></div>`).join('')||'<p class="muted">Belum ada aktivitas.</p>'}</div></details><div class="card admin-card"><h2>Hasil Latihan</h2><div class="table-list">${results.map(x=>`<details class="user-result-detail"><summary><b>${esc(x.part_name||'Latihan')}</b> · Nilai ${x.score} · ${new Date(x.created_at).toLocaleString('id-ID')}</summary><p>Benar ${x.correct_count} · Salah ${x.wrong_count} · Tidak dijawab ${x.unanswered_count}</p><div class="review-list">${(Array.isArray(x.details)?x.details:[]).map((r,i)=>`<article class="review ${r.correct?'ok':'bad'}"><b>${i+1}. ${esc(r.question||'')}</b><span>Jawaban: ${esc(r.user_answer)||'—'}</span><span>Benar: ${esc(r.correct_answer)||'—'}</span></article>`).join('')}</div></details>`).join('')||'<p class="muted">Belum ada hasil latihan.</p>'}</div></div><div class="card admin-card"><h2>Tes Kana</h2><div class="table-list">${assess.filter(x=>x.test_type!=='kotoba').map(x=>{const kanaLabel=x.test_type==='katakana_46'?'KATAKANA':'HIRAGANA';return `<details class="user-result-detail"><summary><b>TES ${kanaLabel} · 46</b> · Nilai ${x.score} · ${new Date(x.created_at).toLocaleString('id-ID')}</summary><p>Benar ${x.correct_count} · Salah ${x.wrong_count} · Tidak dijawab ${x.unanswered_count} · Waktu ${Math.floor((x.duration_seconds||0)/60)}m ${(x.duration_seconds||0)%60}s</p><div class="review-list">${(Array.isArray(x.details)?x.details:[]).map(r=>`<article class="review ${r.correct?'ok':'bad'}"><b>${r.number}. ${esc(r.kana||r.hiragana||'')} ↔ ${esc(r.romaji)}</b><span>Jawaban: ${esc(r.user_answer)||'—'}</span><span>Benar: ${esc(r.correct_answer)}</span></article>`).join('')}</div></details>`}).join('')||'<p class="muted">Belum ada Tes Kana.</p>'}</div></div><div class="card admin-card"><h2>Test Kotoba</h2><div class="table-list">${assess.filter(x=>x.test_type==='kotoba').map(x=>`<details class="user-result-detail"><summary><b>TEST KOTOBA</b> · Nilai ${x.score} · ${new Date(x.created_at).toLocaleString('id-ID')}</summary><p>Benar ${x.correct_count} · Salah ${x.wrong_count} · Tidak dijawab ${x.unanswered_count} · Waktu ${Math.floor((x.duration_seconds||0)/60)}m ${(x.duration_seconds||0)%60}s</p><div class="review-list">${(Array.isArray(x.details)?x.details:[]).map((r,i)=>`<article class="review ${r.correct?'ok':'bad'}"><b>${i+1}. ${esc(r.japanese||'')} · ${esc(r.romaji||'')}</b><span>Arti: ${esc(r.meaning||'')}</span><span>Jawaban: ${esc(r.user_answer)||'—'}</span><span>Benar: ${esc(r.direction==='jp_id'?r.meaning:r.romaji)||'—'}</span></article>`).join('')}</div></details>`).join('')||'<p class="muted">Belum ada Test Kotoba.</p>'}</div></div>`);
  document.querySelector('#backUsers').onclick=()=>{selectedUserId=null;render();};
  document.querySelector('#toggleUser').onclick=async()=>{const disabled=!p.disabled;if(!confirm(disabled?'Nonaktifkan akun ini?':'Aktifkan kembali akun ini?'))return;const r=await supabase.rpc('admin_set_user_disabled',{p_user_id:id,p_disabled:disabled});if(r.error)alert(r.error.message);else userDetail(id);};
  document.querySelector('#deleteUser').onclick=async()=>{if(!confirm('Hapus akun ini secara permanen? Data terkait user akan ikut terhapus.'))return;const r=await supabase.rpc('admin_delete_user',{p_user_id:id});if(r.error)alert(r.error.message);else{selectedUserId=null;render();}};
  userRefreshTimer=setInterval(()=>{if(current==='users'&&selectedUserId)userDetail(selectedUserId);},10000);
}

async function results(){const {data}=await supabase.from('results').select('*,parts(name,part_number)').order('created_at',{ascending:false});app(`<div class="admin-header"><div><div class="eyebrow">RESULTS</div><h1>Hasil</h1></div></div><div class="toolbar"><button id="resetResults" class="btn danger">Reset Statistik</button></div><div class="card admin-card table-list">${(data||[]).map(x=>`<div class="list-row"><div><b>${esc(x.name)} · ${esc(x.parts?.name||'Part')}</b><span>Nilai ${x.score} · Benar ${x.correct_count} · Salah ${x.wrong_count} · Tidak dijawab ${x.unanswered_count} · ${new Date(x.created_at).toLocaleString('id-ID')}</span></div></div>`).join('')||'<p class="muted">Belum ada hasil.</p>'}</div>`);document.querySelector('#resetResults').onclick=async()=>{if(confirm('Hapus semua hasil? Nama tetap disimpan.')){const {error}=await supabase.from('results').delete().neq('id','00000000-0000-0000-0000-000000000000');if(error)alert(error.message);else render();}};}
async function messages(){
  const {data,error}=await supabase.from('branding').select('message_enabled,message_title,message_body,maintenance_enabled,maintenance_title,maintenance_body').eq('id',1).maybeSingle();
  if(error){app(`<div class="admin-header"><div><div class="eyebrow">SITE NOTICE</div><h1>Pesan & Maintenance</h1></div></div><div class="card admin-card"><div class="alert">${esc(error.message)}</div><p class="muted">Jalankan SQL update database dari menu Dashboard terlebih dahulu.</p></div>`);return;}
  const x=data||{};
  app(`<div class="admin-header"><div><div class="eyebrow">SITE NOTICE</div><h1>Pesan & Maintenance</h1><p class="muted">Atur pesan update yang terlihat oleh pengunjung dan aktifkan mode maintenance saat website sedang diperbaiki.</p></div></div><form id="noticeForm" class="card admin-card form-grid"><div class="full notice-section"><h2>📢 Pesan Terbaru</h2><p class="muted">Tombol “Pesan” muncul di kanan atas website. Pengunjung dapat membukanya untuk melihat informasi terbaru.</p><label class="check-line"><input type="checkbox" name="message_enabled" ${x.message_enabled?'checked':''}> Aktifkan pesan terbaru</label><label class="full">Judul pesan<input class="input" name="message_title" value="${esc(x.message_title||'Informasi Terbaru')}" placeholder="Informasi Terbaru"></label><label class="full">Isi pesan<textarea class="textarea" name="message_body" rows="6" placeholder="Tulis informasi update website di sini...">${esc(x.message_body||'')}</textarea></label></div><div class="full notice-section"><h2>🛠 Maintenance</h2><p class="muted">Saat diaktifkan, seluruh halaman publik akan menampilkan halaman perbaikan. Admin Panel tetap dapat digunakan.</p><label class="check-line"><input type="checkbox" name="maintenance_enabled" ${x.maintenance_enabled?'checked':''}> Aktifkan Maintenance</label><label class="full">Judul Maintenance<input class="input" name="maintenance_title" value="${esc(x.maintenance_title||'Website Sedang Dalam Perbaikan')}" placeholder="Website Sedang Dalam Perbaikan"></label><label class="full">Pesan Maintenance<textarea class="textarea" name="maintenance_body" rows="6" placeholder="Website sedang dalam proses perbaikan. Mohon tunggu sebentar...">${esc(x.maintenance_body||'Website sedang dalam proses perbaikan dan pembaruan. Mohon tunggu sebentar, kami akan segera kembali.')}</textarea></label></div><button class="btn red full" type="submit">Simpan Pengaturan</button></form>`);
  document.querySelector('#noticeForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const row={id:1,message_enabled:fd.has('message_enabled'),message_title:String(fd.get('message_title')||'').trim(),message_body:String(fd.get('message_body')||''),maintenance_enabled:fd.has('maintenance_enabled'),maintenance_title:String(fd.get('maintenance_title')||'').trim(),maintenance_body:String(fd.get('maintenance_body')||'')};const r=await supabase.from('branding').upsert(row);alert(r.error?r.error.message:'Pengaturan Pesan & Maintenance berhasil disimpan.');if(!r.error)render();};
}
const RESULT_DEFAULTS={enabled:true,count:34,tiers:[
{min:100,icon:'👑',title:'SEMPURNA! Nilai 100!',sub:'Tanpa satu pun salah. Kamu luar biasa, sensei bangga! 🎌',emoji:'🎉 🏆 👏 🔥 🌟 💯 🥳 ✨ 🎊 👑 🤩 🙌',color:'#f5c542'},
{min:90,icon:'🏆',title:'Luar biasa! Kamu jago banget!',sub:'Nilai hampir sempurna. Satu langkah lagi menuju 100!',emoji:'🎉 🏆 👏 🔥 🌟 🥳 ✨ 🙌',color:'#f59e0b'},
{min:70,icon:'😎',title:'Bagus! Sedikit lagi sempurna!',sub:'Hasil yang keren, tinggal rapikan sedikit lagi. 👍',emoji:'👍 😎 🔥 👏 ⭐ 🙌 😄 💪 🎯',color:'#34d399'},
{min:50,icon:'💪',title:'Lumayan, ayo tingkatkan!',sub:'Cek review di bawah, nilai berikutnya pasti naik.',emoji:'💪 🙂 📚 😅 ✍️ 🤔 📝 🌱',color:'#60a5fa'},
{min:0,icon:'🤡',title:'Waduh... belajar lagi ya!',sub:'Tenang, semua orang pernah begini. Baca review di bawah, lalu coba lagi! 😜',emoji:'🤣 😹 🤡 💀 😝 🫵 🙈 😂 🤪 🥲 🫣 😆',color:'#f43f5e'}
]};
function normResultCfg(v){let o=v;if(typeof o==='string'){try{o=JSON.parse(o);}catch{o=null;}}o=o&&typeof o==='object'&&!Array.isArray(o)?o:{};const t=Array.isArray(o.tiers)&&o.tiers.length?o.tiers:RESULT_DEFAULTS.tiers;return {enabled:o.enabled!==false,count:Number.isFinite(Number(o.count))&&o.count!==null&&o.count!==''&&o.count!==undefined?Math.min(80,Math.max(0,Math.round(Number(o.count)))):RESULT_DEFAULTS.count,tiers:t.map(x=>({min:Math.min(100,Math.max(0,Number(x.min)||0)),icon:String(x.icon||''),title:String(x.title||''),sub:String(x.sub||''),emoji:String(x.emoji||''),color:/^#[0-9a-f]{6}$/i.test(String(x.color||''))?x.color:'#f5c542'}))};}

async function nilai(){
  const {data:br}=await supabase.from('branding').select('result_settings').eq('id',1).maybeSingle();
  let cfg=normResultCfg(br?.result_settings);
  const collect=()=>{cfg.enabled=document.querySelector('#rsEnabled').checked;cfg.count=Math.min(80,Math.max(0,Math.round(Number(document.querySelector('#rsCount').value)||0)));cfg.tiers=[...document.querySelectorAll('[data-tier]')].map(c=>{const g=k=>c.querySelector(`[data-f="${k}"]`).value;return {min:Math.min(100,Math.max(0,Number(g('min'))||0)),icon:g('icon').trim(),title:g('title').trim(),sub:g('sub').trim(),emoji:g('emoji').trim(),color:g('color')};});};
  const draw=()=>{
    app(`<div class="admin-header"><div><div class="eyebrow">NILAI</div><h1>Pengaturan Nilai</h1><p class="muted">Atur tampilan hasil setelah user selesai mengerjakan soal: nilai minimum tiap tingkat, emote, judul, dan deskripsi.</p></div></div>
    <div class="card admin-card"><h3>Umum</h3><label class="check-line" style="margin:8px 0"><input type="checkbox" id="rsEnabled" ${cfg.enabled?'checked':''}> Tampilkan emote melayang di latar kartu nilai</label><label>Jumlah emote (0–80)<input class="input" type="number" id="rsCount" min="0" max="80" value="${cfg.count}"></label></div>
    ${cfg.tiers.map((t,i)=>`<div class="card admin-card" data-tier="${i}"><div class="toolbar"><b>Tingkat ${i+1} · mulai dari nilai ${t.min}</b><button class="btn danger" type="button" data-tdel="${i}">Hapus</button></div><div class="form-grid"><label>Nilai minimum (0–100)<input class="input" type="number" min="0" max="100" data-f="min" value="${t.min}"></label><label>Emote besar<input class="input" data-f="icon" value="${esc(t.icon)}"></label><label class="full">Judul<input class="input" data-f="title" value="${esc(t.title)}"></label><label class="full">Deskripsi<textarea class="textarea" rows="2" data-f="sub">${esc(t.sub)}</textarea></label><label class="full">Emote latar (pisahkan dengan spasi)<input class="input" data-f="emoji" value="${esc(t.emoji)}"></label><label>Warna bingkai &amp; angka nilai<input type="color" class="input" data-f="color" value="${t.color}" style="height:48px;padding:4px"></label></div></div>`).join('')}
    <div class="card admin-card" style="display:grid;gap:10px"><button class="btn" type="button" id="rsAdd">➕ Tambah Tingkat</button><button class="btn red" type="button" id="rsSave">💾 Simpan Pengaturan Nilai</button><button class="btn" type="button" id="rsReset">↺ Kembalikan ke Bawaan</button><p class="muted" style="margin:0">User mendapat tingkat dengan nilai minimum tertinggi yang masih tercapai. Contoh: minimum 100 untuk nilai sempurna. Sediakan satu tingkat dengan minimum 0 supaya semua nilai punya tampilan.</p></div>`);
    document.querySelector('#rsAdd').onclick=()=>{collect();cfg.tiers.push({min:0,icon:'⭐',title:'Judul baru',sub:'',emoji:'⭐ ✨',color:'#60a5fa'});draw();};
    document.querySelectorAll('[data-tdel]').forEach(b=>b.onclick=()=>{if(cfg.tiers.length<=1)return alert('Minimal harus ada 1 tingkat.');collect();cfg.tiers.splice(Number(b.dataset.tdel),1);draw();});
    document.querySelector('#rsReset').onclick=()=>{if(confirm('Kembalikan semua pengaturan nilai ke bawaan? (belum tersimpan sampai kamu menekan Simpan)')){cfg=normResultCfg(null);draw();}};
    document.querySelector('#rsSave').onclick=async()=>{collect();if(!cfg.tiers.some(t=>t.min===0)&&!confirm('Belum ada tingkat dengan nilai minimum 0. Nilai yang lebih rendah akan memakai tingkat terendah. Tetap simpan?'))return;cfg.tiers.sort((x,y)=>y.min-x.min);const {error}=await supabase.from('branding').upsert({id:1,result_settings:cfg});if(error)alert(error.message+'\n\nPastikan SQL supabase-result-settings.sql sudah dijalankan.');else{alert('Pengaturan nilai tersimpan.');draw();}};
  };
  draw();
}


async function adminsPage(){
  const head=`<div class="admin-header"><div><div class="eyebrow">AKSES</div><h1>Tambah Admin</h1><p class="muted">Pilih user yang ingin dijadikan Admin tambahan (Sensei). Setelah ditambahkan, user itu login ke admin panel memakai email dan password akunnya sendiri.</p></div></div>`;
  const {data,error}=await supabase.rpc('owner_list_users');
  if(error){app(`${head}<div class="card admin-card"><div class="alert">${esc(error.message)}</div><p class="muted">Pastikan SQL <b>supabase-admin-roles.sql</b> sudah dijalankan di Supabase dan kamu login sebagai Admin Utama.</p></div>`);return;}
  const rows=Array.isArray(data)?data:[];
  const link=location.origin+'/admin.html';
  const roleBadge=r=>r==='owner'?'<i class="mode-pill user">Admin Utama</i>':r==='sensei'?'<i class="mode-pill">Sensei (Admin)</i>':'';
  const listHTML=q=>{const s=String(q||'').toLowerCase().trim();const f=rows.filter(x=>!s||String(x.name||'').toLowerCase().includes(s)||String(x.email||'').toLowerCase().includes(s));return f.map(x=>`<div class="list-row"><div><b>${esc(x.name||'Tanpa nama')}</b><span>${esc(x.email||'')} ${roleBadge(x.role)}${x.disabled?' <i class="mode-pill">Akun nonaktif</i>':''}</span></div><div class="media-actions">${x.role==='owner'?'':x.role==='sensei'?`<button class="btn danger" data-radm="${x.user_id}">Cabut Akses Admin</button>`:`<button class="btn red" data-aadm="${x.user_id}">➕ Jadikan Admin</button>`}</div></div>`).join('')||'<p class="muted">Tidak ada user yang cocok.</p>';};
  app(`${head}<div class="card admin-card"><h3>Link login Admin Panel</h3><p class="muted">Bagikan link ini ke Admin tambahan. Mereka masuk dengan email dan password akun mereka.</p><input class="input" id="admLink" readonly value="${esc(link)}"><button class="btn" type="button" id="admCopy" style="margin-top:10px">📋 Salin Link</button></div><div class="card admin-card"><h3>Daftar User (${rows.length})</h3><input id="admSearch" class="input" placeholder="Cari nama atau email…" style="margin-bottom:12px"><div class="table-list" id="admList">${listHTML('')}</div></div>`);
  const bind=()=>{
    document.querySelectorAll('[data-aadm]').forEach(b=>b.onclick=async()=>{const x=rows.find(r=>r.user_id===b.dataset.aadm);if(!confirm(`Jadikan ${x?.email||'user ini'} sebagai Admin (Sensei)?\n\nDia bisa login ke admin panel dengan email & password akunnya, dan mengakses semua menu kecuali Branding, Tampilan Kolom, dan Pengaturan Nilai.`))return;const {error:e}=await supabase.rpc('owner_add_admin',{p_user_id:b.dataset.aadm});if(e)alert(e.message);else{alert('Berhasil. User ini sekarang bisa login ke Admin Panel.');adminsPage();}});
    document.querySelectorAll('[data-radm]').forEach(b=>b.onclick=async()=>{const x=rows.find(r=>r.user_id===b.dataset.radm);if(!confirm(`Cabut akses admin untuk ${x?.email||'user ini'}? Akunnya tetap ada sebagai user biasa.`))return;const {error:e}=await supabase.rpc('owner_remove_admin',{p_user_id:b.dataset.radm});if(e)alert(e.message);else{alert('Akses admin dicabut.');adminsPage();}});
  };
  bind();
  document.querySelector('#admSearch').oninput=e=>{document.querySelector('#admList').innerHTML=listHTML(e.target.value);bind();};
  document.querySelector('#admCopy').onclick=async()=>{const el=document.querySelector('#admLink');try{await navigator.clipboard.writeText(el.value);}catch{el.select();document.execCommand('copy');}alert('Link tersalin.');};
}

const CUSTOM_DEFAULTS={enabled:true,title:'Custom',description:'Gabungkan soal dari beberapa Part sesukamu, lalu atur jumlah soal dan waktunya.',minQuestions:1,maxQuestions:0,maxMinutes:0,allowNoTimer:true,shuffle:true,parts:'all'};
function normCustom(v){let o=v;if(typeof o==='string'){try{o=JSON.parse(o);}catch{o=null;}}o=o&&typeof o==='object'&&!Array.isArray(o)?o:{};const n=(x,d,mn=0,mx=100000)=>{x=Number(x);return Number.isFinite(x)&&x!==null?Math.min(mx,Math.max(mn,Math.round(x))):d;};return {enabled:o.enabled!==false,title:String(o.title||CUSTOM_DEFAULTS.title).slice(0,40),description:o.description!=null?String(o.description).slice(0,200):CUSTOM_DEFAULTS.description,minQuestions:n(o.minQuestions,1,1),maxQuestions:n(o.maxQuestions,0,0),maxMinutes:n(o.maxMinutes,0,0),allowNoTimer:o.allowNoTimer!==false,shuffle:o.shuffle!==false,parts:Array.isArray(o.parts)?o.parts.map(String):'all'};}

async function customPage(){
  const [{data:ts},{data:parts}]=await Promise.all([supabase.from('timer_settings').select('*').eq('id',1).maybeSingle(),supabase.from('parts').select('id,part_number,name').order('part_number')]);
  const cfg=normCustom(ts?.custom_settings);
  const list=parts||[];
  const pickAll=cfg.parts==='all';
  app(`<div class="admin-header"><div><div class="eyebrow">MODE CUSTOM</div><h1>Mode Custom</h1><p class="muted">Kartu "Custom" di bawah daftar Part: user memilih sendiri Part mana yang digabung, jumlah soal, dan waktunya. Atur batasnya di sini.</p></div></div>
  <form id="cuForm" class="card admin-card form-grid">
    <label class="full check-line"><input type="checkbox" name="enabled" ${cfg.enabled?'checked':''}> Tampilkan Mode Custom di halaman Mengerjakan Soal</label>
    <label class="full">Judul kartu<input class="input" name="title" maxlength="40" value="${esc(cfg.title)}"></label>
    <label class="full">Deskripsi kartu<textarea class="textarea" name="description" rows="2" maxlength="200">${esc(cfg.description)}</textarea></label>
    <label>Jumlah soal minimal<input class="input" type="number" min="1" name="minQuestions" value="${cfg.minQuestions}"></label>
    <label>Jumlah soal maksimal <small class="muted">(0 = tanpa batas)</small><input class="input" type="number" min="0" name="maxQuestions" value="${cfg.maxQuestions}"></label>
    <label>Waktu maksimal, menit <small class="muted">(0 = tanpa batas)</small><input class="input" type="number" min="0" name="maxMinutes" value="${cfg.maxMinutes}"></label>
    <label class="full check-line"><input type="checkbox" name="allowNoTimer" ${cfg.allowNoTimer?'checked':''}> User boleh mengerjakan tanpa batas waktu</label>
    <label class="full check-line"><input type="checkbox" name="shuffle" ${cfg.shuffle?'checked':''}> Acak urutan soal (campur antar Part)</label>
    <div class="full"><b>Part yang boleh dipilih user</b>
      <label class="check-line" style="margin:8px 0"><input type="radio" name="cpMode" value="all" ${pickAll?'checked':''}> Semua Part (yang aktif)</label>
      <label class="check-line" style="margin:8px 0"><input type="radio" name="cpMode" value="pick" ${pickAll?'':'checked'}> Hanya Part tertentu</label>
      <div id="cpList" class="table-list" ${pickAll?'hidden':''}>${list.map(x=>`<label class="check-line" style="padding:6px 0"><input type="checkbox" data-cp="${x.id}" ${!pickAll&&cfg.parts.includes(String(x.id))?'checked':''}> Part ${String(x.part_number).padStart(2,'0')} · ${esc(x.name)}</label>`).join('')||'<p class="muted">Belum ada Part.</p>'}</div>
    </div>
    <button class="btn red full" type="submit">💾 Simpan Pengaturan Mode Custom</button>
  </form>`);
  const form=document.querySelector('#cuForm');
  form.querySelectorAll('[name="cpMode"]').forEach(r=>r.onchange=()=>{document.querySelector('#cpList').hidden=form.querySelector('[name="cpMode"]:checked').value==='all';});
  form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form);const mode=fd.get('cpMode');const picked=[...form.querySelectorAll('[data-cp]:checked')].map(b=>b.dataset.cp);if(mode==='pick'&&!picked.length)return alert('Pilih minimal 1 Part, atau pilih "Semua Part".');const next=normCustom({enabled:fd.has('enabled'),title:String(fd.get('title')||'').trim(),description:String(fd.get('description')||'').trim(),minQuestions:fd.get('minQuestions'),maxQuestions:fd.get('maxQuestions'),maxMinutes:fd.get('maxMinutes'),allowNoTimer:fd.has('allowNoTimer'),shuffle:fd.has('shuffle'),parts:mode==='all'?'all':picked});if(next.maxQuestions>0&&next.minQuestions>next.maxQuestions)return alert('Jumlah soal minimal tidak boleh lebih besar dari maksimal.');const {error}=await supabase.from('timer_settings').upsert({id:1,custom_settings:next});if(error)alert(error.message+'\n\nPastikan SQL supabase-custom-mode.sql sudah dijalankan di Supabase.');else{alert('Pengaturan Mode Custom tersimpan.');customPage();}};
}

function guide(){app(`<div class="admin-header"><div><div class="eyebrow">DOCUMENTATION</div><h1>Cara Penggunaan Admin</h1></div></div><div class="card admin-card guide-grid"><div><h2>Branding</h2><p>Atur identitas website, logo, favicon, hero, deskripsi, nama Developer, deskripsi Developer, serta link WhatsApp/Telegram/Instagram. Publik hanya melihat ikon kontak.</p></div><div><h2>Kanji</h2><p>Gunakan tiga field: Kanji, Cara Baca, Arti. Centang <b>Buat animasi urutan goresan</b> jika Kanji itu mau dianimasikan; animasi bisa dimatikan atau dihidupkan lagi dari daftar. Import dengan format <code>Kanji|Cara Baca|Arti</code>. Baris kosong dan nomor awal boleh.</p></div><div><h2>Part</h2><p>Buat maksimal 20 Part. Pilih <b>Diatur Admin</b> (kamu menentukan jumlah soal dan timer) atau <b>Diatur User</b> (user mengisi sendiri nama, jumlah soal, dan waktu sebelum mengerjakan, tanpa batas minimum). Pengaturan bisa diubah kapan saja dengan membuka menu Soal, memilih Part, lalu mengubah Pengaturan Soal &amp; Timer di bagian atas.</p></div><div><h2>Soal</h2><p>Gunakan tipe Ganda atau Ketik. Untuk Ketik, instruksi otomatis berdasarkan jawaban benar.</p></div><div><h2>Quick Soal</h2><pre>1. 食べる|Makan|ganda|Makan;Minum;Tidur;Pergi\n\n2. 飲む|Minum|ketik</pre><p>Setelah import, foto/audio dapat ditambahkan satu per satu.</p></div><div><h2>Timer</h2><p>Cara termudah: isi Timer di pengaturan Part. Halaman Kelola Timer dipakai untuk timer Tes Hiragana, Tes Katakana, Test Kotoba, timer per soal (ID atau nomor soal), dan timer global. Timeout soal lanjut ke soal berikutnya; waktu total habis mengakhiri latihan. Part yang diatur User memakai waktu pilihan user.</p></div><div><h2>Hasil & Reset</h2><p>Hasil latihan sekarang terikat ke akun user. Menu User menampilkan login, aktivitas, device, dan hasil. Tes Hiragana 46 juga tersimpan di akun masing-masing. Penghapusan Part akan ikut menghapus soal di Part tersebut.</p></div></div>`);}
boot();
