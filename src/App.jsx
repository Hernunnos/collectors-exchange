import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import DemoApp from "./DemoApp";
import LiveApp from "./LiveApp";
import { Landing, AuthModal, DK, LT } from "./tcg-market";

const MONO = "'Share Tech Mono', monospace";
const ORB  = "'Orbitron', sans-serif";

// ── Global styles ──────────────────────────────────────────────
function GlobalStyles({ dark }) {
  const D = dark ? DK : LT;
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@600;800&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:${MONO};background:${D.bg};color:${D.txt};}
      ::-webkit-scrollbar{width:4px;height:4px;}
      ::-webkit-scrollbar-track{background:${D.bg};}
      ::-webkit-scrollbar-thumb{background:${D.bdr2};border-radius:2px;}
      input{outline:none;font-family:${MONO};}
      input:focus{border-color:${D.accD}!important;}
      button{cursor:pointer;}
      select{outline:none;}
      @keyframes fG{0%,100%{background:transparent}50%{background:rgba(0,200,60,0.14)}}
      @keyframes fR{0%,100%{background:transparent}50%{background:rgba(220,50,50,0.14)}}
      .fu{animation:fG 0.4s ease;} .fd{animation:fR 0.4s ease;}
      @keyframes tickerScroll{0%{transform:translateX(0)}100%{transform:translateX(-33.333%)}}
      @keyframes notifPop{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
      .notif-toast{animation:notifPop 0.2s ease;}
      @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
      @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      .drawer{animation:slideIn 0.22s ease;}
      .sheet{animation:slideUp 0.22s ease;}
      .overlay{animation:fadeIn 0.18s ease;}
      @media(max-width:480px){
        .desktop-only{display:none!important;}
        .mobile-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}
        input,select,button{font-size:16px!important;}
      }
      @media(min-width:481px){.mobile-only{display:none!important;}}
    `}</style>
  );
}

// ── Shared loading screen ──────────────────────────────────────
function LoadingScreen({ dark }) {
  const D = dark ? DK : LT;
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:D.bg,flexDirection:"column",gap:"16px"}}>
      <div style={{fontFamily:ORB,fontSize:"22px",color:D.acc,letterSpacing:"0.18em"}}>◈ CX</div>
      <div style={{fontFamily:MONO,fontSize:"11px",color:D.txtD,letterSpacing:"0.14em"}}>LOADING...</div>
    </div>
  );
}

// ── Set Password screen (shown after invite link click) ────────
function SetPasswordScreen({ dark }) {
  const D = dark ? DK : LT;
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [status, setStatus]     = useState(null); // null | 'loading' | 'error' | 'done'
  const [error, setError]       = useState("");

  const submit = async () => {
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setStatus("loading");
    setError("");
    const { supabase } = await import('./supabase');
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(err.message); setStatus(null); return; }
    setStatus("done");
    setTimeout(() => navigate('/app', { replace: true }), 1200);
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:D.bg}}>
      <div style={{background:D.bg2,border:`1px solid ${D.bdr2}`,borderRadius:"10px",padding:"36px 32px",width:"100%",maxWidth:"380px",display:"flex",flexDirection:"column",gap:"18px"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:ORB,fontSize:"22px",color:D.acc,letterSpacing:"0.18em",marginBottom:"6px"}}>◈ CX</div>
          <div style={{color:D.txtD,fontSize:"13px",letterSpacing:"0.12em"}}>SET YOUR PASSWORD</div>
        </div>
        {status === "done" ? (
          <div style={{textAlign:"center",color:D.buyT,fontSize:"15px",padding:"12px 0"}}>✓ Password set — taking you in...</div>
        ) : (
          <>
            <div>
              <div style={{color:D.txtD,fontSize:"12px",letterSpacing:"0.1em",marginBottom:"6px"}}>PASSWORD</div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"5px",padding:"10px 12px",color:D.txt,fontSize:"15px",fontFamily:MONO}}
              />
            </div>
            <div>
              <div style={{color:D.txtD,fontSize:"12px",letterSpacing:"0.1em",marginBottom:"6px"}}>CONFIRM PASSWORD</div>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="Repeat password"
                style={{width:"100%",background:D.inBg,border:`1px solid ${D.inBdr}`,borderRadius:"5px",padding:"10px 12px",color:D.txt,fontSize:"15px",fontFamily:MONO}}
              />
            </div>
            {error && <div style={{color:D.askT,fontSize:"13px"}}>{error}</div>}
            <button
              onClick={submit}
              disabled={status === "loading"}
              style={{padding:"12px",background:dark?"linear-gradient(135deg,#0a3a1a,#0f5a28)":"linear-gradient(135deg,#cceacc,#a8d8a8)",border:`1px solid ${dark?"#1a5a2a":"#7ab07a"}`,borderRadius:"6px",color:dark?"#00ff55":"#1a5a2a",fontSize:"14px",fontFamily:MONO,letterSpacing:"0.12em",fontWeight:"bold",cursor:"pointer"}}>
              {status === "loading" ? "SAVING..." : "SET PASSWORD & ENTER →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('cx_dark') === 'true'; } catch { return false; }
  });
  const toggleDark = (v) => {
    const next = typeof v === 'boolean' ? v : !dark;
    setDark(next);
    try { localStorage.setItem('cx_dark', next); } catch {}
  };

  return (
    <BrowserRouter>
      <GlobalStyles dark={dark} />
      <Routes>
        <Route path="/"        element={<IndexRoute dark={dark} />} />
        <Route path="/landing" element={<LandingRoute dark={dark} setDark={toggleDark} />} />
        <Route path="/demo"    element={<DemoApp dark={dark} setDark={toggleDark} />} />
        <Route path="/app"     element={<LiveRoute dark={dark} setDark={toggleDark} />} />
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// ── / → check session then redirect ───────────────────────────
function IndexRoute({ dark }) {
  const navigate = useNavigate();

  useEffect(() => {
    // Check for invite/recovery token in URL hash first
    const hash = window.location.hash;
    if (hash.includes('type=invite') || hash.includes('type=recovery')) {
      navigate('/app', { replace: true });
      return;
    }
    import('./supabase').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        navigate(session?.user ? '/app' : '/landing', { replace: true });
      });
    });
  }, []);

  return <LoadingScreen dark={dark} />;
}

// ── /landing ───────────────────────────────────────────────────
function LandingRoute({ dark, setDark }) {
  const navigate = useNavigate();
  const D = dark ? DK : LT;
  const [dbCards, setDbCards] = useState([]);
  const [authMode, setAuthMode] = useState(null);

  useEffect(() => {
    import('./supabase').then(({ supabase }) => {
      supabase.from('cards').select('*').eq('condition','NM').eq('language','English').limit(20).then(({ data, error }) => {
        if (!error && data) {
          setDbCards(data.map(c => ({
            id: c.id, name: c.name, set: c.set_name, set_name: c.set_name,
            condition: c.condition, rarity: c.rarity, game: c.game,
            img: c.img_url, img_url: c.img_url,
            basePrice: c.base_price || 0, language: c.language || "English",
          })));
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) navigate('/app', { replace: true });
      });
      return () => subscription.unsubscribe();
    });
  }, []);

  return (
    <>
      {authMode && (
        <AuthModal
          D={D}
          dark={dark}
          onClose={() => setAuthMode(null)}
          onAuth={() => navigate('/app', { replace: true })}
        />
      )}
      <Landing
        D={D}
        dark={dark}
        dbCards={dbCards}
        onEnterDemo={() => navigate('/demo')}
        onOpenAuth={(mode) => setAuthMode(mode || 'login')}
      />
    </>
  );
}

// ── /app → requires auth, handles invite tokens ───────────────
function LiveRoute({ dark, setDark }) {
  const navigate = useNavigate();
  const [user, setUser]         = useState(null);
  const [ready, setReady]       = useState(false);
  const [isInvite, setIsInvite] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const isInviteFlow = hash.includes('type=invite');

    if (isInviteFlow) {
      // Let Supabase process the token from the hash
      import('./supabase').then(({ supabase }) => {
        // onAuthStateChange fires when Supabase processes the hash token
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'USER_UPDATED' || event === 'SIGNED_IN') {
            if (session?.user) {
              setUser(session.user);
              setIsInvite(true);
              setReady(true);
            }
          }
        });
        // Also try getSession in case already processed
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            setUser(session.user);
            setIsInvite(true);
            setReady(true);
          }
        });
        return () => subscription.unsubscribe();
      });
      return;
    }

    import('./supabase').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) {
          navigate('/landing', { replace: true });
          return;
        }
        setUser(session.user);
        setReady(true);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) navigate('/landing', { replace: true });
      });
      return () => subscription.unsubscribe();
    });
  }, []);

  if (!ready) return <LoadingScreen dark={dark} />;
  if (isInvite) return <SetPasswordScreen dark={dark} />;
  return <LiveApp dark={dark} setDark={setDark} user={user} />;
}