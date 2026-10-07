import { supabase, sbReady, requireSupabase } from './supabase.js';
import { CONFIG } from './config.js';
import { defaultBunpou } from './default-bunpou.js';
const root=document.querySelector('#admin-app');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const parse=v=>{try{return JSON.parse(v)}catch{return v}};
const typeMap={ganda:'multiple_choice',ketik:'typing',kanji:'kanji_input',bs:'truefalse',benar_salah:'truefalse',pilih:'kanji_choice',pilih_kanji:'kanji_choice',pasangan:'matching',matching:'matching'};
let current='dashboard', user=null, imported=[];
function app(html){root.innerHTML=`<div class="admin-shell"><aside class="admin-side"><div class="admin-brand"><span>⛩</span><div><b>ITCO JAPAN</b><small>ADMIN PANEL</small></div></div><nav>${[['dashboard','Dashboard'],['branding','Branding'],['kanji','Kanji'],['kaiwa','Kaiwa & Bunpou'],['parts','Part'],['questions','Soal'],['quick','Quick Soal'],['timer','Kelola Timer'],['results','Hasil'],['guide','Cara Penggunaan Admin']].map(([k,t])=>`<button class="side-link ${current===k?'active':''}" data-menu="${k}">${t}</button>`).join('')}</nav><button id="logout" class="logout">Keluar</button></aside><main class="admin-main">${html}</main></div>`;document.querySelectorAll('[data-menu]').forEach(b=>b.onclick=()=>{current=b.dataset.menu;render()});document.querySelector('#logout').onclick=async()=>{await supabase.auth.signOut();render()};}
async function boot(){if(!sbReady)return login('Supabase belum dikonfigurasi.');const {data}=await supabase.auth.getSession();user=data.session?.user||null;if(!user)return login();render();}
function login(msg=''){root.innerHTML=`<div class="login-wrap"><div class="login-card"><div class="admin-logo">⛩</div><div class="eyebrow">ITCO JAPAN</div><h1>Admin Panel</h1><p class="muted">Masuk menggunakan akun Admin Supabase.</p>${msg?`<div class="alert">${esc(msg)}</div>`:''}<input id="email" class="input" type="email" placeholder="Email"><input id="password" class="input" type="password" placeholder="Password"><button id="login" class="btn red fullbtn">Masuk</button></div></div>`;document.querySelector('#login').onclick=async()=>{const {error}=await supabase.auth.signInWithPassword({email:document.querySelector('#email').value,password:document.querySelector('#password').value});if(error)return login(error.message);user=(await supabase.auth.getUser()).data.user;render();};}
async function render(){if(current==='dashboard')return dashboard();if(current==='branding')return branding();if(current==='kanji')return kanji();if(current==='kaiwa')return kaiwa();if(current==='parts')return parts();if(current==='questions')return questions();if(current==='quick')return quick();if(current==='timer')return timer();if(current==='results')return results();if(current==='guide')return guide();}
async function count(table){const {count,error}=await supabase.from(table).select('*',{count:'exact',head:true});return error?0:count||0;}
async function dashboard(){const [k,b,p,q,r]=await Promise.all(['kanji','bunpou','parts','questions','results'].map(count));app(`<div class="admin-header"><div><div class="eyebrow">CONTROL CENTER</div><h1>Dashboard</h1><p class="muted">Kelola seluruh materi dan latihan ITCO JAPAN.</p></div></div><div class="stat-grid"><div class="stat-card"><b>${k}</b><span>Kanji</span></div><div class="stat-card"><b>${b}</b><span>Bunpou</span></div><div class="stat-card"><b>${p}</b><span>Part</span></div><div class="stat-card"><b>${q}</b><span>Soal</span></div><div class="stat-card"><b>${r}</b><span>Hasil</span></div></div><div class="card admin-card"><h2>Alur cepat</h2><p>Isi Branding → tambah Kanji → buat Part → masukkan soal lewat Soal atau Quick Soal → atur Timer → lihat Hasil.</p></div>`);}
async function branding(){let {data}=await supabase.from('branding').select('*').eq('id',1).maybeSingle();data=data||{};app(`<div class="admin-header"><div><div class="eyebrow">SITE IDENTITY</div><h1>Branding</h1></div></div><form id="brandForm" class="card admin-card form-grid"><label>Nama utama<input class="input" name="site_name" value="${esc(data.site_name||CONFIG.siteName)}"></label><label>Nama alternatif<input class="input" name="corporate_name" value="${esc(data.corporate_name||CONFIG.corporateName)}"></label><label>Creator header<input class="input" name="creator" value="${esc(data.creator||CONFIG.creator)}"></label><label>Nama Developer<input class="input" name="creator_name" value="${esc(data.creator_name||'Witama Yuliananta')}"></label><label class="full">Deskripsi website<textarea class="textarea" name="description">${esc(data.description||'Belajar bahasa Jepang dengan Kanji dan latihan interaktif.')}</textarea></label><label class="full">Deskripsi Developer<textarea class="textarea" name="developer_description">${esc(data.developer_description||'Website ini dibuat dan dikembangkan oleh Witama Yuliananta, sebagai bagian dari pengembangan media pembelajaran bahasa Jepang yang interaktif, modern, dan mudah digunakan.')}</textarea></label><div class="full upload-box"><label>Logo Developer</label><p class="muted">Pilih langsung dari File Manager HP. Logo akan di-upload ke Supabase Storage dan otomatis dipakai di halaman Developer.</p><div class="upload-row"><input id="developerLogoFile" class="input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"><button id="uploadDeveloperLogo" class="btn" type="button">📁 Upload Logo</button></div><input type="hidden" name="developer_logo_url" id="developerLogoUrl" value="${esc(data.developer_logo_url||'')}"><div id="developerLogoStatus" class="upload-status">${data.developer_logo_url?`Logo tersimpan.`:'Belum ada logo Developer.'}</div>${data.developer_logo_url?`<img class="upload-preview" src="${esc(data.developer_logo_url)}" alt="Logo Developer">`:''}</div><div class="full upload-box"><label>Logo Header</label><p class="muted">Pilih logo langsung dari File Manager HP. Setelah upload, URL logo otomatis tersimpan.</p><div class="upload-row"><input id="headerLogoFile" class="input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"><button id="uploadHeaderLogo" class="btn" type="button">📁 Upload Logo Header</button></div><input type="hidden" name="logo_url" id="headerLogoUrl" value="${esc(data.logo_url||'')}"><div id="headerLogoStatus" class="upload-status">${data.logo_url?'Logo header tersimpan.':'Belum ada logo header.'}</div>${data.logo_url?`<img class="upload-preview" src="${esc(data.logo_url)}" alt="Logo Header">`:''}</div><label>Favicon URL<input class="input" name="favicon_url" value="${esc(data.favicon_url||'')}"></label><label class="full">Hero Image URL<input class="input" name="hero_image" value="${esc(data.hero_image||CONFIG.heroImage)}"></label><div class="full contact-box"><h3>Kontak Developer</h3><p class="muted">Isi link saja. Di halaman publik yang tampil hanya ikon.</p><label>WhatsApp Link<input class="input" name="whatsapp_url" value="${esc(data.whatsapp_url||'')}"></label><label>Telegram Link<input class="input" name="telegram_url" value="${esc(data.telegram_url||'')}"></label><label>Instagram Link<input class="input" name="instagram_url" value="${esc(data.instagram_url||'')}"></label></div><button class="btn red full" type="submit">Simpan Branding</button></form>`);const fileInput=document.querySelector('#developerLogoFile');const uploadBtn=document.querySelector('#uploadDeveloperLogo');const status=document.querySelector('#developerLogoStatus');uploadBtn.onclick=async()=>{const file=fileInput.files?.[0];if(!file)return alert('Pilih logo dari File Manager terlebih dahulu.');if(!file.type.startsWith('image/'))return alert('File harus berupa gambar.');if(file.size>5*1024*1024)return alert('Ukuran logo maksimal 5 MB.');uploadBtn.disabled=true;status.textContent='Mengupload logo...';try{const ext=(file.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`branding/developer-logo-${Date.now()}.${ext}`;const {error:uploadError}=await supabase.storage.from('media').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});if(uploadError)throw uploadError;const {data:pub}=supabase.storage.from('media').getPublicUrl(path);document.querySelector('#developerLogoUrl').value=pub.publicUrl;const {error:saveLogoError}=await supabase.from('branding').upsert({id:1,developer_logo_url:pub.publicUrl});if(saveLogoError)throw saveLogoError;status.textContent='Logo berhasil di-upload dan langsung disimpan.';let preview=document.querySelector('.upload-preview');if(!preview){preview=document.createElement('img');preview.className='upload-preview';document.querySelector('.upload-box').appendChild(preview)}preview.src=pub.publicUrl;}catch(err){status.textContent='Upload gagal.';alert('Upload logo gagal: '+err.message)}finally{uploadBtn.disabled=false}};const headerFile=document.querySelector('#headerLogoFile');const headerBtn=document.querySelector('#uploadHeaderLogo');const headerStatus=document.querySelector('#headerLogoStatus');headerBtn.onclick=async()=>{const file=headerFile.files?.[0];if(!file)return alert('Pilih logo header terlebih dahulu.');if(!file.type.startsWith('image/'))return alert('File harus berupa gambar.');if(file.size>5*1024*1024)return alert('Ukuran logo maksimal 5 MB.');headerBtn.disabled=true;headerStatus.textContent='Mengupload logo header...';try{const ext=(file.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`branding/header-logo-${Date.now()}.${ext}`;const {error:uploadError}=await supabase.storage.from('media').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});if(uploadError)throw uploadError;const {data:pub}=supabase.storage.from('media').getPublicUrl(path);const {error:saveError}=await supabase.from('branding').upsert({id:1,logo_url:pub.publicUrl});if(saveError)throw saveError;document.querySelector('#headerLogoUrl').value=pub.publicUrl;headerStatus.textContent='Logo header berhasil di-upload dan disimpan.';let preview=document.querySelector('#headerLogoStatus').parentElement.querySelector('.upload-preview');if(!preview){preview=document.createElement('img');preview.className='upload-preview';document.querySelector('#headerLogoStatus').parentElement.appendChild(preview)}preview.src=pub.publicUrl;}catch(err){headerStatus.textContent='Upload gagal.';alert('Upload logo header gagal: '+err.message)}finally{headerBtn.disabled=false}};document.querySelector('#brandForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const obj=Object.fromEntries(fd.entries());obj.id=1;const {error}=await supabase.from('branding').upsert(obj);alert(error?error.message:'Branding berhasil disimpan.');};}
async function kanji(){const {data}=await supabase.from('kanji').select('*').order('created_at',{ascending:false});app(`<div class="admin-header"><div><div class="eyebrow">字 KANJI</div><h1>Kelola Kanji</h1><p class="muted">Hanya 3 field: Kanji, Cara Baca, Arti.</p></div></div><div class="card admin-card"><form id="kForm" class="form-grid"><label>Kanji<input class="input" name="kanji" required placeholder="食べる"></label><label>Cara Baca<input class="input" name="reading" required placeholder="たべる"></label><label class="full">Arti<input class="input" name="meaning" required placeholder="Makan"></label><button class="btn red full" type="submit">Tambah Kanji</button></form></div><div class="card admin-card"><div class="toolbar"><button id="delAll" class="btn danger">Hapus Semua</button></div><div class="table-list">${(data||[]).map(x=>`<div class="list-row"><div><b>${esc(x.kanji)}</b><span>${esc(x.reading||'')} · ${esc(x.meaning)}</span></div><button class="btn danger" data-del="${x.id}">Hapus</button></div>`).join('')||'<p class="muted">Belum ada Kanji.</p>'}</div></div><div class="card admin-card"><h3>Import Kanji</h3><p class="muted">Format: Kanji|Cara Baca|Arti. Baris kosong dan nomor di awal baris boleh digunakan.</p><textarea id="kImport" class="textarea" rows="8" placeholder="1. 食べる|たべる|Makan\n\n2. 飲む|のむ|Minum"></textarea><button id="importK" class="btn red">Import</button></div>`);document.querySelector('#kForm').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));const {error}=await supabase.from('kanji').insert({kanji:o.kanji,reading:o.reading,meaning:o.meaning,active:true});if(error)alert(error.message);else render();};document.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(confirm('Hapus Kanji ini?')){await supabase.from('kanji').delete().eq('id',b.dataset.del);render();}});document.querySelector('#delAll').onclick=async()=>{if(confirm('Hapus semua Kanji?')){await supabase.from('kanji').delete().neq('id','00000000-0000-0000-0000-000000000000');render();}};document.querySelector('#importK').onclick=async()=>{const lines=document.querySelector('#kImport').value.split(/\n/).map(s=>s.trim()).filter(Boolean);const rows=[];for(let line of lines){line=line.replace(/^\s*\d+[.)]\s*/,'');const [kanji,reading,meaning]=line.split('|').map(s=>s.trim());if(kanji&&reading&&meaning)rows.push({kanji,reading,meaning,active:true});}if(rows.length){const {error}=await supabase.from('kanji').insert(rows);if(error)alert(error.message);else render();}else alert('Tidak ada baris valid.');};}

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
  app(`<div class="admin-header"><div><div class="eyebrow">会話 · KAIWA</div><h1>Kelola Bunpou</h1><p class="muted">Semua materi bawaan + materi yang kamu tambahkan tampil di sini. Klik <b>Edit</b> untuk memperbaiki materi.</p></div></div>
  <div class="card admin-card"><form id="bForm" class="form-grid"><input type="hidden" name="id"><input type="hidden" name="builtin_key"><label>Kategori<select class="input" name="category"><option value="partikel">Partikel</option><option value="bunpou">Bunpou</option></select></label><label>Urutan<input class="input" type="number" name="sort_order" value="100"></label><label>Judul<input class="input" name="title" required placeholder="と (to)"></label><label>Pola<input class="input" name="pattern" required placeholder="kata benda + と"></label><label>Arti<input class="input" name="meaning" required placeholder="dan / bersama"></label><label>Aktif<select class="input" name="active"><option value="true">Ya</option><option value="false">Tidak</option></select></label><label class="full">Fungsi<textarea class="textarea" name="usage" required></textarea></label><label class="full">Bentuk sebelum pola<textarea class="textarea" name="before_form" required placeholder="Gunakan istilah Indonesia: bentuk kamus, bentuk て, bentuk た, bentuk ない, dll."></textarea></label><label class="full">Catatan tambahan<textarea class="textarea" name="notes"></textarea></label><label class="full">Contoh (satu baris: kana|romaji|arti)<textarea class="textarea" name="examples" rows="5"></textarea></label><label class="full">KAIWA (satu baris: A/B|kana|romaji|arti)<textarea class="textarea" name="conversation" rows="7"></textarea></label><div class="toolbar full"><button id="bSubmit" class="btn red" type="submit">Tambah Bunpou</button><button id="bCancel" class="btn" type="button" hidden>Batal Edit</button></div></form></div>
  <div class="card admin-card"><div class="admin-list-head"><h2>Semua Partikel & Bunpou</h2><span class="muted">${rows.length} materi</span></div><div class="table-list">${rows.map((x,i)=>`<div class="list-row"><div><b>${esc(x.title||x.pattern)}</b><span>${esc(x.category)} · ${esc(x.meaning||'')} · ${x.active===false?'Nonaktif':'Aktif'}${x.__builtin?' · Bawaan':''}</span></div><div class="media-actions"><button class="btn" type="button" data-bedit="${i}">Edit</button>${x.id?`<button class="btn danger" type="button" data-bdel="${x.id}">Hapus</button>`:''}</div></div>`).join('')}</div></div>`);
  const form=document.querySelector('#bForm'), submit=document.querySelector('#bSubmit'), cancel=document.querySelector('#bCancel');
  const fill=(x)=>{for(const n of ['id','builtin_key','category','sort_order','title','pattern','meaning','active','usage','before_form','notes','examples','conversation']){const el=form.elements[n];if(!el)continue;if(n==='examples')el.value=toLines(x.examples,false);else if(n==='conversation')el.value=toLines(x.conversation,true);else if(n==='builtin_key')el.value=keyOf(x);else el.value=x[n]??'';}submit.textContent='Simpan Perubahan';cancel.hidden=false;window.scrollTo({top:0,behavior:'smooth'});};
  document.querySelectorAll('[data-bedit]').forEach(b=>b.onclick=()=>fill(rows[Number(b.dataset.bedit)]));
  cancel.onclick=()=>{form.reset();form.elements.id.value='';form.elements.builtin_key.value='';form.elements.sort_order.value='100';submit.textContent='Tambah Bunpou';cancel.hidden=true;};
  form.onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(form));const examples=parseLessonLines(o.examples,false);const conversation=parseLessonLines(o.conversation,true);const row={category:o.category,title:o.title,pattern:o.pattern,meaning:o.meaning,usage:o.usage,before_form:o.before_form,notes:o.notes||'',examples,conversation,sort_order:Number(o.sort_order||100),active:o.active==='true'};let result;if(o.id)result=await supabase.from('bunpou').update(row).eq('id',o.id);else result=await supabase.from('bunpou').insert(row);if(result.error)alert(result.error.message);else{alert(o.id?'Bunpou berhasil diperbarui.':'Bunpou berhasil ditambahkan.');render();}};
  document.querySelectorAll('[data-bdel]').forEach(b=>b.onclick=async()=>{if(confirm('Hapus materi Bunpou custom ini?')){const {error}=await supabase.from('bunpou').delete().eq('id',b.dataset.bdel);if(error)alert(error.message);else render();}});
}
async function parts(){
  const {data}=await supabase.from('parts').select('*').order('part_number');
  app(`<div class="admin-header"><div><div class="eyebrow">LATIHAN</div><h1>Part</h1><p class="muted">Klik Part untuk melihat semua soal di dalamnya, lalu kelola foto, audio, dan soal.</p></div></div>
  <div class="card admin-card"><form id="pForm" class="form-grid">
    <label>Nomor Part<input class="input" name="part_number" type="number" min="1" max="20" required></label>
    <label>Nama Part<input class="input" name="name" required placeholder="Part 01"></label>
    <label class="full">Deskripsi<input class="input" name="description"></label>
    <label>Batas Soal<input class="input" name="question_limit" type="number" min="1"></label>
    <label><input type="checkbox" name="shuffle_questions" checked> Acak soal</label>
    <label><input type="checkbox" name="shuffle_options" checked> Acak pilihan</label>
    <label><input type="checkbox" name="active" checked> Aktif</label>
    <button class="btn red full" type="submit">Tambah Part</button>
  </form></div>
  <div class="card admin-card table-list">${(data||[]).map(x=>`<div class="list-row part-admin-row" data-part-open="${x.id}" role="button" tabindex="0">
    <div><b>Part ${String(x.part_number).padStart(2,'0')} — ${esc(x.name)}</b><span>${esc(x.description||'')} · ${x.active?'Aktif':'Nonaktif'}</span></div>
    <div class="media-actions"><button class="btn" type="button" data-part-open-btn="${x.id}">Kelola Soal →</button><button class="btn danger" type="button" data-pdel="${x.id}">Hapus</button></div>
  </div>`).join('')||'<p class="muted">Belum ada Part.</p>'}</div>`);
  document.querySelector('#pForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const o=Object.fromEntries(fd.entries());const row={part_number:Number(o.part_number),name:o.name,description:o.description||'',question_limit:o.question_limit?Number(o.question_limit):null,shuffle_questions:fd.has('shuffle_questions'),shuffle_options:fd.has('shuffle_options'),active:fd.has('active')};const {error}=await supabase.from('parts').insert(row);if(error)alert(error.message);else render();};
  document.querySelectorAll('[data-pdel]').forEach(b=>b.onclick=async e=>{e.stopPropagation();if(confirm('Hapus Part dan seluruh soal di dalamnya?')){await supabase.from('parts').delete().eq('id',b.dataset.pdel);render();}});
  document.querySelectorAll('[data-part-open-btn]').forEach(b=>b.onclick=e=>{e.stopPropagation();partQuestions(b.dataset.partOpenBtn);});
  document.querySelectorAll('[data-part-open]').forEach(row=>{row.onclick=()=>partQuestions(row.dataset.partOpen);row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();partQuestions(row.dataset.partOpen)}}});
}
async function partQuestions(partId){
  const [{data:part},{data:qs,error}]=await Promise.all([
    supabase.from('parts').select('*').eq('id',partId).single(),
    supabase.from('questions').select('*').eq('part_id',partId).order('created_at',{ascending:true})
  ]);
  if(error)return alert(error.message);
  const rows=qs||[];
  app(`<div class="admin-header"><div><div class="eyebrow">PART ${String(part?.part_number||'').padStart(2,'0')}</div><h1>${esc(part?.name||'Part')}</h1><p class="muted">${rows.length} soal · Kelola soal, foto, dan audio langsung dari Part ini.</p></div><div class="toolbar"><button id="backParts" class="btn">← Kembali ke Part</button><button id="goQuick" class="btn red">＋ Tambah Soal</button></div></div>
  <div class="card admin-card"><div class="part-question-list">${rows.map((x,i)=>`<article class="part-question-card" data-qcard="${x.id}">
    <div class="part-question-main"><div class="question-number">${i+1}</div><div class="part-question-copy"><b>${esc(x.prompt)}</b><span>${esc(x.type)} · jawaban: ${esc(x.answer)}</span>${x.reading?`<small>Reading: ${esc(x.reading)}</small>`:''}</div></div>
    <div class="part-media-status">${x.photo_url?'<span class="media-pill">📷 Foto tersimpan</span>':'<span class="media-pill muted-pill">📷 Belum ada foto</span>'}${x.audio_url?'<span class="media-pill">🔊 Audio tersimpan</span>':'<span class="media-pill muted-pill">🔊 Belum ada audio</span>'}</div>
    <div class="part-question-actions"><label class="btn">📷 ${x.photo_url?'Ganti Foto':'Tambah Foto'}<input hidden type="file" accept="image/*" data-part-photo="${x.id}"></label><label class="btn">🔊 ${x.audio_url?'Ganti Audio':'Tambah Audio'}<input hidden type="file" accept="audio/*" data-part-audio="${x.id}"></label><button class="btn danger" data-part-qdel="${x.id}">Hapus Soal</button></div>
    ${x.photo_url?`<div class="part-media-preview"><img src="${esc(x.photo_url)}" alt="Foto soal" loading="lazy"></div>`:''}
    ${x.audio_url?`<div class="part-audio-preview"><audio controls preload="metadata" src="${esc(x.audio_url)}"></audio></div>`:''}
  </article>`).join('')||'<div class="empty-state">Belum ada soal di Part ini.</div>'}</div></div>`);
  document.querySelector('#backParts').onclick=()=>{current='parts';render();};
  document.querySelector('#goQuick').onclick=()=>{current='quick';render();setTimeout(()=>{const sel=document.querySelector('#quickPart');if(sel){sel.value=partId;}},0)};
  document.querySelectorAll('[data-part-photo]').forEach(i=>i.onchange=()=>uploadMediaAndRefresh(i,'photo',partId));
  document.querySelectorAll('[data-part-audio]').forEach(i=>i.onchange=()=>uploadMediaAndRefresh(i,'audio',partId));
  document.querySelectorAll('[data-part-qdel]').forEach(b=>b.onclick=async()=>{if(confirm('Hapus soal ini dari Part?')){const {error}=await supabase.from('questions').delete().eq('id',b.dataset.partQdel);if(error)alert(error.message);else partQuestions(partId);}});
}
async function uploadMediaAndRefresh(input,kind,partId){await uploadMedia(input,kind);partQuestions(partId);}
function installQuestionEditorStyle(){
  if(document.getElementById('question-editor-style'))return;
  const st=document.createElement('style');st.id='question-editor-style';st.textContent=`
    .question-editor-wrap{position:relative}.question-editor{min-height:120px;width:100%;background:#0d0d0d;border:1px solid #303030;color:#fff;border-radius:11px;padding:12px 14px;outline:none;line-height:1.7;white-space:pre-wrap;word-break:break-word}.question-editor:focus{border-color:#8d3030}.question-editor:empty:before{content:attr(data-placeholder);color:#666;pointer-events:none}.selection-toolbar{position:fixed;z-index:9999;display:none;align-items:center;gap:4px;padding:6px;background:#202124;border:1px solid #3b3b3b;border-radius:10px;box-shadow:0 8px 28px #0009}.selection-toolbar button{min-width:36px;height:34px;border:0;border-radius:7px;background:#303134;color:#fff;font-weight:800;cursor:pointer}.selection-toolbar button:hover{background:#4a4a4a}.selection-toolbar .u-btn{text-decoration:underline}.question-active{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;font-size:11px;border:1px solid #294b2d;background:#102014;color:#8fe39a}.question-active.off{border-color:#4a2626;background:#241313;color:#e58a8a}.question-row-off{opacity:.58}.question-row-off .question-active{opacity:1}.question-media-admin{display:flex;gap:8px;flex-wrap:wrap}.question-status-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.question-toggle{min-width:84px}
  `;document.head.appendChild(st);
}
function sanitizeQuestionHtml(html){
  const box=document.createElement('div');box.innerHTML=html||'';
  box.querySelectorAll('*').forEach(el=>{
    const tag=el.tagName.toLowerCase();
    if(!['u','br','b','strong','i','em'].includes(tag)){
      el.replaceWith(document.createTextNode(el.textContent||''));
      return;
    }
    [...el.attributes].forEach(a=>el.removeAttribute(a.name));
  });
  return box.innerHTML.replace(/^(?:<br>)+|(?:<br>)+$/g,'');
}
function plainQuestionText(html){const d=document.createElement('div');d.innerHTML=html||'';return (d.textContent||'').trim();}
function selectionInsideEditor(editor){const sel=window.getSelection();return !!sel && sel.rangeCount && editor.contains(sel.anchorNode) && editor.contains(sel.focusNode) && !sel.isCollapsed;}
function setupQuestionEditor(editor,toolbar){
  let savedRange=null;
  const saveSelection=()=>{const sel=window.getSelection();if(selectionInsideEditor(editor))savedRange=sel.getRangeAt(0).cloneRange();};
  const positionToolbar=()=>{if(!selectionInsideEditor(editor))return;saveSelection();const r=window.getSelection().getRangeAt(0).getBoundingClientRect();const w=toolbar.offsetWidth||92;let left=r.left+(r.width/2)-(w/2);left=Math.max(8,Math.min(left,innerWidth-w-8));let top=r.bottom+8;if(top+46>innerHeight)top=Math.max(8,r.top-52);toolbar.style.left=`${left}px`;toolbar.style.top=`${top}px`;toolbar.style.display='flex';};
  document.addEventListener('selectionchange',()=>{setTimeout(positionToolbar,0)});
  editor.addEventListener('mouseup',()=>setTimeout(positionToolbar,0));
  editor.addEventListener('touchend',()=>setTimeout(positionToolbar,80));
  editor.addEventListener('keyup',()=>setTimeout(positionToolbar,0));
  document.addEventListener('mousedown',e=>{if(!toolbar.contains(e.target)&&!editor.contains(e.target))toolbar.style.display='none'});
  toolbar.querySelector('[data-cmd="underline"]').onclick=()=>{
    if(!savedRange)return;
    const sel=window.getSelection();sel.removeAllRanges();sel.addRange(savedRange);
    document.execCommand('underline',false,null);
    editor.focus();saveSelection();positionToolbar();
  };
  toolbar.querySelector('[data-cmd="clear"]').onclick=()=>{
    if(!savedRange)return;
    const sel=window.getSelection();sel.removeAllRanges();sel.addRange(savedRange);
    document.execCommand('removeFormat',false,null);
    editor.focus();saveSelection();positionToolbar();
  };
  return ()=>sanitizeQuestionHtml(editor.innerHTML);
}
async function questions(){
  installQuestionEditorStyle();
  const {data:parts}=await supabase.from('parts').select('*').order('part_number');
  const {data:qs}=await supabase.from('questions').select('*').order('created_at',{ascending:false});
  app(`<div class="admin-header"><div><div class="eyebrow">SOAL</div><h1>Kelola Soal</h1><p class="muted">Atur Part, tipe soal, media, dan aktif/nonaktif setiap soal.</p></div></div>
  <div class="card admin-card"><form id="qForm" class="form-grid">
    <label>Part<select class="input" name="part_id">${(parts||[]).map(p=>`<option value="${p.id}">Part ${p.part_number} — ${esc(p.name)}</option>`).join('')}</select></label>
    <label>Tipe<select class="input" name="type"><option value="multiple_choice">Ganda</option><option value="typing">Ketik jawaban sendiri</option></select></label>
    <label class="full">Pertanyaan
      <div class="question-editor-wrap"><div id="questionEditor" class="question-editor" contenteditable="true" spellcheck="false" data-placeholder="Opsional"></div>
      <div id="selectionToolbar" class="selection-toolbar"><button type="button" class="u-btn" data-cmd="underline">U</button><button type="button" data-cmd="clear">Tx</button></div></div>
    </label>
    <label>Jawaban benar<input class="input" name="answer" placeholder="Opsional"></label>
    <label>Pilihan<input class="input" name="options" placeholder="Contoh: Makan;Minum;Tidur"></label>
    <label>Reading (opsional)<input class="input" name="reading" placeholder="Opsional"></label>
    <label class="full">Penjelasan (opsional)<input class="input" name="instruction" placeholder="Opsional"></label>
    <label>Foto soal (opsional)<input class="input" id="qPhoto" type="file" accept="image/*"></label>
    <label>Audio soal (opsional)<input class="input" id="qAudio" type="file" accept="audio/*"></label>
    <button class="btn red full" type="submit">Tambah Soal</button>
  </form></div>
  <div class="card admin-card table-list">${(qs||[]).map((x,i)=>`<article class="list-row ${x.active===false?'question-row-off':''}">
    <div><b>${i+1}. ${sanitizeQuestionHtml(x.prompt||'')||'<span class="muted">Pertanyaan kosong</span>'}</b><span>${esc(x.type==='typing'?'Ketik jawaban sendiri':'Ganda')} · ${x.active===false?'Nonaktif':'Aktif'} · jawaban: ${esc(x.answer||'—')}</span>${x.reading?`<small>Reading: ${esc(x.reading)}</small>`:''}<div class="question-media-admin">${x.photo_url?'<span>📷 Foto</span>':''}${x.audio_url?'<span>🔊 Audio</span>':''}</div></div>
    <div class="question-status-actions"><span class="question-active ${x.active===false?'off':''}">${x.active===false?'● Nonaktif':'● Aktif'}</span><button class="btn question-toggle" data-qtoggle="${x.id}" data-active="${x.active!==false}">${x.active===false?'Aktifkan':'Nonaktifkan'}</button><button class="btn danger" data-qdel="${x.id}">Hapus</button></div>
  </article>`).join('')||'<p class="muted">Belum ada soal.</p>'}</div>`);
  const editor=document.querySelector('#questionEditor');
  const getPrompt=setupQuestionEditor(editor,document.querySelector('#selectionToolbar'));
  document.querySelector('#qForm').onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(e.target),o=Object.fromEntries(fd.entries());
    const prompt=getPrompt();
    const answer=(o.answer||'').trim();
    let options=(o.options||'').split(';').map(s=>s.trim()).filter(Boolean);
    if(o.type==='typing')options=[];
    const row={part_id:o.part_id,prompt,reading:o.reading||'',instruction:o.type==='typing'?'':(o.instruction||''),type:o.type,options,answer,active:true};
    const {data,error}=await supabase.from('questions').insert(row).select('id').single();
    if(error)return alert(error.message);
    const id=data?.id;
    if(id){
      for(const [input,kind] of [[document.querySelector('#qPhoto'),'photo'],[document.querySelector('#qAudio'),'audio']]){
        if(input?.files?.[0])await uploadMediaById(input,kind,id);
      }
    }
    render();
  };
  document.querySelectorAll('[data-qtoggle]').forEach(b=>b.onclick=async()=>{
    const next=b.dataset.active!=='true';
    const {error}=await supabase.from('questions').update({active:next}).eq('id',b.dataset.qtoggle);
    if(error)alert(error.message);else questions();
  });
  document.querySelectorAll('[data-qdel]').forEach(b=>b.onclick=async()=>{if(confirm('Hapus soal ini?')){const {error}=await supabase.from('questions').delete().eq('id',b.dataset.qdel);if(error)alert(error.message);else render();}});
}
async function uploadMediaById(input,kind,id){
  const file=input.files?.[0];if(!file)return;
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`questions/${id}/${Date.now()}-${safe}`;
  const {error:uploadError}=await supabase.storage.from('media').upload(path,file,{upsert:true,contentType:file.type||undefined});
  if(uploadError)return alert(`Upload ${kind} gagal: ${uploadError.message}`);
  const {data:urlData}=supabase.storage.from('media').getPublicUrl(path);const publicUrl=urlData?.publicUrl||'';
  const patch=kind==='photo'?{photo_url:publicUrl,media_url:publicUrl,media_type:'image'}:{audio_url:publicUrl,media_url:publicUrl,media_type:'audio'};
  const {error}=await supabase.from('questions').update(patch).eq('id',id);if(error)alert(`URL ${kind} gagal disimpan: ${error.message}`);
}

