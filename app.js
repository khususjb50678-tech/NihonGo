const demoParts=[{id:1,title:"Part 01",description:"Kanji dasar",questions:3,active:true}];
const el=document.getElementById("parts");
if(el) el.innerHTML=demoParts.filter(p=>p.active).map(p=>`<article class="card part-card"><div><h3>${p.title}</h3><p>${p.description} · ${p.questions} soal</p></div><a class="btn primary" href="exercise.html?part=${p.id}">MULAI</a></article>`).join("");
