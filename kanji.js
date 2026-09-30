const data=[
{kanji:"日",reading:"にち / ひ",romaji:"nichi / hi",meaning:"hari, matahari"},
{kanji:"月",reading:"げつ / つき",romaji:"getsu / tsuki",meaning:"bulan"},
{kanji:"火",reading:"か / ひ",romaji:"ka / hi",meaning:"api"},
{kanji:"水",reading:"すい / みず",romaji:"sui / mizu",meaning:"air"},
{kanji:"木",reading:"もく / き",romaji:"moku / ki",meaning:"pohon, kayu"},
{kanji:"金",reading:"きん / かね",romaji:"kin / kane",meaning:"emas, uang"},
{kanji:"土",reading:"ど / つち",romaji:"do / tsuchi",meaning:"tanah"}
];
function render(q=""){const grid=document.getElementById("kanjiGrid");grid.innerHTML=data.filter(x=>(x.kanji+x.reading+x.romaji+x.meaning).toLowerCase().includes(q.toLowerCase())).map(x=>`<article class="card kanji-card"><div class="kanji-char">${x.kanji}</div><div class="kanji-info">${x.reading}<br>${x.romaji}<br>${x.meaning}</div></article>`).join("")}
render();document.getElementById("search")?.addEventListener("input",e=>render(e.target.value));
