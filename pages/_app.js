// Build: 36.10c3_2025-08-20
// Global build tag overlay + client-side cleanup to remove any per-page "Build: ..." labels.

import { useEffect } from "react";

function BuildBadge() {
  const TAG = "36.10c3_2025-08-20"; // single source of truth

  // Remove any leftover per-page "Build: ..." elements after hydration
  useEffect(() => {
    try {
      const all = Array.from(document.querySelectorAll("body *"));
      for (const el of all) {
        const txt = (el.textContent || "").trim();
        // Our global badge shows "Build" without a colon, so it won't match.
        if (txt.startsWith("Build: ")) {
          el.parentElement?.removeChild(el);
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
    <div aria-label="Build tag" title="Build tag" style={styleWrap}>
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

