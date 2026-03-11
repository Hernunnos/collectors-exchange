import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";

// ── Design tokens (shared between Demo and Live) ───────────────────────────
const MONO = "'Share Tech Mono', monospace";
const ORB  = "'Orbitron', sans-serif";

const DK = {
  bg:"#070a07", bg2:"#0a0f0a", hdrBg:"#080c08",
  txt:"#c8d8c0", txtM:"#8aaa8a", txtD:"#4a6a4a",
  bdr:"#0f2a0f", bdr2:"#1a3a1a",
  acc:"#00cc40", accD:"#00ff55",
  buyT:"#00cc40", askT:"#ff4444",
};
const LT = {
  bg:"#f5f8f5", bg2:"#eef2ee", hdrBg:"#e8f0e8",
  txt:"#1a2a1a", txtM:"#3a5a3a", txtD:"#7a9a7a",
  bdr:"#d5e8d5", bdr2:"#b8d4b8",
  acc:"#15803d", accD:"#15803d",
  buyT:"#15803d", askT:"#dc2626",
};

// ── Global styles injected once ────────────────────────────────────────────
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

// ── Auth gate: checks Supabase session then routes accordingly ─────────────
function AuthGate({ dark, setDark }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser]       = useState(null);
  const navigate              = useNavigate();
  const D                     = dark ? DK : LT;

  useEffect(() => {
    import('./supabase').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser(session.user);
          navigate('/app', { replace: true });
        } else {
          navigate('/landing', { replace: true });
        }
        setLoading(false);
      });

      // Listen for auth changes (login / logout)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser(session.user);
          navigate('/app', { replace: true });
        } else {
          setUser(null);
          navigate('/landing', { replace: true });
        }
      });

      return () => subscription.unsubscribe();
    });
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: D.bg,
      }}>
        <div style={{ fontFamily: ORB, fontSize: "18px", color: D.acc, letterSpacing: "0.18em" }}>
          ◈ CX
        </div>
      </div>
    );
  }

  return null;
}

// ── Root App ───────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(false);

  return (
    <BrowserRouter>
      <GlobalStyles dark={dark} />
      <Routes>
        {/* Entry point — checks session and redirects */}
        <Route path="/" element={<AuthGate dark={dark} setDark={setDark} />} />

        {/* Landing page (shared) */}
        <Route
          path="/landing"
          element={
            <LandingRoute dark={dark} setDark={setDark} />
          }
        />

        {/* Demo — fully self-contained, no auth required */}
        <Route
          path="/demo"
          element={
            <DemoRoute dark={dark} setDark={setDark} />
          }
        />

        {/* Live app — requires auth */}
        <Route
          path="/app"
          element={
            <LiveRoute dark={dark} setDark={setDark} />
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// ── Route wrappers (lazy import DemoApp and LiveApp when needed) ───────────
function LandingRoute({ dark, setDark }) {
  const navigate = useNavigate();
  // Landing is still inside the monolith for now — we'll extract it next
  // For now, dynamically import from the existing file
  const [Comp, setComp] = useState(null);

  useEffect(() => {
    // Landing lives in the main file until we extract it
    import('./tcg-market').then(m => setComp(() => m.LandingPage || m.default));
  }, []);

  if (!Comp) return <LoadingScreen dark={dark} />;

  return (
    <Comp
      dark={dark}
      setDark={setDark}
      onEnterDemo={() => navigate('/demo')}
      onSignIn={() => navigate('/app')}
    />
  );
}

function DemoRoute({ dark, setDark }) {
  const [Comp, setComp] = useState(null);

  useEffect(() => {
    import('./DemoApp').then(m => setComp(() => m.default));
  }, []);

  if (!Comp) return <LoadingScreen dark={dark} />;
  return <Comp dark={dark} setDark={setDark} />;
}

function LiveRoute({ dark, setDark }) {
  const navigate    = useNavigate();
  const [Comp, setComp] = useState(null);
  const [checked, setChecked] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    import('./supabase').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) {
          navigate('/landing', { replace: true });
        } else {
          setUser(session.user);
          import('./LiveApp').then(m => setComp(() => m.default));
        }
        setChecked(true);
      });
    });
  }, []);

  if (!checked || !Comp) return <LoadingScreen dark={dark} />;
  return <Comp dark={dark} setDark={setDark} user={user} />;
}

// ── Shared loading screen ──────────────────────────────────────────────────
function LoadingScreen({ dark }) {
  const D = dark ? DK : LT;
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: D.bg, flexDirection: "column", gap: "16px",
    }}>
      <div style={{ fontFamily: ORB, fontSize: "22px", color: D.acc, letterSpacing: "0.18em" }}>◈ CX</div>
      <div style={{ fontFamily: MONO, fontSize: "11px", color: D.txtD, letterSpacing: "0.14em" }}>LOADING...</div>
    </div>
  );
}
