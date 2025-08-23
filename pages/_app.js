// pages/_app.js
// Build 36.36d_2025-08-23
import "../styles/globals.css";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export const BUILD_VERSION = "Build 36.36d_2025-08-23";

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

// Try to discover your actual sign-in page automatically
async function detectAuthPath() {
  const candidates = [
    "/signin",
    "/sign-in",
    "/login",
    "/auth",
    "/account",
    "/account/signin",
    "/account/login",
    "/users/signin",
    "/users/login",
    "/profile",
  ];
  const hints = /(sign[\s-]?in|sign[\s-]?up|log[\s-]?in)/i;

  for (const path of candidates) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch(`${path}?v=${encodeURIComponent(BUILD_VERSION)}`, {
        cache: "no-store",
        credentials: "omit",
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const html = await res.text();
      if (hints.test(html)) return path;
    } catch {
      // ignore and try next
    }
  }
  // Fallback to Home if nothing clearly auth-like is found
  return "/";
}

// Minimal “Sign out” button shown only when authenticated
function SignOutButton() {
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);

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

  if (!signedIn) return null;

  const btnStyle = {
    position: "fixed",
    right: 8,
    top: 8,
    zIndex: 10000,
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 6,
    color: "#111",
    background: "#fff",
    border: "1px solid #ccc",
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    cursor: busy ? "not-allowed" : "pointer",
  };

  async function handleSignOut() {
    if (busy || !supabase) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
      const target = await detectAuthPath();
      window.location.href = target;
    } catch {
      // If detection fails for any reason, still take user Home
      window.location.href = "/";
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      aria-label="Sign out"
      disabled={busy}
      style={btnStyle}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

// Visually hidden skip link that appears on focus
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

export default function MyApp({ Component, pageProps }) {
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
      <Component {...pageProps} />
      <SignOutButton />
      <BuildBadge />
    </>
  );
}


