async function quick(){
  const {data:parts}=await supabase.from('parts').select('*').order('part_number');
  app(`<div class="admin-header"><div><div class="eyebrow">QUICK SOAL</div><h1>Import Cepat</h1><p class="muted">Import teks dulu. Setelah masuk, pilih Part untuk melihat dan mengelola semua soalnya.</p></div></div>
  <div class="card admin-card"><textarea id="quickText" class="textarea" rows="13" placeholder="1. 食べる|Makan|ganda|Makan;Minum;Tidur;Pergi\n\n2. 飲む|Minum|ketik\n\n3. 学校|Sekolah|kanji\n\n4. 日本はアジアの国です|Benar|bs\n\n5. Sekolah|学校|pilih|学校;先生;日本;会社\n\n6. Cocokkan|Jepang=日本;Sekolah=学校;Guru=先生|pasangan"></textarea><select id="quickPart" class="input"><option value="">Pilih Part</option>${(parts||[]).map(p=>`<option value="${p.id}">Part ${p.part_number} — ${esc(p.name)}</option>`).join('')}</select><button id="quickImport" class="btn red">Import Soal</button></div><div id="quickList"></div>`);
  document.querySelector('#quickImport').onclick=()=>doQuickImport();
  document.querySelector('#quickPart').onchange=async()=>{const id=document.querySelector('#quickPart').value;if(id){const {data}=await supabase.from('questions').select('*').eq('part_id',id).order('created_at',{ascending:true});renderQuickList(data||[],'Semua Soal di Part');}else document.querySelector('#quickList').innerHTML='';};
}
function parseQuick(text){return text.split(/\n/).map(s=>s.trim()).filter(Boolean).map(line=>{line=line.replace(/^\s*\d+[.)]\s*/,'');const [prompt,answer,typeRaw,optionsRaw]=line.split('|');const type=typeMap[(typeRaw||'').trim().toLowerCase()]||(typeRaw||'multiple_choice').trim();let options=[];let finalAnswer=(answer||'').trim();if(type==='matching'){options=(answer||'').split(';').map(s=>{const [left,right]=s.split('=').map(v=>v?.trim());return left&&right?{left,right}:null}).filter(Boolean);finalAnswer=JSON.stringify(Object.fromEntries(options.map(x=>[x.left,x.right])));}else if(optionsRaw)options=optionsRaw.split(';').map(s=>s.trim()).filter(Boolean);else if(type==='truefalse'){finalAnswer=/^(benar|true|1)$/i.test(finalAnswer)?'Benar':'Salah';options=['Benar','Salah'];}else if(type==='multiple_choice'||type==='kanji_choice'){if(finalAnswer)options.push(finalAnswer);}return {prompt:(prompt||'').trim(),answer:finalAnswer,type,options};}).filter(x=>x.prompt&&x.answer&&x.type);}
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
  const id=input.dataset[kind];
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
  input.closest('.media-row').querySelector('small').textContent=`${kind==='photo'?'📷 Foto':'🔊 Audio'} tersimpan dan terhubung ke soal.`;
  input.value='';
}
async function timer(){const {data}=await supabase.from('timer_settings').select('*').eq('id',1).maybeSingle();const t=data||{enabled:false,global_seconds:0,per_part:{},per_question:{}};app(`<div class="admin-header"><div><div class="eyebrow">TIME CONTROL</div><h1>Kelola Timer</h1><p class="muted">Priority: Timer Soal → Timer Part → Timer Global.</p></div></div><div class="card admin-card"><form id="tForm"><label><input type="checkbox" name="enabled" ${t.enabled?'checked':''}> Aktifkan timer</label><label>Global (detik)<input class="input" type="number" name="global_seconds" value="${Number(t.global_seconds||0)}"></label><label>Timer Part JSON<textarea class="textarea" name="per_part">${esc(JSON.stringify(parse(t.per_part||'{}'),null,2))}</textarea></label><label>Timer Soal JSON<textarea class="textarea" name="per_question">${esc(JSON.stringify(parse(t.per_question||'{}'),null,2))}</textarea></label><button class="btn red" type="submit">Simpan Timer</button></form></div><div class="card admin-card"><p>Contoh Part: <code>{"1":1800,"2":1200}</code></p><p>Contoh Soal: gunakan ID soal sebagai key, atau nomor soal seperti <code>{"1":30,"2":45}</code>.</p></div>`);document.querySelector('#tForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);let pp,pq;try{pp=JSON.parse(fd.get('per_part')||'{}');pq=JSON.parse(fd.get('per_question')||'{}');}catch{return alert('JSON timer tidak valid.');}const {error}=await supabase.from('timer_settings').upsert({id:1,enabled:fd.has('enabled'),global_seconds:Number(fd.get('global_seconds')||0),per_part:pp,per_question:pq});alert(error?error.message:'Timer tersimpan.');};}
async function results(){const {data}=await supabase.from('results').select('*,parts(name,part_number)').order('created_at',{ascending:false});app(`<div class="admin-header"><div><div class="eyebrow">RESULTS</div><h1>Hasil</h1></div></div><div class="toolbar"><button id="resetResults" class="btn danger">Reset Statistik</button></div><div class="card admin-card table-list">${(data||[]).map(x=>`<div class="list-row"><div><b>${esc(x.name)} · ${esc(x.parts?.name||'Part')}</b><span>Nilai ${x.score} · Benar ${x.correct_count} · Salah ${x.wrong_count} · Tidak dijawab ${x.unanswered_count} · ${new Date(x.created_at).toLocaleString('id-ID')}</span></div></div>`).join('')||'<p class="muted">Belum ada hasil.</p>'}</div>`);document.querySelector('#resetResults').onclick=async()=>{if(confirm('Hapus semua hasil? Nama tetap disimpan.')){const {error}=await supabase.from('results').delete().neq('id','00000000-0000-0000-0000-000000000000');if(error)alert(error.message);else render();}};}
function guide(){app(`<div class="admin-header"><div><div class="eyebrow">DOCUMENTATION</div><h1>Cara Penggunaan Admin</h1></div></div><div class="card admin-card guide-grid"><div><h2>Branding</h2><p>Atur identitas website, logo, favicon, hero, deskripsi, nama Developer, deskripsi Developer, serta link WhatsApp/Telegram/Instagram. Publik hanya melihat ikon kontak.</p></div><div><h2>Kanji</h2><p>Gunakan tiga field: Kanji, Cara Baca, Arti. Import dengan format <code>Kanji|Cara Baca|Arti</code>. Baris kosong dan nomor awal boleh.</p></div><div><h2>Part</h2><p>Buat maksimal 20 Part. Atur nama, deskripsi, batas soal, dan pengacakan.</p></div><div><h2>Soal</h2><p>Gunakan Ganda, Ketik, Kanji, B/S, Pilih Kanji, atau Pasangan. Untuk Ketik, instruksi otomatis berdasarkan jawaban benar.</p></div><div><h2>Quick Soal</h2><pre>1. 食べる|Makan|ganda|Makan;Minum;Tidur;Pergi\n\n2. 飲む|Minum|ketik\n\n3. 学校|Sekolah|kanji\n\n4. 日本はアジアの国です|Benar|bs\n\n5. Sekolah|学校|pilih|学校;先生;日本;会社\n\n6. Cocokkan|Jepang=日本;Sekolah=学校|pasangan</pre><p>Setelah import, foto/audio dapat ditambahkan satu per satu.</p></div><div><h2>Timer</h2><p>Priority: Soal → Part → Global. Timer Soal memakai ID soal atau nomor soal. Timeout soal lanjut ke soal berikutnya; timeout Part/Global mengakhiri latihan.</p></div><div><h2>Hasil & Reset</h2><p>Hasil tersimpan berdasarkan nama. Reset Statistik menghapus hasil tetapi tidak menghapus nama. Penghapusan Part akan ikut menghapus soal di Part tersebut.</p></div></div>`);}
boot();
