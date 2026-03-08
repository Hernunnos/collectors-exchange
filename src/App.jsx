import { useState, useEffect, useMemo } from "react";

// ── Data ─────────────────────────────────────────────────────────────────────
const CARDS = [
  { id:1, name:"Charizard",          set:"Base Set",  condition:"PSA 10", rarity:"Holo Rare", game:"Pokémon", img:"https://images.pokemontcg.io/base1/4_hires.png" },
  { id:2, name:"Black Lotus",         set:"Alpha",     condition:"NM",     rarity:"Rare",      game:"MTG",     img:"https://cards.scryfall.io/large/front/b/d/bd8fa327-dd41-4737-8f19-2cf5eb1f7cdd.jpg" },
  { id:3, name:"Pikachu Illustrator", set:"CoroCoro",  condition:"PSA 9",  rarity:"Promo",     game:"Pokémon", img:"https://images.pokemontcg.io/basep/1_hires.png" },
  { id:4, name:"Blastoise",           set:"Base Set",  condition:"PSA 8",  rarity:"Holo Rare", game:"Pokémon", img:"https://images.pokemontcg.io/base1/2_hires.png" },
  { id:5, name:"Mewtwo",              set:"Base Set",  condition:"PSA 9",  rarity:"Holo Rare", game:"Pokémon", img:"https://images.pokemontcg.io/base1/10_hires.png" },
];
const BASE = { 1:420, 2:8500, 3:74000, 4:280, 5:310 };

