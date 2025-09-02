// pages/_app.js
// Landing + sign-in (single source of truth).
// Changes in this edit:
// - Real right-side gutter on landing by centering a narrower content column and adding padding-right
// - /signin now renders a full-page white sign-in (standalone mode) that matches your “actual sign-in page” feel
// - CTA still links to /signin
// - Font = Arial, landing dark theme remains

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MENU_RAIL_WIDTH = 96;

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

  const path =
    typeof window === "undefined" ? router.pathname : window.location.pathname;
  const publicPaths = new Set(["/about", "/news", "/resources"]);

  if (!session) {
    if (path === "/signin") {
      return (
        <>
          <GlobalStyles />
          <AuthScreen standalone onSignedIn={() => router.push("/")} />
          <BuildBadge />
        </>
      );
    }
    if (publicPaths.has(path)) {
      return (
        <>
          <GlobalStyles />
          <Component {...pageProps} />
          <BuildBadge />
        </>
      );
    }
    // Default logged-out = landing
    return (
      <>
        <GlobalStyles />
        <LandingScreen />
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

function GlobalStyles() {
  return (
    <style jsx global>{`
      html,
      body {
        font-family: Arial, Helvetica, sans-serif;
        margin: 0;
      }
    `}</style>
  );
}

/* ---------- Standalone Auth (at /signin) ---------- */
function AuthScreen({ onSignedIn, standalone = false }) {
  const [mode, setMode] = useState("signin");
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

  // Standalone = full-page white background sign-in (no dark landing behind it)
  const pageBg = standalone ? "#ffffff" : "#000000";
  const pageColor = standalone ? "#0f172a" : "#f4f4f5";

  return (
    <main
      id="main"
      tabIndex={-1}
      style={{
        minHeight: "100vh",
        padding: standalone ? "40px 24px" : "24px",
        background: pageBg,
        color: pageColor,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
        }}
      >
        {standalone ? (
          <header style={{ textAlign: "center", marginBottom: 16 }}>
            <h1 style={{ fontSize: 28, margin: 0 }}>Sign in to The Scope of Morgellons</h1>
          </header>
        ) : null}

        {mode !== "forgot" ? (
          <form
            id="auth-form"
            onSubmit={mode === "signin" ? doSignIn : doSignUp}
            style={{
              background: "#ffffff",
              color: "#0f172a",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 16,
              boxShadow: standalone ? "0 8px 20px rgba(0,0,0,0.08)" : "none",
            }}
          >
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
          <form
            id="auth-form"
            onSubmit={doForgot}
            style={{
              background: "#ffffff",
              color: "#0f172a",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 16,
              boxShadow: standalone ? "0 8px 20px rgba(0,0,0,0.08)" : "none",
            }}
          >
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
    </main>
  );
}

/* ---------- Landing (logged-out default) ---------- */
function LandingScreen() {
  return (
    <main
      id="main"
      tabIndex={-1}
      style={{
        minHeight: "100vh",
        padding: "8px 24px 24px",
        background: "#000000",
        color: "#f4f4f5",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 980,
          margin: "0 auto",
          padding: 16,
          background: "#0a0a0a",
          border: "1px solid #27272a",
          borderRadius: 12,
          boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
        }}
      >
        <ExplorePanel />
      </div>
    </main>
  );
}

// ---- Explore landing: slim left rail + centered right content + right gutter ----
function ExplorePanel() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <section
      id="explore-panel"
      aria-label="Project overview"
      style={{
        border: "1px solid #27272a",
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        background: "#0a0a0a",
        color: "#f4f4f5",
      }}
    >
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
            border: "1px solid #27272a",
            borderRadius: 10,
            padding: 8,
            background: "#0b0b0b",
            minHeight: 60,
          }}
        >
          {/* Hamburger */}
          <button
            type="button"
            aria-label="Open menu"
            aria-controls="explore-menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen ? "true" : "false"}
            onClick={() => setMenuOpen((v) => !v)}
            title="Menu"
            style={{
              width: 32,
              height: 28,
              borderRadius: 8,
              border: "1px solid #374151",
              background: "#111827",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              marginBottom: 6,
            }}
          >
            <div style={{ display: "grid", gap: 3 }}>
              <span style={{ display: "block", width: 14, height: 2, background: "#e5e7eb" }} />
              <span style={{ display: "block", width: 14, height: 2, background: "#e5e7eb" }} />
              <span style={{ display: "block", width: 14, height: 2, background: "#e5e7eb" }} />
            </div>
          </button>

          {menuOpen ? (
            <nav id="explore-menu" role="menu" aria-label="Explore menu">
              <a role="menuitem" href="/about" style={menuLinkStyleSmallDark}>
                About
              </a>
              <a role="menuitem" href="/news" style={menuLinkStyleSmallDark}>
                News
              </a>
              <a role="menuitem" href="/resources" style={menuLinkStyleSmallDark}>
                Resources
              </a>
            </nav>
          ) : null}
        </aside>

        {/* Right main area (narrower + centered + extra right padding for visible gutter) */}
        <div style={{ maxWidth: 760, margin: "0 auto", paddingRight: 28 }}>
          {/* CTA row sits above */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <a
              href="/signin"
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #334155",
                background: "#111827",
                color: "#f8fafc",
                textDecoration: "none",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
              aria-label="Sign up or sign in"
              title="Sign up / Sign in"
            >
              Sign Up / Sign In
            </a>
          </div>

          {/* More space between buttons and header */}
          <h2 style={{ margin: "28px 0 0", fontSize: 36, textAlign: "center" }}>
            The Scope of Morgellons
          </h2>

          {/* Extra breathing room before images */}
          <div style={{ height: 64 }} />

          {/* One-row, three-slot carousel from public_gallery/public-thumbs */}
          <CarouselRow />
        </div>
      </div>
    </section>
  );
}

/** --------- CarouselRow: exactly 3 slots, anonymized --------- **/
function CarouselRow() {
  const [urls, setUrls] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("public_gallery")
        .select("public_path, created_at")
        .order("created_at", { ascending: false })
        .limit(60);

      if (cancelled) return;
      if (error) {
        setUrls([]);
        return;
      }

      const bucket = "public-thumbs";
      const list = (data || [])
        .map((r) => {
          const { data: pu } = supabase.storage.from(bucket).getPublicUrl(r.public_path);
          return pu?.publicUrl || "";
        })
        .filter(Boolean);

      setUrls(list);
    })();
    return () => { cancelled = true; };
  }, []);

  if (urls.length === 0) return null;

  const cols = [[], [], []];
  urls.forEach((u, i) => { cols[i % 3].push(u); });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 10,
      }}
    >
      {cols.map((images, idx) => (
        <CarouselSlot key={idx} images={images} />
      ))}
    </div>
  );
}

function CarouselSlot({ images }) {
  const [i, setI] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (!images || images.length === 0) return;
    ref.current = setInterval(() => {
      setI((prev) => (prev + 1) % images.length);
    }, 3500);
    return () => clearInterval(ref.current);
  }, [images]);

  const url = images && images.length ? images[i] : "";

  return (
    <div
      aria-label="Anonymized image carousel"
      style={{
        height: 140, // smaller cards to improve overall balance
        borderRadius: 12,
        border: "1px solid #27272a",
        overflow: "hidden",
        background: "#111111",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Anonymized project image"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : null}
    </div>
  );
}

const menuLinkStyleSmallDark = {
  display: "block",
  padding: "6px 8px",
  fontSize: 12,
  textDecoration: "none",
  color: "#f4f4f5",
  border: "1px solid #30363d",
  borderRadius: 8,
  marginBottom: 6,
  background: "#111827",
};
