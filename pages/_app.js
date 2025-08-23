// pages/_app.js
// Build 36.49_2025-08-23
import "../styles/globals.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

export const BUILD_VERSION = "Build 36.49_2025-08-23";

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
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (mounted) setSignedIn(!!data?.user);
    })();
    const { data: sub } =
      supabase?.auth.onAuthStateChange?.((_event, session) => {
        setSignedIn(!!session?.user);
      }) || { data: null };
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);
  return signedIn;
}

/** Top-right Account control, visible on every page */
function AccountButton() {
  const signedIn = useAuthPresence();
  const [busy, setBusy] = useState(false);

  const baseBtn = {
    position: "fixed",
    right: 8,
    top: 8,
    zIndex: 10000,
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 6,
    background: "#fff",
    border: "1px solid #ccc",
    color: "#111",
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    cursor: "pointer",
  };

  if (!signedIn) {
    // Always navigate to Home, which now IS the sign-in page when logged out
    return (
      <a href="/" aria-label="Go to sign in" style={{ ...baseBtn, textDecoration: "none" }}>
        Sign in
      </a>
    );
  }

  async function handleSignOut() {
    if (busy || !supabase) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
    } finally {
      // After sign-out, go directly to Home (auth screen)
      window.location.href = "/";
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      aria-label="Sign out"
      disabled={busy}
      style={{ ...baseBtn, cursor: busy ? "not-allowed" : "pointer" }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

/** Full sign-in/sign-up UI that shows on Home when logged out */
function HomeAuthScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const page = { maxWidth: 520, margin: "0 auto", padding: "24px 16px" };
  const h1 = { fontSize: 22, fontWeight: 700, margin: "0 0 8px" };
  const p = { fontSize: 14, color: "#444", margin: "0 0 16px" };
  const formRow = { display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" };
  const label = { fontSize: 12, fontWeight: 700, minWidth: 60 };
  const input = { flex: "1 1 280px", padding: "10px 12px", border: "1px solid #ccc", borderRadius: 8, fontSize: 14 };
  const btn = { padding: "10px 14px", border: "1px solid #111", borderRadius: 8, background: "#111", color: "#fff", cursor: "pointer", fontSize: 14 };
  const statusStyle = { fontSize: 13, color: "#555", marginTop: 8 };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!supabase || !email) return;
    setBusy(true);
    setMsg("Sending sign-in link…");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) {
        setMsg("Failed to send link. Please try again.");
      } else {
        setMsg("Check your email for a sign-in link.");
      }
    } catch {
      setMsg("Failed to send link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" style={page}>
      <h1 style={h1}>Sign in / Sign up</h1>
      <p style={p}>
        Enter your email to receive a magic sign-in link. New users are created automatically on first sign-in.
      </p>

      <form onSubmit={handleSubmit} aria-label="Email sign in form">
        <div style={formRow}>
          <label htmlFor="email" style={label}>Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
          />
          <button type="submit" style={btn} disabled={busy} aria-busy={busy ? "true" : "false"}>
            {busy ? "Sending…" : "Send sign-in link"}
          </button>
        </div>
      </form>

      <p aria-live="polite" style={statusStyle}>{msg}</p>
    </main>
  );
}

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const signedIn = useAuthPresence();

  // On Home: if logged out, show the auth screen instead of the normal Home content.
  const showAuthOnHome = router.pathname === "/" && !signedIn;

  // Visually hidden skip link for a11y
  const srOnly = {
    position: "absolute",
    left: "-10000px",
    top: "auto",
    width: "1px",
    height: "1px",
    overflow: "hidden",
  };
  const srOnlyFocus = {
    position: "static",
    width: "auto",
    height: "auto",
    overflow: "visible",
    padding: "4px 8px",
    border: "1px solid #ccc",
    borderRadius: 6,
    background: "#fff",
    margin: 8,
    display: "inline-block",
  };

  function handleSkipFocus(e) {
    e.currentTarget.setAttribute(
      "style",
      Object.entries(srOnlyFocus).map(([k, v]) => `${k}:${v}`).join(";")
    );
  }
  function handleSkipBlur(e) {
    e.currentTarget.setAttribute(
      "style",
      Object.entries(srOnly).map(([k, v]) => `${k}:${v}`).join(";")
    );
  }

  return (
    <>
      <a href="#main" onFocus={handleSkipFocus} onBlur={handleSkipBlur} style={srOnly}>
        Skip to content
      </a>

      {showAuthOnHome ? <HomeAuthScreen /> : <Component {...pageProps} />}

      <AccountButton />
      <BuildBadge />
    </>
  );
}




























