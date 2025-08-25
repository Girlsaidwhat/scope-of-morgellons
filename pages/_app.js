// Build 36.66_2025-08-24
import "../styles/globals.css";
import { useEffect, useState } from "react";

const BUILD_TAG = "Build 36.66_2025-08-24";

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

// Minimal gate: if the URL contains recovery tokens, jump to /auth/reset BEFORE anything paints.
function ResetGate({ children }) {
  const [proceed, setProceed] = useState(false);

  useEffect(() => {
    const { pathname, search, hash } = window.location;

    // Query params
    const qs = new URLSearchParams(search);
    const code = qs.get("code");                 // PKCE-style reset
    const qType = (qs.get("type") || "").toLowerCase();
    const qToken = qs.get("token") || qs.get("recovery_token"); // older variants

    // Hash params
    const hs = new URLSearchParams((hash || "").replace(/^#/, ""));
    const hType = (hs.get("type") || "").toLowerCase();         // "recovery"
    const at = hs.get("access_token");
    const rt = hs.get("refresh_token");

    const hasRecovery =
      !!code ||
      (qType === "recovery" && !!qToken) ||
      (hType === "recovery") ||
      (at && rt);

    if (hasRecovery && pathname !== "/auth/reset") {
      // Preserve tokens so /auth/reset can exchange them
      window.location.replace(`/auth/reset${search}${hash}`);
      return;
    }

    setProceed(true);
  }, []);

  // While deciding or redirecting, hold the UI to prevent flicker
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
      </ResetGate>
    </>
  );
}
