/**
 * DemoApp.jsx
 * ─────────────────────────────────────────────────────────────
 * Fully self-contained demo. No Supabase reads or writes.
 * All data is fake and resets on refresh — by design.
 *
 * Imports all UI components from the shared monolith (tcg-market.jsx)
 * but owns its own state completely.
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

// ── Shared UI components from the monolith ────────────────────
import {
  Market,
  Browser,
  Portfolio,
  Orders,
  History,
  Ticker,
  NotificationBell,
  CSVImportModal,
  RepBadge,
} from "./tcg-market";

// ── Shared constants from the monolith ───────────────────────
import {
  CARDS,
  BASE,
  DK,
  LT,
  MONO,
  ORB,
  matchOrders,
  nowDate,
  nowTime,
  newOrderId,
  useIsMobile,
} from "./tcg-market";

// ── Demo-specific constants ───────────────────────────────────
const DEMO_BALANCE  = 15000;
const DEMO_USERNAME = "Demo Trader";

// ── Seed fake holdings so the portfolio isn't empty ──────────
const DEMO_HOLDINGS = [
  { cardId:1, qty:2, avgCost:398.00, acquired:"2026-01-14", lockedQty:0 },
  { cardId:2, qty:1, avgCost:8100.00, acquired:"2026-02-03", lockedQty:0 },
  { cardId:4, qty:3, avgCost:265.00, acquired:"2026-02-20", lockedQty:0 },
];

// ── Seed fake trade history so History tab isn't empty ───────
const DEMO_TRADES = [
  { id:"TRD-0001", cardId:1, side:"buy",  price:395.00, qty:1, total:395.00,  date:"2026-01-14", time:"10:32:11" },
  { id:"TRD-0002", cardId:2, side:"buy",  price:8100.00,qty:1, total:8100.00, date:"2026-02-03", time:"14:18:44" },
  { id:"TRD-0003", cardId:4, side:"buy",  price:265.00, qty:3, total:795.00,  date:"2026-02-20", time:"09:05:22" },
  { id:"TRD-0004", cardId:1, side:"buy",  price:401.00, qty:1, total:401.00,  date:"2026-03-01", time:"11:44:09" },
  { id:"TRD-0005", cardId:5, side:"sell", price:318.00, qty:1, total:318.00,  date:"2026-03-05", time:"16:22:33" },
];

const DEMO_LEDGER = [
  { id:"DEP-001", type:"deposit", amount:DEMO_BALANCE, method:"Demo Credit", date:"2026-01-01" },
];

// ── Notification prefs (demo never persists these) ────────────
const DEFAULT_NOTIF_PREFS = {
  filled_buy: true, filled_sell: true, price_alert: true, import: true,
};

export default function DemoApp({ dark, setDark }) {
  const navigate    = useNavigate();
  const isMobile    = useIsMobile();
  const D           = dark ? DK : LT;

  // ── Demo state ───────────────────────────────────────────────
  const [tab,          setTab]          = useState("MARKET");
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [authModal,    setAuthModal]    = useState(null); // "login" | "signup" | null
  const [csvModal,     setCsvModal]     = useState(false);
  const [notifications,setNotifications]= useState([]);
  const [selectedCard, setSelectedCard] = useState(null);

  // Trading state — all fake, never touches Supabase
  const [balance,      setBalance]      = useState(DEMO_BALANCE);
  const [orders,       setOrders]       = useState([]);
  const [holdings,     setHoldings]     = useState(DEMO_HOLDINGS);
  const [tradeHistory, setTradeHistory] = useState(DEMO_TRADES);
  const [marketPrices, setMarketPrices] = useState(() => {
    const p = {};
    CARDS.forEach(c => { p[c.id] = BASE[c.id] || 0; });
    return p;
  });

  // Refs for match engine (avoids stale closures)
  const balanceRef      = useRef(balance);
  const holdingsRef     = useRef(holdings);
  const marketPricesRef = useRef(marketPrices);
  useEffect(() => { balanceRef.current = balance; },      [balance]);
  useEffect(() => { holdingsRef.current = holdings; },    [holdings]);
  useEffect(() => { marketPricesRef.current = marketPrices; }, [marketPrices]);

  // ── Match engine — runs every 2s, no DB writes ───────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setOrders(prev => {
        // Expire orders
        const now = new Date();
        const expiredIds = new Set(
          prev.filter(o =>
            (o.status==="open"||o.status==="partial") &&
            o.expiresAt && new Date(o.expiresAt) < now
          ).map(o => o.id)
        );
        if (expiredIds.size > 0) {
          setHoldings(h => h.map(holding => {
            const expiredSells = prev.filter(o =>
              expiredIds.has(o.id) && o.side==="sell" && +o.cardId===+holding.cardId
            );
            const unlockQty = expiredSells.reduce((s,o) => s+(o.qty-o.filled), 0);
            return unlockQty > 0
              ? { ...holding, lockedQty: Math.max(0,(holding.lockedQty||0)-unlockQty) }
              : holding;
          }));
          return prev.map(o => expiredIds.has(o.id) ? {...o,status:"expired"} : o);
        }

        const openOrders = prev.filter(o =>
          (o.status==="open"||o.status==="partial") && !expiredIds.has(o.id)
        );
        if (!openOrders.length) return prev;

        const result = matchOrders(prev, marketPricesRef.current, holdingsRef.current, balanceRef.current);
        if (result.newTrades.length) {
          setHoldings(result.holdings);
          setBalance(result.balance);
          setTradeHistory(h => [...result.newTrades, ...h]);
          result.newTrades.forEach(t => {
            const card = CARDS.find(c => c.id === t.cardId) || { name:"Card" };
            pushNotification(
              t.side==="buy" ? "filled_buy" : "filled_sell",
              `${t.side==="buy"?"Bought":"Sold"} ${t.qty}× ${card.name} @ $${t.price.toLocaleString("en-US",{minimumFractionDigits:2})}`
            );
          });
        }
        return result.orders;
      });
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────
  const calcExpiresAt = (expiry) => {
    if (!expiry || expiry==="gtc") return null;
    const d = new Date();
    if (expiry==="day")   d.setHours(23,59,59,999);
    if (expiry==="week")  d.setDate(d.getDate()+7);
    if (expiry==="month") d.setMonth(d.getMonth()+1);
    return d.toISOString();
  };

  const placeOrder = (orderData) => {
    const expiresAt = calcExpiresAt(orderData.expiry||"gtc");
    const o = {
      id: newOrderId(), ...orderData,
      cardId: +orderData.cardId, filled: 0, status: "open",
      time: nowTime(), date: nowDate(),
      expiry: orderData.expiry||"gtc", expiresAt,
    };
    if (o.type === "market") {
      const result = matchOrders([o], marketPrices, holdings, balance);
      setOrders(prev => [result.orders[0], ...prev]);
      if (result.newTrades.length) {
        setHoldings(result.holdings);
        setBalance(result.balance);
        setTradeHistory(h => [...result.newTrades, ...h]);
        result.newTrades.forEach(t => {
          const card = CARDS.find(c => c.id === t.cardId) || { name:"Card" };
          pushNotification(
            t.side==="buy"?"filled_buy":"filled_sell",
            `${t.side==="buy"?"Bought":"Sold"} ${t.qty}× ${card.name} @ $${t.price.toLocaleString("en-US",{minimumFractionDigits:2})}`
          );
        });
      }
    } else {
      if (o.side === "sell") {
        setHoldings(prev => prev.map(h => {
          if (h.cardId !== o.cardId) return h;
          return { ...h, lockedQty: (h.lockedQty||0) + o.qty };
        }));
      }
      setOrders(prev => [o, ...prev]);
    }
  };

  const cancelOrder = (id) => {
    const orderToCancel = orders.find(o => o.id===id);
    setOrders(prev =>
      prev.map(o =>
        o.id===id && (o.status==="open"||o.status==="partial")
          ? {...o, status:"cancelled"} : o
      )
    );
    if (orderToCancel?.side==="sell" && (orderToCancel.status==="open"||orderToCancel.status==="partial")) {
      const unfilledQty = orderToCancel.qty - orderToCancel.filled;
      setHoldings(prev => prev.map(h => {
        if (h.cardId !== orderToCancel.cardId) return h;
        return { ...h, lockedQty: Math.max(0,(h.lockedQty||0)-unfilledQty) };
      }));
    }
  };

  const handleCSVImport = (importedRows, listingPrices={}, listSelected={}) => {
    const toAdd = importedRows.filter(r => r.matchedCard);
    setHoldings(prev => {
      const updated = [...prev];
      toAdd.forEach(r => {
        const idx = updated.findIndex(h => h.cardId===r.matchedCard.id);
        if (idx>=0) { updated[idx] = {...updated[idx], qty: updated[idx].qty+r.qty}; }
        else { updated.push({ cardId:r.matchedCard.id, qty:r.qty, avgCost:r.matchedCard.basePrice||BASE[r.matchedCard.id]||0, acquired:nowDate(), lockedQty:0 }); }
      });
      return updated;
    });
    const toList = importedRows.filter((r,i) => r.matchedCard && listSelected[i]!==false && listingPrices[i]);
    toList.forEach(r => {
      const price = parseFloat(listingPrices[importedRows.indexOf(r)]);
      if (price>0) placeOrder({ cardId:r.matchedCard.id, side:"sell", type:"limit", price, qty:r.qty });
    });
    pushNotification("import", `Imported ${toAdd.length} card${toAdd.length!==1?"s":""} from CSV${toList.length?` · ${toList.length} listed for sale`:""}`);
  };

  const handleUpdatePrice = (cardId, price) =>
    setMarketPrices(p => ({...p, [cardId]:price}));

  const pushNotification = (type, message) => {
    if (!DEFAULT_NOTIF_PREFS[type]) return;
    const notif = { id:`N-${Date.now()}`, type, message, time:nowTime(), read:false };
    setNotifications(prev => [notif, ...prev].slice(0, 50));
    setTimeout(() =>
      setNotifications(prev => prev.map(n => n.id===notif.id ? {...n,read:true} : n))
    , 8000);
  };

  const handleBrowseSelect = (card) => { setSelectedCard(card); setTab("MARKET"); };

  // ── Mobile drawer ─────────────────────────────────────────────
  const MobileDrawer = () => (
    <>
      <div className="overlay" onClick={() => setDrawerOpen(false)}
        style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200}}/>
      <div className="drawer" style={{position:"fixed",top:0,left:0,bottom:0,width:"75vw",maxWidth:"280px",background:D.hdrBg,borderRight:`1px solid ${D.bdr2}`,zIndex:201,display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px",borderBottom:`1px solid ${D.bdr}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontFamily:ORB,fontSize:"22px",fontWeight:800,color:D.acc,letterSpacing:"0.18em"}}>◈ CX</span>
          <button onClick={() => setDrawerOpen(false)} style={{background:"none",border:"none",color:D.txtD,fontSize:"29px",padding:"4px 8px"}}>✕</button>
        </div>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${D.bdr}`}}>
          <div style={{color:D.txtM,fontSize:"16px",marginBottom:"4px"}}>👤 {DEMO_USERNAME}</div>
          <div style={{color:D.acc,fontSize:"19px",fontWeight:"bold"}}>💵 ${balance.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
        </div>
        <div style={{flex:1,padding:"8px 0"}}>
          {["MARKET","BROWSE","PORTFOLIO","ORDERS","HISTORY"].map(t => (
            <button key={t} onClick={() => { setTab(t); setDrawerOpen(false); }}
              style={{display:"block",width:"100%",padding:"14px 20px",border:"none",
                background:tab===t?(dark?"rgba(0,255,80,0.08)":"rgba(22,128,58,0.07)"):"transparent",
                color:tab===t?D.accD:D.txtM,fontSize:"16px",fontFamily:MONO,
                letterSpacing:"0.12em",textAlign:"left",
                borderLeft:`3px solid ${tab===t?D.accD:"transparent"}`,cursor:"pointer"}}>
              {t}
            </button>
          ))}
        </div>
        <div style={{padding:"16px",borderTop:`1px solid ${D.bdr}`,display:"flex",flexDirection:"column",gap:"8px"}}>
          <div onClick={() => setDark(d => !d)}
            style={{display:"flex",alignItems:"center",gap:"10px",cursor:"pointer",padding:"8px 0"}}>
            <div style={{width:"36px",height:"20px",background:dark?"#1a3a1a":"#d1ecd1",borderRadius:"10px",border:`1px solid ${D.bdr2}`,display:"flex",alignItems:"center",padding:"2px"}}>
              <div style={{width:"14px",height:"14px",borderRadius:"50%",background:dark?"#00cc40":"#f59e0b",transform:dark?"translateX(0)":"translateX(16px)",transition:"transform 0.3s"}}/>
            </div>
            <span style={{color:D.txtM,fontSize:"14px"}}>{dark?"DARK MODE":"LIGHT MODE"}</span>
          </div>
          <button onClick={() => { setCsvModal(true); setDrawerOpen(false); }}
            style={{padding:"10px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"4px",color:D.txtD,fontSize:"14px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>
            📂 IMPORT CSV
          </button>
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={() => navigate('/landing')}
              style={{flex:1,padding:"10px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"4px",color:D.txtD,fontSize:"14px",fontFamily:MONO,cursor:"pointer"}}>
              ← EXIT DEMO
            </button>
            <button onClick={() => setAuthModal("signup")}
              style={{flex:1,padding:"10px",background:dark?"rgba(0,120,40,0.15)":"rgba(22,128,58,0.08)",border:`1px solid ${D.accD}`,borderRadius:"4px",color:D.accD,fontSize:"14px",fontFamily:MONO,cursor:"pointer"}}>
              SIGN UP
            </button>
          </div>
        </div>
      </div>
    </>
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{background:D.bg,color:D.txt,minHeight:"100vh",display:"flex",flexDirection:"column",fontFamily:MONO}}>

      {/* Demo banner */}
      <div style={{background:dark?"rgba(0,120,40,0.12)":"rgba(22,128,58,0.08)",borderBottom:`1px solid ${dark?"#1a4a1a":"#a8d4a8"}`,padding:"7px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <span style={{color:dark?"#4a8a4a":"#3a7a3a",fontSize:"14px",letterSpacing:"0.1em"}}>
          ▸ DEMO MODE — Orders reset on refresh.{" "}
          <span style={{color:D.accD,cursor:"pointer",textDecoration:"underline"}}
            onClick={() => setAuthModal("signup")}>
            Create a free account
          </span>{" "}
          to save your trades.
        </span>
        <button onClick={() => setAuthModal("signup")}
          style={{padding:"4px 12px",background:dark?"rgba(0,180,60,0.15)":"rgba(22,128,58,0.10)",border:`1px solid ${dark?"#1a4a1a":"#8acc8a"}`,borderRadius:"4px",color:D.accD,fontSize:"13px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>
          SIGN UP →
        </button>
      </div>

      {/* Ticker */}
      <Ticker D={D} dark={dark} tradeHistory={tradeHistory} dbCards={[]} marketPrices={marketPrices}/>

      {/* CSV Modal */}
      {csvModal && (
        <CSVImportModal D={D} dark={dark} dbCards={[]} onImport={handleCSVImport}
          onClose={() => setCsvModal(false)} marketPrices={marketPrices} tradeHistory={tradeHistory}/>
      )}

      {/* Auth modal — sign up/login routes to /landing then /app */}
      {authModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={() => setAuthModal(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{background:D.bg2,border:`1px solid ${D.bdr2}`,borderRadius:"10px",padding:"32px",maxWidth:"380px",width:"90%",textAlign:"center"}}>
            <div style={{fontFamily:ORB,fontSize:"18px",color:D.acc,letterSpacing:"0.18em",marginBottom:"8px"}}>◈ CX</div>
            <div style={{fontFamily:ORB,fontSize:"14px",color:D.txt,marginBottom:"8px",letterSpacing:"0.08em"}}>
              {authModal==="signup" ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}
            </div>
            <div style={{color:D.txtD,fontSize:"12px",marginBottom:"24px",lineHeight:"1.6"}}>
              Your demo progress won't carry over, but you'll get a real account with live trading.
            </div>
            <button onClick={() => navigate('/landing')}
              style={{width:"100%",padding:"12px",background:dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#cceacc,#a8d8a8)",border:`1px solid ${dark?"#1a5a2a":"#7ab07a"}`,borderRadius:"6px",color:dark?"#00ff55":"#1a5a2a",fontSize:"13px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.1em",fontWeight:"bold",marginBottom:"10px"}}>
              {authModal==="signup" ? "→ SIGN UP ON LANDING PAGE" : "→ LOG IN ON LANDING PAGE"}
            </button>
            <button onClick={() => setAuthModal(null)}
              style={{background:"none",border:"none",color:D.txtD,fontSize:"12px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>
              STAY IN DEMO
            </button>
          </div>
        </div>
      )}

      {/* Mobile drawer */}
      {isMobile && drawerOpen && <MobileDrawer/>}

      {/* Nav bar */}
      <div style={{background:D.hdrBg,borderBottom:`1px solid ${D.bdr2}`,padding:isMobile?"0 12px":"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:"44px",position:"sticky",top:0,zIndex:100,boxShadow:D.shad,flexShrink:0}}>
        {isMobile ? (
          <>
            <button onClick={() => setDrawerOpen(true)}
              style={{background:"none",border:`1px solid ${D.bdr}`,borderRadius:"4px",color:D.txtM,fontSize:"26px",padding:"4px 8px",lineHeight:1,cursor:"pointer"}}>☰</button>
            <div style={{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer"}} onClick={() => navigate('/landing')}>
              <span style={{fontFamily:ORB,fontSize:"22px",fontWeight:800,color:D.acc,letterSpacing:"0.18em",textShadow:dark?"0 0 22px rgba(0,255,80,0.45)":"none"}}>◈ CX</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              <span style={{color:D.txtM,fontSize:"16px"}}>💵 ${balance.toLocaleString("en-US",{maximumFractionDigits:0})}</span>
              <div onClick={() => setDark(d => !d)}
                style={{width:"36px",height:"20px",background:dark?"#1a3a1a":"#d1ecd1",borderRadius:"10px",border:`1px solid ${D.bdr2}`,display:"flex",alignItems:"center",padding:"2px",cursor:"pointer"}}>
                <div style={{width:"14px",height:"14px",borderRadius:"50%",background:dark?"#00cc40":"#f59e0b",transform:dark?"translateX(0)":"translateX(16px)",transition:"transform 0.3s"}}/>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer"}} onClick={() => navigate('/landing')}>
                <span style={{fontFamily:ORB,fontSize:"23px",fontWeight:800,color:D.acc,letterSpacing:"0.18em",textShadow:dark?"0 0 22px rgba(0,255,80,0.45)":"none"}}>◈ CX</span>
                <span style={{fontFamily:ORB,fontSize:"16px",fontWeight:600,color:D.txtM,letterSpacing:"0.08em"}}>COLLECTOR'S EXCHANGE</span>
              </div>
              <span style={{color:D.bdr2}}>|</span>
              <span style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.14em",fontStyle:"italic"}}>Buy. Sell. Collect.</span>
            </div>
            <div style={{display:"flex",gap:"2px",alignItems:"center"}}>
              {["MARKET","BROWSE","PORTFOLIO","ORDERS","HISTORY"].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{padding:"0 16px",height:"44px",border:"none",background:"transparent",
                    color:tab===t?D.accD:D.txtD,fontSize:"14px",fontFamily:MONO,letterSpacing:"0.12em",
                    borderBottom:`2px solid ${tab===t?D.accD:"transparent"}`,transition:"all 0.12s",cursor:"pointer"}}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
              <div style={{color:D.txtM,fontSize:"13px",fontFamily:MONO,letterSpacing:"0.08em"}}>
                👤 {DEMO_USERNAME}
              </div>
              <div style={{background:D.stBg,border:`1px solid ${D.bdr}`,borderRadius:"3px",padding:"3px 10px",fontSize:"16px",color:D.txtM}}>
                💵 ${balance.toLocaleString("en-US",{minimumFractionDigits:2})}
              </div>
              <NotificationBell D={D} dark={dark} notifications={notifications}
                onClear={id => setNotifications(p => p.filter(n => n.id!==id))}
                onClearAll={() => setNotifications([])}/>
              <button onClick={() => setCsvModal(true)} title="Import CSV"
                style={{padding:"3px 8px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"3px",color:D.txtD,fontSize:"19px",cursor:"pointer"}}>📂</button>
              <button onClick={() => navigate('/landing')}
                style={{padding:"3px 10px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"3px",color:D.txtD,fontSize:"13px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>
                ← EXIT DEMO
              </button>
              <button onClick={() => setAuthModal("signup")}
                style={{padding:"3px 10px",background:dark?"rgba(0,120,40,0.15)":"rgba(22,128,58,0.08)",border:`1px solid ${D.accD}`,borderRadius:"3px",color:D.accD,fontSize:"13px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>
                SIGN UP
              </button>
              <div onClick={() => setDark(d => !d)}
                style={{width:"44px",height:"24px",background:dark?"#1a3a1a":"#d1ecd1",borderRadius:"12px",border:`1px solid ${D.bdr2}`,display:"flex",alignItems:"center",padding:"3px",cursor:"pointer"}}>
                <div style={{width:"16px",height:"16px",borderRadius:"50%",background:dark?"#00cc40":"#f59e0b",transform:dark?"translateX(0)":"translateX(20px)",transition:"transform 0.3s,background 0.3s",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px"}}>
                  {dark?"🌙":"☀️"}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile bottom tab bar */}
      {isMobile && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:D.hdrBg,borderTop:`1px solid ${D.bdr2}`,display:"flex",zIndex:100,height:"54px",boxShadow:"0 -2px 12px rgba(0,0,0,0.15)"}}>
          {[{t:"MARKET",i:"📈"},{t:"BROWSE",i:"🔍"},{t:"PORTFOLIO",i:"💼"},{t:"ORDERS",i:"📋"},{t:"HISTORY",i:"📜"}].map(({t,i}) => (
            <button key={t} onClick={() => setTab(t)}
              style={{flex:1,border:"none",background:"transparent",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"2px",color:tab===t?D.accD:D.txtD,fontSize:"12px",fontFamily:MONO,letterSpacing:"0.06em",borderTop:`2px solid ${tab===t?D.accD:"transparent"}`,cursor:"pointer",padding:"6px 0"}}>
              <span style={{fontSize:"23px"}}>{i}</span>
              <span>{t}</span>
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      <div style={{flex:1,display:"flex",overflow:"hidden",paddingBottom:isMobile?"54px":"0"}}>
        {tab==="MARKET"    && <Market    D={D} dark={dark} dbCards={[]} initialCard={selectedCard} balance={balance} holdings={holdings} onPlaceOrder={placeOrder} onUpdatePrice={handleUpdatePrice} tradeHistory={tradeHistory} isDemo={true} isMobile={isMobile}/>}
        {tab==="BROWSE"    && <Browser   D={D} dark={dark} dbCards={[]} onSelectCard={handleBrowseSelect} isMobile={isMobile}/>}
        {tab==="PORTFOLIO" && <Portfolio D={D} dark={dark} holdings={holdings} tradeHistory={tradeHistory} dbCards={[]} isMobile={isMobile} onNavigateToMarket={c => { setSelectedCard(c); setTab("MARKET"); }}/>}
        {tab==="ORDERS"    && <Orders    D={D} dark={dark} orders={orders} onCancel={cancelOrder} dbCards={[]} isMobile={isMobile}/>}
        {tab==="HISTORY"   && <History   D={D} dark={dark} tradeHistory={tradeHistory} ledger={DEMO_LEDGER} dbCards={[]} isMobile={isMobile}/>}
      </div>
    </div>
  );
}
