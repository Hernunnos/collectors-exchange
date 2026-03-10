import { useState, useEffect, useMemo, useRef, useCallback } from "react";


// ── Mobile hook ───────────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth <= 480);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 480);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}
// ── Data ─────────────────────────────────────────────────────────────────────
const CARDS = [
  { id:1,  name:"Charizard",             set:"Base Set",           condition:"PSA 10", rarity:"Holo Rare",    game:"Pokémon",          img:"https://images.pokemontcg.io/base1/4_hires.png" },
  { id:2,  name:"Black Lotus",           set:"Alpha",              condition:"NM",     rarity:"Rare",         game:"MTG",              img:"https://cards.scryfall.io/large/front/b/d/bd8fa327-dd41-4737-8f19-2cf5eb1f7cdd.jpg" },
  { id:3,  name:"Pikachu Illustrator",   set:"CoroCoro",           condition:"PSA 9",  rarity:"Promo",        game:"Pokémon",          img:"https://images.pokemontcg.io/basep/1_hires.png" },
  { id:4,  name:"Blastoise",             set:"Base Set",           condition:"PSA 8",  rarity:"Holo Rare",    game:"Pokémon",          img:"https://images.pokemontcg.io/base1/2_hires.png" },
  { id:5,  name:"Mewtwo",                set:"Base Set",           condition:"PSA 9",  rarity:"Holo Rare",    game:"Pokémon",          img:"https://images.pokemontcg.io/base1/9_hires.png" },
  { id:6,  name:"Ancestral Recall",      set:"Alpha",              condition:"NM",     rarity:"Rare",         game:"MTG",              img:"https://cards.scryfall.io/large/front/7/0/70e7ddf2-5604-41e7-bb9d-ddd03d3e9d0b.jpg" },
  { id:7,  name:"Time Walk",             set:"Alpha",              condition:"NM",     rarity:"Rare",         game:"MTG",              img:"https://cards.scryfall.io/large/front/e/0/e0139f60-d48e-46fb-9f5a-1e3d7558c834.jpg" },
  { id:8,  name:"Mox Sapphire",          set:"Alpha",              condition:"NM",     rarity:"Rare",         game:"MTG",              img:"https://cards.scryfall.io/large/front/8/2/82da0972-b17b-4600-9efd-e9430a0db04b.jpg" },
  { id:9,  name:"Underground Sea",       set:"Alpha",              condition:"NM",     rarity:"Rare",         game:"MTG",              img:"https://cards.scryfall.io/large/front/f/f/ff76ac86-8a8a-47fe-9388-8950ca3e26c3.jpg" },
  { id:10, name:"Fyendal's Spring Tunic", set:"Welcome to Rathe", condition:"NM",     rarity:"Legendary", game:"Flesh and Blood", img:"https://d2wlb52bya4y8z.cloudfront.net/media/cards/large/WTR150-CF.webp" },
  { id:11, name:"Heart of Fyendal",      set:"Welcome to Rathe", condition:"NM",     rarity:"Fabled",    game:"Flesh and Blood", img:"https://d2wlb52bya4y8z.cloudfront.net/media/cards/large/WTR000-CF.webp" },
  { id:12, name:"Dawnblade",             set:"Welcome to Rathe", condition:"NM",     rarity:"Legendary", game:"Flesh and Blood", img:"https://d2wlb52bya4y8z.cloudfront.net/media/cards/large/WTR115.webp" },
  { id:13, name:"Anothos",               set:"Welcome to Rathe", condition:"NM",     rarity:"Legendary", game:"Flesh and Blood", img:"https://d2wlb52bya4y8z.cloudfront.net/media/cards/large/WTR040.webp" },
  { id:14, name:"Arcane Lantern",        set:"Everfest",         condition:"NM",     rarity:"Rare",      game:"Flesh and Blood", img:"https://d2wlb52bya4y8z.cloudfront.net/media/cards/large/EVR155-CF.webp" },
  { id:15, name:"Enlightened Strike",    set:"Welcome to Rathe", condition:"PSA 9",  rarity:"Legendary", game:"Flesh and Blood", img:"https://d2wlb52bya4y8z.cloudfront.net/media/cards/large/WTR159.webp" },
];
const BASE = { 1:420, 2:8500, 3:74000, 4:280, 5:310, 6:4200, 7:2800, 8:3900, 9:1800, 10:380, 11:2200, 12:290, 13:260, 14:95, 15:220 };

// ── Trading state helpers ─────────────────────────────────────────────────────
const STARTING_BALANCE = 15000;
let _orderId = 1000;
let _tradeId = 1000;
const newOrderId  = () => `ORD-${++_orderId}`;
const newTradeId  = () => `TRD-${++_tradeId}`;
const nowDate = () => new Date().toISOString().slice(0,10);
const nowTime = () => new Date().toLocaleTimeString("en-US",{hour12:false});

