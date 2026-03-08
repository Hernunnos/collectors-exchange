import { useState, useEffect } from "react";

const CARD_LIST = [
  { id: 1, name: "Charizard", set: "Base Set", condition: "PSA 10", rarity: "Holo Rare", img: "https://images.pokemontcg.io/base1/4_hires.png" },
  { id: 2, name: "Black Lotus", set: "Alpha", condition: "NM", rarity: "Rare", img: "https://cards.scryfall.io/large/front/b/d/bd8fa327-dd41-4737-8f19-2cf5eb1f7cdd.jpg" },
  { id: 3, name: "Pikachu Illustrator", set: "CoroCoro", condition: "PSA 9", rarity: "Promo", img: "https://images.pokemontcg.io/basep/1_hires.png" },
  { id: 4, name: "Blastoise", set: "Base Set", condition: "PSA 8", rarity: "Holo Rare", img: "https://images.pokemontcg.io/base1/2_hires.png" },
  { id: 5, name: "Mewtwo", set: "Base Set", condition: "PSA 9", rarity: "Holo Rare", img: "https://images.pokemontcg.io/base1/10_hires.png" },
];

const BASE_PRICES = { 1: 420.0, 2: 8500.0, 3: 74000.0, 4: 280.0, 5: 310.0 };

function genOrders(base, count, side) {
  return Array.from({ length: count }, (_, i) => {
    const off = (i + 1) * (Math.random() * 0.8 + 0.2);
    const price = side === "ask" ? +(base + off * base * 0.003).toFixed(2) : +(base - off * base * 0.003).toFixed(2);
    const qty = Math.floor(Math.random() * 5) + 1;
    return { price, qty, total: +(price * qty).toFixed(2) };
  }).sort((a, b) => side === "ask" ? a.price - b.price : b.price - a.price);
}

function genTrade(base) {
  const price = +(base + (Math.random() - 0.48) * base * 0.006).toFixed(2);
  const qty = Math.floor(Math.random() * 3) + 1;
  return { price, qty, side: Math.random() > 0.5 ? "buy" : "sell", time: new Date().toLocaleTimeString("en-US", { hour12: false }), id: Math.random() };
}

