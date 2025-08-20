// Build: 36.12_2025-08-20
// Global build tag + cleanup of old per-page labels + "Skip to content" link.

import { useEffect } from "react";

function BuildBadge() {
  const TAG = "36.12_2025-08-20"; // single source of truth

  // Remove any leftover per-page "Build ..." elements after hydration, but keep our global badge.
  useEffect(() => {
    try {
      const badge = document.getElementById("global-build-badge");
      const insideBadge = (el) => !!badge && badge.contains(el);
      const all = Array.from(document.querySelectorAll("body *"));
      for (const el of all) {
        if (insideBadge(el)) continue;
        const txt = (el.textContent || "").trim();
        if (/^Build(?::|\s)\s*\S+/.test(txt)) {
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

function SkipLink() {
  const style = {
    position: "fixed",
    top: 8,
    left: 8,
    padding: "8px 12px",
    background: "#fff",
    border: "2px solid #0f766e",
    color: "#0f766e",
    borderRadius: 8,
    zIndex: 100000,
    transform: "translateY(-150%)",
  };
  const styleFocus = {
    ...style,
    transform: "translateY(0)",
  };

  return (
    <a
      href="#main"
      onFocus={(e) => (e.currentTarget.style.transform = "translateY(0)")}
      onBlur={(e) => (e.currentTarget.style.transform = "translateY(-150%)")}
      aria-label="Skip to main content"
      style={style}
    >
      Skip to content
    </a>
  );
}

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <SkipLink />
      <Component {...pageProps} />
      <BuildBadge />
    </>
  );
}




