import { esc, stockToNumber } from './utils.js'
import { COLS } from './match.js'
const $=id=>document.getElementById(id)
const colGrp=w=>`<colgroup>${w.map(x=>`<col style="width:${x}%">`).join('')}</colgroup>`

const HDR1={
"Sıra No":"Sıra","Marka":"Marka",
"Ürün Kodu (Compel)":"Compel Ürün Kodu","Ürün Adı (Compel)":"Compel Ürün Adı",
"Ürün Kodu (T-Soft)":"T-Soft Ürün Kodu","Ürün Adı (T-Soft)":"Tsoft Ürün Adı",
"Stok (Compel)":"Compel","Stok (Depo)":"Aide","Stok (T-Soft)":"T-Soft",
"EAN (Compel)":"Compel EAN","EAN (T-Soft)":"T-Soft EAN"
}
const disp=c=>HDR1[c]||c
const fmtHdr=s=>{
s=(s??'').toString()
const m=s.match(/^(.*?)(\s*\([^)]*\))\s*$/)
return m?`<span class="hMain">${esc(m[1].trimEnd())}</span> <span class="hParen">${esc(m[2].trim())}</span>`:esc(s)
}

/* CSS inject once */
let _css=0
function css(){
if(_css)return;_css=1
const st=document.createElement('style')
st.textContent=`
@keyframes namePulse{0%{text-shadow:0 0 0 transparent}55%{text-shadow:0 0 14px rgba(134,239,172,.75)}100%{text-shadow:0 0 0 transparent}}
.namePulse{animation:namePulse 1s ease-in-out infinite}
.sepL{border-left:1px solid rgba(232,60,97,.28)!important;box-shadow:inset 1px 0 0 rgba(0,0,0,.35)}
.tsoftPassive{text-decoration:line-through}
@keyframes softStockPulse{0%{box-shadow:0 0 0 transparent}55%{box-shadow:0 0 14px rgba(232,60,97,.26)}100%{box-shadow:0 0 0 transparent}}
tr.stockPulse{animation:softStockPulse 1s ease-in-out infinite}
.unmHead{font-weight:1300;text-align:center!important}
`
document.head.appendChild(st)
}
css()

const cellName=(txt,href,pulse=false,cls='')=>{
const v=(txt??'').toString(),u=href||''
const c=`nm${pulse?' namePulse':''}${cls?` ${cls}`:''}`
return u?`<a class="${c}" href="${esc(u)}" target="_blank">${esc(v)}</a>`:`<span class="${c}">${esc(v)}</span>`
}

const fmtNum=n=>{
const x=Number(n)
return Number.isFinite(x)?String(x):'0'
}
const fmtStockLabel=n=>{
const x=Number(n)
return x>0?`Stok Var (${fmtNum(x)})`:`Stok Yok (${fmtNum(x)})`
}