export default function TCGMarket() {
  const [dark, setDark] = useState(true);
  const [card, setCard] = useState(CARD_LIST[0]);
  const [asks, setAsks] = useState(() => genOrders(BASE_PRICES[1], 6, "ask"));
  const [bids, setBids] = useState(() => genOrders(BASE_PRICES[1], 6, "bid"));
  const [trades, setTrades] = useState(() => Array.from({ length: 16 }, () => genTrade(BASE_PRICES[1])));
  const [price, setPrice] = useState(BASE_PRICES[1]);
  const [flash, setFlash] = useState(null);
  const [oSide, setOSide] = useState("buy");
  const [oType, setOType] = useState("limit");
  const [oPrice, setOPrice] = useState("");
  const [oQty, setOQty] = useState("");
  const [oStatus, setOStatus] = useState(null);
  const [history, setHistory] = useState(() => Array.from({ length: 60 }, (_, i) => ({ x: i, p: BASE_PRICES[1] + (Math.random() - 0.5) * BASE_PRICES[1] * 0.05 })));

  const base = BASE_PRICES[card.id];

  const D = dark ? {
    bg:"#070a0e",bg2:"#080c09",bg3:"#0a0f0a",bdr:"#0f1f0f",bdr2:"#1a2e1a",
    txt:"#a8b8a0",txtD:"#2a5a2a",txtM:"#4a8a4a",txtB:"#ccffcc",
    acc:"#00ff50",accD:"#00cc40",
    buyBg:"rgba(0,180,60,0.18)",sellBg:"rgba(180,30,30,0.18)",
    buyT:"#00ff50",sellT:"#ff4040",askT:"#cc3535",bidT:"#00cc40",
    inBg:"#0a0f0a",inBdr:"#1a2a1a",
    cStroke:"#00cc40",rowHov:"rgba(0,255,80,0.04)",
    stBg:"#0a100a",hdrBg:"#080c08",shad:"0 1px 12px rgba(0,0,0,0.5)",
    chartFill: dark => "rgba(0,204,64,0.14)",
  } : {
    bg:"#f0f4f0",bg2:"#ffffff",bg3:"#f8faf8",bdr:"#dde8dd",bdr2:"#b8d4b8",
    txt:"#2a3a2a",txtD:"#7a9a7a",txtM:"#3a7a3a",txtB:"#1a2e1a",
    acc:"#16803a",accD:"#15803d",
    buyBg:"rgba(22,128,58,0.1)",sellBg:"rgba(200,30,30,0.08)",
    buyT:"#15803d",sellT:"#dc2626",askT:"#dc2626",bidT:"#15803d",
    inBg:"#f8faf8",inBdr:"#c5d8c5",
    cStroke:"#15803d",rowHov:"rgba(22,128,58,0.04)",
    stBg:"#f0f6f0",hdrBg:"#ffffff",shad:"0 1px 6px rgba(0,0,0,0.08)",
    chartFill: dark => "rgba(21,128,61,0.08)",
  };

  useEffect(() => {
    const b = BASE_PRICES[card.id];
    setAsks(genOrders(b,6,"ask")); setBids(genOrders(b,6,"bid"));
    setPrice(b); setTrades(Array.from({length:16},()=>genTrade(b)));
    setHistory(Array.from({length:60},(_,i)=>({x:i,p:b+(Math.random()-0.5)*b*0.05})));
    setOPrice(""); setOQty("");
  }, [card]);

  useEffect(() => {
    const iv = setInterval(() => {
      const b = BASE_PRICES[card.id];
      const tr = genTrade(b);
      setFlash(tr.price > price ? "up" : "down");
      setTimeout(()=>setFlash(null),400);
      setPrice(tr.price);
      setTrades(prev=>[tr,...prev.slice(0,19)]);
      setAsks(genOrders(tr.price,6,"ask")); setBids(genOrders(tr.price,6,"bid"));
      setHistory(prev=>[...prev.slice(1),{x:prev[prev.length-1].x+1,p:tr.price}]);
    }, 1800);
    return ()=>clearInterval(iv);
  }, [card, price]);

  const spread = asks[0]&&bids[0] ? +(asks[0].price-bids[0].price).toFixed(2) : 0;
  const pct = (((price-base)/base)*100).toFixed(2);
  const minP = Math.min(...history.map(h=>h.p));
  const maxP = Math.max(...history.map(h=>h.p));
  const rng = maxP-minP||1;
  const mAV = Math.max(...asks.map(a=>a.qty),1);
  const mBV = Math.max(...bids.map(b=>b.qty),1);

  function cPath(w,h) {
    return history.map((h,i)=>{
      const x=(i/(history.length-1))*w;
      const y=h-8-((h.p-minP)/rng)*(h-16);
      return `${i===0?"M":"L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  const oTotal = ((oType==="market"?price:+oPrice||0)*(+oQty||0));

  function submitOrder() {
    if(!oQty||(oType==="limit"&&!oPrice)) return;
    setOStatus({side:oSide,price:oType==="market"?price:+oPrice,qty:+oQty});
    setTimeout(()=>setOStatus(null),3000);
    setOPrice(""); setOQty("");
  }

  const mono = "'Share Tech Mono','Courier New',monospace";
  const orb = "'Orbitron',sans-serif";

  return (
    <div style={{fontFamily:mono,background:D.bg,color:D.txt,minHeight:"100vh",fontSize:"12px",transition:"background 0.3s,color 0.3s"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@600;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:${D.bg};} ::-webkit-scrollbar-thumb{background:${D.bdr2};border-radius:2px;}
        input{outline:none;} input:focus{border-color:${D.accD}!important;}
        @keyframes fG{0%,100%{background:transparent}50%{background:rgba(0,200,60,0.14)}}
        @keyframes fR{0%,100%{background:transparent}50%{background:rgba(220,50,50,0.14)}}
        @keyframes fS{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fG 0.4s ease;} .fd{animation:fR 0.4s ease;} .nt{animation:fS 0.3s ease;}
        .rh:hover{background:${D.rowHov}!important;cursor:pointer;}
        .cb{transition:background 0.12s;cursor:pointer;} .cb:hover{background:${D.rowHov}!important;}
        .sb{transition:filter 0.15s,transform 0.1s;cursor:pointer;} .sb:hover{filter:brightness(1.1);} .sb:active{transform:scale(0.98);}
        .tg{cursor:pointer;transition:transform 0.2s;} .tg:hover{transform:scale(1.08);}
        .nt2:hover{color:${D.accD}!important;cursor:pointer;}
      `}</style>

      {/* NAV */}
      <div style={{background:D.hdrBg,borderBottom:`1px solid ${D.bdr2}`,padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:"44px",position:"sticky",top:0,zIndex:100,boxShadow:D.shad}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <div style={{display:"flex",alignItems:"baseline",gap:"8px"}}>
            <span style={{fontFamily:orb,fontSize:"16px",fontWeight:800,color:D.acc,letterSpacing:"0.18em",textShadow:dark?`0 0 22px rgba(0,255,80,0.45)`:"none"}}>◈ CX</span>
            <span style={{fontFamily:orb,fontSize:"11px",fontWeight:600,color:D.txtM,letterSpacing:"0.08em"}}>COLLECTOR'S EXCHANGE</span>
          </div>
          <span style={{color:D.bdr2}}>|</span>
          <span style={{color:D.txtD,fontSize:"9px",letterSpacing:"0.14em",fontStyle:"italic"}}>Buy. Sell. Collect.</span>
        </div>
        <div style={{display:"flex",gap:"20px",alignItems:"center"}}>
          {["MARKET","PORTFOLIO","ORDERS","HISTORY"].map(t=>(
            <span key={t} className="nt2" style={{color:t==="MARKET"?D.accD:D.txtD,fontSize:"10px",letterSpacing:"0.12em",borderBottom:t==="MARKET"?`1px solid ${D.accD}`:"1px solid transparent",paddingBottom:"2px"}}>{t}</span>
          ))}
        </div>
        <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
          <div style={{background:D.stBg,border:`1px solid ${D.bdr}`,borderRadius:"3px",padding:"3px 10px",fontSize:"11px",color:D.txtM}}>Ξ 12,440.00</div>
          <div className="tg" onClick={()=>setDark(d=>!d)} title={dark?"Light mode":"Dark mode"}
            style={{width:"44px",height:"24px",background:dark?"#1a3a1a":"#d1ecd1",borderRadius:"12px",border:`1px solid ${D.bdr2}`,display:"flex",alignItems:"center",padding:"3px",transition:"background 0.3s"}}>
            <div style={{width:"16px",height:"16px",borderRadius:"50%",background:dark?"#00cc40":"#f59e0b",transform:dark?"translateX(0)":"translateX(20px)",transition:"transform 0.3s,background 0.3s",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px"}}>
              {dark?"🌙":"☀️"}
            </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{display:"flex",height:"calc(100vh - 44px)"}}>

        {/* SIDEBAR */}
        <div style={{width:"186px",flexShrink:0,borderRight:`1px solid ${D.bdr}`,background:D.bg2,display:"flex",flexDirection:"column",overflowY:"auto"}}>
          <div style={{padding:"8px 12px",borderBottom:`1px solid ${D.bdr}`,color:D.txtD,fontSize:"10px",letterSpacing:"0.12em"}}>▸ INSTRUMENTS</div>
          {CARD_LIST.map(c=>{
            const bp=BASE_PRICES[c.id];
            const chg=((Math.random()-0.45)*5).toFixed(2);
            const up=+chg>=0; const active=card.id===c.id;
            return (
              <div key={c.id} className="cb" onClick={()=>setCard(c)} style={{padding:"9px 12px",borderBottom:`1px solid ${D.bdr}`,background:active?(dark?"rgba(0,255,80,0.05)":"rgba(22,128,58,0.05)"):"transparent",borderLeft:active?`2px solid ${D.accD}`:"2px solid transparent"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"3px"}}>
                  <img src={c.img} alt={c.name} style={{width:"28px",height:"38px",objectFit:"cover",borderRadius:"3px",border:`1px solid ${D.bdr}`,flexShrink:0}} onError={e=>e.target.style.display="none"} />
                  <div>
                    <div style={{color:active?D.acc:D.txt,fontSize:"11px"}}>{c.name}</div>
                    <div style={{color:D.txtD,fontSize:"9px"}}>{c.set} · {c.condition}</div>
                  </div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",paddingLeft:"36px"}}>
                  <span style={{color:D.txtM,fontSize:"10px"}}>${bp.toLocaleString()}</span>
                  <span style={{color:up?D.bidT:D.askT,fontSize:"9px"}}>{up?"▲":"▼"}{Math.abs(chg)}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* MAIN */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

          {/* CARD HEADER */}
          <div style={{background:D.hdrBg,borderBottom:`1px solid ${D.bdr}`,padding:"10px 18px",display:"flex",alignItems:"center",gap:"14px",flexWrap:"wrap",flexShrink:0}}>
            <img src={card.img} alt={card.name} style={{width:"40px",height:"54px",objectFit:"cover",borderRadius:"4px",border:`1px solid ${D.bdr2}`,boxShadow:dark?"0 2px 14px rgba(0,0,0,0.6)":"0 2px 8px rgba(0,0,0,0.1)",flexShrink:0}} onError={e=>e.target.style.display="none"} />
            <div>
              <div style={{fontFamily:orb,fontSize:"14px",fontWeight:700,color:D.txtB,letterSpacing:"0.08em"}}>{card.name}</div>
              <div style={{color:D.txtD,fontSize:"9px",marginTop:"2px"}}>{card.set} · {card.condition} · {card.rarity}</div>
            </div>
            <div className={flash==="up"?"fu":flash==="down"?"fd":""} style={{fontFamily:orb,fontSize:"22px",fontWeight:800,color:flash==="up"?D.buyT:flash==="down"?D.sellT:D.txtB,textShadow:dark&&flash?(flash==="up"?"0 0 20px rgba(0,255,80,0.5)":"0 0 20px rgba(255,60,60,0.4)"):"none",transition:"color 0.3s",marginLeft:"6px"}}>
              ${price.toLocaleString("en-US",{minimumFractionDigits:2})}
            </div>
            <span style={{color:+pct>=0?D.bidT:D.askT,fontSize:"12px"}}>{+pct>=0?"▲":"▼"} {Math.abs(pct)}%</span>
            {[["SPREAD",`$${spread.toFixed(2)}`],["24H HIGH",`$${(base*1.018).toFixed(2)}`],["24H LOW",`$${(base*0.983).toFixed(2)}`],["VOL",`${Math.floor(Math.random()*80+20)} cards`]].map(([k,v])=>(
              <div key={k} style={{marginLeft:"6px"}}>
                <div style={{color:D.txtD,fontSize:"9px",letterSpacing:"0.1em"}}>{k}</div>
                <div style={{color:D.txtM,fontSize:"11px",marginTop:"1px"}}>{v}</div>
              </div>
            ))}
          </div>

          {/* MAIN ROW */}
          <div style={{flex:1,display:"flex",overflow:"hidden"}}>

            {/* CENTER */}
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

              {/* CHART + LARGE CARD */}
              <div style={{background:D.bg2,borderBottom:`1px solid ${D.bdr}`,padding:"16px 20px 12px",display:"flex",gap:"18px",alignItems:"center",flexShrink:0}}>
                {/* Large card image */}
                <div style={{width:"118px",flexShrink:0,borderRadius:"8px",overflow:"hidden",border:`1px solid ${D.bdr2}`,boxShadow:dark?"0 6px 30px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,255,80,0.06)":"0 4px 18px rgba(0,0,0,0.14)",alignSelf:"center"}}>
                  <img src={card.img} alt={card.name} style={{width:"100%",display:"block"}} onError={e=>{e.target.parentElement.style.cssText="width:118px;height:164px;display:flex;align-items:center;justify-content:center;";e.target.outerHTML=`<span style="color:${D.txtD};font-size:10px;padding:8px;text-align:center">${card.name}</span>`;}} />
                </div>
                {/* Chart */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px"}}>
                    <span style={{color:D.txtD,fontSize:"10px",letterSpacing:"0.12em"}}>▸ PRICE CHART (LIVE)</span>
                    <span style={{color:D.txtD,fontSize:"9px"}}>${minP.toFixed(2)} — ${maxP.toFixed(2)}</span>
                  </div>
                  <svg width="100%" height="160" viewBox="0 0 640 160" preserveAspectRatio="none" style={{display:"block"}}>
                    <defs>
                      <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={D.cStroke} stopOpacity={dark?"0.2":"0.1"} />
                        <stop offset="100%" stopColor={D.cStroke} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[0.25,0.5,0.75].map(f=><line key={f} x1="0" y1={f*140+10} x2="640" y2={f*140+10} stroke={D.bdr} strokeWidth="0.6" strokeDasharray="4,5" />)}
                    <path d={cPath(640,160)+" L640,160 L0,160 Z"} fill="url(#cg)" />
                    <path d={cPath(640,160)} fill="none" stroke={D.cStroke} strokeWidth="2.2" style={{filter:dark?"drop-shadow(0 0 5px rgba(0,204,64,0.5))":"none"}} />
                    {(()=>{const y=160-8-((price-minP)/rng)*(160-16);return <line x1="0" x2="640" y1={y} y2={y} stroke={D.accD} strokeWidth="0.8" strokeDasharray="3,4" opacity="0.4" />;})()}
                  </svg>
                </div>
              </div>

              {/* ORDER BOOK */}
              <div style={{flex:1,display:"flex",overflow:"hidden"}}>
                {/* ASKS */}
                <div style={{flex:1,display:"flex",flexDirection:"column",borderRight:`1px solid ${D.bdr}`}}>
                  <div style={{padding:"5px 14px",borderBottom:`1px solid ${D.bdr}`,background:D.bg2,display:"flex",justifyContent:"space-between",flexShrink:0}}>
                    <span style={{color:D.txtD,fontSize:"10px",letterSpacing:"0.1em"}}>▸ ASKS</span>
                    <span style={{color:D.askT,fontSize:"10px"}}>SELL ORDERS</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 50px 80px",padding:"3px 14px",color:D.txtD,fontSize:"9px",borderBottom:`1px solid ${D.bdr}`,background:D.bg2,flexShrink:0}}>
                    <span>PRICE</span><span style={{textAlign:"right"}}>QTY</span><span style={{textAlign:"right"}}>TOTAL</span>
                  </div>
                  <div style={{flex:1,overflowY:"auto"}}>
                    {asks.map((a,i)=>(
                      <div key={i} className="rh" onClick={()=>setOPrice(a.price.toString())} style={{display:"grid",gridTemplateColumns:"1fr 50px 80px",padding:"5px 14px",position:"relative",borderBottom:`1px solid ${D.bdr}`}}>
                        <div style={{position:"absolute",right:0,top:0,bottom:0,width:`${(a.qty/mAV)*55}%`,background:dark?"rgba(180,20,20,0.08)":"rgba(220,50,50,0.05)"}} />
                        <span style={{color:D.askT,zIndex:1}}>${a.price.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                        <span style={{textAlign:"right",color:D.txtD,zIndex:1}}>{a.qty}</span>
                        <span style={{textAlign:"right",color:D.txtD,zIndex:1,fontSize:"10px"}}>${a.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Spread */}
                <div style={{width:"80px",flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:D.bg2,borderRight:`1px solid ${D.bdr}`,gap:"5px"}}>
                  <div style={{color:D.txtD,fontSize:"8px",letterSpacing:"0.08em"}}>SPREAD</div>
                  <div style={{color:D.txtM,fontSize:"11px"}}>${spread.toFixed(2)}</div>
                  <div style={{color:D.txtD,fontSize:"8px"}}>{((spread/price)*100).toFixed(3)}%</div>
                  <div style={{width:"1px",height:"14px",background:D.bdr}} />
                  <div style={{color:D.askT,fontSize:"9px"}}>▼ SELL</div>
                  <div style={{color:D.bidT,fontSize:"9px"}}>▲ BUY</div>
                </div>
                {/* BIDS */}
                <div style={{flex:1,display:"flex",flexDirection:"column"}}>
                  <div style={{padding:"5px 14px",borderBottom:`1px solid ${D.bdr}`,background:D.bg2,display:"flex",justifyContent:"space-between",flexShrink:0}}>
                    <span style={{color:D.txtD,fontSize:"10px",letterSpacing:"0.1em"}}>▸ BIDS</span>
                    <span style={{color:D.bidT,fontSize:"10px"}}>BUY ORDERS</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 50px 80px",padding:"3px 14px",color:D.txtD,fontSize:"9px",borderBottom:`1px solid ${D.bdr}`,background:D.bg2,flexShrink:0}}>
                    <span>PRICE</span><span style={{textAlign:"right"}}>QTY</span><span style={{textAlign:"right"}}>TOTAL</span>
                  </div>
                  <div style={{flex:1,overflowY:"auto"}}>
                    {bids.map((b,i)=>(
                      <div key={i} className="rh" onClick={()=>setOPrice(b.price.toString())} style={{display:"grid",gridTemplateColumns:"1fr 50px 80px",padding:"5px 14px",position:"relative",borderBottom:`1px solid ${D.bdr}`}}>
                        <div style={{position:"absolute",right:0,top:0,bottom:0,width:`${(b.qty/mBV)*55}%`,background:dark?"rgba(0,180,60,0.07)":"rgba(22,128,58,0.05)"}} />
                        <span style={{color:D.bidT,zIndex:1}}>${b.price.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                        <span style={{textAlign:"right",color:D.txtD,zIndex:1}}>{b.qty}</span>
                        <span style={{textAlign:"right",color:D.txtD,zIndex:1,fontSize:"10px"}}>${b.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div style={{width:"228px",flexShrink:0,borderLeft:`1px solid ${D.bdr}`,background:D.bg2,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              {/* Order Entry */}
              <div style={{padding:"10px 12px",borderBottom:`1px solid ${D.bdr}`,flexShrink:0}}>
                <div style={{color:D.txtD,fontSize:"10px",letterSpacing:"0.12em",marginBottom:"10px"}}>▸ PLACE ORDER</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",border:`1px solid ${D.bdr2}`,borderRadius:"3px",overflow:"hidden",marginBottom:"10px"}}>
                  {["buy","sell"].map(s=>(
                    <button key={s} onClick={()=>setOSide(s)} style={{padding:"7px",border:"none",cursor:"pointer",fontFamily:mono,fontSize:"11px",letterSpacing:"0.1em",background:oSide===s?(s==="buy"?D.buyBg:D.sellBg):"transparent",color:oSide===s?(s==="buy"?D.buyT:D.sellT):D.txtD,borderBottom:oSide===s?`2px solid ${s==="buy"?D.bidT:D.askT}`:"2px solid transparent",transition:"all 0.15s"}}>{s.toUpperCase()}</button>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px",marginBottom:"10px"}}>
                  {["limit","market"].map(tp=>(
                    <button key={tp} onClick={()=>setOType(tp)} style={{padding:"5px",border:`1px solid ${oType===tp?D.bdr2:D.bdr}`,borderRadius:"2px",cursor:"pointer",background:oType===tp?D.stBg:"transparent",color:oType===tp?D.txtM:D.txtD,fontFamily:mono,fontSize:"10px",transition:"all 0.15s"}}>{tp.toUpperCase()}</button>
                  ))}
                </div>
                {oType==="limit"&&(
                  <div style={{marginBottom:"8px"}}>
                    <div style={{color:D.txtD,fontSize:"9px",marginBottom:"3px",letterSpacing:"0.08em"}}>PRICE (USD)</div>
                    <input type="number" value={oPrice} onChange={e=>setOPrice(e.target.value)} placeholder={price.toFixed(2)}
                      style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"2px",padding:"6px 8px",color:D.txt,fontSize:"12px",fontFamily:mono,transition:"border-color 0.2s"}} />
                  </div>
                )}
                <div style={{marginBottom:"8px"}}>
                  <div style={{color:D.txtD,fontSize:"9px",marginBottom:"3px",letterSpacing:"0.08em"}}>QUANTITY</div>
                  <input type="number" value={oQty} onChange={e=>setOQty(e.target.value)} placeholder="0"
                    style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"2px",padding:"6px 8px",color:D.txt,fontSize:"12px",fontFamily:mono}} />
                </div>
                <div style={{background:D.stBg,border:`1px solid ${D.bdr}`,borderRadius:"2px",padding:"6px 8px",marginBottom:"10px",display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:D.txtD,fontSize:"9px"}}>TOTAL</span>
                  <span style={{color:D.txtM,fontSize:"12px"}}>${oTotal.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                </div>
                <button className="sb" onClick={submitOrder} style={{width:"100%",padding:"9px",border:"none",borderRadius:"3px",fontSize:"11px",letterSpacing:"0.12em",fontFamily:mono,
                  background:oSide==="buy"?(dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#15803d,#16a34a)"):(dark?"linear-gradient(135deg,#3a0a0a,#5a1010)":"linear-gradient(135deg,#dc2626,#ef4444)"),
                  color:"#fff",boxShadow:oSide==="buy"?"0 2px 12px rgba(0,180,60,0.22)":"0 2px 12px rgba(200,30,30,0.22)"}}>
                  {oSide==="buy"?"▲ BUY":"▼ SELL"} {card.name.split(" ")[0].toUpperCase()}
                </button>
                {oStatus&&(
                  <div style={{marginTop:"8px",padding:"7px 8px",background:dark?"rgba(0,180,60,0.08)":"rgba(22,128,58,0.08)",border:`1px solid ${D.bdr2}`,borderRadius:"2px",animation:"fS 0.3s ease",fontSize:"10px",color:D.txtM,lineHeight:"1.7"}}>
                    ✓ ORDER PLACED<br /><span style={{color:D.txtD}}>{oStatus.side.toUpperCase()} {oStatus.qty}x @ ${oStatus.price.toFixed(2)}</span>
                  </div>
                )}
              </div>
              {/* Recent Trades */}
              <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                <div style={{padding:"6px 12px",borderBottom:`1px solid ${D.bdr}`,color:D.txtD,fontSize:"10px",letterSpacing:"0.12em",flexShrink:0}}>▸ RECENT TRADES</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 44px 36px",padding:"3px 12px",color:D.txtD,fontSize:"9px",borderBottom:`1px solid ${D.bdr}`,flexShrink:0}}>
                  <span>PRICE</span><span style={{textAlign:"right"}}>QTY</span><span style={{textAlign:"right"}}>SIDE</span>
                </div>
                <div style={{flex:1,overflowY:"auto"}}>
                  {trades.map((tr,i)=>(
                    <div key={tr.id} className={i===0?"nt":""} style={{display:"grid",gridTemplateColumns:"1fr 44px 36px",padding:"4px 12px",borderBottom:`1px solid ${D.bdr}`}}>
                      <span style={{color:tr.side==="buy"?D.bidT:D.askT,fontSize:"11px"}}>${tr.price.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                      <span style={{textAlign:"right",color:D.txtD}}>{tr.qty}</span>
                      <span style={{textAlign:"right",color:tr.side==="buy"?D.bidT:D.askT,fontSize:"9px"}}>{tr.side==="buy"?"B":"S"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}