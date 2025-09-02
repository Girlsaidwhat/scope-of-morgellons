// pages/_app.js
// Build 36.145_2025-08-29
import "../styles/globals.css";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

export const BUILD_VERSION = "Build 36.145_2025-08-29";

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

/** Canonical sign-in screen — unchanged */
function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState("sign_in"); // "sign_in" | "sign_up"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showTips, setShowTips] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Layout
  const pageWrap = {
    maxWidth: 980,
    margin: "20px auto",
    padding: "0 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  };
  const formStyle = {
    display: "grid",
    gap: 10,
    width: "100%",
    maxWidth: 360,
    margin: "0 auto",
  };
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
      router.replace("/");
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
      <header style={{ width: "100%", paddingTop: 28 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "#333",
            textAlign: "center",
            marginLeft: 0,
            marginBottom: 0,
            letterSpacing: 0.2,
            lineHeight: 1.0,
          }}
        >
          Welcome to
        </div>
        <h1
          style={{
            margin: "0 0 6px",
            textAlign: "center",
            lineHeight: 1.12,
          }}
        >
          The Scope of Morgellons
        </h1>
      </header>

      <section
        aria-label="Sign in"
        style={{ borderTop: "1px solid #eee", paddingTop: 12, width: "100%" }}
      >
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
                fontSize: 12,
                lineHeight: 1.4,
              }}
            >
              <strong style={{ display: "block", marginBottom: 6, fontSize: 12 }}>
                Password tips
              </strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>
                  Use a long passphrase (3–5 random words, 16–24+ characters).{" "}
                  <em>Spaces are OK</em> and encouraged between words.
                </li>
                <li>Make it unique for every site; never reuse passwords.</li>
                <li>Use a password manager to generate and store passwords.</li>
                <li>Avoid predictable substitutions or patterns (e.g., P@ssw0rd123!).</li>
                <li>Change it only if you suspect compromise, not on a schedule.</li>
              </ul>
              <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>
                Enable two-factor authentication (authenticator app) whenever available.
              </div>
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
            <button
              type="button"
              onClick={handleForgot}
              aria-label="Forgot password?"
              style={linkBtn}
            >
              Forgot password?
            </button>
          </div>

          <p aria-live="polite" style={statusStyle}>
            {msg}
          </p>
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

