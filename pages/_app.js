// pages/_app.js
// Build 36.28_2025-08-22
import "../styles/globals.css";

export const BUILD_VERSION = "Build 36.28_2025-08-22";

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
  border: "1px solid #ccc", // <- fixed the quote so it’s valid JS
  borderRadius: 6,
  background: "#fff",
  margin: 8,
  display: "inline-block",
};

export default function MyApp({ Component, pageProps }) {
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
      <a href="#main" onFocus={handleSkipFocus} onBlur={handleSkipBlur} style={srOnly}>
        Skip to content
      </a>
      <Component {...pageProps} />
      <BuildBadge />
    </>
  );
}

















