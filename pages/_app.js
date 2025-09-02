// pages/_app.js
// Single source of truth for sign-in UI, global build badge, and behavior.
// Explore panel is ALWAYS visible above the sign-in form when logged out.
// No routing tricks, no new pages.

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function BuildBadge() {
  return (
    <div
      aria-label="Build badge"
      style={{
        position: "fixed",
        right: 10,
        bottom: 10,
        fontSize: 12,
        background: "#0f172a",
        color: "white",
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid #0b1221",
        opacity: 0.9,
        zIndex: 1000,
      }}
    >
      {/* Do not change unless explicitly bumped */}
      Build 36.141_2025-08-29
    </div>
  );
}

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) setSession(data?.session ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess ?? null);
    });
    return () => sub.subscription?.unsubscribe?.();
  }, []);

  if (!session) {
    return (
      <>
        <AuthScreen onSignedIn={() => router.push("/")} />
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

function AuthScreen({ onSignedIn }) {
  const router = useRouter();
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function doSignIn(e) {
    e.preventDefault();
    setBusy(true);
    setStatus("Signing in...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus(error.message);
      setBusy(false);
      return;
    }
    setStatus("Signed in.");
    onSignedIn?.();
  }

  async function doSignUp(e) {
    e.preventDefault();
    setBusy(true);
    setStatus("Creating account...");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: {} },
    });
    if (error) {
      setStatus(error.message);
      setBusy(false);
      return;
    }
    setStatus("Check your email to confirm your account.");
    setBusy(false);
  }

  async function doForgot(e) {
    e.preventDefault();
    setBusy(true);
    setStatus("Sending reset email...");
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/reset`,
      });
      if (error) throw error;
      setStatus("Reset email sent. Check your inbox.");
    } catch (err) {
      setStatus(err?.message || "Failed to send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      id="main"
      tabIndex={-1}
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f8fafc",
      }}
    >
      <a
        href="#auth-form"
        style={{
          position: "absolute",
          left: -9999,
          top: "auto",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        Skip to sign-in form
      </a>

      <div
        style={{
          width: "100%",
          maxWidth: 860,
          padding: 20,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          boxShadow: "0 6px 16px rgba(0,0,0,0.05)",
        }}
      >
        {/* Explore panel: ALWAYS visible (anonymized, no user images) */}
        <ExplorePanel
          onSignIn={() => {
            const el = document.getElementById("email");
            if (el) el.focus();
          }}
        />

        {/* Auth card(s) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 420px)",
            justifyContent: "center",
            marginTop: 16,
          }}
        >
          {mode !== "forgot" ? (
            <form id="auth-form" onSubmit={mode === "signin" ? doSignIn : doSignUp}>
              <label htmlFor="email" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", padding: 10, border: "1px solid #cbd5e1", borderRadius: 8 }}
              />

              <div style={{ height: 10 }} />

              <label htmlFor="password" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                Password{" "}
                <span
                  title="Tips: long passphrases are great; spaces are allowed; avoid common phrases."
                  aria-label="Password tips"
                  style={{ borderBottom: "1px dotted #64748b", cursor: "help" }}
                >
                  (?)
                </span>
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", padding: 10, border: "1px solid #cbd5e1", borderRadius: 8 }}
              />

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#2563eb",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #0f766e",
                    background: busy ? "#8dd3cd" : "#14b8a6",
                    color: "white",
                    fontWeight: 600,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {mode === "signin" ? (busy ? "Signing in..." : "Sign in") : (busy ? "Creating..." : "Create account")}
                </button>
              </div>
            </form>
          ) : (
            <form id="auth-form" onSubmit={doForgot}>
              <p style={{ fontSize: 14, marginTop: 0 }}>
                Enter your email and we’ll send a reset link.
              </p>
              <label htmlFor="forgot-email" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", padding: 10, border: "1px solid #cbd5e1", borderRadius: 8 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  style={{
                    background: "transparent",
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #1e293b",
                    background: busy ? "#64748b" : "#111827",
                    color: "white",
                    fontWeight: 600,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {busy ? "Sending..." : "Send reset link"}
                </button>
              </div>
            </form>
          )}

          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            style={{ fontSize: 12, opacity: 0.85, marginTop: 10, minHeight: 18, textAlign: "center" }}
          >
            {status}
          </div>
        </div>
      </div>
    </main>
  );
}

// ---- Anonymized Explore panel (no user images) ----
function ExplorePanel({ onSignIn }) {
  const categories = [
    { key: "blebs", label: "Blebs (clear to brown)" },
    { key: "fibers", label: "Fibers" },
    { key: "bundles", label: "Fiber Bundles" },
    { key: "crystals", label: "Crystals / Particles" },
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % categories.length), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <section
      id="explore-panel"
      aria-label="Project overview"
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        background: "#fff",
      }}
    >
      {/* Simple nav */}
      <nav aria-label="Overview navigation" style={{ display: "flex", justifyContent: "flex-end", gap: 14, marginBottom: 8 }}>
        <a href="#about" style={{ textDecoration: "none" }} title="Learn about the project">About</a>
        <a href="#news" style={{ textDecoration: "none" }} title="Latest updates">News</a>
        <a href="#resources" style={{ textDecoration: "none" }} title="Helpful links">Resources</a>
        <button
          onClick={onSignIn}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #1e293b",
            background: "#111827",
            color: "white",
            cursor: "pointer",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
          aria-label="Sign in or create an account"
          title="Sign in / Sign up"
        >
          Sign in
        </button>
      </nav>

      {/* Hero */}
      <header style={{ textAlign: "center", margin: "6px 0 12px" }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>The Scope of Morgellons</h2>
        <p style={{ margin: "6px 0 0", opacity: 0.9, fontSize: 14 }}>
          An anonymized visual overview to help researchers and the curious understand patterns and categories.
        </p>
      </header>

      {/* Anonymized category tiles (no photos; soft gradients) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        {categories.map((c, i) => {
          const active = i === idx;
          return (
            <div
              key={c.key}
              role="img"
              aria-label={`Category ${c.label}`}
              style={{
                height: 120,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: active
                  ? "radial-gradient(60% 60% at 50% 40%, #e5f3ff 0%, #eef2ff 70%, #f8fafc 100%)"
                  : "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                fontSize: 13,
              }}
              title={c.label}
            >
              {c.label}
            </div>
          );
        })}
      </div>

      {/* Anchors (placeholder content only) */}
      <section id="about" style={{ marginTop: 14, borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>About</h3>
        <p style={{ marginTop: 6, opacity: 0.9, fontSize: 14 }}>
          This project invites contributions and analysis while protecting member privacy. Images here are anonymized placeholders.
        </p>
      </section>

      <section id="news" style={{ marginTop: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>News</h3>
        <p style={{ marginTop: 6, opacity: 0.9, fontSize: 14 }}>Updates coming soon.</p>
      </section>

      <section id="resources" style={{ marginTop: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>Resources</h3>
        <p style={{ marginTop: 6, opacity: 0.9, fontSize: 14 }}>Curated links and reading will appear here.</p>
      </section>
    </section>
  );
}