/** Create-new-password screen shown after clicking the reset link */
function ResetPasswordScreen({ onDone }) {
  const router = useRouter();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const passRef = useRef(null);

  useEffect(() => {
    passRef.current?.focus();
  }, []);

  const pageWrap = {
    maxWidth: 980,
    margin: "24px auto",
    padding: "0 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  };
  const formStyle = {
    display: "grid",
    gap: 10,
    width: "100%",
    maxWidth: 360,
    margin: "0 auto",
  };
  const input = {
    width: 300,
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
  const statusStyle = { fontSize: 13, color: "#555", marginTop: 10, minHeight: 18 };

  async function handleSubmit(e) {
    e.preventDefault?.();
    setErr("");
    if (!p1 || !p2) {
      setErr("Enter your new password in both fields.");
      return;
    }
    if (p1 !== p2) {
      setErr("Passwords do not match.");
      return;
    }
    if (p1.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    setMsg("Updating password…");
    try {
      const sb =
        supabase ||
        createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) throw error;
      setMsg("Password updated.");
      await sb.auth.signOut();
      onDone?.();
      router.replace("/");
    } catch (e) {
      setMsg("");
      setErr(e?.message || "Could not update password.");
    }
  }

  return (
    <main id="main" aria-label="Create new password" style={pageWrap}>
      <h1 style={{ margin: "0 0 12px" }}>Create new password</h1>
      <form onSubmit={handleSubmit} style={formStyle} aria-labelledby="reset-heading">
        <label>
          <span style={{ display: "block", marginBottom: 6 }}>New password</span>
          <input
            ref={passRef}
            type="password"
            value={p1}
            onChange={(e) => setP1(e.target.value)}
            autoComplete="new-password"
            required
            style={input}
          />
        </label>
        <label>
          <span style={{ display: "block", marginBottom: 6 }}>Confirm new password</span>
          <input
            type="password"
            value={p2}
            onChange={(e) => setP2(e.target.value)}
            autoComplete="new-password"
            required
            style={input}
          />
        </label>
        <button type="submit" style={btn} aria-label="Update password">
          Update password
        </button>
        <p aria-live="polite" style={statusStyle}>
          {msg}
        </p>
        {err ? (
          <div role="alert" style={{ color: "#b00020", fontWeight: 600 }}>
            {err}
          </div>
        ) : null}
      </form>
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
        // Extra bottom padding so images never sit right behind the build badge
        padding: "8px 24px 140px",
        background: "#000000",
        color: "#f4f4f5",
        fontFamily: "Arial, Helvetica, sans-serif",
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

// ---- Explore landing: slimmer left rail + text-only links + more space before header ----
function ExplorePanel() {
  const [menuOpen, setMenuOpen] = useState(false);
  const MENU_RAIL_WIDTH = 64; // slimmer rail

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
            padding: 6,
            background: "#0b0b0b",
            minHeight: 48,
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
              width: 28,
              height: 24,
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
              <a role="menuitem" href="/about" style={menuLinkStyleTextDark}>
                About
              </a>
              <a role="menuitem" href="/news" style={menuLinkStyleTextDark}>
                News
              </a>
              <a role="menuitem" href="/resources" style={menuLinkStyleTextDark}>
                Resources
              </a>
            </nav>
          ) : null}
        </aside>

        {/* Right main area (centered; extra space before header; discreet CTA) */}
        <div style={{ maxWidth: 760, margin: "0 auto", paddingRight: 28 }}>
          {/* Top row: CTA all the way right */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <a
              href="/signin"
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid transparent",
                background: "transparent",
                color: "#cbd5e1",
                textDecoration: "none",
                fontWeight: 500,
                fontSize: 12,
              }}
              aria-label="Sign up or sign in"
              title="Sign up / Sign in"
            >
              Sign Up / Sign In
            </a>
          </div>

          {/* More space between top row and header */}
          <h2 style={{ margin: "48px 0 0", fontSize: 36, textAlign: "center" }}>
            The Scope of Morgellons
          </h2>

          {/* Spacer before images */}
          <div style={{ height: 64 }} />

          {/* One-row, three-slot carousel from public_gallery/public-thumbs */}
          <CarouselRow />
        </div>
      </div>
    </section>
  );
}

/** --------- CarouselRow: exactly 3 slots, anonymized, staggered fade --------- **/
function CarouselRow() {
  const [urls, setUrls] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Load up to 60 recent public thumbnails
      const { data, error } = await supabase
        ?.from("public_gallery")
        .select("public_path, created_at")
        .order("created_at", { ascending: false })
        .limit(60);

      if (cancelled || error || !Array.isArray(data)) {
        setUrls([]);
        return;
      }

      const bucket = "public-thumbs";
      const list = data
        .map((r) => {
          const { data: pu } = supabase.storage.from(bucket).getPublicUrl(r.public_path);
          return pu?.publicUrl || "";
        })
        .filter(Boolean);

      setUrls(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!urls.length) return null;

  const cols = [[], [], []];
  urls.forEach((u, i) => {
    cols[i % 3].push(u);
  });

  // Stagger: slot 0 starts immediately, slot 1 after 1200ms, slot 2 after 2400ms
  const delays = [0, 1200, 2400];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 10,
      }}
    >
      {cols.map((images, idx) => (
        <CarouselSlot key={idx} images={images} delay={delays[idx] || 0} />
      ))}
    </div>
  );
}

