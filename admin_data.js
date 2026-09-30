(function(){
  const defaults={
    kanji:[
      {id:1,kanji:'日',collection:'Dasar',kun:'ひ',on:'ニチ / ジツ',romaji:'nichi / hi',meaning:'hari, matahari',notes:'',active:true},
      {id:2,kanji:'月',collection:'Dasar',kun:'つき',on:'ゲツ / ガツ',romaji:'getsu / tsuki',meaning:'bulan',notes:'',active:true},
      {id:3,kanji:'火',collection:'Dasar',kun:'ひ',on:'カ',romaji:'ka / hi',meaning:'api',notes:'',active:true},
      {id:4,kanji:'水',collection:'Dasar',kun:'みず',on:'スイ',romaji:'sui / mizu',meaning:'air',notes:'',active:true},
      {id:5,kanji:'木',collection:'Dasar',kun:'き',on:'モク / ボク',romaji:'moku / ki',meaning:'pohon, kayu',notes:'',active:true},
      {id:6,kanji:'金',collection:'Dasar',kun:'かね',on:'キン / コン',romaji:'kin / kane',meaning:'emas, uang',notes:'',active:true},
      {id:7,kanji:'土',collection:'Dasar',kun:'つち',on:'ド / ト',romaji:'do / tsuchi',meaning:'tanah',notes:'',active:true}
    ],
    parts:[{id:1,number:1,name:'Kanji Dasar',description:'3 soal · timer 30 detik',timer:30,active:true}],
    questions:[
      {id:1,type:'mc',prompt:'Kanji 「日」 berarti...',choices:['Hari / matahari','Bulan','Air','Api'],answer:'0',points:10,explanation:'「日」 dapat berarti hari atau matahari.',active:true},
      {id:2,type:'input',prompt:"Tulis Kanji untuk 'bulan'.",choices:[],answer:'月',points:10,explanation:'Kanji untuk bulan adalah 「月」.',active:true},
      {id:3,type:'tf',prompt:'「水」 berarti air.',choices:['Benar','Salah'],answer:'true',points:10,explanation:'Benar. 「水」 berarti air.',active:true}
    ]
  };
  window.BN={
    get(key){try{const raw=localStorage.getItem('bn_'+key);if(raw)return JSON.parse(raw)}catch(e){} return defaults[key]?JSON.parse(JSON.stringify(defaults[key])):[]},
    set(key,value){localStorage.setItem('bn_'+key,JSON.stringify(value));return value},
    seed(){['kanji','parts','questions'].forEach(k=>{if(!localStorage.getItem('bn_'+k))this.set(k,defaults[k])})},
    nextId(list){return list.length?Math.max(...list.map(x=>Number(x.id)||0))+1:1},
    esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  }; BN.seed();
})();
