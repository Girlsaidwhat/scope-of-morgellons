// pages/_app.js
// Build 36.173_2025-09-02
import React, { useEffect, useRef, useState, useMemo } from "react";
import "../styles/globals.css";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

export const BUILD_VERSION = "Build 36.173_2025-09-02";

/* ---------- Shared styles ---------- */
const linkMenu = { display: "block", padding: "8px 2px", fontSize: 15, lineHeight: 1.55, textDecoration: "underline", color: "#f4f4f5", marginBottom: 10 };
const row = { display: "flex", gap: 10, alignItems: "center", justifyContent: "center", flexWrap: "wrap", marginTop: 6 };
const btn = { padding: "10px 14px", border: "1px solid #111", borderRadius: 8, background: "#111", color: "#fff", cursor: "pointer", fontSize: 14 };
const linkBtn = { padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, background: "#fff", color: "#111", fontSize: 12 };

/* ---------- Supabase (browser only) ---------- */
const supabase =
  typeof window !== "undefined"
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : null;

/* ---------- Error boundary (temporary) ---------- */
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { hasError: false, msg: "", stackTop: "" }; }
  static getDerivedStateFromError(error) {
    const rawMsg = error?.message || String(error || "");
    let stackTop = "";
    try {
      const s = (error && error.stack) ? String(error.stack) : "";
      const lines = s.split("\n").map((l) => l.trim()).filter(Boolean);
      stackTop = lines.length > 1 ? lines[1] : "";
    } catch {}
    return { hasError: true, msg: rawMsg, stackTop };
  }
  componentDidCatch(err, info) { console.error("Landing error:", err, info); }
  render() {
    if (this.state.hasError) {
      return (
        <main id="main" style={{ minHeight: "100vh", background: "#000", color: "#f4f4f5", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 760, textAlign: "center", border: "1px solid #27272a", borderRadius: 12, padding: 16, background: "#0a0a0a" }}>
            <h2 style={{ marginTop: 0 }}>The Scope of Morgellons</h2>
            <p style={{ opacity: 0.9, marginBottom: 12 }}>Something hiccuped. Reload to try again, or use the menu above.</p>
            <div style={{ textAlign: "left", fontFamily: "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace", fontSize: 12, background: "#0b0b0b", border: "1px solid #333", borderRadius: 8, padding: 10, overflowX: "auto" }}>
              <div><strong>Error:</strong> {this.state.msg || "(no message)"} </div>
              {this.state.stackTop ? <div style={{ marginTop: 6 }}><strong>At:</strong> {this.state.stackTop}</div> : null}
            </div>
            <div style={{ marginTop: 12, opacity: 0.8, fontSize: 12 }}>This diagnostic block is temporary; we’ll remove it after the fix.</div>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

/* ---------- Build badge (lowest) ---------- */
function BuildBadge() {
  return (
    <div aria-label="Build version" style={{ position: "fixed", right: 8, bottom: 0, zIndex: 2147483647, fontSize: 12, padding: "4px 10px", borderRadius: 8, color: "#fff", background: "#111", border: "1px solid #000", boxShadow: "0 2px 6px rgba(0,0,0,0.25)", pointerEvents: "none" }}>
      {BUILD_VERSION}
    </div>
  );
}

/* ---------- Auth presence ---------- */
function useAuthPresence() {
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    let unsubscribe = () => {};
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSignedIn(!!session);
        const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSignedIn(!!s));
        unsubscribe = data?.subscription?.unsubscribe || (() => {});
      } catch (e) { console.error("Auth presence init error:", e); }
      finally { setChecking(false); }
    })();
    return () => { try { unsubscribe(); } catch {} };
  }, []);
  return { signedIn, checking };
}

