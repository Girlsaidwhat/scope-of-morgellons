// Build 36.73_2025-08-25
import "../styles/globals.css";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const BUILD_TAG = "Build 36.73_2025-08-25";

// Client-side Supabase (no secrets asked)
const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    : null;

function BuildBadge() {
  return (
    <div
      aria-label="build badge"
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        padding: "6px 10px",
        fontSize: 12,
        borderRadius: 6,
        background: "rgba(0,0,0,0.75)",
        color: "white",
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      {BUILD_TAG}
    </div>
  );
}

// Minimal gate: if URL contains recovery tokens, jump to /auth/reset BEFORE anything paints.
function ResetGate({ children }) {
  const [proceed, setProceed] = useState(false);

  useEffect(() => {
    const { pathname, search, hash } = window.location;

    // Query params
    const qs = new URLSearchParams(search);
    const code = qs.get("code");
    const qType = (qs.get("type") || "").toLowerCase();
    const qToken = qs.get("token") || qs.get("recovery_token");

    // Hash params
    const hs = new URLSearchParams((hash || "").replace(/^#/, ""));
    const hType = (hs.get("type") || "").toLowerCase(); // "recovery"
    const at = hs.get("access_token");
    const rt = hs.get("refresh_token");

    const hasRecovery =
      !!code || (qType === "recovery" && !!qToken) || hType === "recovery" || (at && rt);

    if (hasRecovery && pathname !== "/auth/reset") {
      window.location.replace(`/auth/reset${search}${hash}`);
      return;
    }

    setProceed(true);
  }, []);

  if (!proceed) {
    return (
      <>
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          Opening password reset…
        </div>
        <BuildBadge />
      </>
    );
  }

  return (
    <>
      {children}
      <BuildBadge />
    </>
  );
}

/**
 * WireLegacyAuth
 * - No UI changes. Attaches safe native listeners to your existing 36.56 sign-in.
 * - Works whether the form uses submit or a plain button.
 * - Also removes the redundant tip line you flagged.
 */
function WireLegacyAuth() {
  useEffect(() => {
    if (!supabase) return;
    const onHome = window.location.pathname === "/";
    if (!onHome) return;

    // 1) Remove the redundant password tip sentence if present (non-destructive)
    const REDUNDANT = "Use 12+ characters. Spaces are allowed. Symbols are optional.";
    const allNodes = Array.from(document.querySelectorAll("p,div,li,span"));
    for (const el of allNodes) {
      if (el && typeof el.textContent === "string" && el.textContent.trim() === REDUNDANT) {
        // Remove just that line; leave the rest of the layout untouched.
        el.remove();
        break;
      }
    }

    let removed = false;

    // Helper: find the active email/password inputs on the page
    const getCreds = () => {
      const emailEl = document.querySelector('input[type="email"]');
      const pwEl = document.querySelector('input[type="password"]');
      const email = emailEl?.value?.trim();
      const password = pwEl?.value ?? "";
      return { emailEl, pwEl, email, password };
    };

    // Central sign-in routine (Supabase v2)
    const trySignIn = async (e) => {
      if (e && typeof e.preventDefault === "function") {
        try { e.preventDefault(); } catch (_) {}
      }
      const { email, password } = getCreds();
      if (!email || !password) return;

      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign("/");
      } catch (err) {
        // Show a small status near the first form if possible
        let host = document.querySelector("form") || document.body;
        let status = host.querySelector('[data-auth-status]');
        if (!status) {
          status = document.createElement("div");
          status.setAttribute("data-auth-status", "1");
          status.setAttribute("role", "alert");
          status.style.color = "#b00020";
          status.style.marginTop = "6px";
          host.appendChild(status);
        }
        status.textContent = err?.message || "Could not sign in.";
      }
    };

    // 2) Capture submit on any form with email+password
    const onSubmit = (ev) => {
      const form = ev.target;
      if (!(form instanceof HTMLFormElement)) return;
      const hasEmail = form.querySelector('input[type="email"]');
      const hasPw = form.querySelector('input[type="password"]');
      if (hasEmail && hasPw) {
        trySignIn(ev);
      }
    };
    document.addEventListener("submit", onSubmit, true);

    // 3) Capture clicks on buttons/links that look like “Sign in”
    const isSignInButton = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      if (tag !== "BUTTON" && tag !== "A" && tag !== "INPUT") return false;
      const txt = (el.innerText || el.value || "").trim().toLowerCase();
      return txt === "sign in" || txt === "signin" || txt === "log in" || txt === "login";
    };
    const onClick = (ev) => {
      const path = ev.composedPath ? ev.composedPath() : [ev.target];
      const btn = path.find((n) => n && isSignInButton(n));
      if (!btn) return;

      // Only fire if email+password are visible on the page
      const { emailEl, pwEl } = getCreds();
      if (emailEl && pwEl) {
        trySignIn(ev);
      }
    };
    document.addEventListener("click", onClick, true);

    // If auth state changes to signed-in (e.g., other tab), go Home
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user && !removed) window.location.assign("/");
    });
    const unsub = sub?.subscription?.unsubscribe || (() => {});

    return () => {
      removed = true;
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
      try { unsub(); } catch (_) {}
    };
  }, []);

  return null;
}

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Remove any per-page build lines post-hydration
    document.querySelectorAll("[data-build-line]").forEach((el) => el.remove());
  }, []);

  return (
    <>
      <a
        href="#main"
        style={{
          position: "absolute",
          left: -9999,
          top: "auto",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
        onFocus={(e) => {
          e.currentTarget.style.left = "8px";
          e.currentTarget.style.top = "8px";
          e.currentTarget.style.width = "auto";
          e.currentTarget.style.height = "auto";
          e.currentTarget.style.padding = "6px 8px";
          e.currentTarget.style.background = "white";
          e.currentTarget.style.border = "1px solid #ccc";
        }}
        onBlur={(e) => {
          e.currentTarget.style.left = "-9999px";
          e.currentTarget.style.top = "auto";
          e.currentTarget.style.width = "1px";
          e.currentTarget.style.height = "1px";
          e.currentTarget.style.padding = "0";
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.border = "none";
        }}
      >
        Skip to main content
      </a>

      <ResetGate>
        <Component {...pageProps} />
        {/* Invisible helper: keeps your current 36.56 sign-in UI exactly as-is */}
        <WireLegacyAuth />
      </ResetGate>
    </>
  );
}

