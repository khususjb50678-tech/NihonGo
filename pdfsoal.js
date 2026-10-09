// Impor soal dari PDF (teks harus bisa disalin). Memakai pdf.js dari cdnjs.
const PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export async function loadPdfJs(){
  if(window.pdfjsLib)return window.pdfjsLib;
  await new Promise((ok,no)=>{const s=document.createElement('script');s.src=PDFJS;s.onload=ok;s.onerror=()=>no(new Error('Pembaca PDF gagal dimuat. Periksa koneksi internet.'));document.head.appendChild(s);});
  window.pdfjsLib.GlobalWorkerOptions.workerSrc=WORKER;
  return window.pdfjsLib;
}

export async function readPdfPages(file){
  const lib=await loadPdfJs();
  const pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise;
  const pages=[];
  for(let p=1;p<=pdf.numPages;p++){
    const lines=[];const tc=await (await pdf.getPage(p)).getTextContent();const rows=[];
    tc.items.forEach(it=>{const y=Math.round(it.transform[5]),x=it.transform[4];let r=rows.find(r=>Math.abs(r.y-y)<=3);if(!r){r={y,items:[]};rows.push(r);}r.items.push({x,s:it.str});});
    rows.sort((a,b)=>b.y-a.y).forEach(r=>{const t=r.items.sort((a,b)=>a.x-b.x).map(i=>i.s).join(' ').replace(/\s+/g,' ').trim();if(t)lines.push(t);});
    pages.push(lines);
  }
  return pages;
}

export function parsePdfQuestions(input){
  const pages=(input.length&&typeof input[0]==='string')?[input]:input;
  const SEC=/^(Script and Vocabulary|Conversation and Expression|Listening)\s*$/i;
  let sec='Soal',cur=null,keyMode=false,ksec='',qnums=null;const qs=[],keys={};
  for(let pg=0;pg<pages.length;pg++)for(const raw of pages[pg]){
    const l=String(raw).trim();
    if(!l||/^\d+$/.test(l)||/^(ORIGINAL FROM|TOKYO|OMIYAGE)(\s+(FROM|TOKYO|OMIYAGE))*$/i.test(l))continue;
    if(/^KEY ANSWER/i.test(l)){keyMode=true;cur=null;continue;}
    const sm=l.match(SEC);
    if(sm){if(keyMode)ksec=sm[1];else{sec=sm[1];cur=null;}continue;}
    if(keyMode){
      if(/^Question\b/i.test(l))qnums=l.replace(/^Question/i,'').trim().split(/\s+/).map(Number);
      else if(/^Answer\b/i.test(l)&&qnums){const a=l.replace(/^Answer/i,'').trim().split(/\s+/);keys[ksec]=keys[ksec]||{};qnums.forEach((n,i)=>{keys[ksec][n]=(a[i]||'').toLowerCase();});qnums=null;}
      continue;
    }
    let m=l.match(/^(\d+)\.\s*(.*)$/);
    if(m){cur={sec,num:+m[1],page:pg+1,stem:m[2],opts:[]};qs.push(cur);continue;}
    m=l.match(/^([a-d])\.\s*(.*)$/);
    if(m&&cur){cur.opts.push(m[2]);continue;}
    if(cur){if(cur.opts.length)cur.opts[cur.opts.length-1]=(cur.opts[cur.opts.length-1]+' '+l).trim();else cur.stem=(cur.stem+'\n'+l).trim();}
  }
  qs.forEach(q=>{q.key=keys[q.sec]?.[q.num]||'';});
  return qs;
}

// "1A 2C 3B" atau "a c b d" atau "acbd" -> {1:'a',2:'c',...}
export function parseKeyText(text){
  const t=String(text||'');const out={};
  if(/\d/.test(t)){for(const m of t.matchAll(/(\d+)\s*[.:=\-)]?\s*([a-dA-D])/g))out[+m[1]]=m[2].toLowerCase();}
  else{(t.match(/[a-dA-D]/g)||[]).forEach((c,i)=>{out[i+1]=c.toLowerCase();});}
  return out;
}
