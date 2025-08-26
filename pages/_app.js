// pages/_app.js
// Build 36.102_2025-08-26
import "../styles/globals.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

export const BUILD_VERSION = "Build 36.102_2025-08-26";

// Module-level client (works on the browser build)
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
    bottom: 8,
    zIndex: 9999,
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 8,
    color: "#fff",
    background: "#111",
    border: "1px solid #000",
    boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
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

function AuthScreen() {
  const [mode, setMode] = useState("sign_in"); // "sign_in" | "sign_up"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showTips, setShowTips] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const row = {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 6,
  };
  const input = {
    flex: "1 1 280px",
    padding: "10px 12px",
    border: "1px solid #ccc",
    borderRadius: 8,
    fontSize: 14,
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
  const statusStyle = { fontSize: 13, color: "#555", marginTop: 10 };

  // Only behavior fix: create a client here so the button never no-ops
  async function handleSignIn(e) {
    e.preventDefault?.();
    setErr("");
    setMsg("Signing in...");
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
    setMsg("Creating account...");
    try {
      if (!supabase) return;
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
    setMsg("Sending reset email...");
    try {
      if (!supabase) return;
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
          <label style={{ display: "grid", gap: 6 }}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={input}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
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
              }}
            >
              <strong style={{ display: "block", marginBottom: 6 }}>Password tips</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Use 12+ characters.</li>
                <li>Mix upper/lower case, numbers, and a symbol.</li>
                <li>Avoid names, birthdays, or common words.</li>
                <li>Don’t reuse a password from another site.</li>
              </ul>
              <div style={fine}>These are general guidelines. Use a unique password for this site.</div>
            </div>
          ) : null}

          <div style={row}>
            {/* Defensive: ensure click triggers sign-in when in sign_in mode; no layout or copy changes */}
            <button
              type="submit"
              style={btn}
              onClick={(e) => {
                if (mode === "sign_in") {
                  e.preventDefault();
                  handleSignIn(e);
                }
              }}
            >
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
            <button type="button" onClick={handleForgot} aria-label="Forgot password?" style={linkBtn}>
              Forgot password?
            </button>
          </div>

          <p aria-live="polite" style={statusStyle}>{msg}</p>
          {err ? (
            <div role="alert" style={{ color: "#b00020", fontWeight: 600 }}>
              {err}
            </div>
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

  const onHome = router?.pathname === "/";
  const showAuth = onHome && !signedIn;

  return (
    <>
      {showAuth ? <AuthScreen /> : <Component {...pageProps} />}
      <BuildBadge />
    </>
  );
}
 