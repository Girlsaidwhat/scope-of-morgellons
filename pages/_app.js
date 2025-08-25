// pages/_app.js
// Build 36.99_2025-08-25
import "../styles/globals.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

export const BUILD_VERSION = "Build 36.99_2025-08-25";

function BuildBadge() {
  return (
    <div
      aria-label="build badge"
      style={{
        position: "fixed",
        right: 8,
        bottom: 8,
        zIndex: 9999,
        fontSize: 12,
        background: "rgba(0,0,0,0.75)",
        color: "#fff",
        padding: "6px 10px",
        borderRadius: 8,
        pointerEvents: "none",
      }}
    >
      {BUILD_VERSION}
    </div>
  );
}

/**
 * Your sign-in screen (layout + copy unchanged):
 * - Email + Password
 * - "?" password tips
 * - Forgot password?
 * - Sign in / Sign up toggle
 */
function AuthScreen() {
  const [mode, setMode] = useState("sign_in"); // "sign_in" | "sign_up"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showTips, setShowTips] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSignIn(e) {
    e?.preventDefault?.();
    if (busy) return;
    setErr("");
    setMsg("Signing in...");
    setBusy(true);
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setMsg("Signed in.");
      window.location.assign("/");
    } catch (e) {
      setMsg("");
      setErr(e?.message || "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(e) {
    e?.preventDefault?.();
    if (busy) return;
    setErr("");
    setMsg("Creating account...");
    setBusy(true);
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      setMsg("Account created. Check your email to confirm, then sign in.");
    } catch (e) {
      setMsg("");
      setErr(e?.message || "Could not sign up.");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e) {
    e?.preventDefault?.();
    if (busy) return;
    setErr("");
    setMsg("Sending reset email...");
    setBusy(true);
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) throw error;
      setMsg("Check your email for the reset link.");
    } catch (e) {
      setMsg("");
      setErr(e?.message || "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" style={{ maxWidth: 980, margin: "20px auto", padding: "0 12px" }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: "0 0 6px" }}>Welcome to The Scope of Morgellons</h1>
      </header>

      <section aria-label="Sign in" style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
        <form
          onSubmit={mode === "sign_in" ? handleSignIn : handleSignUp}
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
            {/* Defensive: ensure click calls sign-in in sign_in mode */}
            <button
              type="submit"
              onClick={(e) => {
                if (mode === "sign_in") {
                  e.preventDefault();
                  handleSignIn(e);
                }
              }}
              disabled={busy}
              style={{ padding: "10px 14px" }}
            >
              {mode === "sign_in" ? "Sign in" : "Sign up"}
            </button>

            <button
              type="button"
              onClick={() => setMode((m) => (m === "sign_in" ? "sign_up" : "sign_in"))}
              aria-label="Toggle sign in or sign up"
              style={{ padding: "8px 12px" }}
              disabled={busy}
            >
              {mode === "sign_in" ? "Need an account? Sign up" : "Have an account? Sign in"}
            </button>

            <button
              type="button"
              onClick={handleForgot}
              aria-label="Forgot password?"
              style={{ padding: "8px 12px" }}
              disabled={busy}
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
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  // Wait for router + session before deciding what to render
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { data: { session } } = await sb.auth.getSession();
      setSession(session || null);
      const { data: sub } = sb.auth.onAuthStateChange((_evt, s) => {
        setSession(s || null);
      });
      unsub = sub.subscription?.unsubscribe || (() => {});
      setReady(true);
    })();
    return () => unsub();
  }, []);

  // Until router + session are known, render only the badge to avoid the wrong page flashing
  if (!router.isReady || !ready) {
    return <BuildBadge />;
  }

  const onHome = router.pathname === "/";
  const showAuth = onHome && !session;

  return (
    <>
      {showAuth ? <AuthScreen /> : <Component {...pageProps} />}
      <BuildBadge />
    </>
  );
}







