// Proxy scryfall images through wsrv.nl to avoid CORB blocking
const proxyImg = (url) => {
  if(!url) return url;
  if(url.includes("scryfall.io")) return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400&output=jpg`;
  return url;
};

// Match engine: given user orders + live market asks/bids, fill what can be filled
function matchOrders(orders, marketPrices, holdings, balance){
  let newOrders = orders.map(o=>({...o}));
  let newHoldings = holdings.map(h=>({...h}));
  let newBalance = balance;
  const newTrades = [];

  for(let o of newOrders){
    if(o.status !== "open" && o.status !== "partial") continue;
    const mktPrice = marketPrices[o.cardId] || 0;
    const remaining = o.qty - o.filled;
    if(remaining <= 0){ o.status="filled"; continue; }

    let fillPrice = null;
    if(o.type === "market"){
      fillPrice = mktPrice;
    } else if(o.side === "buy" && o.price >= mktPrice){
      fillPrice = o.price;
    } else if(o.side === "sell" && o.price <= mktPrice){
      fillPrice = o.price;
    }

    if(fillPrice !== null){
      const fillQty = remaining;
      const total = +(fillPrice * fillQty).toFixed(2);

      if(o.side === "buy"){
        if(newBalance < total) continue; // not enough funds
        newBalance = +(newBalance - total).toFixed(2);
        const idx = newHoldings.findIndex(h=>h.cardId===o.cardId);
        if(idx>=0){
          const h = newHoldings[idx];
          const newQty = h.qty + fillQty;
          const newAvg = +((h.avgCost*h.qty + fillPrice*fillQty)/newQty).toFixed(2);
          newHoldings[idx] = {...h, qty:newQty, avgCost:newAvg};
        } else {
          newHoldings.push({cardId:o.cardId, qty:fillQty, avgCost:fillPrice, acquired:nowDate()});
        }
      } else {
        const idx = newHoldings.findIndex(h=>h.cardId===o.cardId);
        if(idx<0) continue; // don't own any
        const h = newHoldings[idx];
        const locked = h.lockedQty || 0;
        const freeQty = h.qty - locked;
        if(freeQty < fillQty) continue; // not enough unlocked cards
        newBalance = +(newBalance + total).toFixed(2);
        const newQty = h.qty - fillQty;
        const newLocked = Math.max(0, locked - fillQty); // release the lock on fill
        if(newQty === 0) newHoldings.splice(idx,1);
        else newHoldings[idx] = {...h, qty:newQty, lockedQty:newLocked};
      }

      o.filled += fillQty;
      o.status = o.filled >= o.qty ? "filled" : "partial";
      newTrades.push({
        id: newTradeId(), cardId: o.cardId, side: o.side,
        price: fillPrice, qty: fillQty, total,
        date: nowDate(), time: nowTime()
      });
    }
  }
  return { orders: newOrders, holdings: newHoldings, balance: newBalance, newTrades };
}

const SAMPLE_ALERTS = [
  { id:"ALT-001", cardId:1, condition:"above", target:430.00,  triggered:true,  triggeredAt:"2026-03-07 14:22", active:false },
  { id:"ALT-002", cardId:2, condition:"below", target:8400.00, triggered:false, triggeredAt:null,               active:true  },
  { id:"ALT-003", cardId:5, condition:"above", target:320.00,  triggered:false, triggeredAt:null,               active:true  },
];

function genOrders(base, n, side) {
  return Array.from({length:n},(_,i)=>{
    const off=(i+1)*(Math.random()*0.8+0.2);
    const price=side==="ask"?+(base+off*base*0.003).toFixed(2):+(base-off*base*0.003).toFixed(2);
    const qty=Math.floor(Math.random()*5)+1;
    return {price,qty,total:+(price*qty).toFixed(2)};
  }).sort((a,b)=>side==="ask"?a.price-b.price:b.price-a.price);
}
function genTrade(base){
  return {price:+(base+(Math.random()-0.48)*base*0.006).toFixed(2),qty:Math.floor(Math.random()*3)+1,side:Math.random()>0.5?"buy":"sell",time:new Date().toLocaleTimeString("en-US",{hour12:false}),id:Math.random()};
}
function genHist(base){return Array.from({length:60},()=>({p:base+(Math.random()-0.5)*base*0.05}));}

// ── Themes ───────────────────────────────────────────────────────────────────
const DK={bg:"#070a0e",bg2:"#080c09",bg3:"#0a0f0a",bdr:"#0f1f0f",bdr2:"#1a2e1a",txt:"#a8b8a0",txtD:"#2a5a2a",txtM:"#4a8a4a",acc:"#00ff50",accD:"#00cc40",hdrBg:"#080c08",stBg:"#0a100a",buyT:"#00ff50",sellT:"#ff4040",askT:"#cc3535",bidT:"#00cc40",inBg:"#0a0f0a",inBdr:"#1a2a1a",rowHov:"rgba(0,255,80,0.04)",shad:"0 1px 12px rgba(0,0,0,0.5)"};
const LT={bg:"#f0f4f0",bg2:"#ffffff",bg3:"#f8faf8",bdr:"#dde8dd",bdr2:"#b8d4b8",txt:"#2a3a2a",txtD:"#7a9a7a",txtM:"#3a7a3a",acc:"#16803a",accD:"#15803d",hdrBg:"#ffffff",stBg:"#f0f6f0",buyT:"#15803d",sellT:"#dc2626",askT:"#dc2626",bidT:"#15803d",inBg:"#f8faf8",inBdr:"#c5d8c5",rowHov:"rgba(22,128,58,0.04)",shad:"0 1px 6px rgba(0,0,0,0.08)"};
const MONO="'Share Tech Mono','Courier New',monospace";
const ORB="'Orbitron',sans-serif";

// ── Portfolio ─────────────────────────────────────────────────────────────────
function Portfolio({D,dark,holdings=[],tradeHistory=[],dbCards=[],isMobile=false,onNavigateToMarket}){
  const [selected,setSelected]=useState(null);
  const [watchlist,setWatchlist]=useState([CARDS[1],CARDS[2]]);

  const allCards=[...dbCards,...CARDS];
  const enrichedHoldings=holdings.map(h=>{
    const card=allCards.find(c=>c.id===h.cardId)||{name:"Unknown",img:"",set:"",condition:""};
    const cur=+(card.basePrice||BASE[h.cardId]||h.avgCost);
    const val=+(cur*h.qty).toFixed(2);
    const cost=+(h.avgCost*h.qty).toFixed(2);
    const pnl=+(val-cost).toFixed(2);
    const pct=cost>0?+((pnl/cost)*100).toFixed(2):0;
    return {...h,card,cur,val,cost,pnl,pct};
  });

  const totalVal=+enrichedHoldings.reduce((s,h)=>s+h.val,0).toFixed(2);
  const totalCost=+enrichedHoldings.reduce((s,h)=>s+h.cost,0).toFixed(2);
  const totalPnl=+(totalVal-totalCost).toFixed(2);
  const totalPct=+((totalPnl/totalCost)*100).toFixed(2);

  const portHist=useMemo(()=>Array.from({length:30},(_,i)=>totalCost*(0.9+i*0.005)+(Math.random()-0.4)*totalCost*0.02),[totalCost]);
  const minH=Math.min(...portHist),maxH=Math.max(...portHist),rngH=maxH-minH||1;
  const sp=portHist.map((v,i)=>`${i===0?"M":"L"}${((i/(portHist.length-1))*400).toFixed(1)},${(60-((v-minH)/rngH)*54).toFixed(1)}`).join(" ");

  return(
    <div style={{flex:1,overflowY:"auto",padding:isMobile?"12px":"20px",display:"flex",flexDirection:"column",gap:"16px"}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:"12px"}}>
        {[["TOTAL VALUE",`$${totalVal.toLocaleString("en-US",{minimumFractionDigits:2})}`,""],["TOTAL COST",`$${totalCost.toLocaleString("en-US",{minimumFractionDigits:2})}`,""],["UNREALISED P&L",`${totalPnl>=0?"+":""}$${Math.abs(totalPnl).toLocaleString("en-US",{minimumFractionDigits:2})}`,totalPnl>=0?"up":"dn"],["RETURN",`${totalPct>=0?"+":""}${totalPct}%`,totalPct>=0?"up":"dn"]].map(([label,val,dir])=>(
          <div key={label} style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px",padding:"14px 16px"}}>
            <div style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.12em",marginBottom:"8px"}}>{label}</div>
            <div style={{fontFamily:ORB,fontSize:"26px",fontWeight:700,color:dir==="up"?D.buyT:dir==="dn"?D.askT:D.txt}}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px",padding:"14px 16px"}}>
        <div style={{color:D.txtD,fontSize:"14px",letterSpacing:"0.12em",marginBottom:"10px"}}>▸ PORTFOLIO VALUE — 30 DAYS</div>
        <svg width="100%" height="70" viewBox="0 0 400 65" preserveAspectRatio="none" style={{display:"block"}}>
          <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={D.accD} stopOpacity={dark?"0.18":"0.10"}/><stop offset="100%" stopColor={D.accD} stopOpacity="0"/></linearGradient></defs>
          {[0.25,0.5,0.75].map(f=><line key={f} x1="0" y1={65*f} x2="400" y2={65*f} stroke={D.bdr} strokeWidth="0.5"/>)}
          <path d={sp+` L400,65 L0,65 Z`} fill="url(#pg)"/>
          <path d={sp} fill="none" stroke={D.accD} strokeWidth="2" style={{filter:dark?`drop-shadow(0 0 4px ${D.accD}80)`:"none"}}/>
        </svg>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"16px"}}>
        <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px",overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${D.bdr}`,color:D.txtD,fontSize:"14px",letterSpacing:"0.12em"}}>▸ HOLDINGS</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 50px 70px 70px 70px 32px",padding:"5px 14px",color:D.txtD,fontSize:"13px",borderBottom:`1px solid ${D.bdr}`}}>
            <span>CARD</span><span style={{textAlign:"right"}}>QTY</span><span style={{textAlign:"right"}}>PRICE</span><span style={{textAlign:"right"}}>VALUE</span><span style={{textAlign:"right"}}>P&L</span><span/>
          </div>
          {enrichedHoldings.length===0?(<div style={{padding:"40px",textAlign:"center",color:D.txtD,fontSize:"17px"}}>No holdings yet — place your first trade in the Market tab</div>):enrichedHoldings.map(h=>(
            <div key={h.cardId} onClick={()=>setSelected(selected?.cardId===h.cardId?null:h)} style={{display:"grid",gridTemplateColumns:"1fr 50px 70px 70px 70px 32px",padding:"9px 14px",borderBottom:`1px solid ${D.bdr}`,cursor:"pointer",background:selected?.cardId===h.cardId?(dark?"rgba(0,255,80,0.05)":"rgba(22,128,58,0.05)"):"transparent",transition:"background 0.1s",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <img src={proxyImg(h.card.img)} alt={h.card.name} style={{width:"22px",height:"30px",objectFit:"cover",borderRadius:"2px"}} onError={e=>e.target.style.display="none"}/>
                <div><div style={{color:D.txt,fontSize:"16px"}}>{h.card.name}</div><div style={{color:D.txtD,fontSize:"13px"}}>{h.card.condition}</div></div>
              </div>
              <span style={{textAlign:"right",color:D.txtM,fontSize:"16px"}}>
                {h.qty}
                {(h.lockedQty||0)>0&&<span title={`${h.lockedQty} locked in open sell orders`} style={{color:"#f59e0b",fontSize:"13px",display:"block"}}>🔒{h.lockedQty}</span>}
              </span>
              <span style={{textAlign:"right",color:D.txt,fontSize:"16px"}}>${h.cur.toLocaleString()}</span>
              <span style={{textAlign:"right",color:D.txt,fontSize:"16px"}}>${h.val.toLocaleString()}</span>
              <span style={{textAlign:"right",color:h.pnl>=0?D.buyT:D.askT,fontSize:"16px"}}>{h.pnl>=0?"+":""}${Math.abs(h.pnl).toLocaleString()}</span>
              <span onClick={e=>{e.stopPropagation();onNavigateToMarket&&onNavigateToMarket(h.card);}} title="Go to market" style={{textAlign:"right",color:D.accD,fontSize:"18px",cursor:"pointer",opacity:0.7,transition:"opacity 0.1s"}} onMouseEnter={e=>e.target.style.opacity=1} onMouseLeave={e=>e.target.style.opacity=0.7}>→</span>
            </div>
          ))}
          {selected && (
            <div style={{borderTop:`1px solid ${D.bdr}`,padding:"10px 14px"}}>
              <div style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.1em",marginBottom:"8px"}}>▸ TRADES — {selected.card.name}</div>
              {tradeHistory.filter(t=>t.cardId===selected.cardId).map(t=>(
                <div key={t.id} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${D.bdr}`}}>
                  <span style={{color:t.side==="buy"?D.buyT:D.askT,fontSize:"14px"}}>{t.side.toUpperCase()}</span>
                  <span style={{color:D.txtM,fontSize:"14px"}}>{t.qty}x @ ${t.price.toLocaleString()}</span>
                  <span style={{color:D.txtD,fontSize:"14px"}}>{t.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px",overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${D.bdr}`,color:D.txtD,fontSize:"14px",letterSpacing:"0.12em",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>▸ WATCHLIST</span>
            <span style={{color:D.accD,fontSize:"13px",cursor:"pointer"}}>+ ADD</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 28px 28px",padding:"5px 14px",color:D.txtD,fontSize:"13px",borderBottom:`1px solid ${D.bdr}`}}>
            <span>CARD</span><span style={{textAlign:"right"}}>PRICE</span><span style={{textAlign:"right"}}>24H</span><span/><span/>
          </div>
          {watchlist.map(c=>{
            const chg=(((c.id*11+7)%19-9)*0.55).toFixed(2);const up=+chg>=0;
            return(
              <div key={c.id} style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 28px 28px",padding:"9px 14px",borderBottom:`1px solid ${D.bdr}`,alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <img src={proxyImg(c.img)} alt={c.name} style={{width:"22px",height:"30px",objectFit:"cover",borderRadius:"2px"}} onError={e=>e.target.style.display="none"}/>
                  <div><div style={{color:D.txt,fontSize:"16px"}}>{c.name}</div><div style={{color:D.txtD,fontSize:"13px"}}>{c.set}</div></div>
                </div>
                <span style={{textAlign:"right",color:D.txt,fontSize:"16px"}}>${(c.basePrice||BASE[c.id]||0).toLocaleString()}</span>
                <span style={{textAlign:"right",color:up?D.buyT:D.askT,fontSize:"16px"}}>{up?"+":""}{chg}%</span>
                <span onClick={()=>onNavigateToMarket&&onNavigateToMarket(c)} title="Go to market" style={{textAlign:"right",color:D.accD,fontSize:"18px",cursor:"pointer",opacity:0.7,transition:"opacity 0.1s"}} onMouseEnter={e=>e.target.style.opacity=1} onMouseLeave={e=>e.target.style.opacity=0.7}>→</span>
                <span onClick={()=>setWatchlist(w=>w.filter(x=>x.id!==c.id))} style={{textAlign:"right",color:D.txtD,fontSize:"23px",cursor:"pointer",lineHeight:1}}>×</span>
              </div>
            );
          })}
          {CARDS.filter(c=>!watchlist.find(w=>w.id===c.id)&&!holdings.find(h=>h.cardId===c.id)).slice(0,2).map(c=>(
            <div key={c.id} onClick={()=>setWatchlist(w=>[...w,c])} style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 14px",borderBottom:`1px solid ${D.bdr}`,cursor:"pointer",opacity:0.5}}>
              <span style={{color:D.accD,fontSize:"16px"}}>+</span>
              <img src={proxyImg(c.img)} alt={c.name} style={{width:"18px",height:"25px",objectFit:"cover",borderRadius:"2px"}} onError={e=>e.target.style.display="none"}/>
              <span style={{color:D.txtM,fontSize:"16px"}}>{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Orders ────────────────────────────────────────────────────────────────────
function Orders({D,dark,orders=[],onCancel,dbCards=[],isMobile=false}){
  const [filter,setFilter]=useState("all");
  const allCards=[...dbCards,...CARDS];
  const cancel=id=>{ if(onCancel) onCancel(id); };
  const filtered=filter==="all"?orders:orders.filter(o=>o.status===filter);
  const sColor=s=>s==="open"?D.buyT:s==="partial"?"#f59e0b":D.txtD;
  const sBg=s=>s==="open"?(dark?"rgba(0,200,60,0.08)":"rgba(22,128,58,0.08)"):s==="partial"?(dark?"rgba(245,158,11,0.08)":"rgba(245,158,11,0.06)"):dark?"rgba(80,80,80,0.08)":"rgba(80,80,80,0.04)";

  return(
    <div style={{flex:1,overflowY:"auto",padding:isMobile?"12px":"20px",display:"flex",flexDirection:"column",gap:"16px"}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:"12px"}}>
        {[["OPEN",orders.filter(o=>o.status==="open").length],["PARTIAL",orders.filter(o=>o.status==="partial").length],["FILLED",orders.filter(o=>o.status==="filled").length],["TOTAL",orders.length]].map(([label,val])=>(
          <div key={label} style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px",padding:"14px 16px"}}>
            <div style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.12em",marginBottom:"8px"}}>{label} ORDERS</div>
            <div style={{fontFamily:ORB,fontSize:"31px",fontWeight:700,color:D.txt}}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px",overflow:"hidden"}}>
        <div style={{display:"flex",borderBottom:`1px solid ${D.bdr}`,padding:"0 14px"}}>
          {["all","open","partial","cancelled"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{padding:"10px 14px",border:"none",background:"transparent",color:filter===f?D.accD:D.txtD,fontSize:"14px",fontFamily:MONO,letterSpacing:"0.1em",cursor:"pointer",borderBottom:`2px solid ${filter===f?D.accD:"transparent"}`,transition:"all 0.1s"}}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        {isMobile?(
          /* Mobile: card-style order list */
          <>
            {filtered.length===0&&<div style={{padding:"40px",textAlign:"center",color:D.txtD,fontSize:"16px"}}>{filter==="all"?"No orders yet":"No "+filter+" orders"}</div>}
            {filtered.map(o=>{
              const card=allCards.find(c=>c.id===o.cardId)||{name:"Unknown",img:"",img_url:""};
              return(
                <div key={o.id} style={{padding:"12px 14px",borderBottom:`1px solid ${D.bdr}`,display:"flex",alignItems:"center",gap:"12px"}}>
                  <img src={proxyImg(card.img||card.img_url)} alt={card.name} style={{width:"28px",height:"38px",objectFit:"cover",borderRadius:"3px",flexShrink:0}} onError={e=>e.target.style.display="none"}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3px"}}>
                      <span style={{color:D.txt,fontSize:"17px",fontWeight:600}}>{card.name}</span>
                      <span style={{background:sBg(o.status),color:sColor(o.status),padding:"2px 6px",borderRadius:"3px",fontSize:"13px"}}>{o.status.toUpperCase()}</span>
                    </div>
                    <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
                      <span style={{color:o.side==="buy"?D.buyT:D.askT,fontSize:"16px"}}>{o.side.toUpperCase()}</span>
                      <span style={{color:D.txtD,fontSize:"14px"}}>{o.type.toUpperCase()}</span>
                      <span style={{color:D.txtM,fontSize:"16px"}}>${o.price.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                      <span style={{color:D.txtD,fontSize:"14px"}}>×{o.qty}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:"4px",alignItems:"center"}}>
                      <span style={{color:D.txtD,fontSize:"13px"}}>{o.id} · {o.date}</span>
                      {(o.status==="open"||o.status==="partial")&&(
                        <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                          {o.expiry&&o.expiry!=="gtc"&&(
                            <span style={{color:D.txtD,fontSize:"12px",padding:"2px 6px",border:`1px solid ${D.bdr}`,borderRadius:"3px",fontFamily:MONO}}>
                              {o.expiry==="day"?"DAY":o.expiry==="week"?"WEEK":o.expiry==="month"?"MONTH":"GTC"}
                            </span>
                          )}
                          <button onClick={()=>cancel(o.id)} style={{padding:"3px 10px",background:dark?"rgba(220,50,50,0.12)":"rgba(220,50,50,0.08)",border:`1px solid ${dark?"#5a1a1a":"#e07070"}`,borderRadius:"3px",color:D.askT,fontSize:"13px",fontFamily:MONO,cursor:"pointer"}}>CANCEL</button>
                        </div>
                      )}
                      {o.status==="expired"&&<span style={{color:"#f59e0b",fontSize:"13px",fontFamily:MONO}}>EXPIRED</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ):(
          <>
            <div style={{display:"grid",gridTemplateColumns:"90px 1fr 50px 60px 80px 60px 80px 70px",padding:"6px 14px",color:D.txtD,fontSize:"13px",borderBottom:`1px solid ${D.bdr}`,letterSpacing:"0.08em"}}>
              <span>ORDER ID</span><span>CARD</span><span>SIDE</span><span>TYPE</span><span style={{textAlign:"right"}}>PRICE</span><span style={{textAlign:"right"}}>QTY</span><span style={{textAlign:"right"}}>STATUS</span><span style={{textAlign:"right"}}>ACTION</span>
            </div>
            {filtered.length===0&&<div style={{padding:"40px",textAlign:"center",color:D.txtD,fontSize:"16px"}}>{filter==="all"?"No orders yet — place your first trade in the Market tab":`No ${filter} orders`}</div>}
            {filtered.map(o=>{
              const card=allCards.find(c=>c.id===o.cardId)||{name:"Unknown",img:"",img_url:""};
              return(
                <div key={o.id} style={{display:"grid",gridTemplateColumns:"90px 1fr 50px 60px 80px 60px 80px 70px",padding:"10px 14px",borderBottom:`1px solid ${D.bdr}`,alignItems:"center"}}>
                  <span style={{color:D.txtM,fontSize:"14px"}}>{o.id}</span>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <img src={proxyImg(card.img)} alt={card.name} style={{width:"20px",height:"28px",objectFit:"cover",borderRadius:"2px"}} onError={e=>e.target.style.display="none"}/>
                    <div><div style={{color:D.txt,fontSize:"16px"}}>{card.name}</div><div style={{color:D.txtD,fontSize:"13px"}}>{o.date} {o.time}</div></div>
                  </div>
                  <span style={{color:o.side==="buy"?D.buyT:D.askT,fontSize:"14px"}}>{o.side.toUpperCase()}</span>
                  <span style={{color:D.txtM,fontSize:"14px"}}>{o.type.toUpperCase()}</span>
                  <span style={{textAlign:"right",color:D.txt,fontSize:"16px"}}>${o.price.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                  <span style={{textAlign:"right",color:D.txtM,fontSize:"16px"}}>{o.filled}/{o.qty}</span>
                  <div style={{textAlign:"right"}}><span style={{background:sBg(o.status),color:sColor(o.status),padding:"2px 7px",borderRadius:"3px",fontSize:"13px"}}>{o.status.toUpperCase()}</span></div>
                  <div style={{textAlign:"right"}}>
                    {(o.status==="open"||o.status==="partial")?(
                      <button onClick={()=>cancel(o.id)} style={{padding:"3px 8px",background:dark?"rgba(220,50,50,0.12)":"rgba(220,50,50,0.08)",border:`1px solid ${dark?"#5a1a1a":"#e07070"}`,borderRadius:"3px",color:D.askT,fontSize:"13px",fontFamily:MONO,cursor:"pointer"}}>CANCEL</button>
                    ):<span style={{color:D.txtD,fontSize:"13px"}}>—</span>}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ── History ───────────────────────────────────────────────────────────────────
function History({D,dark,tradeHistory=[],ledger=[],dbCards=[],isMobile=false}){
  const [tab,setTab]=useState("trades");

  const allCards=[...dbCards,...CARDS];
  function downloadCSV(){
    const rows=[["ID","Card","Side","Price","Qty","Total","Date","Time"],...tradeHistory.map(t=>{const card=allCards.find(c=>c.id===t.cardId)||{name:"Unknown"};return[t.id,card.name,t.side,t.price,t.qty,t.total,t.date,t.time];})];
    const blob=new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="cx-trade-history.csv";a.click();
  }

  return(
    <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:"16px"}}>
      <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px",overflow:"hidden"}}>
        <div style={{display:"flex",borderBottom:`1px solid ${D.bdr}`,padding:"0 14px",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex"}}>
            {[["trades","TRADES"],["ledger","DEPOSITS & WITHDRAWALS"],["alerts","PRICE ALERTS"]].map(([key,label])=>(
              <button key={key} onClick={()=>setTab(key)} style={{padding:"10px 14px",border:"none",background:"transparent",color:tab===key?D.accD:D.txtD,fontSize:"14px",fontFamily:MONO,letterSpacing:"0.08em",cursor:"pointer",borderBottom:`2px solid ${tab===key?D.accD:"transparent"}`,transition:"all 0.1s"}}>{label}</button>
            ))}
          </div>
          {tab==="trades"&&(
            <button onClick={downloadCSV} style={{padding:"5px 12px",background:dark?"rgba(0,180,60,0.1)":"rgba(22,128,58,0.08)",border:`1px solid ${dark?"#1a4a2a":"#8acc8a"}`,borderRadius:"4px",color:D.accD,fontSize:"13px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em",marginRight:"4px"}}>↓ DOWNLOAD CSV</button>
          )}
        </div>

        {tab==="trades"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"90px 1fr 50px 80px 50px 90px 130px",padding:"6px 14px",color:D.txtD,fontSize:"13px",borderBottom:`1px solid ${D.bdr}`,letterSpacing:"0.08em"}}>
              <span>TRADE ID</span><span>CARD</span><span>SIDE</span><span style={{textAlign:"right"}}>PRICE</span><span style={{textAlign:"right"}}>QTY</span><span style={{textAlign:"right"}}>TOTAL</span><span style={{textAlign:"right"}}>DATE</span>
            </div>
            {tradeHistory.length===0?(<div style={{padding:"40px",textAlign:"center",color:D.txtD,fontSize:"17px"}}>No trades yet</div>):tradeHistory.map(t=>{const card=allCards.find(c=>c.id===t.cardId)||{name:"Unknown",img:"",img_url:""};return(
              <div key={t.id} style={{display:"grid",gridTemplateColumns:"90px 1fr 50px 80px 50px 90px 130px",padding:"10px 14px",borderBottom:`1px solid ${D.bdr}`,alignItems:"center"}}>
                <span style={{color:D.txtM,fontSize:"14px"}}>{t.id}</span>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <img src={proxyImg(card.img)} alt={card.name} style={{width:"20px",height:"28px",objectFit:"cover",borderRadius:"2px"}} onError={e=>e.target.style.display="none"}/>
                  <span style={{color:D.txt,fontSize:"16px"}}>{card.name}</span>
                </div>
                <span style={{color:t.side==="buy"?D.buyT:D.askT,fontSize:"14px"}}>{t.side.toUpperCase()}</span>
                <span style={{textAlign:"right",color:D.txt,fontSize:"16px"}}>${t.price.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                <span style={{textAlign:"right",color:D.txtM,fontSize:"16px"}}>{t.qty}</span>
                <span style={{textAlign:"right",color:D.txt,fontSize:"16px"}}>${t.total.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                <span style={{textAlign:"right",color:D.txtD,fontSize:"14px"}}>{t.date} {t.time}</span>
              </div>
            );})}
          </>
        )}

        {tab==="ledger"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"90px 110px 1fr 100px 100px",padding:"6px 14px",color:D.txtD,fontSize:"13px",borderBottom:`1px solid ${D.bdr}`,letterSpacing:"0.08em"}}>
              <span>ID</span><span>TYPE</span><span>METHOD</span><span style={{textAlign:"right"}}>AMOUNT</span><span style={{textAlign:"right"}}>DATE</span>
            </div>
            {ledger.map(l=>(
              <div key={l.id} style={{display:"grid",gridTemplateColumns:"90px 110px 1fr 100px 100px",padding:"10px 14px",borderBottom:`1px solid ${D.bdr}`,alignItems:"center"}}>
                <span style={{color:D.txtM,fontSize:"14px"}}>{l.id}</span>
                <span style={{color:l.type==="deposit"?D.buyT:D.askT,fontSize:"14px"}}>{l.type.toUpperCase()}</span>
                <span style={{color:D.txtM,fontSize:"16px"}}>{l.method}</span>
                <span style={{textAlign:"right",color:l.type==="deposit"?D.buyT:D.askT,fontSize:"16px"}}>{l.type==="deposit"?"+":"-"}${l.amount.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                <span style={{textAlign:"right",color:D.txtD,fontSize:"14px"}}>{l.date}</span>
              </div>
            ))}
            <div style={{padding:"12px 14px",borderTop:`1px solid ${D.bdr}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:D.txtD,fontSize:"14px"}}>NET BALANCE</span>
              <span style={{color:D.buyT,fontSize:"19px",fontFamily:ORB}}>${ledger.reduce((s,l)=>l.type==="deposit"?s+l.amount:s-l.amount,0).toLocaleString("en-US",{minimumFractionDigits:2})}</span>
            </div>
          </>
        )}

        {tab==="alerts"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"90px 1fr 90px 80px 90px 130px",padding:"6px 14px",color:D.txtD,fontSize:"13px",borderBottom:`1px solid ${D.bdr}`,letterSpacing:"0.08em"}}>
              <span>ID</span><span>CARD</span><span>CONDITION</span><span style={{textAlign:"right"}}>TARGET</span><span style={{textAlign:"right"}}>STATUS</span><span style={{textAlign:"right"}}>TRIGGERED AT</span>
            </div>
            {SAMPLE_ALERTS.map(a=>{const card=allCards.find(c=>c.id===a.cardId)||{name:"Unknown",img:""};return(
              <div key={a.id} style={{display:"grid",gridTemplateColumns:"90px 1fr 90px 80px 90px 130px",padding:"10px 14px",borderBottom:`1px solid ${D.bdr}`,alignItems:"center"}}>
                <span style={{color:D.txtM,fontSize:"14px"}}>{a.id}</span>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <img src={proxyImg(card.img)} alt={card.name} style={{width:"20px",height:"28px",objectFit:"cover",borderRadius:"2px"}} onError={e=>e.target.style.display="none"}/>
                  <span style={{color:D.txt,fontSize:"16px"}}>{card.name}</span>
                </div>
                <span style={{color:D.txtM,fontSize:"14px"}}>{a.condition.toUpperCase()} </span>
                <span style={{textAlign:"right",color:D.txt,fontSize:"16px"}}>${a.target.toLocaleString()}</span>
                <div style={{textAlign:"right"}}>
                  <span style={{padding:"2px 7px",borderRadius:"3px",fontSize:"13px",color:a.triggered?D.buyT:a.active?"#f59e0b":D.txtD,background:a.triggered?(dark?"rgba(0,200,60,0.08)":"rgba(22,128,58,0.06)"):a.active?(dark?"rgba(245,158,11,0.08)":"rgba(245,158,11,0.06)"):"transparent"}}>
                    {a.triggered?"TRIGGERED":a.active?"ACTIVE":"INACTIVE"}
                  </span>
                </div>
                <span style={{textAlign:"right",color:D.txtD,fontSize:"14px"}}>{a.triggeredAt||"—"}</span>
              </div>
            );})}
            <div style={{padding:"12px 14px",display:"flex",justifyContent:"flex-end"}}>
              <button style={{padding:"6px 14px",background:dark?"rgba(0,180,60,0.1)":"rgba(22,128,58,0.08)",border:`1px solid ${dark?"#1a4a2a":"#8acc8a"}`,borderRadius:"4px",color:D.accD,fontSize:"13px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>+ ADD ALERT</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Browser ───────────────────────────────────────────────────────────────────
const PAGE_SIZE=40;
function Browser({D,dark,dbCards,onSelectCard,isMobile=false}){
  const [search,setSearch]=useState("");
  const [gameFilter,setGameFilter]=useState("all");
  const [condFilter,setCondFilter]=useState("all");
  const [langFilter,setLangFilter]=useState("all");
  const [setFilter,setSetFilter]=useState("all");
  const [sort,setSort]=useState("price-desc");
  const [page,setPage]=useState(1);

  const allCards=useMemo(()=>{
    // Merge DB cards with hardcoded CARDS — DB card wins on conflict (same id)
    const dbIds=new Set(dbCards.map(c=>c.id));
    const fallbacks=CARDS.filter(c=>!dbIds.has(c.id)).map(c=>({...c,basePrice:BASE[c.id],set_name:c.set,language:"English"}));
    return [...dbCards,...fallbacks];
  },[dbCards]);
  const games=useMemo(()=>[...new Set(allCards.map(c=>c.game))].filter(Boolean).sort(),[allCards]);
  const conditions=useMemo(()=>[...new Set(allCards.map(c=>c.condition))].filter(Boolean).sort(),[allCards]);
  const languages=useMemo(()=>[...new Set(allCards.map(c=>c.language||"English"))].filter(Boolean).sort(),[allCards]);
  // Only show sets that belong to the currently selected game — recomputes when gameFilter changes
  const sets=useMemo(()=>{
    const src=gameFilter==="all"?allCards:allCards.filter(c=>c.game===gameFilter);
    return [...new Set(src.map(c=>c.set||c.set_name))].filter(Boolean).sort();
  },[allCards,gameFilter]);

  const filtered=allCards
    .filter(c=>search===""||c.name.toLowerCase().includes(search.toLowerCase())||((c.set||c.set_name)||"").toLowerCase().includes(search.toLowerCase()))
    .filter(c=>gameFilter==="all"||c.game===gameFilter)
    .filter(c=>condFilter==="all"||c.condition===condFilter)
    .filter(c=>langFilter==="all"||(c.language||"English")===langFilter)
    .filter(c=>setFilter==="all"||(c.set||c.set_name)===setFilter)
    .sort((a,b)=>{
      const pa=a.basePrice||BASE[a.id]||0,pb=b.basePrice||BASE[b.id]||0;
      if(sort==="price-desc") return pb-pa;
      if(sort==="price-asc")  return pa-pb;
      if(sort==="name-asc")   return a.name.localeCompare(b.name);
      return 0;
    });

  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const paginated=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);

  const resetPage=()=>setPage(1);

  const inBtnStyle=(active)=>({
    padding:"5px 12px",border:`1px solid ${active?D.accD:D.bdr}`,borderRadius:"4px",
    background:active?(dark?"rgba(0,180,60,0.12)":"rgba(22,128,58,0.08)"):"transparent",
    color:active?D.accD:D.txtD,fontSize:"14px",fontFamily:MONO,cursor:"pointer",transition:"all 0.1s",whiteSpace:"nowrap"
  });

  const pgBtn=(label,onClick,disabled)=>(
    <button onClick={onClick} disabled={disabled} style={{padding:"5px 10px",border:`1px solid ${D.bdr}`,borderRadius:"4px",background:"transparent",color:disabled?D.txtD:D.accD,fontSize:"14px",fontFamily:MONO,cursor:disabled?"default":"pointer",opacity:disabled?0.4:1}}>{label}</button>
  );

  const pageNums=[];
  const start=Math.max(1,page-3),end=Math.min(totalPages,page+3);
  for(let i=start;i<=end;i++) pageNums.push(i);

  const Pagination=()=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"8px"}}>
      <span style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.1em"}}>{filtered.length.toLocaleString()} CARDS · PAGE {page} OF {totalPages.toLocaleString()}</span>
      <div style={{display:"flex",gap:"4px",alignItems:"center"}}>
        {pgBtn("«",()=>setPage(1),page===1)}
        {pgBtn("‹",()=>setPage(p=>p-1),page===1)}
        {pageNums.map(n=><button key={n} onClick={()=>setPage(n)} style={{...inBtnStyle(n===page),minWidth:"30px"}}>{n}</button>)}
        {pgBtn("›",()=>setPage(p=>p+1),page===totalPages)}
        {pgBtn("»",()=>setPage(totalPages),page===totalPages)}
      </div>
    </div>
  );

  return(
    <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:"16px"}}>
      <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px",padding:"14px 16px",display:"flex",gap:"12px",flexWrap:"wrap",alignItems:"center"}}>
        <input type="text" value={search} onChange={e=>{setSearch(e.target.value);resetPage();}} placeholder="Search cards..."
          style={{flex:"1 1 180px",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"4px",padding:"7px 12px",color:D.txt,fontSize:"17px",fontFamily:MONO,minWidth:"140px"}}/>
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center"}}>
          <span style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.1em"}}>GAME</span>
          <select value={gameFilter} onChange={e=>{setGameFilter(e.target.value);setSetFilter("all");resetPage();}} style={{background:D.inBg,border:`1px solid ${gameFilter!=="all"?D.accD:D.inBdr}`,borderRadius:"4px",padding:"5px 10px",color:gameFilter!=="all"?D.accD:D.txt,fontSize:"14px",fontFamily:MONO,cursor:"pointer",maxWidth:"200px"}}>
            <option value="all">ALL GAMES</option>
            {games.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
          {gameFilter!=="all"&&<button onClick={()=>{setGameFilter("all");setSetFilter("all");resetPage();}} style={{...inBtnStyle(false),padding:"4px 8px",fontSize:"13px"}}>× clear</button>}
        </div>
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center"}}>
          <span style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.1em"}}>SET</span>
          <select value={setFilter} onChange={e=>{setSetFilter(e.target.value);resetPage();}} style={{background:D.inBg,border:`1px solid ${setFilter!=="all"?D.accD:D.inBdr}`,borderRadius:"4px",padding:"5px 10px",color:setFilter!=="all"?D.accD:D.txt,fontSize:"14px",fontFamily:MONO,cursor:"pointer",maxWidth:"220px"}}>
            <option value="all">ALL SETS</option>
            {sets.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          {setFilter!=="all"&&<button onClick={()=>{setSetFilter("all");resetPage();}} style={{...inBtnStyle(false),padding:"4px 8px",fontSize:"13px"}}>× clear</button>}
        </div>
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center"}}>
          <span style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.1em"}}>CONDITION</span>
          {["all",...conditions].map(c=><button key={c} onClick={()=>{setCondFilter(c);resetPage();}} style={inBtnStyle(condFilter===c)}>{c==="all"?"ALL":c}</button>)}
        </div>
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center"}}>
          <span style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.1em"}}>LANGUAGE</span>
          {["all",...languages].map(l=><button key={l} onClick={()=>{setLangFilter(l);resetPage();}} style={inBtnStyle(langFilter===l)}>{l==="all"?"ALL":l}</button>)}
        </div>
        <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
          <span style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.1em"}}>SORT</span>
          <select value={sort} onChange={e=>{setSort(e.target.value);resetPage();}} style={{background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"4px",padding:"6px 10px",color:D.txt,fontSize:"14px",fontFamily:MONO,cursor:"pointer"}}>
            <option value="price-desc">Price: High to Low</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="name-asc">Name: A to Z</option>
          </select>
        </div>
      </div>

      <Pagination/>

      {filtered.length===0&&(
        <div style={{padding:"60px",textAlign:"center",color:D.txtD,fontSize:"17px",background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px"}}>No cards match your filters</div>
      )}

      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(auto-fill,minmax(180px,1fr))",gap:isMobile?"10px":"14px"}}>
        {paginated.map(c=>{
          const bp=c.basePrice||BASE[c.id]||0;
          const chg=((Math.random()-0.45)*5).toFixed(2);const up=+chg>=0;
          return(
            <div key={c.id} onClick={()=>onSelectCard(c)} style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"8px",overflow:"hidden",cursor:"pointer",transition:"border-color 0.15s,box-shadow 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=D.accD;e.currentTarget.style.boxShadow=dark?`0 0 16px ${D.accD}30`:"0 4px 16px rgba(0,0,0,0.1)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=D.bdr;e.currentTarget.style.boxShadow="none";}}>
              <div style={{background:D.stBg,display:"flex",justifyContent:"center",alignItems:"center",padding:"16px",aspectRatio:"1"}}>
                <img src={proxyImg(c.img||c.img_url)} alt={c.name} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",borderRadius:"4px",boxShadow:dark?"0 4px 16px rgba(0,0,0,0.6)":"0 4px 12px rgba(0,0,0,0.15)"}} onError={e=>e.target.style.display="none"}/>
              </div>
              <div style={{padding:"10px 12px"}}>
                <div style={{fontFamily:ORB,fontSize:"16px",fontWeight:700,color:D.txt,marginBottom:"3px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</div>
                <div style={{color:D.txtD,fontSize:"13px",marginBottom:"8px"}}>{c.set||c.set_name} · {c.condition}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                  <span style={{fontFamily:ORB,fontSize:"19px",fontWeight:700,color:D.accD}}>${bp.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                  <span style={{color:up?D.buyT:D.askT,fontSize:"13px"}}>{up?"▲":"▼"}{Math.abs(chg)}%</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:"6px"}}>
                  <span style={{background:dark?"rgba(0,180,60,0.08)":"rgba(22,128,58,0.06)",color:D.txtM,fontSize:"12px",padding:"2px 6px",borderRadius:"3px"}}>{c.game}</span>
                  <span style={{color:D.txtD,fontSize:"12px"}}>{c.language||"English"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages>1&&<Pagination/>}
    </div>
  );
}

// ── Market ────────────────────────────────────────────────────────────────────
function Market({D,dark,dbCards=[],initialCard=null,balance=0,holdings=[],onPlaceOrder,onUpdatePrice,tradeHistory=[],isDemo=false,isMobile=false}){
  const [sheetOpen,setSheetOpen]=useState(false);
  const allCards=dbCards.length?dbCards:CARDS.map(c=>({...c,basePrice:BASE[c.id]}));
  const [card,setCard]=useState(()=>initialCard||allCards[0]||CARDS[0]);
  const [sidebarMode,setSidebarMode]=useState("value");
  const SIDEBAR_COUNT=20;
  const sidebarCards=useMemo(()=>{
    if(sidebarMode==="value") return [...allCards].sort((a,b)=>(b.basePrice||0)-(a.basePrice||0)).slice(0,SIDEBAR_COUNT);
    // volume: simulate by seeding random vol from card id, consistent per session
    return [...allCards].sort((a,b)=>((b.id*7+13)%100)-((a.id*7+13)%100)).slice(0,SIDEBAR_COUNT);
  },[allCards,sidebarMode]);
  const [asks,setAsks]=useState(()=>genOrders(BASE[1],6,"ask"));
  const [bids,setBids]=useState(()=>genOrders(BASE[1],6,"bid"));
  const [trades,setTrades]=useState(()=>Array.from({length:16},()=>genTrade(BASE[1])));
  const [price,setPrice]=useState(BASE[1]);
  const [flash,setFlash]=useState(null);
  const [oSide,setOSide]=useState("buy");
  const [oExpiry,setOExpiry]=useState("gtc"); // gtc | day | week | month
  const EXPIRY_OPTS=[
    {val:"day",  label:"Good for today",  short:"DAY"},
    {val:"week", label:"Good for a week", short:"WEEK"},
    {val:"month",label:"Good for a month",short:"MONTH"},
    {val:"gtc",  label:"Until cancelled", short:"GTC"},
  ];
  const oType="limit"; // market orders handled by ⚡ instant buttons
  const [oPrice,setOPrice]=useState("");
  const [oQty,setOQty]=useState("");
  const [oStatus,setOStatus]=useState(null);
  const base=card.basePrice||BASE[card.id]||0;
  useEffect(()=>{ if(initialCard) setCard(initialCard); },[initialCard]);

  useEffect(()=>{setAsks(genOrders(base,6,"ask"));setBids(genOrders(base,6,"bid"));setPrice(base);setTrades(Array.from({length:16},()=>genTrade(base)));setOPrice("");setOQty("");},[card]);
  // Price ticker: fast flash every 5s, full chart/book refresh every 30s
  const priceRef=useRef(price);
  useEffect(()=>{ priceRef.current=price; },[price]);
  useEffect(()=>{
    // Fast: just update price + flash (no orderbook re-render)
    const fastIv=setInterval(()=>{
      const t=genTrade(priceRef.current);
      setFlash(t.price>priceRef.current?"up":"down");
      setTimeout(()=>setFlash(null),400);
      setPrice(t.price);
      priceRef.current=t.price;
      if(onUpdatePrice&&card.id) onUpdatePrice(card.id,t.price);
      setTrades(p=>[t,...p.slice(0,19)]);
    },5000);
    // Slow: regenerate orderbook + chart every 30s
    const slowIv=setInterval(()=>{
      const cur=priceRef.current;
      setAsks(genOrders(cur,6,"ask"));
      setBids(genOrders(cur,6,"bid"));
      if(isDemo) setDemoHist(p=>[...p.slice(1),{p:cur}]);
    },30000);
    return ()=>{ clearInterval(fastIv); clearInterval(slowIv); };
  },[base,card.id,isDemo]);

  // Demo mode: use animated genHist; logged-in: use real trade history
  const [demoHist,setDemoHist]=useState(()=>genHist(base));
  useEffect(()=>{ if(isDemo) setDemoHist(genHist(base)); },[card,isDemo]);

  const [chartRange,setChartRange]=useState("1D");
  const [chartType,setChartType]=useState("line"); // "line" | "candle"
  const [crosshair,setCrosshair]=useState(null); // {x,y,price,time,idx}

  const cardTrades=tradeHistory.filter(t=>t.cardId===card.id);
  const realHist=cardTrades.map(t=>({p:t.price,time:t.time,date:t.date})).reverse();

  // Filter hist by selected time range
  const filterHist=(h,range)=>{
    if(!h.length) return h;
    const now=new Date();
    const cutoff=new Date(now);
    if(range==="1H") cutoff.setHours(now.getHours()-1);
    else if(range==="6H") cutoff.setHours(now.getHours()-6);
    else if(range==="1D") cutoff.setDate(now.getDate()-1);
    else if(range==="1W") cutoff.setDate(now.getDate()-7);
    else if(range==="1M") cutoff.setMonth(now.getMonth()-1);
    // For demo mode, just slice the array proportionally since timestamps are fake
    if(isDemo){
      const slices={["1H"]:Math.ceil(h.length*0.05),["6H"]:Math.ceil(h.length*0.15),["1D"]:Math.ceil(h.length*0.4),["1W"]:Math.ceil(h.length*0.75),["1M"]:h.length};
      return h.slice(-slices[range]||h.length);
    }
    const filtered=h.filter(p=>{
      if(!p.date||!p.time) return true;
      return new Date(`${p.date} ${p.time}`)>=cutoff;
    });
    return filtered.length>=2?filtered:h;
  };

  const fullHist=isDemo?demoHist:realHist;
  const hist=filterHist(fullHist,chartRange);
  const hasHistory=isDemo?true:realHist.length>=2;

  // Build OHLC candles from hist (group into N buckets)
  const buildCandles=(h,n=20)=>{
    if(h.length<2) return [];
    const size=Math.max(1,Math.floor(h.length/n));
    const candles=[];
    for(let i=0;i<h.length;i+=size){
      const slice=h.slice(i,i+size);
      const prices=slice.map(p=>p.p);
      candles.push({
        open:prices[0],
        close:prices[prices.length-1],
        high:Math.max(...prices),
        low:Math.min(...prices),
        time:slice[0].time||"",
        date:slice[0].date||"",
        i:candles.length,
      });
    }
    return candles;
  };
  const candles=buildCandles(hist,Math.min(30,Math.max(10,Math.floor(hist.length/3))));

  const spread=asks.length&&bids.length?+(asks[0].price-bids[0].price).toFixed(2):0;
  const pct=(((price-base)/base)*100).toFixed(2);
  const minP=hasHistory?Math.min(...hist.map(h=>h.p)):0;
  const maxP=hasHistory?Math.max(...hist.map(h=>h.p)):0;
  const rng=maxP-minP||1;
  const CW=900,CH=240,DATE_H=22;
  const yPos=(p)=>((CH-20)-((p-minP)/rng)*(CH-40))+10;
  const lp=()=>{
    if(hist.length<2) return "";
    return hist.map((h,i)=>`${i===0?"M":"L"}${((i/(hist.length-1))*CW).toFixed(1)},${yPos(h.p).toFixed(1)}`).join(" ");
  };
  const dateLabels=useMemo(()=>{
    if(hist.length<2) return [];
    const n=Math.min(5,hist.length);
    const step=Math.floor((hist.length-1)/(n-1));
    return Array.from({length:n},(_,i)=>{
      const idx=i===n-1?hist.length-1:i*step;
      const h=hist[idx];
      const label=h.date?h.date.slice(5):(h.time||"");
      return {x:((idx/(hist.length-1))*CW).toFixed(1),label};
    });
  },[hist]);
  const submitOrder=()=>{
    if(!oQty||!oPrice) return;
    const orderPrice=+oPrice;
    const orderQty=+oQty;
    if(oSide==="buy"&&orderPrice*orderQty>balance){ setOStatus({error:"Insufficient funds"}); setTimeout(()=>setOStatus(null),3000); return; }
    if(oSide==="sell"){
      const holding=holdings.find(h=>h.cardId===card.id);
      const owned=holding?.qty||0;
      const locked=holding?.lockedQty||0;
      const free=owned-locked;
      if(orderQty>free){
        const msg=owned===0?"You don't own any of this card"
          :locked>0?`Only ${free} free (${locked} locked in open orders)`
          :`You only own ${owned}`;
        setOStatus({error:msg}); setTimeout(()=>setOStatus(null),4000); return;
      }
    }
    if(onPlaceOrder) onPlaceOrder({cardId:card.id,side:oSide,type:oType,price:orderPrice,qty:orderQty,expiry:oExpiry});
    setOStatus({side:oSide,price:orderPrice,qty:orderQty});
    setTimeout(()=>setOStatus(null),3000);
    setOPrice(""); setOQty("");
  };
  const maxA=Math.max(...asks.map(a=>a.qty)),maxB=Math.max(...bids.map(b=>b.qty));

  // ── Mobile layout ────────────────────────────────────────────────────────
  if(isMobile){
    return(
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
        {/* Card selector strip */}
        <div style={{overflowX:"auto",flexShrink:0,borderBottom:`1px solid ${D.bdr}`,background:D.bg2,display:"flex",WebkitOverflowScrolling:"touch"}}>
          {(dbCards.length?dbCards:CARDS).slice(0,12).map(c=>{
            const active=card.id===c.id;
            return(
              <div key={c.id} onClick={()=>setCard(c)} style={{flexShrink:0,padding:"8px 10px",borderRight:`1px solid ${D.bdr}`,background:active?(dark?"rgba(0,255,80,0.06)":"rgba(22,128,58,0.06)"):"transparent",borderBottom:`2px solid ${active?D.accD:"transparent"}`,cursor:"pointer",minWidth:"80px",textAlign:"center"}}>
                <img src={proxyImg(c.img||c.img_url)} alt={c.name} style={{width:"32px",height:"44px",objectFit:"cover",borderRadius:"3px",display:"block",margin:"0 auto 4px"}} onError={e=>e.target.style.display="none"}/>
                <div style={{color:active?D.acc:D.txtM,fontSize:"13px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"72px"}}>{c.name.split(" ")[0]}</div>
              </div>
            );
          })}
        </div>

        {/* Price header */}
        <div style={{background:D.bg3,borderBottom:`1px solid ${D.bdr}`,padding:"10px 14px",flexShrink:0}}>
          <div style={{fontFamily:ORB,fontSize:"19px",fontWeight:700,color:D.txt,marginBottom:"2px"}}>{card.name}</div>
          <div style={{display:"flex",alignItems:"baseline",gap:"10px"}}>
            <span className={flash==="up"?"fu":flash==="down"?"fd":""} style={{fontFamily:ORB,fontSize:"31px",fontWeight:800,color:flash==="up"?D.buyT:flash==="down"?D.askT:D.txt}}>${(price||0).toLocaleString("en-US",{minimumFractionDigits:2})}</span>
            <span style={{color:+pct>=0?D.buyT:D.askT,fontSize:"17px"}}>{+pct>=0?"▲":"▼"}{Math.abs(pct)}%</span>
          </div>
        </div>

        {/* Chart */}
        <div style={{background:D.bg3,borderBottom:`1px solid ${D.bdr}`,padding:"8px 12px 6px",flexShrink:0}}>
          {/* Mobile chart toolbar */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
            <div style={{display:"flex",border:`1px solid ${D.bdr}`,borderRadius:"4px",overflow:"hidden"}}>
              {[["line","▲"],["candle","▮"]].map(([t,icon])=>(
                <button key={t} onClick={()=>setChartType(t)} style={{padding:"2px 7px",border:"none",background:chartType===t?(dark?"rgba(0,180,60,0.18)":"rgba(22,128,58,0.10)"):"transparent",color:chartType===t?D.accD:D.txtD,fontSize:"12px",cursor:"pointer",borderRight:t==="line"?`1px solid ${D.bdr}`:"none"}}>{icon}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:"3px"}}>
              {["1H","6H","1D","1W","1M"].map(r=>(
                <button key={r} onClick={()=>setChartRange(r)} style={{padding:"2px 6px",border:`1px solid ${r===chartRange?D.accD:D.bdr}`,borderRadius:"3px",background:r===chartRange?(dark?"rgba(0,180,60,0.14)":"rgba(22,128,58,0.08)"):"transparent",color:r===chartRange?D.accD:D.txtD,fontSize:"11px",fontFamily:MONO,cursor:"pointer"}}>{r}</button>
              ))}
            </div>
          </div>
          {!hasHistory?(
            <div style={{height:"100px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",opacity:0.4,gap:"6px"}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={D.txtD} strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              <span style={{color:D.txtD,fontSize:"13px"}}>NO TRADE HISTORY YET</span>
            </div>
          ):(
            <div style={{position:"relative"}}>
              <svg width="100%" height="110" viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" style={{display:"block",cursor:"crosshair"}}
                onMouseMove={e=>{
                  const rect=e.currentTarget.getBoundingClientRect();
                  const xRatio=(e.clientX-rect.left)/rect.width;
                  if(chartType==="line"&&hist.length>=2){
                    const idx=Math.round(xRatio*(hist.length-1));
                    const h=hist[Math.max(0,Math.min(idx,hist.length-1))];
                    setCrosshair({x:(idx/(hist.length-1))*CW,y:yPos(h.p),price:h.p,time:h.time||"",idx});
                  } else if(chartType==="candle"&&candles.length>=2){
                    const idx=Math.round(xRatio*(candles.length-1));
                    const c=candles[Math.max(0,Math.min(idx,candles.length-1))];
                    setCrosshair({x:((idx+0.5)/candles.length)*CW,y:yPos(c.close),price:c.close,open:c.open,high:c.high,low:c.low,time:c.time||""});
                  }
                }}
                onMouseLeave={()=>setCrosshair(null)}
              >
                <defs><linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={D.accD} stopOpacity="0.14"/><stop offset="100%" stopColor={D.accD} stopOpacity="0"/></linearGradient></defs>
                {[0.25,0.5,0.75].map(f=><line key={f} x1="0" y1={CH*f} x2={CW} y2={CH*f} stroke={dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.05)"} strokeWidth="1"/>)}
                {/* Current price dashed line */}
                <line x1="0" y1={yPos(price)} x2={CW} y2={yPos(price)} stroke={D.accD} strokeWidth="0.8" strokeDasharray="4,4" opacity="0.5"/>
                {chartType==="line"&&lp()&&<>
                  <path d={lp()+` L${CW},${CH} L0,${CH} Z`} fill="url(#cg2)"/>
                  <path d={lp()} fill="none" stroke={D.accD} strokeWidth="2"/>
                  <circle cx={CW} cy={yPos(price)} r="4" fill={D.accD} opacity="0.9"/>
                  <circle cx={CW} cy={yPos(price)} r="8" fill={D.accD} opacity="0.12"/>
                </>}
                {chartType==="candle"&&candles.map((c,i)=>{
                  const cw=Math.max(2,(CW/candles.length)*0.6);
                  const cx=((i+0.5)/candles.length)*CW;
                  const bull=c.close>=c.open;
                  const col=bull?(dark?"#00cc40":"#15803d"):(dark?"#cc3535":"#dc2626");
                  return <g key={i}>
                    <line x1={cx} y1={yPos(c.high)} x2={cx} y2={yPos(c.low)} stroke={col} strokeWidth="1" opacity="0.7"/>
                    <rect x={cx-cw/2} y={Math.min(yPos(c.open),yPos(c.close))} width={cw} height={Math.max(1,Math.abs(yPos(c.close)-yPos(c.open)))} fill={bull?(dark?"rgba(0,204,64,0.15)":"rgba(22,128,58,0.12)"):col} stroke={col} strokeWidth="1"/>
                  </g>;
                })}
                {crosshair&&<>
                  <line x1={crosshair.x} y1="0" x2={crosshair.x} y2={CH} stroke={dark?"rgba(255,255,255,0.15)":"rgba(0,0,0,0.12)"} strokeWidth="1" strokeDasharray="3,3"/>
                  <line x1="0" y1={crosshair.y} x2={CW} y2={crosshair.y} stroke={dark?"rgba(255,255,255,0.15)":"rgba(0,0,0,0.12)"} strokeWidth="1" strokeDasharray="3,3"/>
                  <circle cx={crosshair.x} cy={crosshair.y} r="4" fill={D.accD} opacity="0.9"/>
                </>}
              </svg>
              {/* Date axis */}
              <svg width="100%" height={DATE_H} viewBox={`0 0 ${CW} ${DATE_H}`} preserveAspectRatio="none" style={{display:"block",borderTop:`1px solid ${dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.06)"}`}}>
                {dateLabels.map((d,i)=>(
                  <text key={i} x={Math.min(+d.x,CW-30)} y={DATE_H-5} fontSize="9" fill={dark?"#2a5a2a":"#9aaa9a"} fontFamily="monospace" textAnchor={i===dateLabels.length-1?"end":i===0?"start":"middle"}>{d.label}</text>
                ))}
              </svg>
            </div>
          )}
        </div>

        {/* Order book — scrollable */}
        <div style={{flex:1,overflowY:"auto",background:D.bg2}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr"}}>
            {[["BUY PRICE",bids,maxB,D.bidT,"bid"],["SELL PRICE",asks,maxA,D.askT,"ask"]].map(([label,rows,mx,tc,side])=>(
              <div key={label} style={{borderRight:`1px solid ${D.bdr}`}}>
                <div style={{padding:"6px 10px",borderBottom:`1px solid ${D.bdr}`,background:D.bg3,color:tc,fontSize:"13px",letterSpacing:"0.1em"}}>▸ {label}</div>
                {rows.slice(0,6).map((r,i)=>{
                  const rowTotal=+(r.price*r.qty).toFixed(2);
                  return(
                    <div key={i} onClick={()=>{setOPrice(r.price.toString());setOSide(side==="bid"?"sell":"buy");setSheetOpen(true);}} style={{padding:"6px 10px",borderBottom:`1px solid ${D.bdr}`,cursor:"pointer",position:"relative"}}>
                      <div style={{position:"absolute",[side==="bid"?"left":"right"]:0,top:0,bottom:0,width:`${(r.qty/mx)*100}%`,background:side==="bid"?(dark?"rgba(0,180,60,0.07)":"rgba(22,128,58,0.06)"):(dark?"rgba(180,40,40,0.08)":"rgba(180,30,30,0.06)")}}/>
                      <div style={{color:tc,fontSize:"16px",zIndex:1,position:"relative"}}>${r.price.toLocaleString("en-US",{minimumFractionDigits:2})} <span style={{color:D.txtD,fontSize:"13px"}}>/ card</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",zIndex:1,position:"relative"}}>
                        <span style={{color:D.txtD,fontSize:"13px"}}>qty {r.qty}</span>
                        <span style={{color:D.txtM,fontSize:"13px",fontWeight:"bold"}}>${rowTotal.toLocaleString("en-US",{maximumFractionDigits:0})} total</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {/* Recent trades */}
          <div style={{borderTop:`1px solid ${D.bdr}`}}>
            <div style={{padding:"6px 12px",background:D.bg3,color:D.txtD,fontSize:"13px",borderBottom:`1px solid ${D.bdr}`,letterSpacing:"0.1em",display:"flex",justifyContent:"space-between"}}><span>▸ RECENT TRADES</span><span style={{color:D.buyT}}>● LIVE</span></div>
            {trades.slice(0,8).map(t=>(
              <div key={t.id} style={{display:"grid",gridTemplateColumns:"70px 1fr 36px",padding:"5px 12px",borderBottom:`1px solid ${D.bdr}`,alignItems:"center"}}>
                <span style={{color:D.txtD,fontSize:"13px"}}>{t.time}</span>
                <span style={{color:t.side==="buy"?D.buyT:D.askT,fontSize:"14px"}}>${t.price.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                <span style={{textAlign:"right",color:D.txtM,fontSize:"13px"}}>{t.qty}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fixed Buy/Sell button */}
        <div style={{position:"sticky",bottom:0,padding:"12px 14px",background:D.hdrBg,borderTop:`1px solid ${D.bdr2}`,display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",flexShrink:0}}>
          <button onClick={()=>{setOSide("buy");setSheetOpen(true);}} style={{padding:"13px",border:`1px solid ${dark?"#1a5a2a":"#7ab07a"}`,borderRadius:"6px",fontSize:"17px",fontFamily:MONO,fontWeight:"bold",letterSpacing:"0.1em",background:dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#cceacc,#a8d8a8)",color:dark?"#00ff55":"#1a5a2a",cursor:"pointer"}}>▲ BUY</button>
          <button onClick={()=>{setOSide("sell");setSheetOpen(true);}} style={{padding:"13px",border:`1px solid ${dark?"#5a1a1a":"#c07070"}`,borderRadius:"6px",fontSize:"17px",fontFamily:MONO,fontWeight:"bold",letterSpacing:"0.1em",background:dark?"linear-gradient(135deg,#3a0a0a,#5a1010)":"linear-gradient(135deg,#eacccc,#d8a8a8)",color:dark?"#ff5555":"#9a1a1a",cursor:"pointer"}}>▼ SELL</button>
        </div>

        {/* Order entry bottom sheet */}
        {sheetOpen&&(
          <>
            <div className="overlay" onClick={()=>setSheetOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:300}}/>
            <div className="sheet" style={{position:"fixed",bottom:0,left:0,right:0,background:D.bg2,borderTop:`2px solid ${D.bdr2}`,borderRadius:"16px 16px 0 0",zIndex:301,padding:"0 0 24px"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${D.bdr}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:D.txtD,fontSize:"14px",letterSpacing:"0.12em"}}>▸ PLACE ORDER — {card.name.split(" ")[0].toUpperCase()}</span>
                <button onClick={()=>setSheetOpen(false)} style={{background:"none",border:"none",color:D.txtD,fontSize:"29px",padding:"0 4px",cursor:"pointer"}}>✕</button>
              </div>
              <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:"12px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",border:`1px solid ${D.bdr}`,borderRadius:"6px",overflow:"hidden"}}>
                  {["buy","sell"].map(s=><button key={s} onClick={()=>setOSide(s)} style={{padding:"11px",border:"none",cursor:"pointer",fontFamily:MONO,fontSize:"19px",letterSpacing:"0.1em",background:oSide===s?(s==="buy"?(dark?"rgba(0,180,60,0.22)":"rgba(22,128,58,0.15)"):(dark?"rgba(180,30,30,0.22)":"rgba(180,30,30,0.14)")):"transparent",color:oSide===s?(s==="buy"?D.buyT:D.askT):D.txtD,borderBottom:`2px solid ${oSide===s?(s==="buy"?D.buyT:D.askT):"transparent"}`}}>{s.toUpperCase()}</button>)}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                  <div style={{padding:"6px 12px",background:dark?"rgba(0,100,30,0.1)":"rgba(22,128,58,0.06)",border:`1px solid ${D.accD}`,borderRadius:"5px",color:D.accD,fontSize:"16px",fontFamily:MONO,letterSpacing:"0.08em"}}>SET PRICE</div>
                </div>
                <div><div style={{color:D.txtD,fontSize:"13px",marginBottom:"6px"}}>PRICE (USD)</div><input type="number" value={oPrice} onChange={e=>setOPrice(e.target.value)} placeholder={price.toFixed(2)} style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"5px",padding:"10px 12px",color:D.txt,fontSize:"23px",fontFamily:MONO}}/></div>
                <div><div style={{color:D.txtD,fontSize:"13px",marginBottom:"6px"}}>QUANTITY</div><input type="number" value={oQty} onChange={e=>setOQty(e.target.value)} placeholder="0" style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"5px",padding:"10px 12px",color:D.txt,fontSize:"23px",fontFamily:MONO}}/></div>
                <div>
                  <div style={{color:D.txtD,fontSize:"13px",marginBottom:"6px"}}>TIME IN FORCE</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px"}}>
                    {EXPIRY_OPTS.map(o=>(
                      <button key={o.val} onClick={()=>setOExpiry(o.val)} style={{padding:"7px 4px",border:`1px solid ${oExpiry===o.val?D.accD:D.bdr}`,borderRadius:"4px",background:oExpiry===o.val?(dark?"rgba(0,100,30,0.15)":"rgba(22,128,58,0.08)"):"transparent",color:oExpiry===o.val?D.accD:D.txtD,fontSize:"13px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.06em",textAlign:"center"}}>
                        <div>{o.short}</div>
                        <div style={{fontSize:"12px",opacity:0.7,marginTop:"2px"}}>{o.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{background:D.stBg,border:`1px solid ${D.bdr}`,borderRadius:"5px",padding:"10px 12px",display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:D.txtD,fontSize:"14px"}}>TOTAL</span>
                  <span style={{color:D.txtM,fontSize:"17px"}}>${((+oPrice||price)*(+oQty||0)).toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                </div>
                <button onClick={()=>{submitOrder();setSheetOpen(false);}} style={{padding:"14px",border:`1px solid ${oSide==="buy"?(dark?"#1a5a2a":"#7ab07a"):(dark?"#5a1a1a":"#c07070")}`,borderRadius:"6px",fontSize:"19px",fontFamily:MONO,letterSpacing:"0.1em",fontWeight:"bold",background:oSide==="buy"?(dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#cceacc,#a8d8a8)"):(dark?"linear-gradient(135deg,#3a0a0a,#5a1010)":"linear-gradient(135deg,#eacccc,#d8a8a8)"),color:oSide==="buy"?(dark?"#00ff55":"#1a5a2a"):(dark?"#ff5555":"#9a1a1a"),cursor:"pointer"}}>
                  {oSide==="buy"?"▲ BUY":"▼ SELL"} {card.name.split(" ")[0].toUpperCase()}
                </button>
                {oStatus&&<div style={{padding:"10px 12px",background:oStatus.error?(dark?"rgba(180,30,30,0.08)":"rgba(220,50,50,0.06)"):(dark?"rgba(0,180,60,0.08)":"rgba(22,128,58,0.08)"),border:`1px solid ${oStatus.error?D.askT:D.accD}`,borderRadius:"5px",fontSize:"16px",color:oStatus.error?D.askT:D.accD}}>{oStatus.error?`⚠ ${oStatus.error}`:`✓ ORDER PLACED — ${oStatus.side?.toUpperCase()} ${oStatus.qty}x @ $${oStatus.price?.toFixed(2)}`}</div>}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return(
    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <div style={{width:"220px",flexShrink:0,borderRight:`1px solid ${D.bdr}`,background:D.bg2,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${D.bdr}`,flexShrink:0}}>
          <div style={{color:D.txtD,fontSize:"16px",letterSpacing:"0.12em",marginBottom:"8px"}}>▸ INSTRUMENTS</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px"}}>
            {["value","volume"].map(m=>(
              <button key={m} onClick={()=>setSidebarMode(m)} style={{padding:"5px 0",border:`1px solid ${sidebarMode===m?D.accD:D.bdr}`,borderRadius:"3px",background:sidebarMode===m?(dark?"rgba(0,180,60,0.12)":"rgba(22,128,58,0.08)"):"transparent",color:sidebarMode===m?D.accD:D.txtD,fontSize:"14px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.06em"}}>
                {m==="value"?"TOP VALUE":"TOP VOL"}
              </button>
            ))}
          </div>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
        {sidebarCards.map(c=>{const bp=c.basePrice||BASE[c.id]||0;const chg=(((c.id*7+13)%17-8)*0.6).toFixed(2);const up=+chg>=0;const active=card.id===c.id;return(
          <div key={c.id} onClick={()=>setCard(c)} style={{padding:"12px 14px",borderBottom:`1px solid ${D.bdr}`,cursor:"pointer",background:active?(dark?"rgba(0,255,80,0.05)":"rgba(22,128,58,0.05)"):"transparent",borderLeft:active?`3px solid ${D.accD}`:"3px solid transparent",transition:"all 0.1s"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <img src={proxyImg(c.img||c.img_url)} alt={c.name} style={{width:"38px",height:"52px",objectFit:"cover",borderRadius:"4px",border:`1px solid ${D.bdr}`,flexShrink:0}} onError={e=>e.target.style.display="none"}/>
              <div style={{minWidth:0}}>
                <div style={{color:active?D.acc:D.txt,fontSize:"17px",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</div>
                <div style={{color:D.txtD,fontSize:"14px",marginTop:"2px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.set||c.set_name}</div>
                <div style={{display:"flex",gap:"8px",marginTop:"4px"}}>
                  <span style={{color:D.txtM,fontSize:"16px",fontWeight:600}}>${bp.toLocaleString()}</span>
                  <span style={{color:up?D.buyT:D.askT,fontSize:"14px"}}>{up?"▲":"▼"}{Math.abs(chg)}%</span>
                </div>
              </div>
            </div>
          </div>
        );})}
        </div>
      </div>

      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:D.bg3,borderBottom:`1px solid ${D.bdr}`,padding:"8px 16px",display:"flex",alignItems:"center",gap:"18px",flexWrap:"wrap",flexShrink:0}}>
          <div><div style={{fontFamily:ORB,fontSize:"23px",fontWeight:700,color:D.txt,letterSpacing:"0.08em"}}>{card.name}</div><div style={{color:D.txtD,fontSize:"16px",marginTop:"3px"}}>{card.set||card.set_name} · {card.condition} · {card.rarity} · {card.game}</div></div>
          <div className={flash==="up"?"fu":flash==="down"?"fd":""} style={{display:"flex",alignItems:"baseline",gap:"8px",padding:"3px 10px",borderRadius:"3px"}}>
            <span style={{fontFamily:ORB,fontSize:"37px",fontWeight:800,color:flash==="up"?D.buyT:flash==="down"?D.askT:D.txt,transition:"color 0.25s"}}>${(price||0).toLocaleString("en-US",{minimumFractionDigits:2})}</span>
            <span style={{color:+pct>=0?D.buyT:D.askT,fontSize:"19px"}}>{+pct>=0?"▲":"▼"}{Math.abs(pct)}%</span>
          </div>
          {[["SPREAD",`$${spread.toFixed(2)}`],["VOL 24H","47 cards"],["HIGH",`$${((base||0)*1.02).toFixed(2)}`],["LOW",`$${((base||0)*0.982).toFixed(2)}`]].map(([k,v])=>(
            <div key={k}><div style={{color:D.txtD,fontSize:"14px",letterSpacing:"0.1em"}}>{k}</div><div style={{color:D.txtM,fontSize:"17px",marginTop:"2px"}}>{v}</div></div>
          ))}
        </div>

        <div style={{flex:1,display:"flex",overflow:"hidden"}}>
          <div style={{width:"250px",flexShrink:0,borderRight:`1px solid ${D.bdr}`,background:D.bg2,display:"flex",flexDirection:"column",alignItems:"center",padding:"18px 14px",gap:"14px",overflowY:"auto"}}>
            <div style={{width:"218px",borderRadius:"10px",overflow:"hidden",border:`1px solid ${D.bdr}`,boxShadow:dark?`0 0 24px ${D.accD}25,0 6px 20px rgba(0,0,0,0.5)`:"0 6px 20px rgba(0,0,0,0.12)",background:D.stBg,aspectRatio:"0.714",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <img src={proxyImg(card.img||card.img_url)} alt={card.name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={e=>e.target.style.display="none"}/>
            </div>
            <div style={{width:"100%",background:D.stBg,border:`1px solid ${D.bdr}`,borderRadius:"6px",padding:"10px 12px"}}>
              {[["GAME",card.game],["SET",card.set||card.set_name],["COND.",card.condition],["RARITY",card.rarity]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:"6px",alignItems:"flex-start",gap:"8px"}}>
                  <span style={{color:D.txtD,fontSize:"14px",flexShrink:0}}>{k}</span>
                  <span style={{color:D.txtM,fontSize:"14px",textAlign:"right"}}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{background:D.bg3,borderBottom:`1px solid ${D.bdr}`,padding:"10px 16px 0",flexShrink:0}}>
              {/* Chart toolbar */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                  <span style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.12em"}}>▸ PRICE CHART</span>
                  {crosshair&&<span style={{fontFamily:ORB,fontSize:"14px",color:D.txt}}>${crosshair.price.toLocaleString("en-US",{minimumFractionDigits:2})} <span style={{color:D.txtD,fontSize:"12px",fontFamily:MONO}}>{crosshair.time}</span></span>}
                </div>
                <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                  {/* Chart type toggle */}
                  <div style={{display:"flex",border:`1px solid ${D.bdr}`,borderRadius:"4px",overflow:"hidden",marginRight:"4px"}}>
                    {[["line","▲"],["candle","▮"]].map(([t,icon])=>(
                      <button key={t} onClick={()=>setChartType(t)} title={t==="line"?"Line chart":"Candlestick"} style={{padding:"2px 8px",border:"none",background:chartType===t?(dark?"rgba(0,180,60,0.18)":"rgba(22,128,58,0.10)"):"transparent",color:chartType===t?D.accD:D.txtD,fontSize:"13px",cursor:"pointer",borderRight:t==="line"?`1px solid ${D.bdr}`:"none"}}>{icon}</button>
                    ))}
                  </div>
                  {/* Time range */}
                  {["1H","6H","1D","1W","1M"].map(r=>(
                    <button key={r} onClick={()=>setChartRange(r)} style={{padding:"2px 8px",border:`1px solid ${r===chartRange?D.accD:D.bdr}`,borderRadius:"3px",background:r===chartRange?(dark?"rgba(0,180,60,0.14)":"rgba(22,128,58,0.08)"):"transparent",color:r===chartRange?D.accD:D.txtD,fontSize:"12px",fontFamily:MONO,cursor:"pointer"}}>{r}</button>
                  ))}
                </div>
              </div>
              {!hasHistory?(
                <div style={{height:CH,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"8px",opacity:0.4}}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={D.txtD} strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  <span style={{color:D.txtD,fontSize:"14px",letterSpacing:"0.12em"}}>NO TRADE HISTORY YET</span>
                  <span style={{color:D.txtD,fontSize:"13px"}}>Place a trade to start recording price history</span>
                </div>
              ):(
                <div style={{position:"relative"}}>
                  {(()=>{
                    const MARGIN={top:8,right:72,bottom:DATE_H,left:4};
                    const IW=CW-MARGIN.left-MARGIN.right;
                    const IH=CH-MARGIN.top-MARGIN.bottom;
                    const ix=(i,len)=>MARGIN.left+((i/(len-1))*IW);
                    const iy=(p)=>MARGIN.top+(IH-((p-minP)/rng)*IH);
                    const linePath=hist.length<2?"":hist.map((h,i)=>`${i===0?"M":"L"}${ix(i,hist.length).toFixed(1)},${iy(h.p).toFixed(1)}`).join(" ");
                    return(
                      <svg width="100%" height={CH} viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" style={{display:"block",cursor:"crosshair"}}
                        onMouseMove={e=>{
                          const rect=e.currentTarget.getBoundingClientRect();
                          const xRatio=Math.max(0,Math.min(1,(e.clientX-rect.left)/(rect.width)));
                          if(chartType==="line"&&hist.length>=2){
                            const idx=Math.round(xRatio*(hist.length-1));
                            const h=hist[Math.max(0,Math.min(idx,hist.length-1))];
                            setCrosshair({x:ix(idx,hist.length),y:iy(h.p),price:h.p,time:h.time||"",date:h.date||"",idx});
                          } else if(chartType==="candle"&&candles.length>=2){
                            const idx=Math.round(xRatio*(candles.length-1));
                            const c=candles[Math.max(0,Math.min(idx,candles.length-1))];
                            setCrosshair({x:MARGIN.left+((idx+0.5)/candles.length)*IW,y:iy(c.close),price:c.close,open:c.open,high:c.high,low:c.low,time:c.time||"",date:c.date||""});
                          }
                        }}
                        onMouseLeave={()=>setCrosshair(null)}
                      >
                        <defs>
                          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={D.accD} stopOpacity={dark?"0.18":"0.12"}/>
                            <stop offset="100%" stopColor={D.accD} stopOpacity="0"/>
                          </linearGradient>
                          <clipPath id="chartClip"><rect x={MARGIN.left} y={MARGIN.top} width={IW} height={IH}/></clipPath>
                        </defs>
                        {[0,0.25,0.5,0.75,1].map(f=>{
                          const p=minP+rng*(1-f);
                          const y=iy(p);
                          return <g key={f}>
                            <line x1={MARGIN.left} y1={y} x2={MARGIN.left+IW} y2={y} stroke={dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.07)"} strokeWidth="1"/>
                            <text x={MARGIN.left+IW+4} y={y+4} fontSize="11" fill={dark?"#5a8a5a":"#6a8a6a"} fontFamily="monospace">${p.toLocaleString("en-US",{maximumFractionDigits:0})}</text>
                          </g>;
                        })}
                        <line x1={MARGIN.left} y1={iy(price)} x2={MARGIN.left+IW} y2={iy(price)} stroke={D.accD} strokeWidth="0.8" strokeDasharray="4,3" opacity="0.6"/>
                        <rect x={MARGIN.left+IW+1} y={iy(price)-10} width={62} height={20} rx="3" fill={D.accD}/>
                        <text x={MARGIN.left+IW+32} y={iy(price)+5} fontSize="11" fill={dark?"#000":"#fff"} fontFamily="monospace" textAnchor="middle" fontWeight="bold">${price.toLocaleString("en-US",{minimumFractionDigits:2})}</text>
                        <g clipPath="url(#chartClip)">
                          {chartType==="line"&&linePath&&<>
                            <path d={linePath+` L${MARGIN.left+IW},${MARGIN.top+IH} L${MARGIN.left},${MARGIN.top+IH} Z`} fill="url(#cg)"/>
                            <path d={linePath} fill="none" stroke={D.accD} strokeWidth="2" style={{filter:dark?`drop-shadow(0 0 4px ${D.accD}60)`:"none"}}/>
                            <circle cx={MARGIN.left+IW} cy={iy(price)} r="4" fill={D.accD}/>
                            <circle cx={MARGIN.left+IW} cy={iy(price)} r="8" fill={D.accD} opacity="0.15"/>
                          </>}
                          {chartType==="candle"&&candles.map((c,i)=>{
                            const cw=Math.max(2,(IW/candles.length)*0.6);
                            const cx=MARGIN.left+((i+0.5)/candles.length)*IW;
                            const bull=c.close>=c.open;
                            const col=bull?(dark?"#00cc40":"#15803d"):(dark?"#cc3535":"#dc2626");
                            return <g key={i}>
                              <line x1={cx} y1={iy(c.high)} x2={cx} y2={iy(c.low)} stroke={col} strokeWidth="1" opacity="0.7"/>
                              <rect x={cx-cw/2} y={Math.min(iy(c.open),iy(c.close))} width={cw} height={Math.max(1,Math.abs(iy(c.close)-iy(c.open)))} fill={bull?(dark?"rgba(0,204,64,0.15)":"rgba(22,128,58,0.12)"):col} stroke={col} strokeWidth="1"/>
                            </g>;
                          })}
                        </g>
                        <line x1={MARGIN.left} y1={MARGIN.top+IH} x2={MARGIN.left+IW} y2={MARGIN.top+IH} stroke={dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)"} strokeWidth="1"/>
                        {dateLabels.map((d,i)=>{
                          const xd=MARGIN.left+(+d.x/CW)*IW;
                          return <g key={i}>
                            <line x1={xd} y1={MARGIN.top+IH} x2={xd} y2={MARGIN.top+IH+4} stroke={dark?"rgba(255,255,255,0.15)":"rgba(0,0,0,0.15)"} strokeWidth="1"/>
                            <text x={xd} y={CH-4} fontSize="10" fill={dark?"#4a7a4a":"#8a9a8a"} fontFamily="monospace" textAnchor={i===0?"start":i===dateLabels.length-1?"end":"middle"}>{d.label}</text>
                          </g>;
                        })}
                        {crosshair&&<g clipPath="url(#chartClip)">
                          <line x1={crosshair.x} y1={MARGIN.top} x2={crosshair.x} y2={MARGIN.top+IH} stroke={dark?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.15)"} strokeWidth="1" strokeDasharray="3,3"/>
                          <line x1={MARGIN.left} y1={crosshair.y} x2={MARGIN.left+IW} y2={crosshair.y} stroke={dark?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.15)"} strokeWidth="1" strokeDasharray="3,3"/>
                          <circle cx={crosshair.x} cy={crosshair.y} r="4" fill={D.accD} opacity="0.95"/>
                        </g>}
                      </svg>
                    );
                  })()}
                  {crosshair&&chartType==="candle"&&crosshair.open!==undefined&&(
                    <div style={{position:"absolute",top:"4px",left:"8px",display:"flex",gap:"14px",background:dark?"rgba(7,10,14,0.92)":"rgba(255,255,255,0.92)",border:`1px solid ${D.bdr}`,borderRadius:"5px",padding:"4px 12px",pointerEvents:"none",backdropFilter:"blur(4px)"}}>
                      {[["O",crosshair.open],["H",crosshair.high],["L",crosshair.low],["C",crosshair.price]].map(([label,val])=>(
                        <div key={label} style={{textAlign:"center"}}>
                          <div style={{color:D.txtD,fontSize:"9px",letterSpacing:"0.08em"}}>{label}</div>
                          <div style={{fontFamily:ORB,fontSize:"12px",color:label==="C"?(crosshair.price>=crosshair.open?D.buyT:D.askT):D.txtM}}>${val?.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{flex:1,display:"flex",overflow:"hidden"}}>
              {[["BUY PRICE",bids,maxB,D.bidT,"bid"],["SELL PRICE",asks,maxA,D.askT,"ask"]].map(([label,rows,mx,tc,side])=>(
                <div key={label} style={{flex:1,display:"flex",flexDirection:"column",borderRight:`1px solid ${D.bdr}`,overflow:"hidden"}}>
                  <div style={{padding:"5px 12px",borderBottom:`1px solid ${D.bdr}`,background:D.bg3,color:tc,fontSize:"14px",letterSpacing:"0.1em",flexShrink:0}}>▸ {label}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 36px 70px 70px",padding:"3px 12px",color:D.txtD,fontSize:"13px",borderBottom:`1px solid ${D.bdr}`,background:D.bg3,flexShrink:0}}>
                    <span>PER UNIT</span><span style={{textAlign:"right"}}>QTY</span><span style={{textAlign:"right"}}>TOTAL</span><span style={{textAlign:"right",opacity:0}}> </span>
                  </div>
                  <div style={{flex:1,overflowY:"auto",background:D.bg2}}>
                    {rows.map((r,i)=>{
                      const rowTotal=+(r.price*r.qty).toFixed(2);
                      return(
                        <div key={i} onClick={()=>{setOPrice(r.price.toString());setOSide(side==="bid"?"sell":"buy");}} style={{display:"grid",gridTemplateColumns:"1fr 36px 70px 70px",padding:"4px 12px",borderBottom:`1px solid ${D.bdr}`,position:"relative",cursor:"pointer",alignItems:"center"}}>
                          <div style={{position:"absolute",[side==="bid"?"left":"right"]:0,top:0,bottom:0,width:`${(r.qty/mx)*100}%`,background:side==="bid"?(dark?"rgba(0,180,60,0.07)":"rgba(22,128,58,0.06)"):(dark?"rgba(180,40,40,0.08)":"rgba(180,30,30,0.06)")}}/>
                          <div style={{zIndex:1}}>
                            <div style={{color:tc,fontSize:"17px"}}>${r.price.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
                            <div style={{color:D.txtD,fontSize:"13px"}}>per card</div>
                          </div>
                          <span style={{textAlign:"right",color:D.txtM,fontSize:"17px",zIndex:1}}>{r.qty}</span>
                          <span style={{textAlign:"right",color:D.txtM,fontSize:"16px",zIndex:1,fontWeight:"bold"}}>${rowTotal.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                          <span style={{textAlign:"right",color:D.txtD,fontSize:"13px",zIndex:1}}>total</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                <div style={{padding:"5px 12px",borderBottom:`1px solid ${D.bdr}`,background:D.bg3,color:D.txtD,fontSize:"14px",letterSpacing:"0.1em",display:"flex",justifyContent:"space-between",flexShrink:0}}><span>▸ TRADES</span><span style={{color:D.buyT,fontSize:"13px"}}>● LIVE</span></div>
                <div style={{display:"grid",gridTemplateColumns:"70px 1fr 36px",padding:"3px 12px",color:D.txtD,fontSize:"13px",borderBottom:`1px solid ${D.bdr}`,background:D.bg3,flexShrink:0}}><span>TIME</span><span>PRICE</span><span style={{textAlign:"right"}}>QTY</span></div>
                <div style={{flex:1,overflowY:"auto",background:D.bg2}}>
                  {trades.map(t=>(
                    <div key={t.id} style={{display:"grid",gridTemplateColumns:"70px 1fr 36px",padding:"4px 12px",borderBottom:`1px solid ${D.bdr}`,alignItems:"center"}}>
                      <span style={{color:D.txtD,fontSize:"13px"}}>{t.time}</span>
                      <span style={{color:t.side==="buy"?D.buyT:D.askT,fontSize:"14px"}}>${t.price.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                      <span style={{textAlign:"right",color:D.txtM,fontSize:"13px"}}>{t.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{width:"220px",borderLeft:`1px solid ${D.bdr}`,background:D.bg2,flexShrink:0,overflowY:"auto"}}>
            <div style={{padding:"8px 14px",borderBottom:`1px solid ${D.bdr}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:D.txtD,fontSize:"14px",letterSpacing:"0.12em"}}>▸ PLACE ORDER</span>
              <span style={{color:D.txtM,fontSize:"14px"}}>💵 ${balance.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
            </div>
            <div style={{padding:"14px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",border:`1px solid ${D.bdr}`,borderRadius:"5px",overflow:"hidden",marginBottom:"14px"}}>
                {["buy","sell"].map(s=><button key={s} onClick={()=>setOSide(s)} style={{padding:"9px",border:"none",cursor:"pointer",fontFamily:MONO,fontSize:"16px",letterSpacing:"0.1em",background:oSide===s?(s==="buy"?(dark?"rgba(0,180,60,0.18)":"rgba(22,128,58,0.12)"):(dark?"rgba(180,30,30,0.18)":"rgba(180,30,30,0.10)")):"transparent",color:oSide===s?(s==="buy"?D.buyT:D.askT):D.txtD,borderBottom:`2px solid ${oSide===s?(s==="buy"?D.buyT:D.askT):"transparent"}`,transition:"all 0.14s"}}>{s.toUpperCase()}</button>)}
              </div>
              <div style={{marginBottom:"12px"}}>
                <div style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.1em",marginBottom:"5px"}}>ORDER TYPE</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px"}}>
                  <div style={{padding:"5px 10px",background:dark?"rgba(0,100,30,0.1)":"rgba(22,128,58,0.06)",border:`1px solid ${D.accD}`,borderRadius:"4px",color:D.accD,fontSize:"14px",fontFamily:MONO,letterSpacing:"0.08em"}}>SET PRICE</div>
                </div>
              </div>
              <div style={{marginBottom:"10px"}}><div style={{color:D.txtD,fontSize:"13px",marginBottom:"4px"}}>PRICE (USD)</div><input type="number" value={oPrice} onChange={e=>setOPrice(e.target.value)} placeholder={price.toFixed(2)} style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"4px",padding:"7px 10px",color:D.txt,fontSize:"17px"}}/></div>
              <div style={{marginBottom:"10px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                  <span style={{color:D.txtD,fontSize:"13px"}}>QUANTITY</span>
                  {oSide==="sell"&&(()=>{
                    const h=holdings.find(hh=>hh.cardId===card.id);
                    const owned=h?.qty||0;
                    const locked=h?.lockedQty||0;
                    const free=owned-locked;
                    return owned>0?(
                      <span style={{fontSize:"13px",color:locked>0?"#f59e0b":D.txtD,cursor:"pointer"}} onClick={()=>setOQty(String(free))} title="Click to fill max free qty">
                        {locked>0?`${free} free / ${locked} 🔒`:`${owned} owned`} (MAX)
                      </span>
                    ):null;
                  })()}
                </div>
                <input type="number" value={oQty} onChange={e=>setOQty(e.target.value)} placeholder="0" style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"4px",padding:"7px 10px",color:D.txt,fontSize:"17px"}}/>
              <div style={{marginBottom:"10px"}}>
                <div style={{color:D.txtD,fontSize:"13px",marginBottom:"6px"}}>TIME IN FORCE</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"4px"}}>
                  {EXPIRY_OPTS.map(o=>(
                    <button key={o.val} onClick={()=>setOExpiry(o.val)} style={{padding:"6px 2px",border:`1px solid ${oExpiry===o.val?D.accD:D.bdr}`,borderRadius:"4px",background:oExpiry===o.val?(dark?"rgba(0,100,30,0.15)":"rgba(22,128,58,0.08)"):"transparent",color:oExpiry===o.val?D.accD:D.txtD,fontSize:"12px",fontFamily:MONO,cursor:"pointer",textAlign:"center"}}>
                      <div style={{fontWeight:"bold"}}>{o.short}</div>
                    </button>
                  ))}
                </div>
              </div>
              </div>
              <div style={{background:D.stBg,border:`1px solid ${D.bdr}`,borderRadius:"4px",padding:"8px 10px",marginBottom:"14px",display:"flex",justifyContent:"space-between"}}><span style={{color:D.txtD,fontSize:"13px"}}>TOTAL</span><span style={{color:D.txtM,fontSize:"19px"}}>${((+oPrice||price)*(+oQty||0)).toLocaleString("en-US",{minimumFractionDigits:2})}</span></div>
              {/* Instant buy/sell */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px",marginBottom:"8px"}}>
                <button onClick={()=>{
                  if(!oQty){setOStatus({error:"Enter quantity"});setTimeout(()=>setOStatus(null),2000);return;}
                  setOSide("buy");setOType("market");
                  if(onPlaceOrder) onPlaceOrder({cardId:card.id,side:"buy",type:"market",price:asks[0]?.price||price,qty:+oQty});
                  setOStatus({side:"buy",price:asks[0]?.price||price,qty:+oQty});
                  setTimeout(()=>setOStatus(null),3000); setOQty("");
                }} style={{padding:"7px",border:`1px solid ${dark?"#1a5a2a":"#7ab07a"}`,borderRadius:"4px",fontSize:"13px",fontFamily:MONO,letterSpacing:"0.06em",fontWeight:"bold",background:dark?"rgba(0,180,60,0.18)":"rgba(22,128,58,0.12)",color:dark?"#00ff55":"#1a5a2a",cursor:"pointer"}}>⚡ INSTANT BUY</button>
                <button onClick={()=>{
                  if(!oQty){setOStatus({error:"Enter quantity"});setTimeout(()=>setOStatus(null),2000);return;}
                  setOSide("sell");setOType("market");
                  if(onPlaceOrder) onPlaceOrder({cardId:card.id,side:"sell",type:"market",price:bids[0]?.price||price,qty:+oQty});
                  setOStatus({side:"sell",price:bids[0]?.price||price,qty:+oQty});
                  setTimeout(()=>setOStatus(null),3000); setOQty("");
                }} style={{padding:"7px",border:`1px solid ${dark?"#5a1a1a":"#c07070"}`,borderRadius:"4px",fontSize:"13px",fontFamily:MONO,letterSpacing:"0.06em",fontWeight:"bold",background:dark?"rgba(180,30,30,0.18)":"rgba(180,30,30,0.10)",color:dark?"#ff5555":"#9a1a1a",cursor:"pointer"}}>⚡ INSTANT SELL</button>
              </div>
              <button onClick={submitOrder} style={{width:"100%",padding:"10px",border:`1px solid ${oSide==="buy"?(dark?"#1a5a2a":"#7ab07a"):(dark?"#5a1a1a":"#c07070")}`,borderRadius:"5px",fontSize:"16px",fontFamily:MONO,letterSpacing:"0.1em",fontWeight:"bold",background:oSide==="buy"?(dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#cceacc,#a8d8a8)"):(dark?"linear-gradient(135deg,#3a0a0a,#5a1010)":"linear-gradient(135deg,#eacccc,#d8a8a8)"),color:oSide==="buy"?(dark?"#00ff55":"#1a5a2a"):(dark?"#ff5555":"#9a1a1a"),cursor:"pointer"}}>
                {oSide==="buy"?"▲ BUY":"▼ SELL"} {card.name.split(" ")[0].toUpperCase()}
              </button>
              {oStatus&&<div style={{marginTop:"10px",padding:"8px 10px",background:oStatus.error?(dark?"rgba(180,30,30,0.08)":"rgba(220,50,50,0.06)"):(dark?"rgba(0,180,60,0.08)":"rgba(22,128,58,0.08)"),border:`1px solid ${oStatus.error?(dark?"#5a1a1a":"#e07070"):(dark?"#1a4a1a":"#8acc8a")}`,borderRadius:"4px",fontSize:"14px",color:oStatus.error?D.askT:D.accD,lineHeight:"1.8"}}>{oStatus.error?`⚠ ${oStatus.error}`:<>✓ ORDER PLACED<br/><span style={{color:D.txtM}}>{oStatus.side?.toUpperCase()} {oStatus.qty}x @ ${oStatus.price?.toFixed(2)}</span></>}</div>}
              <div style={{marginTop:"16px",paddingTop:"12px",borderTop:`1px solid ${D.bdr}`}}>
                {[["BEST SELL PRICE",`$${asks[0]?.price.toFixed(2)}`],["BEST BUY PRICE",`$${bids[0]?.price.toFixed(2)}`],["LAST TRADE",`$${price.toFixed(2)}`],["SPREAD",`$${spread.toFixed(2)}`]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}><span style={{color:D.txtD,fontSize:"13px"}}>{k}</span><span style={{color:D.txtM,fontSize:"14px"}}>{v}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Auth Modal ────────────────────────────────────────────────────────────────
function AuthModal({D,dark,onClose,onAuth}){
  const isMobile=useIsMobile();
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [name,setName]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [rememberMe,setRememberMe]=useState(true);

  const submit=async()=>{
    setError(""); setSuccess(""); setLoading(true);
    try{
      const {supabase}=await import('./supabase');
      if(mode==="signup"){
        const {data,error:e}=await supabase.auth.signUp({email,password,options:{data:{display_name:name}}});
        if(e) throw e;
        if(data.user && !data.session){ setSuccess("Check your email to confirm your account."); setLoading(false); return; }
        if(data.user) onAuth(data.user);
      } else {
        // rememberMe: 30 days vs session-only (tab close logs out)
        const {data,error:e}=await supabase.auth.signInWithPassword({email,password});
        if(e) throw e;
        if(!rememberMe){
          // Set a short-lived session flag so on next load we don't restore
          sessionStorage.setItem("cx_session_only","1");
        } else {
          sessionStorage.removeItem("cx_session_only");
        }
        onAuth(data.user);
      }
    } catch(e){ setError(e.message||"Something went wrong"); }
    setLoading(false);
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{background:D.bg2,border:`1px solid ${D.bdr2}`,borderRadius:isMobile?"0":"12px",padding:isMobile?"24px 20px":"32px",width:isMobile?"100vw":"380px",maxHeight:isMobile?"100vh":"auto",overflowY:"auto",boxShadow:"0 24px 60px rgba(0,0,0,0.4)",position:isMobile?"fixed":"relative",inset:isMobile?"0":undefined}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
          <div>
            <div style={{fontFamily:ORB,fontSize:"26px",fontWeight:800,color:D.acc,letterSpacing:"0.12em"}}>◈ CX</div>
            <div style={{color:D.txtD,fontSize:"16px",marginTop:"2px"}}>{mode==="login"?"Welcome back":"Create your account"}</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:D.txtD,fontSize:"29px",lineHeight:1,cursor:"pointer"}}>×</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",border:`1px solid ${D.bdr}`,borderRadius:"6px",overflow:"hidden",marginBottom:"20px"}}>
          {[["login","LOG IN"],["signup","SIGN UP"]].map(([m,label])=>(
            <button key={m} onClick={()=>{setMode(m);setError("");setSuccess("");}} style={{padding:"9px",border:"none",cursor:"pointer",fontFamily:MONO,fontSize:"14px",letterSpacing:"0.1em",background:mode===m?(dark?"rgba(0,180,60,0.18)":"rgba(22,128,58,0.10)"):"transparent",color:mode===m?D.accD:D.txtD,borderBottom:`2px solid ${mode===m?D.accD:"transparent"}`,transition:"all 0.14s"}}>{label}</button>
          ))}
        </div>

        {mode==="signup"&&(
          <div style={{marginBottom:"14px"}}>
            <div style={{color:D.txtD,fontSize:"14px",marginBottom:"5px",letterSpacing:"0.08em"}}>DISPLAY NAME</div>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"5px",padding:"10px 12px",color:D.txt,fontSize:"17px",fontFamily:MONO}}/>
          </div>
        )}
        <div style={{marginBottom:"14px"}}>
          <div style={{color:D.txtD,fontSize:"14px",marginBottom:"5px",letterSpacing:"0.08em"}}>EMAIL</div>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="you@email.com" style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"5px",padding:"10px 12px",color:D.txt,fontSize:"17px",fontFamily:MONO}}/>
        </div>
        <div style={{marginBottom:"14px"}}>
          <div style={{color:D.txtD,fontSize:"14px",marginBottom:"5px",letterSpacing:"0.08em"}}>PASSWORD</div>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••••••" style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"5px",padding:"10px 12px",color:D.txt,fontSize:"17px",fontFamily:MONO}}/>
        </div>

        {mode==="login"&&(
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"18px",cursor:"pointer"}} onClick={()=>setRememberMe(r=>!r)}>
            <div style={{width:"16px",height:"16px",borderRadius:"3px",border:`1px solid ${rememberMe?D.accD:D.bdr2}`,background:rememberMe?(dark?"rgba(0,180,60,0.25)":"rgba(22,128,58,0.15)"):"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
              {rememberMe&&<span style={{color:D.accD,fontSize:"16px",lineHeight:1}}>✓</span>}
            </div>
            <span style={{color:D.txtD,fontSize:"14px",userSelect:"none"}}>Remember me for 30 days</span>
          </div>
        )}

        {error&&<div style={{marginBottom:"14px",padding:"8px 12px",background:dark?"rgba(180,30,30,0.1)":"rgba(220,50,50,0.06)",border:`1px solid ${dark?"#5a1a1a":"#e07070"}`,borderRadius:"4px",color:D.askT,fontSize:"14px"}}>{error}</div>}
        {success&&<div style={{marginBottom:"14px",padding:"8px 12px",background:dark?"rgba(0,180,60,0.1)":"rgba(22,128,58,0.06)",border:`1px solid ${dark?"#1a4a1a":"#8acc8a"}`,borderRadius:"4px",color:D.accD,fontSize:"14px"}}>{success}</div>}

        <button onClick={submit} disabled={loading} style={{width:"100%",padding:"11px",border:`1px solid ${dark?"#1a5a2a":"#7ab07a"}`,borderRadius:"6px",fontSize:"16px",fontFamily:MONO,letterSpacing:"0.1em",fontWeight:"bold",background:dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#cceacc,#a8d8a8)",color:dark?"#00ff55":"#1a5a2a",cursor:loading?"wait":"pointer",opacity:loading?0.7:1}}>
          {loading?"...":(mode==="login"?"→ LOG IN":"→ CREATE ACCOUNT")}
        </button>
      </div>
    </div>
  );
}


// ── Waitlist Form ─────────────────────────────────────────────────────────────
function WaitlistForm({D,dark,isMobile=false,onLoginClick}){
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [role,setRole]=useState(""); // "shop" | "collector"
  const [games,setGames]=useState([]); // multi-select
  const [feature,setFeature]=useState("");
  const [step,setStep]=useState("form"); // "form" | "submitting" | "done" | "error"
  const [error,setError]=useState("");
  const [position,setPosition]=useState(null); // queue position after submit

  const GAMES=["Pokémon","MTG","Yu-Gi-Oh!","One Piece","Lorcana","Flesh & Blood","Other"];

  const toggleGame=(g)=>setGames(p=>p.includes(g)?p.filter(x=>x!==g):[...p,g]);

  const submit=async()=>{
    if(!name.trim()||!email.trim()||!role||games.length===0){
      setError("Please fill in all fields and select at least one game.");
      return;
    }
    if(!/^[^@]+@[^@]+\.[^@]+$/.test(email)){
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setStep("submitting");
    try{
      const {supabase}=await import('./supabase');
      // Check for duplicate email
      const {data:existing}=await supabase.from('waitlist').select('id,position').eq('email',email.toLowerCase().trim());
      if(existing?.length){
        setPosition(existing[0].position);
        setStep("done");
        return;
      }
      // Get current count for position
      const {count}=await supabase.from('waitlist').select('*',{count:'exact',head:true});
      const pos=(count||0)+1;
      const {error:e}=await supabase.from('waitlist').insert({
        name:name.trim(),
        email:email.toLowerCase().trim(),
        role,
        games,
        feature_request:feature.trim()||null,
        position:pos,
        signed_up_at:new Date().toISOString(),
      });
      if(e) throw e;
      setPosition(pos);
      setStep("done");
    } catch(e){
      setError("Something went wrong. Please try again.");
      setStep("form");
    }
  };

  const inputStyle={width:"100%",background:dark?"rgba(0,0,0,0.3)":"#fff",border:`1px solid ${dark?"#2a5a2a":"#c8dcc8"}`,borderRadius:"6px",padding:"11px 14px",color:dark?"#a8b8a0":"#1a2a1a",fontSize:"13px",fontFamily:"'Share Tech Mono',monospace",outline:"none",boxSizing:"border-box"};

  if(step==="done") return(
    <div style={{background:dark?"rgba(0,20,0,0.6)":"rgba(255,255,255,0.95)",backdropFilter:"blur(8px)",border:`1px solid ${dark?"#1a5a2a":"#86efac"}`,borderRadius:"12px",padding:"36px 32px",textAlign:"center",maxWidth:"480px",margin:"0 auto"}}>
      <div style={{fontSize:"48px",marginBottom:"16px"}}>🎉</div>
      <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:"18px",fontWeight:800,color:dark?"#00cc40":"#15803d",letterSpacing:"0.08em",marginBottom:"10px"}}>YOU'RE ON THE LIST</div>
      <div style={{color:dark?"#6aaa6a":"#3a7a3a",fontSize:"13px",marginBottom:"8px"}}>
        You're <span style={{fontFamily:"'Orbitron',sans-serif",fontWeight:800,color:dark?"#00ff55":"#15803d",fontSize:"18px"}}>#{position}</span> in the queue
      </div>
      <div style={{color:dark?"#4a8a4a":"#5a7a5a",fontSize:"11px",lineHeight:"1.7",marginBottom:"24px"}}>
        We'll email you at <strong>{email}</strong> when your spot is ready.<br/>
        In the meantime, explore the demo below.
      </div>
      <button onClick={onLoginClick} style={{padding:"10px 28px",background:"transparent",border:`1px solid ${dark?"#2a5a2a":"#c5d8c5"}`,borderRadius:"6px",color:dark?"#4a8a4a":"#3a7a3a",fontSize:"10px",fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",letterSpacing:"0.1em"}}>EXPLORE DEMO ▸</button>
    </div>
  );

  return(
    <div style={{background:dark?"rgba(0,20,0,0.6)":"rgba(255,255,255,0.95)",backdropFilter:"blur(8px)",border:`1px solid ${dark?"#1a5a2a":"#a8d4a8"}`,borderRadius:"12px",padding:isMobile?"24px 20px":"36px 32px",maxWidth:"520px",margin:"0 auto",boxShadow:dark?"0 0 60px rgba(0,255,80,0.06)":"0 16px 48px rgba(0,0,0,0.08)"}}>
      <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:"13px",fontWeight:800,color:dark?"#00cc40":"#15803d",letterSpacing:"0.14em",marginBottom:"6px"}}>◈ JOIN THE ALPHA</div>
      <div style={{color:dark?"#4a8a4a":"#5a7a5a",fontSize:"11px",marginBottom:"24px",lineHeight:"1.6"}}>Be among the first to trade on Collector's Exchange. We're onboarding in small batches.</div>

      {/* Name + Email */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"10px",marginBottom:"12px"}}>
        <div>
          <div style={{color:dark?"#4a8a4a":"#5a7a5a",fontSize:"9px",letterSpacing:"0.1em",marginBottom:"5px"}}>YOUR NAME</div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="First name" style={inputStyle}/>
        </div>
        <div>
          <div style={{color:dark?"#4a8a4a":"#5a7a5a",fontSize:"9px",letterSpacing:"0.1em",marginBottom:"5px"}}>EMAIL ADDRESS</div>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" style={inputStyle}/>
        </div>
      </div>

      {/* Role */}
      <div style={{marginBottom:"12px"}}>
        <div style={{color:dark?"#4a8a4a":"#5a7a5a",fontSize:"9px",letterSpacing:"0.1em",marginBottom:"8px"}}>I AM A...</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
          {[["shop","🏪 Shop Owner","I run a card shop or sell professionally"],["collector","🃏 Collector","I buy and trade for my personal collection"]].map(([val,label,desc])=>(
            <button key={val} onClick={()=>setRole(val)} style={{padding:"12px",border:`1px solid ${role===val?(dark?"#00cc40":"#15803d"):(dark?"#1a3a1a":"#c8dcc8")}`,borderRadius:"7px",background:role===val?(dark?"rgba(0,180,60,0.12)":"rgba(22,128,58,0.07)"):"transparent",cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
              <div style={{color:role===val?(dark?"#00cc40":"#15803d"):(dark?"#a8b8a0":"#1a2a1a"),fontSize:"12px",fontFamily:"'Share Tech Mono',monospace",marginBottom:"3px"}}>{label}</div>
              <div style={{color:dark?"#3a6a3a":"#7a9a7a",fontSize:"9px"}}>{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Games */}
      <div style={{marginBottom:"12px"}}>
        <div style={{color:dark?"#4a8a4a":"#5a7a5a",fontSize:"9px",letterSpacing:"0.1em",marginBottom:"8px"}}>GAMES I PLAY <span style={{opacity:0.6}}>(select all that apply)</span></div>
        <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
          {GAMES.map(g=>(
            <button key={g} onClick={()=>toggleGame(g)} style={{padding:"5px 12px",border:`1px solid ${games.includes(g)?(dark?"#00cc40":"#15803d"):(dark?"#1a3a1a":"#c8dcc8")}`,borderRadius:"20px",background:games.includes(g)?(dark?"rgba(0,180,60,0.12)":"rgba(22,128,58,0.08)"):"transparent",color:games.includes(g)?(dark?"#00cc40":"#15803d"):(dark?"#6a8a6a":"#5a7a5a"),fontSize:"10px",fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",transition:"all 0.12s"}}>
              {games.includes(g)?"✓ ":""}{g}
            </button>
          ))}
        </div>
      </div>

      {/* Feature request */}
      <div style={{marginBottom:"20px"}}>
        <div style={{color:dark?"#4a8a4a":"#5a7a5a",fontSize:"9px",letterSpacing:"0.1em",marginBottom:"5px"}}>ONE FEATURE YOU'D LOVE TO SEE <span style={{opacity:0.6}}>(optional)</span></div>
        <input value={feature} onChange={e=>setFeature(e.target.value)} placeholder="e.g. bulk pricing tools, trade history export..." style={{...inputStyle,fontSize:"12px"}}/>
      </div>

      {error&&<div style={{marginBottom:"14px",padding:"10px 12px",background:dark?"rgba(180,30,30,0.1)":"rgba(220,50,50,0.06)",border:`1px solid ${dark?"#5a1a1a":"#e07070"}`,borderRadius:"5px",color:dark?"#ff8080":"#dc2626",fontSize:"10px"}}>{error}</div>}

      <button onClick={submit} disabled={step==="submitting"} style={{width:"100%",padding:"13px",background:dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#b8e8b8,#8acc8a)",border:`1px solid ${dark?"#1a5a2a":"#5a9a5a"}`,borderRadius:"7px",color:dark?"#00ff55":"#1a4a1a",fontSize:"12px",fontFamily:"'Share Tech Mono',monospace",cursor:step==="submitting"?"wait":"pointer",letterSpacing:"0.1em",fontWeight:"bold",opacity:step==="submitting"?0.7:1}}>
        {step==="submitting"?"JOINING...":"JOIN THE WAITLIST →"}
      </button>

      <div style={{textAlign:"center",marginTop:"14px",color:dark?"#2a5a2a":"#9aaa9a",fontSize:"9px"}}>
        Already have an account? <span onClick={onLoginClick} style={{color:dark?"#4a8a4a":"#3a7a3a",cursor:"pointer",textDecoration:"underline"}}>Log in here</span>
      </div>
    </div>
  );
}

// ── Landing Page ──────────────────────────────────────────────────────────────
function Landing({D,dark,dbCards,onEnterDemo,onOpenAuth}){
  const isMobile=useIsMobile();
  const allCards=dbCards.length?dbCards:CARDS.map(c=>({...c,basePrice:BASE[c.id]}));
  const featuredCard=allCards.find(c=>c.id===1)||allCards[0]||CARDS[0];
  const base=featuredCard.basePrice||BASE[featuredCard.id]||420;

  const [price,setPrice]=useState(base);
  const [hist,setHist]=useState(()=>genHist(base));
  const [flash,setFlash]=useState(null);
  const [liveAsks,setLiveAsks]=useState(()=>genOrders(base,5,"ask"));
  const [liveBids,setLiveBids]=useState(()=>genOrders(base,5,"bid"));
  const [liveTrades,setLiveTrades]=useState(()=>Array.from({length:8},()=>genTrade(base)));

  useEffect(()=>{
    // Landing demo ticks every 8s — just eye candy, no need to hammer it
    const iv=setInterval(()=>{
      const t=genTrade(base);
      setFlash(t.price>price?"up":"down");
      setTimeout(()=>setFlash(null),400);
      setPrice(t.price);
      setHist(h=>[...h.slice(1),{p:t.price}]);
      setLiveAsks(genOrders(t.price,5,"ask"));
      setLiveBids(genOrders(t.price,5,"bid"));
      setLiveTrades(p=>[t,...p.slice(0,7)]);
    },8000);
    return ()=>clearInterval(iv);
  },[base,price]);

  const CW=500,CH=120;
  const minP=Math.min(...hist.map(h=>h.p)),maxP=Math.max(...hist.map(h=>h.p)),rng=maxP-minP||1;
  const lp=hist.map((h,i)=>`${i===0?"M":"L"}${((i/(hist.length-1))*CW).toFixed(1)},${((CH-4)-((h.p-minP)/rng)*(CH-8)).toFixed(1)}`).join(" ");

  const FEATURES=[
    {icon:"◈",title:"Multi-Game Market",desc:"Trade Pokémon, MTG, Yu-Gi-Oh! and One Piece cards all in one place with live pricing."},
    {icon:"⬡",title:"Real-Time Order Book",desc:"See live bids and asks, place limit orders or buy instantly at market price with one tap."},
    {icon:"◇",title:"Portfolio Tracker",desc:"Track your holdings, average cost, unrealised P&L and trade history across all games."},
    {icon:"▣",title:"Price History",desc:"Every trade you make is recorded and plotted on the chart — real history, not guesswork."},
    {icon:"📂",title:"Binder & CSV Import",desc:"Import your collection from any binder app or spreadsheet in seconds. We auto-detect columns, map conditions, and get your cards live on the market fast."},
    {icon:"🔔",title:"Smart Notifications",desc:"Get browser push alerts when your orders fill or a card hits your price target — even when you're on another tab."},
  ];

  return(
    <div style={{fontFamily:MONO,background:dark?"#070a0e":"#f0f4f0",minHeight:"100vh",color:dark?"#a8b8a0":"#2a3a2a",overflowY:"auto"}}>

      {/* ── Hero ── */}
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>

        {/* Live market background */}
        <div style={{position:"absolute",inset:0,opacity:0.18,pointerEvents:"none",overflow:"hidden"}}>
          <div style={{position:"absolute",right:"-60px",top:"60px",width:"620px",background:dark?"#080c08":"#ffffff",border:`1px solid ${dark?"#0f1f0f":"#dde8dd"}`,borderRadius:"12px",padding:"16px",boxShadow:dark?"0 0 60px rgba(0,255,80,0.08)":"0 8px 40px rgba(0,0,0,0.08)"}}>
            <div style={{display:"flex",gap:"12px",alignItems:"center",marginBottom:"12px"}}>
              <img src={proxyImg(featuredCard.img||featuredCard.img_url)} style={{width:"50px",height:"70px",objectFit:"cover",borderRadius:"4px"}} onError={e=>e.target.style.display="none"}/>
              <div>
                <div style={{fontFamily:ORB,fontSize:"14px",fontWeight:700,color:dark?"#a8b8a0":"#2a3a2a"}}>{featuredCard.name}</div>
                <div style={{fontSize:"11px",color:dark?"#4a8a4a":"#7a9a7a",marginTop:"2px"}}>{featuredCard.set||featuredCard.set_name}</div>
                <div className={flash==="up"?"fu":flash==="down"?"fd":""} style={{fontFamily:ORB,fontSize:"20px",fontWeight:800,color:dark?"#00cc40":"#15803d",marginTop:"4px"}}>${price.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
              </div>
            </div>
            <svg width="100%" height={CH} viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none">
              <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={dark?"#00cc40":"#15803d"} stopOpacity="0.2"/><stop offset="100%" stopColor={dark?"#00cc40":"#15803d"} stopOpacity="0"/></linearGradient></defs>
              <path d={lp+` L${CW},${CH} L0,${CH} Z`} fill="url(#lg)"/>
              <path d={lp} fill="none" stroke={dark?"#00cc40":"#15803d"} strokeWidth="2"/>
            </svg>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginTop:"12px"}}>
              {[liveBids.slice(0,3),liveAsks.slice(0,3)].map((rows,si)=>(
                <div key={si}>{rows.map((r,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:`1px solid ${dark?"#0f1f0f":"#dde8dd"}`}}>
                    <span style={{color:si===0?(dark?"#00cc40":"#15803d"):(dark?"#cc3535":"#dc2626"),fontSize:"10px"}}>${r.price.toFixed(2)}</span>
                    <span style={{color:dark?"#4a8a4a":"#7a9a7a",fontSize:"10px"}}>{r.qty}</span>
                  </div>
                ))}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Overlay gradient */}
        <div style={{position:"absolute",inset:0,background:dark?"linear-gradient(135deg,rgba(7,10,14,0.92) 50%,rgba(7,10,14,0.6))":"linear-gradient(135deg,rgba(240,244,240,0.94) 50%,rgba(240,244,240,0.5))",pointerEvents:"none"}}/>

        {/* Nav */}
        <div style={{position:"relative",zIndex:10,borderBottom:`1px solid ${dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.06)"}`}}>
          <div style={{maxWidth:"1100px",margin:"0 auto",width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:isMobile?"14px 16px":"20px 40px"}}>
            <div style={{display:"flex",alignItems:"baseline",gap:"8px"}}>
              <span style={{fontFamily:ORB,fontSize:"18px",fontWeight:800,color:dark?"#00cc40":"#15803d",letterSpacing:"0.18em"}}>◈ CX</span>
              {!isMobile&&<span style={{fontFamily:ORB,fontSize:"12px",fontWeight:600,color:dark?"#4a8a4a":"#3a7a3a",letterSpacing:"0.08em"}}>COLLECTOR'S EXCHANGE</span>}
            </div>
            <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
              {!isMobile&&<button onClick={onEnterDemo} style={{padding:"8px 18px",background:"transparent",border:`1px solid ${dark?"#2a5a2a":"#b8d4b8"}`,borderRadius:"5px",color:dark?"#4a8a4a":"#3a7a3a",fontSize:"10px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.1em"}}>DEMO</button>}
              {!isMobile&&<button onClick={()=>onOpenAuth("login")} style={{padding:"8px 18px",background:"transparent",border:`1px solid ${dark?"#4a8a4a":"#7a9a7a"}`,borderRadius:"5px",color:dark?"#a8b8a0":"#2a3a2a",fontSize:"10px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.1em"}}>LOG IN</button>}
              <button onClick={()=>document.getElementById("cx-waitlist")?.scrollIntoView({behavior:"smooth"})} style={{padding:"8px 16px",background:dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#cceacc,#a8d8a8)",border:`1px solid ${dark?"#1a5a2a":"#7ab07a"}`,borderRadius:"5px",color:dark?"#00ff55":"#1a5a2a",fontSize:"10px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.1em",fontWeight:"bold"}}>JOIN WAITLIST →</button>
            </div>
          </div>
        </div>

        {/* Hero content */}
        <div id="cx-waitlist" style={{position:"relative",zIndex:10,flex:1,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",padding:isMobile?"40px 20px":"60px 40px",textAlign:"center"}}>
          <div style={{maxWidth:"700px",width:"100%",display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:"8px",background:dark?"rgba(0,180,60,0.08)":"rgba(22,128,58,0.06)",border:`1px solid ${dark?"#1a4a1a":"#a8d4a8"}`,borderRadius:"20px",padding:"5px 14px",marginBottom:"28px"}}>
              <span style={{color:dark?"#00cc40":"#15803d",fontSize:"9px"}}>●</span>
              <span style={{color:dark?"#4a8a4a":"#3a7a3a",fontSize:"10px",letterSpacing:"0.12em"}}>LIVE MARKET · DEMO AVAILABLE</span>
            </div>
            <h1 style={{fontFamily:ORB,fontSize:"clamp(32px,5vw,58px)",fontWeight:800,lineHeight:1.1,letterSpacing:"0.04em",color:dark?"#a8b8a0":"#1a2a1a",marginBottom:"20px"}}>
              The Trading<br/>Platform for<br/><span style={{color:dark?"#00cc40":"#15803d"}}>Collectors.</span>
            </h1>
            <p style={{fontSize:"14px",lineHeight:1.8,color:dark?"#4a8a4a":"#5a7a5a",marginBottom:"36px",maxWidth:"480px"}}>
              Buy, sell and trade rare TCG cards with a real order book, live pricing, and portfolio tracking. Pokémon, MTG, Yu-Gi-Oh! and more.
            </p>
            <WaitlistForm D={D} dark={dark} isMobile={isMobile} onLoginClick={()=>onOpenAuth("login")}/>
            <div style={{display:"flex",gap:"28px",marginTop:"32px",justifyContent:"center"}}>
              {[[allCards.length>=100000?"100k+":allCards.length>0?`${allCards.length}`:"20+","Cards Listed"],["$0","To Get Started"],["Live","Order Matching"]].map(([val,label])=>(
                <div key={label}>
                  <div style={{fontFamily:ORB,fontSize:"22px",fontWeight:800,color:dark?"#00cc40":"#15803d"}}>{val}</div>
                  <div style={{color:dark?"#2a5a2a":"#7a9a7a",fontSize:"9px",marginTop:"3px",letterSpacing:"0.1em"}}>{label}</div>
                </div>
              ))}
            </div>
            <button onClick={onEnterDemo} style={{marginTop:"14px",padding:"10px 24px",background:"transparent",border:`1px solid ${dark?"#1a3a1a":"#c5d8c5"}`,borderRadius:"6px",color:dark?"#3a6a3a":"#5a7a5a",fontSize:"10px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.1em"}}>or explore the demo first ▸</button>
          </div>
        </div>
        {/* Scroll indicator */}
        <div style={{position:"relative",zIndex:10,textAlign:"center",padding:"20px",color:dark?"#2a5a2a":"#b8d4b8",fontSize:"18px",animation:"bounce 2s infinite"}}>▾</div>
      </div>

      {/* ── Features ── */}
      <div style={{padding:isMobile?"40px 16px":"80px 40px",background:dark?"#080c09":"#ffffff",borderTop:`1px solid ${dark?"#0f1f0f":"#dde8dd"}`}}>
        <div style={{maxWidth:"1100px",margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"56px"}}>
          <div style={{fontFamily:ORB,fontSize:"10px",letterSpacing:"0.2em",color:dark?"#2a5a2a":"#7a9a7a",marginBottom:"12px"}}>WHAT YOU GET</div>
          <h2 style={{fontFamily:ORB,fontSize:"32px",fontWeight:800,color:dark?"#a8b8a0":"#1a2a1a",letterSpacing:"0.04em"}}>Built for Serious Collectors</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:"24px",maxWidth:"1000px",margin:"0 auto"}}>
          {FEATURES.map(f=>(
            <div key={f.title} style={{background:dark?"#070a0e":"#f0f4f0",border:`1px solid ${dark?"#0f1f0f":"#dde8dd"}`,borderRadius:"10px",padding:"28px 24px"}}>
              <div style={{fontFamily:ORB,fontSize:"24px",color:dark?"#00cc40":"#15803d",marginBottom:"14px"}}>{f.icon}</div>
              <div style={{fontFamily:ORB,fontSize:"13px",fontWeight:700,color:dark?"#a8b8a0":"#1a2a1a",marginBottom:"10px",letterSpacing:"0.06em"}}>{f.title}</div>
              <div style={{color:dark?"#4a8a4a":"#5a7a5a",fontSize:"11px",lineHeight:"1.8"}}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

        </div>
      {/* ── Live demo strip ── */}
      <div style={{padding:"80px 40px",background:dark?"#070a0e":"#f8faf8",borderTop:`1px solid ${dark?"#0f1f0f":"#dde8dd"}`,textAlign:"center"}}>
        <div style={{maxWidth:"1100px",margin:"0 auto"}}>
        <div style={{fontFamily:ORB,fontSize:"10px",letterSpacing:"0.2em",color:dark?"#2a5a2a":"#7a9a7a",marginBottom:"12px"}}>LIVE RIGHT NOW</div>
        <h2 style={{fontFamily:ORB,fontSize:"28px",fontWeight:800,color:dark?"#a8b8a0":"#1a2a1a",marginBottom:"12px"}}>Watch the Market Move</h2>
        <p style={{color:dark?"#4a8a4a":"#5a7a5a",fontSize:"12px",marginBottom:"36px"}}>Live trade feed updating every 1.6 seconds. This is real simulated market data.</p>
        <div style={{maxWidth:"480px",margin:"0 auto",background:dark?"#080c09":"#ffffff",border:`1px solid ${dark?"#0f1f0f":"#dde8dd"}`,borderRadius:"10px",overflow:"hidden",boxShadow:dark?"0 0 40px rgba(0,255,80,0.06)":"0 8px 32px rgba(0,0,0,0.06)"}}>
          <div style={{display:"flex",justifyContent:"space-between",padding:"12px 16px",borderBottom:`1px solid ${dark?"#0f1f0f":"#dde8dd"}`,background:dark?"#0a0f0a":"#f8faf8"}}>
            <span style={{color:dark?"#4a8a4a":"#3a7a3a",fontSize:"10px",letterSpacing:"0.1em"}}>▸ LIVE TRADES — {featuredCard.name}</span>
            <span style={{color:dark?"#00cc40":"#15803d",fontSize:"9px"}}>● LIVE</span>
          </div>
          {liveTrades.map(t=>(
            <div key={t.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 16px",borderBottom:`1px solid ${dark?"#0f1f0f":"#dde8dd"}`}}>
              <span style={{color:t.side==="buy"?(dark?"#00cc40":"#15803d"):(dark?"#cc3535":"#dc2626"),fontSize:"11px"}}>{t.side.toUpperCase()}</span>
              <span style={{color:dark?"#a8b8a0":"#2a3a2a",fontSize:"11px",fontFamily:ORB}}>${t.price.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
              <span style={{color:dark?"#4a8a4a":"#7a9a7a",fontSize:"11px"}}>{t.qty}x</span>
              <span style={{color:dark?"#2a5a2a":"#9aaa9a",fontSize:"10px"}}>{t.time}</span>
            </div>
          ))}
        </div>
      </div>

        </div>
      {/* ── CTA ── */}
      <div style={{padding:"80px 40px",background:dark?"linear-gradient(135deg,#080c09,#0a100a)":"linear-gradient(135deg,#e8f4e8,#f0f8f0)",borderTop:`1px solid ${dark?"#0f1f0f":"#dde8dd"}`}}>
        <div style={{maxWidth:"1100px",margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:"40px"}}>
            <h2 style={{fontFamily:ORB,fontSize:"32px",fontWeight:800,color:dark?"#a8b8a0":"#1a2a1a",marginBottom:"12px"}}>Ready to Trade?</h2>
            <p style={{color:dark?"#4a8a4a":"#5a7a5a",fontSize:"12px"}}>Join the waitlist and we'll let you know when your spot is ready.</p>
          </div>
          <WaitlistForm D={D} dark={dark} isMobile={isMobile} onLoginClick={()=>onOpenAuth("login")}/>
        </div>
        </div>
      {/* ── Footer ── */}
      <div style={{padding:"20px 40px",borderTop:`1px solid ${dark?"#0f1f0f":"#dde8dd"}`,background:dark?"#070a0e":"#f0f4f0"}}>
        <div style={{maxWidth:"1100px",margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:ORB,fontSize:"12px",color:dark?"#2a5a2a":"#9aaa9a",letterSpacing:"0.12em"}}>◈ COLLECTOR'S EXCHANGE</span>
        <span style={{color:dark?"#1a3a1a":"#b8c8b8",fontSize:"9px"}}>Demo platform · Not financial advice</span>
      </div>
        </div>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}`}</style>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

// ── Ticker ────────────────────────────────────────────────────────────────────
function Ticker({D,dark,tradeHistory=[],dbCards=[],marketPrices={}}){
  const [paused,setPaused]=useState(false);
  const allCards=[...dbCards,...CARDS];

  // Build ticker items from real trades + simulated live ticks
  const items=useMemo(()=>{
    const real=tradeHistory.slice(0,30).map(t=>{
      const card=allCards.find(c=>c.id===t.cardId)||{name:"Unknown",game:""};
      return {id:t.id,name:card.name,game:card.game,price:t.price,qty:t.qty,side:t.side,type:"trade"};
    });
    // Fill up with simulated ticks if not enough real trades
    const sim=Object.entries(marketPrices).slice(0,12).map(([id,price])=>{
      const card=allCards.find(c=>c.id===+id)||{name:"Card",game:""};
      const side=Math.random()>0.5?"buy":"sell";
      return {id:`sim-${id}`,name:card.name,game:card.game,price,qty:Math.floor(Math.random()*3)+1,side,type:"tick"};
    });
    const all=[...real,...sim];
    return all.length ? [...all,...all,...all] : []; // triple for seamless loop
  },[tradeHistory.length,Object.keys(marketPrices).length]);

  if(!items.length) return null;

  return(
    <div
      onMouseEnter={()=>setPaused(true)}
      onMouseLeave={()=>setPaused(false)}
      style={{background:dark?"#050805":"#e8f0e8",borderBottom:`1px solid ${D.bdr}`,height:"28px",overflow:"hidden",flexShrink:0,position:"relative",display:"flex",alignItems:"center"}}
    >
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:"60px",background:dark?"linear-gradient(90deg,#050805,transparent)":"linear-gradient(90deg,#e8f0e8,transparent)",zIndex:2,pointerEvents:"none"}}/>
      <div style={{position:"absolute",right:0,top:0,bottom:0,width:"60px",background:dark?"linear-gradient(270deg,#050805,transparent)":"linear-gradient(270deg,#e8f0e8,transparent)",zIndex:2,pointerEvents:"none"}}/>
      <div style={{
        display:"flex",alignItems:"center",gap:"0",
        animationName:"tickerScroll",
        animationDuration:`${items.length*2.2}s`,
        animationTimingFunction:"linear",
        animationIterationCount:"infinite",
        animationPlayState:paused?"paused":"running",
        whiteSpace:"nowrap",
      }}>
        {items.map((item,i)=>(
          <span key={`${item.id}-${i}`} style={{display:"inline-flex",alignItems:"center",gap:"6px",padding:"0 20px",borderRight:`1px solid ${D.bdr}`,fontSize:"14px",letterSpacing:"0.06em",flexShrink:0}}>
            <span style={{color:item.side==="buy"?D.buyT:D.askT,fontSize:"13px"}}>{item.side==="buy"?"▲":"▼"}</span>
            <span style={{color:D.txtM,fontWeight:600}}>{item.name}</span>
            <span style={{color:dark?"#00cc40":"#15803d",fontFamily:ORB,fontSize:"14px",fontWeight:700}}>${item.price?.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
            <span style={{color:D.txtD}}>×{item.qty}</span>
            {item.game&&<span style={{color:D.txtD,fontSize:"13px",opacity:0.6}}>{item.game}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Notification system ────────────────────────────────────────────────────────
function NotificationBell({D,dark,notifications=[],onClear,onClearAll}){
  const [open,setOpen]=useState(false);
  const unread=notifications.filter(n=>!n.read).length;
  return(
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{position:"relative",background:"none",border:`1px solid ${D.bdr}`,borderRadius:"4px",padding:"3px 8px",color:D.txtD,cursor:"pointer",display:"flex",alignItems:"center",gap:"4px",fontSize:"17px"}}>
        🔔
        {unread>0&&<span style={{position:"absolute",top:"-4px",right:"-4px",background:"#dc2626",color:"#fff",borderRadius:"50%",width:"14px",height:"14px",fontSize:"12px",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:MONO,fontWeight:"bold"}}>{unread>9?"9+":unread}</span>}
      </button>
      {open&&(
        <>
          <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:299}}/>
          <div style={{position:"absolute",right:0,top:"36px",width:"300px",background:D.bg2,border:`1px solid ${D.bdr2}`,borderRadius:"8px",boxShadow:"0 8px 32px rgba(0,0,0,0.3)",zIndex:300,overflow:"hidden"}}>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${D.bdr}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:D.txtD,fontSize:"14px",letterSpacing:"0.12em"}}>▸ NOTIFICATIONS</span>
              {notifications.length>0&&<button onClick={()=>{onClearAll();setOpen(false);}} style={{background:"none",border:"none",color:D.txtD,fontSize:"13px",cursor:"pointer",fontFamily:MONO}}>CLEAR ALL</button>}
            </div>
            <div style={{maxHeight:"320px",overflowY:"auto"}}>
              {notifications.length===0?(
                <div style={{padding:"32px",textAlign:"center",color:D.txtD,fontSize:"16px"}}>No notifications yet</div>
              ):notifications.map(n=>(
                <div key={n.id} style={{padding:"10px 14px",borderBottom:`1px solid ${D.bdr}`,background:n.read?"transparent":(dark?"rgba(0,200,60,0.04)":"rgba(22,128,58,0.03)"),display:"flex",gap:"10px",alignItems:"flex-start"}}>
                  <span style={{fontSize:"20px",flexShrink:0}}>{n.type==="filled_buy"?"📈":n.type==="filled_sell"?"📉":n.type==="partial"?"⏳":"🔔"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:D.txt,fontSize:"16px",lineHeight:1.4}}>{n.message}</div>
                    <div style={{color:D.txtD,fontSize:"13px",marginTop:"3px"}}>{n.time}</div>
                  </div>
                  <button onClick={()=>onClear(n.id)} style={{background:"none",border:"none",color:D.txtD,fontSize:"20px",cursor:"pointer",flexShrink:0,lineHeight:1}}>×</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── CSV Import Modal ───────────────────────────────────────────────────────────
function CSVImportModal({D,dark,dbCards=[],onImport,onClose,marketPrices={},tradeHistory=[]}){
  const [rows,setRows]=useState([]);
  const [step,setStep]=useState("upload"); // upload | preview | listing | done
  const [importing,setImporting]=useState(false);
  const [isBinderExport,setIsBinderExport]=useState(false);
  const [listingPrices,setListingPrices]=useState({}); // rowIndex → custom ask price
  const [listSelected,setListSelected]=useState({}); // rowIndex → bool
  const allCards=[...dbCards,...CARDS];

  // Normalize condition strings to our format (works with binder apps, spreadsheets, etc)
  const normalizeCond=(c="")=>{
    const m={"near mint":"NM","lightly played":"LP","moderately played":"MP","heavily played":"HP","damaged":"DMG","nm":"NM","lp":"LP","mp":"MP","hp":"HP"};
    return m[c.toLowerCase()]||c||"NM";
  };

  // Parse CSV handling quoted fields with commas inside
  const parseCSV=(text)=>{
    const lines=text.trim().split("\n");
    const parseRow=(line)=>{
      const vals=[];let cur="";let inQ=false;
      for(let i=0;i<line.length;i++){
        if(line[i]==='"'){inQ=!inQ;}
        else if(line[i]===","&&!inQ){vals.push(cur.trim());cur="";}
        else{cur+=line[i];}
      }
      vals.push(cur.trim());
      return vals;
    };
    const headers=parseRow(lines[0]).map(h=>h.replace(/^"|"$/g,"").toLowerCase().trim());
    return{headers,rows:lines.slice(1).filter(l=>l.trim()).map(line=>{
      const vals=parseRow(line).map(v=>v.replace(/^"|"$/g,"").trim());
      const row={};headers.forEach((h,i)=>row[h]=vals[i]||"");
      return row;
    })};
  };

  // Detect if this looks like a binder/collection app export (Binder, Moxfield, etc)
  const detectBinderExport=(headers)=>{
    const binderCols=["foil","language","purchase price","collector number","number","product name","set name"];
    return binderCols.filter(c=>headers.includes(c)).length>=2;
  };

  // Compute CX suggested price: best bid + small premium, floored at market price
  // Purely based on CX order book activity — independent of any external price source
  const suggestCXPrice=(cardId)=>{
    const cxPrice=marketPrices[cardId]||0;
    const cardTrades=tradeHistory.filter(t=>t.cardId===cardId);
    const oneDayAgo=Date.now()-86400000;
    const recentTrades=cardTrades.filter(t=>new Date(t.date+" "+t.time).getTime()>oneDayAgo);
    const avgRecent=recentTrades.length?recentTrades.reduce((s,t)=>s+t.price,0)/recentTrades.length:0;
    const base=avgRecent||cxPrice;
    if(!base) return null;
    return+(base*0.985).toFixed(2);
  };

  const handleFile=(e)=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const {headers,rows:raw}=parseCSV(ev.target.result);
      const binder=detectBinderExport(headers);
      setIsBinderExport(binder);
      const mapped=raw.map((r,i)=>{
        // Column name mapping — supports binder apps, Moxfield, generic spreadsheets
        const name=r["product name"]||r["name"]||r["card_name"]||r["card"]||"";
        const set=r["set name"]||r["set"]||r["set_name"]||r["expansion"]||"";
        const rawCond=r["condition"]||r["cond"]||"NM";
        const condition=normalizeCond(rawCond);
        const qty=parseInt(r["add to quantity"]||r["qty"]||r["quantity"]||r["count"]||"1")||1;
        // Purchase price from binder (reference only — CX price is independent)
        const purchaseRef=parseFloat(r["purchase price"]||r["price"]||r["cost"])||null;
        // Match to CX card catalogue
        const match=allCards.find(c=>{
          const cn=c.name?.toLowerCase();const rn=name.toLowerCase();
          return cn===rn||(rn.length>3&&cn?.includes(rn));
        });
        const cxPrice=match?marketPrices[match.id]||match.basePrice||BASE[match.id]||0:0;
        const suggested=match?suggestCXPrice(match.id):null;
        const hasBuyers=match&&cxPrice>0;
        const opportunity=purchaseRef&&cxPrice?(cxPrice-purchaseRef)/purchaseRef:null;
        return{name,set,condition,qty,purchaseRef,cxPrice,suggested,hasBuyers,opportunity,matchedCard:match||null,status:match?"matched":"unmatched",rowIndex:i};
      }).filter(r=>r.name);
      setRows(mapped);
      const prices={};const selected={};
      mapped.forEach((r,i)=>{if(r.matchedCard&&r.suggested){prices[i]=String(r.suggested);selected[i]=true;}});
      setListingPrices(prices);setListSelected(selected);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const matchedRows=rows.filter(r=>r.matchedCard);
  const selectedForListing=matchedRows.filter((_,i)=>listSelected[rows.indexOf(matchedRows[i])]!==false);

  const handleImport=async()=>{
    setImporting(true);
    onImport(rows.filter(r=>r.matchedCard),listingPrices,listSelected);
    setStep("done");
    setImporting(false);
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{background:D.bg2,border:`1px solid ${D.bdr2}`,borderRadius:"12px",width:"820px",maxWidth:"97vw",maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 60px rgba(0,0,0,0.5)"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${D.bdr}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontFamily:ORB,fontSize:"20px",fontWeight:800,color:D.acc,letterSpacing:"0.12em"}}>
              ◈ {isBinderExport?"BINDER IMPORT":"IMPORT COLLECTION"}
            </div>
            <div style={{color:D.txtD,fontSize:"14px",marginTop:"3px"}}>
              {step==="upload"&&"Upload your binder export or any collection CSV"}
              {step==="preview"&&(isBinderExport?"Binder collection detected — review your cards":"Review matched cards")}
              {step==="done"&&"Import complete"}
            </div>
          </div>
          {/* Step indicator */}
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginRight:"16px"}}>
            {["upload","preview","done"].map((s,i)=>(
              <div key={s} style={{display:"flex",alignItems:"center",gap:"6px"}}>
                <div style={{width:"20px",height:"20px",borderRadius:"50%",background:step===s?D.acc:(["upload","preview","done"].indexOf(step)>i?D.accD:"transparent"),border:`1px solid ${step===s||["upload","preview","done"].indexOf(step)>i?D.accD:D.bdr}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",color:step===s||["upload","preview","done"].indexOf(step)>i?"#000":D.txtD,fontWeight:"bold"}}>{i+1}</div>
                {i<2&&<div style={{width:"16px",height:"1px",background:D.bdr}}/>}
              </div>
            ))}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:D.txtD,fontSize:"29px",cursor:"pointer"}}>×</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"20px"}}>

          {/* ── UPLOAD step ── */}
          {step==="upload"&&(
            <div>
              {/* Binder callout */}
              <div style={{background:dark?"rgba(0,180,60,0.08)":"rgba(22,128,58,0.06)",border:`1px solid ${dark?"#1a4a2a":"#8acc8a"}`,borderRadius:"8px",padding:"14px 16px",marginBottom:"20px",display:"flex",gap:"12px",alignItems:"flex-start"}}>
                <span style={{fontSize:"29px",flexShrink:0}}>📒</span>
                <div>
                  <div style={{color:D.accD,fontSize:"16px",fontWeight:"bold",marginBottom:"4px"}}>Binder & collection app support</div>
                  <div style={{color:D.txtD,fontSize:"14px",lineHeight:"1.5"}}>Export your collection from any binder app as CSV and import it here. We auto-detect the format, map conditions, and suggest CX prices based on live market activity.</div>
                </div>
              </div>
              <div style={{border:`2px dashed ${D.bdr2}`,borderRadius:"8px",padding:"40px 24px",textAlign:"center",marginBottom:"20px"}}>
                <div style={{fontSize:"46px",marginBottom:"12px"}}>📂</div>
                <div style={{color:D.txtM,fontSize:"17px",marginBottom:"6px"}}>Drop your CSV here or click to browse</div>
                <div style={{color:D.txtD,fontSize:"14px",marginBottom:"20px"}}>Binder, Moxfield, Deckbox, or any spreadsheet</div>
                <label style={{padding:"10px 24px",background:dark?"rgba(0,180,60,0.15)":"rgba(22,128,58,0.10)",border:`1px solid ${D.accD}`,borderRadius:"6px",color:D.accD,fontSize:"14px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.1em"}}>
                  CHOOSE FILE <input type="file" accept=".csv" onChange={handleFile} style={{display:"none"}}/>
                </label>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                <div style={{background:D.bg3,border:`1px solid ${D.bdr}`,borderRadius:"6px",padding:"12px 14px"}}>
                  <div style={{color:dark?"#60a5fa":"#1d4ed8",fontSize:"13px",letterSpacing:"0.1em",marginBottom:"8px"}}>▸ BINDER APP COLUMNS</div>
                  {[["Product Name","Card name"],["Set Name","Set"],["Condition","NM, LP, MP etc"],["Add to Quantity","How many"],["Purchase Price","Your cost basis (reference only)"]].map(([c,d])=>(
                    <div key={c} style={{display:"flex",gap:"8px",marginBottom:"5px"}}>
                      <span style={{color:D.acc,fontSize:"13px",fontFamily:MONO,minWidth:"140px"}}>{c}</span>
                      <span style={{color:D.txtD,fontSize:"13px"}}>{d}</span>
                    </div>
                  ))}
                </div>
                <div style={{background:D.bg3,border:`1px solid ${D.bdr}`,borderRadius:"6px",padding:"12px 14px"}}>
                  <div style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.1em",marginBottom:"8px"}}>▸ GENERIC COLUMNS</div>
                  {[["Name / Card Name","Card name"],["Set / Expansion","Set name"],["Condition / Cond","Condition"],["Qty / Quantity","How many"]].map(([c,d])=>(
                    <div key={c} style={{display:"flex",gap:"8px",marginBottom:"5px"}}>
                      <span style={{color:D.acc,fontSize:"13px",fontFamily:MONO,minWidth:"140px"}}>{c}</span>
                      <span style={{color:D.txtD,fontSize:"13px"}}>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PREVIEW step ── */}
          {step==="preview"&&(
            <div>
              {/* Summary bar */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"10px",marginBottom:"16px"}}>
                {[
                  ["TOTAL CARDS",rows.length,""],
                  ["MATCHED ON CX",matchedRows.length,D.buyT],
                  ["WITH OPEN BUYERS",matchedRows.filter(r=>r.hasBuyers).length,"#f59e0b"],
                  ["UNMATCHED",rows.filter(r=>!r.matchedCard).length,D.askT],
                ].map(([label,val,color])=>(
                  <div key={label} style={{background:D.bg3,border:`1px solid ${D.bdr}`,borderRadius:"6px",padding:"10px 12px",textAlign:"center"}}>
                    <div style={{fontFamily:ORB,fontSize:"26px",fontWeight:700,color:color||D.txtM}}>{val}</div>
                    <div style={{color:D.txtD,fontSize:"12px",letterSpacing:"0.08em",marginTop:"3px"}}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Binder notice */}
              {isBinderExport&&(
                <div style={{background:dark?"rgba(0,180,60,0.06)":"rgba(22,128,58,0.04)",border:`1px solid ${dark?"#1a4a2a":"#8acc8a"}`,borderRadius:"6px",padding:"10px 14px",marginBottom:"14px",fontSize:"14px",color:D.txtD,lineHeight:"1.5"}}>
                  <span style={{color:D.accD,fontWeight:"bold"}}>ℹ Binder collection detected.</span> CX suggested prices are calculated from live order book activity. Your purchase price is shown as reference — your actual listing price is fully up to you.
                </div>
              )}

              {/* Table */}
              <div style={{border:`1px solid ${D.bdr}`,borderRadius:"6px",overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:`${isBinderExport?"24px ":""}1fr 50px 50px${isBinderExport?" 80px 80px":""} 110px 90px`,padding:"7px 12px",background:D.bg3,color:D.txtD,fontSize:"12px",letterSpacing:"0.08em",borderBottom:`1px solid ${D.bdr}`,gap:"8px",alignItems:"center"}}>
                  {isBinderExport&&<span/>}
                  <span>CARD</span>
                  <span style={{textAlign:"center"}}>COND</span>
                  <span style={{textAlign:"center"}}>QTY</span>
                  {isBinderExport&&<span style={{textAlign:"right"}}>PAID</span>}
                  {isBinderExport&&<span style={{textAlign:"right"}}>CX PRICE</span>}
                  <span style={{textAlign:"right"}}>SUGGESTED ASK</span>
                  <span style={{textAlign:"center"}}>STATUS</span>
                </div>
                {rows.map((r,i)=>{
                  const matched=!!r.matchedCard;
                  const opportunity=r.opportunity;
                  const oppColor=opportunity>0.05?"#22c55e":opportunity<-0.05?"#ef4444":"#f59e0b";
                  return(
                    <div key={i} style={{display:"grid",gridTemplateColumns:`${isBinderExport?"24px ":""}1fr 50px 50px${isBinderExport?" 80px 80px":""} 110px 90px`,padding:"9px 12px",borderBottom:`1px solid ${D.bdr}`,background:matched?"transparent":(dark?"rgba(245,158,11,0.03)":"rgba(245,158,11,0.02)"),gap:"8px",alignItems:"center"}}>
                      {isBinderExport&&(
                        <input type="checkbox" checked={matched&&listSelected[i]!==false} disabled={!matched} onChange={e=>setListSelected(p=>({...p,[i]:e.target.checked}))} style={{cursor:matched?"pointer":"default",accentColor:D.acc,width:"14px",height:"14px"}}/>
                      )}
                      <div style={{minWidth:0}}>
                        <div style={{color:matched?D.txt:D.txtD,fontSize:"16px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
                        <div style={{color:D.txtD,fontSize:"13px"}}>{r.set||"—"}</div>
                        {matched&&r.hasBuyers&&<div style={{color:"#f59e0b",fontSize:"12px"}}>● buyers waiting</div>}
                      </div>
                      <span style={{textAlign:"center",color:D.txtD,fontSize:"13px"}}>{r.condition}</span>
                      <span style={{textAlign:"center",color:D.txtM,fontSize:"16px"}}>{r.qty}</span>
                      {isBinderExport&&<span style={{textAlign:"right",color:D.txtD,fontSize:"14px"}}>{r.purchaseRef?`$${r.purchaseRef.toFixed(2)}`:"—"}</span>}
                      {isBinderExport&&<span style={{textAlign:"right",color:D.txtM,fontSize:"14px"}}>{r.cxPrice?`$${r.cxPrice.toFixed(2)}`:"—"}</span>}
                      <div style={{textAlign:"right"}}>
                        {matched?(
                          <div style={{display:"flex",alignItems:"center",gap:"4px",justifyContent:"flex-end"}}>
                            <span style={{color:D.txtD,fontSize:"13px"}}>$</span>
                            <input
                              type="number"
                              value={listingPrices[i]||""}
                              onChange={e=>setListingPrices(p=>({...p,[i]:e.target.value}))}
                              placeholder={r.suggested?.toFixed(2)||"—"}
                              style={{width:"62px",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"3px",padding:"3px 6px",color:D.txt,fontSize:"14px",fontFamily:MONO,textAlign:"right"}}
                            />
                          </div>
                        ):<span style={{color:D.txtD,fontSize:"13px"}}>—</span>}
                        {matched&&r.suggested&&<div style={{color:D.txtD,fontSize:"12px",textAlign:"right",marginTop:"2px"}}>24h suggest: ${r.suggested.toFixed(2)}</div>}
                      </div>
                      <div style={{textAlign:"center"}}>
                        {matched?(
                          <div>
                            <span style={{color:D.buyT,fontSize:"12px",background:dark?"rgba(0,200,60,0.1)":"rgba(22,128,58,0.08)",padding:"2px 6px",borderRadius:"3px"}}>● MATCHED</span>
                            {isBinderExport&&opportunity!==null&&(
                              <div style={{color:oppColor,fontSize:"12px",marginTop:"3px"}}>
                                {opportunity>0.05?"▲ CX higher":opportunity<-0.05?"▼ CX lower":"≈ similar"}
                              </div>
                            )}
                          </div>
                        ):(
                          <span style={{color:"#f59e0b",fontSize:"12px",background:dark?"rgba(245,158,11,0.1)":"rgba(245,158,11,0.08)",padding:"2px 6px",borderRadius:"3px"}}>● NO MATCH</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── DONE step ── */}
          {step==="done"&&(
            <div style={{textAlign:"center",padding:"40px 20px"}}>
              <div style={{fontSize:"70px",marginBottom:"16px"}}>✅</div>
              <div style={{fontFamily:ORB,fontSize:"23px",color:D.acc,marginBottom:"8px"}}>IMPORT COMPLETE</div>
              <div style={{color:D.txtM,fontSize:"16px",marginBottom:"6px"}}>{matchedRows.length} cards added to your portfolio</div>
              <div style={{color:D.txtD,fontSize:"14px"}}>Check your Orders tab — sell orders have been placed for selected cards</div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step==="preview"&&(
          <div style={{padding:"14px 20px",borderTop:`1px solid ${D.bdr}`,display:"flex",gap:"10px",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div style={{color:D.txtD,fontSize:"14px"}}>
              {isBinderExport&&`${Object.values(listSelected).filter(Boolean).length} cards selected for listing`}
            </div>
            <div style={{display:"flex",gap:"10px"}}>
              <button onClick={()=>setStep("upload")} style={{padding:"9px 20px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"5px",color:D.txtD,fontSize:"14px",fontFamily:MONO,cursor:"pointer"}}>← BACK</button>
              <button onClick={handleImport} disabled={importing||matchedRows.length===0} style={{padding:"9px 24px",background:dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#cceacc,#a8d8a8)",border:`1px solid ${D.accD}`,borderRadius:"5px",color:dark?"#00ff55":"#1a5a2a",fontSize:"14px",fontFamily:MONO,cursor:"pointer",fontWeight:"bold",letterSpacing:"0.1em",opacity:matchedRows.length===0?0.5:1}}>
                {importing?"IMPORTING...":isBinderExport?`IMPORT + LIST ${Object.values(listSelected).filter(Boolean).length} CARDS →`:`IMPORT ${matchedRows.length} CARDS →`}
              </button>
            </div>
          </div>
        )}
        {step==="done"&&(
          <div style={{padding:"14px 20px",borderTop:`1px solid ${D.bdr}`,flexShrink:0}}>
            <button onClick={onClose} style={{width:"100%",padding:"10px",background:dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#cceacc,#a8d8a8)",border:`1px solid ${D.accD}`,borderRadius:"5px",color:dark?"#00ff55":"#1a5a2a",fontSize:"14px",fontFamily:MONO,cursor:"pointer",fontWeight:"bold"}}>DONE →</button>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Reputation helpers ────────────────────────────────────────────────────────
const REP_TIERS=[
  {min:0,   label:"Newcomer",  icon:"◈", color:"#7a9a7a"},
  {min:5,   label:"Trader",    icon:"◈◈",color:"#15803d"},
  {min:25,  label:"Veteran",   icon:"◈◈◈",color:"#2563eb"},
  {min:100, label:"Elite",     icon:"◈◈◈◈",color:"#7c3aed"},
  {min:500, label:"Legend",    icon:"◈◈◈◈◈",color:"#d97706"},
];
function getRepTier(tradeCount=0){
  return [...REP_TIERS].reverse().find(t=>tradeCount>=t.min)||REP_TIERS[0];
}
function RepBadge({tradeCount=0,size="sm"}){
  const tier=getRepTier(tradeCount);
  const fs=size==="lg"?"13px":"10px";
  return(
    <span title={`${tier.label} — ${tradeCount} trades`} style={{color:tier.color,fontSize:fs,letterSpacing:"0.05em",fontFamily:"'Share Tech Mono',monospace"}}>
      {tier.icon} {tier.label}
    </span>
  );
}

// ── Admin Panel ───────────────────────────────────────────────────────────────
function AdminPanel({D,dark,onClose,currentUserId}){
  const [users,setUsers]=useState([]);
  const [reports,setReports]=useState([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("users");

  useEffect(()=>{
    import('./supabase').then(async({supabase})=>{
      const [profRes,repRes]=await Promise.all([
        supabase.from('user_profiles').select('*').order('joined_at',{ascending:false}),
        supabase.from('user_reports').select('*').order('created_at',{ascending:false}),
      ]);
      setUsers(profRes.data||[]);
      setReports(repRes.data||[]);
      setLoading(false);
    });
  },[]);

  const suspendUser=async(uid)=>{
    const {supabase}=await import('./supabase');
    await supabase.from('user_profiles').update({suspended:true}).eq('user_id',uid);
    setUsers(p=>p.map(u=>u.user_id===uid?{...u,suspended:true}:u));
  };
  const resolveReport=async(id)=>{
    const {supabase}=await import('./supabase');
    await supabase.from('user_reports').update({resolved:true}).eq('id',id);
    setReports(p=>p.map(r=>r.id===id?{...r,resolved:true}:r));
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{background:D.bg2,border:`1px solid ${D.bdr2}`,borderRadius:"12px",width:"700px",maxWidth:"96vw",maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 60px rgba(0,0,0,0.5)"}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${D.bdr}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:"20px",fontWeight:800,color:"#f59e0b",letterSpacing:"0.14em"}}>⚙ ADMIN PANEL</div>
            <div style={{color:D.txtD,fontSize:"13px",marginTop:"2px",letterSpacing:"0.1em"}}>COLLECTOR'S EXCHANGE — OWNER VIEW</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:D.txtD,fontSize:"29px",cursor:"pointer"}}>×</button>
        </div>
        {/* Tabs */}
        <div style={{display:"flex",borderBottom:`1px solid ${D.bdr}`,flexShrink:0}}>
          {[["users","👥 USERS"],["reports","🚩 REPORTS"]].map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:"10px 20px",border:"none",background:"transparent",color:tab===t?D.acc:D.txtD,fontSize:"14px",fontFamily:"'Share Tech Mono',monospace",letterSpacing:"0.1em",cursor:"pointer",borderBottom:`2px solid ${tab===t?D.acc:"transparent"}`}}>{label}{t==="reports"&&reports.filter(r=>!r.resolved).length>0&&<span style={{marginLeft:"6px",background:"#dc2626",color:"#fff",borderRadius:"50%",padding:"1px 5px",fontSize:"12px"}}>{reports.filter(r=>!r.resolved).length}</span>}</button>
          ))}
        </div>
        {/* Body */}
        <div style={{flex:1,overflowY:"auto"}}>
          {loading?(
            <div style={{padding:"48px",textAlign:"center",color:D.txtD}}>Loading...</div>
          ):tab==="users"?(
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:D.bg3}}>
                  {["USER","EMAIL","JOINED","TRADES","REP","STATUS","ACTION"].map(h=>(
                    <th key={h} style={{padding:"8px 14px",textAlign:"left",color:D.txtD,fontSize:"13px",letterSpacing:"0.1em",fontWeight:"normal",borderBottom:`1px solid ${D.bdr}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u=>(
                  <tr key={u.user_id} style={{borderBottom:`1px solid ${D.bdr}`}}>
                    <td style={{padding:"10px 14px"}}>
                      <div style={{color:D.txt,fontSize:"16px"}}>{u.display_name||"—"}</div>
                      {u.verified&&<span style={{color:"#2563eb",fontSize:"13px"}}>✓ verified</span>}
                    </td>
                    <td style={{padding:"10px 14px",color:D.txtD,fontSize:"14px"}}>{u.email||"—"}</td>
                    <td style={{padding:"10px 14px",color:D.txtD,fontSize:"14px"}}>{u.joined_at||"—"}</td>
                    <td style={{padding:"10px 14px",color:D.txtM,fontSize:"16px",textAlign:"center"}}>{u.trade_count||0}</td>
                    <td style={{padding:"10px 14px"}}><RepBadge tradeCount={u.trade_count||0}/></td>
                    <td style={{padding:"10px 14px"}}>
                      <span style={{color:u.suspended?"#dc2626":D.buyT,fontSize:"13px"}}>{u.suspended?"⊘ SUSPENDED":"● ACTIVE"}</span>
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      {u.user_id!==currentUserId&&!u.suspended&&(
                        <button onClick={()=>suspendUser(u.user_id)} style={{padding:"3px 10px",background:"transparent",border:"1px solid #dc2626",borderRadius:"3px",color:"#dc2626",fontSize:"13px",fontFamily:"'Share Tech Mono',monospace",cursor:"pointer"}}>SUSPEND</button>
                      )}
                      {u.suspended&&<span style={{color:D.txtD,fontSize:"13px"}}>suspended</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ):(
            <div>
              {reports.length===0?(
                <div style={{padding:"48px",textAlign:"center",color:D.txtD,fontSize:"16px"}}>No reports yet</div>
              ):reports.map(r=>(
                <div key={r.id} style={{padding:"14px 20px",borderBottom:`1px solid ${D.bdr}`,opacity:r.resolved?0.5:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{color:D.txt,fontSize:"16px",marginBottom:"4px"}}>
                        <span style={{color:"#dc2626"}}>🚩 {r.reason}</span>
                        <span style={{color:D.txtD,marginLeft:"10px",fontSize:"13px"}}>{r.created_at?.split("T")[0]}</span>
                      </div>
                      <div style={{color:D.txtD,fontSize:"14px"}}>{r.details||"No additional details"}</div>
                    </div>
                    {!r.resolved&&(
                      <button onClick={()=>resolveReport(r.id)} style={{padding:"4px 12px",background:"transparent",border:`1px solid ${D.accD}`,borderRadius:"3px",color:D.accD,fontSize:"13px",fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",flexShrink:0,marginLeft:"12px"}}>RESOLVE</button>
                    )}
                    {r.resolved&&<span style={{color:D.txtD,fontSize:"13px",flexShrink:0}}>✓ resolved</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{padding:"12px 20px",borderTop:`1px solid ${D.bdr}`,flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:D.txtD,fontSize:"13px"}}>{users.length} accounts · {reports.filter(r=>!r.resolved).length} open reports</span>
          <button onClick={onClose} style={{padding:"7px 20px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"4px",color:D.txtD,fontSize:"13px",fontFamily:"'Share Tech Mono',monospace",cursor:"pointer"}}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

// ── Profile & Settings Tab ────────────────────────────────────────────────────
function ProfileSettings({D,dark,user,profile,tradeHistory=[],holdings=[],balance=0,onProfileUpdate,onDarkToggle,isMobile=false,onNotifPrefsChange}){
  const [section,setSection]=useState("profile"); // "profile" | "settings" | "reviews"
  const [notifPrefs,setNotifPrefs]=useState(()=>{
    try{ return JSON.parse(localStorage.getItem("cx_notif_prefs")||"{}"); }catch{ return {}; }
  });
  const toggleNotif=(key)=>setNotifPrefs(p=>{
    const next={...p,[key]:!(p[key]===false)};
    try{ localStorage.setItem("cx_notif_prefs",JSON.stringify(next)); }catch{}
    if(onNotifPrefsChange) onNotifPrefsChange(next);
    return next;
  });
  const notifOn=(key)=>notifPrefs[key]!==false;
  const [editing,setEditing]=useState(false);
  const [dName,setDName]=useState(profile?.display_name||user?.user_metadata?.display_name||"");
  const [bio,setBio]=useState(profile?.bio||"");
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState("");
  // Settings state
  const [newEmail,setNewEmail]=useState("");
  const [curPwd,setCurPwd]=useState("");
  const [newPwd,setNewPwd]=useState("");
  const [pwdMsg,setPwdMsg]=useState("");
  const [deleteConfirm,setDeleteConfirm]=useState(false);
  const [reviews,setReviews]=useState([]);
  const [loadingReviews,setLoadingReviews]=useState(false);

  const tier=getRepTier(profile?.trade_count||tradeHistory.length);
  const tradeCount=profile?.trade_count||tradeHistory.length;
  const winRate=tradeHistory.length>0?Math.round((tradeHistory.filter(t=>t.side==="sell").length/tradeHistory.length)*100):0;
  const totalVolume=tradeHistory.reduce((s,t)=>s+(t.total||0),0);
  const joinDate=profile?.joined_at||"—";

  useEffect(()=>{
    setDName(profile?.display_name||user?.user_metadata?.display_name||"");
    setBio(profile?.bio||"");
  },[profile]);

  useEffect(()=>{
    if(section==="reviews"){
      setLoadingReviews(true);
      import('./supabase').then(async({supabase})=>{
        const {data}=await supabase.from('user_reviews').select('*').eq('reviewed_id',user?.id).order('created_at',{ascending:false});
        setReviews(data||[]);
        setLoadingReviews(false);
      });
    }
  },[section]);

  const saveProfile=async()=>{
    setSaving(true);
    const {supabase}=await import('./supabase');
    await supabase.from('user_profiles').update({display_name:dName,bio}).eq('user_id',user.id);
    if(onProfileUpdate) onProfileUpdate({...profile,display_name:dName,bio});
    setSaveMsg("Profile saved!"); setTimeout(()=>setSaveMsg(""),2500);
    setSaving(false); setEditing(false);
  };

  const changePassword=async()=>{
    if(!newPwd||newPwd.length<6){setPwdMsg("Password must be at least 6 characters");return;}
    const {supabase}=await import('./supabase');
    const {error}=await supabase.auth.updateUser({password:newPwd});
    if(error) setPwdMsg("Error: "+error.message);
    else{setPwdMsg("Password updated!");setCurPwd("");setNewPwd("");}
    setTimeout(()=>setPwdMsg(""),3000);
  };

  const SECTIONS=[["profile","👤 PROFILE"],["reviews","⭐ REVIEWS"],["settings","⚙ SETTINGS"]];

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Section tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${D.bdr}`,background:D.bg2,flexShrink:0}}>
        {SECTIONS.map(([s,label])=>(
          <button key={s} onClick={()=>setSection(s)} style={{padding:"10px 20px",border:"none",background:"transparent",color:section===s?D.accD:D.txtD,fontSize:"14px",fontFamily:"'Share Tech Mono',monospace",letterSpacing:"0.1em",cursor:"pointer",borderBottom:`2px solid ${section===s?D.accD:"transparent"}`,transition:"all 0.12s"}}>{label}</button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:isMobile?"16px":"24px",maxWidth:"680px",margin:"0 auto",width:"100%"}}>

        {/* ── PROFILE section ── */}
        {section==="profile"&&(
          <div>
            {/* Avatar + name header */}
            <div style={{display:"flex",alignItems:"center",gap:"20px",marginBottom:"24px",padding:"20px",background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"10px"}}>
              <div style={{width:isMobile?"56px":"72px",height:isMobile?"56px":"72px",borderRadius:"50%",background:dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#cceacc,#a8d8a8)",border:`2px solid ${D.accD}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:isMobile?"22px":"28px",flexShrink:0}}>
                {(dName||"?")[0].toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:isMobile?"15px":"18px",fontWeight:800,color:D.txt,marginBottom:"4px"}}>{profile?.display_name||user?.user_metadata?.display_name||user?.email?.split("@")[0]}</div>
                <RepBadge tradeCount={tradeCount} size="lg"/>
                {profile?.verified&&<span style={{marginLeft:"10px",color:"#2563eb",fontSize:"14px"}}>✓ VERIFIED</span>}
                <div style={{color:D.txtD,fontSize:"14px",marginTop:"4px"}}>Member since {joinDate}</div>
              </div>
              <button onClick={()=>setEditing(e=>!e)} style={{padding:"6px 14px",background:"transparent",border:`1px solid ${D.bdr2}`,borderRadius:"4px",color:D.txtD,fontSize:"13px",fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",flexShrink:0}}>{editing?"CANCEL":"EDIT"}</button>
            </div>

            {/* Edit form */}
            {editing&&(
              <div style={{background:D.bg2,border:`1px solid ${D.bdr2}`,borderRadius:"8px",padding:"18px",marginBottom:"20px"}}>
                <div style={{color:D.txtD,fontSize:"14px",letterSpacing:"0.1em",marginBottom:"14px"}}>▸ EDIT PROFILE</div>
                <div style={{marginBottom:"12px"}}>
                  <div style={{color:D.txtD,fontSize:"13px",marginBottom:"5px"}}>DISPLAY NAME</div>
                  <input value={dName} onChange={e=>setDName(e.target.value)} style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"4px",padding:"8px 12px",color:D.txt,fontSize:"17px",fontFamily:"'Share Tech Mono',monospace"}}/>
                </div>
                <div style={{marginBottom:"14px"}}>
                  <div style={{color:D.txtD,fontSize:"13px",marginBottom:"5px"}}>BIO</div>
                  <textarea value={bio} onChange={e=>setBio(e.target.value)} rows={3} placeholder="Tell the community about yourself..." style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"4px",padding:"8px 12px",color:D.txt,fontSize:"17px",fontFamily:"'Share Tech Mono',monospace",resize:"vertical"}}/>
                </div>
                <button onClick={saveProfile} disabled={saving} style={{padding:"8px 24px",background:dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#cceacc,#a8d8a8)",border:`1px solid ${D.accD}`,borderRadius:"5px",color:dark?"#00ff55":"#1a5a2a",fontSize:"14px",fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",fontWeight:"bold"}}>{saving?"SAVING...":"SAVE PROFILE"}</button>
                {saveMsg&&<span style={{marginLeft:"12px",color:D.accD,fontSize:"14px"}}>{saveMsg}</span>}
              </div>
            )}

            {/* Bio display */}
            {!editing&&profile?.bio&&(
              <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"8px",padding:"14px 18px",marginBottom:"20px"}}>
                <div style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.1em",marginBottom:"8px"}}>▸ BIO</div>
                <div style={{color:D.txtM,fontSize:"16px",lineHeight:"1.6"}}>{profile.bio}</div>
              </div>
            )}

            {/* Stats grid */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:"12px",marginBottom:"20px"}}>
              {[
                ["TRADES",tradeCount.toLocaleString(),"total fills"],
                ["VOLUME","$"+totalVolume.toLocaleString("en-US",{maximumFractionDigits:0}),"lifetime"],
                ["HOLDINGS",holdings.length.toLocaleString(),"cards owned"],
                ["BALANCE","$"+balance.toLocaleString("en-US",{maximumFractionDigits:0}),"available"],
              ].map(([label,val,sub])=>(
                <div key={label} style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"8px",padding:"14px"}}>
                  <div style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.1em",marginBottom:"6px"}}>{label}</div>
                  <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:"23px",fontWeight:700,color:D.acc,marginBottom:"3px"}}>{val}</div>
                  <div style={{color:D.txtD,fontSize:"13px"}}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Reputation tiers */}
            <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"8px",padding:"16px 18px"}}>
              <div style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.1em",marginBottom:"14px"}}>▸ REPUTATION TIERS</div>
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                {REP_TIERS.map((t,i)=>{
                  const next=REP_TIERS[i+1];
                  const active=tradeCount>=t.min&&(!next||tradeCount<next.min);
                  const done=next&&tradeCount>=next.min;
                  const pct=next?Math.min(100,((tradeCount-t.min)/(next.min-t.min))*100):100;
                  return(
                    <div key={t.label} style={{opacity:done||active?1:0.45}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"4px"}}>
                        <span style={{color:active?t.color:(done?t.color:D.txtD),fontSize:"16px",fontWeight:active?"bold":"normal"}}>{t.icon} {t.label} {active&&"← YOU ARE HERE"}</span>
                        <span style={{color:D.txtD,fontSize:"13px"}}>{t.min}+ trades</span>
                      </div>
                      {active&&next&&(
                        <div style={{height:"4px",background:D.bg3,borderRadius:"2px",overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,background:t.color,borderRadius:"2px",transition:"width 0.5s"}}/>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── REVIEWS section ── */}
        {section==="reviews"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
              <div style={{color:D.txtD,fontSize:"14px",letterSpacing:"0.1em"}}>▸ REVIEWS FROM TRADERS</div>
              {reviews.length>0&&(
                <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  <span style={{color:"#f59e0b",fontSize:"23px"}}>{"★".repeat(Math.round(reviews.reduce((s,r)=>s+r.rating,0)/reviews.length))}</span>
                  <span style={{color:D.txtM,fontSize:"16px"}}>{(reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1)} avg</span>
                  <span style={{color:D.txtD,fontSize:"14px"}}>({reviews.length} reviews)</span>
                </div>
              )}
            </div>
            {loadingReviews?(
              <div style={{padding:"48px",textAlign:"center",color:D.txtD}}>Loading...</div>
            ):reviews.length===0?(
              <div style={{padding:"48px",textAlign:"center",background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"8px"}}>
                <div style={{fontSize:"46px",marginBottom:"12px"}}>⭐</div>
                <div style={{color:D.txtD,fontSize:"16px"}}>No reviews yet.</div>
                <div style={{color:D.txtD,fontSize:"14px",marginTop:"6px"}}>Reviews appear after peer-to-peer trades.</div>
              </div>
            ):reviews.map(r=>(
              <div key={r.id} style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"8px",padding:"14px 16px",marginBottom:"10px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                  <span style={{color:"#f59e0b",fontSize:"17px"}}>{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</span>
                  <span style={{color:D.txtD,fontSize:"13px"}}>{r.created_at?.split("T")[0]}</span>
                </div>
                {r.comment&&<div style={{color:D.txtM,fontSize:"16px",lineHeight:"1.5"}}>{r.comment}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ── SETTINGS section ── */}
        {section==="settings"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>

            {/* Appearance */}
            <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"8px",padding:"16px 18px"}}>
              <div style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.1em",marginBottom:"14px"}}>▸ APPEARANCE</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{color:D.txtM,fontSize:"16px",marginBottom:"3px"}}>{dark?"Dark Mode":"Light Mode"}</div>
                  <div style={{color:D.txtD,fontSize:"14px"}}>Switch between light and dark themes</div>
                </div>
                <div onClick={onDarkToggle} style={{width:"48px",height:"26px",background:dark?"#1a3a1a":"#d1ecd1",borderRadius:"13px",border:`1px solid ${D.bdr2}`,display:"flex",alignItems:"center",padding:"3px",transition:"background 0.3s",cursor:"pointer"}}>
                  <div style={{width:"18px",height:"18px",borderRadius:"50%",background:dark?"#00cc40":"#f59e0b",transform:dark?"translateX(0)":"translateX(22px)",transition:"transform 0.3s",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px"}}>{dark?"🌙":"☀️"}</div>
                </div>
              </div>
            </div>

            {/* Account info */}
            <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"8px",padding:"16px 18px"}}>
              <div style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.1em",marginBottom:"14px"}}>▸ ACCOUNT</div>
              <div style={{marginBottom:"10px"}}>
                <div style={{color:D.txtD,fontSize:"13px",marginBottom:"4px"}}>EMAIL ADDRESS</div>
                <div style={{color:D.txtM,fontSize:"16px",padding:"8px 12px",background:D.bg3,borderRadius:"4px",border:`1px solid ${D.bdr}`}}>{user?.email}</div>
              </div>
              <div style={{marginBottom:"10px"}}>
                <div style={{color:D.txtD,fontSize:"13px",marginBottom:"4px"}}>USER ID</div>
                <div style={{color:D.txtD,fontSize:"13px",padding:"8px 12px",background:D.bg3,borderRadius:"4px",border:`1px solid ${D.bdr}`,fontFamily:"'Share Tech Mono',monospace",wordBreak:"break-all"}}>{user?.id}</div>
              </div>
              <div>
                <div style={{color:D.txtD,fontSize:"13px",marginBottom:"4px"}}>MEMBER SINCE</div>
                <div style={{color:D.txtM,fontSize:"16px",padding:"8px 12px",background:D.bg3,borderRadius:"4px",border:`1px solid ${D.bdr}`}}>{profile?.joined_at||"—"}</div>
              </div>
            </div>

            {/* Change password */}
            <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"8px",padding:"16px 18px"}}>
              <div style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.1em",marginBottom:"14px"}}>▸ CHANGE PASSWORD</div>
              <div style={{marginBottom:"10px"}}>
                <div style={{color:D.txtD,fontSize:"13px",marginBottom:"4px"}}>NEW PASSWORD</div>
                <input type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="••••••••" style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"4px",padding:"8px 12px",color:D.txt,fontSize:"17px",fontFamily:"'Share Tech Mono',monospace"}}/>
              </div>
              <button onClick={changePassword} style={{padding:"8px 20px",background:"transparent",border:`1px solid ${D.bdr2}`,borderRadius:"4px",color:D.txtD,fontSize:"13px",fontFamily:"'Share Tech Mono',monospace",cursor:"pointer"}}>UPDATE PASSWORD</button>
              {pwdMsg&&<div style={{marginTop:"8px",color:pwdMsg.startsWith("Error")?D.askT:D.accD,fontSize:"14px"}}>{pwdMsg}</div>}
            </div>

            {/* Notification settings */}
            <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"8px",padding:"16px 18px"}}>
              <div style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.1em",marginBottom:"14px"}}>▸ NOTIFICATIONS</div>
              {[
                {key:"filled_buy",  label:"Buy order filled",      desc:"When a buy order executes",           icon:"🟢"},
                {key:"filled_sell", label:"Sell order filled",     desc:"When a sell order executes",          icon:"🔴"},
                {key:"price_alert", label:"Price alerts",          desc:"When a card hits your price target",  icon:"🎯"},
                {key:"import",      label:"Import complete",       desc:"When a CSV import finishes",          icon:"📂"},
              ].map(({key,label,desc,icon})=>(
                <div key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${D.bdr}`}}>
                  <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
                    <span style={{fontSize:"23px"}}>{icon}</span>
                    <div>
                      <div style={{color:D.txtM,fontSize:"16px"}}>{label}</div>
                      <div style={{color:D.txtD,fontSize:"13px",marginTop:"2px"}}>{desc}</div>
                    </div>
                  </div>
                  <div onClick={()=>toggleNotif(key)} style={{width:"40px",height:"22px",background:notifOn(key)?(dark?"#1a3a1a":"#d1ecd1"):(dark?"#2a1a1a":"#f0d0d0"),borderRadius:"11px",border:`1px solid ${notifOn(key)?D.accD:D.bdr2}`,display:"flex",alignItems:"center",padding:"2px",transition:"all 0.2s",cursor:"pointer",flexShrink:0}}>
                    <div style={{width:"16px",height:"16px",borderRadius:"50%",background:notifOn(key)?(dark?"#00cc40":"#15803d"):"#aaa",transform:notifOn(key)?"translateX(18px)":"translateX(0)",transition:"transform 0.2s"}}/>
                  </div>
                </div>
              ))}
              {/* Browser push permission status */}
              <div style={{marginTop:"14px",padding:"10px 12px",background:D.bg3,border:`1px solid ${D.bdr}`,borderRadius:"6px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"10px"}}>
                <div>
                  <div style={{color:D.txtM,fontSize:"14px",marginBottom:"2px"}}>
                    {typeof Notification==="undefined"?"Browser push: not supported":
                     Notification.permission==="granted"?"🟢 Browser push: enabled":
                     Notification.permission==="denied"?"🔴 Browser push: blocked in browser settings":
                     "⚪ Browser push: not yet enabled"}
                  </div>
                  <div style={{color:D.txtD,fontSize:"13px"}}>
                    {Notification?.permission==="denied"?"Change in your browser site settings to re-enable":"Notifies you even when you're on another tab"}
                  </div>
                </div>
                {typeof Notification!=="undefined"&&Notification.permission==="default"&&(
                  <button onClick={async()=>{const r=await Notification.requestPermission();if(onNotifPrefsChange) onNotifPrefsChange({});}} style={{padding:"5px 12px",background:dark?"rgba(0,180,60,0.15)":"rgba(22,128,58,0.10)",border:`1px solid ${D.accD}`,borderRadius:"4px",color:D.accD,fontSize:"13px",fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",whiteSpace:"nowrap"}}>ENABLE</button>
                )}
              </div>
              <div style={{marginTop:"10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:D.txtD,fontSize:"13px"}}>Email notifications coming soon</span>
                <button onClick={()=>{const all={filled_buy:true,filled_sell:true,price_alert:true,import:true};setNotifPrefs(all);try{localStorage.setItem("cx_notif_prefs",JSON.stringify(all));}catch{};if(onNotifPrefsChange)onNotifPrefsChange(all);}} style={{padding:"4px 10px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"3px",color:D.txtD,fontSize:"13px",fontFamily:"'Share Tech Mono',monospace",cursor:"pointer"}}>ENABLE ALL</button>
              </div>
            </div>

            {/* Danger zone */}
            <div style={{background:dark?"rgba(180,30,30,0.05)":"rgba(220,50,50,0.03)",border:`1px solid ${dark?"#3a1010":"#e8c5c5"}`,borderRadius:"8px",padding:"16px 18px"}}>
              <div style={{color:"#dc2626",fontSize:"13px",letterSpacing:"0.1em",marginBottom:"10px"}}>▸ DANGER ZONE</div>
              <div style={{color:D.txtD,fontSize:"14px",marginBottom:"12px"}}>Deleting your account is permanent and cannot be undone.</div>
              {deleteConfirm?(
                <div style={{background:dark?"rgba(180,30,30,0.1)":"rgba(220,50,50,0.06)",border:"1px solid #dc2626",borderRadius:"6px",padding:"14px"}}>
                  <div style={{color:"#dc2626",fontSize:"16px",fontWeight:"bold",marginBottom:"6px"}}>⚠ Are you sure?</div>
                  <div style={{color:D.txtD,fontSize:"14px",marginBottom:"12px",lineHeight:"1.5"}}>This will permanently delete your account, balance, orders, holdings and trade history. This cannot be undone.</div>
                  <div style={{display:"flex",gap:"8px"}}>
                    <button onClick={()=>setDeleteConfirm(false)} style={{flex:1,padding:"8px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"4px",color:D.txtD,fontSize:"13px",fontFamily:"'Share Tech Mono',monospace",cursor:"pointer"}}>← CANCEL</button>
                    <button onClick={()=>alert("Please contact support at support@collectorsexchange.com to delete your account.")} style={{flex:1,padding:"8px",background:"#dc2626",border:"1px solid #dc2626",borderRadius:"4px",color:"#fff",fontSize:"13px",fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",fontWeight:"bold"}}>YES, DELETE →</button>
                  </div>
                </div>
              ):(
                <button style={{padding:"8px 16px",background:"transparent",border:"1px solid #dc2626",borderRadius:"4px",color:"#dc2626",fontSize:"13px",fontFamily:"'Share Tech Mono',monospace",cursor:"pointer"}} onClick={()=>setDeleteConfirm(true)}>DELETE ACCOUNT</button>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
export default function App(){
  const [dark,setDark]=useState(false);
  const [notifPrefs,setNotifPrefs]=useState(()=>{
    try{ return JSON.parse(localStorage.getItem("cx_notif_prefs")||"{}"); }catch{ return {}; }
  });
  const notifOn=(key)=>notifPrefs[key]!==false;
  // Browser push permission: "default" | "granted" | "denied"
  const [pushPermission,setPushPermission]=useState(()=>
    typeof Notification!=="undefined"?Notification.permission:"unsupported"
  );
  const [showPushPrompt,setShowPushPrompt]=useState(false);
  const [screen,setScreen]=useState("landing"); // "landing" | "app"
  const isMobile=useIsMobile();
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [user,setUser]=useState(null);
  const [authModal,setAuthModal]=useState(null); // null | "login" | "signup"
  const [tab,setTab]=useState("MARKET");
  const [dbCards,setDbCards]=useState([]);
  const [selectedCard,setSelectedCard]=useState(null);
  const [notifications,setNotifications]=useState([]);
  const [csvModal,setCsvModal]=useState(false);
  const [profile,setProfile]=useState(null);       // user_profiles row
  const [adminOpen,setAdminOpen]=useState(false);   // admin panel

  // ── Global trading state ──────────────────────────────────────────────────
  const [balance,setBalance]=useState(STARTING_BALANCE);
  const [orders,setOrders]=useState([]);
  const [holdings,setHoldings]=useState([]);
  const [tradeHistory,setTradeHistory]=useState([]);
  const [ledger]=useState([{id:"DEP-001",type:"deposit",amount:STARTING_BALANCE,method:"Demo Credit",date:nowDate()}]);
  const [marketPrices,setMarketPrices]=useState({});

  // Refs so match engine always sees latest values without stale closures
  const balanceRef=useRef(balance);
  const holdingsRef=useRef(holdings);
  const marketPricesRef=useRef(marketPrices);
  const userRef=useRef(user);
  const dbCardsRef=useRef(dbCards);
  useEffect(()=>{ balanceRef.current=balance; },[balance]);
  useEffect(()=>{ dbCardsRef.current=dbCards; },[dbCards]);
  useEffect(()=>{ holdingsRef.current=holdings; },[holdings]);
  useEffect(()=>{ marketPricesRef.current=marketPrices; },[marketPrices]);
  useEffect(()=>{ userRef.current=user; },[user]);

  const D=dark?DK:LT;

  // ── Supabase helpers ────────────────────────────────────────────────────────
  // ── Rate limiter ─────────────────────────────────────────────────────────────
  // Tracks DB write timestamps to enforce a minimum 10s cooldown between saves.
  // Urgent writes (trades) bypass the cooldown. All writes are counted per minute
  // and logged so you can monitor usage during development.
  const lastSaveRef=useRef(0);
  const saveCountRef=useRef({count:0,windowStart:Date.now()});
  const pendingSaveRef=useRef(null); // queues a deferred save if cooldown is active

  const saveToDb=async(sb,uid,newOrders,newHoldings,newTrades,newBalance,{urgent=false}={})=>{
    if(!uid) return;
    const now=Date.now();

    // Per-minute counter (dev visibility)
    const w=saveCountRef.current;
    if(now-w.windowStart>60000){ saveCountRef.current={count:1,windowStart:now}; }
    else { w.count++; }
    if(w.count>20) console.warn(`[CX] High DB write rate: ${w.count} writes/min — check for runaway intervals`);

    // Cooldown: non-urgent writes must wait 10s since last save
    const elapsed=now-lastSaveRef.current;
    const COOLDOWN=10000; // 10 seconds
    if(!urgent && elapsed < COOLDOWN){
      // Schedule a deferred flush after the cooldown expires
      if(pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current=setTimeout(()=>{
        saveToDb(sb,uid,newOrders,newHoldings,newTrades,newBalance,{urgent:true});
      }, COOLDOWN - elapsed + 100);
      return;
    }
    lastSaveRef.current=now;
    if(pendingSaveRef.current){ clearTimeout(pendingSaveRef.current); pendingSaveRef.current=null; }

    // ── Actual DB writes ──────────────────────────────────────────────────────
    // balance upsert
    const balRes=await sb.from('user_balance').upsert({user_id:uid,balance:newBalance},{onConflict:'user_id',ignoreDuplicates:false});
    if(balRes.error) await sb.from('user_balance').insert({user_id:uid,balance:newBalance});
    // orders
    if(newOrders?.length){
      const unique=[...new Map(newOrders.map(o=>[o.id,o])).values()];
      await sb.from('user_orders').upsert(unique.map(o=>({id:o.id,user_id:uid,card_id:o.cardId,side:o.side,type:o.type,price:o.price,qty:o.qty,filled:o.filled,status:o.status,time:o.time,date:o.date,expiry:o.expiry||'gtc',expires_at:o.expiresAt||null})),{onConflict:'id'});
    }
    // holdings replace
    if(newHoldings!==undefined){
      await sb.from('user_holdings').delete().eq('user_id',uid);
      if(newHoldings.length){
        await sb.from('user_holdings').insert(newHoldings.map(h=>({user_id:uid,card_id:h.cardId,qty:h.qty,avg_cost:h.avgCost,acquired:h.acquired,locked_qty:h.lockedQty||0})));
      }
    }
    // trades
    if(newTrades?.length){
      await sb.from('user_trades').upsert(newTrades.map(t=>({id:t.id,user_id:uid,card_id:t.cardId,side:t.side,price:t.price,qty:t.qty,total:t.total,date:t.date,time:t.time})),{onConflict:'id'});
    }
  };

  const loadUserData=async(sb,uid)=>{
    const [balRes,ordRes,holdRes,trdRes,profRes]=await Promise.all([
      sb.from('user_balance').select('balance').eq('user_id',uid),
      sb.from('user_orders').select('*').eq('user_id',uid).order('date',{ascending:false}),
      sb.from('user_holdings').select('*').eq('user_id',uid),
      sb.from('user_trades').select('*').eq('user_id',uid).order('date',{ascending:false}),
      sb.from('user_profiles').select('*').eq('user_id',uid),
    ]);
    if(balRes.data?.length) setBalance(+balRes.data[0].balance);
    else await sb.from('user_balance').insert({user_id:uid,balance:STARTING_BALANCE});
    setOrders(ordRes.data?.length ? ordRes.data.map(o=>({id:o.id,cardId:+o.card_id,side:o.side,type:o.type,price:+o.price,qty:+o.qty,filled:+o.filled,status:o.status,time:o.time,date:o.date,expiry:o.expiry||'gtc',expiresAt:o.expires_at||null})) : []);
    setHoldings(holdRes.data?.length ? holdRes.data.map(h=>({cardId:+h.card_id,qty:+h.qty,avgCost:+h.avg_cost,acquired:h.acquired,lockedQty:+(h.locked_qty||0)})) : []);
    setTradeHistory(trdRes.data?.length ? trdRes.data.map(t=>({id:t.id,cardId:+t.card_id,side:t.side,price:+t.price,qty:+t.qty,total:+t.total,date:t.date,time:t.time})) : []);
    if(profRes.data?.length) setProfile(profRes.data[0]);
  };

  useEffect(()=>{
    document.title = "Collector's Exchange";
    import('./supabase').then(({supabase})=>{
      // Check for existing session
      supabase.auth.getSession().then(({data:{session}})=>{
        // If user chose not to remember, only restore if still in same browser session
        const sessionOnly=sessionStorage.getItem("cx_session_only");
        if(session?.user && !sessionOnly){ setUser(session.user); setScreen("app"); loadUserData(supabase,session.user.id); }
        else if(session?.user && sessionOnly){ /* session-only: already logged in this tab, restore */ setUser(session.user); setScreen("app"); loadUserData(supabase,session.user.id); }
      });
      // Load cards
      supabase.from('cards').select('*').then(({data,error})=>{
        if(!error&&data){
          const fmt=data.map(c=>({id:c.id,name:c.name,set:c.set_name,set_name:c.set_name,condition:c.condition,rarity:c.rarity,game:c.game,img:c.img_url,img_url:c.img_url,basePrice:c.base_price,language:c.language||"English"}));
          setDbCards(fmt);
          const prices={};
          fmt.forEach(c=>{ prices[c.id]=c.basePrice||0; });
          setMarketPrices(prices);
        }
      });
    });
  },[]);

  // Run match engine every 2s
  useEffect(()=>{
    const iv=setInterval(()=>{
      setOrders(prev=>{
        // Expire orders past their time limit before matching
        const now=new Date();
        const expiredIds=new Set(prev.filter(o=>(o.status==="open"||o.status==="partial")&&o.expiresAt&&new Date(o.expiresAt)<now).map(o=>o.id));
        if(expiredIds.size>0){
          // Unlock locked qty from expired sell orders
          setHoldings(h=>h.map(holding=>{
            const expiredSells=prev.filter(o=>expiredIds.has(o.id)&&o.side==="sell"&&+o.cardId===+holding.cardId);
            const unlockQty=expiredSells.reduce((s,o)=>s+(o.qty-o.filled),0);
            return unlockQty>0?{...holding,lockedQty:Math.max(0,(holding.lockedQty||0)-unlockQty)}:holding;
          }));
          // Mark expired — return early so we don't also try to match them
          return prev.map(o=>expiredIds.has(o.id)?{...o,status:"expired"}:o);
        }
        const openOrders=prev.filter(o=>(o.status==="open"||o.status==="partial")&&!expiredIds.has(o.id));
        if(!openOrders.length) return prev;
        const result=matchOrders(prev,marketPricesRef.current,holdingsRef.current,balanceRef.current);
        if(result.newTrades.length){
          setHoldings(result.holdings);
          setBalance(result.balance);
          setTradeHistory(h=>[...result.newTrades,...h]);
          if(userRef.current) import('./supabase').then(({supabase})=>{
            saveToDb(supabase,userRef.current.id,result.orders,result.holdings,result.newTrades,result.balance,{urgent:true});
            // Increment trade_count on profile
            if(result.newTrades.length){
              supabase.rpc('increment_trade_count',{uid:userRef.current.id,n:result.newTrades.length}).then(()=>{
                supabase.from('user_profiles').select('trade_count').eq('user_id',userRef.current.id).then(({data})=>{
                  if(data?.length) setProfile(p=>p?{...p,trade_count:data[0].trade_count}:p);
                });
              });
            }
          });
          result.newTrades.forEach(t=>{
            const allC=[...dbCardsRef.current,...CARDS];
            const card=allC.find(c=>c.id===t.cardId)||{name:"Card"};
            const type=t.side==="buy"?"filled_buy":"filled_sell";
            pushNotification(type,`${t.side==="buy"?"Bought":"Sold"} ${t.qty}× ${card.name} @ $${t.price.toLocaleString("en-US",{minimumFractionDigits:2})}`);
          });
        }
        return result.orders;
      });
    },2000);
    return ()=>clearInterval(iv);
  },[]);

  const calcExpiresAt=(expiry)=>{
    if(!expiry||expiry==="gtc") return null;
    const d=new Date();
    if(expiry==="day")  d.setHours(23,59,59,999);
    if(expiry==="week") d.setDate(d.getDate()+7);
    if(expiry==="month") d.setMonth(d.getMonth()+1);
    return d.toISOString();
  };
  const placeOrder=async(orderData)=>{
    const expiresAt=calcExpiresAt(orderData.expiry||"gtc");
    const o={id:newOrderId(),...orderData,cardId:+orderData.cardId,filled:0,status:"open",time:nowTime(),date:nowDate(),expiry:orderData.expiry||"gtc",expiresAt};
    if(o.type==="market"){
      const result=matchOrders([o],marketPrices,holdings,balance);
      // result.orders contains the single filled order; merge with existing
      const mergedOrders=[result.orders[0],...orders];
      setOrders(mergedOrders);
      if(result.newTrades.length){
        setHoldings(result.holdings);
        setBalance(result.balance);
        setTradeHistory(h=>[...result.newTrades,...h]);
        result.newTrades.forEach(t=>{
          const allC=[...dbCards,...CARDS];
          const card=allC.find(c=>c.id===t.cardId)||{name:"Card"};
          pushNotification(t.side==="buy"?"filled_buy":"filled_sell",`${t.side==="buy"?"Bought":"Sold"} ${t.qty}× ${card.name} @ $${t.price.toLocaleString("en-US",{minimumFractionDigits:2})}`);
        });
      }
      if(user){ const {supabase}=await import('./supabase'); saveToDb(supabase,user.id,[result.orders[0]],result.holdings,result.newTrades,result.balance,{urgent:true}); }
    } else {
      // If limit sell: lock the qty in holdings immediately
      let updatedHoldings = holdings;
      if(o.side === "sell"){
        updatedHoldings = holdings.map(h=>{
          if(h.cardId !== o.cardId) return h;
          const freeQty = h.qty - (h.lockedQty||0);
          if(freeQty < o.qty){
            // Not enough free cards — reject silently (UI validation should catch this first)
            return h;
          }
          return {...h, lockedQty:(h.lockedQty||0)+o.qty};
        });
        setHoldings(updatedHoldings);
      }
      setOrders(prev=>[o,...prev]);
      if(user){ const {supabase}=await import('./supabase'); saveToDb(supabase,user.id,[o],updatedHoldings,[],balance); }
    }
  };

  const cancelOrder=async(id)=>{
    // Find the order to check if it's a sell (need to unlock qty)
    const orderToCancel = orders.find(o=>o.id===id);
    setOrders(prev=>{
      const updated=prev.map(o=>o.id===id&&(o.status==="open"||o.status==="partial")?{...o,status:"cancelled"}:o);
      if(user) import('./supabase').then(({supabase})=>supabase.from('user_orders').update({status:'cancelled'}).eq('id',id).eq('user_id',user.id));
      return updated;
    });
    // Unlock the qty in holdings if this was a sell order
    if(orderToCancel && orderToCancel.side==="sell" && (orderToCancel.status==="open"||orderToCancel.status==="partial")){
      const unfilledQty = orderToCancel.qty - orderToCancel.filled;
      setHoldings(prev=>{
        const updated = prev.map(h=>{
          if(h.cardId !== orderToCancel.cardId) return h;
          const newLocked = Math.max(0,(h.lockedQty||0) - unfilledQty);
          return {...h, lockedQty:newLocked};
        });
        if(user) import('./supabase').then(({supabase})=>saveToDb(supabase,user.id,undefined,updated,[],balance));
        return updated;
      });
    }
  };

  const handleBrowseSelect=(card)=>{ setSelectedCard(card); setTab("MARKET"); };
  const handleProfileUpdate=(updatedProfile)=>setProfile(updatedProfile);

  const handleCSVImport=(importedRows,listingPrices={},listSelected={})=>{
    const toAdd=importedRows.filter(r=>r.matchedCard);
    // Add to holdings first
    setHoldings(prev=>{
      const updated=[...prev];
      toAdd.forEach(r=>{
        const idx=updated.findIndex(h=>h.cardId===r.matchedCard.id);
        if(idx>=0){ updated[idx]={...updated[idx],qty:updated[idx].qty+r.qty}; }
        else{ updated.push({cardId:r.matchedCard.id,qty:r.qty,avgCost:r.matchedCard.basePrice||BASE[r.matchedCard.id]||0,acquired:nowDate(),lockedQty:0}); }
      });
      return updated;
    });
    // Place limit sell orders for selected cards with custom prices
    const toList=importedRows.filter((r,i)=>r.matchedCard&&listSelected[i]!==false&&listingPrices[i]);
    toList.forEach(r=>{
      const price=parseFloat(listingPrices[importedRows.indexOf(r)]);
      if(price>0) placeOrder({cardId:r.matchedCard.id,side:"sell",type:"limit",price,qty:r.qty});
    });
    const listed=toList.length;
    pushNotification("import",`Imported ${toAdd.length} card${toAdd.length!==1?"s":""} from CSV${listed?` · ${listed} listed for sale`:"" }`);
  };
  const handleLogout=async()=>{
    const {supabase}=await import('./supabase');
    await supabase.auth.signOut();
    sessionStorage.removeItem("cx_session_only"); setUser(null); setProfile(null); setScreen("landing");
    setOrders([]); setHoldings([]); setTradeHistory([]); setBalance(STARTING_BALANCE);
  };
  const handleAuth=async(u)=>{
    setUser(u); setAuthModal(null); setScreen("app");
    const {supabase}=await import('./supabase');
    // Upsert profile row (creates on first login, no-ops after)
    const displayName=u.user_metadata?.display_name||u.email?.split("@")[0]||"Collector";
    await supabase.from('user_profiles').upsert({
      user_id:u.id, display_name:displayName, email:u.email,
      joined_at: new Date().toISOString().split("T")[0],
    },{onConflict:'user_id',ignoreDuplicates:true});
    await loadUserData(supabase,u.id);
  };
  const handleUpdatePrice=(cardId,price)=>setMarketPrices(p=>({...p,[cardId]:price}));

  const pushNotification=(type,message)=>{ if(!notifOn(type)) return;
    const notif={id:`N-${Date.now()}`,type,message,time:nowTime(),read:false};
    setNotifications(prev=>[notif,...prev].slice(0,50));
    setTimeout(()=>setNotifications(prev=>prev.map(n=>n.id===notif.id?{...n,read:true}:n)),8000);
    // Also fire native browser push notification if permission granted
    if(typeof Notification!=="undefined"&&Notification.permission==="granted"){
      const icons={filled_buy:"🟢",filled_sell:"🔴",price_alert:"🎯",import:"📂"};
      try{ new Notification("◈ Collector's Exchange",{body:message,icon:"/favicon.ico",tag:type,silent:false}); }catch{}
    }
  };

  // Ask for push permission once user is logged in and hasn't been asked yet
  useEffect(()=>{
    if(user && typeof Notification!=="undefined" && Notification.permission==="default"){
      // Small delay so it doesn't fire the instant they log in
      const t=setTimeout(()=>setShowPushPrompt(true),2500);
      return ()=>clearTimeout(t);
    }
  },[user]);

  const requestPushPermission=async()=>{
    if(typeof Notification==="undefined") return;
    const result=await Notification.requestPermission();
    setPushPermission(result);
    setShowPushPrompt(false);
  };

  const isDemo = screen==="app" && !user;

  return(
    <div style={{fontFamily:MONO,fontSize:"17px"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@600;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;} ::-webkit-scrollbar-track{background:${D.bg};} ::-webkit-scrollbar-thumb{background:${D.bdr2};border-radius:2px;}
        input{outline:none;font-family:${MONO};} input:focus{border-color:${D.accD}!important;}
        button{cursor:pointer;} select{outline:none;}
        @keyframes fG{0%,100%{background:transparent}50%{background:rgba(0,200,60,0.14)}}
        @keyframes fR{0%,100%{background:transparent}50%{background:rgba(220,50,50,0.14)}}
        .fu{animation:fG 0.4s ease;} .fd{animation:fR 0.4s ease;}
        @keyframes tickerScroll{0%{transform:translateX(0)}100%{transform:translateX(-33.333%)}}
        @keyframes notifPop{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        .notif-toast{animation:notifPop 0.2s ease;}
        @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .drawer{animation:slideIn 0.22s ease;}
        .sheet{animation:slideUp 0.22s ease;}
        .overlay{animation:fadeIn 0.18s ease;}
        @media(max-width:480px){.desktop-only{display:none!important;}.mobile-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}input,select,button{font-size:16px!important;}}
        @media(min-width:481px){.mobile-only{display:none!important;}}
      `}</style>

      {authModal&&<AuthModal D={D} dark={dark} onClose={()=>setAuthModal(null)} onAuth={handleAuth}/>}
      {adminOpen&&<AdminPanel D={D} dark={dark} onClose={()=>setAdminOpen(false)} currentUserId={user?.id}/>}

      {/* ── Push notification permission prompt ── */}
      {showPushPrompt&&(
        <div style={{position:"fixed",bottom:"80px",right:"20px",zIndex:600,width:"300px",background:dark?"#1a2a1a":"#f0faf0",border:`1px solid ${dark?"#2a5a2a":"#86efac"}`,borderRadius:"12px",padding:"16px 18px",boxShadow:"0 8px 32px rgba(0,0,0,0.25)",animation:"notifPop 0.25s ease"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
            <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
              <span style={{fontSize:"31px"}}>🔔</span>
              <div>
                <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:"16px",fontWeight:700,color:dark?"#00cc40":"#15803d",letterSpacing:"0.08em"}}>ENABLE NOTIFICATIONS</div>
                <div style={{color:dark?"#6aaa6a":"#4a7a4a",fontSize:"13px",marginTop:"2px"}}>Get alerts for order fills & price targets</div>
              </div>
            </div>
            <button onClick={()=>setShowPushPrompt(false)} style={{background:"none",border:"none",color:dark?"#6aaa6a":"#888",fontSize:"23px",cursor:"pointer",lineHeight:1,padding:"0"}}>×</button>
          </div>
          <div style={{color:dark?"#8aaa8a":"#555",fontSize:"14px",marginBottom:"14px",lineHeight:"1.5"}}>
            Allow browser notifications so you hear about fills even when you're on another tab.
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={requestPushPermission} style={{flex:1,padding:"8px",background:dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#cceacc,#a8d8a8)",border:`1px solid ${dark?"#1a5a2a":"#7ab07a"}`,borderRadius:"6px",color:dark?"#00ff55":"#1a5a2a",fontSize:"14px",fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",fontWeight:"bold",letterSpacing:"0.08em"}}>
              → ALLOW
            </button>
            <button onClick={()=>setShowPushPrompt(false)} style={{padding:"8px 14px",background:"transparent",border:`1px solid ${dark?"#2a4a2a":"#ccc"}`,borderRadius:"6px",color:dark?"#6aaa6a":"#888",fontSize:"14px",fontFamily:"'Share Tech Mono',monospace",cursor:"pointer"}}>
              NOT NOW
            </button>
          </div>
        </div>
      )}

      {screen==="landing"&&(
        <Landing D={D} dark={dark} dbCards={dbCards}
          onEnterDemo={()=>setScreen("app")}
          onOpenAuth={(mode)=>setAuthModal(mode)}/>
      )}

      {screen==="app"&&(
        <div style={{background:D.bg,color:D.txt,minHeight:"100vh",transition:"background 0.3s,color 0.3s",display:"flex",flexDirection:"column"}}>
          {/* Demo banner */}
          {isDemo&&(
            <div style={{background:dark?"rgba(0,120,40,0.12)":"rgba(22,128,58,0.08)",borderBottom:`1px solid ${dark?"#1a4a1a":"#a8d4a8"}`,padding:"7px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <span style={{color:dark?"#4a8a4a":"#3a7a3a",fontSize:"14px",letterSpacing:"0.1em"}}>▸ DEMO MODE — Orders reset on refresh. <span style={{color:D.accD,cursor:"pointer",textDecoration:"underline"}} onClick={()=>setAuthModal("signup")}>Create a free account</span> to save your trades.</span>
              <button onClick={()=>setAuthModal("signup")} style={{padding:"4px 12px",background:dark?"rgba(0,180,60,0.15)":"rgba(22,128,58,0.10)",border:`1px solid ${dark?"#1a4a1a":"#8acc8a"}`,borderRadius:"4px",color:D.accD,fontSize:"13px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>SIGN UP →</button>
            </div>
          )}

          {/* ── Live ticker ── */}
          <Ticker D={D} dark={dark} tradeHistory={tradeHistory} dbCards={dbCards} marketPrices={marketPrices}/>

          {/* ── CSV Import Modal ── */}
          {csvModal&&<CSVImportModal D={D} dark={dark} dbCards={dbCards} onImport={handleCSVImport} onClose={()=>setCsvModal(false)} marketPrices={marketPrices} tradeHistory={tradeHistory}/>}

          {/* ── Mobile hamburger drawer overlay ── */}
          {isMobile&&drawerOpen&&(
            <div className="overlay" onClick={()=>setDrawerOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200}}/>
          )}
          {isMobile&&drawerOpen&&(
            <div className="drawer" style={{position:"fixed",top:0,left:0,bottom:0,width:"75vw",maxWidth:"280px",background:D.hdrBg,borderRight:`1px solid ${D.bdr2}`,zIndex:201,display:"flex",flexDirection:"column",padding:"0"}}>
              <div style={{padding:"16px",borderBottom:`1px solid ${D.bdr}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontFamily:ORB,fontSize:"22px",fontWeight:800,color:D.acc,letterSpacing:"0.18em"}}>◈ CX</span>
                <button onClick={()=>setDrawerOpen(false)} style={{background:"none",border:"none",color:D.txtD,fontSize:"29px",padding:"4px 8px"}}>✕</button>
              </div>
              {user&&(
                <div style={{padding:"12px 16px",borderBottom:`1px solid ${D.bdr}`}}>
                  <div onClick={()=>{setTab("PROFILE");setDrawerOpen(false);}} style={{color:D.txtM,fontSize:"16px",marginBottom:"4px",display:"flex",alignItems:"center",gap:"6px",cursor:"pointer"}}>
                    👤 {profile?.display_name||user.user_metadata?.display_name||user.email?.split("@")[0]}
                  </div>
                  <div style={{marginBottom:"4px"}}><RepBadge tradeCount={profile?.trade_count||tradeHistory.length}/></div>
                  <div style={{color:D.acc,fontSize:"19px",fontWeight:"bold"}}>💵 ${balance.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
                </div>
              )}
              <div style={{flex:1,padding:"8px 0"}}>
                {["MARKET","BROWSE","PORTFOLIO","ORDERS","HISTORY"].map(t=>(
                  <button key={t} onClick={()=>{setTab(t);setDrawerOpen(false);}} style={{display:"block",width:"100%",padding:"14px 20px",border:"none",background:tab===t?(dark?"rgba(0,255,80,0.08)":"rgba(22,128,58,0.07)"):"transparent",color:tab===t?D.accD:D.txtM,fontSize:"16px",fontFamily:MONO,letterSpacing:"0.12em",textAlign:"left",borderLeft:`3px solid ${tab===t?D.accD:"transparent"}`,cursor:"pointer"}}>{t}</button>
                ))}
              </div>
              <div style={{padding:"16px",borderTop:`1px solid ${D.bdr}`,display:"flex",flexDirection:"column",gap:"8px"}}>
                <div onClick={()=>setDark(d=>!d)} style={{display:"flex",alignItems:"center",gap:"10px",cursor:"pointer",padding:"8px 0"}}>
                  <div style={{width:"36px",height:"20px",background:dark?"#1a3a1a":"#d1ecd1",borderRadius:"10px",border:`1px solid ${D.bdr2}`,display:"flex",alignItems:"center",padding:"2px",transition:"background 0.3s"}}>
                    <div style={{width:"14px",height:"14px",borderRadius:"50%",background:dark?"#00cc40":"#f59e0b",transform:dark?"translateX(0)":"translateX(16px)",transition:"transform 0.3s"}}/>
                  </div>
                  <span style={{color:D.txtM,fontSize:"14px"}}>{dark?"DARK MODE":"LIGHT MODE"}</span>
                </div>
                {user?(
                  <>
                  {profile?.is_admin&&<button onClick={()=>{setAdminOpen(true);setDrawerOpen(false);}} style={{padding:"10px",background:"transparent",border:"1px solid #f59e0b",borderRadius:"4px",color:"#f59e0b",fontSize:"14px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>⚙ ADMIN PANEL</button>}
                  <button onClick={()=>{setCsvModal(true);setDrawerOpen(false);}} style={{padding:"10px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"4px",color:D.txtD,fontSize:"14px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>📂 IMPORT CSV</button>
                  <button onClick={()=>{handleLogout();setDrawerOpen(false);}} style={{padding:"10px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"4px",color:D.txtD,fontSize:"14px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>LOG OUT</button>
                  </>
                ):(
                  <div style={{display:"flex",gap:"8px"}}>
                    <button onClick={()=>{setAuthModal("login");setDrawerOpen(false);}} style={{flex:1,padding:"10px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"4px",color:D.txtD,fontSize:"14px",fontFamily:MONO,cursor:"pointer"}}>LOG IN</button>
                    <button onClick={()=>{setAuthModal("signup");setDrawerOpen(false);}} style={{flex:1,padding:"10px",background:dark?"rgba(0,120,40,0.15)":"rgba(22,128,58,0.08)",border:`1px solid ${D.accD}`,borderRadius:"4px",color:D.accD,fontSize:"14px",fontFamily:MONO,cursor:"pointer"}}>SIGN UP</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Nav bar ── */}
          <div style={{background:D.hdrBg,borderBottom:`1px solid ${D.bdr2}`,padding:isMobile?"0 12px":"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:"44px",position:"sticky",top:0,zIndex:100,boxShadow:D.shad,flexShrink:0}}>
            {isMobile?(
              <>
                <button onClick={()=>setDrawerOpen(true)} style={{background:"none",border:`1px solid ${D.bdr}`,borderRadius:"4px",color:D.txtM,fontSize:"26px",padding:"4px 8px",lineHeight:1,cursor:"pointer"}}>☰</button>
                <div style={{display:"flex",alignItems:"baseline",gap:"6px",cursor:"pointer"}} onClick={()=>user?setTab("MARKET"):setScreen("landing")}>
                  <span style={{fontFamily:ORB,fontSize:"22px",fontWeight:800,color:D.acc,letterSpacing:"0.18em",textShadow:dark?"0 0 22px rgba(0,255,80,0.45)":"none"}}>◈ CX</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <span style={{color:D.txtM,fontSize:"16px"}}>💵 ${balance.toLocaleString("en-US",{maximumFractionDigits:0})}</span>
                  <div onClick={()=>setDark(d=>!d)} style={{width:"36px",height:"20px",background:dark?"#1a3a1a":"#d1ecd1",borderRadius:"10px",border:`1px solid ${D.bdr2}`,display:"flex",alignItems:"center",padding:"2px",cursor:"pointer"}}>
                    <div style={{width:"14px",height:"14px",borderRadius:"50%",background:dark?"#00cc40":"#f59e0b",transform:dark?"translateX(0)":"translateX(16px)",transition:"transform 0.3s"}}/>
                  </div>
                </div>
              </>
            ):(
              <>
                <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:"8px",cursor:"pointer"}} onClick={()=>user?setTab("MARKET"):setScreen("landing")}>
                    <span style={{fontFamily:ORB,fontSize:"23px",fontWeight:800,color:D.acc,letterSpacing:"0.18em",textShadow:dark?"0 0 22px rgba(0,255,80,0.45)":"none"}}>◈ CX</span>
                    <span style={{fontFamily:ORB,fontSize:"16px",fontWeight:600,color:D.txtM,letterSpacing:"0.08em"}}>COLLECTOR'S EXCHANGE</span>
                  </div>
                  <span style={{color:D.bdr2}}>|</span>
                  <span style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.14em",fontStyle:"italic"}}>Buy. Sell. Collect.</span>
                </div>
                <div style={{display:"flex",gap:"2px",alignItems:"center"}}>
                  {["MARKET","BROWSE","PORTFOLIO","ORDERS","HISTORY"].map(t=>(
                    <button key={t} onClick={()=>setTab(t)} style={{padding:"0 16px",height:"44px",border:"none",background:"transparent",color:tab===t?D.accD:D.txtD,fontSize:"14px",fontFamily:MONO,letterSpacing:"0.12em",borderBottom:`2px solid ${tab===t?D.accD:"transparent"}`,transition:"all 0.12s",cursor:"pointer"}}>{t}</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
                  {user?(
                    <>
                      <span onClick={()=>setTab("PROFILE")} style={{color:D.txtD,fontSize:"14px",display:"flex",alignItems:"center",gap:"6px",cursor:"pointer",padding:"3px 8px",borderRadius:"4px",border:`1px solid transparent`}} onMouseEnter={e=>{e.currentTarget.style.borderColor=D.bdr;e.currentTarget.style.background=D.bg3;}} onMouseLeave={e=>{e.currentTarget.style.borderColor="transparent";e.currentTarget.style.background="transparent";}}>
                        👤 {profile?.display_name||user.user_metadata?.display_name||user.email?.split("@")[0]}
                        <RepBadge tradeCount={profile?.trade_count||tradeHistory.length}/>
                      </span>
                      {profile?.is_admin&&<button onClick={()=>setAdminOpen(true)} title="Admin Panel" style={{padding:"3px 8px",background:"transparent",border:"1px solid #f59e0b",borderRadius:"3px",color:"#f59e0b",fontSize:"13px",fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",letterSpacing:"0.06em"}}>⚙ ADMIN</button>}
                      <div style={{background:D.stBg,border:`1px solid ${D.bdr}`,borderRadius:"3px",padding:"3px 10px",fontSize:"16px",color:D.txtM}}>💵 ${balance.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
                      <NotificationBell D={D} dark={dark} notifications={notifications} onClear={id=>setNotifications(p=>p.filter(n=>n.id!==id))} onClearAll={()=>setNotifications([])}/>
                      <button onClick={()=>setCsvModal(true)} title="Import CSV" style={{padding:"3px 8px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"3px",color:D.txtD,fontSize:"19px",cursor:"pointer"}}>📂</button>
                      <button onClick={handleLogout} style={{padding:"3px 10px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"3px",color:D.txtD,fontSize:"13px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>LOG OUT</button>
                    </>
                  ):(
                    <>
                      <div style={{background:D.stBg,border:`1px solid ${D.bdr}`,borderRadius:"3px",padding:"3px 10px",fontSize:"16px",color:D.txtM}}>💵 ${balance.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
                      <button onClick={()=>setAuthModal("login")} style={{padding:"3px 10px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"3px",color:D.txtD,fontSize:"13px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>LOG IN</button>
                      <button onClick={()=>setAuthModal("signup")} style={{padding:"3px 10px",background:dark?"rgba(0,120,40,0.15)":"rgba(22,128,58,0.08)",border:`1px solid ${D.accD}`,borderRadius:"3px",color:D.accD,fontSize:"13px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>SIGN UP</button>
                    </>
                  )}
                  <div onClick={()=>setDark(d=>!d)} style={{width:"44px",height:"24px",background:dark?"#1a3a1a":"#d1ecd1",borderRadius:"12px",border:`1px solid ${D.bdr2}`,display:"flex",alignItems:"center",padding:"3px",transition:"background 0.3s",cursor:"pointer"}}>
                    <div style={{width:"16px",height:"16px",borderRadius:"50%",background:dark?"#00cc40":"#f59e0b",transform:dark?"translateX(0)":"translateX(20px)",transition:"transform 0.3s,background 0.3s",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px"}}>{dark?"🌙":"☀️"}</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Mobile bottom tab bar ── */}
          {isMobile&&(
            <div style={{position:"fixed",bottom:0,left:0,right:0,background:D.hdrBg,borderTop:`1px solid ${D.bdr2}`,display:"flex",zIndex:100,height:"54px",boxShadow:"0 -2px 12px rgba(0,0,0,0.15)"}}>
              {[{t:"MARKET",i:"📈"},{t:"BROWSE",i:"🔍"},{t:"PORTFOLIO",i:"💼"},{t:"ORDERS",i:"📋"},{t:"HISTORY",i:"📜"}].map(({t,i})=>(
                <button key={t} onClick={()=>setTab(t)} style={{flex:1,border:"none",background:"transparent",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"2px",color:tab===t?D.accD:D.txtD,fontSize:"12px",fontFamily:MONO,letterSpacing:"0.06em",borderTop:`2px solid ${tab===t?D.accD:"transparent"}`,cursor:"pointer",padding:"6px 0"}}>
                  <span style={{fontSize:"23px"}}>{i}</span>
                  <span>{t}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{flex:1,display:"flex",overflow:"hidden",paddingBottom:isMobile?"54px":"0"}}>
            {tab==="MARKET"    && <Market    D={D} dark={dark} dbCards={dbCards} initialCard={selectedCard} balance={balance} holdings={holdings} onPlaceOrder={placeOrder} onUpdatePrice={handleUpdatePrice} tradeHistory={tradeHistory} isDemo={isDemo} isMobile={isMobile}/>}
            {tab==="BROWSE"    && <Browser   D={D} dark={dark} dbCards={dbCards} onSelectCard={handleBrowseSelect} isMobile={isMobile}/>}
            {tab==="PORTFOLIO" && <Portfolio D={D} dark={dark} holdings={holdings} tradeHistory={tradeHistory} dbCards={dbCards} isMobile={isMobile} onNavigateToMarket={c=>{setSelectedCard(c);setTab("MARKET");}}/>}
            {tab==="ORDERS"    && <Orders    D={D} dark={dark} orders={orders} onCancel={cancelOrder} dbCards={dbCards} isMobile={isMobile}/>}
            {tab==="HISTORY"   && <History   D={D} dark={dark} tradeHistory={tradeHistory} ledger={ledger} dbCards={dbCards} isMobile={isMobile}/>}
            {tab==="PROFILE"   && user && <ProfileSettings D={D} dark={dark} user={user} profile={profile} tradeHistory={tradeHistory} holdings={holdings} balance={balance} onProfileUpdate={handleProfileUpdate} onDarkToggle={()=>setDark(d=>!d)} isMobile={isMobile} onNotifPrefsChange={p=>setNotifPrefs(p)}/>}
          </div>
        </div>
      )}
    </div>
  );
}