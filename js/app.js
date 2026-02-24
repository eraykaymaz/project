// ./js/app.js
import {
  TR, esc, parseDelimited, pickColumn, readFileText, T, stockToNumber
} from "./utils.js";
import { loadBrands, scanCompel, dailyMeta, dailyGet, dailySave } from "./api.js";
import { createMatcher, normBrand } from "./match.js";
import { createDepot } from "./depot.js";
import { createRenderer } from "./render.js";

const $ = id => document.getElementById(id);
const API_BASE = "https://robot-workstation.tvkapora.workers.dev";

const SUP = { COMPEL:"Compel", ALL:"Tüm Markalar", AKALIN:"Akalın" };
let ACTIVE = SUP.COMPEL;

/* =======================================================
   1) GUIDE (yavaş → hızlı pulse sistemi)
======================================================= */

const GUIDE_DUR = { brand:1500, tsoft:1200, aide:900, list:650 };
let guideStep = "brand";

const clearPulse = () => {
  ["brandHintBtn","sescBox","depoBtn","go"].forEach(id=>{
    const el=$(id);
    if(!el) return;
    el.classList.remove("guidePulse");
    el.style.removeProperty("--guideDur");
  });
};

const setGuide = step => {
  guideStep = step;
  clearPulse();
  if(step==="done" || ACTIVE===SUP.AKALIN) return;
  const map={brand:"brandHintBtn",tsoft:"sescBox",aide:"depoBtn",list:"go"};
  const el=$(map[step]);
  if(!el) return;
  el.style.setProperty("--guideDur",`${GUIDE_DUR[step]}ms`);
  el.classList.add("guidePulse");
};

/* =======================================================
   2) BRAND STATE
======================================================= */

let BRANDS=[];
let SELECTED=new Set();
let hasListed=false;
let filterText="";
let expanded=false;

const updateBrandChip=()=>{
  const el=$("brandStatus");
  if(!el || ACTIVE===SUP.AKALIN) return;
  el.textContent=`Hazır • Marka: ${BRANDS.length}/${SELECTED.size}`;
};

const titleTR=s=>{
  const t=String(s||"").trim();
  return t.split(" ").map(w=>{
    const l=w.toLocaleLowerCase(TR);
    return l.charAt(0).toLocaleUpperCase(TR)+l.slice(1);
  }).join(" ");
};

/* =======================================================
   3) BRAND RENDER
======================================================= */

function visibleBrands(){
  const q=filterText.toLocaleLowerCase(TR);
  if(!q) return BRANDS;
  return BRANDS.filter(b=>b.name.toLocaleLowerCase(TR).includes(q));
}

function renderBrands(){
  const list=$("brandList");
  if(!list) return;

  list.innerHTML="";
  const vis=visibleBrands();

  const isAllMode=ACTIVE===SUP.ALL;
  const limit=isAllMode && !expanded && !filterText ? 3 : 9999;

  // ---- Marka Ara (sadece ALL modunda ortalı görünüm)
  const searchWrap=document.createElement("div");
  searchWrap.className="brand";
  searchWrap.style.flexBasis="100%";
  searchWrap.innerHTML=`
    <div class="bRow" style="width:100%;justify-content:center">
      <input id="brandSearchInput"
        style="width:100%;text-align:center;background:transparent;border:0;color:var(--text);font-weight:1100"
        placeholder="Marka Ara"
        value="${esc(filterText)}">
    </div>`;
  list.appendChild(searchWrap);

  // ---- Tümünü Seç (arama varken gizli)
  if(!filterText){
    const allBtn=document.createElement("div");
    allBtn.className="brand";
    allBtn.dataset.kind="all";
    allBtn.innerHTML=`<div class="bRow"><span class="bNm">Tümünü Seç</span></div>`;
    list.appendChild(allBtn);
  }

  // ---- Marka listesi
  vis.slice(0,limit).forEach(b=>{
    const d=document.createElement("div");
    d.className="brand"+(SELECTED.has(b.id)?" sel":"");
    d.dataset.id=b.id;
    d.dataset.kind="brand";
    d.innerHTML=`<div class="bRow">
      <span class="bNm">${esc(titleTR(b.name))}</span>
      <span class="bCt">(${b.count||"—"})</span>
    </div>`;
    list.appendChild(d);
  });

  // ---- Toggle (sadece ALL modunda)
  if(isAllMode && vis.length>3 && !filterText){
    const t=document.createElement("div");
    t.className="brand";
    t.dataset.kind="toggle";
    t.innerHTML=`<div class="bRow"><span class="bNm">
      ${expanded?"Listeyi Daralt":"Tüm Markaları Göster"}
    </span></div>`;
    list.appendChild(t);
  }

  updateBrandChip();

  // ---- input focus kaybetmesin
  const inp=$("brandSearchInput");
  if(inp){
    const pos=inp.selectionStart;
    inp.addEventListener("input",e=>{
      filterText=e.target.value||"";
      renderBrands();
    });
    setTimeout(()=>{
      const i=$("brandSearchInput");
      if(i){
        i.focus();
        i.setSelectionRange(pos,pos);
      }
    },0);
  }
}