// ── Trading state helpers ─────────────────────────────────────────────────────
const STARTING_BALANCE = 15000;
let _orderId = 1000;
let _tradeId = 1000;
const newOrderId  = () => `ORD-${++_orderId}`;
const newTradeId  = () => `TRD-${++_tradeId}`;
const nowDate = () => new Date().toISOString().slice(0,10);
const nowTime = () => new Date().toLocaleTimeString("en-US",{hour12:false});

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
        if(idx<0 || newHoldings[idx].qty < fillQty) continue; // not enough cards
        newBalance = +(newBalance + total).toFixed(2);
        const h = newHoldings[idx];
        const newQty = h.qty - fillQty;
        if(newQty === 0) newHoldings.splice(idx,1);
        else newHoldings[idx] = {...h, qty:newQty};
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
function Portfolio({D,dark,holdings=[],tradeHistory=[],dbCards=[]}){
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
          {enrichedHoldings.length===0?(<div style={{padding:"40px",textAlign:"center",color:D.txtD,fontSize:"12px"}}>No holdings yet — place your first trade in the Market tab</div>):enrichedHoldings.map(h=>(
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
          ){"}"}{selected && (
            <div style={{borderTop:`1px solid ${D.bdr}`,padding:"10px 14px"}}>
              <div style={{color:D.txtD,fontSize:"9px",letterSpacing:"0.1em",marginBottom:"8px"}}>▸ TRADES — {selected.card.name}</div>
              {tradeHistory.filter(t=>t.cardId===selected.cardId).map(t=>(
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
                <span style={{textAlign:"right",color:D.txt,fontSize:"11px"}}>${(c.basePrice||BASE[c.id]||0).toLocaleString()}</span>
                <span style={{textAlign:"right",color:up?D.buyT:D.askT,fontSize:"11px"}}>{up?"+":""}{chg}%</span>
                <span onClick={()=>setWatchlist(w=>w.filter(x=>x.id!==c.id))} style={{textAlign:"right",color:D.txtD,fontSize:"16px",cursor:"pointer",lineHeight:1}}>×</span>
              </div>
            );
          })}
          {CARDS.filter(c=>!watchlist.find(w=>w.id===c.id)&&!holdings.find(h=>h.cardId===c.id)).slice(0,2).map(c=>(
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
function Orders({D,dark,orders=[],onCancel,dbCards=[]}){
  const [filter,setFilter]=useState("all");
  const allCards=[...dbCards,...CARDS];
  const cancel=id=>{ if(onCancel) onCancel(id); };
  const filtered=filter==="all"?orders:orders.filter(o=>o.status===filter);
  const sColor=s=>s==="open"?D.buyT:s==="partial"?"#f59e0b":D.txtD;
  const sBg=s=>s==="open"?(dark?"rgba(0,200,60,0.08)":"rgba(22,128,58,0.08)"):s==="partial"?(dark?"rgba(245,158,11,0.08)":"rgba(245,158,11,0.06)"):dark?"rgba(80,80,80,0.08)":"rgba(80,80,80,0.04)";

  return(
    <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:"16px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px"}}>
        {[["OPEN",orders.filter(o=>o.status==="open").length],["PARTIAL",orders.filter(o=>o.status==="partial").length],["FILLED",orders.filter(o=>o.status==="filled").length],["TOTAL",orders.length]].map(([label,val])=>(
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
        {filtered.length===0&&<div style={{padding:"40px",textAlign:"center",color:D.txtD,fontSize:"11px"}}>{filter==="all"?"No orders yet — place your first trade in the Market tab":`No ${filter} orders`}</div>}
        {filtered.map(o=>{
          const card=allCards.find(c=>c.id===o.cardId)||{name:"Unknown",img:"",img_url:""};
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
function History({D,dark,tradeHistory=[],ledger=[],dbCards=[]}){
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
            {tradeHistory.length===0?(<div style={{padding:"40px",textAlign:"center",color:D.txtD,fontSize:"12px"}}>No trades yet</div>):tradeHistory.map(t=>{const card=allCards.find(c=>c.id===t.cardId)||{name:"Unknown",img:"",img_url:""};return(
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
            {ledger.map(l=>(
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
              <span style={{color:D.buyT,fontSize:"13px",fontFamily:ORB}}>${ledger.reduce((s,l)=>l.type==="deposit"?s+l.amount:s-l.amount,0).toLocaleString("en-US",{minimumFractionDigits:2})}</span>
            </div>
          </>
        )}

        {tab==="alerts"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"90px 1fr 90px 80px 90px 130px",padding:"6px 14px",color:D.txtD,fontSize:"9px",borderBottom:`1px solid ${D.bdr}`,letterSpacing:"0.08em"}}>
              <span>ID</span><span>CARD</span><span>CONDITION</span><span style={{textAlign:"right"}}>TARGET</span><span style={{textAlign:"right"}}>STATUS</span><span style={{textAlign:"right"}}>TRIGGERED AT</span>
            </div>
            {SAMPLE_ALERTS.map(a=>{const card=allCards.find(c=>c.id===a.cardId)||{name:"Unknown",img:""};return(
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

// ── Browser ───────────────────────────────────────────────────────────────────
const PAGE_SIZE=40;
function Browser({D,dark,dbCards,onSelectCard}){
  const [search,setSearch]=useState("");
  const [gameFilter,setGameFilter]=useState("all");
  const [condFilter,setCondFilter]=useState("all");
  const [langFilter,setLangFilter]=useState("all");
  const [sort,setSort]=useState("price-desc");
  const [page,setPage]=useState(1);

  const allCards=dbCards.length?dbCards:CARDS.map(c=>({...c,basePrice:BASE[c.id],set_name:c.set,language:"English"}));
  const games=[...new Set(allCards.map(c=>c.game))].filter(Boolean).sort();
  const conditions=[...new Set(allCards.map(c=>c.condition))].filter(Boolean).sort();
  const languages=[...new Set(allCards.map(c=>c.language||"English"))].filter(Boolean).sort();

  const filtered=allCards
    .filter(c=>search===""||c.name.toLowerCase().includes(search.toLowerCase()))
    .filter(c=>gameFilter==="all"||c.game===gameFilter)
    .filter(c=>condFilter==="all"||c.condition===condFilter)
    .filter(c=>langFilter==="all"||(c.language||"English")===langFilter)
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
    color:active?D.accD:D.txtD,fontSize:"10px",fontFamily:MONO,cursor:"pointer",transition:"all 0.1s",whiteSpace:"nowrap"
  });

  const pgBtn=(label,onClick,disabled)=>(
    <button onClick={onClick} disabled={disabled} style={{padding:"5px 10px",border:`1px solid ${D.bdr}`,borderRadius:"4px",background:"transparent",color:disabled?D.txtD:D.accD,fontSize:"10px",fontFamily:MONO,cursor:disabled?"default":"pointer",opacity:disabled?0.4:1}}>{label}</button>
  );

  const pageNums=[];
  const start=Math.max(1,page-3),end=Math.min(totalPages,page+3);
  for(let i=start;i<=end;i++) pageNums.push(i);

  const Pagination=()=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"8px"}}>
      <span style={{color:D.txtD,fontSize:"9px",letterSpacing:"0.1em"}}>{filtered.length.toLocaleString()} CARDS · PAGE {page} OF {totalPages.toLocaleString()}</span>
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
          style={{flex:"1 1 180px",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"4px",padding:"7px 12px",color:D.txt,fontSize:"12px",fontFamily:MONO,minWidth:"140px"}}/>
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center"}}>
          <span style={{color:D.txtD,fontSize:"9px",letterSpacing:"0.1em"}}>GAME</span>
          {["all",...games].map(g=><button key={g} onClick={()=>{setGameFilter(g);resetPage();}} style={inBtnStyle(gameFilter===g)}>{g==="all"?"ALL":g}</button>)}
        </div>
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center"}}>
          <span style={{color:D.txtD,fontSize:"9px",letterSpacing:"0.1em"}}>CONDITION</span>
          {["all",...conditions].map(c=><button key={c} onClick={()=>{setCondFilter(c);resetPage();}} style={inBtnStyle(condFilter===c)}>{c==="all"?"ALL":c}</button>)}
        </div>
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center"}}>
          <span style={{color:D.txtD,fontSize:"9px",letterSpacing:"0.1em"}}>LANGUAGE</span>
          {["all",...languages].map(l=><button key={l} onClick={()=>{setLangFilter(l);resetPage();}} style={inBtnStyle(langFilter===l)}>{l==="all"?"ALL":l}</button>)}
        </div>
        <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
          <span style={{color:D.txtD,fontSize:"9px",letterSpacing:"0.1em"}}>SORT</span>
          <select value={sort} onChange={e=>{setSort(e.target.value);resetPage();}} style={{background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"4px",padding:"6px 10px",color:D.txt,fontSize:"10px",fontFamily:MONO,cursor:"pointer"}}>
            <option value="price-desc">Price: High to Low</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="name-asc">Name: A to Z</option>
          </select>
        </div>
      </div>

      <Pagination/>

      {filtered.length===0&&(
        <div style={{padding:"60px",textAlign:"center",color:D.txtD,fontSize:"12px",background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"6px"}}>No cards match your filters</div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:"14px"}}>
        {paginated.map(c=>{
          const bp=c.basePrice||BASE[c.id]||0;
          const chg=((Math.random()-0.45)*5).toFixed(2);const up=+chg>=0;
          return(
            <div key={c.id} onClick={()=>onSelectCard(c)} style={{background:D.bg2,border:`1px solid ${D.bdr}`,borderRadius:"8px",overflow:"hidden",cursor:"pointer",transition:"border-color 0.15s,box-shadow 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=D.accD;e.currentTarget.style.boxShadow=dark?`0 0 16px ${D.accD}30`:"0 4px 16px rgba(0,0,0,0.1)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=D.bdr;e.currentTarget.style.boxShadow="none";}}>
              <div style={{background:D.stBg,display:"flex",justifyContent:"center",alignItems:"center",padding:"16px",aspectRatio:"1"}}>
                <img src={c.img||c.img_url} alt={c.name} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",borderRadius:"4px",boxShadow:dark?"0 4px 16px rgba(0,0,0,0.6)":"0 4px 12px rgba(0,0,0,0.15)"}} onError={e=>e.target.style.display="none"}/>
              </div>
              <div style={{padding:"10px 12px"}}>
                <div style={{fontFamily:ORB,fontSize:"11px",fontWeight:700,color:D.txt,marginBottom:"3px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</div>
                <div style={{color:D.txtD,fontSize:"9px",marginBottom:"8px"}}>{c.set||c.set_name} · {c.condition}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                  <span style={{fontFamily:ORB,fontSize:"13px",fontWeight:700,color:D.accD}}>${bp.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                  <span style={{color:up?D.buyT:D.askT,fontSize:"9px"}}>{up?"▲":"▼"}{Math.abs(chg)}%</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:"6px"}}>
                  <span style={{background:dark?"rgba(0,180,60,0.08)":"rgba(22,128,58,0.06)",color:D.txtM,fontSize:"8px",padding:"2px 6px",borderRadius:"3px"}}>{c.game}</span>
                  <span style={{color:D.txtD,fontSize:"8px"}}>{c.language||"English"}</span>
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
function Market({D,dark,dbCards=[],initialCard=null,balance=0,onPlaceOrder,onUpdatePrice,tradeHistory=[],isDemo=false}){
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
  const [oType,setOType]=useState("limit");
  const [oPrice,setOPrice]=useState("");
  const [oQty,setOQty]=useState("");
  const [oStatus,setOStatus]=useState(null);
  const base=card.basePrice||BASE[card.id]||0;
  useEffect(()=>{ if(initialCard) setCard(initialCard); },[initialCard]);

  useEffect(()=>{setAsks(genOrders(base,6,"ask"));setBids(genOrders(base,6,"bid"));setPrice(base);setTrades(Array.from({length:16},()=>genTrade(base)));setOPrice("");setOQty("");},[card]);
  useEffect(()=>{
    const iv=setInterval(()=>{const t=genTrade(base);setFlash(t.price>price?"up":"down");setTimeout(()=>setFlash(null),400);setPrice(t.price);if(onUpdatePrice&&card.id) onUpdatePrice(card.id,t.price);setTrades(p=>[t,...p.slice(0,19)]);setAsks(genOrders(t.price,6,"ask"));setBids(genOrders(t.price,6,"bid"));if(isDemo) setDemoHist(p=>[...p.slice(1),{p:t.price}]);},1800);
    return ()=>clearInterval(iv);
  },[base,price]);

  // Demo mode: use animated genHist; logged-in: use real trade history
  const [demoHist,setDemoHist]=useState(()=>genHist(base));
  useEffect(()=>{ if(isDemo) setDemoHist(genHist(base)); },[card,isDemo]);

  const cardTrades=tradeHistory.filter(t=>t.cardId===card.id);
  const realHist=cardTrades.map(t=>({p:t.price,time:t.time,date:t.date})).reverse();
  const hist=isDemo?demoHist:realHist;
  const hasHistory=isDemo?true:realHist.length>=2;

  const spread=asks.length&&bids.length?+(asks[0].price-bids[0].price).toFixed(2):0;
  const pct=(((price-base)/base)*100).toFixed(2);
  const minP=hasHistory?Math.min(...hist.map(h=>h.p)):0;
  const maxP=hasHistory?Math.max(...hist.map(h=>h.p)):0;
  const rng=maxP-minP||1;
  const CW=560,CH=200;
  const lp=()=>hist.map((h,i)=>`${i===0?"M":"L"}${((i/(hist.length-1))*CW).toFixed(1)},${((CH-8)-((h.p-minP)/rng)*(CH-16)).toFixed(1)}`).join(" ");
  const submitOrder=()=>{
    if(!oQty||(oType==="limit"&&!oPrice)) return;
    const orderPrice=oType==="market"?price:+oPrice;
    const orderQty=+oQty;
    if(oSide==="buy"&&orderPrice*orderQty>balance){ setOStatus({error:"Insufficient funds"}); setTimeout(()=>setOStatus(null),3000); return; }
    if(onPlaceOrder) onPlaceOrder({cardId:card.id,side:oSide,type:oType,price:orderPrice,qty:orderQty});
    setOStatus({side:oSide,price:orderPrice,qty:orderQty});
    setTimeout(()=>setOStatus(null),3000);
    setOPrice(""); setOQty("");
  };
  const maxA=Math.max(...asks.map(a=>a.qty)),maxB=Math.max(...bids.map(b=>b.qty));

  return(
    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <div style={{width:"220px",flexShrink:0,borderRight:`1px solid ${D.bdr}`,background:D.bg2,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${D.bdr}`,flexShrink:0}}>
          <div style={{color:D.txtD,fontSize:"11px",letterSpacing:"0.12em",marginBottom:"8px"}}>▸ INSTRUMENTS</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px"}}>
            {["value","volume"].map(m=>(
              <button key={m} onClick={()=>setSidebarMode(m)} style={{padding:"5px 0",border:`1px solid ${sidebarMode===m?D.accD:D.bdr}`,borderRadius:"3px",background:sidebarMode===m?(dark?"rgba(0,180,60,0.12)":"rgba(22,128,58,0.08)"):"transparent",color:sidebarMode===m?D.accD:D.txtD,fontSize:"10px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.06em"}}>
                {m==="value"?"TOP VALUE":"TOP VOL"}
              </button>
            ))}
          </div>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
        {sidebarCards.map(c=>{const bp=c.basePrice||BASE[c.id]||0;const chg=((Math.random()-0.45)*5).toFixed(2);const up=+chg>=0;const active=card.id===c.id;return(
          <div key={c.id} onClick={()=>setCard(c)} style={{padding:"12px 14px",borderBottom:`1px solid ${D.bdr}`,cursor:"pointer",background:active?(dark?"rgba(0,255,80,0.05)":"rgba(22,128,58,0.05)"):"transparent",borderLeft:active?`3px solid ${D.accD}`:"3px solid transparent",transition:"all 0.1s"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <img src={c.img||c.img_url} alt={c.name} style={{width:"38px",height:"52px",objectFit:"cover",borderRadius:"4px",border:`1px solid ${D.bdr}`,flexShrink:0}} onError={e=>e.target.style.display="none"}/>
              <div style={{minWidth:0}}>
                <div style={{color:active?D.acc:D.txt,fontSize:"12px",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</div>
                <div style={{color:D.txtD,fontSize:"10px",marginTop:"2px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.set||c.set_name}</div>
                <div style={{display:"flex",gap:"8px",marginTop:"4px"}}>
                  <span style={{color:D.txtM,fontSize:"11px",fontWeight:600}}>${bp.toLocaleString()}</span>
                  <span style={{color:up?D.buyT:D.askT,fontSize:"10px"}}>{up?"▲":"▼"}{Math.abs(chg)}%</span>
                </div>
              </div>
            </div>
          </div>
        );})}
        </div>
      </div>

      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:D.bg3,borderBottom:`1px solid ${D.bdr}`,padding:"8px 16px",display:"flex",alignItems:"center",gap:"18px",flexWrap:"wrap",flexShrink:0}}>
          <div><div style={{fontFamily:ORB,fontSize:"16px",fontWeight:700,color:D.txt,letterSpacing:"0.08em"}}>{card.name}</div><div style={{color:D.txtD,fontSize:"11px",marginTop:"3px"}}>{card.set||card.set_name} · {card.condition} · {card.rarity} · {card.game}</div></div>
          <div className={flash==="up"?"fu":flash==="down"?"fd":""} style={{display:"flex",alignItems:"baseline",gap:"8px",padding:"3px 10px",borderRadius:"3px"}}>
            <span style={{fontFamily:ORB,fontSize:"26px",fontWeight:800,color:flash==="up"?D.buyT:flash==="down"?D.askT:D.txt,transition:"color 0.25s"}}>${(price||0).toLocaleString("en-US",{minimumFractionDigits:2})}</span>
            <span style={{color:+pct>=0?D.buyT:D.askT,fontSize:"13px"}}>{+pct>=0?"▲":"▼"}{Math.abs(pct)}%</span>
          </div>
          {[["SPREAD",`$${spread.toFixed(2)}`],["VOL 24H","47 cards"],["HIGH",`$${((base||0)*1.02).toFixed(2)}`],["LOW",`$${((base||0)*0.982).toFixed(2)}`]].map(([k,v])=>(
            <div key={k}><div style={{color:D.txtD,fontSize:"10px",letterSpacing:"0.1em"}}>{k}</div><div style={{color:D.txtM,fontSize:"12px",marginTop:"2px"}}>{v}</div></div>
          ))}
        </div>

        <div style={{flex:1,display:"flex",overflow:"hidden"}}>
          <div style={{width:"200px",flexShrink:0,borderRight:`1px solid ${D.bdr}`,background:D.bg2,display:"flex",flexDirection:"column",alignItems:"center",padding:"18px 14px",gap:"14px",overflowY:"auto"}}>
            <div style={{width:"168px",borderRadius:"10px",overflow:"hidden",border:`1px solid ${D.bdr}`,boxShadow:dark?`0 0 24px ${D.accD}25,0 6px 20px rgba(0,0,0,0.5)`:"0 6px 20px rgba(0,0,0,0.12)",background:D.stBg,aspectRatio:"0.714",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <img src={card.img||card.img_url} alt={card.name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={e=>e.target.style.display="none"}/>
            </div>
            <div style={{width:"100%",background:D.stBg,border:`1px solid ${D.bdr}`,borderRadius:"6px",padding:"10px 12px"}}>
              {[["GAME",card.game],["SET",card.set||card.set_name],["COND.",card.condition],["RARITY",card.rarity]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:"6px",alignItems:"flex-start",gap:"8px"}}>
                  <span style={{color:D.txtD,fontSize:"10px",flexShrink:0}}>{k}</span>
                  <span style={{color:D.txtM,fontSize:"10px",textAlign:"right"}}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{background:D.bg3,borderBottom:`1px solid ${D.bdr}`,padding:"10px 16px 8px",flexShrink:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                <span style={{color:D.txtD,fontSize:"10px",letterSpacing:"0.12em"}}>▸ PRICE CHART</span>
                <div style={{display:"flex",gap:"4px"}}>{["1H","6H","1D","1W","1M"].map(r=><button key={r} style={{padding:"2px 7px",border:`1px solid ${r==="1D"?D.accD:D.bdr}`,borderRadius:"3px",background:r==="1D"?(dark?"rgba(0,180,60,0.14)":"rgba(22,128,58,0.08)"):"transparent",color:r==="1D"?D.accD:D.txtD,fontSize:"9px",fontFamily:MONO,cursor:"pointer"}}>{r}</button>)}</div>
              </div>
              {!hasHistory?(
                <div style={{height:CH,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"8px",opacity:0.4}}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={D.txtD} strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  <span style={{color:D.txtD,fontSize:"10px",letterSpacing:"0.12em"}}>NO TRADE HISTORY YET</span>
                  <span style={{color:D.txtD,fontSize:"9px"}}>Place a trade to start recording price history</span>
                </div>
              ):(
                <svg width="100%" height={CH} viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" style={{display:"block"}}>
                  <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={D.accD} stopOpacity={dark?"0.16":"0.10"}/><stop offset="100%" stopColor={D.accD} stopOpacity="0"/></linearGradient></defs>
                  {[0.25,0.5,0.75].map(f=><line key={f} x1="0" y1={CH*f} x2={CW} y2={CH*f} stroke={D.bdr} strokeWidth="0.5"/>)}
                  <path d={lp()+` L${CW},${CH} L0,${CH} Z`} fill="url(#cg)"/>
                  <path d={lp()} fill="none" stroke={D.accD} strokeWidth="1.8" style={{filter:dark?`drop-shadow(0 0 4px ${D.accD}70)`:"none"}}/>
                  <circle cx={CW} cy={(CH-8)-((price-minP)/rng)*(CH-16)} r="3" fill={D.accD}/>
                  {hist.map((h,i)=>{
                    if(i===0) return null;
                    const x=((i/(hist.length-1))*CW).toFixed(1);
                    const y=((CH-8)-((h.p-minP)/rng)*(CH-16)).toFixed(1);
                    return <circle key={i} cx={x} cy={y} r="2" fill={D.accD} opacity="0.5"/>;
                  })}
                </svg>
              )}
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
                        <span style={{color:tc,fontSize:"12px",zIndex:1}}>${r.price.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                        <span style={{textAlign:"right",color:D.txtM,fontSize:"12px",zIndex:1}}>{r.qty}</span>
                        <span style={{textAlign:"right",color:D.txtD,fontSize:"11px",zIndex:1}}>${r.total.toLocaleString()}</span>
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
                      <span style={{color:D.txtD,fontSize:"11px"}}>{t.time}</span>
                      <span style={{color:t.side==="buy"?D.buyT:D.askT,fontSize:"12px"}}>${t.price.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                      <span style={{textAlign:"right",color:D.txtM,fontSize:"11px"}}>{t.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{width:"220px",borderLeft:`1px solid ${D.bdr}`,background:D.bg2,flexShrink:0,overflowY:"auto"}}>
            <div style={{padding:"8px 14px",borderBottom:`1px solid ${D.bdr}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:D.txtD,fontSize:"10px",letterSpacing:"0.12em"}}>▸ PLACE ORDER</span>
              <span style={{color:D.txtM,fontSize:"10px"}}>💵 ${balance.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
            </div>
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
              {oStatus&&<div style={{marginTop:"10px",padding:"8px 10px",background:oStatus.error?(dark?"rgba(180,30,30,0.08)":"rgba(220,50,50,0.06)"):(dark?"rgba(0,180,60,0.08)":"rgba(22,128,58,0.08)"),border:`1px solid ${oStatus.error?(dark?"#5a1a1a":"#e07070"):(dark?"#1a4a1a":"#8acc8a")}`,borderRadius:"4px",fontSize:"10px",color:oStatus.error?D.askT:D.accD,lineHeight:"1.8"}}>{oStatus.error?`⚠ ${oStatus.error}`:<>✓ ORDER PLACED<br/><span style={{color:D.txtM}}>{oStatus.side?.toUpperCase()} {oStatus.qty}x @ ${oStatus.price?.toFixed(2)}</span></>}</div>}
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

// ── Auth Modal ────────────────────────────────────────────────────────────────
function AuthModal({D,dark,onClose,onAuth}){
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [name,setName]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

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
        const {data,error:e}=await supabase.auth.signInWithPassword({email,password});
        if(e) throw e;
        onAuth(data.user);
      }
    } catch(e){ setError(e.message||"Something went wrong"); }
    setLoading(false);
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{background:D.bg2,border:`1px solid ${D.bdr2}`,borderRadius:"12px",padding:"32px",width:"380px",boxShadow:"0 24px 60px rgba(0,0,0,0.4)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
          <div>
            <div style={{fontFamily:ORB,fontSize:"18px",fontWeight:800,color:D.acc,letterSpacing:"0.12em"}}>◈ CX</div>
            <div style={{color:D.txtD,fontSize:"11px",marginTop:"2px"}}>{mode==="login"?"Welcome back":"Create your account"}</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:D.txtD,fontSize:"20px",lineHeight:1,cursor:"pointer"}}>×</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",border:`1px solid ${D.bdr}`,borderRadius:"6px",overflow:"hidden",marginBottom:"20px"}}>
          {[["login","LOG IN"],["signup","SIGN UP"]].map(([m,label])=>(
            <button key={m} onClick={()=>{setMode(m);setError("");setSuccess("");}} style={{padding:"9px",border:"none",cursor:"pointer",fontFamily:MONO,fontSize:"10px",letterSpacing:"0.1em",background:mode===m?(dark?"rgba(0,180,60,0.18)":"rgba(22,128,58,0.10)"):"transparent",color:mode===m?D.accD:D.txtD,borderBottom:`2px solid ${mode===m?D.accD:"transparent"}`,transition:"all 0.14s"}}>{label}</button>
          ))}
        </div>

        {mode==="signup"&&(
          <div style={{marginBottom:"14px"}}>
            <div style={{color:D.txtD,fontSize:"10px",marginBottom:"5px",letterSpacing:"0.08em"}}>DISPLAY NAME</div>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"5px",padding:"10px 12px",color:D.txt,fontSize:"12px",fontFamily:MONO}}/>
          </div>
        )}
        <div style={{marginBottom:"14px"}}>
          <div style={{color:D.txtD,fontSize:"10px",marginBottom:"5px",letterSpacing:"0.08em"}}>EMAIL</div>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="you@email.com" style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"5px",padding:"10px 12px",color:D.txt,fontSize:"12px",fontFamily:MONO}}/>
        </div>
        <div style={{marginBottom:"20px"}}>
          <div style={{color:D.txtD,fontSize:"10px",marginBottom:"5px",letterSpacing:"0.08em"}}>PASSWORD</div>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••••••" style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"5px",padding:"10px 12px",color:D.txt,fontSize:"12px",fontFamily:MONO}}/>
        </div>

        {error&&<div style={{marginBottom:"14px",padding:"8px 12px",background:dark?"rgba(180,30,30,0.1)":"rgba(220,50,50,0.06)",border:`1px solid ${dark?"#5a1a1a":"#e07070"}`,borderRadius:"4px",color:D.askT,fontSize:"10px"}}>{error}</div>}
        {success&&<div style={{marginBottom:"14px",padding:"8px 12px",background:dark?"rgba(0,180,60,0.1)":"rgba(22,128,58,0.06)",border:`1px solid ${dark?"#1a4a1a":"#8acc8a"}`,borderRadius:"4px",color:D.accD,fontSize:"10px"}}>{success}</div>}

        <button onClick={submit} disabled={loading} style={{width:"100%",padding:"11px",border:`1px solid ${dark?"#1a5a2a":"#7ab07a"}`,borderRadius:"6px",fontSize:"11px",fontFamily:MONO,letterSpacing:"0.1em",fontWeight:"bold",background:dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#cceacc,#a8d8a8)",color:dark?"#00ff55":"#1a5a2a",cursor:loading?"wait":"pointer",opacity:loading?0.7:1}}>
          {loading?"...":(mode==="login"?"→ LOG IN":"→ CREATE ACCOUNT")}
        </button>
      </div>
    </div>
  );
}

// ── Landing Page ──────────────────────────────────────────────────────────────
function Landing({D,dark,dbCards,onEnterDemo,onOpenAuth}){
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
    const iv=setInterval(()=>{
      const t=genTrade(base);
      setFlash(t.price>price?"up":"down");
      setTimeout(()=>setFlash(null),400);
      setPrice(t.price);
      setHist(h=>[...h.slice(1),{p:t.price}]);
      setLiveAsks(genOrders(t.price,5,"ask"));
      setLiveBids(genOrders(t.price,5,"bid"));
      setLiveTrades(p=>[t,...p.slice(0,7)]);
    },1600);
    return ()=>clearInterval(iv);
  },[base,price]);

  const CW=500,CH=120;
  const minP=Math.min(...hist.map(h=>h.p)),maxP=Math.max(...hist.map(h=>h.p)),rng=maxP-minP||1;
  const lp=hist.map((h,i)=>`${i===0?"M":"L"}${((i/(hist.length-1))*CW).toFixed(1)},${((CH-4)-((h.p-minP)/rng)*(CH-8)).toFixed(1)}`).join(" ");

  const FEATURES=[
    {icon:"◈",title:"Multi-Game Market",desc:"Trade Pokémon, MTG, Yu-Gi-Oh! and One Piece cards all in one place with live pricing."},
    {icon:"⬡",title:"Real-Time Order Book",desc:"See live bids and asks, place limit or market orders, and watch trades execute instantly."},
    {icon:"◇",title:"Portfolio Tracker",desc:"Track your holdings, average cost, unrealised P&L and trade history across all games."},
    {icon:"▣",title:"Price History",desc:"Every trade you make is recorded and plotted on the chart — real history, not guesswork."},
  ];

  return(
    <div style={{fontFamily:MONO,background:dark?"#070a0e":"#f0f4f0",minHeight:"100vh",color:dark?"#a8b8a0":"#2a3a2a",overflowY:"auto"}}>

      {/* ── Hero ── */}
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>

        {/* Live market background */}
        <div style={{position:"absolute",inset:0,opacity:0.18,pointerEvents:"none",overflow:"hidden"}}>
          <div style={{position:"absolute",right:"-60px",top:"60px",width:"620px",background:dark?"#080c08":"#ffffff",border:`1px solid ${dark?"#0f1f0f":"#dde8dd"}`,borderRadius:"12px",padding:"16px",boxShadow:dark?"0 0 60px rgba(0,255,80,0.08)":"0 8px 40px rgba(0,0,0,0.08)"}}>
            <div style={{display:"flex",gap:"12px",alignItems:"center",marginBottom:"12px"}}>
              <img src={featuredCard.img||featuredCard.img_url} style={{width:"50px",height:"70px",objectFit:"cover",borderRadius:"4px"}} onError={e=>e.target.style.display="none"}/>
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
        <div style={{position:"relative",zIndex:10,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 40px",borderBottom:`1px solid ${dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.06)"}`}}>
          <div style={{maxWidth:"1100px",margin:"0 auto",width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"baseline",gap:"10px"}}>
            <span style={{fontFamily:ORB,fontSize:"20px",fontWeight:800,color:dark?"#00cc40":"#15803d",letterSpacing:"0.18em"}}>◈ CX</span>
            <span style={{fontFamily:ORB,fontSize:"12px",fontWeight:600,color:dark?"#4a8a4a":"#3a7a3a",letterSpacing:"0.08em"}}>COLLECTOR'S EXCHANGE</span>
          </div>
          <div style={{display:"flex",gap:"12px",alignItems:"center"}}>
            <button onClick={onEnterDemo} style={{padding:"8px 18px",background:"transparent",border:`1px solid ${dark?"#2a5a2a":"#b8d4b8"}`,borderRadius:"5px",color:dark?"#4a8a4a":"#3a7a3a",fontSize:"10px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.1em"}}>EXPLORE DEMO</button>
            <button onClick={()=>onOpenAuth("login")} style={{padding:"8px 18px",background:"transparent",border:`1px solid ${dark?"#4a8a4a":"#7a9a7a"}`,borderRadius:"5px",color:dark?"#a8b8a0":"#2a3a2a",fontSize:"10px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.1em"}}>LOG IN</button>
            <button onClick={()=>onOpenAuth("signup")} style={{padding:"8px 20px",background:dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#cceacc,#a8d8a8)",border:`1px solid ${dark?"#1a5a2a":"#7ab07a"}`,borderRadius:"5px",color:dark?"#00ff55":"#1a5a2a",fontSize:"10px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.1em",fontWeight:"bold"}}>GET STARTED →</button>
          </div>
        </div>

          </div>
        {/* Hero content */}
        <div style={{position:"relative",zIndex:10,flex:1,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",padding:"60px 40px",textAlign:"center"}}>
          <div style={{maxWidth:"700px",width:"100%"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:"8px",background:dark?"rgba(0,180,60,0.08)":"rgba(22,128,58,0.06)",border:`1px solid ${dark?"#1a4a1a":"#a8d4a8"}`,borderRadius:"20px",padding:"5px 14px",marginBottom:"28px",width:"fit-content"}}>
            <span style={{color:dark?"#00cc40":"#15803d",fontSize:"9px"}}>●</span>
            <span style={{color:dark?"#4a8a4a":"#3a7a3a",fontSize:"10px",letterSpacing:"0.12em"}}>LIVE MARKET · DEMO AVAILABLE</span>
          </div>
          <h1 style={{fontFamily:ORB,fontSize:"clamp(32px,5vw,58px)",fontWeight:800,lineHeight:1.1,letterSpacing:"0.04em",color:dark?"#a8b8a0":"#1a2a1a",marginBottom:"20px"}}>
            The Trading<br/>Platform for<br/><span style={{color:dark?"#00cc40":"#15803d"}}>Collectors.</span>
          </h1>
          <p style={{fontSize:"14px",lineHeight:1.8,color:dark?"#4a8a4a":"#5a7a5a",marginBottom:"36px",maxWidth:"480px"}}>
            Buy, sell and trade rare TCG cards with a real order book, live pricing, and portfolio tracking. Pokémon, MTG, Yu-Gi-Oh! and more.
          </p>
          <div style={{display:"flex",gap:"14px",flexWrap:"wrap",justifyContent:"center"}}>
            <button onClick={()=>onOpenAuth("signup")} style={{padding:"14px 32px",background:dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#b8e8b8,#8acc8a)",border:`1px solid ${dark?"#1a5a2a":"#5a9a5a"}`,borderRadius:"7px",color:dark?"#00ff55":"#1a4a1a",fontSize:"12px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.1em",fontWeight:"bold"}}>CREATE FREE ACCOUNT</button>
            <button onClick={onEnterDemo} style={{padding:"14px 28px",background:"transparent",border:`1px solid ${dark?"#2a5a2a":"#c5d8c5"}`,borderRadius:"7px",color:dark?"#4a8a4a":"#3a7a3a",fontSize:"12px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.1em"}}>EXPLORE DEMO ▸</button>
          </div>
          <div style={{display:"flex",gap:"28px",marginTop:"44px",justifyContent:"center"}}>
            {[["20+","Cards Listed"],["$0","To Get Started"],["Live","Order Matching"]].map(([val,label])=>(
              <div key={label}>
                <div style={{fontFamily:ORB,fontSize:"22px",fontWeight:800,color:dark?"#00cc40":"#15803d"}}>{val}</div>
                <div style={{color:dark?"#2a5a2a":"#7a9a7a",fontSize:"9px",marginTop:"3px",letterSpacing:"0.1em"}}>{label}</div>
              </div>
            ))}
          </div>
        </div>

          </div>
        {/* Scroll indicator */}
        <div style={{position:"relative",zIndex:10,textAlign:"center",padding:"20px",color:dark?"#2a5a2a":"#b8d4b8",fontSize:"18px",animation:"bounce 2s infinite"}}>▾</div>
      </div>

      {/* ── Features ── */}
      <div style={{padding:"80px 40px",background:dark?"#080c09":"#ffffff",borderTop:`1px solid ${dark?"#0f1f0f":"#dde8dd"}`}}>
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
      <div style={{padding:"80px 40px",textAlign:"center",background:dark?"linear-gradient(135deg,#080c09,#0a100a)":"linear-gradient(135deg,#e8f4e8,#f0f8f0)",borderTop:`1px solid ${dark?"#0f1f0f":"#dde8dd"}`}}>
        <div style={{maxWidth:"1100px",margin:"0 auto"}}>
        <h2 style={{fontFamily:ORB,fontSize:"32px",fontWeight:800,color:dark?"#a8b8a0":"#1a2a1a",marginBottom:"14px"}}>Ready to Start Trading?</h2>
        <p style={{color:dark?"#4a8a4a":"#5a7a5a",fontSize:"12px",marginBottom:"32px"}}>Create a free account and get $15,000 in demo funds to trade with immediately.</p>
        <div style={{display:"flex",gap:"14px",justifyContent:"center",flexWrap:"wrap"}}>
          <button onClick={()=>onOpenAuth("signup")} style={{padding:"14px 36px",background:dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#b8e8b8,#8acc8a)",border:`1px solid ${dark?"#1a5a2a":"#5a9a5a"}`,borderRadius:"7px",color:dark?"#00ff55":"#1a4a1a",fontSize:"12px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.1em",fontWeight:"bold"}}>CREATE FREE ACCOUNT</button>
          <button onClick={onEnterDemo} style={{padding:"14px 28px",background:"transparent",border:`1px solid ${dark?"#2a5a2a":"#c5d8c5"}`,borderRadius:"7px",color:dark?"#4a8a4a":"#3a7a3a",fontSize:"12px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.1em"}}>TRY DEMO FIRST</button>
        </div>
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
export default function App(){
  const [dark,setDark]=useState(false);
  const [screen,setScreen]=useState("landing"); // "landing" | "app"
  const [user,setUser]=useState(null);
  const [authModal,setAuthModal]=useState(null); // null | "login" | "signup"
  const [tab,setTab]=useState("MARKET");
  const [dbCards,setDbCards]=useState([]);
  const [selectedCard,setSelectedCard]=useState(null);

  // ── Global trading state ──────────────────────────────────────────────────
  const [balance,setBalance]=useState(STARTING_BALANCE);
  const [orders,setOrders]=useState([]);
  const [holdings,setHoldings]=useState([]);
  const [tradeHistory,setTradeHistory]=useState([]);
  const [ledger]=useState([{id:"DEP-001",type:"deposit",amount:STARTING_BALANCE,method:"Demo Credit",date:nowDate()}]);
  const [marketPrices,setMarketPrices]=useState({});

  const D=dark?DK:LT;

  useEffect(()=>{
    import('./supabase').then(({supabase})=>{
      // Check for existing session
      supabase.auth.getSession().then(({data:{session}})=>{
        if(session?.user){ setUser(session.user); setScreen("app"); }
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

  // Run match engine every 2s against live market prices
  useEffect(()=>{
    const iv=setInterval(()=>{
      setOrders(prev=>{
        const openOrders=prev.filter(o=>o.status==="open"||o.status==="partial");
        if(!openOrders.length) return prev;
        const result=matchOrders(prev,marketPrices,holdings,balance);
        if(result.newTrades.length){
          setHoldings(result.holdings);
          setBalance(result.balance);
          setTradeHistory(h=>[...result.newTrades,...h]);
        }
        return result.orders;
      });
    },2000);
    return ()=>clearInterval(iv);
  },[marketPrices,holdings,balance]);

  const placeOrder=(orderData)=>{
    const o={
      id: newOrderId(),
      ...orderData,
      filled: 0,
      status: "open",
      time: nowTime(),
      date: nowDate(),
    };
    // market orders fill immediately
    if(o.type==="market"){
      const result=matchOrders([o],marketPrices,holdings,balance);
      if(result.newTrades.length){
        setHoldings(result.holdings);
        setBalance(result.balance);
        setTradeHistory(h=>[...result.newTrades,...h]);
      }
      setOrders(prev=>[...result.orders,...prev]);
    } else {
      setOrders(prev=>[o,...prev]);
    }
  };

  const cancelOrder=(id)=>setOrders(prev=>prev.map(o=>o.id===id&&(o.status==="open"||o.status==="partial")?{...o,status:"cancelled"}:o));

  const handleBrowseSelect=(card)=>{ setSelectedCard(card); setTab("MARKET"); };
  const handleLogout=async()=>{
    const {supabase}=await import('./supabase');
    await supabase.auth.signOut();
    setUser(null); setScreen("landing");
    setOrders([]); setHoldings([]); setTradeHistory([]); setBalance(STARTING_BALANCE);
  };
  const handleAuth=(u)=>{ setUser(u); setAuthModal(null); setScreen("app"); };
  const handleUpdatePrice=(cardId,price)=>setMarketPrices(p=>({...p,[cardId]:price}));

  const isDemo = screen==="app" && !user;

  return(
    <div style={{fontFamily:MONO,fontSize:"12px"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@600;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;} ::-webkit-scrollbar-track{background:${D.bg};} ::-webkit-scrollbar-thumb{background:${D.bdr2};border-radius:2px;}
        input{outline:none;font-family:${MONO};} input:focus{border-color:${D.accD}!important;}
        button{cursor:pointer;} select{outline:none;}
        @keyframes fG{0%,100%{background:transparent}50%{background:rgba(0,200,60,0.14)}}
        @keyframes fR{0%,100%{background:transparent}50%{background:rgba(220,50,50,0.14)}}
        .fu{animation:fG 0.4s ease;} .fd{animation:fR 0.4s ease;}
      `}</style>

      {authModal&&<AuthModal D={D} dark={dark} onClose={()=>setAuthModal(null)} onAuth={handleAuth}/>}

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
              <span style={{color:dark?"#4a8a4a":"#3a7a3a",fontSize:"10px",letterSpacing:"0.1em"}}>▸ DEMO MODE — Orders and portfolio reset on refresh. <span style={{color:D.accD,cursor:"pointer",textDecoration:"underline"}} onClick={()=>setAuthModal("signup")}>Create a free account</span> to save your trades.</span>
              <button onClick={()=>setAuthModal("signup")} style={{padding:"4px 12px",background:dark?"rgba(0,180,60,0.15)":"rgba(22,128,58,0.10)",border:`1px solid ${dark?"#1a4a1a":"#8acc8a"}`,borderRadius:"4px",color:D.accD,fontSize:"9px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>SIGN UP FREE →</button>
            </div>
          )}

          <div style={{background:D.hdrBg,borderBottom:`1px solid ${D.bdr2}`,padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:"44px",position:"sticky",top:0,zIndex:100,boxShadow:D.shad,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
              <div style={{display:"flex",alignItems:"baseline",gap:"8px",cursor:"pointer"}} onClick={()=>setScreen("landing")}>
                <span style={{fontFamily:ORB,fontSize:"16px",fontWeight:800,color:D.acc,letterSpacing:"0.18em",textShadow:dark?"0 0 22px rgba(0,255,80,0.45)":"none"}}>◈ CX</span>
                <span style={{fontFamily:ORB,fontSize:"11px",fontWeight:600,color:D.txtM,letterSpacing:"0.08em"}}>COLLECTOR'S EXCHANGE</span>
              </div>
              <span style={{color:D.bdr2}}>|</span>
              <span style={{color:D.txtD,fontSize:"9px",letterSpacing:"0.14em",fontStyle:"italic"}}>Buy. Sell. Collect.</span>
            </div>
            <div style={{display:"flex",gap:"2px",alignItems:"center"}}>
              {["MARKET","BROWSE","PORTFOLIO","ORDERS","HISTORY"].map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{padding:"0 16px",height:"44px",border:"none",background:"transparent",color:tab===t?D.accD:D.txtD,fontSize:"10px",fontFamily:MONO,letterSpacing:"0.12em",borderBottom:`2px solid ${tab===t?D.accD:"transparent"}`,transition:"all 0.12s",cursor:"pointer"}}>{t}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
              {user?(
                <>
                  <span style={{color:D.txtD,fontSize:"10px"}}>{user.user_metadata?.display_name||user.email?.split("@")[0]}</span>
                  <div style={{background:D.stBg,border:`1px solid ${D.bdr}`,borderRadius:"3px",padding:"3px 10px",fontSize:"11px",color:D.txtM}}>💵 ${balance.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
                  <button onClick={handleLogout} style={{padding:"3px 10px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"3px",color:D.txtD,fontSize:"9px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>LOG OUT</button>
                </>
              ):(
                <>
                  <div style={{background:D.stBg,border:`1px solid ${D.bdr}`,borderRadius:"3px",padding:"3px 10px",fontSize:"11px",color:D.txtM}}>💵 ${balance.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
                  <button onClick={()=>setAuthModal("login")} style={{padding:"3px 10px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"3px",color:D.txtD,fontSize:"9px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>LOG IN</button>
                  <button onClick={()=>setAuthModal("signup")} style={{padding:"3px 10px",background:dark?"rgba(0,120,40,0.15)":"rgba(22,128,58,0.08)",border:`1px solid ${D.accD}`,borderRadius:"3px",color:D.accD,fontSize:"9px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>SIGN UP</button>
                </>
              )}
              <div onClick={()=>setDark(d=>!d)} style={{width:"44px",height:"24px",background:dark?"#1a3a1a":"#d1ecd1",borderRadius:"12px",border:`1px solid ${D.bdr2}`,display:"flex",alignItems:"center",padding:"3px",transition:"background 0.3s",cursor:"pointer"}}>
                <div style={{width:"16px",height:"16px",borderRadius:"50%",background:dark?"#00cc40":"#f59e0b",transform:dark?"translateX(0)":"translateX(20px)",transition:"transform 0.3s,background 0.3s",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px"}}>{dark?"🌙":"☀️"}</div>
              </div>
            </div>
          </div>

          <div style={{flex:1,display:"flex",overflow:"hidden"}}>
            {tab==="MARKET"    && <Market    D={D} dark={dark} dbCards={dbCards} initialCard={selectedCard} balance={balance} onPlaceOrder={placeOrder} onUpdatePrice={handleUpdatePrice} tradeHistory={tradeHistory} isDemo={isDemo}/>}
            {tab==="BROWSE"    && <Browser   D={D} dark={dark} dbCards={dbCards} onSelectCard={handleBrowseSelect}/>}
            {tab==="PORTFOLIO" && <Portfolio D={D} dark={dark} holdings={holdings} tradeHistory={tradeHistory} dbCards={dbCards}/>}
            {tab==="ORDERS"    && <Orders    D={D} dark={dark} orders={orders} onCancel={cancelOrder} dbCards={dbCards}/>}
            {tab==="HISTORY"   && <History   D={D} dark={dark} tradeHistory={tradeHistory} ledger={ledger} dbCards={dbCards}/>}
          </div>
        </div>
      )}
    </div>
  );
}