/* ---------- Sign-in ---------- */
function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showTips, setShowTips] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const pageWrap = { maxWidth: 980, margin: "20px auto", padding: "0 12px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" };
  const formStyle = { display: "grid", gap: 10, width: "100%", maxWidth: 360, margin: "0 auto" };
  const inputWrap = { display: "grid", gap: 6, justifyItems: "center" };
  const input = { width: 300, padding: "10px 12px", border: "1px solid #ccc", borderRadius: 8, fontSize: 14 };
  const statusStyle = { fontSize: 13, color: "#555", marginTop: 10, minHeight: 18 };

  async function handleSignIn(e) {
    e.preventDefault?.(); setErr(""); setMsg("Signing in…");
    try {
      const sb = supabase || createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setMsg("Signed in."); router.replace("/");
    } catch (e) { setMsg(""); setErr(e?.message || "Could not sign in."); }
  }
  async function handleSignUp(e) {
    e.preventDefault?.(); setErr(""); setMsg("Creating account…");
    try {
      if (!supabase) throw new Error("Client not ready");
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setMsg("Account created. Check your email to confirm, then sign in.");
    } catch (e) { setMsg(""); setErr(e?.message || "Could not sign up."); }
  }
  async function handleForgot(e) {
    e.preventDefault?.(); setErr(""); setMsg("Sending reset email…");
    try {
      if (!supabase) throw new Error("Client not ready");
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset` });
      if (error) throw error;
      setMsg("Check your email for the reset link.");
    } catch (e) { setMsg(""); setErr(e?.message || "Could not send reset email."); }
  }

  return (
    <main id="main" style={pageWrap}>
      <header style={{ width: "100%", paddingTop: 28 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: "#333", textAlign: "center", marginBottom: 0, letterSpacing: 0.2, lineHeight: 1 }}>Welcome to</div>
        <h1 style={{ margin: "0 0 6px", textAlign: "center", lineHeight: 1.12 }}>The Scope of Morgellons</h1>
      </header>
      <section aria-label="Sign in" style={{ borderTop: "1px solid #eee", paddingTop: 12, width: "100%" }}>
        <form onSubmit={mode === "sign_in" ? handleSignIn : handleSignUp} aria-label={mode === "sign_in" ? "Sign in form" : "Sign up form"} style={formStyle}>
          <label style={inputWrap}><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={input} /></label>
          <label style={inputWrap}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: 300 }}>
              <span>Password</span>
              <button type="button" aria-label="Password tips" onClick={() => setShowTips((v) => !v)} style={{ fontSize: 12, padding: "2px 8px" }}>?</button>
            </div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "sign_in" ? "current-password" : "new-password"} required style={input} />
          </label>
          {showTips ? (
            <div role="dialog" aria-label="Password tips" style={{ border: "1px solid #ddd", borderRadius: 10, background: "white", padding: 10, margin: "0 auto", width: 320, textAlign: "left", fontSize: 12, lineHeight: 1.4 }}>
              <strong style={{ display: "block", marginBottom: 6, fontSize: 12 }}>Password tips</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Use a long passphrase of 3–5 words.</li>
                <li>Make it unique for every site.</li>
                <li>Use a password manager.</li>
              </ul>
            </div>
          ) : null}
          <div style={row}>
            <button type="submit" style={btn}>{mode === "sign_in" ? "Sign in" : "Sign up"}</button>
            <button type="button" onClick={() => setMode((m) => (m === "sign_in" ? "sign_up" : "sign_in"))} aria-label="Toggle sign in or sign up" style={linkBtn}>{mode === "sign_in" ? "Need an account? Sign up" : "Have an account? Sign in"}</button>
            <button type="button" onClick={handleForgot} aria-label="Forgot password?" style={linkBtn}>Forgot password?</button>
          </div>
          <p aria-live="polite" style={statusStyle}>{msg}</p>
          {err ? <div role="alert" style={{ color: "#b00020", fontWeight: 600 }}>{err}</div> : null}
        </form>
      </section>
    </main>
  );
}

/* ---------- Reset screen ---------- */
function ResetPasswordScreen({ onDone }) {
  const router = useRouter();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const passRef = useRef(null);
  useEffect(() => { passRef.current?.focus(); }, []);
  const pageWrap = { maxWidth: 980, margin: "24px auto", padding: "0 12px", display: "flex", flexDirection: "column", alignItems: "center" };
  const formStyle = { display: "grid", gap: 10, width: "100%", maxWidth: 360, margin: "0 auto" };
  const input = { width: 300, padding: "10px 12px", border: "1px solid #ccc", borderRadius: 8, fontSize: 14 };
  const statusStyle = { fontSize: 13, color: "#555", marginTop: 10, minHeight: 18 };

  async function handleSubmit(e) {
    e.preventDefault?.(); setErr("");
    if (!p1 || !p2) return setErr("Enter your new password in both fields.");
    if (p1 !== p2) return setErr("Passwords do not match.");
    if (p1.length < 8) return setErr("Password must be at least 8 characters.");
    setMsg("Updating password…");
    try {
      const sb = supabase || createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) throw error;
      setMsg("Password updated."); await sb.auth.signOut(); onDone?.(); router.replace("/");
    } catch (e) { setMsg(""); setErr(e?.message || "Could not update password."); }
  }

  return (
    <main id="main" aria-label="Create new password" style={pageWrap}>
      <h1 style={{ margin: "0 0 12px" }}>Create new password</h1>
      <form onSubmit={handleSubmit} style={formStyle}>
        <label><span style={{ display: "block", marginBottom: 6 }}>New password</span><input ref={passRef} type="password" value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" required style={input} /></label>
        <label><span style={{ display: "block", marginBottom: 6 }}>Confirm new password</span><input type="password" value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" required style={input} /></label>
        <button type="submit" style={btn} aria-label="Update password">Update password</button>
        <p aria-live="polite" style={statusStyle}>{msg}</p>
        {err ? <div role="alert" style={{ color: "#b00020", fontWeight: 600 }}>{err}</div> : null}
      </form>
    </main>
  );
}

/* ---------- Landing (logged out) ---------- */
function LandingScreen() {
  return (
    <ErrorBoundary>
      <main id="main" tabIndex={-1} style={{ minHeight: "100vh", background: "#000", color: "#f4f4f5", fontFamily: "Arial, Helvetica, sans-serif", boxSizing: "border-box", paddingBottom: 460 }}>
        <div style={{ padding: "8px 24px" }}>
          <div style={{ width: "100%", maxWidth: 980, margin: "0 auto", padding: 16, background: "#0a0a0a", border: "1px solid #27272a", borderRadius: 12, boxShadow: "0 6px 16px rgba(0,0,0,0.25)", position: "relative", boxSizing: "border-box" }}>
            <ExplorePanel />
          </div>
        </div>
      </main>
    </ErrorBoundary>
  );
}

/* ---- Explore: floating hamburger + centered header+carousel constrained to header ---- */
function ExplorePanel() {
  const [menuOpen, setMenuOpen] = useState(false);

  const CONTENT_MAX = 560;
  const titleSpanRef = useRef(null);
  const [measuredWidth, setMeasuredWidth] = useState(CONTENT_MAX);

  const CHROME_HEIGHT = 28, TOPBAR_TOP = 10, SIDE_PAD = 10;

  useEffect(() => {
    const sync = () => {
      const spanW = titleSpanRef.current?.getBoundingClientRect?.().width || CONTENT_MAX;
      setMeasuredWidth(Math.min(Math.ceil(spanW), CONTENT_MAX));
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return (
    <section id="explore-panel" aria-label="Project overview" style={{ border: "1px solid #27272a", borderRadius: 12, padding: 20, marginBottom: 12, background: "#0a0a0a", color: "#f4f4f5", position: "relative", overflow: "visible" }}>
      {/* Absolute top bar */}
      <div style={{ position: "absolute", top: TOPBAR_TOP, left: SIDE_PAD, right: SIDE_PAD, height: CHROME_HEIGHT, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5, pointerEvents: "none" }}>
        {/* Hoverable hamburger */}
        <div onMouseEnter={() => setMenuOpen(true)} onMouseLeave={() => setMenuOpen(false)} style={{ position: "relative", pointerEvents: "auto", display: "flex", alignItems: "center" }}>
          <button type="button" aria-label="Open menu" aria-controls="explore-menu" aria-haspopup="menu" aria-expanded={menuOpen ? "true" : "false"} onClick={() => setMenuOpen((v) => !v)} title="Menu" style={{ width: 34, height: CHROME_HEIGHT, borderRadius: 10, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(17,24,39,0.6)", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 10px 24px rgba(0,0,0,0.35)", backdropFilter: "saturate(140%) blur(4px)", WebkitBackdropFilter: "saturate(140%) blur(4px)", transition: "transform 180ms ease, background 180ms ease, border-color 180ms ease" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <span style={{ display: "block", width: 18, height: 2, background: "#e5e7eb", opacity: 0.95 }} />
              <span style={{ display: "block", width: 18, height: 2, background: "#e5e7eb", opacity: 0.95 }} />
              <span style={{ display: "block", width: 18, height: 2, background: "#e5e7eb", opacity: 0.95 }} />
            </div>
          </button>
          {menuOpen ? (
            <nav id="explore-menu" role="menu" aria-label="Explore menu" style={{ position: "absolute", top: CHROME_HEIGHT + 6, left: 0, border: "1px solid #374151", borderRadius: 12, background: "rgba(15,23,42,0.92)", padding: "12px 16px", boxShadow: "0 18px 36px rgba(0,0,0,0.45)", backdropFilter: "saturate(140%) blur(4px)", WebkitBackdropFilter: "saturate(140%) blur(4px)" }}>
              <a role="menuitem" href="/about" style={linkMenu}>About</a>
              <a role="menuitem" href="/news" style={linkMenu}>News</a>
              <a role="menuitem" href="/resources" style={linkMenu}>Resources</a>
            </nav>
          ) : null}
        </div>

        {/* CTA same row */}
        <a href="/signin" style={{ height: CHROME_HEIGHT, display: "inline-flex", alignItems: "center", padding: "0 10px", borderRadius: 8, border: "1px solid transparent", background: "transparent", color: "#cbd5e1", textDecoration: "none", fontWeight: 600, fontSize: 13, lineHeight: `${CHROME_HEIGHT}px`, pointerEvents: "auto" }} aria-label="Sign up or sign in" title="Sign up / Sign in">Sign Up / Sign In</a>
      </div>

      {/* Centered content */}
      <div style={{ width: "100%", maxWidth: CONTENT_MAX, margin: "0 auto", textAlign: "center", boxSizing: "border-box" }}>
        <h2 style={{ margin: "56px 0 0", fontSize: 36, textAlign: "center" }}>
          <span ref={titleSpanRef} style={{ display: "inline-block" }}>The Scope of Morgellons</span>
        </h2>
        <div style={{ height: 48 }} />
        <CarouselRow maxWidth={measuredWidth} />
        <div style={{ height: 280 }} />
      </div>
    </section>
  );
}

/* ---------- Carousel: global one-by-one sequencer with 1.4s pauses ---------- */
function CarouselRow({ maxWidth = 560 }) {
  const [urls, setUrls] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) { if (!cancelled) setUrls([]); return; }
      try {
        const { data, error } = await supabase
          .from("public_gallery")
          .select("public_path, created_at")
          .order("created_at", { ascending: false })
          .limit(60);
        if (error) throw error;
        const bucket = "public-thumbs";
        const list = (data || []).map((r) => {
          try {
            const res = supabase.storage.from(bucket).getPublicUrl(r.public_path);
            return res?.data?.publicUrl || res?.data?.publicURL || "";
          } catch { return ""; }
        }).filter(Boolean);
        if (!cancelled) setUrls(list);
      } catch (e) {
        console.error("Carousel fetch error:", e);
        if (!cancelled) setUrls([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const cols = useMemo(() => {
    const base = [[], [], []];
    urls.forEach((u, i) => base[i % 3].push(u));
    if (urls.length >= 2) {
      for (let c = 0; c < 3; c++) if (base[c].length < 2) base[c] = [...base[c], urls[(c + 1) % urls.length]];
    }
    if (urls.length === 1) {
      for (let c = 0; c < 3; c++) base[c] = [urls[0], urls[0]];
    }
    return base;
  }, [urls]);

  const FADE_MS = 2800;   // fade-out then fade-in handled via CSS transition
  const PAUSE_MS = 1400;  // shorter true pause between columns
  const [kicks, setKicks] = useState([0, 0, 0]);

  useEffect(() => {
    let alive = true;
    let idx = 0;
    const run = () => {
      if (!alive) return;
      setKicks((k) => { const a = k.slice(); a[idx] = a[idx] + 1; return a; });
      setTimeout(() => {
        if (!alive) return;
        setTimeout(() => { idx = (idx + 1) % 3; run(); }, PAUSE_MS);
      }, FADE_MS * 2);
    };
    const start = setTimeout(run, 200);
    return () => { alive = false; clearTimeout(start); };
  }, []); // run once

  return (
    <div style={{ width: maxWidth, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20, boxSizing: "border-box" }}>
      {cols.map((images, idx) => (
        <SequencedSlot key={idx} images={images} fadeMs={FADE_MS} kick={kicks[idx]} />
      ))}
    </div>
  );
}

/* A column runs only when its "kick" increments: fade out → swap → fade in */
function SequencedSlot({ images, fadeMs = 2800, kick = 0 }) {
  const len = images?.length || 0;
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => { setIdx(0); setVisible(true); }, [len]);

  useEffect(() => {
    if (!len) return;
    let tOut;
    setVisible(false); // fade out
    tOut = setTimeout(() => {
      setIdx((p) => (p + 1) % len); // swap
      setVisible(true);             // fade in
    }, fadeMs);
    return () => { if (tOut) clearTimeout(tOut); };
  }, [kick, len, fadeMs]);

  const url = len ? images[idx] : "";

  return (
    <div aria-label="Anonymized image carousel" style={{ position: "relative", height: 140, borderRadius: 12, border: "1px solid #27272a", overflow: "hidden", background: "#000" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Anonymized project image" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: visible ? 1 : 0, transition: `opacity ${fadeMs}ms ease-in-out`, willChange: "opacity", pointerEvents: "none" }} />
    </div>
  );
}

/* ---------- App root ---------- */
export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const { signedIn, checking } = useAuthPresence();

  const isResetPath = router?.pathname?.startsWith?.("/auth/reset") || false;
  const [resetMode, setResetMode] = useState(isResetPath);
  useEffect(() => { if (isResetPath) setResetMode(true); }, [isResetPath]);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setResetMode(true); });
    return () => data?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    const q = window.location.search || "";
    if (hash.includes("type=recovery") || q.includes("type=recovery")) setResetMode(true);
  }, []);

  if (checking) return <BuildBadge />;

  if (resetMode) {
    return (
      <>
        <ResetPasswordScreen onDone={() => setResetMode(false)} />
        <BuildBadge />
      </>
    );
  }

  const path = router?.pathname || "/";
  const loggedOut = !signedIn;

  if (loggedOut) {
    if (path === "/signin") {
      return (
        <>
          <AuthScreen />
          <BuildBadge />
        </>
      );
    }
    return (
      <>
        <LandingScreen />
        <BuildBadge />
      </>
    );
  }

  return (
    <>
      <Component {...pageProps} />
      <BuildBadge />
    </>
  );
}

