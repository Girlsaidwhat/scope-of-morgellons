// Build: 36.10c5_2025-08-20
// Global build tag overlay + robust client-side cleanup for any per-page "Build ..." labels.

import { useEffect } from "react";

function BuildBadge() {
  const TAG = "36.10c5_2025-08-20"; // single source of truth

  // Remove any leftover per-page "Build ..." elements after hydration, but keep our global badge.
  useEffect(() => {
    try {
      const badge = document.getElementById("global-build-badge");
      const insideBadge = (el) => !!badge && badge.contains(el);

      const all = Array.from(document.querySelectorAll("body *"));
      for (const el of all) {
        if (insideBadge(el)) continue; // keep the global badge intact
        const txt = (el.textContent || "").trim();
        // Match "Build 123..." or "Build: 123..." (header-style tags we used before)
        if (/^Build(?::|\s)\s*\S+/.test(txt)) {
          // Avoid removing truly fixed overlays (paranoia guard)
          const style = window.getComputedStyle(el);
          if (style.position !== "fixed") {
            el.parentElement?.removeChild(el);
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const styleWrap = {
    position: "fixed",
    right: 8,
    bottom: 8,
    zIndex: 99999,
    background: "rgba(0,0,0,0.72)",
    color: "#fff",
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 8,
    lineHeight: 1.2,
    userSelect: "none",
  };
  const styleSmall = { opacity: 0.85, display: "block", fontSize: 11 };

  return (
    <div id="global-build-badge" aria-label="Build tag" title="Build tag" style={styleWrap}>
      <span style={styleSmall}>Build</span>
      <strong>{TAG}</strong>
    </div>
  );
}

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <BuildBadge />
    </>
  );
}


