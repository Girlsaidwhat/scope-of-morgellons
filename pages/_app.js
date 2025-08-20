// pages/_app.js
// Build 36.13_2025-08-20
import "../styles/globals.css";
import { useEffect } from "react";

export const BUILD_VERSION = "Build 36.13_2025-08-20";

function BuildBadge() {
  const badgeStyle = {
    position: "fixed",
    right: 8,
    bottom: 8,
    zIndex: 9999,
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid #ccc",
    background: "rgba(255,255,255,0.9)",
    WebkitBackdropFilter: "blur(2px)",
    backdropFilter: "blur(2px)",
  };
  return (
    <div aria-label="Build version" style={badgeStyle}>
      {BUILD_VERSION}
    </div>
  );
}

export default function MyApp({ Component, pageProps }) {
  // Remove any legacy per-page build markers post-hydration
  useEffect(() => {
    const nodes = document.querySelectorAll("[data-build-line]");
    nodes.forEach((n) => n.remove());
  }, []);

  return (
    <>
      <a href="#main" className="sr-only">Skip to content</a>
      <Component {...pageProps} />
      <BuildBadge />
    </>
  );
}







