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

// ── Root ───────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(false);

  return (
    <BrowserRouter>
      <GlobalStyles dark={dark} />
      <Routes>
        <Route path="/"        element={<IndexRoute dark={dark} />} />
        <Route path="/landing" element={<LandingRoute dark={dark} setDark={setDark} />} />
        <Route path="/demo"    element={<DemoApp dark={dark} setDark={setDark} />} />
        <Route path="/app"     element={<LiveRoute dark={dark} setDark={setDark} />} />
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// ── / → check session then redirect ───────────────────────────
function IndexRoute({ dark }) {
  const navigate = useNavigate();

  useEffect(() => {
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
  const [authMode, setAuthMode] = useState(null); // null | "login" | "signup"

  useEffect(() => {
    import('./supabase').then(({ supabase }) => {
      // Load cards for landing page
      supabase.from('cards').select('*').then(({ data, error }) => {
        if (!error && data) {
          setDbCards(data.map(c => ({
            id: c.id, name: c.name, set: c.set_name, set_name: c.set_name,
            condition: c.condition, rarity: c.rarity, game: c.game,
            img: c.img_url, img_url: c.img_url,
            basePrice: c.base_price || 0, language: c.language || "English",
          })));
        }
      });

      // Redirect to /app if user signs in
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

// ── /app → requires auth, renders LiveApp directly ────────────
function LiveRoute({ dark, setDark }) {
  const navigate = useNavigate();
  const [user, setUser]   = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
  return <LiveApp dark={dark} setDark={setDark} user={user} />;
}