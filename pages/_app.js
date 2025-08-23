// pages/_app.js
// Build 36.37_2025-08-23
import "../styles/globals.css";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export const BUILD_VERSION = "Build 36.37_2025-08-23";

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

// Top-right Account control: shows "Sign in" (logged out) or "Sign out" (logged in)
function AccountButton() {
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
  };

  if (!signedIn) {
    return (
      <a
        href="/"
        aria-label="Go to sign in"
        style={{ ...baseBtn, textDecoration: "none", display: "inline-block" }}
      >
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
      // Send to your existing sign-in experience on Home
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
      <AccountButton />
      <BuildBadge />
    </>
  );
}



























