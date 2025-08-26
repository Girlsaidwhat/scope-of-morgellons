// pages/_app.js
// Build 36.120_2025-08-26
import "../styles/globals.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

export const BUILD_VERSION = "Build 36.120_2025-08-26";

// Browser-safe Supabase client (public keys only)
const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    : null;

function BuildBadge() {
  const badgeStyle = {
    position: "fixed",
    right: 8,
    bottom: 48, // keep above Windows taskbar
    zIndex: 2147483647,
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 8,
    color: "#fff",
    background: "#111",
    border: "1px solid #000",
    boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
    pointerEvents: "none",
  };
  return (
    <div aria-label="Build version" style={badgeStyle}>
      {BUILD_VERSION}
    </div>
  );
}

function useAuthPresence() {
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      return;
    }
    let unsub = () => {};
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSignedIn(!!session);
      setChecking(false);
      const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
        setSignedIn(!!s);
      });
      unsub = sub.subscription?.unsubscribe || (() => {});
    })();
    return () => unsub();
  }, []);

  return { signedIn, checking };
}

/** Canonical sign-in screen (baseline) */
function AuthScreen() {
  const [mode, setMode] = useState("sign_in"); // "sign_in" | "sign_up"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showTips, setShowTips] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Layout: center everything but the build badge; inputs slightly longer
  const pageWrap = {
    maxWidth: 980,
    margin: "20px auto",
    padding: "0 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  };
  const formStyle = { display: "grid", gap: 10, width: "100%", maxWidth: 360, margin: "0 auto" };
  const inputWrap = { display: "grid", gap: 6, justifyItems: "center" };
  const input = {
    width: 300,
    padding: "10px 12px",
    border: "1px solid #ccc",
    borderRadius: 8,
    fontSize: 14,
  };
  const row = {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 6,
  };
  const btn = {
    padding: "10px 14px",
    border: "1px solid #111",
    borderRadius: 8,
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
  };
  const linkBtn = {
    padding: "6px 10px",
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    color: "#111",
    fontSize: 12,
    cursor: "pointer",
  };
  const fine = { fontSize: 11, color: "#666" };
  const statusStyle = { fontSize: 13, color: "#555", marginTop: 10, minHeight: 18 };

  // v2 sign-in with on-demand client fallback
  async function handleSignIn(e) {
    e.preventDefault?.();
    setErr("");
    setMsg("Signing in…");
    try {
      const sb =
        supabase ||
        createClient(
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
    }
  }

  async function handleSignUp(e) {
    e.preventDefault?.();
    setErr("");
    setMsg("Creating account…");
    try {
      if (!supabase) throw new Error("Client not ready");
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setMsg("Account created. Check your email to confirm, then sign in.");
    } catch (e) {
      setMsg("");
      setErr(e?.message || "Could not sign up.");
    }
  }

  async function handleForgot(e) {
    e.preventDefault?.();
    setErr("");
    setMsg("Sending reset email…");
    try {
      if (!supabase) throw new Error("Client not ready");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) throw error;
      setMsg("Check your email for the reset link.");
    } catch (e) {
      setMsg("");
      setErr(e?.message || "Could not send reset email.");
    }
  }

  return (
    <main id="main" style={pageWrap}>
      <header style={{ width: "100%" }}>
        {/* “Welcome to” on the left, pulled much closer to the title */}
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "#333",
            textAlign: "left",
            marginLeft: 12,
            marginBottom: 0,
            letterSpacing: 0.2,
            lineHeight: 1.1,
          }}
        >
          Welcome to
        </div>
        {/* Increase negative top margin to halve the remaining gap */}
        <h1 style={{ margin: "-12px 0 6px", textAlign: "center", lineHeight: 1.15 }}>
          The Scope of Morgellons
        </h1>
      </header>

      <section aria-label="Sign in" style={{ borderTop: "1px solid #eee", paddingTop: 12, width: "100%" }}>
        <form
          onSubmit={mode === "sign_in" ? handleSignIn : handleSignUp}
          aria-label={mode === "sign_in" ? "Sign in form" : "Sign up form"}
          style={formStyle}
        >
          <label style={inputWrap}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={input}
            />
          </label>

          <label style={inputWrap}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: 300,
              }}
            >
              <span>Password</span>
              {/* “?” tips button */}
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
              style={input}
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
                margin: "0 auto",
                width: 320,
                textAlign: "left",
              }}
            >
              <strong style={{ display: "block", marginBottom: 6 }}>Password tips</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Use 16+ characters or a 3–4 word passphrase.</li>
                <li>Use a unique password for this site; don’t reuse.</li>
                <li>Prefer a password manager to store and generate passwords.</li>
                <li>Avoid personal info; mixing cases, numbers, and symbols helps.</li>
              </ul>
              <div style={{ fontSize: 11, color: "#666" }}>Enable two-factor authentication if offered.</div>
            </div>
          ) : null}

          <div style={row}>
            <button type="submit" style={btn}>
              {mode === "sign_in" ? "Sign in" : "Sign up"}
            </button>
            <button
              type="button"
              onClick={() => setMode((m) => (m === "sign_in" ? "sign_up" : "sign_in"))}
              aria-label="Toggle sign in or sign up"
              style={linkBtn}
            >
              {mode === "sign_in" ? "Need an account? Sign up" : "Have an account? Sign in"}
            </button>
            {/* “Forgot password?” */}
            <button type="button" onClick={handleForgot} aria-label="Forgot password?" style={linkBtn}>
              Forgot password?
            </button>
          </div>

          <p aria-live="polite" style={statusStyle}>{msg}</p>
          {err ? (
            <div role="alert" style={{ color: "#b00020", fontWeight: 600 }}>{err}</div>
          ) : null}
        </form>
      </section>
    </main>
  );
}

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const { signedIn, checking } = useAuthPresence();

  if (checking) {
    return <BuildBadge />;
  }

  // Single source of truth: when logged out on "/", show Auth; otherwise render page
  const onHome = router?.pathname === "/";
  const showAuth = onHome && !signedIn;

  return (
    <>
      {showAuth ? <AuthScreen /> : <Component {...pageProps} />}
      <BuildBadge />
    </>
  );
}

