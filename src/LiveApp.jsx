/**
 * LiveApp.jsx
 * ─────────────────────────────────────────────────────────────
 * The real authenticated app.
 * - No fake data, no demo balance
 * - All state persisted to Supabase
 * - New users start with $0, empty portfolio
 * - Profile tab available for real users
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

// ── Shared UI components ──────────────────────────────────────
import {
  Market,
  Browser,
  Portfolio,
  Orders,
  History,
  Ticker,
  NotificationBell,
  CSVImportModal,
  ProfileSettings,
  AdminPanel,
  RepBadge,
} from "./tcg-market";

// ── Shared constants and helpers ──────────────────────────────
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
  newTradeId,
  useIsMobile,
} from "./tcg-market";

// ── Live app starts users with no money — they deposit themselves ─
const LIVE_STARTING_BALANCE = 0;

export default function LiveApp({ dark, setDark, user: initialUser }) {
  const navigate  = useNavigate();
  const isMobile  = useIsMobile();
  const D         = dark ? DK : LT;

  // ── Auth & user state ─────────────────────────────────────────
  const [user,         setUser]         = useState(initialUser);
  const [profile,      setProfile]      = useState(null);
  const [adminOpen,    setAdminOpen]    = useState(false);

  // ── UI state ──────────────────────────────────────────────────
  const [tab,          setTab]          = useState("MARKET");
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [csvModal,     setCsvModal]     = useState(false);
  const [notifications,setNotifications]= useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showPushPrompt,setShowPushPrompt]=useState(false);
  const [notifPrefs,   setNotifPrefs]   = useState(()=>{
    try { return JSON.parse(localStorage.getItem("cx_notif_prefs")||"{}"); } catch { return {}; }
  });
  const notifOn = (key) => notifPrefs[key] !== false;

  // ── Trading state — loaded from Supabase ──────────────────────
  const [balance,      setBalance]      = useState(LIVE_STARTING_BALANCE);
  const [orders,       setOrders]       = useState([]);
  const [holdings,     setHoldings]     = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [ledger,       setLedger]       = useState([]);
  const [dbCards,      setDbCards]      = useState([]);
  const [marketPrices, setMarketPrices] = useState({});

  // ── Refs for match engine ────────────────────────────────────
  const balanceRef      = useRef(balance);
  const holdingsRef     = useRef(holdings);
  const marketPricesRef = useRef(marketPrices);
  const userRef         = useRef(user);
  const dbCardsRef      = useRef(dbCards);
  useEffect(() => { balanceRef.current = balance; },           [balance]);
  useEffect(() => { holdingsRef.current = holdings; },         [holdings]);
  useEffect(() => { marketPricesRef.current = marketPrices; }, [marketPrices]);
  useEffect(() => { userRef.current = user; },                 [user]);
  useEffect(() => { dbCardsRef.current = dbCards; },           [dbCards]);

  // ── Rate limiter refs ─────────────────────────────────────────
  const lastSaveRef    = useRef(0);
  const saveCountRef   = useRef({ count:0, windowStart:Date.now() });
  const pendingSaveRef = useRef(null);

  // ── On mount: load cards + user data ─────────────────────────
  useEffect(() => {
    document.title = "Collector's Exchange";
    import('./supabase').then(({ supabase }) => {
      // Load card catalogue from DB
      supabase.from('cards').select('*').then(({ data, error }) => {
        if (!error && data) {
          const fmt = data.map(c => ({
            id: c.id, name: c.name, set: c.set_name, set_name: c.set_name,
            condition: c.condition, rarity: c.rarity, game: c.game,
            img: c.img_url, img_url: c.img_url,
            basePrice: c.base_price || BASE[c.id] || 0,
            language: c.language || "English",
          }));
          setDbCards(fmt);
          const prices = {};
          fmt.forEach(c => { prices[c.id] = c.basePrice || 0; });
          setMarketPrices(prices);
        }
      });

      // Load user data
      if (user?.id) loadUserData(supabase, user.id);

      // Keep auth state in sync
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) {
          navigate('/landing', { replace: true });
        } else {
          setUser(session.user);
        }
      });
      return () => subscription.unsubscribe();
    });
  }, []);

  // ── Ask for push notifications once user is in ───────────────
  useEffect(() => {
    if (user && typeof Notification !== "undefined" && Notification.permission === "default") {
      const t = setTimeout(() => setShowPushPrompt(true), 2500);
      return () => clearTimeout(t);
    }
  }, [user]);

  // ── Load all user data from Supabase ─────────────────────────
  const loadUserData = async (sb, uid) => {
    const [balRes, ordRes, holdRes, trdRes, profRes, ledRes] = await Promise.all([
      sb.from('user_balance').select('balance').eq('user_id', uid),
      sb.from('user_orders').select('*').eq('user_id', uid).order('date', { ascending:false }),
      sb.from('user_holdings').select('*').eq('user_id', uid),
      sb.from('user_trades').select('*').eq('user_id', uid).order('date', { ascending:false }),
      sb.from('user_profiles').select('*').eq('user_id', uid),
      sb.from('user_ledger').select('*').eq('user_id', uid).order('date', { ascending:false }),
    ]);

    // Balance — new users get $0, no seeded money
    if (balRes.data?.length) {
      setBalance(+balRes.data[0].balance);
    } else {
      await sb.from('user_balance').insert({ user_id: uid, balance: LIVE_STARTING_BALANCE });
      setBalance(LIVE_STARTING_BALANCE);
    }

    setOrders(ordRes.data?.length
      ? ordRes.data.map(o => ({
          id: o.id, cardId: +o.card_id, side: o.side, type: o.type,
          price: +o.price, qty: +o.qty, filled: +o.filled, status: o.status,
          time: o.time, date: o.date, expiry: o.expiry||'gtc', expiresAt: o.expires_at||null,
        }))
      : []);

    setHoldings(holdRes.data?.length
      ? holdRes.data.map(h => ({
          cardId: +h.card_id, qty: +h.qty, avgCost: +h.avg_cost,
          acquired: h.acquired, lockedQty: +(h.locked_qty||0),
        }))
      : []);

    setTradeHistory(trdRes.data?.length
      ? trdRes.data.map(t => ({
          id: t.id, cardId: +t.card_id, side: t.side,
          price: +t.price, qty: +t.qty, total: +t.total, date: t.date, time: t.time,
        }))
      : []);

    if (profRes.data?.length) setProfile(profRes.data[0]);

    setLedger(ledRes.data?.length
      ? ledRes.data.map(l => ({
          id: l.id, type: l.type, amount: +l.amount,
          method: l.method, date: l.date,
        }))
      : []);
  };

  // ── Save to Supabase with rate limiting ───────────────────────
  const saveToDb = async (sb, uid, newOrders, newHoldings, newTrades, newBalance, { urgent=false }={}) => {
    if (!uid) return;
    const now = Date.now();

    // Per-minute write counter
    const w = saveCountRef.current;
    if (now - w.windowStart > 60000) { saveCountRef.current = { count:1, windowStart:now }; }
    else { w.count++; }
    if (w.count > 20) console.warn(`[CX] High DB write rate: ${w.count} writes/min`);

    // Cooldown: non-urgent writes wait 10s
    const elapsed = now - lastSaveRef.current;
    const COOLDOWN = 10000;
    if (!urgent && elapsed < COOLDOWN) {
      if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = setTimeout(() => {
        saveToDb(sb, uid, newOrders, newHoldings, newTrades, newBalance, { urgent:true });
      }, COOLDOWN - elapsed + 100);
      return;
    }
    lastSaveRef.current = now;
    if (pendingSaveRef.current) { clearTimeout(pendingSaveRef.current); pendingSaveRef.current = null; }

    // Writes
    const balRes = await sb.from('user_balance').upsert(
      { user_id:uid, balance:newBalance },
      { onConflict:'user_id', ignoreDuplicates:false }
    );
    if (balRes.error) await sb.from('user_balance').insert({ user_id:uid, balance:newBalance });

    if (newOrders?.length) {
      const unique = [...new Map(newOrders.map(o => [o.id, o])).values()];
      await sb.from('user_orders').upsert(
        unique.map(o => ({
          id:o.id, user_id:uid, card_id:o.cardId, side:o.side, type:o.type,
          price:o.price, qty:o.qty, filled:o.filled, status:o.status,
          time:o.time, date:o.date, expiry:o.expiry||'gtc', expires_at:o.expiresAt||null,
        })),
        { onConflict:'id' }
      );
    }

    if (newHoldings !== undefined) {
      await sb.from('user_holdings').delete().eq('user_id', uid);
      if (newHoldings.length) {
        await sb.from('user_holdings').insert(
          newHoldings.map(h => ({
            user_id:uid, card_id:h.cardId, qty:h.qty,
            avg_cost:h.avgCost, acquired:h.acquired, locked_qty:h.lockedQty||0,
          }))
        );
      }
    }

    if (newTrades?.length) {
      await sb.from('user_trades').upsert(
        newTrades.map(t => ({
          id:t.id, user_id:uid, card_id:t.cardId, side:t.side,
          price:t.price, qty:t.qty, total:t.total, date:t.date, time:t.time,
        })),
        { onConflict:'id' }
      );
    }
  };

  // ── Match engine — runs every 2s, saves fills to DB ──────────
  useEffect(() => {
    const iv = setInterval(() => {
      setOrders(prev => {
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
          return prev.map(o => expiredIds.has(o.id) ? {...o, status:"expired"} : o);
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

          // Save to DB
          if (userRef.current) {
            import('./supabase').then(({ supabase }) => {
              saveToDb(supabase, userRef.current.id, result.orders, result.holdings, result.newTrades, result.balance, { urgent:true });
              // Increment trade count on profile
              if (result.newTrades.length) {
                supabase.rpc('increment_trade_count', { uid:userRef.current.id, n:result.newTrades.length })
                  .then(() => {
                    supabase.from('user_profiles').select('trade_count').eq('user_id', userRef.current.id)
                      .then(({ data }) => {
                        if (data?.length) setProfile(p => p ? {...p, trade_count:data[0].trade_count} : p);
                      });
                  });
              }
            });
          }

          result.newTrades.forEach(t => {
            const allC = [...dbCardsRef.current, ...CARDS];
            const card = allC.find(c => c.id===t.cardId) || { name:"Card" };
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

  // ── Order helpers ─────────────────────────────────────────────
  const calcExpiresAt = (expiry) => {
    if (!expiry || expiry==="gtc") return null;
    const d = new Date();
    if (expiry==="day")   d.setHours(23,59,59,999);
    if (expiry==="week")  d.setDate(d.getDate()+7);
    if (expiry==="month") d.setMonth(d.getMonth()+1);
    return d.toISOString();
  };

  const placeOrder = async (orderData) => {
    const expiresAt = calcExpiresAt(orderData.expiry||"gtc");
    const o = {
      id: newOrderId(), ...orderData,
      cardId: +orderData.cardId, filled:0, status:"open",
      time: nowTime(), date: nowDate(),
      expiry: orderData.expiry||"gtc", expiresAt,
    };
    if (o.type === "market") {
      const result = matchOrders([o], marketPrices, holdings, balance);
      const mergedOrders = [result.orders[0], ...orders];
      setOrders(mergedOrders);
      if (result.newTrades.length) {
        setHoldings(result.holdings);
        setBalance(result.balance);
        setTradeHistory(h => [...result.newTrades, ...h]);
        result.newTrades.forEach(t => {
          const allC = [...dbCards, ...CARDS];
          const card = allC.find(c => c.id===t.cardId) || { name:"Card" };
          pushNotification(
            t.side==="buy"?"filled_buy":"filled_sell",
            `${t.side==="buy"?"Bought":"Sold"} ${t.qty}× ${card.name} @ $${t.price.toLocaleString("en-US",{minimumFractionDigits:2})}`
          );
        });
      }
      if (user) {
        const { supabase } = await import('./supabase');
        saveToDb(supabase, user.id, [result.orders[0]], result.holdings, result.newTrades, result.balance, { urgent:true });
      }
    } else {
      let updatedHoldings = holdings;
      if (o.side === "sell") {
        updatedHoldings = holdings.map(h => {
          if (h.cardId !== o.cardId) return h;
          const freeQty = h.qty - (h.lockedQty||0);
          if (freeQty < o.qty) return h;
          return { ...h, lockedQty: (h.lockedQty||0) + o.qty };
        });
        setHoldings(updatedHoldings);
      }
      setOrders(prev => [o, ...prev]);
      if (user) {
        const { supabase } = await import('./supabase');
        saveToDb(supabase, user.id, [o], updatedHoldings, [], balance);
      }
    }
  };

  const cancelOrder = async (id) => {
    const orderToCancel = orders.find(o => o.id===id);
    setOrders(prev =>
      prev.map(o =>
        o.id===id && (o.status==="open"||o.status==="partial")
          ? {...o, status:"cancelled"} : o
      )
    );
    if (user) {
      import('./supabase').then(({ supabase }) =>
        supabase.from('user_orders').update({ status:'cancelled' }).eq('id', id).eq('user_id', user.id)
      );
    }
    if (orderToCancel?.side==="sell" && (orderToCancel.status==="open"||orderToCancel.status==="partial")) {
      const unfilledQty = orderToCancel.qty - orderToCancel.filled;
      setHoldings(prev => {
        const updated = prev.map(h => {
          if (h.cardId !== orderToCancel.cardId) return h;
          return { ...h, lockedQty: Math.max(0,(h.lockedQty||0)-unfilledQty) };
        });
        if (user) import('./supabase').then(({ supabase }) =>
          saveToDb(supabase, user.id, undefined, updated, [], balance)
        );
        return updated;
      });
    }
  };

  const handleCSVImport = (importedRows, listingPrices={}, listSelected={}) => {
    const toAdd = importedRows.filter(r => r.matchedCard);
    setHoldings(prev => {
      const updated = [...prev];
      toAdd.forEach(r => {
        const idx = updated.findIndex(h => h.cardId===r.matchedCard.id);
        if (idx>=0) { updated[idx] = { ...updated[idx], qty: updated[idx].qty+r.qty }; }
        else { updated.push({ cardId:r.matchedCard.id, qty:r.qty, avgCost:r.matchedCard.basePrice||BASE[r.matchedCard.id]||0, acquired:nowDate(), lockedQty:0 }); }
      });
      return updated;
    });
    const toList = importedRows.filter((r,i) => r.matchedCard && listSelected[i]!==false && listingPrices[i]);
    toList.forEach(r => {
      const price = parseFloat(listingPrices[importedRows.indexOf(r)]);
      if (price > 0) placeOrder({ cardId:r.matchedCard.id, side:"sell", type:"limit", price, qty:r.qty });
    });
    const listed = toList.length;
    pushNotification("import", `Imported ${toAdd.length} card${toAdd.length!==1?"s":""} from CSV${listed?` · ${listed} listed for sale`:""}`);
  };

  const handleUpdatePrice    = (cardId, price) => setMarketPrices(p => ({...p, [cardId]:price}));
  const handleBrowseSelect   = (card) => { setSelectedCard(card); setTab("MARKET"); };
  const handleProfileUpdate  = (updated) => setProfile(updated);

  const handleLogout = async () => {
    const { supabase } = await import('./supabase');
    await supabase.auth.signOut();
    sessionStorage.removeItem("cx_session_only");
    navigate('/landing', { replace: true });
  };

  const pushNotification = (type, message) => {
    if (!notifOn(type)) return;
    const notif = { id:`N-${Date.now()}`, type, message, time:nowTime(), read:false };
    setNotifications(prev => [notif, ...prev].slice(0, 50));
    setTimeout(() =>
      setNotifications(prev => prev.map(n => n.id===notif.id ? {...n, read:true} : n))
    , 8000);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try { new Notification("◈ Collector's Exchange", { body:message, icon:"/favicon.ico", tag:type }); } catch {}
    }
  };

  const requestPushPermission = async () => {
    if (typeof Notification === "undefined") return;
    await Notification.requestPermission();
    setShowPushPrompt(false);
  };

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Collector";

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
          <div onClick={() => { setTab("PROFILE"); setDrawerOpen(false); }}
            style={{color:D.txtM,fontSize:"16px",marginBottom:"4px",display:"flex",alignItems:"center",gap:"6px",cursor:"pointer"}}>
            👤 {displayName}
          </div>
          <div style={{marginBottom:"4px"}}><RepBadge tradeCount={profile?.trade_count||tradeHistory.length}/></div>
          <div style={{color:D.acc,fontSize:"19px",fontWeight:"bold"}}>💵 ${balance.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
        </div>
        <div style={{flex:1,padding:"8px 0"}}>
          {["MARKET","BROWSE","PORTFOLIO","ORDERS","HISTORY","PROFILE"].map(t => (
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
          {profile?.is_admin && (
            <button onClick={() => { setAdminOpen(true); setDrawerOpen(false); }}
              style={{padding:"10px",background:"transparent",border:"1px solid #f59e0b",borderRadius:"4px",color:"#f59e0b",fontSize:"14px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>
              ⚙ ADMIN PANEL
            </button>
          )}
          <button onClick={() => { setCsvModal(true); setDrawerOpen(false); }}
            style={{padding:"10px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"4px",color:D.txtD,fontSize:"14px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>
            📂 IMPORT CSV
          </button>
          <button onClick={() => { handleLogout(); setDrawerOpen(false); }}
            style={{padding:"10px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"4px",color:D.txtD,fontSize:"14px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>
            LOG OUT
          </button>
        </div>
      </div>
    </>
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{background:D.bg,color:D.txt,minHeight:"100vh",display:"flex",flexDirection:"column",fontFamily:MONO}}>

      {/* Admin panel */}
      {adminOpen && <AdminPanel D={D} dark={dark} onClose={() => setAdminOpen(false)} currentUserId={user?.id}/>}

      {/* CSV modal */}
      {csvModal && (
        <CSVImportModal D={D} dark={dark} dbCards={dbCards} onImport={handleCSVImport}
          onClose={() => setCsvModal(false)} marketPrices={marketPrices} tradeHistory={tradeHistory}/>
      )}

      {/* Push notification prompt */}
      {showPushPrompt && (
        <div style={{position:"fixed",bottom:"80px",right:"20px",zIndex:600,width:"300px",background:dark?"#1a2a1a":"#f0faf0",border:`1px solid ${dark?"#2a5a2a":"#86efac"}`,borderRadius:"12px",padding:"16px 18px",boxShadow:"0 8px 32px rgba(0,0,0,0.25)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
            <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
              <span style={{fontSize:"31px"}}>🔔</span>
              <div>
                <div style={{fontFamily:ORB,fontSize:"16px",fontWeight:700,color:dark?"#00cc40":"#15803d",letterSpacing:"0.08em"}}>ENABLE NOTIFICATIONS</div>
                <div style={{color:dark?"#6aaa6a":"#4a7a4a",fontSize:"13px",marginTop:"2px"}}>Get alerts for order fills & price targets</div>
              </div>
            </div>
            <button onClick={() => setShowPushPrompt(false)} style={{background:"none",border:"none",color:dark?"#6aaa6a":"#888",fontSize:"23px",cursor:"pointer",lineHeight:1,padding:"0"}}>×</button>
          </div>
          <div style={{color:dark?"#8aaa8a":"#555",fontSize:"14px",marginBottom:"14px",lineHeight:"1.5"}}>
            Allow browser notifications so you hear about fills even when on another tab.
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={requestPushPermission}
              style={{flex:1,padding:"8px",background:dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#cceacc,#a8d8a8)",border:`1px solid ${dark?"#1a5a2a":"#7ab07a"}`,borderRadius:"6px",color:dark?"#00ff55":"#1a5a2a",fontSize:"14px",fontFamily:MONO,cursor:"pointer",fontWeight:"bold",letterSpacing:"0.08em"}}>
              → ALLOW
            </button>
            <button onClick={() => setShowPushPrompt(false)}
              style={{padding:"8px 14px",background:"transparent",border:`1px solid ${dark?"#2a4a2a":"#ccc"}`,borderRadius:"6px",color:dark?"#6aaa6a":"#888",fontSize:"14px",fontFamily:MONO,cursor:"pointer"}}>
              NOT NOW
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
            <div style={{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer"}} onClick={() => setTab("MARKET")}>
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
              <div style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer"}} onClick={() => setTab("MARKET")}>
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
              <span onClick={() => setTab("PROFILE")}
                style={{color:D.txtD,fontSize:"14px",display:"flex",alignItems:"center",gap:"6px",cursor:"pointer",padding:"3px 8px",borderRadius:"4px",border:"1px solid transparent"}}
                onMouseEnter={e => { e.currentTarget.style.borderColor=D.bdr; e.currentTarget.style.background=D.bg3; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.background="transparent"; }}>
                👤 {displayName}
                <RepBadge tradeCount={profile?.trade_count||tradeHistory.length}/>
              </span>
              {profile?.is_admin && (
                <button onClick={() => setAdminOpen(true)}
                  style={{padding:"3px 8px",background:"transparent",border:"1px solid #f59e0b",borderRadius:"3px",color:"#f59e0b",fontSize:"13px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.06em"}}>
                  ⚙ ADMIN
                </button>
              )}
              <div style={{background:D.stBg,border:`1px solid ${D.bdr}`,borderRadius:"3px",padding:"3px 10px",fontSize:"16px",color:D.txtM}}>
                💵 ${balance.toLocaleString("en-US",{minimumFractionDigits:2})}
              </div>
              <NotificationBell D={D} dark={dark} notifications={notifications}
                onClear={id => setNotifications(p => p.filter(n => n.id!==id))}
                onClearAll={() => setNotifications([])}/>
              <button onClick={() => setCsvModal(true)} title="Import CSV"
                style={{padding:"3px 8px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"3px",color:D.txtD,fontSize:"19px",cursor:"pointer"}}>📂</button>
              <button onClick={handleLogout}
                style={{padding:"3px 10px",background:"transparent",border:`1px solid ${D.bdr}`,borderRadius:"3px",color:D.txtD,fontSize:"13px",fontFamily:MONO,cursor:"pointer",letterSpacing:"0.08em"}}>
                LOG OUT
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

      {/* Ticker */}
      <Ticker D={D} dark={dark} tradeHistory={tradeHistory} dbCards={dbCards} marketPrices={marketPrices}/>

      {/* Mobile bottom tab bar */}
      {isMobile && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:D.hdrBg,borderTop:`1px solid ${D.bdr2}`,display:"flex",zIndex:100,height:"54px",boxShadow:"0 -2px 12px rgba(0,0,0,0.15)"}}>
          {[{t:"MARKET",i:"📈"},{t:"BROWSE",i:"🔍"},{t:"PORTFOLIO",i:"💼"},{t:"ORDERS",i:"📋"},{t:"HISTORY",i:"📜"},{t:"PROFILE",i:"👤"}].map(({t,i}) => (
            <button key={t} onClick={() => setTab(t)}
              style={{flex:1,border:"none",background:"transparent",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"2px",color:tab===t?D.accD:D.txtD,fontSize:"12px",fontFamily:MONO,letterSpacing:"0.06em",borderTop:`2px solid ${tab===t?D.accD:"transparent"}`,cursor:"pointer",padding:"6px 0"}}>
              <span style={{fontSize:"18px"}}>{i}</span>
              <span>{t}</span>
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      <div style={{flex:1,display:"flex",overflow:"hidden",paddingBottom:isMobile?"54px":"0"}}>
        {tab==="MARKET"    && <Market    D={D} dark={dark} dbCards={dbCards} initialCard={selectedCard} balance={balance} holdings={holdings} onPlaceOrder={placeOrder} onUpdatePrice={handleUpdatePrice} tradeHistory={tradeHistory} isDemo={false} isMobile={isMobile}/>}
        {tab==="BROWSE"    && <Browser   D={D} dark={dark} dbCards={dbCards} onSelectCard={handleBrowseSelect} isMobile={isMobile}/>}
        {tab==="PORTFOLIO" && <Portfolio D={D} dark={dark} holdings={holdings} tradeHistory={tradeHistory} dbCards={dbCards} isMobile={isMobile} onNavigateToMarket={c => { setSelectedCard(c); setTab("MARKET"); }}/>}
        {tab==="ORDERS"    && <Orders    D={D} dark={dark} orders={orders} onCancel={cancelOrder} dbCards={dbCards} isMobile={isMobile}/>}
        {tab==="HISTORY"   && <History   D={D} dark={dark} tradeHistory={tradeHistory} ledger={ledger} dbCards={dbCards} isMobile={isMobile}/>}
        {tab==="PROFILE"   && <ProfileSettings D={D} dark={dark} user={user} profile={profile} tradeHistory={tradeHistory} holdings={holdings} balance={balance} onProfileUpdate={handleProfileUpdate} onDarkToggle={() => setDark(d=>!d)} isMobile={isMobile} onNotifPrefsChange={p => setNotifPrefs(p)}/>}
      </div>
    </div>
  );
}