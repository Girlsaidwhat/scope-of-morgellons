// pages/_app.js
// Build 36.44_2025-08-23
import "../styles/globals.css";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export const BUILD_VERSION = "Build 36.44_2025-08-23";

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

/**
 * On load, if the URL indicates "go to sign-in", try to find the sign-in UI
 * on Home and scroll/focus it. We avoid touching pages/index.js.
 */
function FocusSigninOnLoad() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const wantsSignin =
        url.searchParams.get("signin") === "1" ||
        url.searchParams.get("signedout") === "1" ||
        (url.hash || "").toLowerCase().includes("signin");

      if (!wantsSignin) return;

      function findSigninNode() {
        // 1) Explicit anchor if present
        const byId = document.getElementById("signin");
        if (byId) return byId;

        // 2) A container that contains our known prompt text
        const candidates = Array.from(
          document.querySelectorAll("main,section,div,p")
        );
        const matchText = "Please sign in to view your profile and gallery.";
        const byText = candidates.find((el) =>
          (el.textContent || "").includes(matchText)
        );
        if (byText) return byText;

        // 3) Fallback: any email input or a button that likely triggers sign-in
        const emailInput =
          document.querySelector('input[name="email"]') ||
          document.querySelector('input[type="email"]');
        if (emailInput) return emailInput.closest("form") || emailInput;

        const signButtons = Array.from(
          document.querySelectorAll("button,a[role='button'],a")
        ).filter((el) =>
          /sign\s?-?\s?in|log\s?-?\s?in/i.test(el.textContent || "")
        );
        if (signButtons[0]) return signButtons[0];

        // 4) Last resort: top of main
        const main = document.querySelector("main");
        return main || document.body;
      }

      // Let the page render, then scroll and focus
      setTimeout(() => {
        const target = findSigninNode();
        if (target?.scrollIntoView) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        // Try to focus a useful control inside that area
        const focusable =
          target.querySelector?.('input[name="email"], input[type="email"], button, a[href]') ||
          document.querySelector('input[name="email"]') ||
          document.querySelector('input[type="email"]');
        if (focusable && typeof focusable.focus === "function") {
          focusable.focus();
        }
      }, 180);
    } catch {
      // ignore
    }
  }, []);
  return null;
}

// Always-visible Account control: "Sign in" when logged out, "Sign out" when logged in
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

  function goToHomeSignIn() {
    const v = encodeURIComponent(BUILD_VERSION);
    window.location.href = `/?signin=1#signin&v=${v}`;
  }

  async function handleSignOut() {
    if (busy || !supabase) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
    } finally {
      const v = encodeURIComponent(BUILD_VERSION);
      window.location.href = `/?signedout=1#signin&v=${v}`;
    }
  }

  if (!signedIn) {
    return (
      <button
        type="button"
        onClick={goToHomeSignIn}
        aria-label="Go to sign in"
        style={{ ...baseBtn, cursor: "pointer" }}
      >
        Sign in
      </button>
    );
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
      <FocusSigninOnLoad />
      <AccountButton />
      <BuildBadge />
    </>
  );
}




























