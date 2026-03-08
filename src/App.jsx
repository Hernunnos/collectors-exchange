import { supabase } from './supabase'
import { useState, useEffect } from "react";

// ── Data ─────────────────────────────────────────────────────────────────────
const CARDS = [
  { id:1, name:"Charizard",          set:"Base Set",  condition:"PSA 10", rarity:"Holo Rare", game:"Pokémon", img:"https://images.pokemontcg.io/base1/4_hires.png" },
  { id:2, name:"Black Lotus",         set:"Alpha",     condition:"NM",     rarity:"Rare",      game:"MTG",     img:"https://cards.scryfall.io/large/front/b/d/bd8fa327-dd41-4737-8f19-2cf5eb1f7cdd.jpg" },
  { id:3, name:"Pikachu Illustrator", set:"CoroCoro",  condition:"PSA 9",  rarity:"Promo",     game:"Pokémon", img:"https://images.pokemontcg.io/basep/1_hires.png" },
  { id:4, name:"Blastoise",           set:"Base Set",  condition:"PSA 8",  rarity:"Holo Rare", game:"Pokémon", img:"https://images.pokemontcg.io/base1/2_hires.png" },
  { id:5, name:"Mewtwo",              set:"Base Set",  condition:"PSA 9",  rarity:"Holo Rare", game:"Pokémon", img:"https://images.pokemontcg.io/base1/10_hires.png" },
];
const BASE = { 1:420, 2:8500, 3:74000, 4:280, 5:310 };

const HOLDINGS = [
  { cardId:1, qty:2, avgCost:380.00, acquired:"2024-11-14" },
  { cardId:4, qty:3, avgCost:255.00, acquired:"2024-12-02" },
  { cardId:5, qty:1, avgCost:295.00, acquired:"2025-01-08" },
];

const SAMPLE_ORDERS = [
  { id:"ORD-0041", cardId:1, side:"buy",  type:"limit",  price:415.00,  qty:1, filled:0, status:"open",      time:"09:14:22", date:"2026-03-08" },
  { id:"ORD-0039", cardId:2, side:"sell", type:"limit",  price:8600.00, qty:1, filled:0, status:"open",      time:"08:55:10", date:"2026-03-08" },
  { id:"ORD-0037", cardId:5, side:"buy",  type:"limit",  price:305.00,  qty:2, filled:1, status:"partial",   time:"08:30:44", date:"2026-03-08" },
  { id:"ORD-0034", cardId:4, side:"buy",  type:"market", price:280.00,  qty:1, filled:0, status:"cancelled", time:"15:22:01", date:"2026-03-07" },
  { id:"ORD-0031", cardId:1, side:"sell", type:"limit",  price:440.00,  qty:1, filled:0, status:"cancelled", time:"11:05:33", date:"2026-03-06" },
];

const SAMPLE_HISTORY = [
  { id:"TRD-0088", cardId:1, side:"buy",  price:380.00,  qty:2, total:760.00,  date:"2024-11-14", time:"10:22:11" },
  { id:"TRD-0072", cardId:4, side:"buy",  price:255.00,  qty:3, total:765.00,  date:"2024-12-02", time:"14:08:55" },
  { id:"TRD-0065", cardId:5, side:"buy",  price:295.00,  qty:1, total:295.00,  date:"2025-01-08", time:"09:44:20" },
  { id:"TRD-0051", cardId:2, side:"sell", price:8200.00, qty:1, total:8200.00, date:"2025-02-14", time:"16:30:02" },
  { id:"TRD-0040", cardId:1, side:"sell", price:420.00,  qty:1, total:420.00,  date:"2025-03-01", time:"11:15:44" },
];