/* =======================================================
   4) BRAND EVENTS
======================================================= */

$("brandList")?.addEventListener("click",e=>{
  const el=e.target.closest(".brand");
  if(!el) return;
  const k=el.dataset.kind;
  if(k==="brand"){
    const id=Number(el.dataset.id);
    SELECTED.has(id)?SELECTED.delete(id):SELECTED.add(id);
    renderBrands();
    if(!hasListed) setGuide("tsoft");
  }
  if(k==="all"){
    visibleBrands().forEach(b=>SELECTED.add(b.id));
    renderBrands();
  }
  if(k==="toggle"){
    expanded=!expanded;
    renderBrands();
  }
});

/* =======================================================
   (DEVAM PARÇA 2)
======================================================= */

/* =======================================================
   5) SUPPLIER DROPDOWN
======================================================= */

(function(){
  const btn=$("supplierBtn"),
        menu=$("supplierMenu"),
        wrap=$("supplierWrap");

  if(!btn||!menu||!wrap) return;

  const close=()=>{
    menu.classList.remove("show");
    btn.setAttribute("aria-expanded","false");
  };

  const open=()=>{
    menu.classList.add("show");
    btn.setAttribute("aria-expanded","true");
  };

  btn.onclick=e=>{
    e.preventDefault();
    menu.classList.contains("show")?close():open();
  };

  document.addEventListener("click",e=>{
    !wrap.contains(e.target)&&close();
  });

  menu.addEventListener("click",async e=>{
    const t=e.target.closest(".ddItem");
    if(!t) return;
    const name=t.textContent.trim().replace(" (seçili)","");
    if(name===ACTIVE) return close();

    ACTIVE=name;

    $("supplierLabel").textContent=`1) Tedarikçi: ${name}`;

    SELECTED.clear();
    filterText="";
    expanded=false;
    hasListed=false;

    if(name===SUP.ALL){
      BRANDS=(await loadBrands(API_BASE)).map((b,i)=>({
        ...b,id:i+1
      }));
    }else if(name===SUP.COMPEL){
      BRANDS=await loadBrands(API_BASE);
    }else{
      BRANDS=[];
    }

    renderBrands();
    setGuide("brand");
    close();
  });
})();

/* =======================================================
   6) DEPOT + MATCHER + RENDERER
======================================================= */

const depot=createDepot({
  normBrand,
  onDepotLoaded:()=>{
    if(!hasListed) setGuide("list");
  }
});

const matcher=createMatcher({
  getDepotAgg:()=>depot.agg,
  isDepotReady:()=>depot.isReady()
});

const renderer=createRenderer({});

/* =======================================================
   7) LIST TITLE
======================================================= */

let listTitleEl=null;

function ensureTitle(){
  if(listTitleEl) return;
  const main=document.querySelector("section.maincol");
  if(!main) return;
  const sep=document.createElement("div");
  sep.className="rowSep";
  listTitleEl=document.createElement("div");
  listTitleEl.className="listTitleBar";
  main.insertBefore(sep,main.firstChild);
  main.insertBefore(listTitleEl,main.firstChild);
  listTitleEl.style.display="none";
}

function showTitle(text){
  ensureTitle();
  listTitleEl.textContent=text;
  listTitleEl.style.display="";
}

function hideTitle(){
  listTitleEl&&(listTitleEl.style.display="none");
}

/* =======================================================
   8) CLEAR
======================================================= */

function clearLists(){
  ["t1","t2","t2L","t2R"].forEach(id=>{
    const el=$(id);
    el&&(el.innerHTML="");
  });
  hideTitle();
}

/* =======================================================
   9) GO BUTTON
======================================================= */

$("go")?.addEventListener("click",async ()=>{
  if(ACTIVE===SUP.AKALIN) return;

  if(!SELECTED.size){
    alert("Lütfen marka seçin.");
    return;
  }

  setGuide("done");
  clearLists();

  if(ACTIVE===SUP.COMPEL){
    await generateCompel();
  }else if(ACTIVE===SUP.ALL){
    await generateAll();
  }

  hasListed=true;
});

/* =======================================================
   (DEVAM PARÇA 3)
======================================================= */
/* =======================================================
   10) GENERATE – COMPEL MODE
======================================================= */

