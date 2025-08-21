// pages/_app.js
// Build 36.15_2025-08-21
import "../styles/globals.css";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export const BUILD_VERSION = "Build 36.15_2025-08-21";

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

// Global quick-color toolbar (Fibers, Fiber Bundles, Blebs)
function QuickColorToolbar() {
  const router = useRouter();
  const p = router.asPath || "";

  const onBundles = p.startsWith("/category/fiber_bundles");
  const onFibers = p.startsWith("/category/fibers");
  const onBlebs = p.startsWith("/category/clear_to_brown_blebs");
  if (!onBundles && !onFibers && !onBlebs) return null;

  const COLORS = onBlebs
    ? ["Clear", "Yellow", "Orange", "Red", "Brown"]
    : ["white/clear", "blue", "black", "red", "other"];

  const baseHref = onBundles
    ? "/category/fiber_bundles"
    : onFibers
    ? "/category/fibers"
    : "/category/clear_to_brown_blebs";

  const wrap = {
    position: "fixed",
    left: 8,
    bottom: 48, // keep clear of the build badge
    zIndex: 9998,
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: 10,
    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
    padding: "8px 10px",
    maxWidth: "calc(100vw - 120px)",
  };
  const title = { fontSize: 12, fontWeight: 600, marginBottom: 6 };
  const row = { display: "flex", flexWrap: "wrap", gap: 8 };
  const chip = {
    display: "inline-block",
    border: "1px solid #ccc",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    color: "#111",
    background: "#fafafa",
    textDecoration: "none",
  };

  return (
    <nav aria-label="Quick colors" style={wrap}>
      <div style={title}>
        {onBundles ? "Fiber Bundles" : onFibers ? "Fibers" : "Blebs (clear to brown)"} · Quick colors
      </div>
      <div style={row}>
        {COLORS.map((c) => (
          <Link key={c} href={`${baseHref}?color=${encodeURIComponent(c)}`} legacyBehavior>
            <a aria-label={`Filter by color ${c}`} style={chip}>{c}</a>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    const nodes = document.querySelectorAll("[data-build-line]");
    nodes.forEach((n) => n.remove());
  }, []);

  function handleSkipFocus(e) {
    e.currentTarget.setAttribute(
      "style",
      Object.entries(srOnlyFocus)
        .map(([k, v]) => `${k}:${v}`)
        .join(";")
    );
  }
  function handleSkipBlur(e) {
    e.currentTarget.setAttribute(
      "style",
      Object.entries(srOnly)
        .map(([k, v]) => `${k}:${v}`)
        .join(";")
    );
  }

  return (
    <>
      <a
        href="#main"
        onFocus={handleSkipFocus}
        onBlur={handleSkipBlur}
        style={srOnly}
      >
        Skip to content
      </a>
      <Component {...pageProps} />
      <QuickColorToolbar />
      <BuildBadge />
    </>
  );
}