/** Cross-fade slot with two layers; changes one at a time with fade **/
function CarouselSlot({ images, delay = 0 }) {
  const [aIdx, setAIdx] = useState(0);
  const [bIdx, setBIdx] = useState(images && images.length > 1 ? 1 : 0);
  const [showA, setShowA] = useState(true);
  const intervalRef = useRef(null);
  const startedRef = useRef(false);

  // Re-init when images change
  useEffect(() => {
    setAIdx(0);
    setBIdx(images && images.length > 1 ? 1 : 0);
    setShowA(true);
  }, [images]);

  useEffect(() => {
    if (!images || images.length === 0) return;

    // Clear any prior timers
    if (intervalRef.current) clearInterval(intervalRef.current);

    const start = () => {
      // Rotate every 3.5s after the initial (staggered) delay
      intervalRef.current = setInterval(() => {
        if (!images || images.length <= 1) return;
        // Determine next index
        const currentIdx = showA ? aIdx : bIdx;
        const nextIdx = (currentIdx + 1) % images.length;

        if (showA) {
          // Prepare B with next, then reveal B
          setBIdx(nextIdx);
          setShowA(false);
        } else {
          // Prepare A with next, then reveal A
          setAIdx(nextIdx);
          setShowA(true);
        }
      }, 3500);
    };

    let launchTimer = null;
    if (!startedRef.current) {
      startedRef.current = true;
      launchTimer = setTimeout(start, Math.max(0, delay));
    } else {
      start();
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (launchTimer) clearTimeout(launchTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, delay, aIdx, bIdx, showA]);

  const urlA = images && images.length ? images[aIdx] : "";
  const urlB = images && images.length ? images[bIdx] : "";

  // Single image: just render it without animation
  if (!images || images.length <= 1) {
    const only = images && images[0] ? images[0] : "";
    return (
      <div
        aria-label="Anonymized image (single)"
        style={{
          position: "relative",
          height: 140,
          borderRadius: 12,
          border: "1px solid #27272a",
          overflow: "hidden",
          background: "#111111",
        }}
      >
        {only ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={only}
            alt="Anonymized project image"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      aria-label="Anonymized image carousel"
      style={{
        position: "relative",
        height: 140,
        borderRadius: 12,
        border: "1px solid #27272a",
        overflow: "hidden",
        background: "#111111",
      }}
    >
      {/* Layer A */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urlA}
        alt="Anonymized project image"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          opacity: showA ? 1 : 0,
          transition: "opacity 700ms ease-in-out",
          pointerEvents: "none",
        }}
      />
      {/* Layer B */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urlB}
        alt="Anonymized project image"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          opacity: showA ? 0 : 1,
          transition: "opacity 700ms ease-in-out",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

const menuLinkStyleTextDark = {
  display: "block",
  padding: "2px 0",
  fontSize: 12,
  textDecoration: "underline",
  color: "#f4f4f5",
  marginBottom: 4,
};

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const { signedIn, checking } = useAuthPresence();

  // Reset-mode detection: route, hash, and Supabase event
  const isResetPath = router?.pathname?.startsWith?.("/auth/reset") || false;
  const [resetMode, setResetMode] = useState(isResetPath);

  useEffect(() => {
    if (isResetPath) setResetMode(true);
  }, [isResetPath]);

  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setResetMode(true);
      }
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    const q = window.location.search || "";
    if (hash.includes("type=recovery") || q.includes("type=recovery")) {
      setResetMode(true);
    }
  }, []);

  if (checking) {
    return <BuildBadge />;
  }

  // If in reset mode, always show Create-new-password screen
  if (resetMode) {
    return (
      <>
        <ResetPasswordScreen onDone={() => setResetMode(false)} />
        <BuildBadge />
      </>
    );
  }

  // ROUTING (logged out):
  // - "/" => LandingScreen
  // - "/signin" => AuthScreen
  // Signed-in: render requested page.
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
    // Default logged-out route = Landing
    return (
      <>
        <LandingScreen />
        <BuildBadge />
      </>
    );
  }

  // Signed in: render app pages
  return (
    <>
      <Component {...pageProps} />
      <BuildBadge />
    </>
  );
}


