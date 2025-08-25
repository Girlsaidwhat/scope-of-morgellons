// Build 36.93_2025-08-25
import "../styles/globals.css";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const BUILD_TAG = "Build 36.93_2025-08-25";

// Browser-only Supabase client (uses your existing env)
const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    : null;

function BuildBadge() {
  return (
    <div
      aria-label="build badge"
      style={{
        position: "fixed",
        right: 12,
        bottom: 64, // lifted above taskbar
        padding: "6px 10px",
        fontSize: 12,
        borderRadius: 6,
        background: "rgba(0,0,0,0.75)",
        color: "white",
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      {BUILD_TAG}
    </div>
  );
}

// Only redirects to /auth/reset if recovery tokens are present. No overlay.
function ResetRedirect() {
  useEffect(() => {
    const { pathname, search, hash } = window.location;

    const qs = new URLSearchParams(search);
    const code = qs.get("code");
    const qType = (qs.get("type") || "").toLowerCase();
    const qToken = qs.get("token") || qs.get("recovery_token");

    const hs = new URLSearchParams((hash || "").replace(/^#/, ""));
    const hType = (hs.get("type") || "").toLowerCase();
    const at = hs.get("access_token");
    const rt = hs.get("refresh_token");

    const hasRecovery =
      !!code || (qType === "recovery" && !!qToken) || hType === "recovery" || (at && rt);

    if (hasRecovery && pathname !== "/auth/reset") {
      window.location.replace(`/auth/reset${search}${hash}`);
    }
  }, []);
  return null;
}

// === Your preferred sign-in screen (with "?" tips and "Forgot password?") ===
function AuthScreen() {
  const [mode, setMode] = useState("sign_in"); // "sign_in" | "sign_up"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showTips, setShowTips] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const formRef = useRef(null);
  const submittingRef = useRef(false); // prevents double-submit if both handlers fire

  const doSignIn = async (e) => {
    try { e?.preventDefault?.(); } catch {}
    if (submittingRef.current) return;
    submittingRef.current = true;
    setErr("");
    setMsg("Signing in…");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email?.trim(), password });
      if (error) throw error;
      setMsg("Signed in.");
      window.location.assign("/");
    } catch (e2) {
      setMsg("");
      setErr(e2?.message || "Could not sign in.");
    } finally {
      submittingRef.current = false;
    }
  };

  const doSignUp = async (e) => {
    try { e?.preventDefault?.(); } catch {}
    if (submittingRef.current) return;
    submittingRef.current = true;
    setErr("");
    setMsg("Creating account…");
    try {
      const { error } = await supabase.auth.signUp({ email: email?.trim(), password });
      if (error) throw error;
      setMsg("Account created. Check your email to confirm, then sign in.");
    } catch (e2) {
      setMsg("");
      setErr(e2?.message || "Could not sign up.");
    } finally {
      submittingRef.current = false;
    }
  };

  const handleForgot = async (e) => {
    try { e?.preventDefault?.(); } catch {}
    setErr("");
    setMsg("Sending reset email…");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email?.trim(), {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) throw error;
      setMsg("Check your email for the reset link.");
    } catch (e2) {
      setMsg("");
      setErr(e2?.message || "Could not send reset email.");
    }
  };

  // Fallback: if React onSubmit ever misses (hydration edge), also listen natively.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const fallback = (ev) => {
      // If React wired fine, this will still run—but submittingRef blocks duplicates
      if (mode === "sign_in") doSignIn(ev);
      else doSignUp(ev);
    };
    form.addEventListener("submit", fallback);
    return () => form.removeEventListener("submit", fallback);
  }, [mode, email, password]); // keep current values available

  return (
    <main id="main" style={{ maxWidth: 980, margin: "20px auto", padding: "0 12px" }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: "0 0 6px" }}>Welcome to The Scope of Morgellons</h1>
      </header>

      <section aria-label="Sign in" style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
        <form
          ref={formRef}
          onSubmit={mode === "sign_in" ? doSignIn : doSignUp}
          aria-label={mode === "sign_in" ? "Sign in form" : "Sign up form"}
          style={{ display: "grid", gap: 10, maxWidth: 420 }}
        >
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Password</span>
              <button
                type="button"
                aria-label="Password tips"
                onClick={() => setShowTips((v) => !v)}
                style={{ fontSize: 12, padding: "2px 8px" }}
              >
                ?
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
              required
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          {showTips ? (
            <div
              role="dialog"
              aria-label="Password tips"
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                background: "white",
                padding: 10,
              }}
            >
              <strong style={{ display: "block", marginBottom: 6 }}>Password tips</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Use 12+ characters.</li>
                <li>Mix upper/lower case, numbers, and a symbol.</li>
                <li>Avoid names, birthdays, or common words.</li>
                <li>Don’t reuse a password from another site.</li>
              </ul>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" style={{ padding: "10px 14px" }}>
              {mode === "sign_in" ? "Sign in" : "Sign up"}
            </button>
            <button
              type="button"
              onClick={() => setMode((m) => (m === "sign_in" ? "sign_up" : "sign_in"))}
              aria-label="Toggle sign in or sign up"
              style={{ padding: "8px 12px" }}
            >
              {mode === "sign_in" ? "Need an account? Sign up" : "Have an account? Sign in"}
            </button>
            <button
              type="button"
              onClick={handleForgot}
              aria-label="Forgot password?"
              style={{ padding: "8px 12px" }}
            >
              Forgot password?
            </button>
          </div>

          <p aria-live="polite" style={{ minHeight: 18, marginTop: 6 }}>{msg}</p>
          {err ? <div role="alert" style={{ color: "#b00020" }}>{err}</div> : null}
        </form>
      </section>
    </main>
  );
}

export default function MyApp({ Component, pageProps }) {
  const [mounted, setMounted] = useState(false); // mount gate to avoid flicker
  const [session, setSession] = useState(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    // remove any per-page build lines post-hydration
    document.querySelectorAll("[data-build-line]").forEach((el) => el.remove());
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let unsub = () => {};
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);
      const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
        setSession(s || null);
      });
      unsub = sub.subscription?.unsubscribe || (() => {});
    })();
    return () => unsub();
  }, []);

  if (!mounted) {
    return <BuildBadge />;
  }

  const onHome = typeof window !== "undefined" && window.location.pathname === "/";
  const loggedOutOnHome = onHome && !session;

  return (
    <>
      <a
        href="#main"
        style={{
          position: "absolute",
          left: -9999,
          top: "auto",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
        onFocus={(e) => {
          e.currentTarget.style.left = "8px";
          e.currentTarget.style.top = "8px";
          e.currentTarget.style.width = "auto";
          e.currentTarget.style.height = "auto";
          e.currentTarget.style.padding = "6px 8px";
          e.currentTarget.style.background = "white";
          e.currentTarget.style.border = "1px solid #ccc";
        }}
        onBlur={(e) => {
          e.currentTarget.style.left = "-9999px";
          e.currentTarget.style.top = "auto";
          e.currentTarget.style.width = "1px";
          e.currentTarget.style.height = "1px";
          e.currentTarget.style.padding = "0";
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.border = "none";
        }}
      >
        Skip to main content
      </a>

      <ResetRedirect />
      {loggedOutOnHome ? <AuthScreen /> : <Component {...pageProps} />}
      <BuildBadge />
    </>
  );
}


















