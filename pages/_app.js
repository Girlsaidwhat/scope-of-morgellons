// pages/_app.js
// Build 36.13_2025-08-20
import "../styles/globals.css";
import { useEffect } from "react";

export const BUILD_VERSION = "Build 36.13_2025-08-20";

function BuildBadge() {
  return (
    <div
      aria-label="Build version"
      className="fixed bottom-2 right-2 z-50 text-xs px-2 py-1 rounded border bg-white/80 backdrop-blur"
      style={{ position: "fixed" }}
    >
      {BUILD_VERSION}
    </div>
  );
}

export default function MyApp({ Component, pageProps }) {
  // If any legacy per-page build text nodes existed, remove them post-hydration.
  useEffect(() => {
    const nodes = document.querySelectorAll("[data-build-line]");
    nodes.forEach((n) => n.remove());
  }, []);

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <Component {...pageProps} />
      <BuildBadge />
    </>
  );
}