async function generateCompel(){
  const file=$("f2")?.files?.[0];
  if(!file){ alert("T-Soft CSV seçin."); return; }

  setGuide("aide");

  const t2txt=await readFileText(file);
  const p2=parseDelimited(t2txt);
  if(!p2.rows.length){ alert("T-Soft CSV boş."); return; }

  const sample=p2.rows[0];

  const C2={
    sup:pickColumn(sample,["Tedarikçi Ürün Kodu"]),
    marka:pickColumn(sample,["Marka"]),
    urunAdi:pickColumn(sample,["Ürün Adı"]),
    stok:pickColumn(sample,["Stok"])
  };

  const L2=p2.rows.filter(r=>{
    const bn=normBrand(r[C2.marka]||"");
    return [...SELECTED].some(id=>{
      const b=BRANDS.find(x=>x.id===id);
      return normBrand(b?.name||"")===bn;
    });
  });

  matcher.loadData({
    l1:[],c1:{},
    l2:L2,c2:C2,
    l2All:p2.rows
  });

  matcher.runMatch();
  const {R}=matcher.getResults();

  renderer.render(R,[],depot.isReady());

  showTitle("Compel Karşılaştırma Listesi");
}

/* =======================================================
   11) GENERATE – TÜM MARKALAR MODE
======================================================= */

async function generateAll(){
  const file=$("f2")?.files?.[0];
  if(!file){ alert("T-Soft CSV seçin."); return; }
  if(!depot.isReady()){ alert("Aide verisi yükleyin."); return; }

  setGuide("list");

  const raw=await readFileText(file);
  const p=parseDelimited(raw);
  if(!p.rows.length){ alert("T-Soft CSV boş."); return; }

  const sample=p.rows[0];

  const C={
    sup:pickColumn(sample,["Tedarikçi Ürün Kodu"]),
    marka:pickColumn(sample,["Marka"]),
    urunAdi:pickColumn(sample,["Ürün Adı"]),
    stok:pickColumn(sample,["Stok"])
  };

  const tMap=new Map();
  for(const r of p.rows){
    const bn=normBrand(r[C.marka]||"");
    if(!bn) continue;

    const bSel=[...SELECTED].some(id=>{
      const b=BRANDS.find(x=>x.id===id);
      return normBrand(b?.name||"")===bn;
    });
    if(!bSel) continue;

    const code=(r[C.sup]||"").trim();
    if(!code) continue;

    tMap.has(bn)||tMap.set(bn,new Map());
    tMap.get(bn).set(code,{
      name:r[C.urunAdi]||"",
      stok:stockToNumber(r[C.stok])
    });
  }

  const aideMap=depot.getBrandItemMap();

  const rows=[];
  const unmatchedT=[];
  const unmatchedA=[];

  for(const [bn,tItems] of tMap.entries()){
    const aItems=aideMap.get(bn)||new Map();

    const codes=new Set([...tItems.keys(),...aItems.keys()]);

    for(const code of codes){
      const t=tItems.get(code);
      const a=aItems.get(code);

      if(t && a){
        rows.push({
          "Marka":bn,
          "Ürün Kodu (T-Soft)":code,
          "Ürün Adı (T-Soft)":t.name,
          "Ürün Kodu (Aide)":code,
          "Ürün Adı (Aide)":a.name,
          "Stok (T-Soft)":t.stok,
          "Stok (Aide)":a.num,
          _m:true,
          _pulse:(t.stok>0)!==(a.num>0)
        });
      }else if(t){
        unmatchedT.push({
          "Marka":bn,
          "Ürün Kodu":code,
          "Ürün Adı":t.name,
          "Stok":t.stok
        });
      }else if(a){
        unmatchedA.push({
          "Marka":bn,
          "Ürün Kodu":code,
          "Ürün Adı":a.name,
          "Stok":a.num
        });
      }
    }
  }

  renderer.renderAll({
    rows,
    unmatchedTsoft:unmatchedT,
    unmatchedAide:unmatchedA
  });

  showTitle("Tüm Markalar Karşılaştırma Listesi");
}

/* =======================================================
   12) TSOFT FILE CHANGE → PULSE GEÇİŞ
======================================================= */

$("f2")?.addEventListener("change",()=>{
  if($("f2").files?.length){
    setGuide("aide");
  }
});

/* =======================================================
   13) AIDE LOAD → PULSE GEÇİŞ
======================================================= */

document.addEventListener("depotLoaded",()=>{
  setGuide("list");
});

/* =======================================================
   14) INIT
======================================================= */

(async function init(){
  if(ACTIVE===SUP.COMPEL){
    BRANDS=await loadBrands(API_BASE);
  }else if(ACTIVE===SUP.ALL){
    BRANDS=(await loadBrands(API_BASE))
      .map((b,i)=>({...b,id:i+1}));
  }
  renderBrands();
  setGuide("brand");
})();
