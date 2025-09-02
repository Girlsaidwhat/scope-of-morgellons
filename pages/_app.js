// pages/_app.js
// Single source of truth for sign-in UI, global build badge, and logged-out Explore.
// Update: slim left menu rail with hamburger at very top, menu drops into its own side space
// (no overlay/jump). Main content is centered in the remaining area. Extra subtitle spacing.
// Global font set to Arial for the whole site.

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MENU_RAIL_WIDTH = 140; // slim side space for the hamburger + dropdown

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
      {/* Build badge (intentionally bumped earlier this session) */}
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
    // Logged out: allow public pages; otherwise show Explore + hidden auth shell at "/"
    if (publicPaths.has(path)) {
      return (
        <>
          <GlobalStyles />
          <Component {...pageProps} />
          <BuildBadge />
        </>
      );
    }
    return (
      <>
        <GlobalStyles />
        <AuthScreen onSignedIn={() => router.push("/")} />
        <BuildBadge />
      </>
    );
  }

  // Signed in
  return (
    <>
      <GlobalStyles />
      <Component {...pageProps} />
      <BuildBadge />
    </>
  );
}

// Global font (site-wide)
function GlobalStyles() {
  return (
    <style jsx global>{`
      html, body {
        font-family: Arial, Helvetica, sans-serif;
      }
    `}</style>
  );
}

function AuthScreen({ onSignedIn }) {
  const router = useRouter();
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [showAuth, setShowAuth] = useState(false); // hidden until CTA click

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
        // Start near the top (no deep vertical centering)
        minHeight: "100vh",
        display: "block",
        padding: "32px 24px",
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
          maxWidth: 980,
          margin: "0 auto",
          padding: 20,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          boxShadow: "0 6px 16px rgba(0,0,0,0.05)",
        }}
      >
        {/* Explore with persistent slim left rail and centered main content */}
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

// ---- Explore landing with slim left rail + hamburger (top) and centered main content ----
function ExplorePanel({ onSignIn }) {
  const [menuOpen, setMenuOpen] = useState(false);

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
      {/* Two-column layout:
          - Left: persistent slim rail (hamburger at the very top, dropdown opens within this rail)
          - Right: all main content, centered within its column */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${MENU_RAIL_WIDTH}px 1fr`,
          gap: 12,
          alignItems: "start",
        }}
      >
        {/* Left rail */}
        <aside
          aria-label="Explore menu rail"
          style={{
            position: "relative",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 10,
            background: "#ffffff",
            minHeight: 60,
          }}
        >
          {/* Hamburger at the very top */}
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
              marginBottom: 8,
            }}
          >
            <div style={{ display: "grid", gap: 3 }}>
              <span style={{ display: "block", width: 16, height: 2, background: "#0f172a" }} />
              <span style={{ display: "block", width: 16, height: 2, background: "#0f172a" }} />
              <span style={{ display: "block", width: 16, height: 2, background: "#0f172a" }} />
            </div>
          </button>

          {/* Dropdown lives entirely inside the rail (no overlay on main) */}
          {menuOpen ? (
            <nav id="explore-menu" role="menu" aria-label="Explore menu">
              <a role="menuitem" href="/about" style={menuLinkStyle}>About</a>
              <a role="menuitem" href="/news" style={menuLinkStyle}>News</a>
              <a role="menuitem" href="/resources" style={menuLinkStyle}>Resources</a>
            </nav>
          ) : null}
        </aside>

        {/* Right main area */}
        <div>
          {/* Top row: centered title and CTA on the right */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              alignItems: "center",
              marginBottom: 8,
              gap: 8,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 36, textAlign: "center" }}>
              The Scope of Morgellons
            </h2>
            <div>
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

          {/* Subtitle with extra space below before tiles */}
          <header style={{ textAlign: "center", margin: "8px 0 32px" }}>
            <p style={{ margin: "6px 0 0", opacity: 0.9, fontSize: 14 }}>
              An anonymized visual overview to help researchers and the curious
              understand patterns and categories.
            </p>
          </header>

          {/* Tiles */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 10,
            }}
          >
            {[
              "Blebs (clear to brown)",
              "Fibers",
              "Fiber Bundles",
              "Crystals / Particles",
            ].map((label) => (
              <div
                key={label}
                role="img"
                aria-label={`Category ${label}`}
                style={{
                  height: 120,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background:
                    "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
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
        </div>
      </div>
    </section>
  );
}

const menuLinkStyle = {
  display: "block",
  padding: "10px 12px",
  textDecoration: "none",
  color: "#0f172a",
  border: "1px solid #eef2f7",
  borderRadius: 8,
  marginBottom: 8,
  background: "#f8fafc",
};

