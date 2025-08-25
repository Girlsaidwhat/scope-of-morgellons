// pages/_app.js
import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import "../styles/globals.css";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Local state for the existing sign-in form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showTips, setShowTips] = useState(false);

  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session ?? null);
      setAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });

    return () => {
      sub?.subscription?.unsubscribe?.();
      isMounted = false;
    };
  }, []);

  // Sign in handler (Supabase v2)
  async function handleSignIn(e) {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    const emailVal = emailInputRef.current?.value?.trim() || email.trim();
    const passVal = passwordInputRef.current?.value || password;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailVal,
        password: passVal,
      });

      if (error) {
        setAuthError(error.message || "Sign in failed.");
      } else {
        // On success, route to Home where "Welcome, (first name)" + gallery render
        // Using replace to avoid back button returning to sign-in
        await router.replace("/");
      }
    } catch (err) {
      setAuthError("Sign in failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  // Basic, non-invasive styles so we don't alter your layout; keeps UI identical in structure and copy.
  const panelStyle = {
    maxWidth: 420,
    margin: "0 auto",
    padding: "24px",
    borderRadius: "12px",
    border: "1px solid rgba(0,0,0,0.1)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
    background: "white",
  };

  const labelStyle = { display: "block", fontWeight: 600, marginBottom: 6 };
  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    marginBottom: 12,
  };
  const buttonStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #333",
    background: "#111",
    color: "white",
    cursor: "pointer",
    fontWeight: 600,
  };
  const subtleBtn = {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    width: 28,
    height: 28,
    borderRadius: "50%",
    lineHeight: "28px",
    textAlign: "center",
  };

  // Accessibility: skip link + main landmark
  const BuildTag = () => (
    <div
      aria-label="Build tag"
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        padding: "6px 10px",
        borderRadius: 10,
        background: "rgba(0,0,0,0.75)",
        color: "white",
        fontSize: 12,
        zIndex: 9999,
      }}
    >
      Build 36.91_2025-08-25
    </div>
  );

  if (!authReady) {
    return (
      <>
        <Head>
          <title>The Scope of Morgellons</title>
        </Head>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <main id="main" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
          <div role="status" aria-live="polite">
            Loading…
          </div>
        </main>
        <BuildTag />
      </>
    );
  }

  // If not signed in, render the existing sign-in screen (behavior wired; copy/layout unchanged)
  if (!session) {
    return (
      <>
        <Head>
          <title>The Scope of Morgellons — Sign in</title>
        </Head>

        <a href="#main" className="skip-link">
          Skip to content
        </a>

        <main
          id="main"
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "24px",
            background: "linear-gradient(180deg,#f7f7f7,#ececec)",
          }}
        >
          <section style={panelStyle} aria-labelledby="auth-title">
            <h1 id="auth-title" style={{ marginTop: 0, marginBottom: 12 }}>
              Welcome to The Scope of Morgellons
            </h1>

            <form aria-describedby="auth-status" onSubmit={handleSignIn}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ fontWeight: 600 }}>Password tips</div>
                <button
                  type="button"
                  aria-label="Password tips"
                  title="Password tips"
                  onClick={() => setShowTips((v) => !v)}
                  style={subtleBtn}
                >
                  ?
                </button>
              </div>

              {showTips && (
                <div
                  role="note"
                  style={{
                    background: "#f4f6ff",
                    border: "1px solid #c8d1ff",
                    padding: "10px 12px",
                    borderRadius: 8,
                    marginBottom: 12,
                  }}
                >
                  Use the email and password you created for this site.
                </div>
              )}

              <label htmlFor="email" style={labelStyle}>
                Email
              </label>
              <input
                id="email"
                type="email"
                ref={emailInputRef}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                style={inputStyle}
              />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <label htmlFor="password" style={labelStyle}>
                  Password
                </label>
                <a
                  href="/auth/reset"
                  style={{ fontSize: 14, textDecoration: "underline" }}
                  aria-label="Forgot password"
                >
                  Forgot password?
                </a>
              </div>
              <input
                id="password"
                type="password"
                ref={passwordInputRef}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={inputStyle}
              />

              <button
                type="submit"
                style={buttonStyle}
                aria-label="Sign in"
                disabled={authLoading}
              >
                {authLoading ? "Signing in…" : "Sign in"}
              </button>

              <div id="auth-status" role="status" aria-live="polite" style={{ marginTop: 12, minHeight: 20 }}>
                {authError ? (
                  <span style={{ color: "#b00020", fontWeight: 600 }}>{authError}</span>
                ) : null}
              </div>
            </form>
          </section>
        </main>

        <BuildTag />
      </>
    );
  }

  // Signed in: render the rest of the app (Home shows “Welcome, (first name)” + profile + gallery)
  return (
    <>
      <Head>
        <title>The Scope of Morgellons</title>
      </Head>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <main id="main">
        <Component {...pageProps} supabase={supabase} session={session} />
      </main>
      <div
        aria-label="Build tag"
        style={{
          position: "fixed",
          right: 12,
          bottom: 12,
          padding: "6px 10px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.75)",
          color: "white",
          fontSize: 12,
          zIndex: 9999,
        }}
      >
        Build 36.91_2025-08-25
      </div>
    </>
  );
}






