const SAMPLE_LEDGER = [
  { id:"DEP-001", type:"deposit",    amount:5000.00,  method:"Bank Transfer", date:"2024-11-10" },
  { id:"DEP-002", type:"deposit",    amount:10000.00, method:"Bank Transfer", date:"2024-12-01" },
  { id:"WIT-001", type:"withdrawal", amount:2500.00,  method:"Bank Transfer", date:"2025-01-20" },
  { id:"DEP-003", type:"deposit",    amount:3000.00,  method:"Card",          date:"2025-02-28" },
];

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
function Portfolio({D,dark}){
  const [selected,setSelected]=useState(null);
  const [watchlist,setWatchlist]=useState([CARDS[1],CARDS[2]]);

  const holdings=HOLDINGS.map(h=>{
    const card=CARDS.find(c=>c.id===h.cardId);
    const cur=+(BASE[h.cardId]*(0.97+Math.random()*0.06)).toFixed(2);
    const val=+(cur*h.qty).toFixed(2);
    const cost=+(h.avgCost*h.qty).toFixed(2);
    const pnl=+(val-cost).toFixed(2);
    const pct=+((pnl/cost)*100).toFixed(2);
    return {...h,card,cur,val,cost,pnl,pct};
  });

  const totalVal=+holdings.reduce((s,h)=>s+h.val,0).toFixed(2);
  const totalCost=+holdings.reduce((s,h)=>s+h.cost,0).toFixed(2);
  const totalPnl=+(totalVal-totalCost).toFixed(2);
  const totalPct=+((totalPnl/totalCost)*100).toFixed(2);

  const portHist=Array.from({length:30},(_,i)=>totalCost*(0.9+i*0.005)+(Math.random()-0.4)*totalCost*0.02);
  const minH=Math.min(...portHist),maxH=Math.max(...portHist),rngH=maxH-minH||1;
  const sp=portHist.map((v,i)=>`${i===0?"M":"L"}${((i/(portHist.length-1))*400).toFixed(1)},${(60-((v-minH)/rngH)*54).toFixed(1)}`).join(" ");

  return(
    <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:"16px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px"}}>
        {[["TOTAL VALUE",`$${totalVal.toLocaleString("en-US",{minimumFractionDigits:2})}`,""],["TOTAL COST",`$${totalCost.toLocaleString("en-US",{minimumFractionDigits:2})}`,""],["UNREALISED P&L",`${totalPnl>=0?"+":""}$${Math.abs(totalPnl).toLocaleString("en-US",{minimumFractionDigits:2})}`,totalPnl>=0?"up":"dn"],["RETURN",`${totalPct>=0?"+":""}${totalPct}%`,totalPct>=0?"up":"dn"]].map(([label,val,dir])=>(
          <div key={label} style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px",padding:"14px 16px"}}>
            <div style={{color:D.txtD,fontSize:"9px",letterSpacing:"0.12em",marginBottom:"8px"}}>{label}</div>
            <div style={{fontFamily:ORB,fontSize:"18px",fontWeight:700,color:dir==="up"?D.buyT:dir==="dn"?D.askT:D.txt}}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px",padding:"14px 16px"}}>
        <div style={{color:D.txtD,fontSize:"10px",letterSpacing:"0.12em",marginBottom:"10px"}}>▸ PORTFOLIO VALUE — 30 DAYS</div>
        <svg width="100%" height="70" viewBox="0 0 400 65" preserveAspectRatio="none" style={{display:"block"}}>
          <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={D.accD} stopOpacity={dark?"0.18":"0.10"}/><stop offset="100%" stopColor={D.accD} stopOpacity="0"/></linearGradient></defs>
          {[0.25,0.5,0.75].map(f=><line key={f} x1="0" y1={65*f} x2="400" y2={65*f} stroke={D.bdr} strokeWidth="0.5"/>)}
          <path d={sp+` L400,65 L0,65 Z`} fill="url(#pg)"/>
          <path d={sp} fill="none" stroke={D.accD} strokeWidth="2" style={{filter:dark?`drop-shadow(0 0 4px ${D.accD}80)`:"none"}}/>
        </svg>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
        <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px",overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${D.bdr}`,color:D.txtD,fontSize:"10px",letterSpacing:"0.12em"}}>▸ HOLDINGS</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 50px 70px 70px 70px",padding:"5px 14px",color:D.txtD,fontSize:"9px",borderBottom:`1px solid ${D.bdr}`}}>
            <span>CARD</span><span style={{textAlign:"right"}}>QTY</span><span style={{textAlign:"right"}}>PRICE</span><span style={{textAlign:"right"}}>VALUE</span><span style={{textAlign:"right"}}>P&L</span>
          </div>
          {holdings.map(h=>(
            <div key={h.cardId} onClick={()=>setSelected(selected?.cardId===h.cardId?null:h)} style={{display:"grid",gridTemplateColumns:"1fr 50px 70px 70px 70px",padding:"9px 14px",borderBottom:`1px solid ${D.bdr}`,cursor:"pointer",background:selected?.cardId===h.cardId?(dark?"rgba(0,255,80,0.05)":"rgba(22,128,58,0.05)"):"transparent",transition:"background 0.1s",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <img src={h.card.img} alt={h.card.name} style={{width:"22px",height:"30px",objectFit:"cover",borderRadius:"2px"}} onError={e=>e.target.style.display="none"}/>
                <div><div style={{color:D.txt,fontSize:"11px"}}>{h.card.name}</div><div style={{color:D.txtD,fontSize:"9px"}}>{h.card.condition}</div></div>
              </div>
              <span style={{textAlign:"right",color:D.txtM,fontSize:"11px"}}>{h.qty}</span>
              <span style={{textAlign:"right",color:D.txt,fontSize:"11px"}}>${h.cur.toLocaleString()}</span>
              <span style={{textAlign:"right",color:D.txt,fontSize:"11px"}}>${h.val.toLocaleString()}</span>
              <span style={{textAlign:"right",color:h.pnl>=0?D.buyT:D.askT,fontSize:"11px"}}>{h.pnl>=0?"+":""}${Math.abs(h.pnl).toLocaleString()}</span>
            </div>
          ))}
          {selected && (
            <div style={{borderTop:`1px solid ${D.bdr}`,padding:"10px 14px"}}>
              <div style={{color:D.txtD,fontSize:"9px",letterSpacing:"0.1em",marginBottom:"8px"}}>▸ TRADES — {selected.card.name}</div>
              {SAMPLE_HISTORY.filter(t=>t.cardId===selected.cardId).map(t=>(
                <div key={t.id} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${D.bdr}`}}>
                  <span style={{color:t.side==="buy"?D.buyT:D.askT,fontSize:"10px"}}>{t.side.toUpperCase()}</span>
                  <span style={{color:D.txtM,fontSize:"10px"}}>{t.qty}x @ ${t.price.toLocaleString()}</span>
                  <span style={{color:D.txtD,fontSize:"10px"}}>{t.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px",overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${D.bdr}`,color:D.txtD,fontSize:"10px",letterSpacing:"0.12em",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>▸ WATCHLIST</span>
            <span style={{color:D.accD,fontSize:"9px",cursor:"pointer"}}>+ ADD</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 28px",padding:"5px 14px",color:D.txtD,fontSize:"9px",borderBottom:`1px solid ${D.bdr}`}}>
            <span>CARD</span><span style={{textAlign:"right"}}>PRICE</span><span style={{textAlign:"right"}}>24H</span><span/>
          </div>
          {watchlist.map(c=>{
            const chg=((Math.random()-0.45)*6).toFixed(2);const up=+chg>=0;
            return(
              <div key={c.id} style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 28px",padding:"9px 14px",borderBottom:`1px solid ${D.bdr}`,alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <img src={c.img} alt={c.name} style={{width:"22px",height:"30px",objectFit:"cover",borderRadius:"2px"}} onError={e=>e.target.style.display="none"}/>
                  <div><div style={{color:D.txt,fontSize:"11px"}}>{c.name}</div><div style={{color:D.txtD,fontSize:"9px"}}>{c.set}</div></div>
                </div>
                <span style={{textAlign:"right",color:D.txt,fontSize:"11px"}}>${BASE[c.id].toLocaleString()}</span>
                <span style={{textAlign:"right",color:up?D.buyT:D.askT,fontSize:"11px"}}>{up?"+":""}{chg}%</span>
                <span onClick={()=>setWatchlist(w=>w.filter(x=>x.id!==c.id))} style={{textAlign:"right",color:D.txtD,fontSize:"16px",cursor:"pointer",lineHeight:1}}>×</span>
              </div>
            );
          })}
          {CARDS.filter(c=>!watchlist.find(w=>w.id===c.id)&&!HOLDINGS.find(h=>h.cardId===c.id)).slice(0,2).map(c=>(
            <div key={c.id} onClick={()=>setWatchlist(w=>[...w,c])} style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 14px",borderBottom:`1px solid ${D.bdr}`,cursor:"pointer",opacity:0.5}}>
              <span style={{color:D.accD,fontSize:"11px"}}>+</span>
              <img src={c.img} alt={c.name} style={{width:"18px",height:"25px",objectFit:"cover",borderRadius:"2px"}} onError={e=>e.target.style.display="none"}/>
              <span style={{color:D.txtM,fontSize:"11px"}}>{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Orders ────────────────────────────────────────────────────────────────────
function Orders({D,dark}){
  const [filter,setFilter]=useState("all");
  const [orders,setOrders]=useState(SAMPLE_ORDERS);

  const cancel=id=>setOrders(o=>o.map(x=>x.id===id?{...x,status:"cancelled"}:x));
  const filtered=filter==="all"?orders:orders.filter(o=>o.status===filter);
  const sColor=s=>s==="open"?D.buyT:s==="partial"?"#f59e0b":D.txtD;
  const sBg=s=>s==="open"?(dark?"rgba(0,200,60,0.08)":"rgba(22,128,58,0.08)"):s==="partial"?(dark?"rgba(245,158,11,0.08)":"rgba(245,158,11,0.06)"):dark?"rgba(80,80,80,0.08)":"rgba(80,80,80,0.04)";

  return(
    <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:"16px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px"}}>
        {[["OPEN",orders.filter(o=>o.status==="open").length],["PARTIAL",orders.filter(o=>o.status==="partial").length],["CANCELLED",orders.filter(o=>o.status==="cancelled").length],["TOTAL",orders.length]].map(([label,val])=>(
          <div key={label} style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px",padding:"14px 16px"}}>
            <div style={{color:D.txtD,fontSize:"9px",letterSpacing:"0.12em",marginBottom:"8px"}}>{label} ORDERS</div>
            <div style={{fontFamily:ORB,fontSize:"22px",fontWeight:700,color:D.txt}}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px",overflow:"hidden"}}>
        <div style={{display:"flex",borderBottom:`1px solid ${D.bdr}`,padding:"0 14px"}}>
          {["all","open","partial","cancelled"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{padding:"10px 14px",border:"none",background:"transparent",color:filter===f?D.accD:D.txtD,fontSize:"10px",fontFamily:MONO,letterSpacing:"0.1em",cursor:"pointer",borderBottom:`2px solid ${filter===f?D.accD:"transparent"}`,transition:"all 0.1s"}}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"90px 1fr 50px 60px 80px 60px 80px 70px",padding:"6px 14px",color:D.txtD,fontSize:"9px",borderBottom:`1px solid ${D.bdr}`,letterSpacing:"0.08em"}}>
          <span>ORDER ID</span><span>CARD</span><span>SIDE</span><span>TYPE</span><span style={{textAlign:"right"}}>PRICE</span><span style={{textAlign:"right"}}>QTY</span><span style={{textAlign:"right"}}>STATUS</span><span style={{textAlign:"right"}}>ACTION</span>
        </div>
        {filtered.length===0&&<div style={{padding:"40px",textAlign:"center",color:D.txtD,fontSize:"11px"}}>No {filter} orders</div>}
        {filtered.map(o=>{
          const card=CARDS.find(c=>c.id===o.cardId);
          return(
            <div key={o.id} style={{display:"grid",gridTemplateColumns:"90px 1fr 50px 60px 80px 60px 80px 70px",padding:"10px 14px",borderBottom:`1px solid ${D.bdr}`,alignItems:"center"}}>
              <span style={{color:D.txtM,fontSize:"10px"}}>{o.id}</span>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <img src={card.img} alt={card.name} style={{width:"20px",height:"28px",objectFit:"cover",borderRadius:"2px"}} onError={e=>e.target.style.display="none"}/>
                <div><div style={{color:D.txt,fontSize:"11px"}}>{card.name}</div><div style={{color:D.txtD,fontSize:"9px"}}>{o.date} {o.time}</div></div>
              </div>
              <span style={{color:o.side==="buy"?D.buyT:D.askT,fontSize:"10px"}}>{o.side.toUpperCase()}</span>
              <span style={{color:D.txtM,fontSize:"10px"}}>{o.type.toUpperCase()}</span>
              <span style={{textAlign:"right",color:D.txt,fontSize:"11px"}}>${o.price.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
              <span style={{textAlign:"right",color:D.txtM,fontSize:"11px"}}>{o.filled}/{o.qty}</span>
              <div style={{textAlign:"right"}}><span style={{background:sBg(o.status),color:sColor(o.status),padding:"2px 7px",borderRadius:"3px",fontSize:"9px"}}>{o.status.toUpperCase()}</span></div>
              <div style={{textAlign:"right"}}>
                {(o.status==="open"||o.status==="partial")?(
                  <button onClick={()=>cancel(o.id)} style={{padding:"3px 8px",background:dark?"rgba(220,50,50,0.12)":"rgba(220,50,50,0.08)",border:`1px solid ${dark?"#5a1a1a":"#e07070"}`,borderRadius:"3px",color:D.askT,fontSize:"9px",fontFamily:MONO,cursor:"pointer"}}>CANCEL</button>
                ):<span style={{color:D.txtD,fontSize:"9px"}}>—</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── History ───────────────────────────────────────────────────────────────────
function History({D,dark}){
  const [tab,setTab]=useState("trades");

  function downloadCSV(){
    const rows=[["ID","Card","Side","Price","Qty","Total","Date","Time"],...SAMPLE_HISTORY.map(t=>{const card=CARDS.find(c=>c.id===t.cardId);return[t.id,card.name,t.side,t.price,t.qty,t.total,t.date,t.time];})];
    const blob=new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="cx-trade-history.csv";a.click();
  }

  return(
    <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:"16px"}}>
      <div style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px",overflow:"hidden"}}>
        <div style={{display:"flex",borderBottom:`1px solid ${D.bdr}`,padding:"0 14px",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex"}}>
            {[["trades","TRADES"],["ledger","DEPOSITS & WITHDRAWALS"],["alerts","PRICE ALERTS"]].map(([key,label])=>(
              <button key={key} onClick={()=>setTab(key)} style={{padding:"10px 14px",border:"none",background:"transparent",color:tab===key?D.accD:D.txtD,fontSize:"10px",fontFamily:MONO,letterSpacing:"0.08em",cursor:"pointer",borderBottom:`2px solid ${tab===key?D.accD:"transparent"}`,transition:"all 0.1s"}}>{label}</button>
            ))}
          </div>
          {tab==="trades"&&(
            <button onClick={downloadCSV} style={{padding:"5px 12px",background:dark?"rgba(0,180,60,0.1)":"rgba(22,128,58,0.08)",border:`1px solid ${dark?"#1a4a2a":"#8acc8a"}`,borderRadius:"4px",color:D.accD,fontSize:"9px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em",marginRight:"4px"}}>↓ DOWNLOAD CSV</button>
          )}
        </div>

        {tab==="trades"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"90px 1fr 50px 80px 50px 90px 110px",padding:"6px 14px",color:D.txtD,fontSize:"9px",borderBottom:`1px solid ${D.bdr}`,letterSpacing:"0.08em"}}>
              <span>TRADE ID</span><span>CARD</span><span>SIDE</span><span style={{textAlign:"right"}}>PRICE</span><span style={{textAlign:"right"}}>QTY</span><span style={{textAlign:"right"}}>TOTAL</span><span style={{textAlign:"right"}}>DATE</span>
            </div>
            {SAMPLE_HISTORY.map(t=>{const card=CARDS.find(c=>c.id===t.cardId);return(
              <div key={t.id} style={{display:"grid",gridTemplateColumns:"90px 1fr 50px 80px 50px 90px 110px",padding:"10px 14px",borderBottom:`1px solid ${D.bdr}`,alignItems:"center"}}>
                <span style={{color:D.txtM,fontSize:"10px"}}>{t.id}</span>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <img src={card.img} alt={card.name} style={{width:"20px",height:"28px",objectFit:"cover",borderRadius:"2px"}} onError={e=>e.target.style.display="none"}/>
                  <span style={{color:D.txt,fontSize:"11px"}}>{card.name}</span>
                </div>
                <span style={{color:t.side==="buy"?D.buyT:D.askT,fontSize:"10px"}}>{t.side.toUpperCase()}</span>
                <span style={{textAlign:"right",color:D.txt,fontSize:"11px"}}>${t.price.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                <span style={{textAlign:"right",color:D.txtM,fontSize:"11px"}}>{t.qty}</span>
                <span style={{textAlign:"right",color:D.txt,fontSize:"11px"}}>${t.total.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                <span style={{textAlign:"right",color:D.txtD,fontSize:"10px"}}>{t.date} {t.time}</span>
              </div>
            );})}
          </>
        )}

        {tab==="ledger"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"90px 110px 1fr 100px 100px",padding:"6px 14px",color:D.txtD,fontSize:"9px",borderBottom:`1px solid ${D.bdr}`,letterSpacing:"0.08em"}}>
              <span>ID</span><span>TYPE</span><span>METHOD</span><span style={{textAlign:"right"}}>AMOUNT</span><span style={{textAlign:"right"}}>DATE</span>
            </div>
            {SAMPLE_LEDGER.map(l=>(
              <div key={l.id} style={{display:"grid",gridTemplateColumns:"90px 110px 1fr 100px 100px",padding:"10px 14px",borderBottom:`1px solid ${D.bdr}`,alignItems:"center"}}>
                <span style={{color:D.txtM,fontSize:"10px"}}>{l.id}</span>
                <span style={{color:l.type==="deposit"?D.buyT:D.askT,fontSize:"10px"}}>{l.type.toUpperCase()}</span>
                <span style={{color:D.txtM,fontSize:"11px"}}>{l.method}</span>
                <span style={{textAlign:"right",color:l.type==="deposit"?D.buyT:D.askT,fontSize:"11px"}}>{l.type==="deposit"?"+":"-"}${l.amount.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                <span style={{textAlign:"right",color:D.txtD,fontSize:"10px"}}>{l.date}</span>
              </div>
            ))}
            <div style={{padding:"12px 14px",borderTop:`1px solid ${D.bdr}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:D.txtD,fontSize:"10px"}}>NET BALANCE</span>
              <span style={{color:D.buyT,fontSize:"13px",fontFamily:ORB}}>${SAMPLE_LEDGER.reduce((s,l)=>l.type==="deposit"?s+l.amount:s-l.amount,0).toLocaleString("en-US",{minimumFractionDigits:2})}</span>
            </div>
          </>
        )}

        {tab==="alerts"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"90px 1fr 90px 80px 90px 130px",padding:"6px 14px",color:D.txtD,fontSize:"9px",borderBottom:`1px solid ${D.bdr}`,letterSpacing:"0.08em"}}>
              <span>ID</span><span>CARD</span><span>CONDITION</span><span style={{textAlign:"right"}}>TARGET</span><span style={{textAlign:"right"}}>STATUS</span><span style={{textAlign:"right"}}>TRIGGERED AT</span>
            </div>
            {SAMPLE_ALERTS.map(a=>{const card=CARDS.find(c=>c.id===a.cardId);return(
              <div key={a.id} style={{display:"grid",gridTemplateColumns:"90px 1fr 90px 80px 90px 130px",padding:"10px 14px",borderBottom:`1px solid ${D.bdr}`,alignItems:"center"}}>
                <span style={{color:D.txtM,fontSize:"10px"}}>{a.id}</span>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <img src={card.img} alt={card.name} style={{width:"20px",height:"28px",objectFit:"cover",borderRadius:"2px"}} onError={e=>e.target.style.display="none"}/>
                  <span style={{color:D.txt,fontSize:"11px"}}>{card.name}</span>
                </div>
                <span style={{color:D.txtM,fontSize:"10px"}}>{a.condition.toUpperCase()} </span>
                <span style={{textAlign:"right",color:D.txt,fontSize:"11px"}}>${a.target.toLocaleString()}</span>
                <div style={{textAlign:"right"}}>
                  <span style={{padding:"2px 7px",borderRadius:"3px",fontSize:"9px",color:a.triggered?D.buyT:a.active?"#f59e0b":D.txtD,background:a.triggered?(dark?"rgba(0,200,60,0.08)":"rgba(22,128,58,0.06)"):a.active?(dark?"rgba(245,158,11,0.08)":"rgba(245,158,11,0.06)"):"transparent"}}>
                    {a.triggered?"TRIGGERED":a.active?"ACTIVE":"INACTIVE"}
                  </span>
                </div>
                <span style={{textAlign:"right",color:D.txtD,fontSize:"10px"}}>{a.triggeredAt||"—"}</span>
              </div>
            );})}
            <div style={{padding:"12px 14px",display:"flex",justifyContent:"flex-end"}}>
              <button style={{padding:"6px 14px",background:dark?"rgba(0,180,60,0.1)":"rgba(22,128,58,0.08)",border:`1px solid ${dark?"#1a4a2a":"#8acc8a"}`,borderRadius:"4px",color:D.accD,fontSize:"9px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>+ ADD ALERT</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Market ────────────────────────────────────────────────────────────────────
function Market({D,dark}){
  const [card,setCard]=useState(CARDS[0]);
  const [dbCards,setDbCards]=useState([]);
  const [asks,setAsks]=useState(()=>genOrders(BASE[1],6,"ask"));
  const [bids,setBids]=useState(()=>genOrders(BASE[1],6,"bid"));
  const [trades,setTrades]=useState(()=>Array.from({length:16},()=>genTrade(BASE[1])));
  const [price,setPrice]=useState(BASE[1]);
  const [flash,setFlash]=useState(null);
  const [oSide,setOSide]=useState("buy");
  const [oType,setOType]=useState("limit");
  const [oPrice,setOPrice]=useState("");
  const [oQty,setOQty]=useState("");
  const [oStatus,setOStatus]=useState(null);
  const [hist,setHist]=useState(()=>genHist(BASE[1]));
  const base=card.basePrice||BASE[card.id]||0;
  useEffect(()=>{
    async function fetchCards(){
      const {data,error}=await supabase.from('cards').select('*')
      if(error){ console.error('Supabase error:',error) }
      else {
        const formatted=data.map(c=>({
          id:c.id, name:c.name, set:c.set_name,
          condition:c.condition, rarity:c.rarity,
          game:c.game, img:c.img_url,
          basePrice:c.base_price
        }))
        setDbCards(formatted)
        setCard(formatted[0])
      }
    }
    fetchCards()
  },[])

  useEffect(()=>{setAsks(genOrders(base,6,"ask"));setBids(genOrders(base,6,"bid"));setPrice(base);setTrades(Array.from({length:16},()=>genTrade(base)));setHist(genHist(base));setOPrice("");setOQty("");},[card]);
  useEffect(()=>{
    const iv=setInterval(()=>{const t=genTrade(base);setFlash(t.price>price?"up":"down");setTimeout(()=>setFlash(null),400);setPrice(t.price);setTrades(p=>[t,...p.slice(0,19)]);setAsks(genOrders(t.price,6,"ask"));setBids(genOrders(t.price,6,"bid"));setHist(p=>[...p.slice(1),{p:t.price}]);},1800);
    return ()=>clearInterval(iv);
  },[base,price]);

  const spread=asks.length&&bids.length?+(asks[0].price-bids[0].price).toFixed(2):0;
  const pct=(((price-base)/base)*100).toFixed(2);
  const minP=Math.min(...hist.map(h=>h.p)),maxP=Math.max(...hist.map(h=>h.p)),rng=maxP-minP||1;
  const CW=560,CH=120;
  const lp=()=>hist.map((h,i)=>`${i===0?"M":"L"}${((i/(hist.length-1))*CW).toFixed(1)},${((CH-8)-((h.p-minP)/rng)*(CH-16)).toFixed(1)}`).join(" ");
  const submitOrder=()=>{if(!oQty||(oType==="limit"&&!oPrice))return;setOStatus({side:oSide,price:oType==="market"?price:+oPrice,qty:+oQty});setTimeout(()=>setOStatus(null),3000);setOPrice("");setOQty("");};
  const maxA=Math.max(...asks.map(a=>a.qty)),maxB=Math.max(...bids.map(b=>b.qty));

  return(
    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <div style={{width:"186px",flexShrink:0,borderRight:`1px solid ${D.bdr}`,background:D.bg2,display:"flex",flexDirection:"column",overflowY:"auto"}}>
        <div style={{padding:"8px 12px",borderBottom:`1px solid ${D.bdr}`,color:D.txtD,fontSize:"10px",letterSpacing:"0.12em"}}>▸ INSTRUMENTS</div>
        {(dbCards.length?dbCards:CARDS).map(c=>{const bp=c.basePrice||BASE[c.id];const chg=((Math.random()-0.45)*5).toFixed(2);const up=+chg>=0;const active=card.id===c.id;return(
          <div key={c.id} onClick={()=>setCard(c)} style={{padding:"9px 12px",borderBottom:`1px solid ${D.bdr}`,cursor:"pointer",background:active?(dark?"rgba(0,255,80,0.05)":"rgba(22,128,58,0.05)"):"transparent",borderLeft:active?`2px solid ${D.accD}`:"2px solid transparent",transition:"all 0.1s"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              <img src={c.img} alt={c.name} style={{width:"28px",height:"38px",objectFit:"cover",borderRadius:"3px",border:`1px solid ${D.bdr}`,flexShrink:0}} onError={e=>e.target.style.display="none"}/>
              <div><div style={{color:active?D.acc:D.txt,fontSize:"11px"}}>{c.name}</div><div style={{color:D.txtD,fontSize:"9px"}}>{c.set}</div><div style={{display:"flex",gap:"8px",marginTop:"2px"}}><span style={{color:D.txtM,fontSize:"10px"}}>${bp.toLocaleString()}</span><span style={{color:up?D.buyT:D.askT,fontSize:"9px"}}>{up?"▲":"▼"}{Math.abs(chg)}%</span></div></div>
            </div>
          </div>
        );})}
      </div>

      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:D.bg3,borderBottom:`1px solid ${D.bdr}`,padding:"8px 16px",display:"flex",alignItems:"center",gap:"18px",flexWrap:"wrap",flexShrink:0}}>
          <div><div style={{fontFamily:ORB,fontSize:"13px",fontWeight:700,color:D.txt,letterSpacing:"0.08em"}}>{card.name}</div><div style={{color:D.txtD,fontSize:"9px",marginTop:"1px"}}>{card.set} · {card.condition} · {card.rarity} · {card.game}</div></div>
          <div className={flash==="up"?"fu":flash==="down"?"fd":""} style={{display:"flex",alignItems:"baseline",gap:"6px",padding:"2px 8px",borderRadius:"3px"}}>
          <span style={{fontFamily:ORB,fontSize:"20px",fontWeight:800,color:flash==="up"?D.buyT:flash==="down"?D.askT:D.txt,transition:"color 0.25s"}}>${(price||0).toLocaleString("en-US",{minimumFractionDigits:2})}</span>            <span style={{color:+pct>=0?D.buyT:D.askT,fontSize:"11px"}}>{+pct>=0?"▲":"▼"}{Math.abs(pct)}%</span>
          </div>
          {[["SPREAD",`$${spread.toFixed(2)}`],["VOL 24H","47 cards"],["HIGH",`$${(base*1.02).toFixed(2)}`],["LOW",`$${(base*0.982).toFixed(2)}`]].map(([k,v])=>(
            <div key={k}><div style={{color:D.txtD,fontSize:"9px",letterSpacing:"0.1em"}}>{k}</div><div style={{color:D.txtM,fontSize:"11px",marginTop:"1px"}}>{v}</div></div>
          ))}
        </div>

        <div style={{flex:1,display:"flex",overflow:"hidden"}}>
          <div style={{width:"160px",flexShrink:0,borderRight:`1px solid ${D.bdr}`,background:D.bg2,display:"flex",flexDirection:"column",alignItems:"center",padding:"14px 10px",gap:"10px"}}>
            <div style={{width:"130px",borderRadius:"8px",overflow:"hidden",border:`1px solid ${D.bdr}`,boxShadow:dark?`0 0 20px ${D.accD}20,0 4px 16px rgba(0,0,0,0.5)`:"0 4px 16px rgba(0,0,0,0.1)",background:D.stBg,aspectRatio:"0.714",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <img src={card.img} alt={card.name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={e=>e.target.style.display="none"}/>
            </div>
            <div style={{width:"100%",background:D.stBg,border:`1px solid ${D.bdr}`,borderRadius:"4px",padding:"7px 9px"}}>
              {[["GAME",card.game],["SET",card.set],["COND.",card.condition],["RARITY",card.rarity]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:"3px"}}><span style={{color:D.txtD,fontSize:"9px"}}>{k}</span><span style={{color:D.txtM,fontSize:"9px"}}>{v}</span></div>
              ))}
            </div>
          </div>

          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{background:D.bg3,borderBottom:`1px solid ${D.bdr}`,padding:"10px 16px 8px",flexShrink:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                <span style={{color:D.txtD,fontSize:"10px",letterSpacing:"0.12em"}}>▸ PRICE CHART</span>
                <div style={{display:"flex",gap:"4px"}}>{["1H","6H","1D","1W","1M"].map(r=><button key={r} style={{padding:"2px 7px",border:`1px solid ${r==="1D"?D.accD:D.bdr}`,borderRadius:"3px",background:r==="1D"?(dark?"rgba(0,180,60,0.14)":"rgba(22,128,58,0.08)"):"transparent",color:r==="1D"?D.accD:D.txtD,fontSize:"9px",fontFamily:MONO,cursor:"pointer"}}>{r}</button>)}</div>
              </div>
              <svg width="100%" height={CH} viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" style={{display:"block"}}>
                <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={D.accD} stopOpacity={dark?"0.16":"0.10"}/><stop offset="100%" stopColor={D.accD} stopOpacity="0"/></linearGradient></defs>
                {[0.25,0.5,0.75].map(f=><line key={f} x1="0" y1={CH*f} x2={CW} y2={CH*f} stroke={D.bdr} strokeWidth="0.5"/>)}
                <path d={lp()+` L${CW},${CH} L0,${CH} Z`} fill="url(#cg)"/>
                <path d={lp()} fill="none" stroke={D.accD} strokeWidth="1.8" style={{filter:dark?`drop-shadow(0 0 4px ${D.accD}70)`:"none"}}/>
                <circle cx={CW} cy={(CH-8)-((price-minP)/rng)*(CH-16)} r="3" fill={D.accD}/>
              </svg>
            </div>

            <div style={{flex:1,display:"flex",overflow:"hidden"}}>
              {[["BIDS",bids,maxB,D.bidT,"bid"],["ASKS",asks,maxA,D.askT,"ask"]].map(([label,rows,mx,tc,side])=>(
                <div key={label} style={{flex:1,display:"flex",flexDirection:"column",borderRight:`1px solid ${D.bdr}`,overflow:"hidden"}}>
                  <div style={{padding:"5px 12px",borderBottom:`1px solid ${D.bdr}`,background:D.bg3,color:tc,fontSize:"10px",letterSpacing:"0.1em",flexShrink:0}}>▸ {label}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 46px 68px",padding:"3px 12px",color:D.txtD,fontSize:"9px",borderBottom:`1px solid ${D.bdr}`,background:D.bg3,flexShrink:0}}><span>PRICE</span><span style={{textAlign:"right"}}>QTY</span><span style={{textAlign:"right"}}>TOTAL</span></div>
                  <div style={{flex:1,overflowY:"auto",background:D.bg2}}>
                    {rows.map((r,i)=>(
                      <div key={i} onClick={()=>setOPrice(r.price.toString())} style={{display:"grid",gridTemplateColumns:"1fr 46px 68px",padding:"4px 12px",borderBottom:`1px solid ${D.bdr}`,position:"relative",cursor:"pointer"}}>
                        <div style={{position:"absolute",[side==="bid"?"left":"right"]:0,top:0,bottom:0,width:`${(r.qty/mx)*100}%`,background:side==="bid"?(dark?"rgba(0,180,60,0.07)":"rgba(22,128,58,0.06)"):(dark?"rgba(180,40,40,0.08)":"rgba(180,30,30,0.06)")}}/>
                        <span style={{color:tc,fontSize:"11px",zIndex:1}}>${r.price.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                        <span style={{textAlign:"right",color:D.txtM,fontSize:"11px",zIndex:1}}>{r.qty}</span>
                        <span style={{textAlign:"right",color:D.txtD,fontSize:"10px",zIndex:1}}>${r.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                <div style={{padding:"5px 12px",borderBottom:`1px solid ${D.bdr}`,background:D.bg3,color:D.txtD,fontSize:"10px",letterSpacing:"0.1em",display:"flex",justifyContent:"space-between",flexShrink:0}}><span>▸ TRADES</span><span style={{color:D.buyT,fontSize:"9px"}}>● LIVE</span></div>
                <div style={{display:"grid",gridTemplateColumns:"62px 1fr 36px",padding:"3px 12px",color:D.txtD,fontSize:"9px",borderBottom:`1px solid ${D.bdr}`,background:D.bg3,flexShrink:0}}><span>TIME</span><span>PRICE</span><span style={{textAlign:"right"}}>QTY</span></div>
                <div style={{flex:1,overflowY:"auto",background:D.bg2}}>
                  {trades.map(t=>(
                    <div key={t.id} style={{display:"grid",gridTemplateColumns:"62px 1fr 36px",padding:"4px 12px",borderBottom:`1px solid ${D.bdr}`}}>
                      <span style={{color:D.txtD,fontSize:"10px"}}>{t.time}</span>
                      <span style={{color:t.side==="buy"?D.buyT:D.askT,fontSize:"11px"}}>${t.price.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                      <span style={{textAlign:"right",color:D.txtM,fontSize:"10px"}}>{t.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{width:"220px",borderLeft:`1px solid ${D.bdr}`,background:D.bg2,flexShrink:0,overflowY:"auto"}}>
            <div style={{padding:"8px 14px",borderBottom:`1px solid ${D.bdr}`,color:D.txtD,fontSize:"10px",letterSpacing:"0.12em"}}>▸ PLACE ORDER</div>
            <div style={{padding:"14px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",border:`1px solid ${D.bdr}`,borderRadius:"5px",overflow:"hidden",marginBottom:"14px"}}>
                {["buy","sell"].map(s=><button key={s} onClick={()=>setOSide(s)} style={{padding:"9px",border:"none",cursor:"pointer",fontFamily:MONO,fontSize:"11px",letterSpacing:"0.1em",background:oSide===s?(s==="buy"?(dark?"rgba(0,180,60,0.18)":"rgba(22,128,58,0.12)"):(dark?"rgba(180,30,30,0.18)":"rgba(180,30,30,0.10)")):"transparent",color:oSide===s?(s==="buy"?D.buyT:D.askT):D.txtD,borderBottom:`2px solid ${oSide===s?(s==="buy"?D.buyT:D.askT):"transparent"}`,transition:"all 0.14s"}}>{s.toUpperCase()}</button>)}
              </div>
              <div style={{marginBottom:"12px"}}>
                <div style={{color:D.txtD,fontSize:"9px",letterSpacing:"0.1em",marginBottom:"5px"}}>ORDER TYPE</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px"}}>
                  {["limit","market"].map(t=><button key={t} onClick={()=>setOType(t)} style={{padding:"5px",border:`1px solid ${oType===t?D.accD:D.bdr}`,borderRadius:"4px",background:oType===t?(dark?"rgba(0,100,30,0.15)":"rgba(22,128,58,0.08)"):"transparent",color:oType===t?D.accD:D.txtD,fontSize:"10px",fontFamily:MONO,cursor:"pointer"}}>{t.toUpperCase()}</button>)}
                </div>
              </div>
              {oType==="limit"&&<div style={{marginBottom:"10px"}}><div style={{color:D.txtD,fontSize:"9px",marginBottom:"4px"}}>PRICE (USD)</div><input type="number" value={oPrice} onChange={e=>setOPrice(e.target.value)} placeholder={price.toFixed(2)} style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"4px",padding:"7px 10px",color:D.txt,fontSize:"12px"}}/></div>}
              <div style={{marginBottom:"10px"}}><div style={{color:D.txtD,fontSize:"9px",marginBottom:"4px"}}>QUANTITY</div><input type="number" value={oQty} onChange={e=>setOQty(e.target.value)} placeholder="0" style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"4px",padding:"7px 10px",color:D.txt,fontSize:"12px"}}/></div>
              <div style={{background:D.stBg,border:`1px solid ${D.bdr}`,borderRadius:"4px",padding:"8px 10px",marginBottom:"14px",display:"flex",justifyContent:"space-between"}}><span style={{color:D.txtD,fontSize:"9px"}}>TOTAL</span><span style={{color:D.txtM,fontSize:"13px"}}>${((oType==="market"?price:+oPrice||0)*(+oQty||0)).toLocaleString("en-US",{minimumFractionDigits:2})}</span></div>
              <button onClick={submitOrder} style={{width:"100%",padding:"10px",border:`1px solid ${oSide==="buy"?(dark?"#1a5a2a":"#7ab07a"):(dark?"#5a1a1a":"#c07070")}`,borderRadius:"5px",fontSize:"11px",fontFamily:MONO,letterSpacing:"0.1em",fontWeight:"bold",background:oSide==="buy"?(dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#cceacc,#a8d8a8)"):(dark?"linear-gradient(135deg,#3a0a0a,#5a1010)":"linear-gradient(135deg,#eacccc,#d8a8a8)"),color:oSide==="buy"?(dark?"#00ff55":"#1a5a2a"):(dark?"#ff5555":"#9a1a1a"),cursor:"pointer"}}>
                {oSide==="buy"?"▲ BUY":"▼ SELL"} {card.name.split(" ")[0].toUpperCase()}
              </button>
              {oStatus&&<div style={{marginTop:"10px",padding:"8px 10px",background:dark?"rgba(0,180,60,0.08)":"rgba(22,128,58,0.08)",border:`1px solid ${dark?"#1a4a1a":"#8acc8a"}`,borderRadius:"4px",fontSize:"10px",color:D.accD,lineHeight:"1.8"}}>✓ ORDER PLACED<br/><span style={{color:D.txtM}}>{oStatus.side.toUpperCase()} {oStatus.qty}x @ ${oStatus.price.toFixed(2)}</span></div>}
              <div style={{marginTop:"16px",paddingTop:"12px",borderTop:`1px solid ${D.bdr}`}}>
                {[["BEST ASK",`$${asks[0]?.price.toFixed(2)}`],["BEST BID",`$${bids[0]?.price.toFixed(2)}`],["LAST TRADE",`$${price.toFixed(2)}`],["SPREAD",`$${spread.toFixed(2)}`]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}><span style={{color:D.txtD,fontSize:"9px"}}>{k}</span><span style={{color:D.txtM,fontSize:"10px"}}>{v}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App(){
  const [dark,setDark]=useState(true);
  const [tab,setTab]=useState("MARKET");
  const D=dark?DK:LT;

  return(
    <div style={{fontFamily:MONO,background:D.bg,color:D.txt,minHeight:"100vh",fontSize:"12px",transition:"background 0.3s,color 0.3s",display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@600;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;} ::-webkit-scrollbar-track{background:${D.bg};} ::-webkit-scrollbar-thumb{background:${D.bdr2};border-radius:2px;}
        input{outline:none;font-family:${MONO};} input:focus{border-color:${D.accD}!important;}
        button{cursor:pointer;}
        @keyframes fG{0%,100%{background:transparent}50%{background:rgba(0,200,60,0.14)}}
        @keyframes fR{0%,100%{background:transparent}50%{background:rgba(220,50,50,0.14)}}
        .fu{animation:fG 0.4s ease;} .fd{animation:fR 0.4s ease;}
      `}</style>

      <div style={{background:D.hdrBg,borderBottom:`1px solid ${D.bdr2}`,padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:"44px",position:"sticky",top:0,zIndex:100,boxShadow:D.shad,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <div style={{display:"flex",alignItems:"baseline",gap:"8px"}}>
            <span style={{fontFamily:ORB,fontSize:"16px",fontWeight:800,color:D.acc,letterSpacing:"0.18em",textShadow:dark?"0 0 22px rgba(0,255,80,0.45)":"none"}}>◈ CX</span>
            <span style={{fontFamily:ORB,fontSize:"11px",fontWeight:600,color:D.txtM,letterSpacing:"0.08em"}}>COLLECTOR'S EXCHANGE</span>
          </div>
          <span style={{color:D.bdr2}}>|</span>
          <span style={{color:D.txtD,fontSize:"9px",letterSpacing:"0.14em",fontStyle:"italic"}}>Buy. Sell. Collect.</span>
        </div>
        <div style={{display:"flex",gap:"2px",alignItems:"center"}}>
          {["MARKET","PORTFOLIO","ORDERS","HISTORY"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:"0 16px",height:"44px",border:"none",background:"transparent",color:tab===t?D.accD:D.txtD,fontSize:"10px",fontFamily:MONO,letterSpacing:"0.12em",borderBottom:`2px solid ${tab===t?D.accD:"transparent"}`,transition:"all 0.12s",cursor:"pointer"}}>{t}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
          <div style={{background:D.stBg,border:`1px solid ${D.bdr}`,borderRadius:"3px",padding:"3px 10px",fontSize:"11px",color:D.txtM}}>Ξ 12,440.00</div>
          <div onClick={()=>setDark(d=>!d)} style={{width:"44px",height:"24px",background:dark?"#1a3a1a":"#d1ecd1",borderRadius:"12px",border:`1px solid ${D.bdr2}`,display:"flex",alignItems:"center",padding:"3px",transition:"background 0.3s",cursor:"pointer"}}>
            <div style={{width:"16px",height:"16px",borderRadius:"50%",background:dark?"#00cc40":"#f59e0b",transform:dark?"translateX(0)":"translateX(20px)",transition:"transform 0.3s,background 0.3s",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px"}}>{dark?"🌙":"☀️"}</div>
          </div>
        </div>
      </div>

      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {tab==="MARKET"    && <Market    D={D} dark={dark}/>}
        {tab==="PORTFOLIO" && <Portfolio D={D} dark={dark}/>}
        {tab==="ORDERS"    && <Orders    D={D} dark={dark}/>}
        {tab==="HISTORY"   && <History   D={D} dark={dark}/>}
      </div>
    </div>
  );
}