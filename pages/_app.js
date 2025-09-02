// pages/_app.js
// Single source of truth for sign-in UI, global build badge, and behavior.
// Explore panel is ALWAYS visible above the (hidden by default) sign-in form when logged out.
// Left hamburger menu (About/News/Resources). Top-right button: "Sign Up / Sign In".
// Title centered and larger. Menu does not overlay images. Extra space above tiles.

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
      {/* Bumped on request */}
      Build 36.171_2025-09-01
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

  // Allow these routes to be public when logged out
  const publicPaths = new Set(["/about", "/news", "/resources"]);
  const path =
    typeof window === "undefined" ? router.pathname : window.location.pathname;

  if (!session) {
    // Logged out: allow public pages; otherwise show the Explore + (hidden) auth shell at "/"
    if (publicPaths.has(path)) {
      return (
        <>
          <Component {...pageProps} />
          <BuildBadge />
        </>
      );
    }
    return (
      <>
        <AuthScreen onSignedIn={() => router.push("/")} />
        <BuildBadge />
      </>
    );
  }

  // Signed in: render requested page
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
  const [showAuth, setShowAuth] = useState(false); // hide sign-in area by default

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

  function revealAuthAndFocus() {
    setShowAuth(true);
    // allow DOM to paint
    setTimeout(() => {
      const el = document.getElementById("email");
      if (el) el.focus();
    }, 0);
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
        {/* Explore panel: ALWAYS visible (anonymized, with hamburger menu) */}
        <ExplorePanel onSignIn={revealAuthAndFocus} />

        {/* Auth card(s) — hidden until CTA is pressed */}
        {showAuth ? (
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
        ) : null}
      </div>
    </main>
  );
}

// ---- Anonymized Explore panel with left hamburger menu ----
function ExplorePanel({ onSignIn }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section
      id="explore-panel"
      aria-label="Project overview"
      style={{
        position: "relative",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        background: "#fff",
      }}
    >
      {/* Top bar: grid centers title; menu left; CTA right */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        {/* Hamburger (left) */}
        <div>
          <button
            type="button"
            aria-label="Open menu"
            aria-controls="explore-menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen ? "true" : "false"}
            onClick={() => setMenuOpen((v) => !v)}
            title="Menu"
            style={{
              width: 36,
              height: 32,
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "grid", gap: 3 }}>
              <span style={{ display: "block", width: 16, height: 2, background: "#0f172a" }} />
              <span style={{ display: "block", width: 16, height: 2, background: "#0f172a" }} />
              <span style={{ display: "block", width: 16, height: 2, background: "#0f172a" }} />
            </div>
          </button>
        </div>

        {/* Center title (bigger) */}
        <h2 style={{ margin: 0, fontSize: 36, textAlign: "center" }}>The Scope of Morgellons</h2>

        {/* CTA (right) */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
            aria-label="Sign up or sign in"
            title="Sign up / Sign in"
          >
            Sign Up / Sign In
          </button>
        </div>
      </div>

      {/* Dropdown menu (About / News / Resources) — inline, not overlay */}
      {menuOpen ? (
        <div
          id="explore-menu"
          role="menu"
          aria-label="Explore menu"
          style={{
            width: 160,
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
            marginBottom: 12,
          }}
        >
          <a role="menuitem" href="/about" style={menuLinkStyle}>About</a>
          <a role="menuitem" href="/news" style={menuLinkStyle}>News</a>
          <a role="menuitem" href="/resources" style={menuLinkStyle}>Resources</a>
        </div>
      ) : null}

      {/* Supporting line with more space before tiles */}
      <header style={{ textAlign: "center", margin: "10px 0 18px" }}>
        <p style={{ margin: "6px 0 0", opacity: 0.9, fontSize: 14 }}>
          An anonymized visual overview to help researchers and the curious understand patterns and categories.
        </p>
      </header>

      {/* Anonymized category tiles (no photos; soft gradients) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        {["Blebs (clear to brown)", "Fibers", "Fiber Bundles", "Crystals / Particles"].map((label) => (
          <div
            key={label}
            role="img"
            aria-label={`Category ${label}`}
            style={{
              height: 120,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: 13,
              textAlign: "center",
              padding: "0 6px",
            }}
            title={label}
          >
            {label}
          </div>
        ))}
      </div>
    </section>
  );
}

const menuLinkStyle = {
  display: "block",
  padding: "10px 12px",
  textDecoration: "none",
  color: "#0f172a",
  borderBottom: "1px solid #eef2f7",
};