export function createRenderer({ui}={}){
return{

/* ======================================================
   COMPEL MODE
====================================================== */
render(R,Ux,depotReady){

$('unmatchedSplitSection')&&( $('unmatchedSplitSection').style.display='none' )
$('t2L')&&($('t2L').innerHTML='')
$('t2R')&&($('t2R').innerHTML='')

const SEP=new Set(["Ürün Kodu (Compel)","Ürün Kodu (T-Soft)","Stok (Compel)","EAN (Compel)"])
const NAR=new Set(["Sıra No","Marka","Ürün Kodu (Compel)","Ürün Kodu (T-Soft)"])
const W=[4,8,10,20,10,20,8,8,8,7,7]

const head=COLS.map(c=>{
const cls=[SEP.has(c)?'sepL':'',NAR.has(c)?'tightCol':''].filter(Boolean).join(' ')
return `<th class="${cls}"><span class="hTxt">${fmtHdr(disp(c))}</span></th>`
}).join('')

const rows=(R||[]).filter(x=>x._m)

const body=rows.map((r,i)=>`<tr>${
COLS.map(c=>{
let v=r[c]??''
if(c==="Sıra No")v=String(i+1)
if(c==="Ürün Adı (Compel)")return `<td class="left nameCell">${cellName(v,r._clink)}</td>`
if(c==="Ürün Adı (T-Soft)")return `<td class="left nameCell">${cellName(v,r._seo)}</td>`
const bad=(c==="EAN (T-Soft)"&&r._eanBad)||(c==="Stok (T-Soft)"&&r._stokBad)
const cls=[SEP.has(c)?'sepL':'',bad?'flagBad':'',NAR.has(c)?'tightCol':''].filter(Boolean).join(' ')
return `<td class="${cls}"><span class="cellTxt">${esc(v)}</span></td>`
}).join('')
}</tr>`).join('')

$('t1').innerHTML=colGrp(W)+`<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`

/* unmatched old */
const sec=$('unmatchedSection')
const U=Array.isArray(Ux)?Ux:[]
if(!U.length){sec&&(sec.style.display='none')}
else{
sec&&(sec.style.display='')
const W2=[4,10,10,18,10,18,10,20]
const body2=U.map((r,i)=>`<tr>
<td>${i+1}</td>
<td>${esc(r["Marka"]||'')}</td>
<td class="sepL">${esc(r["Compel Ürün Kodu"]||'')}</td>
<td>${esc(r["Compel Ürün Adı"]||'')}</td>
<td class="sepL">${esc(r["T-Soft Ürün Kodu"]||'')}</td>
<td>${esc(r["T-Soft Ürün Adı"]||'')}</td>
<td class="sepL">${esc(r["Aide Ürün Kodu"]||'')}</td>
<td>${esc(r["Aide Ürün Adı"]||'')}</td>
</tr>`).join('')
$('t2').innerHTML=colGrp(W2)+`<tbody>${body2}</tbody>`
}

const matched=rows.length
ui?.setChip?.('sum',`✓${matched} • ✕${(R||[]).length-matched}`,'muted')
$('dl1')&&($('dl1').disabled=!(R||[]).length)
},

/* ======================================================
   ALL MODE
====================================================== */
renderAll({rows=[],unmatchedTsoft=[],unmatchedAide=[]}={}){

$('unmatchedSection')&&( $('unmatchedSection').style.display='none' )
$('t2')&&($('t2').innerHTML='')

const view=(rows||[]).filter(r=>r._m)

const COLS_ALL=["Sıra","Marka","Ürün Kodu (T-Soft)","Ürün Adı (T-Soft)","Ürün Kodu (Aide)","Ürün Adı (Aide)","Stok (T-Soft)","Stok (Aide)"]
const SEP=new Set(["Ürün Kodu (T-Soft)","Ürün Kodu (Aide)","Stok (T-Soft)"])
const W=[6,12,14,22,14,22,5,5]

const head=COLS_ALL.map(c=>{
const cls=SEP.has(c)?'sepL':''
return `<th class="${cls}"><span class="hTxt">${fmtHdr(c)}</span></th>`
}).join('')

const body=view.map((r,i)=>{
const pulse=r._pulse?'stockPulse':''
const tPass=r._tpassive?'tsoftPassive':''
return `<tr class="${pulse}">
<td>${i+1}</td>
<td>${esc(r["Marka"]||'')}</td>
<td class="sepL">${esc(r["Ürün Kodu (T-Soft)"]||'')}</td>
<td class="left nameCell"><span class="nm ${tPass}">${esc(r["Ürün Adı (T-Soft)"]||'')}</span></td>
<td class="sepL">${esc(r["Ürün Kodu (Aide)"]||'')}</td>
<td class="left nameCell"><span class="nm">${esc(r["Ürün Adı (Aide)"]||'')}</span></td>
<td class="sepL">${fmtStockLabel(r["Stok (T-Soft)"])}</td>
<td>${fmtStockLabel(r["Stok (Aide)"])}</td>
</tr>`
}).join('')

$('t1').innerHTML=colGrp(W)+`<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`

/* split unmatched */
const split=$('unmatchedSplitSection')
if(!(unmatchedTsoft.length+unmatchedAide.length)){
split&&(split.style.display='none')
$('t2L')&&($('t2L').innerHTML='')
$('t2R')&&($('t2R').innerHTML='')
}else{
split&&(split.style.display='')
const cols=["Sıra","Marka","Ürün Kodu","Ürün Adı","Stok"]
const WU=[8,18,18,44,12]

const mk=(id,arr,label)=>{
const bodyU=arr.map((r,i)=>`<tr>
<td>${i+1}</td>
<td>${esc(r["Marka"]||'')}</td>
<td class="sepL">${esc(r["Ürün Kodu"]||'')}</td>
<td>${esc(r["Ürün Adı"]||'')}</td>
<td class="sepL">${fmtStockLabel(r["Stok"])}</td>
</tr>`).join('')
$(id).innerHTML=
colGrp(WU)+
`<thead><tr><th class="unmHead" colspan="5">${esc(label)}</th></tr></thead><tbody>${bodyU}</tbody>`
}

mk('t2L',unmatchedTsoft,"T-Soft'ta Aide ile Eşleşmeyen Ürünler")
mk('t2R',unmatchedAide,"Aide'de T-Soft ile Eşleşmeyen Ürünler")
}

ui?.setChip?.('sum',`✓${view.length} • ✕0`,'muted')
$('dl1')&&($('dl1').disabled=!view.length)
}

}
}
