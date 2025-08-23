// pages/_app.js
// Build 36.48_2025-08-23
import "../styles/globals.css";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export const BUILD_VERSION = "Build 36.48_2025-08-23";

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

/** Lightweight global sign-in modal (email magic link) */
function AuthModal({ open, onClose }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    // focus the email input when modal opens
    const t = setTimeout(() => {
      const el = document.getElementById("auth-email");
      el?.focus?.();
    }, 120);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 20000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  };
  const card = {
    width: "100%",
    maxWidth: 520,
    borderRadius: 12,
    background: "#fff",
    border: "1px solid #ddd",
    boxShadow: "0 8px 28px rgba(0,0,0,0.25)",
    padding: "18px 16px",
  };
  const h1 = { fontSize: 20, fontWeight: 800, margin: "0 0 8px" };
  const p = { fontSize: 14, color: "#444", margin: "0 0 14px" };
  const row = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
  const label = { fontSize: 12, fontWeight: 700, minWidth: 56 };
  const input = { flex: "1 1 260px", padding: "10px 12px", border: "1px solid #ccc", borderRadius: 8, fontSize: 14 };
  const btn = { padding: "10px 14px", border: "1px solid #111", borderRadius: 8, background: "#111", color: "#fff", cursor: "pointer", fontSize: 14 };
  const ghost = { padding: "8px 12px", border: "1px solid #ccc", borderRadius: 8, background: "#fff", color: "#111", fontSize: 13 };
  const status = { fontSize: 13, color: "#555", marginTop: 10 };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!supabase || !email) return;
    setBusy(true);
    setMsg("Sending sign-in link…");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
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
    <div role="dialog" aria-modal="true" aria-labelledby="auth-title" style={overlay}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
          <h1 id="auth-title" style={h1}>Sign in / Sign up</h1>
          <button type="button" onClick={onClose} style={ghost} aria-label="Close">Close</button>
        </div>
        <p style={p}>
          Enter your email to receive a magic sign-in link. New users are created automatically on first sign-in.
        </p>
        <form onSubmit={handleSubmit} aria-label="Email sign in form">
          <div style={{ ...row, marginBottom: 12 }}>
            <label htmlFor="auth-email" style={label}>Email</label>
            <input
              id="auth-email"
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
        <p aria-live="polite" style={status}>{msg}</p>
      </div>
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

// Top-right Account control + modal trigger
function AccountControls({ openAuth }) {
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
    return (
      <button type="button" aria-label="Open sign in" onClick={openAuth} style={baseBtn}>
        Sign in
      </button>
    );
  }

  async function handleSignOut() {
    if (busy || !supabase) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setBusy(false);
      // Immediately open the sign-in modal after sign-out
      openAuth();
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

export default function MyApp({ Component, pageProps }) {
  const [authOpen, setAuthOpen] = useState(false);

  // Open modal if URL has ?auth=1 (optional deep link)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("auth") === "1") {
        setAuthOpen(true);
      }
    } catch {}
  }, []);

  return (
    <>
      {/* Skip link for a11y */}
      <a
        href="#main"
        style={{
          position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden",
        }}
        onFocus={(e) =>
          e.currentTarget.setAttribute(
            "style",
            "position:static;width:auto;height:auto;overflow:visible;padding:4px 8px;border:1px solid #ccc;border-radius:6px;background:#fff;margin:8px;display:inline-block;"
          )
        }
        onBlur={(e) =>
          e.currentTarget.setAttribute(
            "style",
            "position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;"
          )
        }
      >
        Skip to content
      </a>

      <Component {...pageProps} />

      <AccountControls openAuth={() => setAuthOpen(true)} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <BuildBadge />
    </>
  );
}





























